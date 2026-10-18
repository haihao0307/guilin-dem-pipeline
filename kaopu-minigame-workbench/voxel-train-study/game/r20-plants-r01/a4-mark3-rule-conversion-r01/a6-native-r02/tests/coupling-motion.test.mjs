import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {correctA6Mechanics} from '../src/a6-motion-corrections.mjs';
import {buildA6CouplingMotion,solveA6CouplingPose,transformA6Point,prepareA6CouplingInterference,sweepA6CouplingInterference,a6TriangleDistanceSquared,A6_COUPLING_JOINTS} from '../src/a6-coupling-motion.mjs';
import {buildLocomotiveMechanics} from '../../student-native-r01/src/locomotive-mechanics.mjs';
import {buildMark3Mechanics} from '../../student-native-r01/src/coach-mechanics.mjs';
import {buildA6LocomotiveShell} from '../src/a6-locomotive-shell.mjs';
import {buildA6TenderShell} from '../src/a6-tender-shell.mjs';
import {buildA6CoachShell} from '../src/a6-coach-shell.mjs';
import {buildA6FlexibleTransitions} from '../src/a6-flexible-transitions.mjs';
const near=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const concept=buildA6CouplingMotion();
assert.equal(concept.parts.length,34);assert.equal(concept.evidence.originalMechanicalPartsChanged,0);near(concept.restPose.lengthM,.56);
assert.deepEqual(concept.restPose.transforms.coach.position,[0,0,32.34]);
assert.equal(concept.parts.filter(p=>p.metadata.openBore).length,10);
for(const part of concept.parts){assert.ok(part.positions.every(Number.isFinite));assert.ok(part.normals.every(Number.isFinite));assert.ok(part.indices.length>0);assert.ok(['fixed','drawbar','coach'].includes(part.metadata.motionBody));}
const poses=[];
for(let angle=-12;angle<=12;angle+=.1){
  const pose=solveA6CouplingPose({coachYawDeg:angle,tensionKN:100});near(pose.actualLengthM,.56);assert.ok(pose.closureErrorM<1e-12);
  const fromCoach=transformA6Point(A6_COUPLING_JOINTS.coachPinLocal,pose.transforms.coach);fromCoach.forEach((v,i)=>near(v,pose.joints[1].position[i]));
  const fromRestWorld=transformA6Point([0,.82,20.74],pose.transforms.coachDesign);fromRestWorld.forEach((v,i)=>near(v,pose.joints[1].position[i]));
  pose.forcePath.coachForceKN.forEach((v,i)=>near(v+pose.forcePath.tenderForceKN[i],0));
  near(Math.hypot(...pose.forcePath.coachForceKN),100);poses.push(pose);
}
const straight=solveA6CouplingPose({tensionKN:100});near(straight.forcePath.illustrativeTenderMomentKNm[0],-48);
for(const arg of [{coachYawDeg:13},{coachYawDeg:NaN},{linkYawDeg:-13},{coachOffsetZ:31},{wrong:1},{tensionKN:-1}])assert.throws(()=>solveA6CouplingPose(arg));
assert.throws(()=>buildA6CouplingMotion({coachYawDeg:1}));
const a=[[0,0,0],[1,0,0],[0,1,0]];
near(a6TriangleDistanceSquared(a,a.map(p=>[p[0],p[1],p[2]+2])),4);
near(a6TriangleDistanceSquared(a,[[.2,.2,-1],[.2,.2,1],[.3,.3,1]]),0);
near(a6TriangleDistanceSquared(a,[[.2,.2,0],[.4,.2,0],[.2,.4,0]]),0);
near(a6TriangleDistanceSquared(a,[[2,0,0],[3,0,0],[2,1,0]]),1);
console.log('PASS analytic joints, force equilibrium, unchanged rigid link, input guards and triangle distances');
const originalLm=buildLocomotiveMechanics(),correction=correctA6Mechanics(originalLm),lm=correction.mechanics,cm=buildMark3Mechanics(),tender=buildA6TenderShell(),loco=buildA6LocomotiveShell(),coach=buildA6CoachShell(),flex=buildA6FlexibleTransitions();
const digest=parts=>{const h=createHash('sha256');for(const p of parts)for(const key of ['positions','normals','indices','uvs']){const a=ArrayBuffer.isView(p[key])?p[key]:(key==='indices'?Uint32Array.from(p[key]):Float32Array.from(p[key]));h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));};return h.digest('hex');};
const originalSourceSha256=digest(originalLm.parts);assert.equal(originalSourceSha256,digest(buildLocomotiveMechanics().parts));
const before={loco:digest(lm.parts),coach:digest(cm.parts),shell:digest(coach.parts),shroud:digest(flex.parts)};
const auditor=prepareA6CouplingInterference({fixedParts:[...lm.parts,...loco.parts,...tender.parts],movingParts:[...cm.parts,...coach.parts],shroudParts:flex.parts,searchDistanceM:.012});
const samples=[];
for(const coachYawDeg of [0,-.25,.25,-1,1,-3,3,-6,6,-12,12]){const t=Date.now(),result=auditor.audit(solveA6CouplingPose({coachYawDeg}));samples.push(result);console.log(JSON.stringify({angle:coachYawDeg,surfaceIntersections:result.surfaceIntersections,minimum:result.minimumMeasuredSurfaceDistanceM,ms:Date.now()-t,pairs:result.pairs.slice(0,8).map(p=>`${p.fixedPart} × ${p.movingPart}`)}));}
assert.equal(samples[0].greenShroudRemainedFixedAndIncluded,true);
assert.ok(samples.some(s=>s.surfaceIntersections>0),'Must reveal rigid shroud interference instead of claiming arbitrary safe yaw');
assert.deepEqual({loco:digest(lm.parts),coach:digest(cm.parts),shell:digest(coach.parts),shroud:digest(flex.parts)},before);
const report={schema:'kaopu.a6-coupling-motion-test/1.0',passed:true,runtimeMechanics:'correctA6Mechanics(original).mechanics',originalSourceSha256,correctedRuntimeSha256:before.loco,runtimeCorrectionCount:correction.corrections.length,analyticPoseCount:poses.length,maxClosureErrorM:Math.max(...poses.map(p=>p.closureErrorM)),nativeHashesBeforeAndAfter:before,originalCounts:{loco:lm.parts.length,coach:cm.parts.length,coachShell:coach.parts.length,shroud:flex.parts.length},conceptEvidence:concept.evidence,meshAuditCounts:auditor.inputCounts,samples,continuousSafeRangeEstablished:false,disclaimer:'Actual-mesh discrete inspection. Added joint mount/attachment engineering, whole-train dynamics and continuous swept volume remain unverified.'};
writeFileSync(new URL('./coupling-motion.qa.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log('PASS actual-mesh interference remains visible, hashes unchanged, written coupling-motion.qa.json');
