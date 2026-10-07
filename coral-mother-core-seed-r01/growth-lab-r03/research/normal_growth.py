"""Independent normal-front growth benchmark. Does not execute or copy Houdini code.
Seed: one closed shallow base with low buds, no cups/canopies/leaf instances.
Direction selection evolves in time; mesh follows its current 3-D normals.
"""
import numpy as np
from scipy.spatial import cKDTree, Delaunay
from pathlib import Path
import argparse,json,time,math,hashlib
from triangle_collision import intersections

def unit(a): return a/np.maximum(np.linalg.norm(a,axis=-1,keepdims=True),1e-12)
def smooth(a):
 a=np.clip(a,0,1);return a*a*(3-2*a)

class MeshGrowth:
 def __init__(self, detail=.035, seed=17, colonies=1, rate=.007, period=80, rise=90, roughness=.1, width=.36, curvature_weight=0, normal_passes=4, surface_smooth=.065, turn_fraction=.70, curvature_floor=.10, curvature_scale=.070, curvature_cap=1000, rise_target=.965, rise_width=None, waveform='ramp', phase_strength=0, seed_shape='oval'):
  self.detail=detail;self.seed=seed;self.rate=rate;self.period=period;self.rise=rise;self.roughness=roughness;self.width=width;self.curvature_weight=curvature_weight;self.normal_passes=normal_passes;self.surface_smooth=surface_smooth;self.turn_fraction=turn_fraction;self.curvature_floor=curvature_floor;self.curvature_scale=curvature_scale;self.curvature_cap=curvature_cap;self.rise_target=rise_target;self.rise_width=width if rise_width is None else rise_width;self.t=0
  self.split_count=0;self.collapse_count=0;self.flip_count=0;self.collision_limited=0
  self.timings={'attributes':0,'exposure':0,'advance':0,'remesh':0,'surface_contacts':0};self.rng=np.random.default_rng(seed)
  self.face_contacts=0
  self.intersection_backtracks=0;self.remesh_rollbacks=0
  self.waveform=waveform;self.phase_strength=phase_strength;self.colonies=colonies
  self.curvature_reference=detail
  self.seed_shape=seed_shape
  self.make_seed(colonies);self.topology();self.fields()
 def make_seed(self,colonies):
  buds=[(0,0,.105,1,0)] if colonies==1 else [(-.27,-.11,.09,1,0),(.27,-.06,.080,.86,.17),(-.09,.21,.065,.72,.31),(.35,.24,.050,.50,.55),(-.40,.25,.050,.42,.42)][:colonies]
  outline_angles=np.arange(256)*2*np.pi/256;outline=np.full(256,.13)
  for bx,bz,r,strength,ph in buds:
   rad=.11+.15*r;parallel=bx*np.cos(outline_angles)+bz*np.sin(outline_angles);perpendicular=bx*np.sin(outline_angles)-bz*np.cos(outline_angles);available=rad*rad-perpendicular*perpendicular
   outline=np.maximum(outline,np.where(available>=0,parallel+np.sqrt(np.maximum(0,available)),.13))
  for _ in range(3):outline=(np.roll(outline,2)+2*np.roll(outline,1)+3*outline+2*np.roll(outline,-1)+np.roll(outline,-2))/9
  def radial_ratio(points):
   points=np.asarray(points)
   if self.seed_shape=='oval':return np.sqrt((points[...,0]/.59)**2+(points[...,1]/.43)**2)
   angle=np.mod(np.arctan2(points[...,1],points[...,0]),2*np.pi);radius=np.interp(angle,np.append(outline_angles,2*np.pi),np.append(outline,outline[0]));return np.linalg.norm(points,axis=-1)/radius
  # Hexagonal sample lattice clipped to a shallow oval, with a shared perimeter.
  # This is only a low substrate. All stalks and overhangs develop in step().
  spacing=self.detail*1.05;plane=[]
  for j,zz in enumerate(np.arange(-.40,.41,spacing*.866)):
   for xx in np.arange(-.58,.59,spacing):
    xx+=spacing*.5*(j%2)
    if radial_ratio([xx,zz])<.88:plane.append((xx,zz))
  interior=len(plane);ring=max(64,int(3.15/spacing))
  for a in np.arange(ring)*2*np.pi/ring:
   if self.seed_shape=='oval':plane.append((.59*np.cos(a),.43*np.sin(a)))
   else:
    r=np.interp(a,np.append(outline_angles,2*np.pi),np.append(outline,outline[0]));plane.append((r*np.cos(a),r*np.sin(a)))
  plane=np.array(plane);tri=Delaunay(plane).simplices
  if self.seed_shape!='oval':
   t=plane[tri];keep=(radial_ratio(t.mean(axis=1))<=1.000001)
   for i,j in [(0,1),(1,2),(2,0)]:keep&=radial_ratio((t[:,i]+t[:,j])*.5)<=1.000001
   tri=tri[keep];links={};neighbors=[set() for _ in tri]
   for k,(a,b,c) in enumerate(tri):
    for edge in [(a,b),(b,c),(c,a)]:links.setdefault(tuple(sorted(edge)),[]).append(k)
   for ids in links.values():
    if len(ids)==2:neighbors[ids[0]].add(ids[1]);neighbors[ids[1]].add(ids[0])
   unseen=set(range(len(tri)));components=[]
   while unseen:
    root=unseen.pop();component={root};stack=[root]
    while stack:
     for k in neighbors[stack.pop()]:
      if k in unseen:unseen.remove(k);component.add(k);stack.append(k)
    components.append(component)
   tri=tri[sorted(max(components,key=len))];used=np.unique(tri);mapping=np.full(len(plane),-1);mapping[used]=np.arange(len(used));tri=mapping[tri];plane=plane[used]
  edges=np.sort(np.concatenate((tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]])),axis=1);edges,counts=np.unique(edges,axis=0,return_counts=True);boundary=set(edges[counts==1].ravel())
  points=[];activity=[];phase=[];faces=[]
  bottom_indices=np.arange(len(plane));cursor=len(plane)
  for q in range(len(plane)):
   if q not in boundary or self.seed_shape!='oval':bottom_indices[q]=cursor;cursor+=1
  for lower in [False,True]:
   for q,(xx,zz) in enumerate(plane):
    if lower and q in boundary and self.seed_shape=='oval':continue
    vals=[np.exp(-((xx-bx)**2+(zz-bz)**2)/(r*r))*strength for bx,bz,r,strength,ph in buds]
    k=int(np.argmax(vals));v=vals[k];lens=max(0,1-float(radial_ratio([xx,zz]))**2)**.5
    yy=-.025*lens if lower else .018*lens+.032*v
    if self.seed_shape!='oval':yy=(-.012-.008*lens) if lower else (.012+.008*lens+.032*v)
    if not lower: yy+=.0015*v*math.sin(xx*48+seed_phase(self.seed))*math.sin(zz*51)
    points.append((xx,yy,zz));activity.append(0 if lower else v);phase.append(buds[k][-1])
  bottom=lambda i:bottom_indices[i]
  for a,b,c in tri:
   # Delaunay orientation is positive in x,z, thus reverse for upward y.
   faces.extend([[a,c,b],[bottom(a),bottom(b),bottom(c)]])
  if self.seed_shape!='oval':
   boundary_edges={tuple(edge) for edge in edges[counts==1]}
   for a,b,c in tri:
    for i,j in [(a,c),(c,b),(b,a)]:
     if tuple(sorted((i,j))) in boundary_edges:faces.extend([[j,i,bottom(i)],[j,bottom(i),bottom(j)]])
  self.p=np.array(points,float);self.f=np.array(faces,np.int32);self.activity=np.array(activity);self.phase=np.array(phase)
  # Zero-growth substrate must also be fixed under relaxation; otherwise a thin
  # inactive rim can be smoothed through the underside before any bud develops.
  self.birth=np.zeros(len(points));self.pin=(self.activity<.03);self.exposure=np.ones(len(points))
  if self.seed_shape!='oval':self.pin[list(boundary)]=True
 def topology(self):
  e=np.sort(np.concatenate((self.f[:,[0,1]],self.f[:,[1,2]],self.f[:,[2,0]])),axis=1)
  self.e,counts=np.unique(e,axis=0,return_counts=True)
  self.degree=np.bincount(self.e.ravel(),minlength=len(self.p));self.neighbors=[set() for _ in self.p]
  for a,b in self.e:self.neighbors[a].add(b);self.neighbors[b].add(a)
 def fields(self):
  start=time.monotonic();a,b,c=self.p[self.f[:,0]],self.p[self.f[:,1]],self.p[self.f[:,2]]
  self.fn=np.cross(b-a,c-a);self.n=np.zeros_like(self.p)
  for k in range(3):np.add.at(self.n,self.f[:,k],self.fn)
  self.n=unit(self.n);avg=np.zeros_like(self.p)
  np.add.at(avg,self.e[:,0],self.p[self.e[:,1]]);np.add.at(avg,self.e[:,1],self.p[self.e[:,0]])
  self.lap=avg/np.maximum(self.degree[:,None],1)-self.p
  self.curvature=np.maximum(0,-np.sum(self.lap*self.n,axis=1))*self.curvature_reference/(self.detail*self.detail)
  self.timings['attributes']+=time.monotonic()-start
 def cast_exposure(self):
  """Exact triangle intersections for a directional light, projected-grid broadphase.
  One ray/vertex. Not hemisphere AO and not a point-height proxy.
  """
  start=time.monotonic();s=self.detail*1.7;lx,lz=.16,.11
  uv=self.p[:,[0,2]]-self.p[:,1,None]*[lx,lz];tri=uv[self.f];tri_y=self.p[self.f,1]
  v0=tri[:,1]-tri[:,0];v1=tri[:,2]-tri[:,0];det=v0[:,0]*v1[:,1]-v0[:,1]*v1[:,0]
  bounds=np.floor(np.stack([tri.min(axis=1),tri.max(axis=1)],axis=1)/s).astype(int);bins={}
  for k,((x0,z0),(x1,z1)) in enumerate(bounds):
   if abs(det[k])<1e-12:continue
   for x in range(x0,x1+1):
    for z in range(z0,z1+1):bins.setdefault((x,z),[]).append(k)
  cells=np.floor(uv/s).astype(int);ex=np.ones(len(self.p));eps=self.detail*.13
  for i in np.flatnonzero(~self.pin):
   candidates=bins.get(tuple(cells[i]),[])
   if not candidates:continue
   ids=np.array(candidates);d=uv[i]-tri[ids,0]
   u=(d[:,0]*v1[ids,1]-d[:,1]*v1[ids,0])/det[ids];v=(v0[ids,0]*d[:,1]-v0[ids,1]*d[:,0])/det[ids]
   inside=(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)
   yy=tri_y[ids,0]+u*(tri_y[ids,1]-tri_y[ids,0])+v*(tri_y[ids,2]-tri_y[ids,0])
   if np.any(inside&(yy>self.p[i,1]+eps)):ex[i]=0
  # Small connectivity blur softens the one-ray shadow terminator.
  for _ in range(2):
   avg=np.zeros(len(ex));np.add.at(avg,self.e[:,0],ex[self.e[:,1]]);np.add.at(avg,self.e[:,1],ex[self.e[:,0]])
   ex=.65*ex+.35*avg/np.maximum(self.degree,1)
  self.exposure=ex;self.timings['exposure']+=time.monotonic()-start
 def step(self):
  self.fields()
  if self.t%3==0:self.cast_exposure()
  start=time.monotonic();progress=(self.t-self.rise)/self.period
  # Repeatedly average the current normal field, as a geometric filter. This
  # suppresses mesh-scale positive feedback while retaining coarse form.
  grow_n=self.n.copy()
  for _ in range(self.normal_passes):
   avg=np.zeros_like(grow_n);np.add.at(avg,self.e[:,0],grow_n[self.e[:,1]]);np.add.at(avg,self.e[:,1],grow_n[self.e[:,0]])
   grow_n=unit(.50*grow_n+.50*avg/np.maximum(self.degree[:,None],1))
  # Initial upward column, followed by repeating vertical-to-side/down bands.
  if self.t<self.rise: target=np.full(len(self.p),.965+smooth(self.t/self.rise)*(self.rise_target-.965))
  else:
   phase_variation=self.phase_strength*(np.sin(self.p[:,0]*17+self.seed*.13)+np.sin(self.p[:,2]*19-self.p[:,1]*7))*.5
   cycle=(progress+self.phase*.36+phase_variation)%1
   target=(.405+.525*np.cos(2*np.pi*cycle)) if self.waveform=='cosine' else (.93-1.05*smooth(np.clip(cycle/self.turn_fraction,0,1)))
  band_width=self.rise_width if self.t<self.rise else self.width
  local_early=None;local_gain=np.ones(len(self.p))
  if self.colonies>1:
   # Each seed region has its own growth clock and speed. Geometry remains one
   # connected mesh; no adult branch or leaf is inserted at any time.
   local_gain=1-.95*self.phase;local_time=self.t*local_gain;local_early=local_time<self.rise
   young_target=.965+smooth(local_time/self.rise)*(self.rise_target-.965)
   variation=self.phase_strength*(np.sin(self.p[:,0]*17+self.seed*.13)+np.sin(self.p[:,2]*19-self.p[:,1]*7))*.5
   local_cycle=((local_time-self.rise)/self.period+self.phase*.36+variation)%1
   mature_target=(.405+.525*np.cos(2*np.pi*local_cycle)) if self.waveform=='cosine' else (.93-1.05*smooth(np.clip(local_cycle/self.turn_fraction,0,1)))
   target=np.where(local_early,young_target,mature_target);band_width=np.where(local_early,self.rise_width,self.width)
  direction=np.exp(-((grow_n[:,1]-target)/band_width)**2)
  activity=smooth((self.activity-.02)/.35)
  # Macro patch selects where stalks can initiate; evolving curvature is local feedback.
  cfield=self.curvature.copy()
  for _ in range(2):
   avg=np.zeros(len(cfield));np.add.at(avg,self.e[:,0],cfield[self.e[:,1]]);np.add.at(avg,self.e[:,1],cfield[self.e[:,0]])
   cfield=.6*cfield+.4*avg/np.maximum(self.degree,1)
  curvature=.9+.12*np.clip(cfield/.30,0,1)
  if self.t>=self.rise:
   edge_growth=self.curvature_floor+(1-self.curvature_floor)*smooth((cfield-.006)/self.curvature_scale)
   curvature=(1-self.curvature_weight)*curvature+self.curvature_weight*edge_growth
   curvature/=1+(cfield/self.curvature_cap)**4
   if local_early is not None:curvature=np.where(local_early,.9+.12*np.clip(cfield/.30,0,1),curvature)
  regional=1-self.roughness+self.roughness*np.sin(self.p[:,0]*43+self.seed*.31)*np.sin(self.p[:,2]*39+self.p[:,1]*17)
  speed=self.rate*activity*direction*curvature*(.03+.97*self.exposure)*regional*local_gain
  move=grow_n*speed[:,None]
  # Tangential redistribution changes sample spacing, not target surface height.
  normal_lap=np.sum(self.lap*self.n,axis=1)[:,None]*self.n
  move+=.16*(self.lap-normal_lap)+self.surface_smooth*normal_lap
  move[self.pin]=0
  # Local non-neighbor repulsion: useful broad guard, not a full CCD guarantee.
  tree=cKDTree(self.p);pairs=tree.query_pairs(self.detail*.64,output_type='ndarray')
  for i,j in pairs:
   if j in self.neighbors[i]:continue
   if self.neighbors[i]&self.neighbors[j]:continue
   delta=self.p[i]-self.p[j];length=np.linalg.norm(delta)
   if length<1e-10:continue
   response=delta/length*(self.detail*.64-length)*.16
   if not self.pin[i]:move[i]+=response
   if not self.pin[j]:move[j]-=response
   self.collision_limited+=1
  lengths=np.linalg.norm(move,axis=1);move*=np.minimum(1,self.detail*.22/np.maximum(lengths,1e-12))[:,None]
  if self.t>=self.rise:move=self.surface_contact_constraints(move)
  # Free 3-D endpoint intersection guard. Unlike the retired cup chart, an
  # overhang is allowed; only a real non-adjacent triangle crossing is rejected.
  candidate=self.p+move
  old_tri=self.p[self.f];old_cross=np.cross(old_tri[:,1]-old_tri[:,0],old_tri[:,2]-old_tri[:,0])
  for trial in range(8):
   bad=intersections(candidate,self.f,np.any(~self.pin[self.f],axis=1))
   new_tri=candidate[self.f];new_cross=np.cross(new_tri[:,1]-new_tri[:,0],new_tri[:,2]-new_tri[:,0]);turned=np.flatnonzero((np.sum(old_cross*new_cross,axis=1)<=np.sum(old_cross*old_cross,axis=1)*.02)|(np.linalg.norm(new_cross,axis=1)<self.detail*self.detail*.001))
   if not len(bad) and not len(turned):break
   vertices=np.unique(self.f[np.concatenate((bad.ravel(),turned))]);move[vertices]*=(.35 if trial<2 else 0);candidate=self.p+move;self.intersection_backtracks+=len(bad)+len(turned)
  if len(bad) or len(turned):
   new_tri=candidate[self.f];new_cross=np.cross(new_tri[:,1]-new_tri[:,0],new_tri[:,2]-new_tri[:,0])
   if len(intersections(candidate,self.f,np.any(~self.pin[self.f],axis=1))) or np.any(np.sum(old_cross*new_cross,axis=1)<=np.sum(old_cross*old_cross,axis=1)*.02) or np.any(np.linalg.norm(new_cross,axis=1)<self.detail*self.detail*.001):candidate=self.p.copy();self.intersection_backtracks+=1
  self.p=candidate;self.t+=1;self.timings['advance']+=time.monotonic()-start
  if self.t%3==0:self.remesh()
 def surface_contact_constraints(self,move):
  """Point-triangle clearance constraints in full 3-D (local candidate search).
  Includes relative face motion, no height-field/injective chart restriction.
  This is discrete contact projection, not exact swept-triangle CCD.
  """
  start=time.monotonic();tri=self.p[self.f];centers=tri.mean(axis=1);tree=cKDTree(centers)
  active=np.flatnonzero(~self.pin);dist,ids=tree.query(self.p[active],k=32)
  vi=np.repeat(active,32);fi=ids.ravel();keep=(dist.ravel()<self.detail*1.4)&~np.any(self.f[fi]==vi[:,None],axis=1);vi=vi[keep];fi=fi[keep]
  if not len(vi):return move
  t=tri[fi];p=self.p[vi];a,b,c=t[:,0],t[:,1],t[:,2];ab=b-a;ac=c-a;n=unit(np.cross(ab,ac));proj=p-n*np.sum((p-a)*n,axis=1)[:,None]
  aa=np.sum(ab*ab,axis=1);bb=np.sum(ab*ac,axis=1);cc=np.sum(ac*ac,axis=1);dd=np.sum((proj-a)*ab,axis=1);ee=np.sum((proj-a)*ac,axis=1);den=np.maximum(aa*cc-bb*bb,1e-20)
  v=(cc*dd-bb*ee)/den;w=(aa*ee-bb*dd)/den;u=1-v-w;inside=(u>=0)&(v>=0)&(w>=0)
  closest=proj.copy();weights=np.stack((u,v,w),axis=1);best=np.full(len(vi),np.inf)
  for i,j in [(0,1),(1,2),(2,0)]:
   edge=t[:,j]-t[:,i];alpha=np.clip(np.sum((p-t[:,i])*edge,axis=1)/np.maximum(np.sum(edge*edge,axis=1),1e-20),0,1);q=t[:,i]+edge*alpha[:,None];d=np.sum((p-q)**2,axis=1);sel=(~inside)&(d<best)
   closest[sel]=q[sel];weights[sel]=0;weights[sel,i]=1-alpha[sel];weights[sel,j]=alpha[sel];best[sel]=d[sel]
  delta=p-closest;length=np.linalg.norm(delta,axis=1);gap=self.detail*.32
  keep=(length<self.detail*.72)&(length>1e-9);vi=vi[keep];fi=fi[keep];weights=weights[keep];length=length[keep];sep=delta[keep]/length[:,None]
  if not len(vi):self.timings['surface_contacts']+=time.monotonic()-start;return move
  face_move=np.sum(move[self.f[fi]]*weights[:,:,None],axis=1);relative=np.sum((move[vi]-face_move)*sep,axis=1);need=np.maximum(0,gap-length-relative)
  selected=need>0;vi=vi[selected];fi=fi[selected];weights=weights[selected];sep=sep[selected];need=need[selected]
  face_mass=(~self.pin[self.f[fi]]).astype(float);den=1+np.sum(weights*weights*face_mass,axis=1);corr=sep*(need/den*.6)[:,None]
  correction=np.zeros_like(move);np.add.at(correction,vi,corr)
  for k in range(3):np.add.at(correction,self.f[fi,k],-corr*(weights[:,k]*face_mass[:,k])[:,None])
  size=np.linalg.norm(correction,axis=1);correction*=np.minimum(1,self.detail*.15/np.maximum(size,1e-12))[:,None]
  move+=correction;move[self.pin]=0;self.face_contacts+=len(vi);self.timings['surface_contacts']+=time.monotonic()-start;return move
 def remesh(self):
  start=time.monotonic();self.split_edges();self.topology()
  if self.t%12==0:
   names=['p','f','activity','phase','birth','exposure','pin']+(['material_strain'] if hasattr(self,'material_strain') else []);backup={k:getattr(self,k).copy() for k in names};counts=(self.collapse_count,self.flip_count)
   self.collapse_edges();self.topology();self.flip_edges();self.topology()
   if len(intersections(self.p,self.f,np.any(~self.pin[self.f],axis=1))):
    for k,v in backup.items():setattr(self,k,v)
    self.collapse_count,self.flip_count=counts;self.remesh_rollbacks+=1;self.topology()
  self.timings['remesh']+=time.monotonic()-start
 def split_edges(self):
  el=np.linalg.norm(self.p[self.e[:,1]]-self.p[self.e[:,0]],axis=1);chosen=self.e[(el>self.detail*1.45)&(~(self.pin[self.e[:,0]]&self.pin[self.e[:,1]]))]
  t=self.p[self.f];area2=np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1);blocked=set()
  for a,b,c in self.f[area2<self.detail*self.detail*.008]:
   for edge in [(a,b),(b,c),(c,a)]:blocked.add(tuple(sorted(edge)))
  if blocked:chosen=np.array([e for e in chosen if tuple(e) not in blocked],dtype=np.int32).reshape(-1,2)
  if not len(chosen):return
  start=len(self.p);splits={tuple(e):i+start for i,e in enumerate(chosen)}
  self.p=np.concatenate((self.p,self.p[chosen].mean(axis=1)))
  for name in ['activity','phase','birth','exposure']+(['material_strain'] if hasattr(self,'material_strain') else []):
   arr=getattr(self,name);val=arr[chosen].mean(axis=1) if name!='birth' else np.full(len(chosen),self.t)
   setattr(self,name,np.concatenate((arr,val)))
  self.pin=np.concatenate((self.pin,np.all(self.pin[chosen],axis=1)))
  f=[]
  def edge(a,b):return splits.get((min(a,b),max(a,b)))
  for a,b,c in self.f:
   ab,bc,ca=edge(a,b),edge(b,c),edge(c,a);count=sum(v is not None for v in (ab,bc,ca))
   if count==0:f.append([a,b,c])
   elif count==3:f.extend([[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]])
   elif count==1:
    if ab is not None:f.extend([[a,ab,c],[ab,b,c]])
    elif bc is not None:f.extend([[b,bc,a],[bc,c,a]])
    else:f.extend([[c,ca,b],[ca,a,b]])
   else:
    if ab is None:f.extend([[c,ca,bc],[a,b,ca],[b,bc,ca]])
    elif bc is None:f.extend([[a,ab,ca],[b,c,ab],[c,ca,ab]])
    else:f.extend([[b,bc,ab],[c,a,bc],[a,ab,bc]])
  self.f=np.array(f,np.int32);self.split_count+=len(chosen)
 def collapse_edges(self):
  lengths=np.linalg.norm(self.p[self.e[:,1]]-self.p[self.e[:,0]],axis=1);idx=np.argsort(lengths);mapping=np.arange(len(self.p));touched=set()
  for k in idx:
   if lengths[k]>=self.detail*.48:break
   a,b=self.e[k]
   if self.pin[a] or self.pin[b] or a in touched or b in touched:continue
   if len(self.neighbors[a]&self.neighbors[b])!=2:continue
   affected=np.flatnonzero(np.any((self.f==a)|(self.f==b),axis=1));old=self.p[self.f[affected]];mid=(self.p[a]+self.p[b])*.5;new=old.copy();ids=self.f[affected]
   new[(ids==a)|(ids==b)]=mid
   oldn=np.cross(old[:,1]-old[:,0],old[:,2]-old[:,0]);newn=np.cross(new[:,1]-new[:,0],new[:,2]-new[:,0]);survives=~(np.any(ids==a,axis=1)&np.any(ids==b,axis=1))
   if np.any(np.sum(oldn[survives]*newn[survives],axis=1)<=0) or np.any(np.linalg.norm(newn[survives],axis=1)<self.detail*self.detail*.001):continue
   self.p[a]=mid
   for name in ['activity','phase','birth','exposure']+(['material_strain'] if hasattr(self,'material_strain') else []):getattr(self,name)[a]=(getattr(self,name)[a]+getattr(self,name)[b])*.5
   mapping[b]=a;touched.update(self.neighbors[a]|self.neighbors[b]|{a,b});self.collapse_count+=1
  self.f=mapping[self.f];self.f=self.f[(self.f[:,0]!=self.f[:,1])&(self.f[:,1]!=self.f[:,2])&(self.f[:,2]!=self.f[:,0])]
  used=np.unique(self.f);newidx=np.full(len(self.p),-1);newidx[used]=np.arange(len(used));self.f=newidx[self.f]
  for name in ['p','activity','phase','birth','exposure','pin']+(['material_strain'] if hasattr(self,'material_strain') else []):setattr(self,name,getattr(self,name)[used])
 def flip_edges(self):
  edges={};used=set();touched_vertices=set()
  for k,f in enumerate(self.f):
   for a,b,c in [(f[0],f[1],f[2]),(f[1],f[2],f[0]),(f[2],f[0],f[1])]:edges.setdefault((min(a,b),max(a,b)),[]).append((k,a,b,c))
  for key,pair in edges.items():
   if len(pair)!=2:continue
   f,a,b,c=pair[0];g,bb,aa,d=pair[1]
   if f in used or g in used or a!=aa or b!=bb or c==d or d in self.neighbors[c]:continue
   if {a,b,c,d}&touched_vertices:continue
   if self.pin[a] or self.pin[b]:continue
   # Flip only if local triangle quality increases and 3-D orientation is preserved.
   old=self.p[[[a,b,c],[b,a,d]]];new=self.p[[[c,d,b],[d,c,a]]]
   def quality(tri):
    area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
    sq=np.sum((tri[:,1]-tri[:,0])**2,axis=1)+np.sum((tri[:,2]-tri[:,1])**2,axis=1)+np.sum((tri[:,0]-tri[:,2])**2,axis=1)
    return np.min(area/np.maximum(sq,1e-15))
   if quality(new)<quality(old)*1.15:continue
   oldn=np.cross(old[:,1]-old[:,0],old[:,2]-old[:,0]).sum(axis=0);newn=np.cross(new[:,1]-new[:,0],new[:,2]-new[:,0])
   if np.any(newn@oldn<=0):continue
   self.f[f]=[c,d,b];self.f[g]=[d,c,a];used.update([f,g]);touched_vertices.update([a,b,c,d]);self.flip_count+=1
 def save(self,out):
  self.fields();out=Path(out);out.parent.mkdir(parents=True,exist_ok=True)
  d={'p':self.p.tolist(),'f':self.f.tolist(),'activity':self.activity.tolist(),'exposure':self.exposure.tolist(),'phase':self.phase.tolist(),'pin':self.pin.tolist(),'birth':self.birth.tolist(),'frame':self.t,'stats':self.stats()};out.write_text(json.dumps(d,separators=(',',':')))
 def stats(self):
  return {'vertices':len(self.p),'triangles':len(self.f),'bounds':[self.p.min(axis=0).tolist(),self.p.max(axis=0).tolist()],'area':float(np.linalg.norm(self.fn,axis=1).sum()*.5),'splits':self.split_count,'collapses':self.collapse_count,'flips':self.flip_count,'proximity_responses':self.collision_limited,'point_triangle_contacts':self.face_contacts,'intersection_backtracks':self.intersection_backtracks,'remesh_rollbacks':self.remesh_rollbacks,'timings_seconds':self.timings.copy(),'self_collision':'local point-triangle relative-motion clearance plus strict triangle endpoint intersection backtracking on every growth step and remesh, including shared-vertex fans; excludes coplanar contacts; bounds per-step face rotation; not exact swept CCD','exposure':'exact single directional ray to triangles, recomputed every three steps and connectivity blurred'}

