"""Repaint the canonical character using registered FULL scan colour/detail.
Runtime geometry is never emitted/replaced. Maps are photographic derivatives
of Lee Perry-Smith, not Digital Emily or generated portrait planes.
"""
from pathlib import Path
import json,struct,hashlib,math,sys
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree
from scipy.ndimage import distance_transform_edt,gaussian_filter,map_coordinates

W=H=4096
CY_SOURCE=-.024
CY_TARGET=.046
YMIN,YMAX=.568,.860
# Front gets 74% of the horizontal atlas, preserving donor facial texel density.
THETA=1.18

def angle_u(t):
 a=np.abs(t);v=np.where(a<=THETA,.37*a/THETA,.37+.13*(a-THETA)/(np.pi-THETA));return .5+np.sign(t)*v

def du_dt(t):return np.where(np.abs(t)<=THETA,.37/THETA,.13/(np.pi-THETA))

def glb(file):
 b=file.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);raw=b[28+n:]
 def a(i):
  x=d['accessors'][i];v=d['bufferViews'][x['bufferView']];dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[x['type']];dt=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2'}[x['componentType']]);return np.ndarray((x['count'],dim),dtype=dt,buffer=raw,offset=v.get('byteOffset',0)+x.get('byteOffset',0),strides=(v.get('byteStride',dim*dt.itemsize),dt.itemsize)).copy()
 q=d['meshes'][0]['primitives'][0];return a(q['attributes']['POSITION'])*.04,a(q['attributes']['NORMAL']),a(q['attributes']['TEXCOORD_0']),a(q['indices']).reshape(-1,3)

def point(p,n,x,y,side=False):
 mask=(p[:,2]>.015 if p[:,1].max()<.3 else p[:,2]>.058)&(n[:,2]>-.1)
 d=(p[:,0]-x)**2+(p[:,1]-y)**2;d[~mask]=100
 ids=np.argsort(d)[:6];w=1/np.maximum(d[ids],1e-8);z=float(np.sum(p[ids,2]*w)/w.sum());return np.array([x,y,z])

def control_points(sp,sn,tp,tn):
 # Manually reviewed anatomic correspondences in metres, tied to the source
 # neutral mesh. These are texture locations, never targets for shape editing.
 rows=[]
 def add(tx,ty,sx,sy,name):rows.append((point(sp,sn,sx,sy),point(tp,tn,tx,ty),name))
 for tx,ty,sx,sy,name in [(0,.850,-.003,.157,'crown'),(0,.811,-.003,.127,'upper-forehead'),(0,.778,-.001,.100,'forehead'),(0,.760,0,.081,'glabella'),(0,.737,0,.064,'bridge'),(0,.713,-.001,.044,'nose-tip'),(0,.701,-.003,.031,'columella'),(0,.690,-.003,.028,'philtrum'),(0,.680,-.004,.023,'cupid-dip'),(0,.6766,-.003,.0185,'lip-seam'),(0,.6688,-.003,.0115,'lower-lip-edge'),(0,.658,-.003,.001,'chin-groove'),(0,.642,-.002,-.023,'chin'),(0,.620,0,-.037,'upper-neck'),(0,.592,0,-.063,'lower-neck')]:add(tx,ty,sx,sy,name)
 for sign in [-1,1]:
  for tx,ty,sx,sy,name in [(.055,.817,.043,.128,'forehead-edge'),(.069,.781,.060,.105,'temple-high'),(.060,.763,.060,.079,'temple'),(.014,.763,.014,.079,'brow-inner'),(.031,.767,.030,.082,'brow-arch'),(.047,.760,.047,.078,'brow-tail'),(.019,.745,.018,.066,'eye-inner'),(.048,.746,.048,.066,'eye-outer'),(.032,.751,.032,.0698,'upper-eyelid'),(.032,.741,.032,.064,'lower-eyelid'),(.034,.729,.032,.057,'under-eye'),(.060,.718,.056,.044,'cheekbone'),(.050,.704,.046,.030,'mid-cheek'),(.062,.682,.051,.007,'lower-cheek'),(.016,.706,.016,.034,'nostril-wing'),(.010,.705,.010,.032,'nostril'),(.0058,.6822,.007,.025,'cupid-peak'),(.013,.680,.014,.023,'upper-lip'),(.0245,.676,.026,.0175,'mouth-corner'),(.016,.671,.017,.013,'lower-lip'),(.038,.662,.033,-.010,'jaw-front'),(.044,.645,.038,-.030,'jaw-angle'),(.045,.619,.039,-.039,'neck-side'),(.083,.736,.079,.066,'ear-top'),(.086,.713,.083,.047,'ear-middle'),(.078,.691,.071,.030,'ear-lobe')]:add(sign*tx,ty,sign*sx-(.002 if 'lip' in name or 'mouth' in name or 'cupid' in name else 0),sy,name+str(sign))
 def chart(p,zc):return np.column_stack([np.arctan2(p[:,0],p[:,2]-zc),p[:,1]])
 s=np.array([r[0] for r in rows]);t=np.array([r[1] for r in rows]);a=chart(s,CY_SOURCE);b=chart(t,CY_TARGET)
 # Neutral side/back constraints keep the map monotone away from face anchors.
 for theta in [-np.pi,-2.6,-2.1,-1.65,1.65,2.1,2.6,np.pi]:
  for sy,ty in [(-.07,.584),(-.035,.626),(0,.654),(.04,.710),(.08,.755),(.12,.809),(.155,.850)]:a=np.vstack([a,[theta,sy]]);b=np.vstack([b,[theta,ty]])
 return a,b,[{'name':r[2],'source':r[0].tolist(),'target':r[1].tolist()} for r in rows]

