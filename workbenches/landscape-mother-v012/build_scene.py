import os
import numpy as np
from scipy.ndimage import map_coordinates
from skimage.measure import marching_cubes
import trimesh, json, struct, hashlib
from pathlib import Path

SEED=91203
out=Path(os.environ.get('LANDSCAPE_OUT','dist/landscape-mother-v012'))
out.mkdir(parents=True, exist_ok=True)

xmin,xmax=-31.0,31.0
zmin,zmax=-25.0,25.0
ymin,ymax=-3.0,31.0
nx,nz,ny=174,140,156
xs=np.linspace(xmin,xmax,nx,dtype=np.float32)
zs=np.linspace(zmin,zmax,nz,dtype=np.float32)
ys=np.linspace(ymin,ymax,ny,dtype=np.float32)
X=xs[None,None,:]
Z=zs[None,:,None]
Y=ys[:,None,None]

def clamp(x,a=0,b=1): return np.clip(x,a,b)
def smooth(a,b,x):
    t=clamp((x-a)/(b-a),0,1)
    return t*t*(3-2*t)
def adist(a,b): return np.arctan2(np.sin(a-b),np.cos(a-b))

def ellipsoid_sdf(cx,cy,cz,rx,ry,rz,rot=0.0):
    dx=X-cx; dz=Z-cz; c=np.cos(rot); s=np.sin(rot)
    u=dx*c+dz*s; v=-dx*s+dz*c
    return (np.sqrt((u/rx)**2+((Y-cy)/ry)**2+(v/rz)**2)-1.0)*min(rx,ry,rz)

def capsule2d_dist(ax,az,bx,bz):
    vx=bx-ax; vz=bz-az
    t=clamp(((X-ax)*vx+(Z-az)*vz)/(vx*vx+vz*vz),0,1)
    qx=ax+t*vx; qz=az+t*vz
    return np.sqrt((X-qx)**2+(Z-qz)**2)

def bridge_sdf(ax,az,bx,bz,cy,rad,half_h):
    r=capsule2d_dist(ax,az,bx,bz)-rad
    v=np.abs(Y-cy)-half_h
    outside=np.sqrt(np.maximum(r,0)**2+np.maximum(v,0)**2)
    inside=np.minimum(np.maximum(r,v),0)
    return outside+inside

