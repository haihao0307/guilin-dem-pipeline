"""Split native GNM cavities by its semantic boundaries and connectivity, not a box."""
from pathlib import Path
import json,numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
R=Path(__file__).resolve().parent.parent;D=R/'research/geometry';v=np.fromfile(D/'gnm-vertices.f32','<f4').reshape(-1,3);f=np.fromfile(D/'gnm-faces.u32','<u4').reshape(-1,3);comp=np.fromfile(D/'gnm-components.u32','<u4');reg=np.fromfile(D/'gnm-regions.u32','<u4');names=json.loads((D/'metadata.json').read_text())['gnm']['regions'];edges=np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]);groups={}
for key,cut in [('oral_skin',['upper_lip','lower_lip']),('nasal_skin',['nose'])]:
 keep=(comp==0)&~np.isin(reg,[names.index(n)for n in cut]);e=edges[keep[edges].all(1)];g=coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(len(v),len(v)));_,labels=connected_components(g,directed=False);ids=np.flatnonzero(keep);counts=np.bincount(labels[ids],minlength=len(v));largest=int(np.argmax(counts));parts=[ids[labels[ids]==k]for k in np.flatnonzero(counts)if k!=largest];groups[key]=sorted([int(i)for part in parts for i in part]);print(key,[len(x)for x in parts])
assert len(groups['oral_skin'])==464 and len(groups['nasal_skin'])==152
excluded=set(groups['oral_skin'])|set(groups['nasal_skin']);outer=np.array([i for i in range(len(v))if comp[i]==0 and i not in excluded],dtype=np.uint32);assert len(outer)==11850
out={'method':'Native semantic-region cut plus connected components. Largest component is exterior; detached non-labelled components are retained native cavities. Reinsert lip/nose boundary regions into outer skin.','sourceVertexCount':len(v),'outerSkin':outer.tolist(),'preservedCavities':groups,'nonSkinComponentsRemainNative':True};(D/'gnm-outer-mask.json').write_text(json.dumps(out,separators=(',',':')))
