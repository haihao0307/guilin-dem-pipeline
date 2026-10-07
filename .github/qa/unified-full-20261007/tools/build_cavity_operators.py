"""Rebuild positive graph-Laplacian cavity extension from immutable GNM geometry.
The output contains no learned weights and does not require a teacher expression
projection. Arrays match the earlier candidate's independent operator stage.
"""
from pathlib import Path
import json,numpy as np
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import spsolve
R=Path(__file__).resolve().parent.parent;D=R/'research/geometry';O=R/'research/head-channels/semantic-r3';O.mkdir(parents=True,exist_ok=True)
v=np.fromfile(D/'gnm-vertices.f32','<f4').reshape(-1,3).astype(float)[:,[0,2,1]]*[1,-1,1];f=np.fromfile(D/'gnm-faces.u32','<u4').reshape(-1,3);comp=np.fromfile(D/'gnm-components.u32','<u4');region=np.fromfile(D/'gnm-regions.u32','<u4');mask=json.loads((D/'gnm-outer-mask.json').read_text());outer=np.array(mask['outerSkin']);sf=f[(comp[f]==0).all(1)];edges=np.unique(np.sort(np.concatenate([sf[:,[0,1]],sf[:,[1,2]],sf[:,[2,0]]]),axis=1),axis=0);weights=1/np.maximum(np.linalg.norm(v[edges[:,0]]-v[edges[:,1]],axis=1),1e-10);A=coo_matrix((np.r_[weights,weights],(np.r_[edges[:,0],edges[:,1]],np.r_[edges[:,1],edges[:,0]])),shape=(len(v),len(v))).tocsr();L=diags(np.asarray(A.sum(1)).ravel())-A
operators=[]
for name,ids in mask['preservedCavities'].items():
 ids=np.array(ids);boundary=np.setdiff1d(np.unique(A[ids].indices),ids);operator=-spsolve(L[ids][:,ids].tocsc(),L[ids][:,boundary].toarray());assert np.max(np.abs(operator.sum(1)-1))<1e-10;operators.append((name,ids,boundary,operator));np.savez_compressed(O/(name+'-extension.npz'),ids=ids,boundary=boundary,weights=operator.astype('<f4'))
print({"operators":len(operators),"vertices":sum(len(x[1]) for x in operators)})
