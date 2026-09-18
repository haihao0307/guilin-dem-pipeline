from pathlib import Path
import json, numpy as np
from source import g,acc,image
from scipy.ndimage import distance_transform_edt
from fit_chart_fields import sample as image_sample
R=Path(__file__).resolve().parents[1];doc=json.loads((R/'FISH_REF001_FIELD_STUDY.json').read_text());rng=np.random.default_rng(20260919)
im=np.asarray(image(0));reports=[]
def cubic(p0,p1,p2,p3,t):return p1+.5*t*(p2-p0+t*(2*p0-5*p1+4*p2-p3+t*(3*(p1-p2)+p3-p0)))
def curve(coeff,x):
 a=np.asarray(coeff);q=np.clip(x,0,1)*(a.shape[1]-1);i=np.floor(q).astype(int);t=q-i
 return cubic(a[:,np.clip(i-1,0,a.shape[1]-1)],a[:,i],a[:,np.minimum(i+1,a.shape[1]-1)],a[:,np.minimum(i+2,a.shape[1]-1)],t[None,:])
def evaluate(f,u,v):return np.sum(curve(f['rows'],v)*curve(f['cols'],u),axis=0)
for patch in doc['patches']:
 mi,ci=map(int,patch['id'].split('-')[1:]);pr=g['meshes'][mi]['primitives'][0];at=pr['attributes'];p=acc(at['POSITION']);uv=acc(at['TEXCOORD_0']);fa=acc(pr['indices']).reshape(-1,3)
 lab=np.load(R/f'research/components{mi}.npz')['labels'];ids=np.where(lab==ci)[0];fs=fa[lab[fa[:,0]]==ci];area=np.linalg.norm(np.cross(p[fs[:,1]]-p[fs[:,0]],p[fs[:,2]]-p[fs[:,0]]),axis=1)*.5
 if area.sum()==0:continue
 n=5000 if ci==0 and mi==0 else 500;fi=rng.choice(len(fs),size=n,p=area/area.sum());r=rng.random((n,2));s=np.sqrt(r[:,0]);b=np.array([1-s,s*(1-r[:,1]),s*r[:,1]]).T
 pp=np.einsum('nj,njk->nk',b,p[fs[fi]]);UV=np.einsum('nj,njk->nk',b,uv[fs[fi]]);lo=uv[ids].min(0);span=uv[ids].max(0)-lo;u,v=((UV-lo)/span).T
 pred=np.stack([evaluate(patch['fields'][k],u,v)for k in ['x','y','z']],axis=1);err=np.linalg.norm(pred-pp,axis=1)/doc['sourceLengthUnits']
 observed=image_sample(im,UV,color=True);col=np.stack([evaluate(patch['fields'][k],u,v)for k in ['red','green','blue']],1)
 eps=1e-4;DU=np.stack([(evaluate(patch['fields'][k],u+eps,v)-evaluate(patch['fields'][k],u-eps,v))/(2*eps)for k in ['x','y','z']],1);DV=np.stack([(evaluate(patch['fields'][k],u,v+eps)-evaluate(patch['fields'][k],u,v-eps))/(2*eps)for k in ['x','y','z']],1);jac=np.linalg.norm(np.cross(DU,DV),axis=1)
 gridY=np.clip(np.round(v*(patch['height']-1)).astype(int),0,patch['height']-1);gridX=u*(patch['width']-1);inside=[]
 for y,x in zip(gridY,gridX):
  spans=patch['domain'][y];inside.append(any(spans[k]<=x<=spans[k+1]for k in range(0,len(spans),2)))
 reports.append({'patch':patch['id'],'heldoutSamples':n,'heldoutSourceDomainRetained':int(np.sum(inside)),'geometryErrorPercentReferenceLength':{'median':float(np.median(err)*100),'rms':float(np.sqrt(np.mean(err**2))*100),'p95':float(np.quantile(err,.95)*100),'max':float(err.max()*100)},'linearRGBRMSE':float(np.sqrt(np.mean((col-observed[:,:3])**2))),'minSampleJacobian':float(jac.min()),'sampledZeroJacobians':int((jac<1e-12).sum()),'finite':bool(np.isfinite(pred).all() and np.isfinite(col).all())})
q={'revision':'R03.A','scope':'off-grid source triangle area samples; not reused fitting lattice; only checks sampled chart mapping, not global injectivity or anatomical fidelity','sourceLengthUnits':doc['sourceLengthUnits'],'physicalMetreScaleIndependentlyValidated':False,'patches':reports,'notes':['Two-dimensional chart parameter domains derived from source UV charts, not yet species-level anatomical coordinates','Complete jaw/gill articulation and growth model not reconstructed','No claim of universal compression or exact full material fidelity'],'acceptance':{'visual':False,'anatomical':False,'continuousCollision':False,'allScales':False,'production':False}}
(R/'qa/heldout.json').write_text(json.dumps(q,indent=2));print(json.dumps(q,indent=2))