def tower_field(spec):
    cx,cz,h,rx,rz,rot,leanx,leanz,phase,faces=spec
    base=-1.05
    t=clamp((Y-base)/h,0,1)
    sx=leanx*(t-.12)+0.08*np.sin(t*4.1+phase)
    sz=leanz*(t-.12)+0.07*np.cos(t*3.7+phase*.73)
    dx=X-(cx+sx); dz=Z-(cz+sz)
    c=np.cos(rot); s=np.sin(rot)
    u=dx*c+dz*s; v=-dx*s+dz*c
    theta=np.arctan2(v/rz,u/rx)
    radial=np.sqrt((u/rx)**2+(v/rz)**2)
    angular=(1.0
             +0.070*np.sin(faces*theta+phase)
             +0.030*np.sin((faces+2)*theta-phase*.57)
             +0.018*np.sin((faces*2-1)*theta+phase*1.31))
    baseflare=1.0+0.16*(1-smooth(.00,.13,t))
    shoulder=1.0-0.10*smooth(.68,.88,t)
    crown=1.0-0.15*smooth(.88,1.0,t)
    profile=angular*baseflare*shoulder*crown
    ledges=[(.23,.023,.045,phase+.2,1.25),(.47,.020,.040,phase+2.0,.95),(.70,.018,.034,phase+4.3,1.10)]
    for ly,lw,amp,la,span in ledges:
        sector=smooth(span,span*.55,np.abs(adist(theta,la)))
        profile += amp*np.exp(-((t-ly)/lw)**2)*sector
    rr=np.random.default_rng(abs(int(cx*137+cz*257+SEED)))
    channels=[]
    for _ in range(int(rr.integers(6,10))):
        a=float(rr.uniform(-np.pi,np.pi)); w=float(rr.uniform(.025,.060)); dep=float(rr.uniform(.030,.090))
        me=float(rr.uniform(.035,.090)); ph=float(rr.uniform(0,6.28))
        channels.append((a,w,dep,me,ph))
        center=a+me*np.sin(t*5.2+ph)+.018*np.sin(t*17.+ph*.7)
        dd=adist(theta,center)
        ymask=smooth(.05,.18,t)*(1-smooth(.82,.96,t))
        profile -= dep*np.exp(-(dd/w)**2)*ymask
    pockets=[]
    for _ in range(int(rr.integers(5,9))):
        a=float(rr.uniform(-np.pi,np.pi)); py=float(rr.uniform(.18,.78)); aw=float(rr.uniform(.045,.10)); yw=float(rr.uniform(.025,.065)); dep=float(rr.uniform(.025,.07))
        pockets.append((a,py,aw,yw,dep))
        profile -= dep*np.exp(-(adist(theta,a)/aw)**2-((t-py)/yw)**2)
    profile += (0.055*np.sin(theta*2.0+t*5.1+phase*.8)+0.035*np.sin(theta*3.0-t*3.7+phase*1.6))*smooth(.08,.92,t)
    for _ in range(3):
        ba=float(rr.uniform(-np.pi,np.pi)); span=float(rr.uniform(.30,.62)); amp=float(rr.uniform(-.105,.095)); t0=float(rr.uniform(.10,.48)); t1=float(rr.uniform(.58,.90))
        sector=np.exp(-np.power(adist(theta,ba)/span,4.0))
        vertical=smooth(t0,t0+.10,t)*(1-smooth(t1-.10,t1,t))
        profile += amp*sector*vertical
    dr=(radial-profile)*min(rx,rz)
    top=base+h + .34*np.sin(theta*3.+phase)+.16*np.sin(theta*7.-phase*.4)
    d=np.maximum(dr,np.maximum(base-Y,Y-top))
    plane_a=phase*.37+0.6
    pu=np.cos(plane_a)*u+np.sin(plane_a)*v
    cut=pu-(.79*max(rx,rz))
    d=np.maximum(d,cut)
    return d.astype(np.float32),channels,pockets

specs=[
    (-8.8,-1.6,27.2,6.2,4.8,-.13,.55,.18,1.12,7),
    (4.5,-.4,23.8,5.7,4.4,.10,-.25,.33,3.03,6),
    (-14.5,9.2,18.2,4.8,3.8,.22,.18,-.12,4.62,7),
    (-1.2,10.6,16.5,4.4,3.6,-.18,.12,.05,2.18,6),
    (11.2,9.3,14.6,4.2,3.4,.16,-.20,-.10,5.42,7),
    (-15.0,-11.3,12.8,4.0,3.2,-.08,.08,.02,.66,6),
    (8.8,-10.2,11.7,3.8,3.0,.20,-.12,.05,3.76,7),
]
phi=np.full((ny,nz,nx),99.0,dtype=np.float32)
tower_meta=[]
for spec in specs:
    d,channels,pockets=tower_field(spec)
    phi=np.minimum(phi,d)
    tower_meta.append({'spec':spec,'channels':channels,'pockets':pockets})

for a,b,rad,height in [(0,1,3.8,5.2),(0,2,3.1,3.5),(1,3,2.8,3.0),(1,4,2.6,2.8)]:
    A=specs[a];B=specs[b]
    r=capsule2d_dist(A[0],A[1],B[0],B[1])
    base=-1.12
    top=base+height*(1-smooth(0,rad,r))
    d=np.maximum(r-rad,np.maximum(base-Y,Y-top)).astype(np.float32)
    phi=np.minimum(phi,d)

bridge=bridge_sdf(4.5,1.5,10.4,8.6,6.9,2.25,1.35).astype(np.float32)
phi=np.minimum(phi,bridge)

