import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import {BODY_MOTION_SPEC,createBodyMotion} from '../body-motion.mjs';
import {createSteamLocomotive,STEAM_SPEC} from '../steam-model.mjs';
import {createSteamLocomotive as createR12} from '../r12/steam-model.mjs';
import {createGameTrain,COACH_BODY_MOTION_SPEC} from '../train-model.mjs';
import {createGameTrain as createR12Train} from '../r12/train-model.mjs';

const axes=['heave','lateral','roll','pitch'];
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const frame=(tick,distance,velocity,extra={})=>({tick,elapsed:tick/30,distance,velocity,started:true,paused:false,throttle:2,onboard:7,phase:'running',door:0,...extra});
function roll(controller,start=0,count=180,speed=8){for(let i=start;i<=start+count;i++)controller.update(frame(i,i*speed/30,speed));return controller.state;}
function triangleSignature(meshes){
  const hashes=[],triangle=new Float32Array(27);
  for(const mesh of meshes){const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,attributes=geometry.attributes;for(let i=0;i<attributes.position.count;i+=3){let at=0;for(const key of ['position','normal','color'])for(let j=0;j<9;j++)triangle[at++]=attributes[key].array[i*3+j];hashes.push(createHash('sha256').update(new Uint8Array(triangle.buffer)).digest('hex'));}if(geometry!==mesh.geometry)geometry.dispose();}
  return createHash('sha256').update(hashes.sort().join('')).digest('hex');
}

test('R13 splits the original fixed batch without changing any primitive triangle, normal or colour',()=>{
  const old=createR12(),current=createSteamLocomotive(),original=old.root.getObjectByName('Batched riveted steam engine and tender');
  const fixed=current.root.getObjectByName('Fixed chassis cylinders and coal-water tender'),upper=current.root.getObjectByName('Batched riveted locomotive upper body');
  assert.equal(triangleSignature([original]),triangleSignature([fixed,upper]));
  assert.equal(current.proof.staticParts,old.proof.staticParts);assert.equal(current.proof.staticTriangles,old.proof.staticTriangles);
  assert.equal(current.proof.staticParts,935);assert.equal(current.proof.staticTriangles,23532);
  let meshes=0;current.root.traverse(object=>{if(object.isMesh)meshes++;});assert.equal(meshes,10);assert.equal(current.proof.drawCalls,meshes);
  assert.equal(current.wheels.length,old.wheels.length);assert.equal(current.proof.rodInstances,old.proof.rodInstances);
});

test('Motion is deterministic, distance phased, and speed/load/acceleration driven within a shared hard budget',()=>{
  const options={heave:5,lateral:5,rollDegrees:10,pitchDegrees:10},a=createBodyMotion(options),b=createBodyMotion(options),spec=BODY_MOTION_SPEC;
  assert.equal(a.proof.amplitude.heave,spec.limits.heave);assert.equal(a.proof.amplitude.lateral,spec.limits.lateral);
  near(a.proof.amplitude.roll,spec.limits.rollDegrees*Math.PI/180);near(a.proof.amplitude.pitch,spec.limits.pitchDegrees*Math.PI/180);
  let distance=0,peak=0;
  for(let tick=0;tick<2400;tick++){
    const speed=9+8*Math.sin(tick/120);distance+=speed/30;
    const view=frame(tick,distance,speed,{throttle:tick%300>150?3:0,onboard:tick%16});
    a.update(view);b.update(view);assert.deepEqual(a.state,b.state);let budget=0;
    for(const key of axes){const x=a.state[key],cap=a.proof.amplitude[key];assert.ok(Number.isFinite(x));assert.ok(Math.abs(x)<=cap+1e-12);budget+=(x/cap)**2;peak=Math.max(peak,Math.abs(x));}
    assert.ok(budget<=1+1e-12);assert.ok(Math.abs(a.state.acceleration)<=spec.accelerationLimit+1e-12);assert.ok(a.state.envelope>=0&&a.state.envelope<=1);assert.equal(a.state.phaseDistance,distance);
  }
  assert.ok(peak>.001);
  const light=createBodyMotion(),loaded=createBodyMotion();
  for(let tick=0;tick<300;tick++){light.update(frame(tick,tick/3,10,{load:0}));loaded.update(frame(tick,tick/3,10,{load:1}));}
  assert.ok(loaded.state.envelope>light.state.envelope+.1);
});

