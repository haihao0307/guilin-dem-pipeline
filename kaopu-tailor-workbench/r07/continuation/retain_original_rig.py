"""Prepare the existing original-rig artifact, not a replacement human or guessed rig."""
from pathlib import Path
import gzip,hashlib,json,shutil,sys
import numpy as np
P=Path(__file__).resolve().parent;ROOT=P.parent.parent
source=Path(sys.argv[1]);rig_path=source/'original-anny-rig.json.gz'
expected='45170bf7d0806448c972777c24895436d4a2b10aa30a5ebdff6832e1bd331e23'
assert hashlib.sha256(rig_path.read_bytes()).hexdigest()==expected,'Wrong original rig bytes'
r=json.loads(gzip.decompress(rig_path.read_bytes()));original_report=json.loads((source/'RIG_REPORT.json').read_text())
body=json.loads((ROOT/'garments-r04/assets/body-anny-adult.json').read_text())
vertices=np.asarray(r['restVertices'],dtype=np.float64).reshape(-1,3)
rest=np.asarray(r['restBonePoses'],dtype=np.float64).reshape(-1,4,4)
neutral=np.asarray(r['neutralBonePoses'],dtype=np.float64).reshape(-1,4,4)
indices=np.asarray(r['vertexBoneIndices'],dtype=np.int64).reshape(len(vertices),r['influences'])
weights=np.asarray(r['vertexBoneWeights'],dtype=np.float64).reshape(indices.shape)
assert len(r['boneLabels'])==104 and len(vertices)==13718 and r['influences']==9
assert np.all(np.isfinite(vertices)) and np.all(np.isfinite(weights)) and np.min(indices)>=0 and np.max(indices)<104
assert np.max(np.abs(weights.sum(axis=1)-1))<1e-5
transforms=neutral@np.linalg.inv(rest);homogeneous=np.column_stack([vertices,np.ones(len(vertices))]);posed=np.zeros_like(homogeneous)
for j in range(r['influences']):posed+=np.einsum('nij,nj->ni',transforms[indices[:,j]],homogeneous)*weights[:,j,None]
world=np.column_stack([posed[:,0],posed[:,2]+r['groundTranslationM'],-posed[:,1]])*1000
reference=np.asarray(body['positionsMm'],dtype=np.float64);error=np.linalg.norm(world-reference,axis=1)
assert world.shape==reference.shape and float(error.max())<.001,'Binding does not reproduce this original human'
assets=P/'assets';assets.mkdir(exist_ok=True)
shutil.copy2(rig_path,assets/'original-anny-rig.json.gz')
report={'schema':'kaopu-original-body-binding-check@1','sourceArtifactId':11590103742,'sourceArtifactRun':37872375418,
 'retainedFileSHA256':expected,'sourceReport':original_report,'maximumNeutralPositionErrorMm':float(error.max()),
 'vertices':len(vertices),'bones':len(rest),'influencesPerVertex':r['influences'],'weightsTruncated':False,
 'bodyReplaced':False,'bodyRescaled':False,'rigBytesPrepared':True,
 'versionedRetentionRequiresSuccessfulCommit':'kaopu-tailor-workbench/r07/continuation/assets/original-anny-rig.json.gz',
 'actualMovingClothingTested':False,'dynamicWearCertified':False}
(P/'ORIGINAL_RIG_REPORT.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
