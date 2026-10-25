"""Standalone exact replay of old articulated-joint and guide failures."""
from pathlib import Path
import json,re
import numpy as np
H=Path(__file__).resolve().parent;D=json.load(open(H/'WITNESS_INPUTS.json'))
def vec2(*x):return np.array(x if len(x)>1 else [x[0]]*2,float)
def vec3(*x):return np.array(x if len(x)>1 else [x[0]]*3,float)
def length(p):return float(np.linalg.norm(p))
def mCapsule(p,a,b,r):
 d=b-a;t=float(np.clip((p-a)@d/(d@d),0,1));return length(p-a-t*d)-r
def mBoxInf(p,c,h):return float(np.max(np.abs(p-c)-h))
def mDisc(p,c,axis,r,h):
 q=p-c;return max(length(np.delete(q,axis))-r,abs(q[axis])-h)
def mFlatRod(p,a,b,axis,extra,hasExtra,width,eye,bore,halfThickness):
 q=p.copy();q[axis]=a[axis];axial=abs(p[axis]-a[axis])-halfThickness
 body=min(mCapsule(q,a,b,width),length(q-a)-eye,length(q-b)-eye);holes=min(length(q-a)-bore,length(q-b)-bore)
 if hasExtra:body=min(body,length(q-extra)-eye);holes=min(holes,length(q-extra)-bore)
 return max(body,-holes,axial)
E={id:compile(re.search(r'return (.*?);',s)[1].replace('true','True').replace('false','False').replace('p.xz','p[[0,2]]'),'exact captured field','eval') for id,s in D['fields'].items()}
for w in D['witnesses']:
 vals=[]
 for id in w['pair']:
  f=D['frames'][w['phaseIndex']]['parts'][id];p=np.array(f['inverseRows'])@np.array(w['xyz'])+f['inverseOffset'];vals.append(float(eval(E[id],globals(),{'p':p})))
 assert max(vals)<-1e-8,(w['pair'],vals)
 assert max(abs(a-b) for a,b in zip(vals,w['fieldValues']))<1e-11,(w['pair'],vals,w['fieldValues'])
print(json.dumps({'exactNegativeWitnessReplays':len(D['witnesses']),'passed':True,'wholeMechanicalAcceptance':False},indent=2))
