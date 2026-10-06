"""Immutable plane-clipped canonical neck from licensed, neutral source teachers.
Keeps source-index/edge interpolation recipes so every shape uses identical topology.
"""
from pathlib import Path
import json,numpy as np,hashlib
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
R=Path(__file__).resolve().parents[1]
a=json.loads((R/'research/anny-neutral.json').read_text());g=json.loads((R/'research/gnm-neutral.json').read_text())
av=np.array(a['vertices']).reshape(-1,3);af=np.array(a['faces']).reshape(-1,3);gv=np.array(g['vertices']).reshape(-1,3);gf=np.array(g['faces']).reshape(-1,3)
transform={'scale':1.,'translation':[0.,-.016,.445],'matrix':[[1,0,0],[0,0,-1],[0,1,0]]}
def world(v):return v@np.array(transform['matrix']).T+transform['translation']
def clip(vertices,faces,axis,cut,keepBelow):
 recipes=[[i,i,0.] for i in range(len(vertices))];coords=list(vertices);intersections={};output=[]
 def inside(i):return vertices[i,axis]<=cut if keepBelow else vertices[i,axis]>=cut
 def edge(i,j):
  i,j=sorted((int(i),int(j)));key=(i,j)
  if key not in intersections:
   t=float((cut-vertices[i,axis])/(vertices[j,axis]-vertices[i,axis]));intersections[key]=len(recipes);recipes.append([i,j,t]);coords.append(vertices[i]*(1-t)+vertices[j]*t)
  return intersections[key]
 for face in faces:
  polygon=[]
  for i,j in zip(face,np.roll(face,-1)):
   if inside(i):polygon.append(int(i))
   if inside(i)!=inside(j):polygon.append(edge(i,j))
  for k in range(1,len(polygon)-1):output.append([polygon[0],polygon[k],polygon[k+1]])
 output=np.array(output);keep=np.unique(output);mapping=np.full(len(recipes),-1);mapping[keep]=np.arange(len(keep))
 return np.array(coords)[keep],mapping[output],[recipes[i] for i in keep]
def boundaries(faces):
 edges={}
 for face in faces:
  for u,v in zip(face,np.roll(face,-1)):edges.setdefault(tuple(sorted((int(u),int(v)))),[]).append((int(u),int(v)))
 nxt={e[0][0]:e[0][1] for e in edges.values() if len(e)==1};loops=[]
 while nxt:
  start=next(iter(nxt));p=start;ring=[]
  while p in nxt:ring.append(p);p=nxt.pop(p)
  if p!=start:raise RuntimeError('Open boundary chain')
  loops.append(ring)
 return loops,edges
bv,bf,br=clip(av,af,2,.611,True);hv,hf,hr=clip(gv,gf,1,.172,False);hw=world(hv)
al,_=boundaries(bf);gl,_=boundaries(hf);ar=max(al,key=lambda l:np.mean(bv[l,2]));gr=min(gl,key=lambda l:np.mean(hw[l,2]));gr=[i+len(bv) for i in gr];hf=hf+len(bv);verts=np.concatenate([bv,hw]);center=(verts[ar].mean(0)+verts[gr].mean(0))/2

def ordered(ring):
 ring=list(ring);p=verts[ring,:2];area=np.sum(p[:,0]*np.roll(p[:,1],-1)-p[:,1]*np.roll(p[:,0],-1))
 if area<0:ring.reverse()
 angles=np.arctan2(verts[ring,1]-center[1],verts[ring,0]-center[0]);start=int(np.argmin(angles));ring=ring[start:]+ring[:start]
 lengths=np.linalg.norm(verts[ring]-verts[ring[1:]+ring[:1]],axis=1);cum=np.concatenate([[0],np.cumsum(lengths)]);return ring,cum[:-1]/cum[-1]
aord,aa=ordered(ar);gord,ga=ordered(gr);i=j=0;bridge=[]
while i<len(aord) or j<len(gord):
 A=aord[i%len(aord)];G=gord[j%len(gord)];na=(aa[(i+1)%len(aa)]+(1 if i+1>=len(aa) else 0)) if i<len(aord) else np.inf;ng=(ga[(j+1)%len(ga)]+(1 if j+1>=len(ga) else 0)) if j<len(gord) else np.inf
 if na<ng:bridge.append([A,aord[(i+1)%len(aord)],G]);i+=1
 else:bridge.append([A,gord[(j+1)%len(gord)],G]);j+=1
