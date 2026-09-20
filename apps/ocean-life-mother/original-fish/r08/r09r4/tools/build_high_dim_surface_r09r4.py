from __future__ import annotations
import argparse, json, math, struct, hashlib, collections
from pathlib import Path
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.spatial import Delaunay, cKDTree
from scipy.ndimage import gaussian_filter
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import unary_union
import trimesh

ap=argparse.ArgumentParser(description='Build Tuna R09R4 high-dimensional grey-shape candidate from exact FISH-REF-002 GLB')
ap.add_argument('source',type=Path)
ap.add_argument('--out',type=Path,required=True)
a=ap.parse_args()
SRC=a.source
OUT=a.out
OUT.mkdir(parents=True,exist_ok=True)
raw=SRC.read_bytes();sha=hashlib.sha256(raw).hexdigest()
scene=trimesh.load(SRC,force='scene',process=False)
T,name=scene.graph['Object_10'];source=scene.geometry[name].copy();source.apply_transform(T)
base=scene.geometry[name];uv=np.asarray(base.visual.uv,float);verts=np.asarray(source.vertices,float);faces=np.asarray(source.faces,int)
L=float(source.bounds[1,1]-source.bounds[0,1])
face_components=[np.array(list(c),int) for c in trimesh.graph.connected_components(source.face_adjacency,nodes=np.arange(len(faces)),min_len=1)]

DT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32};NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
o=12;g=None;binv=None
while o+8<=len(raw):
 n,t=struct.unpack_from('<II',raw,o);s=o+8;e=s+n
 if t==0x4E4F534A:g=json.loads(raw[s:e].decode().rstrip('\x00 \t\r\n'))
 elif t==0x004E4942:binv=memoryview(raw)[s:e]
 o=e
