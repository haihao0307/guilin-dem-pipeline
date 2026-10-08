import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {createStationPlatform,PLATFORM_SPEC,STONE_TEXTURE_SPEC} from '../station-platform.mjs';
import {Blocks} from '../heritage.mjs';
import {KCR_STATIONS} from '../timetable.mjs';
import {COACHES} from '../session.mjs';
import {CAMERA_PRESETS} from '../camera-presets.mjs';

globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
const near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} differs from ${b}`);
const create=index=>createStationPlatform({...KCR_STATIONS[index],radius:2.8});
const stationMeshes=station=>{const out=[];station.group.traverse(o=>{if(o.isMesh)out.push(o);});return out;};

test('Every station has finite bounded geometry and distinct evidence-informed furniture variants',()=>{
  const variants=new Set();for(let index=0;index<9;index++){
    const s=create(index),meshes=stationMeshes(s),p=s.proof;variants.add(p.variant);
    assert.equal(p.drawCalls,meshes.length);assert.equal(p.drawCalls,index===5?12:10);assert.ok(p.triangles<12000,`${p.variant}: ${p.triangles} triangles`);
    assert.equal(p.deckTop,.82);assert.equal(p.materialSurface,'masonry');assert.equal(p.originalProcedural,true);assert.equal(p.historicalReconstruction,false);
    for(const mesh of meshes)for(const attribute of Object.values(mesh.geometry.attributes))for(const v of attribute.array)assert.ok(Number.isFinite(v),mesh.name);
    const deck=s.group.getObjectByName('Station deck surface');near(deck.geometry.boundingBox.max.y,.82);
    if(index===0)assert.equal(p.canopy.type,'long-valanced-cantilever');
    if(index===4){assert.equal(p.canopy.type,'open-platform');assert.equal(p.luggage.baskets,0);}
    if(index===5)assert.deepEqual(p.props,{handcarts:1,noticeboards:1,clocks:1});
    s.dispose();
  }
  assert.equal(variants.size,6);
});

test('The passenger corridor and ordinary boarding/alighting routes remain unobstructed',()=>{
  for(let index=0;index<9;index++){
    const s=create(index),{min,max}=PLATFORM_SPEC.clearWalkway;
    for(const o of s.proof.obstacles){const overlap=o.min.every((v,k)=>v<max[k]&&o.max[k]>min[k]);assert.equal(overlap,false,`${s.proof.variant}: ${o.kind} enters walkway`);}
    // Test an adult's torso against actual triangles along the Session paths,
    // including the two diagonal exits, not just hand-maintained proof bounds.
    const meshes=stationMeshes(s).filter(m=>!m.name.includes('stopping zone'));
    for(const coach of COACHES){
      const routes=[[[coach.frontDoor,1.31,4.1],[coach.frontDoor,1.31,2.07]],
        [[coach.rearDoor,1.31,2.07],[coach.rearDoor,1.31,4.7],[coach.rearDoor+1.1,1.31,5],[coach.rearDoor+2.3,1.31,5.35]]];
      for(const points of routes)for(let i=1;i<points.length;i++){
        const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),ray=new THREE.Raycaster(a,b.clone().sub(a).normalize(),.015,a.distanceTo(b)-.015);
        assert.deepEqual(ray.intersectObjects(meshes,false).map(hit=>hit.object.name),[],`${s.proof.variant}: passenger path ${JSON.stringify(points[i])}`);
      }
    }
    s.dispose();
  }
});

test('The neutral masonry map uses a unique high-resolution atlas with equal world-space texel density',()=>{
  const s=create(0),deck=s.group.getObjectByName('Station deck surface'),map=deck.material.map,spec=STONE_TEXTURE_SPEC;
  assert.equal(map.colorSpace,THREE.SRGBColorSpace);assert.deepEqual([map.image.width,map.image.height],[4096,512]);
  assert.equal(map.wrapS,THREE.ClampToEdgeWrapping);assert.equal(map.wrapT,THREE.ClampToEdgeWrapping);
  assert.equal(map.userData.originalProcedural,true);assert.equal(map.userData.repeats,false);assert.ok(map.userData.expansionJoints>=7&&map.userData.expansionJoints<=11);
  near(map.image.width/spec.worldWidth,spec.texelsPerMetre);near(map.image.height/spec.worldDepth,spec.texelsPerMetre);
  const p=deck.geometry.attributes.position,uv=deck.geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    near(uv.getX(i),(p.getX(i)-spec.originX)/spec.worldWidth);near(uv.getY(i),(p.getZ(i)-spec.originZ)/spec.worldDepth);
    assert.ok(uv.getX(i)>0&&uv.getX(i)<1&&uv.getY(i)>0&&uv.getY(i)<1,'The platform stays inside the unique atlas');
  }
  // The atlas aspect must not be applied like a square texture to the long deck.
  let a=-1,b=-1;for(let i=0;i<p.count;i++)if(deck.geometry.attributes.normal.getY(i)>.9){if(a<0)a=i;else if(Math.abs(p.getX(i)-p.getX(a))>1){b=i;break;}}
  near(Math.abs(uv.getX(a)-uv.getX(b))*map.image.width/Math.abs(p.getX(a)-p.getX(b)),spec.texelsPerMetre,1e-5);
  assert.ok(deck.material.roughness>=.95);assert.equal(deck.material.metalness,0);s.dispose();
});

test('The default landscape and portrait camera rays see the in-cab driver across the platform',()=>{
  for(let index=0;index<9;index++){
    const s=create(index);for(const layout of ['landscape','portrait']){
      const a=new THREE.Vector3(...CAMERA_PRESETS.platform[layout].position),b=new THREE.Vector3(...PLATFORM_SPEC.driver);
      const ray=new THREE.Raycaster(a,b.clone().sub(a).normalize(),0,a.distanceTo(b)-.025);
      assert.deepEqual(ray.intersectObjects(stationMeshes(s),false).map(hit=>hit.object.name),[],`${s.proof.variant}: ${layout}`);
    }s.dispose();
  }
});

test('The sign has independent unmirrored outward-facing surfaces and an sRGB high-resolution map',()=>{
  const s=create(0),front=s.group.getObjectByName('Station sign front'),back=s.group.getObjectByName('Station sign back');
  assert.equal(s.sign,front);assert.equal(front.material.side,THREE.FrontSide);assert.equal(back.material.side,THREE.FrontSide);
  assert.equal(front.material.map.colorSpace,THREE.SRGBColorSpace);assert.deepEqual([front.material.map.image.width,front.material.map.image.height],[2048,640]);
  assert.deepEqual(front.position.toArray(),s.proof.signPosition);near(front.geometry.parameters.width,4.2);near(front.geometry.parameters.height,.74);
  s.group.updateMatrixWorld(true);const frontNormal=new THREE.Vector3(0,0,1).transformDirection(front.matrixWorld),backNormal=new THREE.Vector3(0,0,1).transformDirection(back.matrixWorld);
  near(frontNormal.z,1);near(backNormal.z,-1);assert.ok(front.scale.x>0&&back.scale.x>0);
  // Raycast from each side: the label, rather than the solid backplate, is first.
  for(const [z,direction,expected]of [[8,-1,front],[3,1,back]]){
    const hits=new THREE.Raycaster(new THREE.Vector3(-14.6,2.55,z),new THREE.Vector3(0,0,direction)).intersectObjects(stationMeshes(s),false);
    assert.equal(hits[0]?.object,expected);
  }s.dispose();
});

test('Tai Po Market clock face remains fully exposed above the noticeboard, clear of the station sign',()=>{
  const s=create(5),clock=s.proof.clock,[x,y,z]=clock.facePosition;
  near(x,-17.05);near(y,2.82);near(z,5.461);
  assert.ok(x+clock.caseRadius<s.sign.position.x-s.sign.geometry.parameters.width/2);
  assert.ok(y-clock.caseRadius>2.05+.83/2,'Clock clears the noticeboard top');
  // Sample the actual dial triangles and hands: every visible dial point must
  // be reached before any sign/backplate or roof geometry along the view ray.
  const points=[[0,0]];for(const radius of [.08,.17])for(let i=0;i<12;i++){const angle=i*Math.PI/6;points.push([Math.cos(angle)*radius,Math.sin(angle)*radius]);}
  for(const [dx,dy]of points){
    const ray=new THREE.Raycaster(new THREE.Vector3(x+dx,y+dy,8),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObjects(stationMeshes(s),false)[0];assert.ok(hit,'Visible clock dial has a surface');
    assert.ok(hit.point.z>=z-1e-6&&hit.point.z<=z+.025,`Clock face obstructed at ${dx}, ${dy}: ${hit.object.name}`);
  }
  s.dispose();
});

test('Clock hands show the precise game timetable, including continuous fractions and frozen values',()=>{
  const s=create(5),minute=s.group.getObjectByName('Station clock minute hand'),hour=s.group.getObjectByName('Station clock hour hand');
  assert.ok(minute&&hour);assert.equal(minute.material,hour.material);
  const check=(minutes,minuteDegrees,hourDegrees)=>{
    assert.equal(s.updateClock(minutes),true);s.group.updateMatrixWorld(true);
    near(minute.rotation.z,-minuteDegrees*Math.PI/180);near(hour.rotation.z,-hourDegrees*Math.PI/180);
    // Confirm actual local +Y hand directions, rather than only copied proof.
    for(const [hand,degrees]of [[minute,minuteDegrees],[hour,hourDegrees]]){
      const direction=new THREE.Vector3(0,1,0).transformDirection(hand.matrixWorld),angle=degrees*Math.PI/180;
      near(direction.x,Math.sin(angle));near(direction.y,Math.cos(angle));
    }
    assert.equal(s.proof.clock.minutes,minutes);
  };
  check(380,120,190);check(420,0,210);check(380.5,123,190.25);check(442.25,133.5,221.125);
  const frozen=[minute.rotation.z,hour.rotation.z];for(let i=0;i<30;i++)s.updateClock(442.25);
  assert.deepEqual([minute.rotation.z,hour.rotation.z],frozen);
  assert.equal(s.updateClock(undefined),false);assert.equal(s.updateClock(NaN),false);assert.deepEqual([minute.rotation.z,hour.rotation.z],frozen);
  s.dispose();assert.equal(s.updateClock(380),false);
  const noClock=create(0);assert.equal(noClock.updateClock(380),false);assert.equal(noClock.proof.drawCalls,10);noClock.dispose();
});

test('The original station attendant retains every position, normal, colour and index',()=>{
  const b=new Blocks(),sx=-4.8;
  b.box(sx,1.34,4.8,.29,.43,.21,0x40564d);b.box(sx,1.68,4.8,.23,.24,.22,0xc5a480);b.box(sx,1.83,4.8,.29,.08,.28,0x262d27);for(const z of [4.71,4.89])b.box(sx,.99,z,.1,.38,.1,0x383b32);b.box(sx+.18,1.33,4.8,.09,.37,.09,0x657668);b.box(sx+.22,1.43,4.8,.04,.51,.04,0x90764a);b.box(sx+.39,1.62,4.8,.3,.19,.025,0xc5b66e);
  const expected=b.geometry(),s=create(0),actual=s.group.getObjectByName('Preserved original stationary station attendant').geometry;
  for(const name of ['position','normal','color'])assert.deepEqual(actual.attributes[name].array,expected.attributes[name].array);
  assert.deepEqual(actual.index.array,expected.index.array);expected.dispose();s.dispose();
});

test('Every shared material, texture and geometry is disposed exactly once',()=>{
  const s=create(5),resources=new Set();for(const mesh of stationMeshes(s)){
    resources.add(mesh.geometry);resources.add(mesh.material);for(const value of Object.values(mesh.material))if(value?.isTexture)resources.add(value);
  }
  const calls=new Map();for(const resource of resources)resource.addEventListener('dispose',()=>calls.set(resource,(calls.get(resource)||0)+1));
  s.dispose();s.dispose();for(const resource of resources)assert.equal(calls.get(resource),1);
  assert.equal(s.group.children.length,0);
});
