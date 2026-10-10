import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import {createPassengers} from '../characters.mjs';
import {flatFrame} from '../flat-terrain.mjs';
import {actorHeight,actorPoseDimensions,actorBodyDimensions,ADULT_HEIGHTS_M,ADULT_REFERENCE_HEIGHT_M,SEAT_HEIGHT_M,ACTOR_SOURCE} from '../actor-scale.mjs';

const close=(a,b,message,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=tolerance,`${message}: ${a} vs ${b}`);
function actor(overrides={}){return{id:'test-person',appearance:2,kind:'waiting',frame:'train',position:[0,.82,0],age:0,heading:0,walk:0,pose:'idle',...overrides};}
function view(actors,overrides={}){return{actors,line:'generic',distance:0,elapsed:0,...overrides};}
function bounds(mesh,select=()=>true){
  mesh.updateWorldMatrix(true,true);const box=new THREE.Box3(),point=new THREE.Vector3(),instance=new THREE.Matrix4(),matrix=new THREE.Matrix4(),p=mesh.geometry.attributes.position;
  for(let i=0;i<mesh.count;i++){if(!select(i))continue;mesh.getMatrixAt(i,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);for(let j=0;j<p.count;j++)box.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(matrix));}
  return{min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()};
}
function render(a,options={},viewOptions={}){const people=createPassengers(flatFrame,options);people.update(view([a],viewOptions));return people;}

test('adult design distribution is deterministic, varied, bounded and centered on 1.72',()=>{
  assert.equal(ADULT_REFERENCE_HEIGHT_M,1.72);assert.equal(Math.min(...ADULT_HEIGHTS_M),1.60);assert.equal(Math.max(...ADULT_HEIGHTS_M),1.84);
  close(ADULT_HEIGHTS_M.reduce((a,b)=>a+b,0)/ADULT_HEIGHTS_M.length,1.72,'design mean');assert.ok(new Set(ADULT_HEIGHTS_M).size>5);
  for(let i=-30;i<30;i++){assert.deepEqual(actorHeight({appearance:i}),actorHeight({appearance:i}));assert.equal(actorHeight({appearance:i}).heightM,actorHeight({appearance:i+ADULT_HEIGHTS_M.length}).heightM);}
});

test('each adult stature is verified from actual geometry and instance matrices, not only parameters',()=>{
  for(let i=0;i<ADULT_HEIGHTS_M.length;i++){
    const people=render(actor({appearance:i})),b=bounds(people.mesh);
    close(b.min[1],.82,`appearance ${i} sole`);close(b.size[1],ADULT_HEIGHTS_M[i],`appearance ${i} height`);
    assert.equal(people.proof.excluded.length,0);assert.equal(people.proof.rendered.length,1);
  }
});

test('valid explicit heights override adult design stature without clamping',()=>{
  for(const heightM of [1.23,1.72,2.05]){
    const people=render(actor({heightM,appearance:5,position:[2,1.31,-3]})),b=bounds(people.mesh);
    close(b.min[1],1.31,'explicit sole');close(b.size[1],heightM,'explicit measured height');assert.equal(people.proof.rendered[0].source,'explicit-height');
  }
});

test('child without a valid explicit height is excluded and recorded, never assigned adult stature',()=>{
  for(const heightM of [undefined,NaN,Infinity,-1,0,'1.2']){
    const people=render(actor({id:'child-unknown',ageGroup:'child',heightM}));
    assert.equal(people.mesh.count,0);assert.equal(people.proof.excluded.length,1);assert.equal(people.proof.excluded[0].id,'child-unknown');assert.equal(people.proof.excluded[0].reason,'child-requires-explicit-height');
  }
});

test('explicit child height is measured as supplied and is distinct from adult height',()=>{
  const people=render(actor({ageGroup:'child',heightM:1.18})),b=bounds(people.mesh);
  close(b.size[1],1.18,'child height');close(b.min[1],.82,'child sole');assert.equal(people.proof.rendered[0].heightM,1.18);
});

