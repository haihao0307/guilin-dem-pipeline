import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../../vendor/three.module.js';
import {createNativePlantSegment,PLANT_SEGMENT,PLANT_PLACEMENTS} from './segment.mjs';
import {createRoutePlan,resolveChunk} from '../street/route-plan.mjs';
import {PLATFORM_LAYOUT,TRACK,COACH_DIMENSIONS} from '../metre-scale.mjs';
import {CAMERA_PRESETS} from '../camera-presets.mjs';
const json=name=>JSON.parse(fs.readFileSync(new URL('../street/'+name,import.meta.url)));
function placedBounds(item){const b=item.plant.proof.breezeBounds;return new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max)).applyMatrix4(item.plant.root.matrixWorld);}
test('Four real native plants keep leaf detail, source scale, first-leg scope, young street height and ground-root contact',()=>{
 const s=createNativePlantSegment();try{s.root.updateMatrixWorld(true);assert.equal(s.items.length,4);assert.equal(new Set(PLANT_PLACEMENTS.map(p=>p.id)).size,4);assert(PLANT_PLACEMENTS.every(p=>p.chainage>=PLATFORM_LAYOUT.minX&&p.chainage<=700));
 const rows=s.items.map(({plant,spec})=>{assert.deepEqual(plant.root.scale.toArray(),[1,1,1]);assert.deepEqual(plant.proof.geometryDetail,{leafSegments:28,leafColumns:5,leafTriangles:224});assert(plant.proof.rootCount>=4);assert(plant.proof.leafCount>=10);assert(plant.proof.bounds.min[1]<0);assert(plant.proof.bounds.max[1]>=2&&plant.proof.bounds.max[1]<=3);assert.equal(plant.proof.units,'source-engineering-metres');return{id:spec.id,triangles:plant.proof.triangles,drawCalls:plant.proof.drawCalls,bufferBytes:plant.proof.bufferBytes,height:plant.proof.bounds.max[1]};});
 assert(rows.reduce((n,r)=>n+r.triangles,0)<180000);assert(rows.reduce((n,r)=>n+r.bufferBytes,0)<1000000);console.log({nativePlants:rows});
 }finally{s.dispose();}
});
test('Conservative breeze crowns clear rails, platform, all resolved buildings and existing camera positions',()=>{
 const s=createNativePlantSegment();try{s.root.updateMatrixWorld(true);const plan=createRoutePlan(json('route.score.json'),[{target:0},{target:700}]),anchor=json('first-street.score.json');const buildings=plan.chunks.flatMap(c=>resolveChunk(plan,c,anchor).construction.buildings.map(b=>({...b,center:c.center})));
 const rows=[];for(const item of s.items){const box=placedBounds(item);assert(box.max.z< -PLANT_SEGMENT.railHalfClearance-.2,item.spec.id+' rail clearance');assert(box.max.z<PLATFORM_LAYOUT.minZ,item.spec.id+' platform walking route');let nearestFront=Infinity;
 for(const b of buildings){const minX=b.center+b.x-b.width/2,maxX=b.center+b.x+b.width/2;if(box.max.x<minX||box.min.x>maxX)continue;const frontClearance=box.min.z-b.frontZ;nearestFront=Math.min(nearestFront,frontClearance);assert(frontClearance>.5,item.spec.id+' facade clearance '+frontClearance);}
 for(const preset of Object.values(CAMERA_PRESETS))for(const layout of ['landscape','portrait'])for(let d=0;d<=700;d+=5){const p=new THREE.Vector3(...preset[layout].position);p.x+=d;assert(!box.clone().expandByScalar(.5).containsPoint(p),'Camera volume overlaps '+item.spec.id);}
 rows.push({id:item.spec.id,breezeBounds:{min:box.min.toArray(),max:box.max.toArray()},railGap:-PLANT_SEGMENT.railHalfClearance-box.max.z,nearestFacadeGap:nearestFront});}console.log({clearance:rows});
 }finally{s.dispose();}
});
test('Host clock and one distance translation; no rebuilt geometry while moving or paused',()=>{
 const s=createNativePlantSegment();try{const geometry=[],objects=[];s.root.traverse(o=>{if(o.geometry)geometry.push([o.geometry,o.geometry.attributes.position.array]);if(o.name==='native-leaf-rosette'||o.userData.base)objects.push(o);});s.update({distance:0,elapsed:3});const initial=objects.map(o=>o.quaternion.toArray());s.update({distance:32,elapsed:3});assert.equal(s.root.position.x,-32);assert.deepEqual(objects.map(o=>o.quaternion.toArray()),initial);for(const [g,a]of geometry)assert.equal(g.attributes.position.array,a);s.update({distance:345,elapsed:8});assert(s.items.filter(x=>x.plant.root.visible).length<=2);s.update({distance:1200,elapsed:20});assert.equal(s.snapshot().active,0);assert.equal(s.items.length,4);assert.throws(()=>s.update({distance:NaN,elapsed:0}));
 }finally{s.dispose();s.dispose();assert.equal(s.root.children.length,0);}
});

test('Selected young crowns are smaller than both shop ground floors and coach roofs in the same metres',()=>{const s=createNativePlantSegment();try{const plan=createRoutePlan(json('route.score.json'),[{target:0},{target:700}]),anchor=json('first-street.score.json');const floorMin=Math.min(...plan.chunks.flatMap(c=>resolveChunk(plan,c,anchor).construction.buildings.map(b=>b.groundHeight)));for(const {plant}of s.items){const top=PLANT_SEGMENT.groundY+plant.proof.bounds.max[1];assert(top<floorMin);assert(top<TRACK.railHead+COACH_DIMENSIONS.roofAboveRail);assert.deepEqual(plant.root.scale.toArray(),[1,1,1]);}assert.equal(PLANT_SEGMENT.growthAgeIsChronologicalYears,false);}finally{s.dispose();}});
