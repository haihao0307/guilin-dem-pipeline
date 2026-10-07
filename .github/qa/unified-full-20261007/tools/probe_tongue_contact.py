"""Bounded mouth contact ablation, using signed oriented skin distance.
Does not alter runtime. Existing neutral penetration is recorded, not hidden.
"""
from pathlib import Path
import numpy as np,trimesh,json,gzip
from scipy.sparse import coo_matrix,diags
R=Path(__file__).resolve().parent.parent;D=R/'research/full-head-cases';G=R/'research/geometry';C=json.loads(gzip.decompress((R/'source/kaopu-unified-human-workbench/assets/canonical.json.gz').read_bytes()));F=np.fromfile(D/'faces.u32','<u4').reshape(-1,3);body=len(C['annyRecipes']);nc=np.fromfile(G/'gnm-components.u32','<u4');nr=np.fromfile(G/'gnm-regions.u32','<u4');oral=json.loads((G/'gnm-outer-mask.json').read_text())['preservedCavities']['oral_skin'];comp=np.full(25417,-1);reg=comp.copy();native=comp.copy()
for i,(a,b,t)in enumerate(C['gnmRecipes']):comp[body+i]=nc[a];reg[body+i]=nr[a];native[body+i]=a
ids=np.flatnonzero(comp==5);mask=(comp==0)&(np.isin(reg,[17,18])|np.isin(native,oral));skinfaces=F[mask[F].all(1)];tf=F[(comp[F]==5).all(1)];local=np.full(25417,-1);local[ids]=np.arange(len(ids));tf=local[tf];edges=np.unique(np.sort(np.concatenate([tf[:,[0,1]],tf[:,[1,2]],tf[:,[2,0]]]),axis=1),axis=0);adj=coo_matrix((np.ones(len(edges)*2),(np.r_[edges[:,0],edges[:,1]],np.r_[edges[:,1],edges[:,0]])),shape=(len(ids),len(ids))).tocsr();adj=diags(1/np.asarray(adj.sum(1)).ravel())@adj
base=np.fromfile(D/'gnm-neutral.f32','<f4').reshape(-1,3).astype(float);mesh=trimesh.Trimesh(base,skinfaces,process=False);q,dist,tri=trimesh.proximity.closest_point(mesh,base[ids]);sd=np.einsum('ij,ij->i',base[ids]-q,mesh.face_normals[tri]);allow=np.minimum(sd,0);print({'neutralSignedMM':np.quantile(sd,[0,.1,.5,.9,1]).tolist(),'nativeTongueVertices':len(ids)},flush=True)
rows=[]
for name in ['anny-jaw','anny-tongue']:
 v=np.fromfile(D/(name+'.f32'),'<f4').reshape(-1,3).astype(float);mesh=trimesh.Trimesh(v,skinfaces,process=False);original=v[ids].copy();delta=np.zeros_like(original)
 for iteration in range(12):
  if iteration:delta=.5*delta+.5*(adj@delta)
  p=original+delta;q,dist,tri=trimesh.proximity.closest_point(mesh,p);n=mesh.face_normals[tri];sd=np.einsum('ij,ij->i',p-q,n);violation=np.minimum(sd-allow,0);active=(dist<.010)&(violation<-.00005);delta[active]+=(-violation[active]+.0001)[:,None]*n[active]
 out=v.copy();out[ids]=original+delta;out.astype('<f4').tofile(D/(name+'-contact-probe.f32'));row={'name':name,'maxCorrectionMM':float(np.linalg.norm(delta,axis=1).max()*1000),'p95CorrectionMM':float(np.quantile(np.linalg.norm(delta,axis=1),.95)*1000),'affected':int((np.linalg.norm(delta,axis=1)>1e-8).sum()),'remainingViolatingVertices':int(active.sum()),'notRuntime':True};rows.append(row);print(row,flush=True)
(R/'research/tongue-contact-ablation.json').write_text(json.dumps(rows,indent=2))