caves=[
    (-8.8,4.8,-4.2,2.9,2.55,3.8,-.08),
    (4.7,4.1,-3.5,2.45,2.15,3.1,.09),
    (-14.0,4.0,7.0,2.0,1.8,2.5,.16),
]
for c in caves:
    cx,cy,cz,rx,ry,rz,rot=c
    cluster=[c,(cx+.28*np.cos(rot),cy+.22,cz+.28*np.sin(rot),rx*.83,ry*.74,rz*.92,rot+.12),
             (cx-.24*np.cos(rot),cy-.18,cz-.24*np.sin(rot),rx*.72,ry*.66,rz*.86,rot-.15)]
    for cc in cluster: phi=np.maximum(phi,-ellipsoid_sdf(*cc).astype(np.float32))
for cc in [(7.6,5.2,5.6,4.1,2.45,2.2,.48),(7.9,5.55,5.8,3.5,1.95,2.0,.58)]:
    phi=np.maximum(phi,-ellipsoid_sdf(*cc).astype(np.float32))
for cc in [(-2.0,3.2,-1.2,3.4,2.15,2.0,-.20),(-1.7,3.55,-1.0,2.8,1.72,1.75,-.08)]:
    phi=np.maximum(phi,-ellipsoid_sdf(*cc).astype(np.float32))

for ti in [0,2,3,4]:
    spec=specs[ti]; cx,cz,h,rx,rz,rot,*_=spec
    rr=np.random.default_rng(SEED+ti*991+77)
    ang=float(rr.uniform(-np.pi,np.pi))
    rradius=.94/np.sqrt((np.cos(ang)/rx)**2+(np.sin(ang)/rz)**2)
    pcx=cx+np.cos(ang)*rradius; pcz=cz+np.sin(ang)*rradius
    cy=float(rr.uniform(3.8,min(h*.58,10.5)))
    ex=float(rr.uniform(.52,.82)); ey=float(rr.uniform(.82,1.42)); ez=float(rr.uniform(.72,1.12))
    for ox,oy,sc,da in [(0,0,1,0),(.18,.20,.72,.13),(-.15,-.18,.62,-.11)]:
        cc=(pcx+ox*np.cos(ang),cy+oy,pcz+ox*np.sin(ang),ex*sc,ey*sc,ez*sc,ang+da)
        phi=np.maximum(phi,-ellipsoid_sdf(*cc).astype(np.float32))

def ground_height(x,z):
    g=-1.10 + .32*np.sin(x*.105+0.4)*np.cos(z*.085-.2)+.16*np.sin((x+z)*.23)
    for cx,cz,rx,rz,dep in [(-1,-7,6.5,4.8,1.1),(5,12,5.0,4.1,.8),(-18,1,4.8,3.8,.65)]:
        q=((x-cx)/rx)**2+((z-cz)/rz)**2
        g-=dep*np.exp(-q*2.0)
    return g
GH=ground_height(X,Z)
foot=(np.power(np.abs(X/29.0),8.0)+np.power(np.abs(Z/23.0),8.0))**(1.0/8.0)-1.0
ground=np.maximum(foot*4.0,np.maximum((ymin+.22)-Y,Y-GH)).astype(np.float32)
phi=np.minimum(phi,ground)

rough=(.065*np.sin(X*.74+Y*.17+Z*.31+1.1)+.038*np.sin(X*1.39-Y*.23+Z*.55+2.4)+.016*np.sin(X*3.05+Y*.47-Z*1.12+.7)).astype(np.float32)
phi=phi+rough*(np.abs(phi)<.8).astype(np.float32)

spacing=((ymax-ymin)/(ny-1),(zmax-zmin)/(nz-1),(xmax-xmin)/(nx-1))
verts,faces,normals,vals=marching_cubes(phi,level=0.0,spacing=spacing,allow_degenerate=False,step_size=1)
world=np.empty_like(verts,dtype=np.float32)
world[:,0]=verts[:,2]+xmin; world[:,1]=verts[:,0]+ymin; world[:,2]=verts[:,1]+zmin
mesh=trimesh.Trimesh(vertices=world,faces=faces,process=False)
parts=sorted(mesh.split(only_watertight=False),key=lambda m:len(m.faces),reverse=True)
parts=[p for p in parts if len(p.faces)>100]
mesh=trimesh.util.concatenate(parts)
mesh.update_faces(mesh.unique_faces())
mesh.update_faces(mesh.nondegenerate_faces())
mesh.remove_unreferenced_vertices()
mesh.fix_normals()