test('A paused or duplicate simulation frame does not advance; resuming matches uninterrupted motion',()=>{
  const paused=createBodyMotion(),control=createBodyMotion();roll(paused);roll(control);
  const before={...paused.state},last=frame(180,48,8);
  for(let i=0;i<90;i++)paused.update({...last,paused:true},.25);
  assert.deepEqual(paused.state,before);
  for(let i=0;i<90;i++)paused.update(last,.25);
  assert.deepEqual(paused.state,before);
  paused.update(frame(181,181*8/30,8));control.update(frame(181,181*8/30,8));assert.deepEqual(paused.state,control.state);
  const previous=before;assert.ok(Math.abs(paused.state.heave-previous.heave)<.0003);assert.ok(Math.abs(paused.state.roll-previous.roll)<.0001);
});

test('Zero speed settles monotonically to exact neutral, even at full regulator, with no parked phase drift',()=>{
  const m=createBodyMotion();roll(m);const stoppedDistance=m.state.phaseDistance;let previous={...m.state};
  for(let tick=181;tick<850;tick++){
    m.update(frame(tick,stoppedDistance,0,{throttle:3,onboard:16}));
    for(const key of axes)assert.ok(Math.abs(m.state[key])<=Math.abs(previous[key])+1e-14);
    assert.equal(m.state.phaseDistance,stoppedDistance);previous={...m.state};
  }
  for(const key of axes)assert.equal(m.state[key],0);assert.equal(m.state.envelope,0);assert.equal(m.state.active,false);
  for(let tick=850;tick<1100;tick++)m.update(frame(tick,stoppedDistance,0,{throttle:tick%4,onboard:tick%16}));
  for(const key of axes)assert.equal(m.state[key],0);
});

test('Explicit reset and simulation rewind restore a clean start; disabling is reflected in proof',()=>{
  const m=createSteamLocomotive();for(let tick=0;tick<180;tick++)m.updateBodyMotion(frame(tick,tick/3,10));assert.equal(m.bodyMotion.state.active,true);
  m.resetBodyMotion();for(const key of axes)assert.equal(m.bodyMotion.state[key],0);assert.deepEqual(m.body.position.toArray(),[.55,1.55,0]);assert.equal(m.body.rotation.x,0);assert.equal(m.body.rotation.z,0);
  for(let tick=0;tick<180;tick++)m.updateBodyMotion(frame(tick,tick/3,10));m.updateBodyMotion(frame(0,0,0));for(const key of axes)assert.equal(m.bodyMotion.state[key],0);
  m.bodyMotion.setEnabled(false);assert.equal(m.proof.bodyMotion.enabled,false);for(let tick=1;tick<180;tick++)m.updateBodyMotion(frame(tick,tick/3,10));assert.equal(m.bodyMotion.state.active,false);
  const byTick=createBodyMotion();for(let tick=0;tick<180;tick++){const view=frame(tick,tick/3,10);delete view.elapsed;byTick.update(view);}assert.equal(byTick.state.active,true);
});

