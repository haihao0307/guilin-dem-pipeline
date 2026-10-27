"""Independent CPU interpreter of the R31 steam CSG AST. No mesh or sampled geometry.
Compiles the finite analytic routes to scalar callables per beta; only diagnostic
query values are sampled by the separate audit, never used as a replacement model.
"""
import math
import numpy as np
from retained_scalar import mCapsule, mBox, length
PARAMETERS={'cylinderX':[-.82,0,.82], 'axisY':1.016}
def point(p,beta):
 if isinstance(p,list):return np.array(p,float)
 b=beta if p['side']==1 else 0;s=p['station'];r=p.get('r',0)
 return np.array([PARAMETERS['cylinderX'][p['side']]+p['x'],1.016+s*math.sin(b)+r*math.cos(b),s*math.cos(b)-r*math.sin(b)])
def segment_compiled(a,b):
 d=b-a;den=float(d@d)
 def distance(p):return length(p-a-d*float(np.clip((p-a)@d/den,0,1)))
 return distance

def path_compiled(pts,bend):
 corners=[]
 for a,b,c in zip(pts,pts[1:],pts[2:]):
  u=(a-b)/length(a-b);v=(c-b)/length(c-b)
  co=float(np.clip(u@v,-.999999999,.999999999));half=math.acos(co)/2
  t=min(bend/math.tan(half),.35*length(a-b),.35*length(c-b));r=t*math.tan(half)
  center=b+(u+v)/length(u+v)*(t/math.cos(half));start=b+u*t;end=b+v*t
  e=(start-center)/length(start-center);f=end-center-e*((end-center)@e);f=f/length(f)
  angle=math.acos(float(np.clip(((end-center)/length(end-center))@e,-1,1)))
  corners.append({'start':start,'end':end,'center':center,'e':e,'f':f,'r':r,'angle':angle})
 segments=[segment_compiled(pts[0] if i==0 else corners[i-1]['end'],pts[-1] if i==len(pts)-2 else corners[i]['start']) for i in range(len(pts)-1)]
 def distance(p):
  d=min(f(p) for f in segments)
  for c in corners:
   q=p-c['center'];angle=float(np.clip(math.atan2(q@c['f'],q@c['e']),0,c['angle']))
   nearest=c['r']*(c['e']*math.cos(angle)+c['f']*math.sin(angle));d=min(d,length(q-nearest))
  return d
 return distance,corners

def compile_node(n,beta):
 op=n['op']
 if op=='hexY':
  c=np.array(n['c'])
  def hexY(p):
   q=p-c;return max(*[abs(q[0]*math.cos(a)+q[2]*math.sin(a))-n['apothem'] for a in [0,math.pi/3,2*math.pi/3]],n['lo']-p[1],p[1]-n['hi'])
  return hexY
 if op=='box':
  c=np.array(n['c']);h=np.array(n['h']);return lambda p:mBox(p,c,h)
 if op in ['capsule','cylinder']:
  a=point(n['a'],beta);b=point(n['b'],beta);d=b-a;l=length(d);u=d/l;r=n['r']
  if op=='capsule':f=segment_compiled(a,b);return lambda p:f(p)-r
  def cylinder(p):
   q=p-a;t=q@u;return max(length(q-u*t)-r,-t,t-l)
  return cylinder
 if op in ['path','tube']:
  pts=[point(p,beta) for p in n['points']];f,corners=path_compiled(pts,n['bend'])
  if op=='path':return lambda p:f(p)-n['r']
  u=(pts[1]-pts[0])/length(pts[1]-pts[0]);v=(pts[-1]-pts[-2])/length(pts[-1]-pts[-2])
  def tube(p):
   d=f(p);return max(d-n['ro'],n['ri']-d,-((p-pts[0])@u),(p-pts[-1])@v)
  return tube
 if op=='lens':
  c=np.array(n['c'])
  def lens(p):
   q=p-c;return min(n['radial'],n['half'])*(math.hypot((length(q[[0,2]])-n['major'])/n['radial'],q[1]/n['half'])-1)
  return lens
 if op=='union':
  fs=[compile_node(x,beta) for x in n['nodes']];return lambda p:min(f(p) for f in fs)
 if op=='subtract':
  a=compile_node(n['a'],beta);b=compile_node(n['b'],beta);return lambda p:max(a(p),-b(p))
 raise ValueError(op)
