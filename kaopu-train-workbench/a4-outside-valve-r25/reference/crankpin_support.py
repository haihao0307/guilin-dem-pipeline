"""Own inferred wheel-hub-to-crankpin support web, not measured A4 casting.
Adds missing load path; retained wheel and crank functions are unchanged.
"""
import numpy as np
from driving_crank_assembly import pose
CONFIG={'axle_z':[2.2098,0,-2.2098],'axis_y':1.016,'inner_abs_x':.695,'outer_abs_x':.790,'web_radius':.11,'shaft_clearance_radius':.102,'main_pin_radius':.06985,'coupling_pin_radius':.04,'status':'inferred functional support candidate, not historical casting profile'}
def fields(points,theta):
 p=np.atleast_2d(points).astype(float);out={};c=CONFIG
 for side,name in [(0,'left'),(2,'right')]:
  sign=-1 if side==0 else 1;b,_=pose(theta,side)
  for k,z in enumerate(c['axle_z']):
   root=np.array([c['axis_y'],z]);pin=b+[0,z];v=pin-root;q=p[:,1:]-root;t=np.clip(q@v/(v@v),0,1);radial=np.linalg.norm(q-t[:,None]*v,axis=1)-c['web_radius'];x=sign*(c['inner_abs_x']+c['outer_abs_x'])/2;half=(c['outer_abs_x']-c['inner_abs_x'])/2;body=np.maximum(radial,abs(p[:,0]-x)-half)
   pin_r=c['main_pin_radius']if k==1 else c['coupling_pin_radius'];hole=np.linalg.norm(p[:,1:]-pin,axis=1)-pin_r;shaft=np.linalg.norm(q,axis=1)-c['shaft_clearance_radius'];out[f'{name}_D{k+1}_crankpin_support']=np.maximum(body,-np.minimum(hole,shaft))
 return out
