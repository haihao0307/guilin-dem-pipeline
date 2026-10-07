"""Component-aware neutral-head correspondence, using Trimesh's Sumner2004 NRICP.
The landmark pairs are ray intersections on REAL teacher geometry. No calibrated
FaceCorrespondence.reference point cloud is substituted for native geometry.
"""
from pathlib import Path
import argparse,json,time,hashlib
import numpy as np,trimesh
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from trimesh.registration import nricp_sumner,procrustes
R=Path(__file__).resolve().parent.parent;D=R/'research/geometry';P=R/'fixtures/neutral-landmarks';out=R/'research/registration';out.mkdir(parents=True,exist_ok=True)
a=argparse.ArgumentParser();a.add_argument('--target',choices=['anny','mhr'],default='anny');a.add_argument('--preset',choices=['smooth','default'],default='default');a.add_argument('--landmarks-dir',default=str(P));a.add_argument('--surface',choices=['all-skin','outer'],default='outer');a.add_argument('--tag',default='');a.add_argument('--articulated-landmarks',default=None);args=a.parse_args();name=args.target;P=Path(args.landmarks_dir)

def native(n):
 v=np.fromfile(D/f'{n}-vertices.f32',dtype='<f4').reshape(-1,3).astype(float);f=np.fromfile(D/f'{n}-faces.u32',dtype='<u4').reshape(-1,3)
 if n=='gnm':v=v[:,[0,2,1]]*np.array([1,-1,1])
 if n=='mhr':v=v[:,[0,2,1]]*np.array([.01,-.01,.01])
 return v,f

def point(n,p):
 p=np.asarray(p);return p if n=='anny'else p[[0,2,1]]*([.01,-.01,.01]if n=='mhr'else[1,-1,1])
def submesh(v,f,mask):
 ids=np.flatnonzero(mask);oldnew=np.full(len(v),-1);oldnew[ids]=np.arange(len(ids));fi=np.flatnonzero(mask[f].all(1));return trimesh.Trimesh(v[ids],oldnew[f[fi]],process=False),ids,fi
sv,sf=native('gnm');comp=np.fromfile(D/'gnm-components.u32',dtype='<u4');source_mask=comp==0
if args.surface=='outer':
 outer=json.loads((D/'gnm-outer-mask.json').read_text())['outerSkin'];source_mask=np.zeros(len(sv),bool);source_mask[outer]=True
source,source_ids,source_fids=submesh(sv,sf,source_mask)
tv,tf=native(name);edges=np.concatenate([tf[:,[0,1]],tf[:,[1,2]],tf[:,[2,0]]]);graph=coo_matrix((np.ones(len(edges)),(edges[:,0],edges[:,1])),shape=(len(tv),len(tv)));_,labels=connected_components(graph,directed=False);main=int(np.argmax(np.bincount(labels)));target_mask=(labels==main)&(tv[:,2]>(.44 if name=='anny'else 1.30));target,target_ids,target_fids=submesh(tv,tf,target_mask)
source_face_lookup={int(x):i for i,x in enumerate(source_fids)};target_face_set=set(map(int,target_fids));sp={x['landmark']:x for x in json.loads((P/'gnm.json').read_text())['landmarks']};tp={x['landmark']:x for x in json.loads((P/(name+'.json')).read_text())['landmarks']};pairs=[]
if args.articulated_landmarks:
 # Only the official outer lip contours: inner lip detector rays can hit teeth.
 lip_ids={185,40,39,37,0,267,269,270,409,146,91,181,84,17,314,405,321,375}
 ap=Path(args.articulated_landmarks)
 for teacher,points in [('gnm',sp),(name,tp)]:
  posed=json.loads((ap/(teacher+'-jawOpen.json')).read_text())
  for row in posed['landmarks']:
   if row['landmark'] in lip_ids and row.get('hit'):
    row={**row,'nativePoint':row['nativeRestPoint']};points[row['landmark']]=row
for key,x in sp.items():
 y=tp.get(key)
 if not y or not x.get('hit')or not y.get('hit'):continue
 if x['face']not in source_face_lookup or y['face']not in target_face_set:continue
 pairs.append((key,x,y))
