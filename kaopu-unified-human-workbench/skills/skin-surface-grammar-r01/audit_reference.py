"""Read-only research audit. Never installs reference maps into a runtime.
Run: python audit_reference.py --out /tmp/skin-audit
Requires Pillow and numpy. Full reference bytes stay in process memory only.
All numerical image statistics are encoded-image observations, not tissue measurements.
"""
from __future__ import annotations
import argparse, base64, concurrent.futures, hashlib, io, json, pathlib, re, urllib.request
import numpy as np
from PIL import Image, ImageDraw

REF = '21462e471d53ba8c413a96989016510ca4495a34'
ROOT = f'https://raw.githubusercontent.com/lo-th/head/{REF}/'
SETS = [f'{s}{i}' for s in ('M','W') for i in range(1,5)]
CHANNELS = ('c','n','r','s','sss')
BUNDLE_BLOB = '076a073a2dc579ba9d178447143503b17f6dcce2'

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent':'KAOPU-Skin-Reference-Audit','Accept-Encoding':'identity'})
    with urllib.request.urlopen(req, timeout=90) as res:
        return res.read()

def git_blob(data: bytes) -> str:
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()

def image_record(key: tuple[str,str]):
    skin, channel = key
    name = f'skin{skin}_{channel}.jpg'
    path = f'assets/textures/head/{name}'
    data = fetch(ROOT+path)
    with Image.open(io.BytesIO(data)) as im:
        size, mode = list(im.size), im.mode
        small = im.convert('RGB').resize((256,256), Image.Resampling.LANCZOS)
    a=np.asarray(small).astype(np.float32)/255
    return key, {'path':path,'width':size[0],'height':size[1],'mode':mode,'bytes':len(data),
      'git_blob_sha1':git_blob(data),'sha256':hashlib.sha256(data).hexdigest(),
      'analysis_resolution':[256,256], 'encoded_rgb_mean':a.mean((0,1)).tolist(),
      'encoded_rgb_std':a.std((0,1)).tolist(),
      'notes':'Means include atlas background; not regional or physical calibration.'}, small

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);args=ap.parse_args()
    out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
    data=fetch(ROOT+'build/bundle.js')
    assert git_blob(data)==BUNDLE_BLOB, 'Pinned bundle content mismatch'
    source=data.decode('utf-8')
    # Short diagnostic windows around actual asset references and material setters.
    contexts={}
    terms=['loadSkin(e)','skinM1_c','_sss\"]','_sss\"','_s\"]','_r\"]','_n\"]','vertexUvs','thicknessColorNode=','changeSkin','setTexture','skinName']
    for term in terms:
        hits=[m.start() for m in re.finditer(re.escape(term),source)]
        contexts[term]=[source[max(0,i-100):i+380] for i in hits[-4:]]
    # App tail contains scene material wiring. Save a diagnostic-only text report,
    # not executable copies of the reference bundle.
    markers=['this.skinMaterial','this.materialSkin','skinMaterial','skinM1','roughnessMap=eR','specularIntensityMap=eR','metalnessMap=eR','normalMap=eR']
    for term in markers:
        hits=[m.start() for m in re.finditer(re.escape(term),source)]
        contexts[term]=[source[max(0,i-100):i+520] for i in hits[-3:]]
    records=[];images={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for key,rec,im in pool.map(image_record,[(s,c) for s in SETS for c in CHANNELS]):
            records.append(rec);images[key]=im
    corr={}
    for skin in SETS:
        corr[skin]={}
        for ca,cb in [('r','s'),('c','sss')]:
            a=np.asarray(images[skin,ca]).astype(float).reshape(-1)
            b=np.asarray(images[skin,cb]).astype(float).reshape(-1)
            corr[skin][ca+'__'+cb]=float(np.corrcoef(a,b)[0,1])
    report={'schema':'kaopu.reference-skin-audit/1','referenceCommit':REF,
      'bundleGitBlob':git_blob(data),'bundleBytes':len(data),'setCount':len(SETS),'files':records,
      'correlations_encoded_rgb_256_including_background':corr,
      'limits':['No physical scale or UV surface-area calibration; no millimetre pore statistics.',
        'No per-preset demographic inference. M/W names are source labels only.',
        'No source texture/model installed or copied to runtime.',
        'No reconstructed height from normals; no scattering coefficient inversion.',
        'Image correlations are whole-atlas diagnostics, not biological laws.']}
    (out/'reference-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (out/'wiring-diagnostics.json').write_text(json.dumps(contexts,ensure_ascii=False,indent=2)+'\n')
    # Small research contact sheets, kept only as temporary CI artifacts, never
    # committed to this project or delivered as reusable skins.
    sheet=Image.new('RGB',(4*192,2*212),(38,38,38));draw=ImageDraw.Draw(sheet)
    for i,skin in enumerate(SETS):
        x,y=(i%4)*192,(i//4)*212
        sheet.paste(images[skin,'c'].resize((192,192)),(x,y+20));draw.text((x+6,y+3),skin,fill=(255,255,255))
    sheet.save(out/'research-colour-contact.jpg',quality=60)
    for skin in ('M1','W4'):
        strip=Image.new('RGB',(5*192,212),(38,38,38));d=ImageDraw.Draw(strip)
        for i,c in enumerate(CHANNELS):
            strip.paste(images[skin,c].resize((192,192)),(i*192,20));d.text((i*192+6,3),skin+' '+c,fill=(255,255,255))
        strip.save(out/f'research-channels-{skin}.jpg',quality=65)
    # Only compact text evidence is copied back by CI.
    print(json.dumps({'sets':len(SETS),'maps':len(records),'sizes':sorted(set((r['width'],r['height']) for r in records)),
      'encoded_total_bytes':sum(r['bytes'] for r in records),'referenceCommit':REF}))
    print('WIRING_DIAGNOSTICS_START\n'+json.dumps(contexts,ensure_ascii=False)+'\nWIRING_DIAGNOSTICS_END')

if __name__=='__main__': main()
