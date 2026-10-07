"""Ablate cavity transport using actual GNM neutral dental contacts as attachments.
Anchors are source geometry contacts, not guessed spatial thresholds. Two
vertices touching both arches remain unanchored. Runtime is unchanged.
"""
from pathlib import Path
import numpy as np,json,gzip
from scipy.sparse import coo_matrix,diags
from scipy.sparse.linalg import spsolve
R=Path(__file__).resolve().parent.parent;G=R/'research/geometry';D=R/'research/full-head-cases';v=np.fromfile(G/'gnm-vertices.f32','<f4').reshape(-1,3).astype(float)[:,[0,2,1]]*[1,-1,1];f=np.fromfile(G/'gnm-faces.u32','<u4').reshape(-1,3);comp=np.fromfile(G/'gnm-components.u32','<u4');oral=np.array(json.loads((G/'gnm-outer-mask.json').read_text())['preservedCavities']['oral_skin']);anchors=json.loads((R/'research/oral-dental-contact-anchors.json').read_text());upper=np.setdiff1d(anchors['3'],anchors['4']);lower=np.setdiff1d(anchors['4'],anchors['3']);free=np.setdiff1d(oral,np.r_[upper,lower]);sf=f[(comp[f]==0).all(1)];edge=np.unique(np.sort(np.concatenate([sf[:,[0,1]],sf[:,[1,2]],sf[:,[2,0]]]),axis=1),axis=0);w=1/np.maximum(np.linalg.norm(v[edge[:,0]]-v[edge[:,1]],axis=1),1e-10);A=coo_matrix((np.r_[w,w],(np.r_[edge[:,0],edge[:,1]],np.r_[edge[:,1],edge[:,0]])),shape=(len(v),len(v))).tocsr();L=diags(np.asarray(A.sum(1)).ravel())-A;boundary=np.setdiff1d(np.unique(A[free].indices),free);operator=-spsolve(L[free][:,free].tocsc(),L[free][:,boundary].toarray());assert np.max(np.abs(operator.sum(1)-1))<1e-10
np.savez_compressed(R/'research/registration/oral-dental-anchor-operator.npz',upper=upper,lower=lower,free=free,boundary=boundary,weights=operator.astype('<f4'))
C=json.loads(gzip.decompress((R/'source/kaopu-unified-human-workbench/assets/canonical.json.gz').read_bytes()));body=len(C['annyRecipes']);toCommon={a:i+body for i,(a,b,t)in enumerate(C['gnmRecipes'])if t==0};ci=lambda a:np.array([toCommon[int(x)]for x in a]);base=np.fromfile(D/'gnm-neutral.f32','<f4').reshape(-1,3).astype(float);teeth=ci(np.flatnonzero(comp==4));rows=[]
for name in ['anny-jaw','anny-tongue','mhr-jaw']:
 out=np.fromfile(D/(name+'.f32'),'<f4').reshape(-1,3).astype(float);a=base[teeth];b=out[teeth];ca=a.mean(0);cb=b.mean(0);u,_,vt=np.linalg.svd((a-ca).T@(b-cb));rot=vt.T@u.T;t=cb-rot@ca
 before=out.copy();out[ci(upper)]=base[ci(upper)];out[ci(lower)]=base[ci(lower)]@rot.T+t;d=out[ci(boundary)]-base[ci(boundary)];out[ci(free)]=base[ci(free)]+operator@d;out.astype('<f4').tofile(D/(name+'-dental-anchor-probe.f32'));row={'name':name,'sourceUpperAnchors':len(upper),'sourceLowerAnchors':len(lower),'free':len(free),'maxMovedMM':float(np.linalg.norm(out-before,axis=1).max()*1000)};rows.append(row);print(row,flush=True)
(R/'research/oral-dental-anchor-ablation.json').write_text(json.dumps(rows,indent=2))