test('Upper body and its emission anchors follow together while wheel axes, rods, cylinders and tender retain R12 contact',()=>{
  const m=createSteamLocomotive({bodyMotion:BODY_MOTION_SPEC.limits}),old=createR12(),point=new THREE.Vector3(),matrix=new THREE.Matrix4(),fixed=m.root.getObjectByName('Fixed chassis cylinders and coal-water tender');
  const contents=m.body.getObjectByName('Boiler cab crew glazing and headlamp');
  for(const name of ['Original placeholder driver head and peaked cap','Cab glazing','Amber headlamp and firebox glow'])assert.equal(m.root.getObjectByName(name).parent,contents);
  const lamp=contents.children.find(object=>object.isSpotLight);assert.ok(lamp);assert.equal(lamp.target.parent,contents);
  const originalWheelPositions=m.wheels.map(wheel=>wheel.position.toArray());
  let maxDisplacement=0;
  for(let tick=0;tick<480;tick++){
    const distance=tick*.5,view=frame(tick,distance,15);m.update(distance);old.update(distance);m.updateBodyMotion(view);m.root.updateMatrixWorld(true);
    assert.equal(fixed.parent,m.root);assert.deepEqual(fixed.matrixWorld.elements,new THREE.Matrix4().elements);
    assert.deepEqual(m.wheels.map(wheel=>wheel.position.toArray()),originalWheelPositions);assert.deepEqual(m.motion,old.motion);
    for(const wheel of m.wheels){near(wheel.position.y-wheel.userData.radius,STEAM_SPEC.railHead);assert.equal(wheel.userData.batch.parent,m.root);wheel.userData.batch.getMatrixAt(wheel.userData.instance,matrix);near(matrix.elements[13]-wheel.userData.radius,STEAM_SPEC.railHead,1e-7);}
    for(const name of ['Distance-driven coupled rods and piston slides','Animated crank and crosshead pin caps']){const current=m.root.getObjectByName(name),baseline=old.root.getObjectByName(name);assert.equal(current.parent,m.root);assert.deepEqual(current.instanceMatrix.array,baseline.instanceMatrix.array);}
    for(const source of [STEAM_SPEC.chimney,[-.60,3.50,-.36],[4.40,1.94,0],[-2.12,.65,1.13],[-2.12,3.55,-1.13],[4.5,3.72,1.13]]){
      const output=[0,0,0];assert.equal(m.transformBodyPoint(source,output),output);point.fromArray(source).applyMatrix4(contents.matrixWorld);output.forEach((x,i)=>near(x,point.getComponent(i)));maxDisplacement=Math.max(maxDisplacement,Math.hypot(...output.map((x,i)=>x-source[i])));
    }
  }
  assert.ok(maxDisplacement>.001&&maxDisplacement<.012,`Largest sampled local-point displacement: ${maxDisplacement}`);
  const angle=m.motion.angle;for(let tick=480;tick<720;tick++){m.update(479*.5);m.updateBodyMotion(frame(tick,479*.5,0));assert.equal(m.motion.angle,angle);}
});

test('Whole-train integration leaves both coach roots, couplers and all wheel contacts outside body motion',()=>{
  const train=createGameTrain(),baseline=createGameTrain({bodyMotion:{enabled:false}});
  for(let tick=0;tick<120;tick++){const view=frame(tick,tick*.25,7.5);train.update(view);baseline.update(view);}
  assert.equal(train.steam.bodyMotion.state.active,true);assert.equal(baseline.steam.bodyMotion.state.active,false);
  for(let i=0;i<train.coaches.length;i++){assert.equal(train.coaches[i].root.parent,train.root);assert.deepEqual(train.coaches[i].root.position.toArray(),baseline.coaches[i].root.position.toArray());assert.deepEqual(train.coaches[i].root.quaternion.toArray(),baseline.coaches[i].root.quaternion.toArray());}
  assert.deepEqual(train.wheels.map(wheel=>[...wheel.position.toArray(),wheel.rotation.z]),baseline.wheels.map(wheel=>[...wheel.position.toArray(),wheel.rotation.z]));
  const before={...train.steam.bodyMotion.state};train.update(frame(119,119*.25,7.5,{paused:true}),{dt:1});assert.deepEqual(train.steam.bodyMotion.state,before);
});

