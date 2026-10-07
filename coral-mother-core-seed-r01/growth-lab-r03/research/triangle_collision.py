"""Full-mesh broadphase plus vectorized strict triangle intersection queries.
Endpoint geometry check; coplanar contacts are omitted. Shared-vertex pairs are
tested too: strict barycentric/segment interiors reject their ordinary contact,
but can still detect a triangle fan crossing itself away from the shared vertex.
"""
import numpy as np
from scipy.spatial import cKDTree

def intersections(points, faces, active_faces=None):
 tri=points[faces];cent=tri.mean(axis=1);radius=np.linalg.norm(tri-cent[:,None,:],axis=2).max(axis=1)
 if active_faces is None:
  pairs=cKDTree(cent).query_pairs(float(radius.max()*2)+1e-9,output_type='ndarray')
 else:
  active=np.flatnonzero(active_faces);fixed=np.flatnonzero(~active_faces)
  if not len(active):return np.empty((0,2),int)
  local=cKDTree(cent[active]).query_pairs(float(radius[active].max()*2)+1e-9,output_type='ndarray');pairs=active[local]
  if len(fixed):
   lo=tri[fixed].min(axis=(0,1));hi=tri[fixed].max(axis=(0,1));gap=np.maximum(np.maximum(lo-cent[active],cent[active]-hi),0);near=active[np.linalg.norm(gap,axis=1)<=radius[active]+1e-9]
   if len(near):
    candidates=cKDTree(cent[fixed]).query_ball_point(cent[near],radius[near]+radius[fixed].max()+1e-9)
    extra=[(int(a),int(fixed[b])) for a,ids in zip(near,candidates) for b in ids]
    if extra:pairs=np.concatenate((pairs,np.array(extra)))
 if not len(pairs):return pairs
 i,j=pairs.T;keep=np.linalg.norm(cent[i]-cent[j],axis=1)<=radius[i]+radius[j]+1e-9;pairs=pairs[keep]
 i,j=pairs.T;lo=tri.min(axis=1);hi=tri.max(axis=1);keep=np.all(hi[i]>=lo[j]-1e-10,axis=1)&np.all(hi[j]>=lo[i]-1e-10,axis=1)
 pairs=pairs[keep]
 if not len(pairs):return pairs
 a,b=tri[pairs[:,0]],tri[pairs[:,1]];hit=np.zeros(len(pairs),bool)
 for source,target in [(a,b),(b,a)]:
  e1=target[:,1]-target[:,0];e2=target[:,2]-target[:,0]
  for k in range(3):
   o=source[:,k];direction=source[:,(k+1)%3]-o;h=np.cross(direction,e2);det=np.sum(e1*h,axis=1);valid=np.abs(det)>1e-13
   inv=np.divide(1,det,out=np.zeros_like(det),where=valid);s=o-target[:,0];u=inv*np.sum(s*h,axis=1);q=np.cross(s,e1);v=inv*np.sum(direction*q,axis=1);t=inv*np.sum(e2*q,axis=1)
   hit|=valid&(u>1e-7)&(v>1e-7)&(u+v<1-1e-7)&(t>1e-7)&(t<1-1e-7)
 return pairs[hit]

if __name__=='__main__':
 import sys,json,time
 d=json.load(open(sys.argv[1]));start=time.monotonic();pairs=intersections(np.array(d['p']),np.array(d['f']));print(json.dumps({'pairs':pairs.tolist(),'count':len(pairs),'seconds':time.monotonic()-start}))