def image(p):return np.asarray(Image.open(p).convert('RGB'),np.float32)/255

def save_rgb(p,a):Image.fromarray(np.uint8(np.clip(a,0,1)*255+.5)).save(p,quality=97,subsampling=0) if p.suffix=='.jpg' else Image.fromarray(np.uint8(np.clip(a,0,1)*255+.5)).save(p,compress_level=2)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def build(scanroot,snapshot,out):
 out=Path(out);out.mkdir(parents=True,exist_ok=True);scanroot=Path(scanroot);ref=Path(snapshot);d=json.loads((ref/'mapping.json').read_text()) if ref.is_dir() else json.loads(ref.read_text());tp=np.fromfile(ref/'rest.f32',dtype='<f4').reshape(-1,3) if ref.is_dir() else np.array(d['positions']).reshape(-1,3);tn=np.fromfile(ref/'rest-normal.f32',dtype='<f4').reshape(-1,3) if ref.is_dir() else np.array(d['normals']).reshape(-1,3);sp,sn,uv,f=glb(scanroot/'r01/assets/head.glb')
 a,b,anchors=control_points(sp,sn,tp,tn);scale=np.array([1.,8.]);warp=RBFInterpolator(a*scale,b*scale,kernel='thin_plate_spline',smoothing=1e-6)
 theta=np.arctan2(sp[:,0],sp[:,2]-CY_SOURCE);st=np.column_stack([theta,sp[:,1]]);mapped=warp(st*scale)/scale;rawQ=np.column_stack([angle_u(mapped[:,0]),(YMAX-mapped[:,1])/(YMAX-YMIN)])
 # Raster into the target chart while retaining donor UV, tangent axes and metric
 # Jacobian. Hidden/colliding texels select the outer scan surface.
 UV=np.zeros((H,W,2),np.float32);rad=np.full((H,W),-1e6,np.float32);valid=np.zeros((H,W),bool);tid=np.full((H,W),-1,np.int32)
 TA=np.zeros((len(f),3),np.float32);BA=np.zeros_like(TA);J=np.zeros((len(f),2,2),np.float32)
 # Original UV derivatives expressed along *source geometry*; map them through
 # the target chart Jacobian. No donor head curvature is added to target mesh.
 for fi,ids in enumerate(f):
  p=sp[ids];tex=uv[ids];triQ=rawQ[ids].copy()
  if np.ptp(theta[ids])>np.pi:continue
  if np.ptp(triQ[:,0])>.48:continue
  d1=p[1]-p[0];d2=p[2]-p[0];dt=np.array([tex[1]-tex[0],tex[2]-tex[0]]);den=np.linalg.det(dt)
  if abs(den)<1e-12:continue
  tb=np.linalg.solve(dt,np.array([d1,d2]));T=tb[0];B=tb[1];T/=max(np.linalg.norm(T),1e-12);B/=max(np.linalg.norm(B),1e-12);TA[fi]=T;BA[fi]=B
  # Source UV coordinates as affine function of target UV. Stored dH derivatives
  # can use these with physical texel spacing inherited from donor scan.
  targetUV=triQ.copy();targetUV[:,1]=1-targetUV[:,1];dq=np.array([targetUV[1]-targetUV[0],targetUV[2]-targetUV[0]])
  try:
   dp=np.linalg.solve(dq,np.array([d1,d2]));J[fi]=np.array([[np.dot(dp[0],T),np.dot(dp[0],B)],[np.dot(dp[1],T),np.dot(dp[1],B)]])
  except np.linalg.LinAlgError:continue
  v=triQ*np.array([W-1,H-1]);mn=np.maximum(0,np.floor(v.min(0)).astype(int));mx=np.minimum([W-1,H-1],np.ceil(v.max(0)).astype(int))
  if (mn>mx).any():continue
  xx,yy=np.meshgrid(np.arange(mn[0],mx[0]+1,dtype=np.float32),np.arange(mn[1],mx[1]+1,dtype=np.float32));v0,v1,v2=v;det=(v1[1]-v2[1])*(v0[0]-v2[0])+(v2[0]-v1[0])*(v0[1]-v2[1])
  if abs(det)<1e-8:continue
  w0=((v1[1]-v2[1])*(xx-v2[0])+(v2[0]-v1[0])*(yy-v2[1]))/det;w1=((v2[1]-v0[1])*(xx-v2[0])+(v0[0]-v2[0])*(yy-v2[1]))/det;w2=1-w0-w1
  radii=np.sqrt(p[:,0]**2+(p[:,2]-CY_SOURCE)**2);R=w0*radii[0]+w1*radii[1]+w2*radii[2];sl=np.s_[mn[1]:mx[1]+1,mn[0]:mx[0]+1];m=(w0>=-1e-6)&(w1>=-1e-6)&(w2>=-1e-6)&(R>rad[sl]);val=w0[...,None]*tex[0]+w1[...,None]*tex[1]+w2[...,None]*tex[2];UV[sl][m]=val[m];rad[sl][m]=R[m];valid[sl]|=m;tid[sl][m]=fi
 print('Raster coverage',valid.mean(),flush=True)
 import resource;print('mem before padding',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,flush=True)
 del xx,yy,w0,w1,w2,R,m,val
 nearest=distance_transform_edt(~valid,return_distances=False,return_indices=True);UV=UV[tuple(nearest)];tid=tid[tuple(nearest)];del nearest,rad
 print("padded",resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,flush=True)
 # Sample and transfer tangent derivatives in bounded strips (4GB runner).
 textures={key:image(scanroot/file) for key,file in {'color':'r01/assets/hires/albedo-4k.jpg','spec':'r01/assets/specular.jpg','base':'r01/assets/normal.jpg','meso':'r02/assets/meso.webp','micro':'r02/assets/micro.webp'}.items()}
 rgbOut=np.empty((H,W,3),np.uint8);gradientOut=np.empty((H,W,4),np.uint8);materialOut=np.empty((H,W,3),np.uint8);clips=0;total=0
 for y0 in range(0,H,128):
  y1=min(H,y0+128);coords=np.stack([1-UV[y0:y1,:,1],UV[y0:y1,:,0]],0)
  def sample(key):
   im=textures[key];scaled=coords*np.array([im.shape[0]-1,im.shape[1]-1],np.float32)[:,None,None];return np.stack([map_coordinates(im[...,c],scaled,order=1,mode='nearest') for c in range(im.shape[-1])],-1)
  color=sample('color');spec=sample('spec')[...,0];base=sample('base')*2-1;meso=sample('meso')*2-1;micro=sample('micro')*2-1;maps=[];ix=tid[y0:y1]
  for nn in [base[...,:2]/np.maximum(base[...,2:],.35)*.45+meso[...,:2]/np.maximum(meso[...,2:],.35)*.78,micro[...,:2]/np.maximum(micro[...,2:],.35)*1.05]:
   g=np.empty((y1-y0,W,2),np.float32)
   for row in range(2):g[...,row]=-(J[ix,row,0]*nn[...,0]+J[ix,row,1]*nn[...,1])
   maps.append(g)
  gradients=np.concatenate(maps,-1);clips+=int((np.abs(gradients)>.16).sum());total+=gradients.size
  yy=YMAX-np.arange(y0,y1)[:,None]/(H-1)*(YMAX-YMIN);u=np.arange(W)[None,:]/(W-1);central=np.exp(-((u-.5)/.105)**8)*np.exp(-((yy-.677)/.014)**8)
  red=np.clip((color[...,0]-color[...,1]-.115)/.135,0,1);sat=np.clip((color[...,0]-color[...,2]-.13)/.15,0,1);lip=central*red*sat;rough=np.clip(.54+(.45-spec)*.24-lip*.12,.26,.78)
  material=np.stack([rough,lip,valid[y0:y1].astype(float)],-1)
  rgbOut[y0:y1]=np.uint8(np.clip(color,0,1)*255+.5);gradientOut[y0:y1]=np.uint8(np.clip(gradients/.32+.5,0,1)*255+.5);materialOut[y0:y1]=np.uint8(np.clip(material,0,1)*255+.5)
  if y0%512==0:print('Sampling',y0,flush=True)
 clipFraction=clips/total
 Image.fromarray(rgbOut).save(out/'head-albedo-4k.jpg',quality=97,subsampling=0);Image.fromarray(gradientOut).save(out/'head-gradients-4k.png',compress_level=2);Image.fromarray(materialOut).save(out/'head-material-4k.png',compress_level=2)
 # Store exact mapping only, never geometry. The shader evaluates atlas coords
 # from the canonical rest-position attribute already owned by R01/R02.
 manifest={'schema':'kaopu/registered-skin-paint@1','sourcePageCommit':'a08f7fff098dad3a18fb655418660ddaae4ecb35','sourceAssetCommit':'03aaa73a98987fbaa03857b71483045e73e5acd9','sourceIdentity':'Lee Perry-Smith / Infinite-Realities','sourceIsDigitalEmily':False,'topologySha256':(d.get('topologySha256') or d['canonical']['topologySha256']),'targetVertices':len(tp),'targetFaces':(d['triangles'] if 'triangles' in d else len(d['faces'])//3),'atlas':{'width':W,'height':H,'frontAllocatedFraction':.74,'centerZ':CY_TARGET,'yMin':YMIN,'yMax':YMAX,'frontAngle':THETA,'gradientRange':.16,'gradientClippedFraction':clipFraction},'mapping':'Reviewed anatomic correspondences, thin-plate registration in cylindrical surface chart, donor-UV barycentric baking','anchors':anchors,'nativeDonorResolution':[4096,4096],'fullDonorAtlasUsed':True,'bodyMacroPainting':'generated separately from the canonical body, not claimed to be scanned full-body reference','geometryChanged':False,'photographicPrecisionAchieved':'requires visual acceptance, raster dimensions alone are not proof','sourceHashes':{str(p.relative_to(scanroot)):sha(p) for p in [scanroot/'r01/assets/head.glb',scanroot/'r01/assets/hires/albedo-4k.jpg',scanroot/'r01/assets/normal.jpg',scanroot/'r01/assets/specular.jpg',scanroot/'r02/assets/meso.webp',scanroot/'r02/assets/micro.webp']},'files':{p.name:{'sha256':sha(p),'bytes':p.stat().st_size} for p in [out/'head-albedo-4k.jpg',out/'head-gradients-4k.png',out/'head-material-4k.png']}}
 (out/'paint-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));Image.fromarray(rgbOut).resize((1024,1024)).save(out/'atlas-review.jpg');print('Done',clipFraction,flush=True)
if __name__=='__main__':build(*sys.argv[1:])
