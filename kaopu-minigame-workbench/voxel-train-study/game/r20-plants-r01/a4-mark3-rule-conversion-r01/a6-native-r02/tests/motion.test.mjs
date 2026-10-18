import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLocomotiveMechanics} from '../../student-native-r01/src/locomotive-mechanics.mjs';
import {buildDrivingWheel} from '../../student-native-r01/src/driving-wheel.mjs';
import {correctA6Mechanics} from '../src/a6-motion-corrections.mjs';
import {createA6MotionModel,evaluateA6Motion,validateA6MotionCycle,transformA6Point,trianglesIntersectA6,screenA6SweptInterference,inspectA6MeshSurfacePair} from '../src/a6-motion.mjs';

const hash=parts=>createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const source=buildLocomotiveMechanics(),wheel=buildDrivingWheel(),sourceHash=hash(source.parts),wheelHash=hash(wheel.parts);
const corrected=correctA6Mechanics(source),m=createA6MotionModel({mechanics:corrected.mechanics,wheel});
assert.equal(correctA6Mechanics(corrected.mechanics).mechanics,corrected.mechanics);
const near=(a,b,tolerance=1e-10)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
assert.equal(source.parts.length,338);
assert.equal(corrected.mechanics.parts.length,338);
assert.deepEqual(corrected.mechanics.parts.map(p=>p.name),source.parts.map(p=>p.name));
assert.equal(m.movingPartNames.length,22); // 18 original names, 2 rod extensions, 2 working piston heads.
assert.equal(m.supplementalParts.length,4);
assert.equal(m.wheelInstances.length,6);
assert.equal(new Set(m.movingPartNames).size,m.movingPartNames.length);
assert.equal(m.sourceGeometryMutated,false);
assert.equal(m.allMechanismsSolved,false);
assert.deepEqual(m.axes.map(a=>a.z),[3.5814,5.7912,8.001]);
near(m.parameters.driveDiameter,2.032);near(m.radius,.3302);near(m.parameters.cylinderStroke,.6604);
near(m.parameters.cylinderHeight,1.016);

const unit=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const start=evaluateA6Motion(m,0);
for(const matrix of Object.values(start.partTransforms))assert.deepEqual(matrix,unit);
assert.deepEqual(evaluateA6Motion(m,2*Math.PI),start);
assert.deepEqual(evaluateA6Motion(m,-2*Math.PI),start);
assert.deepEqual(evaluateA6Motion(m,6*Math.PI),start);
const report=validateA6MotionCycle(m,{samples:1440});
assert.equal(report.supportedLoopPass,true);
near(report.cycleClosureError,0);near(report.maximumAxisErrorM,0);
assert(report.maximumJointErrorM<1e-12);
assert(report.maximumRodLengthErrorM<1e-12);
near(report.crossheadTravelM,.6604);
assert.equal(report.fullVehicleApproval,false);
assert(report.pistonEngagement.minimumRearCoverEngagementM>.10);
assert(report.pistonEngagement.minimumFrontCoverClearanceM>.07);
assert(report.pistonEngagement.headFrontToFrontCoverMinimumM>.018);
assert(report.pistonEngagement.headRearToRearCoverMinimumM>.051);
near(report.pistonEngagement.radialClearanceM,.002);
near(report.pistonEngagement.boreRadiusM*2,.4699);
for(const side of[-1,1]){
  const cylinder=corrected.mechanics.parts.find(p=>p.name===`outside-cylinder-${side}`);
  near(cylinder.metadata.wallThicknessM,.02005);near(cylinder.metadata.glandBoreRadiusM,.040);
  assert.equal(cylinder.metadata.coverBoltCount,24);
  for(const carrying of corrected.mechanics.parts.filter(p=>/^leading-[12]-wheel-/.test(p.name)))assert.equal(inspectA6MeshSurfacePair(cylinder,carrying).surfaceWitness,null,`Revised cylinder intersects ${carrying.name}`);
}

