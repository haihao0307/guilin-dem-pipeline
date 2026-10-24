"""Independent, parameterized kinematic study. No source mesh/animation buffers."""
import numpy as np
PARAMS={'crank_radius':.36842208801725224,'rod_length':3.68143494,'guide_y':-.02862106,'big_outer':.115,'big_bore':.055,'small_outer':.10225,'small_bore':.050,'rod_half_width':.042,'rod_half_thickness':.018,'pin_radius':.046,'slipper_half_length':.17,'slipper_half_height':.030,'guide_offset_y':.287,'guide_half_length':.63,'guide_gap_half':.034}
def pose(theta,p=PARAMS):
 t=np.asarray(theta);r=p['crank_radius'];L=p['rod_length'];h=p['guide_y']
 if r<=0 or L<=0 or L<=abs(h)+r:raise ValueError('mechanism cannot close through full revolution')
 big=np.stack([r*np.sin(t),r*np.cos(t)],-1);dy=h-big[...,0];z=big[...,1]+np.sqrt(L*L-dy*dy)
 small=np.stack([np.full_like(t,h),z],-1)
 return big,small

def box2(q,b):
 d=np.abs(q)-b;return np.linalg.norm(np.maximum(d,0),axis=-1)+np.minimum(np.max(d,axis=-1),0)
def extrude(d,x,half):
 q=np.stack([d,np.abs(x)-half],-1);return np.linalg.norm(np.maximum(q,0),axis=-1)+np.minimum(q.max(-1),0)
def scene(q,theta,p=PARAMS):
 """3-D analytic fields: rod holes, separate bushing and pin, slider, guides.
 Shapes are inferred functional demonstrators, not faithful A4 surface copies.
 Each return value is a component field; no triangles are constructed.
 """
 x=q[:,0];yz=q[:,1:];a,b=pose(theta,p);v=b-a;t=np.clip(((yz-a)*v).sum(-1)/(v@v),0,1)
 capsule=np.linalg.norm(yz-a-t[:,None]*v,axis=-1)-p['rod_half_width'];da=np.linalg.norm(yz-a,axis=-1);db=np.linalg.norm(yz-b,axis=-1)
 rod2=np.minimum(capsule,np.minimum(da-p['big_outer'],db-p['small_outer']))
 rod2=np.maximum(rod2,-np.minimum(da-p['big_bore'],db-p['small_bore']))
 rod=extrude(rod2,x,.018)
 bush=extrude(np.maximum(db-.065,.050-db),x,.025)
 pin=extrude(db-p['pin_radius'],x,.085)
 crankpin=extrude(da-.051,x,.075)
 # Crosshead support and upper slipper share the exact small-end coordinate.
 support=extrude(box2(yz-(b+[.14,0]),[.14,.033]),x-.10,.02)
 slipper=extrude(box2(yz-(b+[p['guide_offset_y'],0]),[p['slipper_half_height'],p['slipper_half_length']]),x-.10,.07)
 guidecentre=np.array([p['guide_y']+p['guide_offset_y'],p['rod_length']])
 g1=extrude(box2(yz-(guidecentre+[.052,0]),[.018,p['guide_half_length']]),x-.10,.075)
 g2=extrude(box2(yz-(guidecentre+[-.052,0]),[.018,p['guide_half_length']]),x-.10,.075)
 piston=extrude(box2(yz-(b+[0,.57]),[.018,.57]),x-.10,.018)
 return np.stack([rod,bush,pin,crankpin,np.minimum(support,slipper),np.minimum(g1,g2),piston],-1)