def acc(i):
 a=g['accessors'][i];bv=g['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]).newbyteorder('<');c=NC[a['type']];off=bv.get('byteOffset',0)+a.get('byteOffset',0);stride=bv.get('byteStride',dt.itemsize*c);out=np.empty((a['count'],c),dt)
 for k in range(a['count']):out[k]=np.frombuffer(binv,dt,c,off+k*stride)
 if a.get('normalized'):
  info=np.iinfo(dt);out=out.astype(float)/(info.max if info.min==0 else info.max);out=np.maximum(out,-1)
 return out
prim=g['meshes'][0]['primitives'][0];J=acc(prim['attributes']['JOINTS_0']).astype(int);W=acc(prim['attributes']['WEIGHTS_0']).astype(float);W/=np.maximum(W.sum(1,keepdims=True),1e-12);skin=g['skins'][0];names=[g['nodes'][n].get('name',f'node_{n}') for n in skin['joints']]
def group(n):
 if n in {'_rootJoint','Hips_01'}:return'root'
 if n.startswith('Spine')or n=='Head_05':return'axial'
 if 'UpperJaw'in n:return'upper_jaw'
 if 'LoweJaw'in n:return'lower_jaw'
 if n.startswith('Eye.'):return'eye'
 if n.startswith('Side.')and'Fin'not in n:return'operculum_candidate'
 if n.startswith('SideFin'):return'pectoral_fin'
 if n.startswith('LowerFin')and'Back'not in n:return'pelvic_fin'
 if n.startswith('UpperFin'):return'dorsal_fin'
 if n.startswith('LowerBackFin'):return'anal_fin'
 if n.startswith('UpperTail'):return'caudal_upper'
 if n.startswith('LowerTail'):return'caudal_lower'
 return'unclassified'
dom=np.take_along_axis(J,np.argmax(W,axis=1)[:,None],axis=1)[:,0];vg=np.array([group(names[i]) for i in dom])

body_groups={'axial','root','upper_jaw','lower_jaw','operculum_candidate','eye'}
core_mask=np.array([sum(vg[v] in body_groups for v in f)>=2 for f in faces]);core_faces=faces[core_mask];tri=verts[core_faces];core_vertices=np.unique(core_faces)
ymin=float(verts[core_vertices,1].min());ymax=float(verts[core_vertices,1].max())

def section_points(y0,nsamp=12):
 P=[]
 for t in tri:
  d=t[:,1]-y0;pts=[]
  for i,j in ((0,1),(1,2),(2,0)):
   di,dj=d[i],d[j]
   if abs(di)<1e-12:pts.append(t[i])
   if abs(dj)<1e-12:pts.append(t[j])
   if di*dj<0:
    a=di/(di-dj);pts.append(t[i]+a*(t[j]-t[i]))
  uu=[]
  for p in pts:
   if not any(np.linalg.norm(p-q)<1e-8 for q in uu):uu.append(p)
  if len(uu)>=2:
   a,b=uu[:2]
   for s in np.linspace(0,1,nsamp):P.append(a*(1-s)+b*s)
 return np.asarray(P,float)

NU,NT=260,144
ys=np.linspace(ymin+L*1e-5,ymax-L*1e-5,NU)
R=np.full((NU,NT),np.nan);XC=np.zeros(NU);ZC=np.zeros(NU)
for i,y in enumerate(ys):
 p=section_points(y)
 if len(p)<20:continue
 zlo,zhi=np.quantile(p[:,2],[.001,.999]);zc=(zlo+zhi)/2;xc=(p[:,0].min()+p[:,0].max())/2
 th=np.mod(np.arctan2(p[:,2]-zc,p[:,0]-xc),2*np.pi);r=np.hypot(p[:,0]-xc,p[:,2]-zc);bins=np.linspace(0,2*np.pi,NT+1)
 rb=np.full(NT,np.nan)
 for k in range(NT):
  m=(th>=bins[k])&(th<bins[k+1])
  if m.any():rb[k]=np.quantile(r[m],.985)
 valid=np.where(np.isfinite(rb))[0]
 if len(valid)>=8:
  xp=np.r_[valid-NT,valid,valid+NT];fp=np.r_[rb[valid],rb[valid],rb[valid]];rb=np.interp(np.arange(NT),xp,fp)
  R[i]=rb;XC[i]=xc;ZC[i]=zc
valid_rows=np.where(np.isfinite(R).all(1))[0]
for k in range(NT):R[:,k]=np.interp(np.arange(NU),valid_rows,R[valid_rows,k])
XC=np.interp(np.arange(NU),valid_rows,XC[valid_rows]);ZC=np.interp(np.arange(NU),valid_rows,ZC[valid_rows])
Rraw=R.copy();Zraw=ZC.copy()
Rs=gaussian_filter(R,sigma=(0.55,0.42),mode=('nearest','wrap'));Zs=gaussian_filter(ZC,sigma=.48,mode='nearest')
headw=np.clip((ys-(ymin+0.72*(ymax-ymin)))/(0.28*(ymax-ymin)),0,1)**1.7
R=Rs*(1-headw[:,None])+Rraw*headw[:,None]
ZC=Zs*(1-headw)+Zraw*headw
theta=np.arange(NT)*2*np.pi/NT;BV=[]
for i,y in enumerate(ys):
 for k,a in enumerate(theta):BV.append([XC[i]+R[i,k]*math.cos(a),y,ZC[i]+R[i,k]*math.sin(a)])
BV=np.asarray(BV,float);BF=[]
for i in range(NU-1):
 for k in range(NT):
  a=i*NT+k;b=i*NT+(k+1)%NT;c=(i+1)*NT+(k+1)%NT;d=(i+1)*NT+k;BF.extend([[a,b,c],[a,c,d]])
BF=np.asarray(BF,int);body=trimesh.Trimesh(vertices=BV,faces=BF,process=False)

def boundary_vertices(fs):
 C=collections.Counter()
 for f in fs:
  for a,b in ((f[0],f[1]),(f[1],f[2]),(f[2],f[0])):C[tuple(sorted((int(a),int(b))))]+=1
 e=[x for x,c in C.items() if c==1];return np.unique(np.array(e,int).ravel()) if e else np.empty(0,int)
def fps(points,n):
 if len(points)<=n:return np.arange(len(points))
 c=points.mean(0);sel=[int(np.argmax(((points-c)**2).sum(1)))];d=((points-points[sel[0]])**2).sum(1)
 for _ in range(1,n):j=int(np.argmax(d));sel.append(j);d=np.minimum(d,((points-points[j])**2).sum(1))
 return np.asarray(sel,int)
def shape_uv(fs):
 ps=[]
 for f in fs:
  p=Polygon(uv[f])
  if p.is_valid and p.area>1e-12:ps.append(p)
 q=unary_union(ps);return q if q.is_valid else q.buffer(0)
def sample_shape(shape,target,btarget):
 minx,miny,maxx,maxy=shape.bounds;spacing=math.sqrt(max(shape.area,1e-12)/max(target,10))*.93;pts=[];row=0;y=miny
 while y<=maxy+1e-12:
  x=minx+(.5*spacing if row%2 else 0)
  while x<=maxx+1e-12:
   if shape.covers(Point(float(x),float(y))):pts.append((x,y))
   x+=spacing
  row+=1;y+=spacing*math.sqrt(3)/2
 geoms=list(shape.geoms) if isinstance(shape,MultiPolygon) else [shape];tot=sum(z.exterior.length for z in geoms)
 for z in geoms:
  n=max(10,int(btarget*z.exterior.length/max(tot,1e-9)))
  for i in range(n):p=z.exterior.interpolate(i/n,normalized=True);pts.append((p.x,p.y))
 P=np.unique(np.round(np.asarray(pts),10),axis=0);D=Delaunay(P);keep=[]
 for t in D.simplices:
  c=P[t].mean(0);m=[(P[t[0]]+P[t[1]])/2,(P[t[1]]+P[t[2]])/2,(P[t[2]]+P[t[0]])/2]
  if shape.covers(Point(*c)) and all(shape.covers(Point(*x)) for x in m):keep.append(t)
 return P,np.asarray(keep,int)
fin_ids=[0,2,3,4,5,8,11,12,14,15]
fin_meshes=[];patch_metrics=[]
for ci in fin_ids:
 fidx=face_components[ci];fs=faces[fidx];vi=np.unique(fs);bv=boundary_vertices(fs);interior=np.setdiff1d(vi,bv);target=len(vi);sel=interior[fps(uv[interior],min(max(0,target-len(bv)),len(interior)))] if target>len(bv) else np.empty(0,int);cent=np.unique(np.r_[bv,sel]);mn=uv[vi].min(0);sc=np.maximum(uv[vi].max(0)-mn,1e-9);rbf=RBFInterpolator((uv[cent]-mn)/sc,verts[cent],kernel='thin_plate_spline',smoothing=1e-12);pred=rbf((uv[vi]-mn)/sc);e=np.linalg.norm(pred-verts[vi],axis=1)/L;shape=shape_uv(fs);P,F=sample_shape(shape,max(len(vi),int(len(vi)*2.4)),max(80,int(math.sqrt(len(vi))*18)))
 P=np.unique(np.round(np.vstack([P,uv[bv]]),10),axis=0);D=Delaunay(P);keep=[]
 for tt in D.simplices:
  cc=P[tt].mean(0);mm=[(P[tt[0]]+P[tt[1]])/2,(P[tt[1]]+P[tt[2]])/2,(P[tt[2]]+P[tt[0]])/2]
  if shape.covers(Point(*cc)) and all(shape.covers(Point(*xx)) for xx in mm):keep.append(tt)
 F=np.asarray(keep,int);Q=rbf((P-mn)/sc);fm=trimesh.Trimesh(vertices=Q,faces=F,process=False);fin_meshes.append(fm);patch_metrics.append({'component':ci,'sourceVertices':len(vi),'controls':len(cent),'nativeVertices':len(Q),'rmsPctL':float(np.sqrt(np.mean(e*e))*100),'p95PctL':float(np.quantile(e,.95)*100)})

eye_meshes=[]
em=scene.geometry['EyesC_Material.003_0'].copy();ET,_=scene.graph['Object_12'];em.apply_transform(ET)
for side in [1,-1]:
 pts=em.vertices[em.vertices[:,0]*side>0];c=pts.mean(0);cov=np.cov((pts-c).T);ev,ax=np.linalg.eigh(cov);ax=ax[:,np.argsort(ev)[::-1]];loc=(pts-c)@ax;r=np.quantile(np.abs(loc),.985,axis=0)*1.02;s=trimesh.creation.uv_sphere(count=[24,18],radius=1);s.vertices=(s.vertices*r)@ax.T+c;eye_meshes.append(s)

combined=trimesh.util.concatenate([body,*fin_meshes,*eye_meshes]);combined.merge_vertices(digits_vertex=7);combined.remove_unreferenced_vertices();combined.export(OUT/'tuna_r09r4_exactboundary_grey.glb')
np.random.seed(11);sp,_=trimesh.sample.sample_surface(source,70000);cp,_=trimesh.sample.sample_surface(combined,70000);ks=cKDTree(sp);kc=cKDTree(cp);dcs=ks.query(cp)[0]/L;dsc=kc.query(sp)[0]/L
report={'schema':'kaopu.original-fish.tuna-r09r4-exact-boundary/0.1','referenceId':'FISH-REF-002','sourceSha256':sha,
 'representation':{'body':'260x144 source-constrained periodic radial field from triangle-plane sections','fins':'10 independent high-dimensional UV-RBF membrane patches','eyes':'paired analytic PCA ellipsoids','sourceRuntimeDependency':False},
 'counts':{'nativeVertices':len(combined.vertices),'nativeFaces':len(combined.faces),'bodyVertices':len(body.vertices),'bodyFaces':len(body.faces),'finPatches':len(fin_meshes)},
 'distanceQA':{'candidateToSourceRmsPctL':float(np.sqrt(np.mean(dcs*dcs))*100),'candidateToSourceP95PctL':float(np.quantile(dcs,.95)*100),'sourceToCandidateRmsPctL':float(np.sqrt(np.mean(dsc*dsc))*100),'sourceToCandidateP95PctL':float(np.quantile(dsc,.95)*100)},
 'finPatches':patch_metrics,'gates':{'continuousPrimaryBodyBuilt':True,'fixedViewGatePending':True,'shapeAccepted':False,'materialsAllowed':False,'motionAllowed':False,'productionReady':False}}
(OUT/'TUNA_R09R4_BODY.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
