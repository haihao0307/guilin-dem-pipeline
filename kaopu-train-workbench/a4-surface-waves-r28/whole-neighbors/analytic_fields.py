"""Read-only exact retained scalar-expression evaluation, no mesh/raster model.
Primitive translations follow r27 sources.json; named one-line expressions are
read verbatim from that source and evaluated with NumPy vectors. Polygon frame
is its exact retained closed polygon signed distance and three rounded holes.
"""
from pathlib import Path
import json,re,math
import numpy as np
HERE=Path(__file__).resolve().parent
SOURCES=json.load(open(HERE/'sources.json'))
PARTS={p['id']:p for p in json.load(open(HERE/'parts.json'))}
def vec2(*x): return np.array(x if len(x)>1 else [x[0]]*2,dtype=float)
def vec3(*x): return np.array(x if len(x)>1 else [x[0]]*3,dtype=float)
def length(x): return float(np.linalg.norm(x))
def mInterval(z,lo,hi): return max(lo-z,z-hi) if hi>lo else 1e6
def mLocal(p,s,c): return vec3(p[0],c*p[1]-s*p[2],s*p[1]+c*p[2])
def mCylZ(p,r,lo,hi): return max(length(p[:2])-r,mInterval(p[2],lo,hi))
def mAnnulusZ(p,ri,ro,lo,hi):
 rr=length(p[:2]);return max(ri-rr,rr-ro,mInterval(p[2],lo,hi))
def mCylY(p,r,lo,hi,z): return max(length(p[[0,2]]-vec2(0,z))-r,mInterval(p[1],lo,hi))
def mCapsule(p,a,b,r):
 d=b-a;den=float(d@d)
 if den<=1e-20:return length(p-a)-r
 t=float(np.clip((p-a)@d/den,0,1));return length(p-a-d*t)-r
def mBoxInf(p,c,h): return float(np.max(np.abs(p-c)-h))
def mDisc(p,c,axis,r,h):
 q=p-c;return max(length(np.delete(q,axis))-r,abs(q[axis])-h)
def mFlatRod(p,a,b,axis,extra,hasExtra,width,eye,bore,halfThickness):
 q=p.copy();q[axis]=a[axis];axial=abs(p[axis]-a[axis])-halfThickness
 body=min(mCapsule(q,a,b,width),length(q-a)-eye,length(q-b)-eye)
 holes=min(length(q-a)-bore,length(q-b)-bore)
 if hasExtra:body=min(body,length(q-extra)-eye);holes=min(holes,length(q-extra)-bore)
 return max(body,-holes,axial)
def stackRingY(p,c,lo,hi,ri,ro):
 rr=length(p[[0,2]]-c);radial=rr-ro
 if ri>0:radial=max(radial,ri-rr)
 return max(radial,lo-p[1],p[1]-hi)
def mPVWindow(p,z):
 ann=mAnnulusZ(p,.1133,.1273,z-.020,z+.020)
 if length(p[:2])<.09:return ann
 period=2*math.pi/8;angle=math.atan2(p[1],p[0]);err=(angle+period*.5)%period-period*.5
 return max(ann,(abs(err)-.21)*.1143)
def mPV(p,q,rearSpindle,frontSpindle,part):
 r=.1143;rl=.1263;rg=.1513;ro=.1693;H=.43
 wr=mPVWindow(p,-.22);wf=mPVWindow(p,.22)
 cr=mAnnulusZ(p,rl-.001,rg,-.252,-.188);cf=mAnnulusZ(p,rl-.001,rg,.188,.252)
 lr=mCylY(p,.018,-.215,-rl,-.22);lf=mCylY(p,.018,-.215,-rl,.22)
 supply=mCylY(p,.026,0,.215,0);er=mCylY(p,.020,0,.215,-.385);ef=mCylY(p,.020,0,.215,.385)
 workr=min(wr,cr,lr);workf=min(wf,cf,lf);holes=min(supply,er,ef,workr,workf);mainholes=min(supply,er,ef,wr,wf)
 if part==0:return max(mAnnulusZ(p,rl,ro,-H,H),-holes)
 if part==1:return max(mAnnulusZ(p,r,rl,-H,H),-mainholes)
 if part==2:return mAnnulusZ(p,.026,ro,-.452,-.43)
 if part==3:return mAnnulusZ(p,.026,ro,.43,.452)
 if part==4:return mAnnulusZ(p,.016,.026,-.452,-.43)
 if part==5:return mAnnulusZ(p,.016,.026,.43,.452)
 if part==6:return mCylZ(p,.100,-.24+q,-.16+q)
 if part==7:return mCylZ(p,.100,.16+q,.24+q)
 if part==8:return mAnnulusZ(p,.100,r,-.24+q,-.16+q)
 if part==9:return mAnnulusZ(p,.100,r,.16+q,.24+q)
 if part==10:return mCylZ(p,.016,rearSpindle,frontSpindle)
 allvoid=min(mCylZ(p,r,-H,H),holes)
 if part==11:return max(mCylY(p,.038,0,.215,0),-allvoid)
 if part==12:return max(mCylY(p,.032,0,.215,-.385),-allvoid)
 if part==13:return max(mCylY(p,.032,0,.215,.385),-allvoid)
 if part==14:return max(mCylY(p,.030,-.215,-rl,-.22),-allvoid)
 return max(mCylY(p,.030,-.215,-rl,.22),-allvoid)
def roundBox2(p,h,r):
 q=np.abs(p)-(h-r);return length(np.maximum(q,0))+min(float(np.max(q)),0)-r
node0=re.search(r'float support_node_0\(vec3 p\)\{([^\n]+)\}',SOURCES['support'])[1]
VERTICES=[np.array([float(v.replace('(','').replace(')','')) for v in m.split(',')]) for m in re.findall(r'\{vec2 a=vec2\((.*?)\),b=',node0)]
assert len(VERTICES)==10
# The left/right frame uses the same polygon and three wheel-journal cutouts.
def frame_plate(p,side):
 q=p[[1,2]];dist=1e30;inside=False
 for i,a in enumerate(VERTICES):
  b=VERTICES[(i+1)%len(VERTICES)];e=b-a;t=float(np.clip((q-a)@e/(e@e),0,1));dist=min(dist,length(q-a-t*e))
  hit=(a[1]>q[1])!=(b[1]>q[1]);crossing=(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1]+1e-30)+a[0]
  if hit and q[0]<crossing:inside=not inside
 d=max(-dist if inside else dist,abs(p[0]-side*.54)-.015)
 return max(d,*[-roundBox2(q-vec2(.83,z),vec2(.49,.23),.04) for z in [2.2098,0,-2.2098]])
EXPRS={}
for part in PARTS.values():
 src=SOURCES[part['source']];f=part['glsl_function'];m=re.search(r'float '+f+r'\(vec3 p\)\s*\{ return (.*?); \}',src)
 if m:
  expr=m[1].replace('true','True').replace('false','False').replace('p.xz','p[[0,2]]')
  EXPRS[part['id']]=compile(expr,'retained:'+f,'eval')
def scalar(id,p):
 p=np.asarray(p,float)
 if id.startswith('frame/frame_plate_'):return frame_plate(p,-1 if id.endswith('left') else 1)
 return float(eval(EXPRS[id],globals(),{'p':p}))
def transformed_scalar(id,p,frame):
 f=frame['parts'][id];return scalar(id,np.array(f['inverseRows'])@p+f['inverseOffset'])
