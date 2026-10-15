from PIL import Image,ImageChops
from pathlib import Path
import json
P=Path(__file__).resolve().parents[1];base=P.parent/'Hair-Fiber-System-R04-Character-20261015'/'qa';out=[]
for style in ['medium','long']:
 for color in ['black','chestnut']:
  for view in ['oblique','front','side','back','top']:
   f=f'{style}-{color}-{view}.png'
   a=Image.open(base/f).convert('RGB').crop((22,86,1134,1028));b=Image.open(P/'qa'/f).convert('RGB').crop((22,86,1134,1028));diff=ImageChops.difference(a,b);values=list(diff.getdata());mean=sum(sum(v) for v in values)/(len(values)*3);large=sum(max(v)>20 for v in values)/len(values);out.append({'style':style,'color':color,'view':view,'meanAbsoluteRGB255':mean,'pixelsAnyChannelOver20Fraction':large})
   if color=='black' and view=='oblique':diff.save(P/'qa'/('difference-'+style+'.png'))
report={'sourceHashes':json.loads((P/'BUILD_MANIFEST.json').read_text(encoding='utf-8'))['files'],'crop':[22,86,1134,1028],'comparison':'same viewport and deterministic manual pose, baseline R04 vs R05, RGB255 absolute differences','cases':out}
print(json.dumps(out));(P/'qa/visual-difference.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
