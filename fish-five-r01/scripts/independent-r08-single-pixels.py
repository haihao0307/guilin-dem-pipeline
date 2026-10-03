import json, pathlib, hashlib
import numpy as np
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
a=json.loads((root/'evidence/R07_CURRENT_PERFORMANCE_MEMORY.json').read_text())
b=json.loads((root/'evidence/R08_CURRENT_PERFORMANCE_MEMORY.json').read_text())
rows=[]
for x,y in zip(a['rows'],b['rows']):
    if x['group']: continue
    before=np.asarray(Image.open(root/'evidence'/x['screenshotFile']).convert('RGB'),dtype=np.int16)
    after=np.asarray(Image.open(root/'evidence'/y['screenshotFile']).convert('RGB'),dtype=np.int16)
    mask=np.zeros(before.shape[:2],bool);mask[74:912,304:1440]=True
    # UI labels/version/counters are excluded. Every visible scene region remains.
    for x0,y0,x1,y1 in [(304,74,780,190),(1200,74,1440,180),(1350,560,1440,850),(620,820,1120,912),(304,740,660,825),(1150,820,1440,912)]:mask[y0:y1,x0:x1]=False
    difference=np.abs(after-before)[mask];max_per_pixel=difference.max(axis=1)
    rows.append(dict(id=x['id'],group=x['group'],testedPixels=int(mask.sum()),meanAbsoluteChannelError=float(difference.mean()),maxChannelError=int(difference.max()),changedPixelFraction=float(np.mean(max_per_pixel>0)),over2Fraction=float(np.mean(max_per_pixel>2)),over8Fraction=float(np.mean(max_per_pixel>8)),over32Fraction=float(np.mean(max_per_pixel>32))))
report=dict(schema='FISH_R08_INDEPENDENT_SINGLE_PIXEL_COMPARE_1',baselineHtmlSha256=a['htmlSha256'],testedHtmlSha256=b['htmlSha256'],method='Same actual source-reset/60steps oblique runtime. All stage pixels except explicit UI overlay rectangles. No resizing, warping, alignment or image editing.',rows=rows,visualAcceptance=False,productionReady=False)
# Machine proof complements actual visual review; numeric pose and source precision are separate gates.
report['passed']=all(r['meanAbsoluteChannelError']<0.1 and r['over8Fraction']<0.001 and r['over32Fraction']<0.0001 for r in rows)
(root/'evidence/INDEPENDENT_R08_SINGLE_PIXELS.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
