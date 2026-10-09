"""Reproduce R03.1 semantic identity fits using the already licensed GNM container.
Requires numpy. Run from a writable directory. It never downloads external data.
The final square-jaw recipe applies an extra 0.8 safety gain after this raw fit.
"""
import numpy as np,json,struct
from pathlib import Path
p=Path(__file__).resolve().parents[3];b=(p/'full/source/kaopu-face-workbench/assets/gnm_head_web.bin').read_bytes();length=struct.unpack_from('<I',b,8)[0];h=json.loads(b[12:12+length]);base=12+length
D={a['name']:np.frombuffer(b,dtype=a['dtype'],count=a['byteLength']//np.dtype(a['dtype']).itemsize,offset=base+a['offset']).reshape(a['shape']) for a in h['sections']};V=D['template'];B=D['identity_basis'].reshape(253,17821,3)*D['identity_scales'][:,None,None];li=D['landmark_indices'];lw=D['landmark_weights'];L=(V[li]*lw[:,:,None]).sum(1);LB=(B[:,li,:]*lw[None,:,:,None]).sum(2)

N=60
# Measured anatomical spans of the standard 68-point embedding, all in metres.
features={
 'jawWidth':[(16,0,1),(0,0,-1)],'lowerJawWidth':[(11,0,1),(5,0,-1)],
 'browSpan':[(26,0,1),(17,0,-1)],'noseWidth':[(35,0,1),(31,0,-1)],
 'noseLength':[(27,1,1),(33,1,-1)],'noseProjection':[(30,2,1),(39,2,-.5),(42,2,-.5)],
 'eyeWidth':[(39,0,.5),(36,0,-.5),(45,0,.5),(42,0,-.5)],
 'eyeSeparation':[(42,0,.5),(45,0,.5),(36,0,-.5),(39,0,-.5)],
 'mouthWidth':[(54,0,1),(48,0,-1)],'upperLipThickness':[(51,1,1),(62,1,-1)],
 'lowerLipThickness':[(66,1,1),(57,1,-1)],'lowerFaceHeight':[(33,1,1),(8,1,-1)],
 'chinProjection':[(8,2,1),(33,2,-1)],
}
A=np.array([sum(LB[:N,i,c]*w for i,c,w in v) for v in features.values()])*1000
neutral=np.array([sum(L[i,c]*w for i,c,w in v) for v in features.values()])*1000
# Desired absolute millimetre differences; statistical prior bounds actual solution.
targets=[('long_narrow','长脸窄颌·长鼻薄唇',{'jawWidth':-8,'lowerJawWidth':-9,'browSpan':-4,'noseWidth':-4,'noseLength':6,'noseProjection':5,'eyeWidth':1.5,'eyeSeparation':-1,'mouthWidth':-4,'upperLipThickness':-1.1,'lowerLipThickness':-1.2,'lowerFaceHeight':7,'chinProjection':3}),('short_broad','短脸宽颧·短鼻丰唇',{'jawWidth':6,'lowerJawWidth':3,'browSpan':7,'noseWidth':5,'noseLength':-6,'noseProjection':-4,'eyeWidth':2,'eyeSeparation':4,'mouthWidth':6,'upperLipThickness':1.6,'lowerLipThickness':1.8,'lowerFaceHeight':-5,'chinProjection':-2}),('square_jaw','方颌低眉·阔口直鼻',{'jawWidth':10,'lowerJawWidth':11,'browSpan':1,'noseWidth':1,'noseLength':3,'noseProjection':2,'eyeWidth':-2,'eyeSeparation':-3,'mouthWidth':8,'upperLipThickness':-1,'lowerLipThickness':-.6,'lowerFaceHeight':1,'chinProjection':5})]
# Restrain upper calvarium/neck displacement, never use fat amount to set skull size.
ids=np.flatnonzero((V[:,1]>.35)|(V[:,1]<.14));constraints=B[:N,ids,:].reshape(N,-1).T*1000/np.sqrt(len(ids))
report=[]
for id,label,des in targets:
 y=np.array([des[k] for k in features]);W=np.diag([1,1,.6,1.3,1,1,1.7,1.5,1.2,2,2,1,1]);mat=np.vstack([W@A,constraints*.8,np.eye(N)*.85]);rhs=np.r_[W@y,np.zeros(len(constraints)+N)];x=np.linalg.lstsq(mat,rhs,rcond=None)[0];x*=min(1,2.8/abs(x).max());x=np.round(x,6);actual=A@x
 report.append({'id':id,'label':label,'gnmIdentity':list(x)+[0.]*(253-N),'maxAbsCoefficient':float(abs(x).max()),'coefficientNorm':float(np.linalg.norm(x)),'metricsMM':{k:{'neutral':float(n),'requestedDelta':float(v),'actualDelta':float(a)} for k,n,v,a in zip(features,neutral,y,actual)}})
 print(id,'maxcoef',abs(x).max(),'norm',np.linalg.norm(x),'actual',dict(zip(features,np.round(actual,2))))
Path('r031-identity-fit.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
