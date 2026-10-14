"""Pinned read-only audit; no external maps/models enter production.
Run: python audit_reference.py --out /tmp/skin-audit
Dependencies: Pillow and numpy. Images and bundle are temporary research
artifacts only. Image statistics are NOT tissue or millimetre measurements.
"""
from __future__ import annotations
import argparse, concurrent.futures, hashlib, io, json, pathlib, re, urllib.request
import numpy as np
from PIL import Image, ImageDraw
REF='21462e471d53ba8c413a96989016510ca4495a34'
ROOT=f'https://raw.githubusercontent.com/lo-th/head/{REF}/'
SETS=[f'{s}{i}' for s in ('M','W') for i in range(1,5)]
CHANNELS=('c','n','r','s','sss')
BUNDLE_BLOB='076a073a2dc579ba9d178447143503b17f6dcce2'
CROP=(640,896,896,1152) # Atlas coordinates, not a certified anatomical ROI.

def fetch(url:str)->bytes:
    req=urllib.request.Request(url,headers={'User-Agent':'KAOPU-Skin-Reference-Audit','Accept-Encoding':'identity'})
    with urllib.request.urlopen(req,timeout=90) as res:return res.read()

def git_blob(data:bytes)->str:
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def image_record(key):
    skin,channel=key;path=f'assets/textures/head/skin{skin}_{channel}.jpg'
    data=fetch(ROOT+path)
    with Image.open(io.BytesIO(data)) as im:
        size,mode,fmt=list(im.size),im.mode,im.format
        rgb=im.convert('RGB');small=rgb.resize((256,256),Image.Resampling.LANCZOS)
        crop=rgb.crop(CROP)
        overview=rgb.resize((768,768),Image.Resampling.LANCZOS) if key==('M1','c') else None
    a=np.asarray(small).astype(np.float32)/255
    return key,{'path':path,'width':size[0],'height':size[1],'mode':mode,'actualEncoding':fmt,
      'bytes':len(data),'git_blob_sha1':git_blob(data),'sha256':hashlib.sha256(data).hexdigest(),
      'analysis_resolution':[256,256],'encoded_rgb_mean':a.mean((0,1)).tolist(),
      'encoded_rgb_std':a.std((0,1)).tolist(),
      'notes':'Whole atlas including background; not physiological or regional calibration.'},small,crop,overview

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);args=ap.parse_args()
    out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
    data=fetch(ROOT+'build/bundle.js');assert git_blob(data)==BUNDLE_BLOB,'Pinned bundle mismatch'
    source=data.decode('utf-8')
    (out/'reference_bundle_for_read_only_audit.txt').write_text(source)
    contexts={}
    for term in ['loadSkin(e)','skinM1_c','_sss\"]','_s\"]','_r\"]','vertexUvs','thicknessNode','thicknessColorNode','skinM1','normalScale','switchMap(e)']:
        hits=[m.start() for m in re.finditer(re.escape(term),source)]
        contexts[term]=[source[max(0,i-100):i+480] for i in hits[-3:]]
    records=[];images={};crops={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for key,rec,im,crop,overview in pool.map(image_record,[(s,c) for s in SETS for c in CHANNELS]):
            records.append(rec);images[key]=im;crops[key]=crop
            if overview:overview.save(out/'research-M1-colour-overview.jpg',quality=85)
    corr={}
    for skin in SETS:
        corr[skin]={}
        for ca,cb in [('r','s'),('c','sss')]:
            a=np.asarray(images[skin,ca]).astype(float).reshape(-1)
            b=np.asarray(images[skin,cb]).astype(float).reshape(-1)
            corr[skin][ca+'__'+cb]=float(np.corrcoef(a,b)[0,1])
    report={'schema':'kaopu.reference-skin-audit/1','referenceCommit':REF,'bundleGitBlob':git_blob(data),
      'bundleBytes':len(data),'setCount':len(SETS),'files':records,
      'correlations_encoded_rgb_256_including_background':corr,
      'cropBoxAtlasPixels':list(CROP),'limits':['No physical scale or surface-area calibration; no mm pore statistics.',
        'Source M/W labels are not demographic standards.','No external maps or mesh imported to runtime.',
        'No height recovered from normal maps or optical coefficients inferred.',
        'Correlations include atlas background and are not biological laws.']}
    (out/'reference-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (out/'wiring-diagnostics.json').write_text(json.dumps(contexts,ensure_ascii=False,indent=2)+'\n')
    sheet=Image.new('RGB',(4*192,2*212),(38,38,38));d=ImageDraw.Draw(sheet)
    for i,skin in enumerate(SETS):
        x,y=(i%4)*192,(i//4)*212;sheet.paste(images[skin,'c'].resize((192,192)),(x,y+20));d.text((x+6,y+3),skin,fill='white')
    sheet.save(out/'research-colour-contact.jpg',quality=65)
    for skin in SETS:
        strip=Image.new('RGB',(5*256,280),(38,38,38));d=ImageDraw.Draw(strip)
        for i,c in enumerate(CHANNELS):
            strip.paste(crops[skin,c],(i*256,24));d.text((i*256+6,4),skin+' '+c+' native pixel crop',fill='white')
        strip.save(out/f'research-native-crop-{skin}.png')
    for skin in ('M1','W4'):
        strip=Image.new('RGB',(5*192,212),(38,38,38));d=ImageDraw.Draw(strip)
        for i,c in enumerate(CHANNELS):
            strip.paste(images[skin,c].resize((192,192)),(i*192,20));d.text((i*192+6,3),skin+' '+c,fill='white')
        strip.save(out/f'research-channels-{skin}.jpg',quality=65)
    print(json.dumps({'sets':len(SETS),'maps':len(records),'actualEncodings':sorted({r['actualEncoding'] for r in records}),
      'sizes':sorted({(r['width'],r['height']) for r in records}),'encoded_total_bytes':sum(r['bytes'] for r in records),
      'referenceCommit':REF,'bundle_verified':True}))

if __name__=='__main__':main()
