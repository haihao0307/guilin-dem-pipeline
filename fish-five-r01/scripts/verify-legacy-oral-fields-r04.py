"""Full source CPU oral strain, face orientation and weight-Jacobian proof; no GPU."""
import pathlib,json,numpy as np,hashlib,sys
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=ROOT.parent/'.cache/legacy-oral-r04'
P=np.fromfile(CACHE/'positions.bin',dtype='<f4').astype(float).reshape(-1,3);IX=np.fromfile(CACHE/'indices.bin',dtype='<u4').reshape(-1,3)
W=np.fromfile(CACHE/'weights.bin',dtype='u1').reshape(-1,12);JW=np.fromfile(CACHE/'jaw.bin',dtype='<f4').astype(float);GW=np.fromfile(CACHE/'gill.bin',dtype='<f4').astype(float);JG=np.fromfile(CACHE/'jawGradient.bin',dtype='<f4').astype(float).reshape(-1,3);GG=np.fromfile(CACHE/'gillGradient.bin',dtype='<f4').astype(float).reshape(-1,3)
source=json.loads((CACHE/'source.json').read_text(encoding='utf8'));pivot=np.array(source['metadata']['continuum']['jaw']['pivotM']);Q=P-pivot
TR=P[IX];E1=TR[:,1]-TR[:,0];E2=TR[:,2]-TR[:,0];normal=np.cross(E1,E2);area=np.linalg.norm(normal,axis=1);valid=area>1e-12
edgeRows=np.concatenate([IX[:,[0,1]],IX[:,[1,2]],IX[:,[2,0]]]);lengths=np.linalg.norm(P[edgeRows[:,0]]-P[edgeRows[:,1]],axis=1);edgeValid=lengths>1e-9
_,first,alias=np.unique(np.round(P,7),axis=0,return_index=True,return_inverse=True)
def check(jaw,gill,jw=JW,gw=GW,jg=JG,gg=GG):
 angle=jaw*jw;c=np.cos(angle);s=np.sin(angle);R=np.array([c*Q[:,0]-s*Q[:,1],s*Q[:,0]+c*Q[:,1],Q[:,2]]).T
 D=R+pivot;sign=np.sign(P[:,2]+1e-8);D[:,2]+=sign*gill*gw
 tri=D[IX];nn=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);newarea=np.linalg.norm(nn,axis=1);ratio=newarea[valid]/area[valid]
 newlengths=np.linalg.norm(D[edgeRows[:,0]]-D[edgeRows[:,1]],axis=1);er=newlengths[edgeValid]/lengths[edgeValid];wi=int(np.argmax(er));edgeId=np.where(edgeValid)[0][wi]
 # J = Rz(j) + angular * (jaw ∇w)^T + ez * signedGill ∇g^T.
 angular=np.array([-R[:,1],R[:,0],np.zeros(len(P))]).T;J=np.zeros((len(P),3,3));J[:,0,0]=J[:,1,1]=c;J[:,0,1]=-s;J[:,1,0]=s;J[:,2,2]=1;J+=angular[:,:,None]*(jaw*jg[:,None,:]);J[:,2,:]+=sign[:,None]*gill*gg
 det=np.linalg.det(J);gap=float(np.max(np.linalg.norm(D-D[first][alias],axis=1)));normdot=np.einsum('ij,ij->i',nn,normal)
 ai=np.where(valid)[0][int(np.argmax(ratio))];at=IX[ai];gradj=np.linalg.lstsq(np.array([E1[ai],E2[ai]]),jw[at[1:]]-jw[at[0]],rcond=None)[0];gradg=np.linalg.lstsq(np.array([E1[ai],E2[ai]]),gw[at[1:]]-gw[at[0]],rcond=None)[0]
 return {'jaw':jaw,'gill':gill,'maxEdge':float(er.max()),'minEdge':float(er.min()),'maxArea':float(ratio.max()),'minArea':float(ratio.min()),'invertedTriangles':int(np.sum((normdot<0)&valid)),'determinantMin':float(det.min()),'determinantMax':float(det.max()),'nonFinite':int(np.sum(~np.isfinite(D)))+int(np.sum(~np.isfinite(J))),'aliasGapIncludingOriginalSourceRoundoffM':gap,'maxDisplacementM':float(np.max(np.linalg.norm(D-P,axis=1))),'jawDisplacementM':float(np.max(np.linalg.norm(R-Q,axis=1))),'gillDisplacementM':float(np.max(np.abs(gill*gw))),'worstEdge':{'indices':edgeRows[edgeId].tolist(),'sourceLengthM':float(lengths[edgeId]),'sourceWeights':[float(jw[i]) for i in edgeRows[edgeId]],'gillWeights':[float(gw[i]) for i in edgeRows[edgeId]]},'worstArea':{'triangle':int(ai),'indices':at.tolist(),'sourceDoubleArea':float(area[ai]),'sourceRelativeArea':float(area[ai]/np.sum(E1[ai]*E1[ai]+E2[ai]*E2[ai])),'sourcePositions':P[at].tolist(),'jawWeights':jw[at].tolist(),'gillWeights':gw[at].tolist(),'jawTriangleGradient':gradj.tolist(),'gillTriangleGradient':gradg.tolist(),'jawGradientMagnitude':float(np.linalg.norm(gradj)),'gillGradientMagnitude':float(np.linalg.norm(gradg))}}
