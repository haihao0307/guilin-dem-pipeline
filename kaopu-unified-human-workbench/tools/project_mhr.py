"""Bounded actual MHR-to-canonical displacement experiment.
The one supported source channel is identity PCA 0, restricted to the torso.
Both neutral alignment distance and held-out delta interpolation error are reported.
"""
from pathlib import Path
import numpy as np,json,hashlib
from scipy.spatial import cKDTree
R=Path(__file__).resolve().parents[1]
a=json.loads((R/'research/anny-neutral.json').read_text());c=json.loads((R/'assets/canonical.json').read_text());m=np.load(R/'research/mhr-samples.npz');meta=json.loads((R/'research/mhr-samples.json').read_text())
av=np.array(a['vertices']).reshape(-1,3);ah=np.array(a['heads']).reshape(-1,3);mv=m['neutral'];mh=m['neutral_skeleton'][:,:3];mf=m['faces'];P=np.array([[1,0,0],[0,0,-1],[0,1,0.]])
# Known anatomical joints for a similarity registration, never PCA coefficient copying.
pairs=[('c_neck','neck01'),('c_head','head'),('l_uparm','upperarm01.L'),('r_uparm','upperarm01.R'),('l_lowarm','lowerarm01.L'),('r_lowarm','lowerarm01.R'),('l_wrist','wrist.L'),('r_wrist','wrist.R'),('l_upleg','upperleg01.L'),('r_upleg','upperleg01.R'),('l_lowleg','lowerleg01.L'),('r_lowleg','lowerleg01.R'),('l_foot','foot.L'),('r_foot','foot.R')]
X=np.array([mh[meta['jointNames'].index(x)]@P.T for x,y in pairs]);Y=np.array([ah[a['bones'].index(y)] for x,y in pairs]);mx=X.mean(0);my=Y.mean(0);x=X-mx;y=Y-my;u,s,vt=np.linalg.svd(x.T@y);rot=u@vt
if np.linalg.det(rot)<0:u[:,-1]*=-1;rot=u@vt
scale=np.sum((x@rot)*y)/np.sum(x*x);offset=my-mx@rot*scale
transform=lambda v:(v@P.T)@rot*scale+offset
sv=transform(mv);jointErrors=np.linalg.norm(X@rot*scale+offset-Y,axis=1)
bodyRecipes=np.array(c['annyRecipes']);bv=av[bodyRecipes[:,0].astype(int)]*(1-bodyRecipes[:,2,None])+av[bodyRecipes[:,1].astype(int)]*bodyRecipes[:,2,None]
def smooth(a,b,x):
 t=np.clip((x-a)/(b-a),0,1);return t*t*(3-2*t)
mask=smooth(-.08,.02,bv[:,2])*(1-smooth(.43,.56,bv[:,2]))*(1-smooth(.20,.30,np.abs(bv[:,0])))
active=np.flatnonzero(mask>1e-8)
def nearest(query,vertices,faces,k=64):
 tri=vertices[faces];tree=cKDTree(tri.mean(1));_,idx=tree.query(query,k=min(k,len(faces)));T=tri[idx];q=query[:,None,:];A=T[:,:,0];B=T[:,:,1];C=T[:,:,2];ab=B-A;ac=C-A;aq=q-A
 d00=np.sum(ab*ab,-1);d01=np.sum(ab*ac,-1);d11=np.sum(ac*ac,-1);d20=np.sum(aq*ab,-1);d21=np.sum(aq*ac,-1);den=d00*d11-d01*d01
 vv=np.divide(d11*d20-d01*d21,den,out=np.zeros_like(den),where=np.abs(den)>1e-16);ww=np.divide(d00*d21-d01*d20,den,out=np.zeros_like(den),where=np.abs(den)>1e-16);uu=1-vv-ww
 bary=np.stack([uu,vv,ww],-1);projected=np.sum(T*bary[:,:,:,None],axis=2);dist=np.sum((projected-q)**2,-1);dist[(bary.min(-1)<0)|(np.abs(den)<1e-16)]=np.inf
 bestb=bary.copy();bestd=dist.copy()
 for i,j in [(0,1),(1,2),(2,0)]:
  edge=T[:,:,j]-T[:,:,i];t=np.clip(np.sum((q-T[:,:,i])*edge,-1)/np.maximum(np.sum(edge*edge,-1),1e-30),0,1);p=T[:,:,i]+edge*t[:,:,None];d=np.sum((p-q)**2,-1);b=np.zeros_like(bary);b[:,:,i]=1-t;b[:,:,j]=t;better=d<bestd;bestb[better]=b[better];bestd[better]=d[better]
 pick=np.argmin(bestd,axis=1);rows=np.arange(len(query));return idx[rows,pick],bestb[rows,pick],np.sqrt(bestd[rows,pick])
