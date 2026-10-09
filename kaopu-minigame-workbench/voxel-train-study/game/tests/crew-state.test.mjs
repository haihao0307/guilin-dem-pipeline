import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {CREW_SPEC,driverCrewPose,attendantCrewPose} from '../crew-state.mjs';
import {createSteamLocomotive} from '../steam-model.mjs';
import {createSteamLocomotive as createR10Locomotive} from '../r10/steam-model.mjs';
import {createGameTrain} from '../train-model.mjs';
import {createStationPlatform,PLATFORM_SPEC} from '../station-platform.mjs';
import {Session,replay,FRONT_X,COACHES} from '../session.mjs';

globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
const near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
const station=()=>createStationPlatform({index:0,name:'尖沙咀',english:'Kowloon'});
const forward=mesh=>{mesh.updateMatrixWorld(true);return new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld).toArray();};
const nearVector=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
const renderedPose=(train,platform)=>{
  train.root.updateMatrixWorld(true);platform.group.updateMatrixWorld(true);
  return{driver:train.steam.crew.driverHead.matrix.toArray(),hand:platform.crew.hand.matrix.toArray(),driverPose:{...train.steam.crew.pose},attendantPose:{...platform.crew.pose}};
};
const update=(train,platform,view)=>{train.update(view);platform.updateCrew(view,view.station.index===0);return renderedPose(train,platform);};

test('The actual driver face points +X in motion and +Z when stopped beside a platform',()=>{
  const train=createGameTrain(),head=train.steam.crew.driverHead;
  for(const velocity of [.002,.06,1,18,-1.8])for(const remaining of [0,100]){
    train.update({distance:12,door:0,phase:'running',velocity,station:{remaining}});
    nearVector(forward(head),[1,0,0]);assert.equal(train.proof.placeholderDriver.pose.facing,'forward');
  }
  for(const phase of ['ready','running','boarding','ready-depart','doors-closing']){
    train.update({distance:0,door:1,phase,velocity:0,station:{remaining:0}});
    nearVector(forward(head),[0,0,1]);assert.equal(train.proof.placeholderDriver.pose.facing,'platform');
  }
  assert.equal(driverCrewPose({velocity:0,station:{remaining:80}}).facing,'forward');
  assert.deepEqual(head.position.toArray(),CREW_SPEC.driverHead);
  // Nothing in the pose API accepts a camera; changing an unrelated camera
  // cannot turn a head back toward the viewer.
  const camera=new THREE.PerspectiveCamera();camera.position.set(-30,14,-20);camera.lookAt(0,0,0);
  nearVector(forward(head),[0,0,1]);
});

test('Splitting the driver preserves every original body/head vertex, normal and colour, including the cap',()=>{
  const current=createSteamLocomotive(),old=createR10Locomotive();
  const bodies=['Fixed chassis cylinders and coal-water tender','Batched riveted locomotive upper body'].map(name=>current.root.getObjectByName(name)),oldBody=old.root.getObjectByName('Batched riveted steam engine and tender'),head=current.crew.driverHead;
  const vertices=meshes=>meshes.flatMap(mesh=>{
    const {position,normal,color}=mesh.geometry.attributes,values=[],p=new THREE.Vector3();
    for(let i=0;i<position.count;i++){
      p.fromBufferAttribute(position,i).add(mesh.position);
      values.push([...p.toArray(),normal.getX(i),normal.getY(i),normal.getZ(i),color.getX(i),color.getY(i),color.getZ(i)].map(v=>Math.round(v*10000)).join(','));
    }
    return values;
  }).sort();
  assert.deepEqual(vertices([...bodies,head]),vertices([oldBody]));
  assert.equal(current.proof.placeholderDriver.cap,old.proof.placeholderDriver.cap);
  for(const name of ['Eight large spoked driving wheels','Small steel railway wheels','Distance-driven coupled rods and piston slides']){
    const a=current.root.getObjectByName(name).geometry,b=old.root.getObjectByName(name).geometry;
    assert.deepEqual(a.attributes.position.array,b.attributes.position.array);
    assert.deepEqual(a.index?.array,b.index?.array);
  }
  for(const distance of [0,1,19.25]){current.update(distance);old.update(distance);assert.deepEqual(current.motion,old.motion);}
});