samples=[]
for jaw in [0.,.0095,.019,.0285,.038]:
 for gill in [0.,.0003375,.000675,.0010125,.00135]:samples.append(check(jaw,gill))
baseline=check(.038,0.,W[:,2]/255,W[:,3]/255)
baseline.pop('determinantMin');baseline.pop('determinantMax');baseline['scope']='Original quantized-source POSITION strain only; original-source weight gradients not supplied, determinant not claimed'
sourceDigests={name:hashlib.sha256((CACHE/(name+'.bin')).read_bytes()).hexdigest() for name in ['positions','indices','weights']}
unchanged=all(sourceDigests[k]==source['sourceProof'][k+'Sha256'] for k in sourceDigests)
analytic=None
if np.all(JW==0) and np.all(JG==0):
 # Gill-only F=p+s*v is linear in s. Each edge and face normal has the
 # exact form A+s*B (face quadratic term vanishes: all offsets are parallel
 # to z). Norm extrema over the ENTIRE range occur at endpoints or the
 # quadratic stationary value. This is not only a finite phase sample.
 v=np.zeros_like(P);v[:,2]=np.sign(P[:,2]+1e-8)*GW;S=.00135
 def norm_range(A,B,denominator,ok):
  aa=np.einsum('ij,ij->i',A,A);ab=np.einsum('ij,ij->i',A,B);bb=np.einsum('ij,ij->i',B,B);critical=np.clip(-ab/np.maximum(bb,1e-30),0,S)
  norm0=np.sqrt(aa);normS=np.linalg.norm(A+S*B,axis=1);normMin=np.sqrt(np.maximum(0,aa+2*critical*ab+critical*critical*bb))
  return float(np.min(normMin[ok]/denominator[ok])),float(np.max(np.maximum(norm0,normS)[ok]/denominator[ok]))
 A=P[edgeRows[:,1]]-P[edgeRows[:,0]];B=v[edgeRows[:,1]]-v[edgeRows[:,0]];minEdge,maxEdge=norm_range(A,B,lengths,edgeValid)
 vr=v[IX];N1=np.cross(vr[:,1]-vr[:,0],E2)+np.cross(E1,vr[:,2]-vr[:,0]);minArea,maxArea=norm_range(normal,N1,area,valid)
 dotMin=np.minimum(np.einsum('ij,ij->i',normal,normal),np.einsum('ij,ij->i',normal+S*N1,normal));detEnd=1+S*np.sign(P[:,2]+1e-8)*GG[:,2]
 Hv=vr[:,:,2];faceGradient=(np.cross(E2,normal)*(Hv[:,1]-Hv[:,0])[:,None]+np.cross(normal,E1)*(Hv[:,2]-Hv[:,0])[:,None])/np.maximum(area*area,1e-30)[:,None];faceDet=1+S*faceGradient[valid,2]
 analytic={'method':'Exact entire gill input interval0..0.00135m: edge/area vectors affine in input; quadratic norm extrema analytically evaluated, orientation and rank-one determinant endpoint bounds. Includes actual face barycentric signed-gill gradient determinant under minimal tangent extension, separately from GPU vertex-average gradients. Jaw weight/gradient identically0 for all requested input angles0..0.038rad.','minEdge':minEdge,'maxEdge':maxEdge,'minArea':minArea,'maxArea':maxArea,'minimumDeterminant':float(min(1,detEnd.min())),'maximumDeterminant':float(max(1,detEnd.max())),'minimumFaceTangentJacobianDeterminant':float(min(1,faceDet.min())),'maximumFaceTangentJacobianDeterminant':float(max(1,faceDet.max())),'orientationReversalsOverEntireInterval':int(np.sum((dotMin<0)&valid)),'passed':minEdge>=.8 and maxEdge<=1.25 and minArea>=.75 and maxArea<=1.35 and min(1,detEnd.min())>.5 and min(1,faceDet.min())>.5 and not np.any((dotMin<0)&valid)}
