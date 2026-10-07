"""Fixed positive cavity extension with measured native dental attachments."""
from pathlib import Path
import numpy as np,json
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import spsolve
R=Path(__file__).resolve().parent.parent;G=R/'research/geometry';D=R/'research/full-head-cases';v=np.fromfile(G/'gnm-vertices.f32','<f4').reshape(-1,3).astype(float)[:,[0,2,1]]*[1,-1,1];f=np.fromfile(G/'gnm-faces.u32','<u4').reshape(-1,3);comp=np.fromfile(G/'gnm-components.u32','<u4');oral=np.array(json.loads((G/'gnm-outer-mask.json').read_text())['preservedCavities']['oral_skin']);anchors=json.loads((R/'fixtures/oral-dental-contact-anchors.json').read_text());upper=np.setdiff1d(anchors['upper'],anchors['lower']);lower=np.setdiff1d(anchors['lower'],anchors['upper']);free=np.setdiff1d(oral,np.r_[upper,lower]);sf=f[(comp[f]==0).all(1)];edge=np.unique(np.sort(np.concatenate([sf[:,[0,1]],sf[:,[1,2]],sf[:,[2,0]]]),axis=1),axis=0);w=1/np.maximum(np.linalg.norm(v[edge[:,0]]-v[edge[:,1]],axis=1),1e-10);A=coo_matrix((np.r_[w,w],(np.r_[edge[:,0],edge[:,1]],np.r_[edge[:,1],edge[:,0]])),shape=(len(v),len(v))).tocsr();L=diags(np.asarray(A.sum(1)).ravel())-A;boundary=np.setdiff1d(np.unique(A[free].indices),free);operator=-spsolve(L[free][:,free].tocsc(),L[free][:,boundary].toarray());assert np.max(np.abs(operator.sum(1)-1))<1e-10
np.savez_compressed(R/'research/registration/oral-dental-anchor-operator.npz',upper=upper,lower=lower,free=free,boundary=boundary,weights=operator.astype('<f4'))
print({"upper":len(upper),"lower":len(lower),"free":len(free)})
