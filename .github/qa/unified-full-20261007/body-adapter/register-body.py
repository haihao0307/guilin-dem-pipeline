"""Offline continuous neutral surface registration, with source topology fixed.
Uniform per-bone length scaling is used only by the original baseline. R1 removes
that unintended radial inflation and uses a bounded Laplacian displacement fit
against the actual target body, with anatomical region gating and collar limits.
No changes to skeleton binding or runtime skinning occur here.
"""
from pathlib import Path
import json,time,os
os.environ['MPLCONFIGDIR']='/tmp/mhr-body-mpl'
import numpy as np
import scipy.sparse as ss
from scipy.sparse.linalg import factorized
import trimesh
P=Path(__file__).parent;t=time.time();m=json.loads((P/'input.json').read_text());b=json.loads((P/'skeleton-binding.json').read_text());N=m['nativeVertexCount'];J=len(m['mhrJointNames']);V=m['bodyVertexCount'];mn=m['mhrJointNames'];an=m['annyBoneNames']
q=np.fromfile(P/'mhr-rest-vertices.f32','<f4').reshape(-1,3).astype(float)[:,[0,2,1]]/100;q[:,1]*=-1;x=np.fromfile(P/'canonical-body.f64','<f8').reshape(-1,3);f=np.fromfile(P/'mhr-faces.u32','<u4').reshape(-1,3);tf=np.fromfile(P/'canonical-faces.u32','<u4').reshape(-1,3)
W=ss.coo_matrix((np.fromfile(P/'skin_weights.f32','<f4'),(np.fromfile(P/'skin_verts.u16',m['skinArrays']['skin_verts']['dtype']),np.fromfile(P/'skin_joints.u16',m['skinArrays']['skin_joints']['dtype']))),shape=(N,J)).tocsr();aw=np.fromfile(P/'anny-canonical-weights.f64','<f8').reshape(V,-1)
B=np.array(b['bind']).reshape(J,4,4);S=np.array(b['sourceBind']).reshape(J,4,4);R=np.array(b['rotations']).reshape(J,4,4)[:,:3,:3];sc=np.array(b['scales']);base=np.zeros_like(q)
# Source joint x-axis is native longitudinal for limbs/spine. Scale that axis,
# while keeping the transverse radius initially unchanged. Hand baseline kept.
for j in range(J):
 w=W[:,j].toarray().ravel();d=q-S[j,:3,3]
 if any(k in mn[j] for k in ['spine','neck','clavicle','upleg','lowleg','uparm','lowarm']):
  axis=S[j,:3,0];d=d+(sc[j]-1)*(d@axis)[:,None]*axis
 else:d=d*sc[j]
 base+=w[:,None]*(B[j,:3,3]+d@R[j].T)
base.astype('<f4').tofile(P/'axial-registered-mhr.f32')
# Fit source torso + shoulders + proximal thighs. Keep hands, elbows, distal
# limbs and facial source geometry fixed; their existing maps were already good.
sourceCut=1.51
active=(q[:,2]>.70)&(q[:,2]<1.65)&(np.abs(q[:,0])<.43)
fit=(q[:,2]>.77)&(q[:,2]<sourceCut)&(np.abs(q[:,0])<.36)
ids=np.where(active)[0];n=len(ids);lookup=np.full(N,-1);lookup[ids]=np.arange(n)
edges=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1),axis=0)
row=[];col=[];val=[]
for a,c in edges:
 if not (active[a] or active[c]):continue
 r=len(row)//2
 row.extend([r,r]);col.extend([int(a),int(c)]);val.extend([1.,-1.])
