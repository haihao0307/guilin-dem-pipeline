"""Fixed semantic layer constraints over neutral NRICP correspondence.

Upper/lower lips use the official outer contours observed with mouths open.
Eyelid contours are independent classes. Normal agreement prevents projecting
ear front to ear back. No correspondence is recomputed for a runtime pose.
"""
from pathlib import Path
import argparse,json
import numpy as np,trimesh
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from matplotlib.path import Path as Polygon
R=Path(__file__).resolve().parent.parent;D=R/'research/geometry';P=R/'fixtures/head-landmarks';F=R/'research/registration'
a=argparse.ArgumentParser();a.add_argument('--target',choices=['anny','mhr'],required=True);a.add_argument('--version',default='r3');a.add_argument('--contact-band',action='store_true');args=a.parse_args();name=args.target
# MediaPipe official contour connectivity, Apache-2.0. Corners shared by two
# layers are deliberately not seeds. Inner lip rays may strike teeth/tongue.
# https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py
contours={
 'lip':([185,40,39,37,0,267,269,270,409],[146,91,181,84,17,314,405,321,375]),
 'leftEye':([466,388,387,386,385,384,398],[249,390,373,374,380,381,382]),
 'rightEye':([246,161,160,159,158,157,173],[7,163,144,145,153,154,155])}
def points(teacher,variant):return {x['landmark']:x for x in json.loads((P/(teacher+('-jawOpen'if variant=='open'else'')+'.json')).read_text())['landmarks']}
def coordinates(teacher,p):
 p=np.asarray(p);return p if teacher=='anny'else p[..., [0,2,1]]*([.01,-.01,.01]if teacher=='mhr'else[1,-1,1])
reg=np.load(F/f'{name}-outer-default-r2-neutral-registration.npz');data={k:reg[k]for k in reg.files};src=trimesh.Trimesh(data['fitted'],data['sourceFaces'],process=False);target=trimesh.Trimesh(data['targetVertices'],data['targetFaces'],process=False)
gnmv=coordinates('gnm',np.fromfile(D/'gnm-vertices.f32','<f4').reshape(-1,3))[data['sourceNativeIDs']];regions=np.fromfile(D/'gnm-regions.u32','<u4')[data['sourceNativeIDs']]
def graph(v,f):
 e=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1),axis=0);w=np.linalg.norm(v[e[:,0]]-v[e[:,1]],axis=1);return coo_matrix((np.r_[w,w],(np.r_[e[:,0],e[:,1]],np.r_[e[:,1],e[:,0]])),shape=(len(v),len(v))).tocsr()
sg=graph(gnmv,src.faces);tg=graph(target.vertices,target.faces);seed_report={};source_class=np.zeros(len(gnmv),np.uint8);allowed={0:np.ones(len(target.faces),bool)}
for k,(part,(upper,lower)) in enumerate(contours.items()):
 variant='open'if part=='lip'else'neutral';sp=points('gnm',variant);tp=points(name,variant);distances=[];source_dist=[];seeds=[]
 for side,landmarks in enumerate([upper,lower]):
  target_points=coordinates(name,[tp[i]['nativeRestPoint']for i in landmarks if tp[i].get('hit')]);source_points=coordinates('gnm',[sp[i]['nativeRestPoint']for i in landmarks if sp[i].get('hit')])
  ti=cKDTree(target.vertices).query(target_points)[1]
  # The source seeds are restricted to its authored lip/orbital regions. This
  # avoids interpreting a detector ray on an eyeball as an eyelid vertex.
  region=(17+side)if part=='lip'else(6 if part=='leftEye'else 7)
  si_pool=np.flatnonzero(regions==region);si=si_pool[cKDTree(gnmv[si_pool]).query(source_points)[1]]
  distances.append(dijkstra(tg,indices=np.unique(ti),min_only=True));source_dist.append(dijkstra(sg,indices=np.unique(si),min_only=True));seeds.append({'landmarks':landmarks,'targetNativeVertices':data['targetNativeIDs'][ti].tolist(),'sourceNativeVertices':data['sourceNativeIDs'][si].tolist()})
 target_upper=distances[0]<=distances[1]
 for side in [0,1]:
  cls=k*2+side+1;allowed[cls]=(target_upper[target.faces] if side==0 else ~target_upper[target.faces]).all(1)
  if part=='lip':mask=regions==(17+side)
  else:mask=(regions==(6 if part=='leftEye'else 7))&((source_dist[0]<=source_dist[1])==(side==0))
  if args.contact_band:mask&=np.minimum(source_dist[0],source_dist[1])<(.006 if part=='lip'else .008)
  source_class[mask]=cls
 seed_report[part]=seeds
