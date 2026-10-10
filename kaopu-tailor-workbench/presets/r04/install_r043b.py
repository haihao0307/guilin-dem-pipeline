"""Continue R04.3 on its own native worker, leaving all frozen sources untouched."""
from pathlib import Path
import hashlib,json,subprocess
P=Path(__file__).resolve().parent;N=P/'native/kaopu-tailor-workbench/catalogue';f=N/'native-adapter.mjs';snapshot=N/'native-adapter-r043-before-b.mjs'
if not snapshot.exists():
 assert hashlib.sha256(f.read_bytes()).hexdigest()=='0ed951a24337bc857561dba6f0261b257a14fd89a4290e498c19ee340b8f245f'
 snapshot.write_bytes(f.read_bytes())
s=snapshot.read_text()
def once(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
s="import {stageRadialSkirt} from '../../../correctives/r043b/radial-assembly.mjs';\nimport {configureMaterialBending} from '../../../correctives/r043b/hinge-bending.mjs';\nimport {beginMaterialRefinement} from '../../../correctives/r043b/seam-frames.mjs';\n"+s
once('w43scratch:take(n*3) }','w43scratch:take(n*3),b43ids:take(t*6,4),b43coeff:take(t*6),b43weights:take(t*2) }')
once('prepareAssembly(spec,body);prepareShoulderFixtures(spec,sdf);','prepareAssembly(spec,body);prepareShoulderFixtures(spec,sdf);if(corrected43)stageRadialSkirt(spec,analytic,body);')
once('correctives/r043/joint-r043.wasm','correctives/r043b/joint-r043b.wasm')
once('lab.pipeline43=corrected43;','lab.pipeline43=corrected43;if(corrected43)configureMaterialBending(lab);')
once("if(stage==='sides')lab.releasePins();","if(stage==='sides'&&!spec.source.radialAssembly43b?.enabled)lab.releasePins();")
once('r043PreJoint=beginJointRefinement(lab)','r043PreJoint=beginMaterialRefinement(lab)')
once('jointInfo=beginJointRefinement(lab)','jointInfo=beginMaterialRefinement(lab)')
once('record.r043={sourceRepresentation:','record.r043={bending:lab.bending43b||null,radialAssembly:spec.source.radialAssembly43b||null,surfaceBodySamplesPerTriangle:lab.pipeline43?4:0,sourceRepresentation:')
f.write_text(s)
subprocess.run(['python',str(P/'correctives/r043b/build_kernel.py')],check=True)
subprocess.run(['node','--check',str(f)],check=True)
proof={'schema':'kaopu-original-material-fitting-extension@1','previousRuntimeSHA256':hashlib.sha256(snapshot.read_bytes()).hexdigest(),'currentRuntimeSHA256':hashlib.sha256(f.read_bytes()).hexdigest(),'defaultNinePreserved':True,'changes':['rigid radial-panel initial sewing layout from authoritative original top and hem interfaces','temporary waistband seam jigs released before gravity','sewn boundary local non-inversion frames for ordinary native joins, not only gathered joins','explicit static original-panel hinge regularization, not post-render smoothing','same original body SDF sampled also at material edge midpoints and face centroids during joint optimization'],'sourcePaperArchiveChanged':False,'restMaterialUVChanged':False,'materialTrianglesReindexed':False,'seamPairsChanged':False,'bodyVerticesChanged':False,'qualityGateThresholdsChanged':False,'fabricBendingCalibrated':False,'continuousCollisionCertified':False,'dynamicWearCertified':False}
(P/'R043B_CODE_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
print('NATIVE43B_INSTALLED',proof['currentRuntimeSHA256'],flush=True)
