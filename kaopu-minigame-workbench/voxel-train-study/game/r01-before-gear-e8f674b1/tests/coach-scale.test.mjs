import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import {createFullSizeCoach,COACH_STEPS} from '../coach-model.mjs';
import {TRACK,COACH_DIMENSIONS as D,COACH_LAYOUT,COACH_FLOOR,PLATFORM_LAYOUT} from '../metre-scale.mjs';
import {SEATS} from '../session.mjs';
import {Session} from '../session.mjs';
import {createGameTrain} from '../train-model.mjs';
import {createPassengers} from '../characters.mjs';
import {flatFrame} from '../flat-terrain.mjs';
import {ADULT_HEIGHTS_M} from '../actor-scale.mjs';

const close=(a,b,label,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${label}: ${a} vs ${b}`);
function bounds(root,{instanceFilter=()=>true,vertexFilter=()=>true}={}){const box=new THREE.Box3(),p=new THREE.Vector3(),iM=new THREE.Matrix4(),m=new THREE.Matrix4();root.updateWorldMatrix(true,true);root.traverse(o=>{if(!o.geometry)return;const attr=o.geometry.attributes.position;for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){if(!instanceFilter(i,o))continue;if(o.isInstancedMesh){o.getMatrixAt(i,iM);m.multiplyMatrices(o.matrixWorld,iM);}else m.copy(o.matrixWorld);for(let j=0;j<attr.count;j++){p.fromBufferAttribute(attr,j);if(vertexFilter(p,j,o))box.expandByPoint(p.applyMatrix4(m));}}});return{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()};}
function blockBounds(mesh){const p=mesh.geometry.attributes.position,result=[];mesh.updateWorldMatrix(true,true);for(let start=0;start<p.count;start+=24){const b=new THREE.Box3(),v=new THREE.Vector3();for(let i=start;i<start+24;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));result.push({min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new THREE.Vector3()).toArray()});}return result;}
const coach=()=>createFullSizeCoach(COACH_LAYOUT[0],0);

test('R17 rejects legacy geometry explicitly instead of importing or silently falling back',()=>{
  assert.throws(()=>createGameTrain({legacy:true}),/preserved R14 entry/);
});

test('complete exported train constructor and Session update compose without mutations',()=>{
  const train=createGameTrain(),session=new Session({line:'kcr1'}),view=session.view(),original=structuredClone(view);train.update(view);train.root.updateWorldMatrix(true,true);
  assert.equal(train.coaches.length,2);assert.equal(train.wheels.length,36);assert.equal(train.proof.coachBodyMotion.coaches.length,2);assert.deepEqual(view,original);assert.deepEqual(train.root.scale.toArray(),[1,1,1]);
  train.update({...view,door:1},{interior:true});assert.equal(train.coaches[0].roof.material.opacity,.22);train.resetBodyMotion();train.setBodyMotionEnabled(false);
});

test('new shell, underframe and buffer geometry retain distinct reference lengths without root scaling',()=>{
  const c=coach();assert.deepEqual(c.root.scale.toArray(),[1,1,1]);assert.deepEqual(c.body.scale.toArray(),[1,1,1]);
  close(bounds(c.bodyMesh).size[0],D.bodyLength,'body length');close(bounds(c.fixedMesh).size[0],D.underframeLength,'underframe length');close(bounds(c.bufferHeads).size[0],D.overBuffers,'buffer length');
  assert.ok(D.bodyLength>D.underframeLength);assert.ok(D.overBuffers>D.bodyLength);
});

test('body-and-stepboards, overall handrails and gutter widths are independently measured',()=>{
  const c=coach();close(bounds(c.stepMesh).size[2],D.bodyAndStepsWidth,'stepboards width');close(bounds(c.bodyMesh).size[2],D.width,'overall width at handrails');close(bounds(c.roof).size[2],D.gutterWidth,'gutter width');
});

test('roof crown and highest attachments match separate heights above the rail',()=>{
  const c=coach();close(bounds(c.roof).max[1]-TRACK.railHead,D.roofAboveRail,'roof crown');close(bounds(c.ventMesh).max[1]-TRACK.railHead,D.overallAboveRail,'highest ventilators');
});

test('ten newly laid-out window bays per side replace the former four-window short shell',()=>{
  const c=coach();assert.equal(c.proof.windowsPerSide,10);assert.equal(c.glazing.count,20);
  const m=new THREE.Matrix4(),xs=[];for(let i=0;i<10;i++){c.glazing.getMatrixAt(i,m);xs.push(m.elements[12]);}assert.equal(new Set(xs.map(x=>x.toFixed(4))).size,10);assert.ok(Math.max(...xs)-Math.min(...xs)>17);
});

test('four axle centers and bogie pivots follow the two distinct longitudinal references',()=>{
  const c=coach(),axles=[0,2,4,6].map(i=>c.wheels[i].position.x);close(axles[1]-axles[0],D.bogieWheelbase,'rear bogie axle spacing');close(axles[3]-axles[2],D.bogieWheelbase,'front bogie axle spacing');close((axles[2]+axles[3]-axles[0]-axles[1])/2,D.bogieCenters,'bogie pivot spacing');
  for(const w of c.wheels){close(Math.abs(w.position.z),TRACK.wheelAxisZ,'wheel lateral reference');close(w.position.y-D.wheelRadius,TRACK.railHead,'wheel tread height');}
});

test('actual 1.067 wheel tread meets the standard-gauge rail; flange remains inboard',()=>{
  const c=coach(),radius=D.wheelRadius;
  for(const index of [0,1]){
    const tread=bounds(c.wheelBatch,{instanceFilter:i=>i===index,vertexFilter:p=>Math.abs(Math.hypot(p.x,p.y)-radius)<1e-6&&p.z>=-.065001&&p.z<=.075001});
    close(tread.size[0],radius*2,'tread diameter');close(tread.min[1],TRACK.railHead,'tread rail top');
    const sign=index===0?-1:1,lo=sign>0?tread.min[2]:-tread.max[2],hi=sign>0?tread.max[2]:-tread.min[2];assert.ok(lo<=TRACK.centerOffset&&hi>=TRACK.centerOffset);assert.ok(hi>TRACK.gauge/2);
    const flange=bounds(c.wheelBatch,{instanceFilter:i=>i===index,vertexFilter:p=>Math.hypot(p.x,p.y)>radius+.02});const outer=sign>0?flange.max[2]:-flange.min[2];assert.ok(outer<TRACK.gauge/2);
  }
});

test('wheel instance rotation uses actual distance divided by its measured running radius',()=>{
  const c=coach(),distance=D.wheelRadius*Math.PI/2;c.updateHardware(distance,0);const m=new THREE.Matrix4();c.wheelBatch.getMatrixAt(1,m);const center=c.wheels[1].position,point=new THREE.Vector3(0,D.wheelRadius,0).applyMatrix4(m);
  close(point.x-center.x,D.wheelRadius,'quarter-turn tread point X');close(point.y,center.y,'quarter-turn tread point Y');close(c.wheels[1].rotation.z,-Math.PI/2,'wheel phase');
});

test('all four door frame apertures are unobstructed by shell jambs and window posts',()=>{
  const c=coach(),blocks=blockBounds(c.bodyMesh);c.updateDoors(1);c.root.updateWorldMatrix(true,true);
  for(const d of c.doors){const xmin=d.x-D.doorWidth/2+1e-4,xmax=d.x+D.doorWidth/2-1e-4,ymin=COACH_FLOOR+1e-4,ymax=COACH_FLOOR+D.doorHeight-1e-4,zmin=Math.abs(d.z)-.049,zmax=Math.abs(d.z)+.046;
    const obstruction=blocks.filter(b=>b.max[0]>xmin&&b.min[0]<xmax&&b.max[1]>ymin&&b.min[1]<ymax&&(d.z>0?b.max[2]>zmin&&b.min[2]<zmax:b.min[2]<-zmin&&b.max[2]>-zmax));assert.equal(obstruction.length,0,JSON.stringify(obstruction));
    if(d.active){const left=bounds(d.leaves[0].mesh),right=bounds(d.leaves[1].mesh);assert.ok(right.min[0]-left.max[0]>=D.doorWidth);}
  }
});

test('inset stair treads remain inside vehicle width and do not enter the platform envelope',()=>{
  const c=coach(),steps=blockBounds(c.stepMesh),all=bounds(c.stepMesh);close(all.max[2],D.bodyAndStepsWidth/2,'outer step envelope');assert.ok(all.max[2]<PLATFORM_LAYOUT.minZ);
  const tops=[...new Set(steps.map(b=>b.max[1].toFixed(6)))].map(Number).sort((a,b)=>a-b);assert.equal(tops.length,2);close(tops[0],COACH_STEPS.outerTop,'outer step top');close(tops[1],COACH_STEPS.middleTop,'middle step top');
  const rises=[COACH_STEPS.outerTop-PLATFORM_LAYOUT.top,COACH_STEPS.middleTop-COACH_STEPS.outerTop,COACH_FLOOR-COACH_STEPS.middleTop];for(const rise of rises){assert.ok(rise>.10&&rise<.20);close(rise,(COACH_FLOOR-PLATFORM_LAYOUT.top)/3,'equal stair riser');}
});

test('floor stair wells are real geometric openings, not steps buried in a solid deck',()=>{
  const c=coach(),blocks=blockBounds(c.floorMesh);
  for(const d of c.doors){const xmin=d.x-D.doorWidth/2+1e-4,xmax=d.x+D.doorWidth/2-1e-4;const occupied=blocks.filter(b=>b.max[0]>xmin&&b.min[0]<xmax&&b.max[1]>COACH_FLOOR-.071&&(d.z>0?b.max[2]>COACH_STEPS.landingZ+1e-4:b.min[2]<-COACH_STEPS.landingZ-1e-4));assert.equal(occupied.length,0);}
});

test('eight rebuilt seats per coach align with all sixteen authoritative Session anchors',()=>{
  for(let ci=0;ci<COACH_LAYOUT.length;ci++){const c=createFullSizeCoach(COACH_LAYOUT[ci],ci);assert.equal(c.seatAnchors.length,8);assert.deepEqual(c.seatAnchors,SEATS.filter(s=>s.coach===ci).map(s=>s.position));const boxes=blockBounds(c.seatMesh);for(let i=0;i<8;i++)close(boxes[i*3].max[1],COACH_FLOOR+D.seatHeight,'seat cushion surface');}
});

test('adult extremes fit actual new seats: soles on floor, hips on cushion, head below roof',()=>{
  const c=coach();for(const heightM of [Math.min(...ADULT_HEIGHTS_M),Math.max(...ADULT_HEIGHTS_M)]){const actor={id:'seat-fit',heightM,appearance:2,pose:'seated',kind:'seated',frame:'train',position:c.seatAnchors[0],floorY:COACH_FLOOR,seatSurfaceY:COACH_FLOOR+D.seatHeight,ceilingY:c.proof.ceilingY,walk:0,age:0};const people=createPassengers(flatFrame);people.update({actors:[actor],distance:0,elapsed:0,line:'kcr1'});assert.equal(people.proof.excluded.length,0);close(bounds(people.mesh,{instanceFilter:i=>i===1}).min[1],c.proof.seatSurfaceY,'hip/cushion contact');close(bounds(people.mesh,{instanceFilter:i=>i===11}).min[1],COACH_FLOOR,'sole/floor contact');assert.ok(bounds(people.mesh).max[1]<c.proof.ceilingY);}
});

test('highest adult straw hat clears both doorway dimensions and minimum interior ceiling',()=>{
  const c=coach(),heightM=Math.max(...ADULT_HEIGHTS_M),actor={appearance:0,heightM,pose:'idle',kind:'boarding',frame:'train',heading:-Math.PI/2,position:[COACH_LAYOUT[0].frontDoor,COACH_FLOOR,0],walk:0,age:0};const people=createPassengers(flatFrame);people.update({actors:[actor],distance:0,elapsed:0,line:'kcr1'});const hat=bounds(people.mesh);assert.ok(hat.max[1]<COACH_FLOOR+D.doorHeight);assert.ok(hat.max[1]<c.proof.ceilingY);assert.ok(hat.size[0]<D.doorWidth);
});

test('full-size body motion remains Session-clock driven and wheel axes remain fixed',()=>{
  const c=coach(),positions=c.wheels.map(w=>w.position.toArray());const v={elapsed:2,tick:60,distance:12,velocity:6,throttle:2,actors:[]};c.updateBodyMotion(v,.033);const before=c.body.matrix.toArray();for(let i=0;i<50;i++)c.updateBodyMotion({...v,paused:true},.2);assert.deepEqual(c.body.matrix.toArray(),before);assert.deepEqual(c.wheels.map(w=>w.position.toArray()),positions);c.resetBodyMotion();assert.deepEqual(c.body.position.toArray(),[COACH_LAYOUT[0].x,COACH_FLOOR,0]);
});
