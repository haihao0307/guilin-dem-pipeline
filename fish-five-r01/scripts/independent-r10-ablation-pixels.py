import pathlib,json
import numpy as np
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
file=root/'evidence/R10_RENDER_ABLATION.json'
report=json.loads(file.read_text(encoding='utf-8'))
baseline={(r['mode'],r['view']):r for r in report['rows'] if r['label']=='original-geometry-original-textures'}
metrics=[]
for r in report['rows']:
    a=baseline[(r['mode'],r['view'])]
    x=np.asarray(Image.open(root/'evidence'/a['screenshot']).convert('RGB'),dtype=np.int16)
    y=np.asarray(Image.open(root/'evidence'/r['screenshot']).convert('RGB'),dtype=np.int16)
    mask=np.zeros(x.shape[:2],dtype=bool);mask[74:912,304:1440]=True
    for x0,y0,x1,y1 in [(304,74,850,180),(1150,74,1440,180),(1350,560,1440,850),(620,820,1120,912),(304,740,660,825),(1150,820,1440,912)]:mask[y0:y1,x0:x1]=False
    background=x[200,400];fx=np.max(np.abs(x-background),axis=2)>20;fy=np.max(np.abs(y-background),axis=2)>20
    union=mask&(fx|fy);intersection=mask&fx&fy;d=np.abs(x-y)[union];mx=d.max(axis=1)
    q=dict(label=r['label'],mode=r['mode'],view=r['view'],cameraExact=a['state']['camera']==r['state']['camera'],poseFieldsExact=a['state']['actorFields']==r['state']['actorFields'],meanAbsoluteChannelError=float(d.mean()),over8Fraction=float(np.mean(mx>8)),over32Fraction=float(np.mean(mx>32)),silhouetteThresholdIoU=float(intersection.sum()/union.sum()))
    q['passesExistingRenderLimits']=q['cameraExact'] and q['poseFieldsExact'] and q['meanAbsoluteChannelError']<2 and q['over32Fraction']<.01 and q['silhouetteThresholdIoU']>.99
    metrics.append(q)
report['pixelMetrics']=metrics
report['pixelMethod']='Same unchanged stage UI exclusion rectangles and source foreground threshold as existing independent render check; no threshold raised or image alignment/resizing/editing.'
file.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(metrics))