_,existing=boundaries(np.concatenate([bf,hf]));oriented=[]
for _ in range(len(bridge)+1):
 progress=False
 for k,face in enumerate(bridge):
  if face is None:continue
  for u,v in zip(face,np.roll(face,-1)):
   key=tuple(sorted((int(u),int(v))))
   if key in existing and len(existing[key])==1:
    if existing[key][0]==(int(u),int(v)):face=list(reversed(face))
    for x,y in zip(face,np.roll(face,-1)):existing.setdefault(tuple(sorted((int(x),int(y)))),[]).append((int(x),int(y)))
    bridge[k]=None;oriented.append(face);progress=True;break
 if not progress:break
assert all(f is None for f in bridge)
faces=np.concatenate([bf,hf,np.array(oriented)]);loops,edges=boundaries(faces)
seamEdges={tuple(sorted((u,v))) for ring in [ar,gr] for u,v in zip(ring,ring[1:]+ring[:1])}
assert all(len(edges[e])==2 for e in seamEdges);assert all(len(e)<=2 for e in edges.values());assert all(e[0]==e[1][::-1] for e in edges.values() if len(e)==2)
region=np.flatnonzero(av[:,2]>.575);nearest=region[cKDTree(av[region]).query(hw)[1]];weights=np.array(a['weights']).reshape(len(av),a['influences']);indices=np.array(a['indices']).reshape(len(av),a['influences']);hb=a['bones'].index('head');wi=[];bi=[]
for n,p in zip(nearest,hv):
 t=float(np.clip((p[1]-.18)/.055,0,1));t=t*t*(3-2*t);d={int(b):float(x*(1-t)) for b,x in zip(indices[n],weights[n]) if x>0};d[hb]=d.get(hb,0)+t;val=[(b,x) for b,x in d.items() if x>1e-10];bi.append([b for b,x in val]);wi.append([x for b,x in val])
# Official facial-region and anatomy labels outrank a coordinate-height mask.
# Protect all labeled face points and every eye/teeth/gum/tongue component.
regions=np.array(g['regionId']);components=np.array(g['componentId'])
protected=np.array([regions[int(a)]<20 or regions[int(b)]<20 or components[int(a)]!=0 or components[int(b)]!=0 for a,b,t in hr])
for i,protect in enumerate(protected):
 if protect:bi[i]=[hb];wi[i]=[1.]
# Intrinsic distances prevent reaching disconnected oral/eye surfaces. Distances
# to protected face form a smooth zero-correction guard around facial landmarks.
localhf=hf-len(bv);edgesH=set()
for face in localhf:
 for a0,b0 in zip(face,np.roll(face,-1)):edgesH.add(tuple(sorted((int(a0),int(b0)))))
rr=[];cc=[];dd=[]
for a0,b0 in edgesH:
 length=float(np.linalg.norm(hv[a0]-hv[b0]));rr.extend([a0,b0]);cc.extend([b0,a0]);dd.extend([length,length])
graph=coo_matrix((dd,(rr,cc)),shape=(len(hv),len(hv))).tocsr()
dRing=dijkstra(graph,directed=False,indices=np.array(gr)-len(bv),min_only=True)
dProtected=dijkstra(graph,directed=False,indices=np.flatnonzero(protected),min_only=True)
def smooth01(x):
 x=float(np.clip(x,0,1));return x*x*(3-2*x)
# One explicit two-joint canonical neck attachment. Geodesic interpolation
# avoids discontinuous nearest-vertex skin-weight switches between neck bones.
headAnchors=protected|(hv[:,1]>=.240)
dHead=dijkstra(graph,directed=False,indices=np.flatnonzero(headAnchors),min_only=True)
neckBone=a['bones'].index('neck02')
for vi in range(len(hv)):
 if headAnchors[vi] or not np.isfinite(dRing[vi]):t=1.
 else:t=smooth01(dRing[vi]/max(dRing[vi]+dHead[vi],1e-12))
 if t>=1-1e-12:bi[vi]=[hb];wi[vi]=[1.]
 elif t<=1e-12:bi[vi]=[neckBone];wi[vi]=[1.]
 else:bi[vi]=[neckBone,hb];wi[vi]=[1-t,t]
