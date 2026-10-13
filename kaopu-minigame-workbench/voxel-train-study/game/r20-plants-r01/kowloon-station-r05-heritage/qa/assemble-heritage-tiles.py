"""Lossless assembly of verified native GPU tiles; never a new rendering path.
Usage: python qa/assemble-heritage-tiles.py OUTDIR TILE0 TILE1 TILE2
Requires Pillow for PNG decoding/encoding only. No interpolation or colour edit.
"""
from pathlib import Path
import sys,json,hashlib
from PIL import Image

out=Path(sys.argv[1]);dirs=[Path(x)for x in sys.argv[2:]]
assert len(dirs)==3,'Exactly three completed hall tiles required'
records=[]
for d in dirs:
 checkpoint=json.loads((d/'checkpoint.json').read_text());assert checkpoint['complete'] is True
 for name,sha in checkpoint['hashes'].items():assert hashlib.sha256((d/name).read_bytes()).hexdigest()==sha,('Corrupt/incomplete tile checkpoint',str(d),name)
 receipt=json.loads((d/'receipt.json').read_text());raw=json.loads((d/'readback.json').read_text());validation=json.loads((d/'validation.json').read_text())
 assert receipt['status']=='rendered-for-architectural-review'
 assert validation['unresolved']==0 and validation['allEightBuffersFinite']
 assert receipt['tile']['halo']==2 and receipt['tile']['count']==3
 assert raw['fullResolution']==[320,213]
 native=Image.open(d/'native-crop.png').convert('RGBA');core=Image.open(d/'tile-core.png').convert('RGBA')
 assert native.size==(raw['width'],raw['height']) and core.size==(60,90)
 assert native.crop((2,2,62,92)).tobytes()==core.tobytes(),'Core screenshot differs from the real halo render'
 records.append((receipt['tile']['index'],d,receipt,raw,native,core))
records.sort();assert [r[0]for r in records]==[0,1,2]
first=records[0];reference=first[2]['state']['kowloonFunction']
for _,d,receipt,raw,_,_ in records:
 p=receipt['state']['kowloonFunction']
 for key in ['sourceSHA256','executionSourceSHA256','shared','testResolution','testShadowResolution']:
  assert p[key]==reference[key],(str(d),'Different frozen frame/field',key)
 for key in ['geometryQuery','traceQuery']:
  assert p[key]['executionOutputs']==reference[key]['executionOutputs'],(str(d),'Different actual shader bytes',key)
 assert raw['shadowReadback']==first[3]['shadowReadback'],'Different full shared shadow texture'
 assert raw['footprint']==first[3]['footprint'],'Different native pixel camera/material footprint'
 assert receipt['modelCommit']==first[2]['modelCommit']
 assert raw['encoding']=='RGBA32F bits, rows bottom to top'

def channel_index(raw,x,y):
 c=raw['cropTopLeft'];return ((c['y']+c['h']-1-y)*c['w']+x-c['x'])*4
channels=0;pixels=0
for left,right in zip(records,records[1:]):
 la,ra=left[3],right[3];lc,rc=la['cropTopLeft'],ra['cropTopLeft']
 x0=max(lc['x'],rc['x']);x1=min(lc['x']+lc['w'],rc['x']+rc['w'])
 y0=max(lc['y'],rc['y']);y1=min(lc['y']+lc['h'],rc['y']+rc['h'])
 assert x1-x0==4 and y1-y0==94
 for y in range(y0,y1):
  for x in range(x0,x1):
   li,ri=channel_index(la,x,y),channel_index(ra,x,y)
   for key in la['buffers']:
    assert la['buffers'][key][li:li+4]==ra['buffers'][key][ri:ri+4],('Raw overlap mismatch',key,x,y)
    channels+=4
   # Both complete derivative neighbourhoods are present here. Edge halo
   # presentation pixels are deliberately not used as final image evidence.
   if all(c['x']+1<=x<c['x']+c['w']-1 and c['y']+1<=y<c['y']+c['h']-1 for c in [lc,rc]):
    assert left[4].getpixel((x-lc['x'],y-lc['y']))==right[4].getpixel((x-rc['x'],y-rc['y'])),('Composited overlap mismatch',x,y)
    pixels+=1
assembly=first[2]['tile']['assemblyCrop'];assert assembly=={'x':60,'y':62,'w':180,'h':90}
canvas=Image.new('RGBA',(180,90))
for _,d,r,raw,native,core in records:
 c=r['tile']['core'];canvas.paste(core,(c['x']-60,c['y']-62))
 assert canvas.crop((c['x']-60,0,c['x']-60+60,90)).tobytes()==core.tobytes()
out.mkdir(parents=True,exist_ok=True);canvas.save(out/'heritageHall-native-assembled.png')
summary={'status':'exact-native-tile-assembly-not-visual-acceptance','modelCommit':first[2]['modelCommit'],'sourceSHA256':reference['sourceSHA256'],'executionSourceSHA256':reference['executionSourceSHA256'],'canvas':[320,213],'crop':assembly,'tileCores':3,'haloPixels':2,'overlapRawChannelsCompared':channels,'rawChannelMismatches':0,'overlapRGBAImagesPixelsCompared':pixels,'compositedPixelMismatches':0,'fullShadowIdentical':True,'allActualShaderHashesIdentical':True,'interpolation':'none; copied original PNG core bytes','images':[{'directory':str(d),'pngSha256':hashlib.sha256((d/'tile-core.png').read_bytes()).hexdigest(),'artifactCommit':r['commit'],'attempt':r['attempt']}for _,d,r,_,_,_ in records]}
(out/'assembly-proof.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
