"""Read-only geometry audit; writes only this research directory. IDs are candidates, not gold labels."""
from pathlib import Path
import numpy as np,json,gzip,hashlib
R=Path(__file__).resolve().parents[2];O=Path(__file__).resolve().parent
v=np.fromfile(R/'research/head-channels/mhr-neutral.f32','<f4').reshape(-1,3).astype(float)*10
f=np.fromfile(R/'research/geometry/mhr-faces.u32','<u4').reshape(-1,3)
d=np.fromfile(R/'research/head-channels/mhr-expression-deltas.f32','<f4').reshape(72,-1,3).astype(float)*10
m=json.load(open(R/'assets/head-transfer.json'));b=gzip.decompress(open(R/'assets/head-transfer.bin.gz','rb').read());names=json.load(open(R/'source/kaopu-mhr-workbench/assets/model.json'))['expression_names'];reg=json.load(open(R/'research/registration/mhr-semantic-r4-report.json'));meta=json.load(open(R/'research/geometry/metadata.json'))['gnm']
report={'units':'mm','nativeAxes':'X/Y/up/Z/front','candidateSelectionIsNotSemanticGroundTruth':True,'eyes':[],'channels':[],'gnmMetadata':meta,'sourceFiles':{}}
for p in ['source/mhr-model.raw.bin','assets/head-transfer.bin.gz','research/head-channels/mhr-expression-deltas.f32','research/geometry/mhr-faces.u32']:
 report['sourceFiles'][p]=hashlib.sha256((R/p).read_bytes()).hexdigest()
for e in range(2):
 a=m['arrays'][f'mhr_eye_{e}_ids'];ids=np.frombuffer(b,a['dtype'],a['length'],a['offset']);fi=np.flatnonzero(np.isin(f,ids).all(1));t=f[fi];edges=np.sort(np.concatenate([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]]),axis=1);u,c=np.unique(edges,axis=0,return_counts=True);be=u[c==1];bv=np.unique(be)
 def area(q):
  tr=q[t];return float(np.linalg.norm(np.cross(tr[:,1]-tr[:,0],tr[:,2]-tr[:,0]),axis=1).sum()/2)
 neutralArea=area(v)
 report['eyes'].append({'eye':e,'candidateVertexIDs':ids.tolist(),'inducedNativeFaceIDs':fi.tolist(),'inducedNativeTriangles':t.tolist(),'boundaryEdges':be.tolist(),'boundaryVertexIDs':bv.tolist(),'interiorVertexIDs':np.setdiff1d(ids,bv).tolist(),'vertices':len(ids),'edges':len(u),'faces':len(t),'EulerCharacteristic':len(ids)-len(u)+len(t),'neutralAreaMM2':neutralArea,'fixtureUpperLowerSeeds':reg['seeds']['leftEye' if e==0 else 'rightEye'],'areaRatios':{names[k]:area(v+d[k])/neutralArea for k in [12+e,14+e,16+e,18+e,20+e]}})
for k in range(14,22):
 e=k%2;ids=np.array(report['eyes'][e]['candidateVertexIDs']);other=np.array(report['eyes'][1-e]['candidateVertexIDs']);n=np.linalg.norm(d[k],axis=1)
 report['channels'].append({'index':k,'nativeShapeIndex':45+k,'name':names[k],'verticesAbove0_1MM':int((n>.1).sum()),'maxDisplacementMM':float(n.max()),'candidateMeanDisplacementMM':d[k,ids].mean(0).tolist(),'oppositeCandidateMaxMM':float(np.linalg.norm(d[k,other],axis=1).max()),'candidateExtentsMM':np.ptp(v[ids]+d[k,ids],axis=0).tolist()})
comp=np.fromfile(R/'research/geometry/gnm-components.u32','<u4');mat=np.fromfile(R/'research/geometry/gnm-materials.u32','<u4');report['gnmEyeMaterials']={str(e):{meta['materials'][int(k)]:int(n) for k,n in zip(*np.unique(mat[comp==e],return_counts=True))} for e in [1,2]}
(O/'geometry-audit.json').write_text(json.dumps(report,indent=2));print(json.dumps({'eyes':[{k:e[k] for k in ['eye','vertices','edges','faces','EulerCharacteristic','interiorVertexIDs','areaRatios']} for e in report['eyes']],'channels':report['channels'],'gnmEyeMaterials':report['gnmEyeMaterials']},indent=2))
