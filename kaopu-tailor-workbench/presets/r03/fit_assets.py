"""Derive garment fit measurements; no mannequin vertices are modified."""
from pathlib import Path
import json,gzip,os
import numpy as np
P=Path(__file__).resolve().parent
I=Path(os.environ['R03_INTAKE'])
b=json.loads((P/'mannequin.json').read_text())
r=json.loads(gzip.decompress((I/'original-anny-rig.json.gz').read_bytes()))
v=np.array(b['positions']).reshape(-1,3);f=np.array(b['indices']).reshape(-1,3)
w=np.array(r['vertexBoneWeights']).reshape(-1,9);bi=np.array(r['vertexBoneIndices']).reshape(-1,9)
labels=r['boneLabels'];parents=r['boneParents']
def children(root):
 s={root}
 while True:
  n=s|{i for i,p in enumerate(parents) if p in s}
  if n==s:return sorted(s)
  s=n
aw=[]
for side in ['L','R']:aw.append(np.sum(w*np.isin(bi,children(labels.index('upperarm01.'+side))),axis=1))
arm=np.maximum(*aw);tr=v[f];lo=tr[:,:,1].min(1);hi=tr[:,:,1].max(1);fw=arm[f].mean(1)
def hull(points):
 p=sorted(set(map(tuple,np.round(points,7))))
 if len(p)<3:raise ValueError('Insufficient section points')
 def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
 halves=[]
 for pts in [p,p[::-1]]:
  h=[]
  for point in pts:
   while len(h)>=2 and cross(h[-2],h[-1],point)<=0:h.pop()
   h.append(point)
  halves.append(h[:-1])
 return np.array(halves[0]+halves[1])
def section(y):
 a=tr[(lo<=y)&(hi>=y)&(fw<.1)];out=[]
 for j,k in [(0,1),(1,2),(2,0)]:
  p=a[:,j];q=a[:,k];dy=q[:,1]-p[:,1]
  ok=(np.minimum(p[:,1],q[:,1])<=y)&(np.maximum(p[:,1],q[:,1])>=y)&(np.abs(dy)>1e-9)
  t=(y-p[ok,1])/dy[ok];out.extend((p[ok]+(q[ok]-p[ok])*t[:,None])[:,[0,2]])
 return np.array(out)
def radius(h,c,angles):
 pts=h-np.array(c);result=[]
 for theta in angles:
  d=np.array([np.sin(theta),np.cos(theta)]);hits=[]
  for a,z in zip(pts,np.roll(pts,-1,axis=0)):
   e=z-a;den=d[0]*e[1]-d[1]*e[0]
   if abs(den)<1e-12:continue
   t=(a[0]*e[1]-a[1]*e[0])/den;u=(a[0]*d[1]-a[1]*d[0])/den
   if t>=0 and -.00001<=u<=1.00001:hits.append(t)
  result.append(max(hits) if hits else 0.)
 return result
N=96;angles=np.arange(N)*2*np.pi/N;profiles={}
for name,ys in [('torso',np.linspace(.68,1.58,91)),('leg',np.linspace(.075,1.105,104))]:
 values=[];centres=[]
 for y in ys:
  pts=section(y)
  if name=='leg':
   pts=pts[pts[:,0]>=-.00001];anchors=np.array(b['anchors']['legL']);idx=0 if y>anchors[1,1] else 1
   a,z=anchors[idx],anchors[idx+1];t=np.clip((a[1]-y)/(a[1]-z[1]),0,1);c=(a+(z-a)*t)[[0,2]]
  else:c=[0.,.02]
  h=hull(pts);rr=radius(h,c,angles)
  if min(rr)<=0:raise ValueError((name,y,'invalid ray envelope',min(rr)))
  values.append(rr);centres.append(c)
 rr=np.array(values)
 for _ in range(2):
  padded=np.pad(rr,((1,1),(0,0)),mode='edge');rr=(padded[:-2]+2*padded[1:-1]+padded[2:])/4
  rr=(np.roll(rr,1,axis=1)+6*rr+np.roll(rr,-1,axis=1))/8
 rr=np.maximum(rr,np.array(values)-.0004)+.003
 profiles[name]={'minY':float(ys[0]),'stepY':float(ys[1]-ys[0]),'countY':len(ys),'countA':N,'radii':np.round(rr,6).ravel().tolist(),'centres':np.round(centres,6).tolist()}
b['fitProfiles']=profiles;b['armWeights']=np.round(np.stack(aw,axis=1),5).ravel().tolist()
(P/'mannequin.json').write_text(json.dumps(b,separators=(',',':')))
(P/'FIT_PROFILE_REPORT.json').write_text(json.dumps({'method':'actual original anatomical triangle-plane intersections and convex radial fit envelopes','mannequinChanged':False,'sourceVertexCount':len(v),'sourceTriangles':len(f),'angularSamples':N,'torsoSections':91,'legSections':104,'clothEaseIncluded':False,'physicalFitAccepted':False},indent=2))
print('FIT_PROFILES',len(v),len(f),91,104,N,flush=True)