test('an explicit stature that cannot fit positive-sized placeholder parts is excluded, not silently replaced',()=>{
  const people=render(actor({ageGroup:'child',heightM:.01}));assert.equal(people.mesh.count,0);assert.equal(people.proof.excluded[0].heightM,.01);assert.equal(people.proof.excluded[0].reason,'explicit-height-outside-placeholder-fit');
});

test('hat remains separate from the feet-to-hair stature',()=>{
  const people=render(actor({appearance:0,heightM:1.72}),{}, {line:'kcr1'}),body=bounds(people.mesh,i=>i<7),all=bounds(people.mesh);
  close(body.max[1]-.82,1.72,'hair top');close(all.min[1],.82,'hat wearer sole');
  close(all.size[1],1.72+actorBodyDimensions(1.72).hatTopAboveHair,'height including independently dimensioned hat');assert.ok(all.size[1]>1.72);
});

test('explicit floorY takes precedence over original actor anchor elevation',()=>{
  const people=render(actor({heightM:1.72,position:[0,1.04,0],floorY:1.5})),b=bounds(people.mesh);
  close(b.min[1],1.5,'explicit floor');close(b.max[1],3.22,'explicit floor plus stature');
});

test('seated adults have hip underside on seat and both soles on floor with explicit metre-valued knees',()=>{
  for(const heightM of ADULT_HEIGHTS_M){
    const floorY=1.17,seatSurfaceY=floorY+.46,ceilingY=3.05;
    const people=render(actor({pose:'seated',kind:'seated',heightM,position:[-10,floorY,.62],floorY,seatSurfaceY,ceilingY}));
    assert.equal(people.mesh.count,17);const hip=bounds(people.mesh,i=>i===1),leftShoe=bounds(people.mesh,i=>i===11),rightShoe=bounds(people.mesh,i=>i===16),leftShin=bounds(people.mesh,i=>i===10),all=bounds(people.mesh);
    close(hip.min[1],seatSurfaceY,'hip seat contact');close(leftShoe.min[1],floorY,'left sole');close(rightShoe.min[1],floorY,'right sole');
    close(leftShin.max[1],seatSurfaceY+actorBodyDimensions(heightM).thighThickness/2,'authored metric knee position');close(leftShin.min[1],leftShoe.max[1],'shin-to-shoe joint');
    assert.ok(all.max[1]<ceilingY);assert.equal(people.proof.excluded.length,0);
  }
});

test('seated fit follows independently configurable floor, seat and explicit child height',()=>{
  const a=actor({pose:'seated',heightM:1.2,ageGroup:'child',position:[2,.1,-2]});
  const people=render(a,{seatGeometry:()=>({floorY:1.4,seatSurfaceY:1.79,ceilingY:3.2})});
  close(bounds(people.mesh,i=>i===1).min[1],1.79,'callback seat');close(bounds(people.mesh,i=>i===11).min[1],1.4,'callback floor');
  assert.equal(people.proof.rendered[0].heightM,1.2);
});

test('default seat offset is a stated .46 design value relative to actual floor, not fixed 1.04',()=>{
  assert.equal(SEAT_HEIGHT_M,.46);
  for(const floorY of [0,.82,1.04,1.39]){const d=actorPoseDimensions(actor({pose:'seated',heightM:1.72,position:[0,floorY,0]}));assert.equal(d.eligible,true);close(d.seatSurfaceY,floorY+.46,'relative seat surface');close(d.feetY,floorY,'relative floor contact');}
});

test('impossible low seat or explicit low ceiling is excluded with an actionable reason',()=>{
  const lowSeat=render(actor({pose:'seated',heightM:1.84,floorY:1,seatSurfaceY:1.02}));assert.equal(lowSeat.mesh.count,0);assert.equal(lowSeat.proof.excluded[0].reason,'seated-seat-too-low-for-foot');
  const lowRoof=render(actor({pose:'seated',heightM:1.84,floorY:1,seatSurfaceY:1.46,ceilingY:2.3}));assert.equal(lowRoof.mesh.count,0);assert.equal(lowRoof.proof.excluded[0].reason,'body-exceeds-explicit-ceiling');
});