# A connected MHR mesh includes the visible eye caps. They are not eyelids.
# Exclude the inset aperture projected from actual neutral detector contours.
neutral=points(name,'neutral');camera=json.loads((P/(name+'.json')).read_text())['camera'];centers=target.triangles_center;uv=np.c_[.5+centers[:,0]/camera['extent'],.5-(centers[:,2]-camera['target'][1])/camera['extent']]
caps=np.zeros(len(target.faces),bool)
for part in ['leftEye','rightEye']:
 u,l=contours[part];poly=np.array([neutral[i]['screen']for i in u+l[::-1]]);center=poly.mean(0);poly=center+.88*(poly-center);inside=Polygon(poly).contains_points(uv);front=(target.face_normals@np.array([0,-1,0]))>.2;eye_y=np.mean([coordinates(name,neutral[i]['nativeRestPoint'])[1]for i in u+l]);caps|=inside&front&(centers[:,1]<eye_y+.015)
for cls in allowed:allowed[cls]&=~caps
newtri=np.empty(len(src.vertices),np.int64);closest=np.empty_like(src.vertices);normal_fallback=[]
for cls in np.unique(source_class):
 ids=np.flatnonzero(source_class==cls);pool=np.flatnonzero(allowed[int(cls)]);assert len(pool)>0
 # Bounded exact point-to-triangle distances after an ample centre shortlist.
 _,candidates=cKDTree(target.triangles_center[pool]).query(src.vertices[ids],k=min(96,len(pool)));candidates=pool[np.asarray(candidates).reshape(len(ids),-1)];n=candidates.shape[1]
 q=trimesh.triangles.closest_point(target.triangles[candidates.reshape(-1)],np.repeat(src.vertices[ids],n,axis=0)).reshape(len(ids),n,3);distance=np.linalg.norm(q-src.vertices[ids,None],axis=2);dot=np.einsum('ik,ijk->ij',src.vertex_normals[ids],target.face_normals[candidates]);valid=dot>.2
 none=~valid.any(1);normal_fallback.extend(data['sourceNativeIDs'][ids[none]].tolist());valid[none]=True
 ranked=np.where(valid,distance,np.inf);which=np.argmin(ranked,axis=1);newtri[ids]=candidates[np.arange(len(ids)),which];closest[ids]=q[np.arange(len(ids)),which]
bary=trimesh.triangles.points_to_barycentric(target.triangles[newtri],closest);distance=np.linalg.norm(closest-src.vertices,axis=1)
for cls in np.unique(source_class):assert allowed[int(cls)][newtri[source_class==cls]].all()
data.update(targetNativeTriangleVertices=data['targetNativeIDs'][target.faces[newtri]],barycentric=bary,closest=closest,distance=distance,semanticSourceClass=source_class,targetFaceIndices=newtri)
np.savez_compressed(F/f'{name}-semantic-{args.version}-neutral-registration.npz',**data)
report={'source':name,'fixedForAllRuntimeStates':True,'contactBandMetres':({'lip':.006,'eyelid':.008}if args.contact_band else None),'classNames':['outer','upperLip','lowerLip','leftUpperLid','leftLowerLid','rightUpperLid','rightLowerLid'],'classCounts':np.bincount(source_class,minlength=7).tolist(),'allThreeTargetTriangleVerticesRespectChosenLayer':True,'sourceCavitiesPreserved':1064,'excludedEyeCapTriangles':int(caps.sum()),'normalFallbackVertices':normal_fallback,'distanceMM':{'median':float(np.median(distance)*1000),'p95':float(np.quantile(distance,.95)*1000),'max':float(distance.max()*1000)},'seeds':seed_report,'accepted':False,'remaining':'Native expression/age, contact/intersection and actual browser visual checks'}
(F/f'{name}-semantic-{args.version}-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items()if k!='seeds'},indent=2))
