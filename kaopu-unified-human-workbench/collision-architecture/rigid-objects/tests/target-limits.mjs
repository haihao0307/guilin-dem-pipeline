import assert from 'node:assert/strict';
import {RigidObjectWorld} from '../RigidObjectWorld.mjs';

const dt=1/120;
const rotationY=angle=>[0,Math.sin(angle/2),0,Math.cos(angle/2)];
const nearVector=(actual,expected,tolerance=1e-4)=>{
  assert.equal(actual.length,expected.length);
  actual.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<tolerance,
    `Component ${index}: ${value} differs from ${expected[index]}`));
};
const nearRotation=(actual,expected)=>assert.ok(
  Math.abs(actual.reduce((sum,value,index)=>sum+value*expected[index],0))>1-1e-5,
  'Orientation differs from the accepted target');
const results={};

const queued=await RigidObjectWorld.create({gravity:[0,0,0]});
try{
  queued.addRigid({id:'box',shape:{kind:'box',halfExtents:[.1,.1,.1]},position:[0,1,0]});
  queued.grab('box');
  const before=queued.getTransform('box');
  const valid={position:[.1,1,0],rotation:rotationY(.05)};
  queued.setKinematicTarget('box',valid);
  assert.throws(()=>queued.setKinematicTarget('box',{position:[3,1,0]}),/exceed|limit|speed|velocity/i);
  assert.deepEqual(queued.getTransform('box'),before,'Rejected translation changed the actual pose/state');
  assert.throws(()=>queued.setKinematicTarget('box',{position:[0,1,0],rotation:rotationY(1)}),/exceed|limit|speed|velocity/i);
  assert.deepEqual(queued.getTransform('box'),before,'Rejected rotation changed the actual pose/state');
  assert.throws(()=>queued.release('box'),/Step the queued/,'Rejected targets discarded the earlier queued target');
  queued.step();
  const held=queued.getTransform('box');
  nearVector(held.position,valid.position);
  nearRotation(held.rotation,valid.rotation);
  nearVector(held.linearVelocity,[12,0,0]);
  nearVector(held.angularVelocity,[0,6,0],.002);
  const released=queued.release('box');
  assert.equal(released.motion,'dynamic');
  nearVector(released.linearVelocity,held.linearVelocity);
  nearVector(released.angularVelocity,held.angularVelocity);
  results.rejectedTargetsPreserveQueue={translationM:3,rotationRad:1,inheritedSpeedMps:Math.hypot(...released.linearVelocity)};
}finally{queued.dispose();}

const offset=await RigidObjectWorld.create({gravity:[0,0,0]});
try{
  offset.addRigid({id:'hull',shape:{kind:'convex-hull',points:[[5,0,0],[5.4,0,0],[5,.4,0],[5,0,.4]]},position:[0,1,0]});
  offset.grab('hull');
  const before=offset.getTransform('hull');
  const valid={position:before.position,rotation:rotationY(.1)};
  offset.setKinematicTarget('hull',valid);
  const angle=.5;
  const target={position:before.position,rotation:rotationY(angle)};
  const expectedCOMSpeed=2*Math.hypot(5.1,.1)*Math.sin(angle/2)/dt;
  assert.ok(expectedCOMSpeed>200);
  assert.ok(angle/dt<100,'This fixture must not fail solely on angular speed');
  assert.throws(()=>offset.setKinematicTarget('hull',target),/exceed|limit|speed|velocity/i);
  assert.deepEqual(offset.getTransform('hull'),before,'Rejected COM motion changed the actual pose/state');
  offset.step();
  const held=offset.getTransform('hull');
  nearVector(held.position,valid.position);
  nearRotation(held.rotation,valid.rotation);
  assert.ok(Math.hypot(...held.linearVelocity)>50,'Offset rotation must produce a nonzero COM velocity');
  const released=offset.release('hull');
  nearVector(released.linearVelocity,held.linearVelocity);
  nearVector(released.angularVelocity,held.angularVelocity);
  results.offsetCOMLimit={originTravelM:0,rejectedCOMSpeedMps:expectedCOMSpeed,angularSpeedRadps:angle/dt};
}finally{offset.dispose();}

const boundary=await RigidObjectWorld.create({gravity:[0,0,0]});
try{
  boundary.addRigid({id:'box',shape:{kind:'box',halfExtents:[.1,.1,.1]},position:[0,1,0]});
  boundary.grab('box');
  // Stay just inside the physical caps so float32 conversion is not itself a failure.
  const linearSpeed=200-.1,angularSpeed=100-.1;
  boundary.setKinematicTarget('box',{position:[linearSpeed*dt,1,0],rotation:rotationY(angularSpeed*dt)});
  boundary.step();
  const held=boundary.getTransform('box');
  assert.ok(Math.abs(Math.hypot(...held.linearVelocity)-linearSpeed)<.002);
  assert.ok(Math.abs(Math.hypot(...held.angularVelocity)-angularSpeed)<.002);
  const released=boundary.release('box');
  nearVector(released.linearVelocity,held.linearVelocity);
  nearVector(released.angularVelocity,held.angularVelocity);
  // An equivalent quaternion with the opposite sign must use the shortest arc.
  boundary.grab('box');
  const current=boundary.getTransform('box');
  boundary.setKinematicTarget('box',{position:current.position,rotation:current.rotation.map(value=>-value)});
  boundary.step();
  const equivalent=boundary.release('box');
  assert.ok(Math.hypot(...equivalent.linearVelocity)<.002);
  assert.ok(Math.hypot(...equivalent.angularVelocity)<.002);
  results.acceptedBoundaries={linearSpeedMps:Math.hypot(...released.linearVelocity),angularSpeedRadps:Math.hypot(...released.angularVelocity),shortestArc:true};
}finally{boundary.dispose();}

console.log(JSON.stringify({passed:true,source:'Actual official Jolt WASM',results}));