passed=unchanged and all(x['nonFinite']==0 and x['invertedTriangles']==0 and x['maxEdge']<=1.25 and x['minEdge']>=.8 and x['maxArea']<=1.35 and x['minArea']>=.75 and x['determinantMin']>.5 for x in samples) and (analytic is None or analytic['passed'])
report={'schema':'FISH_R04_LEGACY_ORAL_CONTINUOUS_SOURCE_GRAPH_CPU_1','createdAt':datetime.now(timezone.utc).isoformat(),'sourceProof':source['sourceProof'],'sourceModuleSha256':source.get('sourceModuleSha256'),'fieldHashes':source['fieldHashes'],'generation':source['fieldsProof'],'generationMs':source['generateMs'],'vertices':len(P),'triangles':len(IX),'sourceGeometryAndOriginalWeightsUnchanged':unchanged,'baselineQuantizedJawAt038':baseline,'samples':samples,'maxEdge':max(x['maxEdge'] for x in samples),'minEdge':min(x['minEdge'] for x in samples),'maxArea':max(x['maxArea'] for x in samples),'minArea':min(x['minArea'] for x in samples),'minDeterminant':min(x['determinantMin'] for x in samples),'inverted':sum(x['invertedTriangles'] for x in samples),'passed':passed,'formalLegacyJawDisabled':bool(np.all(JW==0) and np.all(JG==0)),'visualAcceptance':False,'productionReady':False,'method':'All497701 original vertices/all964285 source triangles, current production angle*weight rotation and source-sided gill translation, complete vertex Jacobian and original face orientation. 25 Cartesian requested-input combinations cover zero/quarter/half/three-quarter/full .038rad/.00135m. Formal jaw float weights/gradients are all0 per HOLD_LOCAL; only gill moves. No source geometry/UV/index/weight mutation.'}
report['entireIntervalAnalyticProof']=analytic
out=ROOT/('evidence/R04_LEGACY_GILL_ONLY_CPU_PROOF.json' if report['formalLegacyJawDisabled'] else 'evidence/R04_LEGACY_ORAL_FIELDS_CPU_PROOF.json');out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['passed','maxEdge','minEdge','maxArea','minArea','minDeterminant','inverted','formalLegacyJawDisabled','sourceGeometryAndOriginalWeightsUnchanged']}))