// Every mesh remains rigid; no point dictionary, phase cache or geometry rewriting.
for(let i=0;i<=72;i++){
  const angle=i*Math.PI/36,pose=evaluateA6Motion(m,angle);
  for(const d of m.descriptors){
    const original=d.part.positions,a=Array.from(original.slice(0,3)),b=Array.from(original.slice(-3));
    const aa=transformA6Point(pose.partTransforms[d.name],a),bb=transformA6Point(pose.partTransforms[d.name],b);
    near(Math.hypot(...aa.map((v,k)=>v-bb[k])),Math.hypot(...a.map((v,k)=>v-b[k])),2e-12);
  }
  for(const w of pose.wheelTransforms){
    const center=transformA6Point(w.matrix,[0,0,0]),pin=transformA6Point(w.matrix,[0,m.radius,0]);
    w.center.forEach((v,k)=>near(center[k],v));
    near(pin[1],m.axleY+m.radius*Math.cos(angle));
    near(pin[2],w.center[2]+m.radius*Math.sin(angle));
  }
  for(const side of[-1,1]){
    const rod=pose.partTransforms[`outside-piston-rod-${side}`],extension=pose.partTransforms[`a6-piston-rod-hidden-extension-${side}`];
    assert.deepEqual(rod,extension);
    assert.deepEqual(rod,pose.partTransforms[`a6-working-piston-head-${side}`]);
    const z=transformA6Point(extension,[side*m.parameters.cylinderHalfSeparation,1.016,1.58-.42])[2];
    assert(z>.74&&z<1.58);
    const links=pose.joints.find(j=>j.side===side).links;
    near(Math.abs(links[0].a[0]-links[1].a[0]),.060);
  }
}
// Conservative continuous sweep speed bounds must dominate actual vertex travel.
for(let i=0;i<24;i++){
  const a=evaluateA6Motion(m,i*Math.PI/12),b=evaluateA6Motion(m,i*Math.PI/12+.001);
  for(const d of m.descriptors)for(let k=0;k<d.part.positions.length;k+=Math.max(3,Math.floor(d.part.positions.length/18/3)*3)){
    const p=Array.from(d.part.positions.slice(k,k+3));if(p.length!==3)continue;
    const aa=transformA6Point(a.partTransforms[d.name],p),bb=transformA6Point(b.partTransforms[d.name],p);
    assert(Math.hypot(...aa.map((v,j)=>v-bb[j]))<=d.speedBound*.001+1e-10);
  }
}
assert(trianglesIntersectA6([[0,0,0],[1,0,0],[0,1,0]],[[.1,.1,-1],[.1,.1,1],[.4,.4,0]]));
assert(!trianglesIntersectA6([[0,0,0],[1,0,0],[0,1,0]],[[2,2,0],[3,2,0],[2,3,0]]));
assert(!trianglesIntersectA6([[0,0,0],[1,0,0],[0,1,0]],[[0,0,1],[1,0,1],[0,1,1]]));
assert(trianglesIntersectA6([[0,0,0],[1,0,0],[0,1,0]],[[0,0,0],[.5,0,0],[0,.5,0]]));
assert.throws(()=>evaluateA6Motion(m,NaN),/finite/);
assert.throws(()=>validateA6MotionCycle(m,{samples:0}));
assert.throws(()=>screenA6SweptInterference(m,{stepDegrees:0}));
assert.throws(()=>createA6MotionModel({mechanics:{...corrected.mechanics,parameters:{...corrected.mechanics.parameters,driveDiameter:2}},wheel}),/locks/);
assert.throws(()=>createA6MotionModel({mechanics:{...corrected.mechanics,parts:corrected.mechanics.parts.filter(p=>p.name!=='coupling-rod-1-0')},wheel}),/Missing/);
assert.equal(hash(source.parts),sourceHash,'Original mechanical source arrays changed');
assert.equal(hash(wheel.parts),wheelHash,'Original wheel source arrays changed');
for(const name of m.unsupportedPartNames)assert(!m.movingPartNames.includes(name),'Unsolved source gear was falsely animated');
assert(!m.movingPartNames.some(name=>/buffer|drawbar|reverser|valve|inside/.test(name)));
console.log(JSON.stringify({status:'PASS',scope:'native A6 rigid motion/correction contract',componentNamesPreserved:338,explicitAddedParts:4,cycleSamples:report.samples,strokeM:report.crossheadTravelM,maxJointErrorM:report.maximumJointErrorM,originalMechanicalSHA256:sourceHash,originalWheelSHA256:wheelHash,allMechanismsSolved:false}));
