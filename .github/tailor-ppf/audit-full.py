"""Read-only independent rest-UV stretch audit for complete official recordings."""
import argparse, hashlib, json
from pathlib import Path
import cbor2
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('session',type=Path)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args(); root=args.session
status=cbor2.loads((root/'output/status.cbor').read_bytes())['payload']
assert status['outcome']['kind']=='finished'
tri=np.fromfile(root/'bin/tri.bin','<u8').reshape(-1,3)
uv=np.fromfile(root/'bin/uv.bin','<f4').reshape(-1,3,2).astype('f8')
limits=np.fromfile(root/'bin/param/tri-strain-limit.bin','<f4').astype('f8')
objects=np.fromfile(root/'bin/object_vert.bin','<u4')[tri[:,0]]
du,dv=uv[:,1]-uv[:,0],uv[:,2]-uv[:,0]
det=du[:,0]*dv[:,1]-du[:,1]*dv[:,0]
assert np.all(np.abs(det)>1e-15)
areas=np.abs(det)/2
rows=[]
for frame in range(status['frame']+1):
    f=root/'output'/f'vert_{frame}.bin';raw=f.read_bytes()
    v=np.frombuffer(raw,'<f4').astype('f8').reshape(-1,3)
    assert np.isfinite(v).all()
    p=v[tri];e1,e2=p[:,1]-p[:,0],p[:,2]-p[:,0]
    f1=(e1*dv[:,1,None]-e2*du[:,1,None])/det[:,None]
    f2=(-e1*dv[:,0,None]+e2*du[:,0,None])/det[:,None]
    aa,bb,ab=(f1*f1).sum(1),(f2*f2).sum(1),(f1*f2).sum(1)
    disc=np.hypot(aa-bb,2*ab)
    stretch=np.sqrt(np.maximum(0,(aa+bb+disc)/2))
    compression=np.sqrt(np.maximum(0,(aa+bb-disc)/2))
    groups=[]
    for obj in np.unique(objects):
        mask=objects==obj;s=stretch[mask];a=areas[mask];order=np.argsort(s)
        p95=s[order][np.searchsorted(np.cumsum(a[order]),a.sum()*.95)]
        active=mask & (limits>0)
        over=active & (stretch>1+limits+1e-4)
        worst=np.flatnonzero(mask)[np.argmax(s)]
        groups.append({'object':int(obj),'maximumStretch':float(s.max()),'minimumStretch':float(compression[mask].min()),
                       'p95AreaWeightedStretch':float(p95),'worstTriangle':int(worst),'worstUv':uv[worst].tolist(),
                       'limitedAreaAboveBoundPlus1e4Percent':float(100*areas[over].sum()/a.sum())})
    rows.append({'frame':frame,'sha256':hashlib.sha256(raw).hexdigest(),'finite':True,'objects':groups})
report={'method':'Independent singular values of 3x2 deformation gradient from unchanged original per-triangle UV',
        'upperBoundTolerance':0.0001,'zeroStrainLimitMeansDisabled':True,'compressionSeparate':True,
        'intersectionEvidence':'Official solver completed with its enabled per-step intersection checks; this audit does not independently test every triangle pair',
        'frames':rows,'frameCount':len(rows),'allFinite':True,
        'maximumStretch':max(o['maximumStretch'] for f in rows for o in f['objects']),
        'maximumOverBoundAreaPercent':max(o['limitedAreaAboveBoundPlus1e4Percent'] for f in rows for o in f['objects'])}
args.out.write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='frames'},indent=2))
