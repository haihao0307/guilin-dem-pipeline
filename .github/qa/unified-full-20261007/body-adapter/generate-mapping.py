"""Reproducible bounded neutral binding: continuous offline neutral registration plus semantic closest triangles.
No native model downloads. Runtime uses compact barycentric correspondence and
all source influences, with direct LBS; there is no runtime optimization/Poisson.
"""
from pathlib import Path
import json,hashlib,time,argparse
import numpy as np
import scipy.sparse as ss
import trimesh
P=Path(__file__).parent;parser=argparse.ArgumentParser();parser.add_argument('--registered');parser.add_argument('--skeletal-only',action='store_true',help='Reproduce the known failed R0 initialization only');parser.add_argument('--output');args=parser.parse_args();args.registered=None if args.skeletal_only else (args.registered or str(P/'registered-mhr-r1.f32'));O=Path(args.output) if args.output else P;O.mkdir(parents=True,exist_ok=True);t=time.time();meta=json.loads((P/'input.json').read_text());b=json.loads((P/'skeleton-binding.json').read_text())
N=meta['nativeVertexCount'];J=len(meta['mhrJointNames']);V=meta['bodyVertexCount']
q=np.fromfile(P/'mhr-rest-vertices.f32','<f4').reshape(-1,3).astype(float)[:,[0,2,1]]/100;q[:,1]*=-1
x=np.fromfile(P/'canonical-body.f64','<f8').reshape(-1,3)
f=np.fromfile(P/'mhr-faces.u32','<u4').reshape(-1,3)
W=ss.coo_matrix((np.fromfile(P/'skin_weights.f32','<f4'),(np.fromfile(P/'skin_verts.u16',meta['skinArrays']['skin_verts']['dtype']),np.fromfile(P/'skin_joints.u16',meta['skinArrays']['skin_joints']['dtype']))),shape=(N,J)).tocsr()
B=np.array(b['bind']).reshape(J,4,4);S=np.array(b['sourceBind']).reshape(J,4,4);R=np.array(b['rotations']).reshape(J,4,4)[:,:3,:3];sc=np.array(b['scales']);warp=np.zeros_like(q)
for j in range(J):
 w=W[:,j].toarray().ravel();warp+=w[:,None]*(B[j,:3,3]+sc[j]*((q-S[j,:3,3])@R[j].T))
if args.registered:warp=np.fromfile(args.registered,'<f4').reshape(-1,3).astype(float)
aw=np.fromfile(P/'anny-canonical-weights.f64','<f8').reshape(V,-1)
mn=meta['mhrJointNames'];an=meta['annyBoneNames']
def mg(name):
 if name[0:2] in ['l_','r_']:
  side=name[0];tail=name[2:]
  for finger in ['thumb','index','middle','ring','pinky']:
   if tail.startswith(finger):return side+'_'+finger
  if any(k in tail for k in ['wrist','lowarm','uparm','clavicle']):return side+'_arm'
  if any(k in tail for k in ['leg','foot','talocrural','subtalar','transversetarsal','ball']):return side+'_leg'
 return 'torso'
def ag(name):
 side='l' if name.endswith('.L') else ('r' if name.endswith('.R') else '')
 if side:
  if name.startswith('finger'):return side+'_'+{'1':'thumb','2':'index','3':'middle','4':'ring','5':'pinky'}[name[6]]
  if name.startswith('metacarpal'):return side+'_arm'  # MHR index/middle/ring metacarpals belong to wrist; do not project palm to phalanges
  if any(k in name for k in ['arm','clavicle','shoulder','wrist']):return side+'_arm'
  if any(k in name for k in ['leg','foot','toe','pelvis']):return side+'_leg'
 return 'torso'
groups=sorted(set(map(mg,mn)));gw=np.column_stack([W[:,[j for j,n in enumerate(mn) if mg(n)==g]].sum(axis=1).A.ravel() for g in groups]);agw=np.column_stack([aw[:,[j for j,n in enumerate(an) if ag(n)==g]].sum(axis=1) for g in groups]);labels=np.argmax(agw,axis=1)
tri=np.zeros((V,3),int);bary=np.zeros((V,3));dist=np.zeros(V);hits=np.zeros_like(x);reports={}
for k,g in enumerate(groups):
 ids=np.where(labels==k)[0]
 if not len(ids):continue
 valid=np.max(gw[f,k],axis=1)>.05
 mesh=trimesh.Trimesh(vertices=warp,faces=f[valid],process=False)
 p,d,fi=trimesh.proximity.closest_point(mesh,x[ids]);fv=f[valid][fi];bc=trimesh.triangles.points_to_barycentric(warp[fv],p);bc=np.maximum(0,bc);bc/=bc.sum(axis=1)[:,None]
 tri[ids]=fv;bary[ids]=bc;dist[ids]=d;hits[ids]=p
 reports[g]={'vertices':len(ids),'medianMM':float(np.median(d)*1000),'p95MM':float(np.quantile(d,.95)*1000),'maxMM':float(d.max()*1000)}
np.asarray(warp,'<f4').tofile(O/'registered-mhr.f32');np.asarray(hits,'<f4').tofile(O/'mapped-source-points.f32');tri.astype('<u4').tofile(O/'map-indices.u32');bary.astype('<f4').tofile(O/'map-bary.f32');labels.astype('<u2').tofile(O/'map-regions.u16')
# All weights are retained; no four-influence truncation.
tw=sum(W[tri[:,k]].multiply(bary[:,k,None]) for k in range(3)).tocsr();tw.eliminate_zeros();np.asarray(tw.indptr,'<u4').tofile(O/'target-weight-ptr.u32');np.asarray(tw.indices,'<u2').tofile(O/'target-weight-joints.u16');np.asarray(tw.data,'<f4').tofile(O/'target-weight-values.f32')
report={'method':'semantic closest triangle after '+('continuous neutral registration' if args.registered else 'complete skeletal neutral warp'),'registeredInput':args.registered,'bodyVertices':V,'nativeVertices':N,'topologySha256':meta['topologySha256'],'coordinateConversion':'MHR cm Y-up → (x,-z,y)/100 common metre Z-up','maxCorrespondenceMM':float(dist.max()*1000),'p95CorrespondenceMM':float(np.quantile(dist,.95)*1000),'medianCorrespondenceMM':float(np.median(dist)*1000),'groups':reports,'allInfluences':{'max':int(np.diff(tw.indptr).max()),'mean':float(np.diff(tw.indptr).mean()),'nonzero':int(tw.nnz),'weightSumMaxError':float(np.max(np.abs(np.asarray(tw.sum(axis=1)).ravel()-1)))},'runtime':'direct native MHR inference and target LBS; no Poisson solve','generationSeconds':time.time()-t,'sha256':{name:hashlib.sha256((O/name).read_bytes()).hexdigest() for name in ['map-indices.u32','map-bary.f32','target-weight-ptr.u32','target-weight-joints.u16','target-weight-values.f32']}}
(O/'mapping-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