test('Both coach chassis splits preserve all old triangles and maintain independent low-amplitude body phases',()=>{
  const train=createGameTrain(),old=createR12Train();
  for(let i=0;i<2;i++){
    const coach=train.coaches[i],baseline=old.coaches[i],oldBody=baseline.root.children.find(object=>object.isMesh&&!object.isInstancedMesh);
    assert.equal(triangleSignature([coach.bodyMesh,coach.fixedMesh]),triangleSignature([oldBody]));
    assert.equal(coach.proof.originalBlocks,baseline.proof.originalBlocks);assert.equal(coach.proof.bodyBlocks+coach.proof.fixedBlocks,baseline.proof.bodyBlocks);
    assert.equal(coach.fixedMesh.parent,coach.root);assert.ok(coach.proof.fixedBlocks>0);assert.equal(coach.roof.parent,coach.bodyMesh.parent);
    for(const door of coach.doors)for(const leaf of door.leaves)assert.equal(leaf.mesh.parent,coach.bodyMesh.parent);
  }
  let phaseDifference=0;
  for(let tick=0;tick<300;tick++){
    const view=frame(tick,tick/3,10);train.update(view);old.update(view);train.root.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
      const coach=train.coaches[i],state=coach.bodyMotion.state,amplitude=coach.bodyMotion.proof.amplitude;
      for(const key of axes)assert.ok(Math.abs(state[key])<=amplitude[key]+1e-12);
      assert.ok(Math.abs(state.heave)<=COACH_BODY_MOTION_SPEC.amplitude.heave);assert.deepEqual(coach.fixedMesh.matrixWorld.elements,new THREE.Matrix4().elements);
    }
    phaseDifference=Math.max(phaseDifference,Math.abs(train.coaches[0].bodyMotion.state.heave-train.coaches[1].bodyMotion.state.heave));
    assert.deepEqual(train.wheels.map(w=>[...w.position.toArray(),w.rotation.z]),old.wheels.map(w=>[...w.position.toArray(),w.rotation.z]));
  }
  assert.ok(phaseDifference>.0005);assert.equal(train.proof.bodyMotionExtraDrawCalls,3);
  train.setBodyMotionEnabled(false);assert.equal(train.proof.coachBodyMotion.coaches[0].enabled,false);assert.equal(train.proof.bodyMotion.enabled,false);
  for(let tick=300;tick<600;tick++)train.update(frame(tick,tick/3,10));for(const coach of train.coaches)assert.equal(coach.bodyMotion.state.active,false);
});

test('Coach passenger anchors follow their actual floor transform; paused, stopped and reset poses remain clean',()=>{
  const train=createGameTrain(),sources=[[-11.1,1.04,.62],[-18,1.04,-.62]],v=new THREE.Vector3();
  train.root.position.set(12,.5,-2);train.root.rotation.y=.3;
  for(let tick=0;tick<180;tick++)train.update(frame(tick,tick*.25,7.5));train.root.updateMatrixWorld(true);
  for(let index=0;index<2;index++){
    const source=sources[index],local=[],output=train.transformPassengerPoint(source,local),expected=v.fromArray(source).applyMatrix4(train.coaches[index].bodyMesh.parent.matrixWorld).toArray(),actual=new THREE.Vector3(...output).applyMatrix4(train.root.matrixWorld).toArray();
    assert.equal(output,local);actual.forEach((x,i)=>near(x,expected[i]));assert.deepEqual(train.transformCoachPoint(index,source),output);
  }
  assert.deepEqual(train.transformPassengerPoint([4,1,0]),[4,1,0]);
  const before=train.coaches.map(coach=>({...coach.bodyMotion.state}));for(let n=0;n<10;n++)train.update(frame(179,179*.25,7.5,{paused:true}));assert.deepEqual(train.coaches.map(coach=>coach.bodyMotion.state),before);
  let prior=before;for(let tick=180;tick<600;tick++){train.update(frame(tick,179*.25,0));for(let i=0;i<2;i++)for(const key of axes)assert.ok(Math.abs(train.coaches[i].bodyMotion.state[key])<=Math.abs(prior[i][key])+1e-14);prior=train.coaches.map(coach=>({...coach.bodyMotion.state}));}
  for(const coach of train.coaches)assert.equal(coach.bodyMotion.state.active,false);
  train.resetBodyMotion();for(const coach of train.coaches)for(const key of axes)assert.equal(coach.bodyMotion.state[key],0);for(let i=0;i<2;i++)train.transformPassengerPoint(sources[i]).forEach((x,j)=>near(x,sources[i][j]));
});
