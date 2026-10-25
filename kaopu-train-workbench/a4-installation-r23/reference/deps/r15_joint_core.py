"""Own analytic functional joint, inferred dimensions. Not as-built A4 CAD."""
import numpy as np
def extrude(d,x,half):
 q=np.stack([d,np.abs(x)-half],-1);return np.linalg.norm(np.maximum(q,0),axis=-1)+np.minimum(q.max(-1),0)
J={'bore':.050,'pin_r':.046,'bush_outer':.065,'bush_half_x':.025,'cheek_x':.070,'cheek_half_x':.025,'cheek_r':.105,'oil_r':.004,'cotter_r':.003,'cotter_x':.147,'nut_start':.104,'nut_end':.154}
NAMES=['rod','bush','pin','crosshead','washer','nut','cotter','oilbox','slipper','guide','piston_rod','crankpin']
def cyl_x(q,x0,x1,r):return extrude(np.linalg.norm(q[:,1:],axis=1)-r,q[:,0]-(x0+x1)/2,(x1-x0)/2)
def box(q,c,h):
 d=np.abs(q-c)-h;return np.linalg.norm(np.maximum(d,0),axis=1)+np.minimum(d.max(1),0)
def capsule(q,a,b,r):
 a=np.array(a);v=np.array(b)-a;t=np.clip(((q-a)*v).sum(1)/(v@v),0,1);return np.linalg.norm(q-a-t[:,None]*v,axis=1)-r
OIL_POINTS=np.array([[.07,.15,0],[.07,0,0],[0,0,0],[0,.049,0]])
def oil_field(q):return np.minimum.reduce([capsule(q,a,b,J['oil_r']) for a,b in zip(OIL_POINTS[:-1],OIL_POINTS[1:])])
def nut_field(q):
 # Hexagonal nut body and three crossing castellations. Thread is simplified.
 radial=np.max(np.stack([q[:,1]*np.cos(a)+q[:,2]*np.sin(a) for a in np.arange(6)*np.pi/3],-1),-1)-.066
 d=extrude(radial,q[:,0]-.129,.025);d=np.maximum(d,-cyl_x(q,.09,.17,.0355))
 slot=np.full(len(q),np.inf)
 for a in np.pi/2+np.arange(3)*np.pi/3:
  u=q[:,1]*np.cos(a)+q[:,2]*np.sin(a)
  slot=np.minimum(slot,np.maximum(np.abs(u)-.005,np.maximum(.139-q[:,0],q[:,0]-.17)))
 return np.maximum(d,-slot)
def joint_fields(q):
 """Local origin is small-end axis; X is pin axis, Y vertical, Z piston axis."""
 x=q[:,0];rad=np.linalg.norm(q[:,1:],axis=1)
 bush=np.maximum(cyl_x(q,-.025,.025,.065),-cyl_x(q,-.04,.04,.05))
 # main journal, conical seat, reduced threaded end (thread not cut).
 pin=np.minimum(cyl_x(q,-.115,.095,.046),cyl_x(q,.095,.174,.035))
 cone=np.maximum(rad-(.046+np.clip((x-.045)/.05,0,1)*.014),np.maximum(.045-x,x-.095));pin=np.minimum(pin,cone)
 cheek=np.minimum(cyl_x(q,-.095,-.045,.105),cyl_x(q,.045,.095,.105));cheek=np.maximum(cheek,-np.minimum(cyl_x(q,-.13,.13,.046),cone))
 bridge=box(q,[0,.15,0],[.095,.030,.045]);cross=np.minimum(cheek,bridge)
 washer=np.maximum(cyl_x(q,.095,.104,.071),-cyl_x(q,.09,.12,.036))
 nut=nut_field(q)
 hole=capsule(q,[J['cotter_x'],-.09,0],[J['cotter_x'],.09,0],.004)
 cotter=capsule(q,[J['cotter_x'],-.078,0],[J['cotter_x'],.078,0],J['cotter_r'])
 cotter=np.minimum(cotter,np.minimum(capsule(q,[J['cotter_x'],.074,0],[J['cotter_x']+.013,.088,.009],.002),capsule(q,[J['cotter_x'],.074,0],[J['cotter_x']-.013,.088,-.009],.002)))
 pin=np.maximum(pin,-hole)
 oil=oil_field(q);pin=np.maximum(pin,-oil);cross=np.maximum(cross,-oil)
 # oil cup is a functional receptacle at inferred location, not exact original shape.
 cup=box(q,[.07,.15,0],[.025,.018,.025]);cup=np.maximum(cup,-box(q,[.07,.16,0],[.018,.026,.018]));cup=np.maximum(cup,-oil)
 return np.stack([bush,pin,cross,washer,nut,cotter,cup],-1)