test('A real door-close sequence gestures once, pauses exactly, and restores without stale animation',()=>{
  const game=new Session({line:'kcr1',seed:'R11-CREW'}),train=createGameTrain(),platform=station();
  game.command('start');game.stepTicks(30);assert.equal(game.command('station-action').accepted,true);
  while(game.phase!=='ready-depart'&&game.tick<1600)game.stepTicks(1);
  assert.equal(game.phase,'ready-depart');game.command('station-action');
  const raises=[];
  for(let i=0;i<12;i++){const view=game.view();update(train,platform,view);raises.push(platform.crew.pose.raise);game.stepTicks(1);}
  game.command('pause',true);const frozen=update(train,platform,game.view());
  for(let i=0;i<20;i++){game.advance(2);assert.deepEqual(update(train,platform,game.view()),frozen);}
  const restored=replay(game.replayPacket()),restoredTrain=createGameTrain(),restoredPlatform=station();
  assert.deepEqual(update(restoredTrain,restoredPlatform,restored.view()),frozen);
  game.command('pause',false);
  while(game.phase==='doors-closing'){update(train,platform,game.view());raises.push(platform.crew.pose.raise);game.stepTicks(1);}
  update(train,platform,game.view());raises.push(platform.crew.pose.raise);
  assert.equal(raises[0],0);assert.equal(raises.at(-1),0);assert.equal(Math.max(...raises),1);
  let previous=0,risingWindows=0;for(const value of raises){if(value>0&&previous===0)risingWindows++;previous=value;}
  assert.equal(risingWindows,1);
  const plateau=raises.indexOf(1),lastPlateau=raises.lastIndexOf(1);
  for(let i=1;i<=plateau;i++)assert.ok(raises[i]>=raises[i-1]);
  for(let i=lastPlateau+1;i<raises.length;i++)assert.ok(raises[i]<=raises[i-1]);
  // Reusing the rendered scene for a new game has no previous event latch.
  const reset=update(train,platform,new Session({line:'kcr1',seed:'NEW-CREW'}).view());
  assert.equal(reset.attendantPose.raise,0);assert.equal(reset.driverPose.facing,'platform');
  assert.equal(attendantCrewPose({phase:'doors-closing',door:.5},false).raise,0);
  platform.dispose();restoredPlatform.dispose();
});

test('Attendant feet and swept gesture stay on the deck, outside rails and actual passenger paths at all legal stop offsets',()=>{
  const platform=station(),crewMeshes=platform.crew.root.children;
  const paths=[];
  // These limits come from Session.platformCoversDoors(), including its 22 cm
  // door margin, rather than only the nominal stopping-zone radius.
  const minOffset=-31+.22-(Math.min(...COACHES.map(c=>c.rearDoor))-FRONT_X);
  const maxOffset=-7-.22-(Math.max(...COACHES.map(c=>c.frontDoor))-FRONT_X);
  for(const offset of [minOffset+.0001,-2.8,0,2.8,maxOffset-.0001]){
    const game=new Session({line:'kcr1',seed:'R11-ROUTES'});game.command('start');game.activateStation(1);
    game.distance=game.station.target+offset;game.velocity=0;game.stopStable=1;
    assert.equal(game.canOpen(),true);game.command('station-action');
    for(let i=0;i<1500&&game.phase!=='ready-depart';i++){
      for(const actor of game.actors)if(actor.path){
        const points=actor.path.points.map(p=>[p[0]-game.station.target+FRONT_X,p[1],p[2]]);
        const key=JSON.stringify(points);if(!paths.some(p=>p.key===key))paths.push({key,points});
      }
      game.stepTicks(1);
    }
    assert.equal(game.phase,'ready-depart');
  }
  assert.ok(paths.length>15);
  for(let step=0;step<=20;step++){
    platform.updateCrew({phase:'doors-closing',door:1-step/20},true);platform.group.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(platform.crew.root);
    near(bounds.min.y,PLATFORM_SPEC.top);assert.ok(bounds.min.z>PLATFORM_SPEC.minZ+.15);
    assert.ok(bounds.max.z<PLATFORM_SPEC.maxZ);assert.ok(bounds.min.x>PLATFORM_SPEC.clearWalkway.max[0]);
    for(const {points}of paths)for(let j=1;j<points.length;j++){
      // A sampled adult torso with 18 cm lateral clearance along the actual
      // Session boarding, alighting and departure polylines.
      for(const height of [.25,.55,.85])for(const dx of [-.18,0,.18])for(const dz of [-.18,0,.18]){
        const a=new THREE.Vector3(...points[j-1]).add(new THREE.Vector3(dx,height,dz)),b=new THREE.Vector3(...points[j]).add(new THREE.Vector3(dx,height,dz)),length=a.distanceTo(b);
        if(length<.001)continue;
        const hits=new THREE.Raycaster(a,b.sub(a).normalize(),0,length).intersectObjects(crewMeshes,false);
        assert.equal(hits.length,0,`Crew obstructs ${points[j]} at gesture ${step/20}`);
      }
    }
  }
  platform.updateCrew({phase:'doors-closing',door:.5},true);platform.group.updateMatrixWorld(true);
  const actualHand=new THREE.Vector3(-.11,-.33,.11).applyMatrix4(platform.crew.hand.matrixWorld);
  assert.ok(actualHand.distanceTo(new THREE.Vector3(...platform.crewAnchor))<.015,'Audio anchor meets the raised hand/whistle');
  platform.dispose();
});


test('The head smoothly checks forward during the final closing interval using saved door progress',()=>{
  const views=[.35,.25,.15,.05,0].map(door=>({phase:'doors-closing',velocity:0,door,station:{index:0,remaining:0}}));
  const poses=views.map(driverCrewPose);assert.equal(poses[0].yaw,0);near(poses.at(-1).yaw,Math.PI/2);
  for(let i=1;i<poses.length;i++)assert(poses[i].yaw>poses[i-1].yaw);
  const paused={...views[2],paused:true};assert.deepEqual(driverCrewPose(paused),poses[2]);
});
