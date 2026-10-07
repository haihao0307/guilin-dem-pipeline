from pathlib import Path
import json,numpy as np
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import splu
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
R=Path(__file__).resolve().parent;O=R/'research';c=json.loads((R/'baseline/kaopu-unified-human-workbench/assets/canonical.json').read_text());F=np.array(c['faces']).reshape(-1,3);N=len(c['annyRecipes'])+len(c['gnmRecipes']);B=len(c['annyRecipes']);source=json.loads((O/'neutral.json').read_text());P=np.fromfile(O/'young-raw.bin',dtype='<f4').reshape(-1,3).astype(float);protected=np.array(c['protectedHeadIndices'])+B
def normals(v):
 n=np.cross(v[F[:,1]]-v[F[:,0]],v[F[:,2]]-v[F[:,0]]);return n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-20)
def section(v):
 anchor=float(v[np.array(c['bodyRing']),2].mean())
 tri=v[F];segments=[]
 for t in tri:
  if t[:,2].max()<anchor-.06 or t[:,2].min()>anchor+.105:continue
  pts=[]
  for a,b in zip(t,np.roll(t,-1,axis=0)):
   if a[0]*b[0]<0:pts.append(a+(b-a)*(-a[0]/(b[0]-a[0])))
   elif abs(a[0])<1e-8:pts.append(a)
  if len(pts)>=2:segments.append(np.array(pts[:2]))
 z=np.linspace(anchor-.055,anchor+.10,311);y=[]
 for h in z:
  hits=[]
  for a,b in segments:
   if min(a[2],b[2])<=h<=max(a[2],b[2])and abs(a[2]-b[2])>1e-9:hits.append(a[1]+(b[1]-a[1])*(h-a[2])/(b[2]-a[2]))
  y.append(max(hits)if hits else np.nan)
 return z-anchor,np.array(y)
edges={}
for i,f in enumerate(F):
 for a,b in zip(f,np.roll(f,-1)):edges.setdefault(tuple(sorted((a,b))),[]).append(i)
edge_rows=[(e,fs)for e,fs in edges.items()if len(fs)==2];E=np.array([e for e,_ in edge_rows]);EF=np.array([fs for _,fs in edge_rows]);seam=set(c['bodyRing'])|set(c['headRing']);seamedge=np.array([a in seam or b in seam for a,b in E]);neckedge=(P[E].mean(1)[:,2]>.58)&(P[E].mean(1)[:,2]<.69);backedge=neckedge&(P[E].mean(1)[:,1]>.025)
rows=[];fig,axes=plt.subplots(1,3,figsize=(14,5))
for ai,age in enumerate(['young','child','old']):
 for stage in ['raw','contour','final','uniform','cotangent']:
  v=np.fromfile(O/f'{age}-{stage}.bin',dtype='<f4').reshape(-1,3);n=normals(v);ang=np.degrees(np.arccos(np.clip(np.sum(n[EF[:,0]]*n[EF[:,1]],axis=1),-1,1)));z,y=section(v);axes[ai].plot(y*1000,z*1000,label=stage);rows.append({'case':age+'-'+stage,'maxRearDihedral':float(ang[backedge].max()),'rearP95Dihedral':float(np.quantile(ang[backedge],.95)),'maxSeamDihedral':float(ang[seamedge].max())})
 axes[ai].set_title(age);axes[ai].set_xlabel('posterior +Y (mm)');axes[ai].set_ylabel('Z above current body cut ring (mm)');axes[ai].legend();axes[ai].grid(alpha=.3)
fig.tight_layout();fig.savefig(O/'ablation-posterior-profile.png',dpi=140);(O/'ablation-geometry.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))