primary_vertex_count=len(mesh.vertices)
talus=[]
trng=np.random.default_rng(SEED+4401)
for _ in range(64):
    ti=int(trng.integers(0,len(specs)))
    cx,cz,h,rx,rz,rot,*_=specs[ti]
    a=float(trng.uniform(-np.pi,np.pi)); radial=float(trng.uniform(1.05,1.55))
    px=cx+np.cos(a)*rx*radial; pz=cz+np.sin(a)*rz*radial
    if (abs(px)/28.2)**8+(abs(pz)/22.2)**8>0.82: continue
    gy=float(ground_height(np.array(px),np.array(pz)))
    r=float(trng.uniform(.24,.82))
    rock=trimesh.creation.icosphere(subdivisions=1,radius=1.0)
    vv=np.asarray(rock.vertices,dtype=np.float64)
    scales=np.array([r*trng.uniform(.75,1.45),r*trng.uniform(.55,1.05),r*trng.uniform(.72,1.35)])
    vv*=scales
    radial_len=np.linalg.norm(vv,axis=1,keepdims=True); dirs=vv/np.maximum(radial_len,1e-8)
    wob=1.0+.12*np.sin(dirs[:,0]*7.3+dirs[:,1]*4.1+dirs[:,2]*5.6+trng.uniform(0,6.28))
    vv*=wob[:,None]
    rock.vertices=vv
    axis=np.array([trng.uniform(-1,1),trng.uniform(-.2,.7),trng.uniform(-1,1)]);axis/=np.linalg.norm(axis)
    rock.apply_transform(trimesh.transformations.rotation_matrix(float(trng.uniform(0,6.28)),axis))
    rock.apply_translation([px,gy+r*.34,pz])
    talus.append(rock)
if talus: mesh=trimesh.util.concatenate([mesh]+talus)
mesh.fix_normals()
areas=np.asarray(mesh.area_faces)
tiny=np.where(areas < 1e-9)[0]
if len(tiny):
    ff=np.asarray(mesh.faces).copy()
    for fi in tiny:
        tri=ff[fi].copy(); rep=int(tri[0])
        for old in map(int,tri[1:]): ff[ff==old]=rep
    keep=np.array([len(set(map(int,t)))==3 for t in ff],dtype=bool)
    mesh=trimesh.Trimesh(vertices=np.asarray(mesh.vertices).copy(),faces=ff[keep],process=False)
    mesh.remove_unreferenced_vertices(); mesh.fix_normals()

P=np.asarray(mesh.vertices,dtype=np.float32)
F=np.asarray(mesh.faces,dtype=np.uint32)
N=np.asarray(mesh.vertex_normals,dtype=np.float32)
V=len(P)
adj=[[] for _ in range(V)]
for tri in F:
    a,b,c=map(int,tri)
    adj[a].extend((b,c));adj[b].extend((a,c));adj[c].extend((a,b))
avgP=np.empty_like(P);avgN=np.empty_like(N)
for i,nb in enumerate(adj):
    if nb:
        ids=np.fromiter(set(nb),dtype=np.int32)
        avgP[i]=P[ids].mean(0);avgN[i]=N[ids].mean(0)
    else:
        avgP[i]=P[i];avgN[i]=N[i]
curv=np.clip(1.0-np.sum(N*avgN,axis=1)/np.maximum(np.linalg.norm(avgN,axis=1),1e-6),0,1)
lap=np.sum((avgP-P)*N,axis=1)
concave=np.clip((-lap-.005)/.12,0,1)
material=np.where(P[:,1] < .55,0,1).astype(np.uint8)
material[primary_vertex_count:]=1
height=np.clip((P[:,1]+1.2)/29.0,0,1)
slope=np.clip(1-np.abs(N[:,1]),0,1)

def hash_noise(p,scale,phase):
    v=np.sin(p[:,0]*scale[0]+p[:,1]*scale[1]+p[:,2]*scale[2]+phase)*43758.5453
    return v-np.floor(v)