assert len(pairs)>300,len(pairs)
landmark_faces=np.array([source_face_lookup[x['face']]for _,x,_ in pairs]);bary=np.array([x['barycentric']for _,x,_ in pairs]);from_points=np.array([point('gnm',x['nativePoint'])for _,x,_ in pairs]);to_points=np.array([point(name,y['nativePoint'])for _,_,y in pairs]);M,_,initial_cost=procrustes(from_points,to_points,reflection=False,scale=True);assert np.linalg.det(M[:3,:3])>0;source.apply_transform(M);initial=source.vertices.copy();initial_landmarks=(source.vertices[source.faces[landmark_faces]]*bary[:,:,None]).sum(1)
# Published solver, bounded four stages. This is a candidate, not a semantic pass.
steps=[[1,.001,2,50,0],[1,.001,1,50,0],[10,.001,1,20,0],[30,.001,1,10,0]]if args.preset=='smooth'else[[1,.001,1,1000,0],[1,.001,1,1000,0],[10,.001,1,1000,0],[100,.001,1,1000,0]]
print(json.dumps({'target':name,'sourceVertices':len(source.vertices),'sourceFaces':len(source.faces),'targetVertices':len(target.vertices),'landmarks':len(pairs),'initialLandmarkMaxMM':float(np.linalg.norm(initial_landmarks-to_points,axis=1).max()*1000)}),flush=True)
started=time.time();records=nricp_sumner(source,target,source_landmarks=(landmark_faces,bary),target_positions=to_points,steps=steps,distance_threshold=.08,return_records=True,use_faces=True,use_vertex_normals=True,face_pairs_type='vertex');fitted=np.asarray(records[-1]);assert np.isfinite(fitted).all();registered=trimesh.Trimesh(fitted,source.faces,process=False);closest,distance,tri=trimesh.proximity.closest_point(target,fitted);weights=trimesh.triangles.points_to_barycentric(target.vertices[target.faces[tri]],closest);lm=(fitted[source.faces[landmark_faces]]*bary[:,:,None]).sum(1);error=np.linalg.norm(lm-to_points,axis=1)*1000;ratio=registered.area_faces/source.area_faces;dot=np.einsum('ij,ij->i',registered.face_normals,source.face_normals)
np.savez_compressed(out/(name+'-'+args.surface+'-'+args.preset+args.tag+'-neutral-registration.npz'),sourceNativeIDs=source_ids,sourceFaces=source.faces,sourceNativeFaceIDs=source_fids,initial=initial,fitted=fitted,targetNativeIDs=target_ids,targetFaces=target.faces,targetVertices=target.vertices,sourceToTargetMatrix=M,targetNativeTriangleVertices=target_ids[target.faces[tri]],barycentric=weights,closest=closest,distance=distance,landmarkIDs=np.array([k for k,_,_ in pairs]),landmarkSourceFaces=landmark_faces,landmarkSourceBarycentric=bary,landmarkTarget=to_points,records=np.asarray(records))
report={'target':name,'algorithm':'trimesh5.1.1 nricp_sumner, Sumner/Popovic2004 correspondence','source':'GNM '+args.surface+'; preserved cavities are not forced to match the teacher surface','targetMask':'largest connected component above a recorded head/neck cut; eye/tongue components excluded when disconnected','landmarkKind':'actual surface-ray triangle barycentrics on both teachers','landmarks':len(pairs),'landmarkMM':{'median':float(np.median(error)),'p95':float(np.quantile(error,.95)),'max':float(error.max())},'closestSurfaceMM':{'median':float(np.median(distance)*1000),'p95':float(np.quantile(distance,.95)*1000),'max':float(distance.max()*1000)},'areaRatio':{'min':float(ratio.min()),'p01':float(np.quantile(ratio,.01)),'max':float(ratio.max())},'faceNormalsOppositeInitial':int((dot<0).sum()),'sourceToTargetMatrix':M.tolist(),'steps':steps,'elapsedSeconds':time.time()-started,'semanticQualityPassed':False,'reason':'Candidate correspondence requires eye/lip/ear visual and topology review; proximity alone does not certify correctness'};(out/(name+'-'+args.surface+'-'+args.preset+args.tag+'-neutral-registration.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True)