E=ss.coo_matrix((val,(row,col)),shape=(len(row)//2,N)).tocsr();EA=E[:,ids];L=(EA.T@EA).tocsc()
# Boundary source vertices at collar have no corresponding target above its open
# top; let them fit but prohibit face/head vertices from becoming correspondence.
# Source and target use shared broad soft anatomical groups, not an argmax mask.
def sg(name):
 if name.startswith('l_') and any(v in name for v in ['clavicle','uparm','lowarm','wrist','thumb','index','middle','ring','pinky']):return 1
 if name.startswith('r_') and any(v in name for v in ['clavicle','uparm','lowarm','wrist','thumb','index','middle','ring','pinky']):return 2
 if name.startswith('l_') and any(v in name for v in ['leg','foot','ball','talocrural','subtalar','transversetarsal']):return 3
 if name.startswith('r_') and any(v in name for v in ['leg','foot','ball','talocrural','subtalar','transversetarsal']):return 4
 return 0
def tg(name):
 side=1 if name.endswith('.L') else (2 if name.endswith('.R') else 0)
 if side and any(v in name for v in ['arm','clavicle','shoulder','wrist','finger','metacarpal']):return side
 if side:return side+2
 return 0
sw=np.column_stack([W[:,[j for j,s in enumerate(mn) if sg(s)==k]].sum(axis=1).A.ravel() for k in range(5)]);tw=np.column_stack([aw[:,[j for j,s in enumerate(an) if tg(s)==k]].sum(axis=1) for k in range(5)])
meshes=[]
for k in range(5):
 valid=np.max(tw[tf,k],axis=1)>.025
 meshes.append(trimesh.Trimesh(vertices=x,faces=tf[valid],process=False))
labels=np.argmax(sw[ids],axis=1);u=np.zeros((n,3));history=[];dataWeights=fit[ids].astype(float)
reverseIds=np.where((x[:,2]>-.1)&(np.abs(x[:,0])<.36))[0];reverseLabels=np.argmax(tw[reverseIds],axis=1)
sourceFaces=[f[(np.max(sw[f,k],axis=1)>.025)&np.any(fit[f],axis=1)] for k in range(5)]
# The same smoothly varying displacement is solved on the original source mesh
# graph. No posed target result is smoothed. Each step is a single SPD solve.
for lam,steps in [(30,4),(10,4),(3,6),(1,6),(.3,8)]:
 
 for it in range(steps):
  v=base[ids]+u;hit=np.zeros_like(v);dist=np.zeros(n)
  for k,mesh in enumerate(meshes):
   ix=np.where(labels==k)[0]
   if len(ix):hit[ix],dist[ix],_=trimesh.proximity.closest_point(mesh,v[ix])
  # Symmetric surface constraints prevent source→target nearest points from
  # leaving target concavities (especially the axilla) uncovered.
  current=base.copy();current[ids]+=u;ri=[];ci=[];cv=[]
  for k,faces in enumerate(sourceFaces):
   ix=np.where(reverseLabels==k)[0]
   if not len(ix):continue
   sm=trimesh.Trimesh(vertices=current,faces=faces,process=False)
   rp,rd,rf=trimesh.proximity.closest_point(sm,x[reverseIds[ix]])
   rv=faces[rf];rb=trimesh.triangles.points_to_barycentric(current[rv],rp);rb=np.maximum(rb,0);rb/=rb.sum(1)[:,None]
   ri.extend(np.repeat(ix,3));ci.extend(rv.ravel());cv.extend(rb.ravel())
  C=ss.coo_matrix((cv,(ri,ci)),shape=(len(reverseIds),N)).tocsr();CA=C[:,ids]
  A=lam*L+ss.diags(dataWeights+.002,format='csc')+(CA.T@CA).tocsc()
  rhs=(hit-base[ids])*dataWeights[:,None]+CA.T@(x[reverseIds]-C@base)
  solve=factorized(A);candidate=np.column_stack([solve(rhs[:,k]) for k in range(3)])
  # Bounded relaxation supports topology continuity during correspondence changes.
  u=.7*candidate+.3*u
  history.append({'lambda':lam,'iteration':it,'dataP95MM':float(np.quantile(dist[dataWeights>0],.95)*1000),'dataMedianMM':float(np.median(dist[dataWeights>0])*1000),'maxDisplacementMM':float(np.linalg.norm(u,axis=1).max()*1000)})
 out=base.copy();out[ids]+=u
 print(json.dumps(history[-1]),flush=True)
out.astype('<f4').tofile(P/'registered-mhr-r1.f32');np.asarray(active,'u1').tofile(P/'registration-active.u8')
# Signed normal flips and area ratios relative to axial initial geometry.
t0=base[f];t1=out[f];n0=np.cross(t0[:,1]-t0[:,0],t0[:,2]-t0[:,0]);n1=np.cross(t1[:,1]-t1[:,0],t1[:,2]-t1[:,0]);area0=np.linalg.norm(n0,axis=1);area1=np.linalg.norm(n1,axis=1);valid=np.all(active[f],axis=1)&(area0>1e-10)
report={'activeSourceVertices':n,'sourceNativeCollarMaxMetres':sourceCut,'method':'axial skeletal rest initialization plus symmetric anatomical Laplacian displacement ICP','history':history,'sourceLocalNormalReversals':int(((n0*n1).sum(axis=1)[valid]<0).sum()),'sourceAreaRatioMin':float((area1[valid]/area0[valid]).min()),'sourceAreaRatioP01':float(np.quantile(area1[valid]/area0[valid],.01)),'seconds':time.time()-t}
(P/'registration-r1-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='history'},indent=2))