var=(.55*hash_noise(P,(.21,.13,.18),1.7)+.30*hash_noise(P,(.58,.31,.49),4.1)+.15*hash_noise(P,(1.7,.9,1.3),.8))
runoff=np.zeros(V,dtype=np.float32)
nearest=np.full(V,1e9,dtype=np.float32)
for tm in tower_meta:
    cx,cz,h,rx,rz,rot,leanx,leanz,phase,faces=tm['spec']
    dx=P[:,0]-cx;dz=P[:,2]-cz
    c=np.cos(rot);s=np.sin(rot);u=dx*c+dz*s;v=-dx*s+dz*c
    theta=np.arctan2(v/rz,u/rx)
    radial=np.sqrt((u/rx)**2+(v/rz)**2)
    dist=np.abs(radial-1.0)
    own=dist<nearest
    local=np.zeros(V,dtype=np.float32)
    t=np.clip((P[:,1]+1.05)/h,0,1)
    for a,w,dep,me,ph in tm['channels']:
        cen=a+me*np.sin(t*5.2+ph)+.018*np.sin(t*17+ph*.7)
        dd=np.arctan2(np.sin(theta-cen),np.cos(theta-cen))
        local=np.maximum(local,np.exp(-(dd/(w*1.8))**2))
    local*=np.clip(slope*1.35,0,1)*smooth(.03,.15,t)*(1-smooth(.9,1,t))
    runoff=np.where(own,local,runoff);nearest=np.minimum(nearest,dist)
runoff=np.clip(runoff,0,1)
cave_field=np.zeros(V,dtype=np.float32)
for cx,cy,cz,rx,ry,rz,rot in caves+[(7.6,5.2,5.6,4.1,2.45,2.2,.48),(-2.0,3.2,-1.2,3.4,2.15,2.0,-.20)]:
    dx=P[:,0]-cx;dz=P[:,2]-cz;c=np.cos(rot);s=np.sin(rot);u=dx*c+dz*s;v=-dx*s+dz*c
    q=np.sqrt((u/rx)**2+((P[:,1]-cy)/ry)**2+(v/rz)**2)
    cave_field=np.maximum(cave_field,np.exp(-((q-1)/.24)**2))
moist=np.clip(.10+.50*runoff+.34*cave_field+.22*concave+.18*(1-height)+.12*(var-.5),0,1)
fresh=np.clip(.18+1.8*curv+.36*cave_field+.18*(hash_noise(P,(.43,.73,.29),3.2)-.55),0,1)
bio=np.clip((.20+.62*moist+.20*(N[:,1]*.5+.5)+.20*concave-.55*fresh+.18*(var-.5))* (material==1),0,1)
iron=np.clip((.04+.48*runoff+.20*moist+.13*(var-.5))* (material==1),0,1)
ao=np.clip(1.0-.56*cave_field-.28*concave-.13*curv-.10*(1-height),.18,1.0)
roughness=np.clip(.78+.12*(var-.5)+.12*bio+.08*concave-.30*moist-.10*fresh,.34,.96)

def sample_phi(points):
    ix=(points[:,0]-xmin)/(xmax-xmin)*(nx-1)
    iz=(points[:,2]-zmin)/(zmax-zmin)*(nz-1)
    iy=(points[:,1]-ymin)/(ymax-ymin)*(ny-1)
    return map_coordinates(phi,[iy,iz,ix],order=1,mode='constant',cval=5.0,prefilter=False)

sun_base=np.array([.50,.78,.37],dtype=np.float32);sun_base/=np.linalg.norm(sun_base)
soft_dirs=[]
for off in [(0,0,0),(.035,-.018,.015),(-.028,.021,-.018)]:
    d=sun_base+np.array(off,dtype=np.float32);d/=np.linalg.norm(d);soft_dirs.append(d)
vis=np.zeros(V,dtype=np.float32)
start=P+N*.13
steps=np.array([.35,.7,1.15,1.7,2.4,3.3,4.4,5.8,7.6,9.8,12.5,16.,20.,25.],dtype=np.float32)
for d in soft_dirs:
    vv=np.ones(V,dtype=np.float32)
    for s in steps:
        q=sample_phi(start+d*s)
        vv*=np.clip((q+.09)/.24,0,1)
    vis+=vv
