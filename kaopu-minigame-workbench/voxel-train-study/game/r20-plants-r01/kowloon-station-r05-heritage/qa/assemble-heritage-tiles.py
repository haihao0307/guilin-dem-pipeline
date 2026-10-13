"""Lossless assembly of verified native GPU tiles; never a new rendering path.
Usage: python qa/assemble-heritage-tiles.py OUTDIR TILE0 TILE1 TILE2
Requires Pillow for PNG decoding/encoding only. No interpolation or colour edit.
"""
from pathlib import Path
import sys,json,hashlib,itertools
from PIL import Image

out=Path(sys.argv[1]);dirs=[Path(x)for x in sys.argv[2:]]
assert len(dirs)>=2,'At least two completed native tiles required'
records=[]
for d in dirs:
 checkpoint=json.loads((d/'checkpoint.json').read_text());assert checkpoint['complete'] is True
 for name,sha in checkpoint['hashes'].items():assert hashlib.sha256((d/name).read_bytes()).hexdigest()==sha,('Corrupt/incomplete tile checkpoint',str(d),name)
 receipt=json.loads((d/'receipt.json').read_text());raw=json.loads((d/'readback.json').read_text());validation=json.loads((d/'validation.json').read_text())
 assert receipt['status']=='rendered-for-architectural-review'
 assert validation['unresolved']==0 and validation['allEightBuffersFinite']
 assert receipt['tile']['halo']==2 and receipt['tile']['count']==len(dirs)
 tile=receipt['tile'];c=tile['core'];halo=tile['halo']
 assert raw['cropTopLeft']=={'x':c['x']-halo,'y':c['y']-halo,'w':c['w']+2*halo,'h':c['h']+2*halo}
 native=Image.open(d/'native-crop.png').convert('RGBA');core=Image.open(d/'tile-core.png').convert('RGBA')
 assert native.size==(raw['width'],raw['height']) and core.size==(c['w'],c['h'])
 assert native.crop((halo,halo,halo+c['w'],halo+c['h'])).tobytes()==core.tobytes(),'Core screenshot differs from the real halo render'
 records.append((receipt['tile']['index'],d,receipt,raw,native,core))
records.sort();assert [r[0]for r in records]==list(range(len(dirs)))
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
 assert receipt.get('view','heritageHall')==first[2].get('view','heritageHall')
 assert receipt['tile']['assemblyCrop']==first[2]['tile']['assemblyCrop']
 assert raw['fullResolution']==first[3]['fullResolution']
 assert raw['encoding']=='RGBA32F bits, rows bottom to top'

def channel_index(raw,x,y):
 c=raw['cropTopLeft'];return ((c['y']+c['h']-1-y)*c['w']+x-c['x'])*4
channels=0;pixels=0
for left,right in itertools.combinations(records,2):
 la,ra=left[3],right[3];lc,rc=la['cropTopLeft'],ra['cropTopLeft']
 x0=max(lc['x'],rc['x']);x1=min(lc['x']+lc['w'],rc['x']+rc['w'])
 y0=max(lc['y'],rc['y']);y1=min(lc['y']+lc['h'],rc['y']+rc['h'])
 if x1<=x0 or y1<=y0:continue
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
assembly=first[2]['tile']['assemblyCrop'];width,height=assembly['w'],assembly['h']
# Every core pixel must appear once, including at horizontal/vertical junctions.
# Reject duplicates/holes instead of depending on paste order to hide mistakes.
coverage=bytearray(width*height)
canvas=Image.new('RGBA',(width,height))
for _,d,r,raw,native,core in records:
 c=r['tile']['core'];x,y=c['x']-assembly['x'],c['y']-assembly['y']
 assert 0<=x and 0<=y and x+c['w']<=width and y+c['h']<=height
 for yy in range(y,y+c['h']):
  for xx in range(x,x+c['w']):
   index=yy*width+xx;assert coverage[index]==0,'Duplicate native core pixel';coverage[index]=1
 canvas.paste(core,(x,y))
 assert canvas.crop((x,y,x+c['w'],y+c['h'])).tobytes()==core.tobytes()
assert all(coverage),'Missing native core pixels'
assert channels>0 and pixels>0,'No verified native tile overlap'
view=first[2].get('view','heritageHall');assert view in ['heritageHall','towerWindow','heritageEnsemble']
out.mkdir(parents=True,exist_ok=True);canvas.save(out/(view+'-native-assembled.png'))
summary={'status':'exact-native-tile-assembly-not-visual-acceptance','modelCommit':first[2]['modelCommit'],'sourceSHA256':reference['sourceSHA256'],'executionSourceSHA256':reference['executionSourceSHA256'],'canvas':first[3]['fullResolution'],'crop':assembly,'tileCores':len(dirs),'haloPixels':2,'overlapRawChannelsCompared':channels,'rawChannelMismatches':0,'overlapRGBAImagesPixelsCompared':pixels,'compositedPixelMismatches':0,'fullShadowIdentical':True,'allActualShaderHashesIdentical':True,'interpolation':'none; copied original PNG core bytes','images':[{'directory':str(d),'pngSha256':hashlib.sha256((d/'tile-core.png').read_bytes()).hexdigest(),'artifactCommit':r['commit'],'attempt':r['attempt']}for _,d,r,_,_,_ in records]}
(out/'assembly-proof.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
