import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {readFileSync} from 'node:fs';
import {FLAT_WORLD,flatFrame,flatActor,stationOffset,floraPlacementZ,fieldTreePose,terrainSlots,chunkBounds,chunkDetail,splitFlatGround} from '../flat-terrain.mjs';
import {WORLD,pathFrame,partitionTerrain,createGameWorld} from '../world.mjs';
import {buildEnvironment} from '../heritage.mjs';
import {Session,FRONT_X,COACHES} from '../session.mjs';
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('R09 uses an ordinary flat frame for all distances, elevations and sides',()=>{
  for(const x of [-1e7,-6000,-300,-48,-26,-8,0,18,44,100,6000,1e7])for(const y of [0,.085,.348,.82,1.04,4.33704])for(const z of [-40,-3.94,0,3.8,7.05,40]){
    const frame=pathFrame(x,y,z);assert.deepEqual(frame,flatFrame(x,y,z));assert.deepEqual(frame.position,[x,y,z]);assert.deepEqual(frame.tangent,[1,0,0]);assert.deepEqual(frame.normal,[0,1,0]);
  }
  assert.equal(WORLD.flat,true);
  const source=readFileSync(new URL('../world.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/driverFrame|driverPosition|beltPhase|bentMesh|bendMaterial/);
});

test('Repeated terrain stays continuous and recycles only beyond every supported camera',()=>{
  const spec=FLAT_WORLD,safe=spec.maxOrbitDistance+spec.fogFar+20;
  for(const distance of [-100,-.001,0,.001,28,95.87,95.88,333,1200,6000,1e7]){
    const slots=terrainSlots(distance).sort((a,b)=>a.min-b.min);
    assert.equal(new Set(slots.map(s=>s.slot)).size,spec.slotCount);
    for(let i=1;i<slots.length;i++)near(slots[i-1].max,slots[i].min,1e-6);
    assert.ok(slots[0].min<-safe);assert.ok(slots.at(-1).max>safe);
  }
  for(let n=-2;n<70;n++){
    const boundary=n*spec.period+spec.centerX+spec.sourceStart;
    for(const direction of [-1,1]){
      const before=terrainSlots(boundary-direction*1e-5),after=terrainSlots(boundary+direction*1e-5);let recycled=0;
      for(let i=0;i<before.length;i++){
        const a=before[i],b=after[i];
        if(a.tile===b.tile)near(b.offset-a.offset,-direction*2e-5,1e-9);
        else{recycled++;assert.ok(direction>0?a.max<-safe:a.min>safe);assert.ok(direction>0?b.min>safe:b.max<-safe);}
      }
      assert.equal(recycled,1);
    }
  }
});

test('Platform-side foliage stays outside the locomotive and driver viewing corridor',()=>{
  for(const z of [6.85,7.05]){assert.ok(floraPlacementZ(z)>=18);assert.ok(floraPlacementZ(z)>14+3);near(floraPlacementZ(z)-z,12);}
  for(const z of [-3.94,-16,0])near(floraPlacementZ(z),z);
});

test('Every close terrain chunk copies the original detailed geometry without resampling',()=>{
  const parts=partitionTerrain(buildEnvironment(WORLD,{platformCorridor:true,includeBridge:false,optimizeGeometry:true}));
  assert.equal(parts.proof.originalTriangles,149496);assert.equal(parts.proof.partitionedTriangles,parts.proof.originalTriangles);assert.ok(parts.proof.maxPositionDeviation<1e-6);assert.equal(parts.plants.length,8);
  const split=splitFlatGround(parts.ground);assert.equal(split.proof.sourceVertexDeviation,0);assert.equal(split.proof.retainedGroundTriangles+split.proof.buriedTrianglesOmitted,parts.ground.index.count/3);
  const signature=(geometry,index)=>['position','normal','color'].flatMap(name=>{const a=geometry.attributes[name];return[a.getX(index),a.getY(index),a.getZ(index)];}).join(',');
  const original=new Set();for(let i=0;i<parts.ground.attributes.position.count;i++)original.add(signature(parts.ground,i));
  for(const geometry of split.geometries){for(let i=0;i<geometry.attributes.position.count;i++)assert.ok(original.has(signature(geometry,i)),'A source position, surface normal or vertex color changed');geometry.dispose();}
  // All original sleepers, rails and fine grass are above the omitted buried faces.
  assert.equal(split.proof.retainedGroundTriangles,56932);assert.equal(split.proof.buriedTrianglesOmitted,4044);
  parts.ground.dispose();parts.interior.dispose();for(const plant of parts.plants)plant.geometry.dispose();
});

test('Station, original actors and coach doorway frames agree after scrolling',()=>{
  for(const distance of [0,33.2,100,999.2,6000])for(const target of [0,60,333,1200,6000]){
    const offset=stationOffset(target,distance);
    for(const coach of COACHES)for(const door of [coach.frontDoor,coach.rearDoor]){
      const actor={frame:'world',position:[target+door-FRONT_X,.82,3.55],pose:'idle',heading:Math.PI/2};
      const moved=flatActor(actor,distance,FRONT_X);assert.deepEqual(actor.position,[target+door-FRONT_X,.82,3.55]);
      near(moved.position[0],offset+door);near(moved.position[1],.82);near(moved.position[2],3.55);assert.equal(moved.heading,actor.heading);assert.equal(moved.frame,'train');
    }
    const seated={frame:'train',position:[-11.1,1.04,.62]};assert.equal(flatActor(seated,distance),seated);
  }
});

// Minimal canvas is sufficient to verify scene transforms; browser visual QA is separate.
globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
const world=createGameWorld(),session=new Session({line:'kcr1',seed:'R09-flat-world'});

test('Far trees reuse original layered crown silhouettes with deterministic off-grid placement',()=>{
  const crowns=world.terrain.children.filter(o=>o.name.startsWith('Distant source-derived crown variant'));assert.equal(crowns.length,3);
  const heights=new Set();for(const mesh of crowns){const geometry=mesh.geometry;assert.equal(geometry.userData.sourceDerivedCrown,true);assert.equal(geometry.userData.crownLevels,7);assert.ok(geometry.index.count/3<=124);geometry.computeBoundingBox();near(geometry.boundingBox.max.y,geometry.userData.sourceLeafHeight[1],1e-6);heights.add(geometry.boundingBox.max.y.toFixed(2));for(const value of geometry.attributes.position.array)assert.ok(Number.isFinite(value));
    const crownY=new Set();for(let i=24;i<geometry.attributes.position.count;i++)crownY.add(geometry.attributes.position.getY(i).toFixed(3));assert.ok(crownY.size>=7,'Crown silhouette has actual layered heights');
  }
  assert.equal(heights.size,3);const placements=Array.from({length:16},(_,i)=>fieldTreePose(i));assert.deepEqual(placements,Array.from({length:16},(_,i)=>fieldTreePose(i)));assert.equal(new Set(placements.map(p=>p.variant)).size,3);
  assert.ok(new Set(placements.map(p=>p.z.toFixed(1))).size>12);assert.ok(new Set(placements.map(p=>p.scale.toFixed(2))).size>8);
  for(const [i,p]of placements.entries()){assert.ok(i%2?p.z>=19:p.z<=-12);assert.ok(p.x>FLAT_WORLD.sourceStart+i*FLAT_WORLD.period/16);assert.ok(p.x<FLAT_WORLD.sourceStart+(i+1)*FLAT_WORLD.period/16);}
});

test('Broad ground and straight rails cover front, rear, detail and maximum free orbit views',()=>{
  const spec=FLAT_WORLD;
  assert.ok(spec.groundHalfSize>spec.maxOrbitDistance+spec.cameraFar);
  assert.ok(spec.terrainRadius>spec.maxOrbitDistance+spec.fogFar+40);
  assert.ok(spec.detailRadius>=spec.maxOrbitDistance);
  for(const distance of [0,24,95.87610416728242,333,6000]){
    session.distance=distance;world.update(session.view(),session.route);world.root.updateMatrixWorld(true);
    const railway=world.terrain.children.find(o=>o.name==='Unbroken straight ballast and rails');const bounds=new THREE.Box3().setFromObject(railway);
    assert.ok(bounds.min.x<spec.centerX-spec.maxOrbitDistance-spec.fogFar-20);assert.ok(bounds.max.x>spec.centerX+spec.maxOrbitDistance+spec.fogFar+20);
    for(const railZ of [-.76,.76])for(const cameraX of [-65,-30,0,30,65]){assert.ok(cameraX-spec.fogFar>bounds.min.x);assert.ok(cameraX+spec.fogFar<bounds.max.x);assert.ok(railZ>bounds.min.z&&railZ<bounds.max.z);}
    const covered=terrainSlots(distance).flatMap(slot=>Array.from({length:spec.chunkCount},(_,i)=>{const b=chunkBounds(i);return{min:b.min+slot.offset,max:b.max+slot.offset};})).filter(b=>chunkDetail(b.min,b.max)).sort((a,b)=>a.min-b.min);
    assert.ok(covered[0].min<=spec.centerX-spec.detailRadius);assert.ok(covered.at(-1).max>=spec.centerX+spec.detailRadius);for(let i=1;i<covered.length;i++)near(covered[i-1].max,covered[i].min,1e-6);
  }
});

test('Actual station parts translate as one flat group, with no sign or lamp bending',()=>{
  session.distance=session.route[0].target+3.5;const view=session.view();world.update(view,session.route);world.root.updateMatrixWorld(true);
  const platform=world.root.children.find(o=>o.name==='Flat station platform: '+session.route[0].name);assert.ok(platform);near(platform.position.x,-3.5);near(platform.position.y,0);assert.deepEqual(platform.rotation.toArray().slice(0,3),[0,0,0]);
  const sign=platform.getObjectByName('Station sign front');assert.ok(sign);const position=sign.getWorldPosition(new THREE.Vector3()),local=sign.position;near(position.x,local.x-3.5);near(position.y,local.y);near(position.z,local.z);assert.ok(position.y>1.8);assert.ok(position.z>5);
  const details=world.stationProof().find(x=>x.index===0);assert.equal(details.version,'station-r10');assert.equal(details.deckTop,.82);assert.equal(details.signFaces,2);assert.equal(details.originalProcedural,true);
  assert.equal(world.terrain.userData.proof.blackUndersideRendered,false);assert.equal(world.terrain.userData.proof.sourceVertexDeviation,0);assert.equal(world.terrain.userData.proof.platformSideFloraShiftZ,12);
  const nearFlora=world.terrain.children.filter(o=>o.name.startsWith('Preserved original tree or shrub')&&o.visible);assert.ok(nearFlora.some(o=>o.position.z>18));for(const mesh of nearFlora)assert.ok(mesh.position.z<0||mesh.position.z>18);
});

test('Flat terrain density remains bounded rather than tripling all original trees',()=>{
  let maxTriangles=0,maxCalls=0;
  for(let distance=0;distance<FLAT_WORLD.period;distance+=2){session.distance=distance;world.update(session.view(),session.route);let triangles=0,calls=0;world.root.traverseVisible(o=>{if(o.isMesh){const count=o.isInstancedMesh?o.count:1;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*count;if(count)calls++;}});maxTriangles=Math.max(maxTriangles,triangles);maxCalls=Math.max(maxCalls,calls);}
  assert.ok(maxTriangles<420000,`${maxTriangles} submitted triangles`);assert.ok(maxCalls<140,`${maxCalls} material calls`);
  console.log(JSON.stringify({flatWorld:true,maxSubmittedTriangles:maxTriangles,maxMaterialCalls:maxCalls,wrapSafetyDistance:3*FLAT_WORLD.period,retainedSourceVertexDeviation:world.terrain.userData.proof.sourceVertexDeviation}));
});