test('same authoritative pose and clock yield identical instances during paused repeated rendering',()=>{
  const a=actor({heightM:1.72,pose:'running',walk:1.125,path:{kind:'board'},position:[3,.82,4]}),original=structuredClone(a);Object.freeze(a.position);Object.freeze(a.path);Object.freeze(a);
  const v=view([a],{elapsed:42}),people=createPassengers(flatFrame);people.update(v);const before=Array.from(people.mesh.instanceMatrix.array.slice(0,people.mesh.count*16));
  for(let i=0;i<50;i++)people.update(v);
  assert.deepEqual(Array.from(people.mesh.instanceMatrix.array.slice(0,people.mesh.count*16)),before);assert.deepEqual(a,original);assert.equal(a.walk,1.125);assert.equal(v.elapsed,42);
});

test('world-to-render positioning remains once-only and does not mutate actor state',()=>{
  const a=actor({heightM:1.72,frame:'world',position:[30,.82,3],heading:0}),original=structuredClone(a),people=render(a,{}, {distance:10});
  const hip=bounds(people.mesh,i=>i===1);close((hip.min[0]+hip.max[0])/2,25,'world X minus distance plus FRONT_X');assert.deepEqual(a,original);close(bounds(people.mesh).min[1],.82,'world sole');
});

test('gone fade scales around the sole anchor without adopting a new body height',()=>{
  const a=actor({heightM:1.72,kind:'gone',age:.7}),people=render(a),b=bounds(people.mesh);
  close(b.min[1],.82,'fading sole');close(b.size[1],.86,'half-height fade');assert.equal(people.proof.rendered[0].heightM,1.72);
});

test('measured source reference is feet .01 to hair 1.075, not hat or head center',()=>{
  close(ACTOR_SOURCE.hairTopY-ACTOR_SOURCE.standingFeetY,ACTOR_SOURCE.standingHeight,'source measured extent');assert.equal(ACTOR_SOURCE.standingHeight,1.065);
});

test('actual adult shoulders, heads and shoes meet independent part design ranges',()=>{
  for(const heightM of ADULT_HEIGHTS_M){const people=render(actor({heightM,heading:0})),all=bounds(people.mesh),head=bounds(people.mesh,i=>i===2||i===3),shoe=bounds(people.mesh,i=>i===10);
    assert.ok(all.size[2]>=.50&&all.size[2]<=.55,`shoulders ${all.size[2]}`);assert.ok(head.size[1]>=.24&&head.size[1]<=.26,`head ${head.size[1]}`);assert.ok(shoe.size[0]>=.24&&shoe.size[0]<=.27,`shoe ${shoe.size[0]}`);close(all.size[1],heightM,'height preserved while part proportions change');}
});

test('actual straw-hat width is independent of stature scale and fits the .86 door design',()=>{
  for(const heightM of ADULT_HEIGHTS_M){const people=render(actor({appearance:0,heightM,kind:'boarding',heading:-Math.PI/2}),{}, {line:'kcr1'}),brim=bounds(people.mesh,i=>i===7),all=bounds(people.mesh);assert.ok(brim.size[0]>=.62&&brim.size[0]<=.70);assert.ok(all.size[0]<.86);}
});

test('walking keeps original Session phase and bob while soles cannot penetrate a flat support',()=>{
  for(let i=0;i<24;i++){const walk=i*Math.PI/12,people=render(actor({heightM:1.84,path:{kind:'board'},walk,heading:-Math.PI/2})),b=bounds(people.mesh);close(b.min[1],.82+Math.abs(Math.sin(walk))*.016,'lowest sole and original bob');}
});
