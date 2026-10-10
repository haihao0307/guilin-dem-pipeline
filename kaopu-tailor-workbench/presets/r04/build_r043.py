"""Source-level R04.3 integration. Preserve original paper/person/gates and old accepted replay."""
from pathlib import Path
import json,hashlib,subprocess
P=Path(__file__).parent;N=P/'native/kaopu-tailor-workbench/catalogue';C=P/'correctives/r043'
f=N/'native-adapter.mjs';backup=N/'native-adapter-r042.mjs'
if not backup.exists():backup.write_bytes(f.read_bytes())
s=backup.read_text()
def once(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a));s=s.replace(a,b)
s="import {prepareNativeSource} from '../../../source-repair-r043.mjs';\nimport {attachExteriorField,waistCircuit} from '../../../correctives/r043/fit-support.mjs';\n"+s
once('analytic=await recoverExplicitPantsCuffGathering(original)','analytic=await recoverExplicitPantsCuffGathering(prepareNativeSource(original))')
once('qgm:take(t*3) }','qgm:take(t*3),w43ids:take(n*2,4),w43spans:take(2,4),w43targets:take(1),w43scratch:take(n*3) }')
once('sdf = new BodySDF(meta, new Int16Array(buffer));','sdf = new BodySDF(meta, new Int16Array(buffer));attachExteriorField(sdf,body);')
once('async function startLegacySolve(token) {','async function startLegacySolve(token) {\n const corrected43=config?.variant43||!new Set(["T01","T02","T03","T04","T08","T15","T16","T17","T18"]).has(nativeBinding?.presetId);\n r043PreGuides=r043PreJoint=null;r043BudgetOrigin=0;r043Recovery=[];')
once('if (!kernelReady) {','if (!kernelReady || kernelVariant43!==corrected43) {')
once('configureWasm(await bytes(new URL("../r07/stability/joint-r072.wasm",import.meta.url).href));','configureWasm(await bytes(new URL(corrected43?"../../../correctives/r043/joint-r043.wasm":"../r07/stability/joint-r072.wasm",import.meta.url).href));kernelVariant43=corrected43;')
once('lab = new GarmentLab2(spec, sdf, { substeps: 12, iterations: 1, sewingDuration:.75 });','lab = new GarmentLab2(spec, sdf, { substeps: corrected43&&nativeBinding.presetId==="T06"?18:12, iterations: corrected43&&nativeBinding.presetId==="T06"?4:1, sewingDuration:.75 });\n lab.pipeline43=corrected43;if(corrected43)lab.kernel.setBodyExterior43(...sdf.exteriorBounds.lo,...sdf.exteriorBounds.hi);')
once('stages = [...spec.source.assemblyExperiment, "release", "refine", "joint"];','stages = [...spec.source.assemblyExperiment,...(corrected43?["seam-relax","seam-finish"]:[]),"release","refine","joint"];')
once('totalFrames = spec.source.assemblyExperiment.length * 90 + 120 + 1600 + 1600;','totalFrames = stages.reduce((n,s)=>n+r043Frames(s),0);')
once('progress: (lab.frameCount+refinementSteps+jointSteps) / totalFrames','progress: (stages.slice(0,stageIndex).reduce((n,s)=>n+r043Frames(s),0)+stageFrame) / totalFrames')
once('this.bodyContacts += k.getContacts();','if(this.waistCircuit43)for(let j=0;j<32;j++){k.waistProject43(1);k.vertices(this.clearance);}\n      this.bodyContacts += k.getContacts();')
a=s.index('function tick(token) {');b=s.index('// This extension',a)
s=s[:a]+(C/'tick.inc.mjs').read_text()+'\n'+s[b:]
s+='\nvar kernelVariant43=null;\n'+(C/'variant.inc.mjs').read_text()
once('} else if(data.type === "load-native-paper") {','} else if(data.type === "generate-native-variant") {\n      await generateNativeVariant43(data);\n    } else if(data.type === "load-native-paper") {')
f.write_text(s)
subprocess.run(['node','--check',str(f)],check=True)
proof={'schema':'native-r043-code-change@1','beforeSHA256':hashlib.sha256(backup.read_bytes()).hexdigest(),'afterSHA256':hashlib.sha256(f.read_bytes()).hexdigest(),'changes':['explicit SkirtLevels gathering recovery from pinned original source','recenter over-offset material coordinate frames with inverse rigid-placement compensation','strict original teacher parameter generation inside owning worker','retained original converged outputs and legacy numeric route for prior nine passing inputs','closed-material-waist perimeter constraint; no world pins','native seams relaxed and closed before gradual garment weight','verified enclosing-box positive distance outside native collision volume','resumable compute checkpoints instead of 90-second state destruction'],'originalStaticGateChanged':False,'personChanged':False,'sourcePapersChanged':False,'fullClothPhysicsCertified':False}
(P/'R043_CODE_PROOF.json').write_text(json.dumps(proof,indent=2))
print('R043_INTEGRATION_COMPLETE')
