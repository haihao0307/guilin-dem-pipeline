import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildLocomotiveMechanics} from '../../student-native-r01/src/locomotive-mechanics.mjs';
import {buildDrivingWheel} from '../../student-native-r01/src/driving-wheel.mjs';
import {buildA6LocomotiveShell} from '../src/a6-locomotive-shell.mjs';
import {correctA6Mechanics} from '../src/a6-motion-corrections.mjs';
import {createA6MotionModel,validateA6MotionCycle,screenA6SweptInterference,inspectA6MeshSurfacePair} from '../src/a6-motion.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),docs=path.join(root,'docs'),qa=path.join(root,'qa');
fs.mkdirSync(docs,{recursive:true});fs.mkdirSync(qa,{recursive:true});
const save=(dir,name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value,null,2)+'\n');
const source=buildLocomotiveMechanics(),wheel=buildDrivingWheel(),corrected=correctA6Mechanics(source),model=createA6MotionModel({mechanics:corrected.mechanics,wheel});
const shell=buildA6LocomotiveShell({topHeight:4.03,cabShift:0});
const cycle=validateA6MotionCycle(model,{samples:1440});
assert(cycle.supportedLoopPass);assert(Math.abs(cycle.strokeErrorM)<1e-12);
const cylinderLeadingChecks=corrected.mechanics.parts.filter(p=>p.name.startsWith('outside-cylinder-')).flatMap(cylinder=>corrected.mechanics.parts.filter(p=>/^leading-[12]-wheel-/.test(p.name)).map(carrying=>inspectA6MeshSurfacePair(cylinder,carrying)));
assert(cylinderLeadingChecks.every(c=>!c.surfaceWitness));
const baselineModel=createA6MotionModel({mechanics:source,wheel});
const baseline=screenA6SweptInterference(baselineModel,{stepDegrees:5,narrowPhase:true});
save(docs,'MOTION_BASELINE_FAILURES.json',{cycle:validateA6MotionCycle(baselineModel),sweep:baseline});
console.log(`Preserved baseline: ${baseline.sampledSurfaceWitnessCount} surface witnesses, ${baseline.candidateCount} candidates`);
const sweep=screenA6SweptInterference(model,{stepDegrees:1,obstacles:shell.parts,narrowPhase:true});
const shellNames=new Set(shell.parts.map(p=>p.name));
const witnessed=sweep.candidates.filter(p=>p.sampledSurfaceWitness),supportedWitnesses=witnessed.filter(p=>!p.involvesUnsupportedReference),unsupportedWitnesses=witnessed.filter(p=>p.involvesUnsupportedReference),shellWitnesses=witnessed.filter(p=>p.pair.some(n=>shellNames.has(n)));
const sourceHashes=Object.fromEntries(['src/a6-motion.mjs','src/a6-motion-corrections.mjs','src/a6-locomotive-shell.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
save(docs,'MOTION_CORRECTED_SWEEP.json',{sourceHashes,defaultShellParameters:{topHeight:4.03,cabShift:0},corrections:corrected.corrections,cycle,cylinderLeadingChecks,sweep});
const publicReport={schema:'a6-public-motion-report/2',status:'已修正检出的外侧干涉；配气机构仍未解',complete:true,scope:'固定轴、原生外侧轮杆/活塞/滑块候选；保留完整机械和默认机车外壳。不是整车动力学或历史A4配气认证。',sourceHashes,defaultShellParameters:{topHeight:4.03,cabShift:0},componentNamesPreserved:338,explicitNewPistonExtensions:2,explicitNewPistonHeads:2,explicitNewComponentCount:4,correctionCount:corrected.corrections.length,supportedLoop:cycle,
  screen:{intervalDegrees:sweep.intervalDegrees,intervalCount:sweep.intervals,continuousEnvelopeScreen:true,exactContinuousTriangleProof:false,candidateCount:sweep.candidateCount,sampledSurfaceWitnessCount:witnessed.length,supportedMechanismSurfaceWitnesses:supportedWitnesses.length,unsupportedValveReferenceSurfaceWitnesses:unsupportedWitnesses.length,shellSurfaceWitnesses:shellWitnesses.length,shellIncluded:true,method:sweep.method},
  unsupportedSurfaceWitnesses:unsupportedWitnesses.map(p=>({pair:p.pair,phaseDegrees:p.sampledSurfaceWitness.phaseDegrees})),supportedSurfaceWitnesses:supportedWitnesses.map(p=>({pair:p.pair,phaseDegrees:p.sampledSurfaceWitness.phaseDegrees})),
  primaryDimensions:{wheelTreadDiameterM:2.032,driverAxisZM:[3.5814,5.7912,8.001],crankRadiusM:.3302,documentedPistonStrokeM:.6604},
  measurableCandidateGaps:{driverBrakeMinimumTaperRadialGapM:.01072,brakeOuterOverhangM:.0006,journalSleeveToHubAxialGapM:.0014,couplingEyesFaceGapM:.005,rearCouplingRodToHubLateralGapM:.0045,crossheadBodyToMainRodLateralGapM:.0105,mainPinToCouplingEyeAxialGapM:.0025,cylinderWallM:.02005,pistonRadialClearanceM:.002,glandRadialClearanceM:.002},cylinderLeadingChecks,
  baselineFailureReport:'../docs/MOTION_BASELINE_FAILURES.json',detailedReport:'../docs/MOTION_CORRECTED_SWEEP.json',fullVehicleApproval:false,allMechanismsSolved:false,
  limits:['连续包络覆盖全360°，包络候选仍需判定；离散原始三角形无相交不能冒充连续三角形无碰撞。','未解配气静态参考件保留，现有接头不代表已联动；所有相关相交单独列出。','工作缸孔、填料函通孔与刚性活塞头已建模；20.05毫米壁厚、2毫米径向间隙及60毫米活塞厚度为明示设计假设，密封/蒸汽压力/载荷未求解。','没有制动、悬挂、轨道滚动、车钩或车厢动力学求解。默认外壳以外参数更改后需要重扫。']};
save(qa,'MOTION_SWEEP_PUBLIC.json',publicReport);
console.log(JSON.stringify({status:'REPORT_SAVED',candidatePairs:sweep.candidateCount,sampledSurfaceWitnesses:witnessed.length,supportedWitnesses:supportedWitnesses.length,unsupportedWitnesses:unsupportedWitnesses.length,shellWitnesses:shellWitnesses.length,fullVehicleApproval:false}));
// A failing known reference subsystem is reported, not hidden by an assertion.
assert.equal(supportedWitnesses.length,0,'An unintended supported-mechanism or shell surface intersection remains; report saved for diagnosis');
