import pathlib,json,hashlib
import numpy as np
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
browser=json.loads((root/'evidence/INDEPENDENT_R10_BROWSER.json').read_text(encoding='utf-8'))
before,after=browser['comparisons']
rows=[]
for a,b in zip(before['frames'],after['frames']):
    if (a['mode'],a['view'])!=(b['mode'],b['view']):raise RuntimeError('Pose pairing mismatch')
    camera_exact=a['state']['camera']==b['state']['camera']
    fields_exact=a['state']['actorFields']==b['state']['actorFields']
    pa=root/'evidence'/a['screenshot'];pb=root/'evidence'/b['screenshot']
    x=np.asarray(Image.open(pa).convert('RGB'),dtype=np.int16);y=np.asarray(Image.open(pb).convert('RGB'),dtype=np.int16)
    mask=np.zeros(x.shape[:2],dtype=bool);mask[74:912,304:1440]=True
    for x0,y0,x1,y1 in [(304,74,850,180),(1150,74,1440,180),(1350,560,1440,850),(620,820,1120,912),(304,740,660,825),(1150,820,1440,912)]:mask[y0:y1,x0:x1]=False
    background=x[200,400]
    fx=np.max(np.abs(x-background),axis=2)>20;fy=np.max(np.abs(y-background),axis=2)>20
    union=mask&(fx|fy);intersection=mask&fx&fy
    delta=np.abs(x-y);d=delta[union];dmax=np.max(d,axis=1)
    iou=float(intersection.sum()/union.sum())
    row=dict(mode=a['mode'],view=a['view'],cameraExact=camera_exact,poseFieldsExact=fields_exact,foregroundPixels=int(union.sum()),silhouetteThresholdIoU=iou,meanAbsoluteChannelError=float(d.mean()),maxChannelError=int(d.max()),over8Fraction=float(np.mean(dmax>8)),over32Fraction=float(np.mean(dmax>32)),beforeSha256=hashlib.sha256(pa.read_bytes()).hexdigest(),afterSha256=hashlib.sha256(pb.read_bytes()).hexdigest())
    # Engineering regression limits assess this paired internal QA capture, not general source/visual acceptance.
    row['passed']=camera_exact and fields_exact and iou>.99 and row['meanAbsoluteChannelError']<2 and row['over32Fraction']<.01
    rows.append(row)
report=dict(schema='FISH_R10_INDEPENDENT_RENDER_PIXELS_1',sourceHead=browser['sourceHead'],testedHtmlSha256=browser['htmlSha256'],onlineEntrySha256=browser['onlineEntrySha256'],method='Actual independently captured old R09/new R10 realtime native render, identical reset+120 steps and camera, amplitude1.6/swing1.35; excludes only explicit UI rectangles; no warping, alignment, resizing or editing. Thresholded foreground IoU is a raster regression proxy, not a Hausdorff proof.',rows=rows,passed=len(rows)==12 and all(r['passed'] for r in rows),visualAcceptance=False,productionReady=False)
(root/'evidence/INDEPENDENT_R10_RENDER_PIXELS.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