vis/=len(soft_dirs)
vis=np.where(material==0,np.maximum(vis,.42),vis)
soil=(material==0)
moist=np.where(soil,np.clip(.28+.28*(1-height)+.20*(var-.5),0,1),moist)
bio=np.where(soil,np.clip(.34+.35*moist+.18*(var-.5),0,1),bio)
iron=np.where(soil,.12+0.18*var,iron)
roughness=np.where(soil,.88-.12*moist,roughness)
ao=np.where(soil,np.maximum(ao,.62),ao)
fresh=np.where(soil,0,fresh)
runoff=np.where(soil,np.clip(.15+.35*(1-height)+.15*(var-.5),0,1),runoff)
talus_mask=np.arange(V)>=primary_vertex_count
moist[talus_mask]=np.clip(.18+.26*var[talus_mask],0,1)
bio[talus_mask]=np.clip(.12+.22*var[talus_mask],0,1)
iron[talus_mask]=np.clip(.14+.22*var[talus_mask],0,1)
fresh[talus_mask]=np.clip(.18+.18*curv[talus_mask],0,1)
roughness[talus_mask]=np.clip(.80+.10*var[talus_mask],.72,.94)
var[talus_mask]=np.clip(.18+.56*var[talus_mask],0,1)
ao[talus_mask]=np.clip(ao[talus_mask]*.88,.42,1)
mins=P.min(0).astype(np.float32);maxs=P.max(0).astype(np.float32)
span=np.maximum(maxs-mins,1e-6)
qpos=np.clip(np.rint((P-mins)/span*65535),0,65535).astype('<u2')
qnorm=np.clip(np.rint(N*32767),-32767,32767).astype('<i2')
fields=np.stack([
    material,np.rint(moist*255),np.rint(bio*255),np.rint(runoff*255),
    np.rint(fresh*255),np.rint(ao*255),np.rint(roughness*255),np.rint(vis*255),
    np.rint(iron*255),np.rint(var*255),np.rint(height*255),np.rint(curv*255),
],axis=1).astype(np.uint8)
record=np.empty((V,24),dtype=np.uint8)
record[:,0:6]=qpos.view(np.uint8).reshape(V,6)
record[:,6:12]=qnorm.view(np.uint8).reshape(V,6)
record[:,12:24]=fields
indices=F.astype('<u4').reshape(-1)
header=bytearray(80)
header[0:4]=b'LMK3'
struct.pack_into('<IIII',header,4,3,24,V,len(indices))
struct.pack_into('<ffffff',header,20,*mins.tolist(),*maxs.tolist())
struct.pack_into('<II',header,44,80,80+V*24)
struct.pack_into('<IiI',header,52,int(mesh.is_watertight),int(mesh.euler_number),SEED)
payload=bytes(header)+record.tobytes()+indices.tobytes()
(out/'scene.bin').write_bytes(payload)
sha=hashlib.sha256(payload).hexdigest()
meta={
 'schema':'landscape-mother-karst-v012/1','seed':SEED,'vertices':V,'triangles':int(len(indices)//3),
 'watertight':bool(mesh.is_watertight),'euler':int(mesh.euler_number),'bounds':[mins.tolist(),maxs.tolist()],
 'grid':[nx,nz,ny],'spacingM':list(map(float,spacing)),'binaryBytes':len(payload),'binarySha256':sha,
 'fields':['material','moisture','bio','runoff','freshFracture','skyAccessibility','roughness','sunVisibility','ironDeposit','mineralVariation','height','curvature'],
 'textureSampling':False,'runtimeLOD':False,'deviceDependentGeometry':False,'distantMountains':False,'fog':False,'externalModels':False,'images':False,
 'components':int(len(mesh.split(only_watertight=False))),
 'tinyFaceCountLt1e9':int((mesh.area_faces<1e-9).sum()),
 'windingConsistent':bool(mesh.is_winding_consistent)
}
(out/'SCENE_META.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(meta,indent=2))
