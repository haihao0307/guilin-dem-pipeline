from pathlib import Path
import numpy as np,json
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from triangle_contact import aabb_candidates,normals_and_areas,classify_pair,EPS
R=Path(__file__).resolve().parent.parent;D=R/'research/full-head-cases';f=np.fromfile(D/'anny-faces.u32','<u4').reshape(-1,3);e=np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]);_,c=connected_components(coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(13718,13718)),directed=False);counts=np.bincount(c);tongue=np.flatnonzero(counts==226)[0];rows=[]
for name in ['anny-neutral','anny-jaw','anny-tongue']:
 v=np.fromfile(D/(name+'-native.f32'),'<f4').reshape(-1,3).astype(float);ids=np.flatnonzero((v[f,2]>.48).all(1));t=v[f[ids]];n,a=normals_and_areas(t);pairs,_=aabb_candidates(t,f[ids]);fc=c[f[ids,0]];pairs=pairs[(fc[pairs[:,0]]!=fc[pairs[:,1]])&((fc[pairs[:,0]]==tongue)|(fc[pairs[:,1]]==tongue))];hits=[]
 for x,y in pairs:
  kind,detail=classify_pair(t[x],t[y],n[x],n[y])
  if kind in ('proper_crossing','coplanar_overlap'):hits.append({'faces':[int(ids[x]),int(ids[y])],'kind':kind,**detail})
 rows.append({'name':name,'nativeTongueSkinCrossings':len(hits),'hits':hits});print(name,len(hits),flush=True)
(R/'research/native-anny-tongue-contact.json').write_text(json.dumps({'actualNativeTeacher':True,'inputCaseManifest':'research/full-head-cases/manifest.json','rows':rows},indent=2))