def seed_phase(seed):return seed*.173

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--out',required=True);ap.add_argument('--steps',type=int,default=220);ap.add_argument('--colonies',type=int,default=1);ap.add_argument('--detail',type=float,default=.035);ap.add_argument('--rate',type=float,default=.007);ap.add_argument('--period',type=float,default=80);ap.add_argument('--rise',type=int,default=90);ap.add_argument('--roughness',type=float,default=.1);ap.add_argument('--width',type=float,default=.36);ap.add_argument('--curvature-weight',type=float,default=0);ap.add_argument('--normal-passes',type=int,default=4);ap.add_argument('--surface-smooth',type=float,default=.065);ap.add_argument('--turn-fraction',type=float,default=.70);ap.add_argument('--curvature-floor',type=float,default=.10);ap.add_argument('--curvature-scale',type=float,default=.070);ap.add_argument('--curvature-cap',type=float,default=1000);ap.add_argument('--rise-target',type=float,default=.965);ap.add_argument('--rise-width',type=float,default=None);ap.add_argument('--waveform',choices=['ramp','cosine'],default='ramp');ap.add_argument('--phase-strength',type=float,default=0);a=ap.parse_args()
 out=Path(a.out);out.mkdir(parents=True,exist_ok=True);code=Path(__file__).read_bytes();(out/'solver.py').write_bytes(code);(out/'parameters.json').write_text(json.dumps({**vars(a),'seed':17,'solver_sha256':hashlib.sha256(code).hexdigest(),'numpy_version':np.__version__},indent=2))
 collision_source=Path(__file__).with_name('triangle_collision.py').read_bytes();(out/'triangle_collision.py').write_bytes(collision_source)
 m=MeshGrowth(a.detail,colonies=a.colonies,rate=a.rate,period=a.period,rise=a.rise,roughness=a.roughness,width=a.width,curvature_weight=a.curvature_weight,normal_passes=a.normal_passes,surface_smooth=a.surface_smooth,turn_fraction=a.turn_fraction,curvature_floor=a.curvature_floor,curvature_scale=a.curvature_scale,curvature_cap=a.curvature_cap,rise_target=a.rise_target,rise_width=a.rise_width,waveform=a.waveform,phase_strength=a.phase_strength);start=time.monotonic();m.save(f'{a.out}/stage-000.json')
 for i in range(a.steps):
  m.step()
  if m.t%20==0:
   m.save(f'{a.out}/stage-{m.t:03d}.json');print(json.dumps({'iteration':m.t,'seconds':round(time.monotonic()-start,2),**m.stats()}),flush=True)
 if m.t%20:m.save(f'{a.out}/stage-{m.t:03d}.json')