headNeckWeight=np.array([0. if protected[i] else smooth01(1-dRing[i]/.07)*smooth01(dProtected[i]/.02) for i in range(len(hv))])
report={'bodyVertices':len(bv),'headVertices':len(hv),'vertices':len(verts),'bodyFaces':len(bf),'headFaces':len(hf),'seamFaces':len(oriented),'faces':len(faces),'bodyRingVertices':len(ar),'headRingVertices':len(gr),'allNeckEdgesManifold':True,'allInternalEdgesOppositeWinding':True,'remainingBoundaryLoops':[len(l) for l in loops],'headTransform':transform,'bodyCutZ':.611,'headCutY':.172,'referenceAnnyPhenotypes':{'age':2/3},'clipping':'Exact plane/edge barycentric interpolation; fixed at build time','otherBoundaryNote':'Remaining boundaries inherited from original eye/teeth/tongue anatomy; no open neck.'}
result={'schema':'kaopu-unified-canonical/2','annyRecipes':br,'gnmRecipes':hr,'faces':faces.reshape(-1).tolist(),'bodyRing':ar,'headRing':gr,'referenceBodyHeads':a['heads'],'headTransform':transform,'referenceAnnyPhenotypes':{'age':2/3},'headSkinIndices':bi,'headSkinWeights':wi,'protectedHeadIndices':np.flatnonzero(protected).tolist(),'report':report,'topologySha256':hashlib.sha256(faces.astype('<u4').tobytes()).hexdigest()}
# Fixed circumferential correspondence makes both seam contours agree in
# radius. Only the neck transition is corrected, never the facial identity.
center2=(verts[ar,:2].mean(0)+verts[gr,:2].mean(0))/2

def angle_links(points,ring):
 angles=np.arctan2(verts[ring,1]-center2[1],verts[ring,0]-center2[0]);order=np.argsort(angles);ri=np.array(ring)[order];angles=angles[order];result=[]
 for p in points:
  t=np.arctan2(p[1]-center2[1],p[0]-center2[0]);j=int(np.searchsorted(angles,t))%len(angles);i=(j-1)%len(angles);a0=angles[i];a1=angles[j]
  if j==0:a1+=2*np.pi
  if t<a0:t+=2*np.pi
  alpha=float((t-a0)/(a1-a0));result.append([int(ri[i]),int(ri[j]),alpha])
 return result
ringTargets=angle_links(verts[gr],ar);headLinks=[]
ringLinks=angle_links(hw,gr)
for vi,(p,link) in enumerate(zip(hv,ringLinks)):
 w=float(headNeckWeight[vi])
 if w>0:headLinks.append([vi,*link,w])
result['neckContour']={'headRing':gr,'targets':ringTargets,'headLinks':headLinks,'gapMetres':.006,'note':'Frozen azimuth correspondence within 70mm geodesic distance from neck ring, zero on all official facial/oral/eye labels and smooth protected-face guard.'}
# Small, explicitly bounded canonical neck fairing band. Surface outside the
# neck stays exactly teacher-evaluated. Frozen mask avoids live topology edits.
adj=[set() for _ in verts]
for face in faces:
 for u,v in zip(face,np.roll(face,-1)):adj[u].add(int(v));adj[v].add(int(u))
band=[]
for vi,p in enumerate(verts):
 t=(p[2]-.580)/(.660-.580)
 if 0<t<1:
  weight=float(np.sin(t*np.pi)**2)*(float(headNeckWeight[vi-len(bv)]) if vi>=len(bv) else 1.)
  if weight>0:band.append({'index':vi,'weight':weight,'neighbors':sorted(adj[vi])})
result['neckFairing']={'iterations':10,'lambda':.5,'mu':-.53,'band':band,'note':'Taubin fairing restricted to fixed 80mm neck band; original teachers remain untouched.'}
(R/'assets/canonical.json').write_text(json.dumps(result,separators=(',',':')));(R/'research/seam-build-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
