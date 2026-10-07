from pathlib import Path
import json,numpy as np
R=Path(__file__).resolve().parent;O=R/'research';c=json.loads((R/'baseline/kaopu-unified-human-workbench/assets/canonical.json').read_text());F=np.array(c['faces']).reshape(-1,3);k=json.loads((R/'frozen/neck-cotangent.json').read_text());U=set(k['unknown']);seam=set(c['bodyRing'])|set(c['headRing']);edges={}
for i,t in enumerate(F):
 for a,b in zip(t,np.roll(t,-1)):edges.setdefault(tuple(sorted((int(a),int(b)))),[]).append(i)
rows=[(e,f)for e,f in edges.items()if len(f)==2];E=np.array([e for e,f in rows]);EF=np.array([f for e,f in rows]);P=np.fromfile(O/'baseline-cases/neutral-vertices.bin',dtype='<f4').reshape(-1,3)
regions={'seam':np.array([a in seam or b in seam for a,b in E]),'band_boundary':np.array([(a in U)!=(b in U)for a,b in E]),'affected_band':np.array([a in U or b in U for a,b in E])};regions['posterior_seam']=regions['seam']&(P[E].mean(1)[:,1]>.025)
def measure(v):
 tri=v[F].astype(float);n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);n/=np.linalg.norm(n,axis=1)[:,None];a=np.degrees(np.arccos(np.clip(np.sum(n[EF[:,0]]*n[EF[:,1]],axis=1),-1,1)))
 return{key:{'edges':int(mask.sum()),'maxDegrees':float(a[mask].max()),'p95Degrees':float(np.quantile(a[mask],.95)),'medianDegrees':float(np.median(a[mask]))}for key,mask in regions.items()}
report={'meaning':'Adjacent face-normal angles on identical material edges; shaded seam vertices remain one shared index/normal. No duplicated vertex-normal weld claim. Discrete sampled poses only.','caseRows':[]}
for row in json.loads((O/'neck-runtime-probe-report.json').read_text())['caseRows']:
 name=row['name'];a=np.fromfile(O/f'baseline-cases/{name}-vertices.bin',dtype='<f4').reshape(-1,3);b=np.fromfile(O/f'candidate-cases/{name}-vertices.bin',dtype='<f4').reshape(-1,3);report['caseRows'].append({'case':name,'before':measure(a),'after':measure(b)})
(O/'neck-normal-metrics.json').write_text(json.dumps(report,indent=2));print(json.dumps(report['caseRows'][0],indent=2))