fi,bary,d=nearest(bv[active],sv,mf,64);fi128,b128,d128=nearest(bv[active],sv,mf,128);candidateDifference=float(np.max(np.abs(d-d128)));fi,bary,d=fi128,b128,d128
# Transform a displacement without translation; keep the user's canonical neutral.
deltas={}
for name in ['identity0_plus','identity0_minus','identity0_half']:
 dv=((m[name]-mv)@P.T)@rot*scale
 transported=np.sum(dv[mf[fi]]*bary[:,:,None],axis=1)
 full=np.zeros_like(bv);full[active]=transported*mask[active,None];deltas[name]=full
hold=deltas['identity0_half']-.5*deltas['identity0_plus'];err=np.linalg.norm(hold[active],axis=1)
# Spatial round-trip test: inverse-project the transported field to source torso
# (only high-confidence fully-open mask region). It is not a pose/identity fit.
sourceIds=np.flatnonzero((sv[:,2]>.07)&(sv[:,2]<.37)&(np.abs(sv[:,0])<.16))
bodyfaces=np.array(c['faces']).reshape(-1,3)[:c['report']['bodyFaces']]
bfi,bb,bd=nearest(sv[sourceIds],bv,bodyfaces,128)
roundtrip=np.sum(deltas['identity0_plus'][bodyfaces[bfi]]*bb[:,:,None],axis=1)
truth=((m['identity0_plus']-mv)@P.T)@rot*scale;roundError=np.linalg.norm(roundtrip-truth[sourceIds],axis=1)
summary=lambda x:{'meanMM':float(np.mean(x)*1000),'rmsMM':float(np.sqrt(np.mean(x*x))*1000),'p95MM':float(np.quantile(x,.95)*1000),'maxMM':float(np.max(x)*1000)}
report={'schema':'kaopu-mhr-canonical-projection/1','status':'bounded-experiment','channel':'MHR identity PCA 0, torso-only','coverage':{'identityChannels':1,'totalIdentityChannels':45,'modelPoseChannels':0,'totalModelPoseChannels':204,'expressionChannels':0,'totalExpressionChannels':72,'activeCanonicalBodyVertices':len(active),'canonicalBodyVertices':len(bv)},'sourceCommit':meta['sourceCommit'],'sourceModelSHA256':meta['modelSHA256'],'sourceVertices':len(mv),'sourceFaces':len(mf),'registration':{'type':'14-joint least-squares similarity','rotationBeforeFit':P.tolist(),'rotation':rot.tolist(),'scale':float(scale),'translation':offset.tolist(),'jointError':summary(jointErrors)},'neutralSurfaceMismatch':summary(d),'nearestTriangleCandidate64vs128MaxDifferenceMM':candidateDifference*1000,'heldoutHalfCoefficientError':summary(err),'spatialRoundtripDeltaError':summary(roundError),'spatialRoundtripVertices':len(sourceIds),'spatialRoundtripNeutralDistance':summary(bd),'transferredDeltaPlus':summary(np.linalg.norm(deltas['identity0_plus'][active],axis=1)),'maximumNativeScalarRange':[-1,1],'limits':['Neutral source and target are different synthetic people; neutral bias is subtracted, not fitted away.','Only torso displacement field projected; no MHR skeleton, pose correctives, hands, eyes, expression channels or automatic facial semantics claimed.','Adding to changed Anny ages/poses is a bounded compositional experiment, not validated full Anny/MHR identity equivalence.','No source coefficients are reinterpreted as target coefficients.']}
asset={'schema':'kaopu-mhr-torso-delta/1','topologySha256':c['topologySha256'],'vertexCount':len(bv),'channel':'identity_000','sourceModelSHA256':meta['modelSHA256'],'positive':deltas['identity0_plus'].astype(np.float32).reshape(-1).tolist(),'negative':deltas['identity0_minus'].astype(np.float32).reshape(-1).tolist(),'report':report}
(R/'assets/mhr-torso-delta.json').write_text(json.dumps(asset,separators=(',',':')));(R/'research/mhr-projection-report.json').write_text(json.dumps(report,indent=2));np.savez_compressed(R/'research/mhr-canonical-map.npz',active=active,faces=mf[fi],barycentric=bary,mask=mask,source_aligned=sv,canonical=bv);print(json.dumps(report,indent=2))
