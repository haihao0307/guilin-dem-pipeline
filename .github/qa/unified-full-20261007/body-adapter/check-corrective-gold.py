"""Independent gold uses actual native same-pose MLP-on MINUS MLP-off outputs.
Unskin that observed difference using all native influences, then transfer the
recovered rest-space difference and skin once with the target posed rig.
"""
from pathlib import Path
import json
import numpy as np
import scipy.sparse as ss
P=Path(__file__).parent;meta=json.loads((P/'input.json').read_text());N=meta['nativeVertexCount'];J=len(meta['mhrJointNames']);V=meta['bodyVertexCount']
W=ss.coo_matrix((np.fromfile(P/'skin_weights.f32','<f4'),(np.fromfile(P/'skin_verts.u16',meta['skinArrays']['skin_verts']['dtype']),np.fromfile(P/'skin_joints.u16',meta['skinArrays']['skin_joints']['dtype']))),shape=(N,J)).tocsr();tri=np.fromfile(P/'map-indices.u32','<u4').reshape(V,3);b=np.fromfile(P/'map-bary.f32','<f4').reshape(V,3);sums=sum(np.asarray(W[tri[:,k]].sum(axis=1)).ravel()*b[:,k] for k in range(3));C=np.array([[1,0,0],[0,0,-1],[0,1,0]])
results={}
for name in ['elbow_60','elbow_90','elbow_twist','both_elbows_twist','shoulder','fingers']:
 m=json.loads((P/(name+'-matrices.json')).read_text());sm=np.array(m['sourceSkin']).reshape(J,3,4)[:,:,:3];SB=np.array(m['sourceBind']).reshape(J,4,4);TP=np.array(m['targetPose']).reshape(J,4,4);sc=np.array(m['scales']);A=np.asarray(W@sm.reshape(J,9)).reshape(N,3,3)
 on=np.fromfile(P/(name+'-native-on.f32'),'<f4').reshape(N,3).astype(float);off=np.fromfile(P/(name+'-native-off.f32'),'<f4').reshape(N,3).astype(float);observed=on-off;rest=np.linalg.solve(A,observed[...,None])[...,0]
 actualRest=np.fromfile(P/(name+'-rest-on.f32'),'<f4').reshape(N,3).astype(float)-np.fromfile(P/(name+'-rest-off.f32'),'<f4').reshape(N,3).astype(float)
 frames=np.einsum('nij,njk->nik',TP[:,:3,:3],np.linalg.inv(SB[:,:3,:3]));frames=frames*sc[:,None,None];targetA=np.asarray(W@frames.reshape(J,9)).reshape(N,3,3)
 transported=np.einsum('nij,nj->ni',targetA,rest@C.T/100);wrong=np.einsum('nij,nj->ni',targetA,observed@C.T/100)
 gold=sum(transported[tri[:,k]]*b[:,k,None] for k in range(3))/sums[:,None];wrong=sum(wrong[tri[:,k]]*b[:,k,None] for k in range(3))/sums[:,None];actual=np.fromfile(P/(name+'-corrective.f32'),'<f4').reshape(V,3).astype(float)
 error=np.linalg.norm(actual-gold,axis=1)*1000;wrongError=np.linalg.norm(actual-wrong,axis=1)*1000
 results[name]={'gold':'actual same-pose native MLP-on/off vertices, inverse full blended skin matrix, rest transfer, target skin','maxErrorMM':float(error.max()),'p99ErrorMM':float(np.quantile(error,.99)),'rmsErrorMM':float(np.sqrt(np.mean(error**2))),'nativeRestRecoveryMaxMM':float(np.max(np.linalg.norm(rest-actualRest,axis=1))*10),'nativeBlendMaxCondition':float(np.linalg.cond(A).max()),'wrongPosedDeltaAsRestMaxErrorMM':float(wrongError.max()),'correctiveMaxMM':float(np.max(np.linalg.norm(actual,axis=1))*1000)}
 assert error.max()<.01,(name,error.max())
(P/'corrective-gold-report.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
