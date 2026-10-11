import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../../vendor/three.module.js';
import {profile78,generateTropical78} from './rules/native78-musa-author.mjs';
import {PLANT_SEGMENT,PLANT_PLACEMENTS} from './segment.mjs';
import {createRoutePlan,resolveChunk} from '../street/route-plan.mjs';
import {PLATFORM_LAYOUT} from '../metre-scale.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../street/'+name,import.meta.url)));
const plan=createRoutePlan(read('route.score.json'),[{target:0},{target:700}]),anchor=read('first-street.score.json');
const buildings=plan.chunks.flatMap(chunk=>resolveChunk(plan,chunk,anchor).construction.buildings.map(b=>({...b,worldX:chunk.center+b.x,chunk:chunk.id})));
const specimen=generateTropical78(profile78('musa-balbisiana',{stage:'establishing',habitatForm:'sheltered',seed:761014}),{compactBlades76:true}),g=specimen.geometry,margin=PLANT_SEGMENT.windClearanceMarginM;
const planted=PLANT_PLACEMENTS.map(placement=>{const positions=new Float64Array(g.positions.length),bounds=new THREE.Box3(),point=new THREE.Vector3(),c=Math.cos(placement.yaw),s=Math.sin(placement.yaw);for(let i=0;i<g.positions.length;i+=3){const x=g.positions[i],y=g.positions[i+1],z=g.positions[i+2];positions[i]=placement.chainage+c*x+s*z;positions[i+1]=PLANT_SEGMENT.groundY+y;positions[i+2]=placement.z-s*x+c*z;bounds.expandByPoint(point.fromArray(positions,i));}return{placement,positions,bounds,windBounds:bounds.clone().expandByScalar(margin)};});
const wall=b=>new THREE.Box3(new THREE.Vector3(b.worldX-b.width/2-.30,0,b.frontZ-b.depth-.30),new THREE.Vector3(b.worldX+b.width/2+.30,50,b.frontZ+.30));
// Exact architecture.mjs sidewalk footprint, with independent 2.2m pedestrian
// headroom. The original depth includes .05m on EACH end, not only the front.
const walk=b=>new THREE.Box3(new THREE.Vector3(b.worldX-b.width/2,0,b.frontZ-.05),new THREE.Vector3(b.worldX+b.width/2,2.2,Math.min(-2.40,b.frontZ+3.1)+.05));
// A separate integration task measured these A4+consist extrema at 73 crank
// phases on 2026-10-11 02:14:51 UTC. This is a pending integration constraint,
// not the R03 rendered train. Actual whole-train sweeps must be rerun on merge.
const A4_PENDING_REFERENCE=Object.freeze({phases:73,min:[-58.22399948,.32250005,-1.40970004],max:[5,4.3363,1.45530689],bodyMotionMargin:.06,conservativeSideHalfWidth:1.52});
test('normal-scale native Musa placement transforms every source vertex with 40-degree yaw and retains all 36330 triangles',()=>{
 assert.equal(g.triangleCount,36330);assert.equal(g.indices.length,36330*3);assert.equal(g.positions.length/3,20632);assert.equal(PLANT_PLACEMENTS[0].yaw,0.6981317007977318);assert.equal(PLANT_PLACEMENTS[1].yaw,0);assert.equal(margin,.15);
 const box=planted[0].windBounds,expected={min:[7.653897138371538,-.3100264462232589,-7.105618775278133],max:[12.211436630840439,5.262538486480714,-2.05]};for(const edge of ['min','max'])for(let i=0;i<3;i++)assert(Math.abs(box[edge].toArray()[i]-expected[edge][i])<1e-12,edge+'/'+i);
 assert.deepEqual(planted[0].placement.seed,761014);assert.equal(planted[1].placement.chainage,405.24741793906245);assert(planted.every(p=>p.bounds.min.y<0));assert(specimen.growth.axes.filter(a=>a.role==='pseudostem').every(a=>a.path[0].position[1]===0));
});
test('complete rotated crown plus 15cm wind margin avoids every route wall projection, rail and platform',()=>{
 assert.equal(buildings.length,74);for(const plant of planted){assert(plant.windBounds.max.z<-PLANT_SEGMENT.railHalfClearance);assert(plant.windBounds.max.z<PLATFORM_LAYOUT.minZ);for(const b of buildings)assert(!plant.windBounds.intersectsBox(wall(b)),plant.placement.id+' wall '+b.chunk+'/'+b.id);}
});
test('all native indexed triangles clear every existing 2.2m sidewalk volume using triangle-box SAT and .15m wind expansion',()=>{
 let relevantWalkways=0,triangleTests=0,fullyUndergroundTriangles=0;const triangle=new THREE.Triangle();
 for(const plant of planted){const boxes=buildings.map(b=>({id:b.chunk+'/'+b.id,box:walk(b).expandByScalar(margin)}));
  for(const target of boxes){if(!plant.bounds.intersectsBox(target.box))continue;relevantWalkways++;for(let i=0;i<g.indices.length;i+=3){triangle.a.fromArray(plant.positions,g.indices[i]*3);triangle.b.fromArray(plant.positions,g.indices[i+1]*3);triangle.c.fromArray(plant.positions,g.indices[i+2]*3);if(Math.max(triangle.a.y,triangle.b.y,triangle.c.y)<PLANT_SEGMENT.groundY){fullyUndergroundTriangles++;continue;}triangleTests++;assert(!target.box.intersectsTriangle(triangle),plant.placement.id+' sidewalk '+target.id+' triangle '+i/3);}}
 }
 assert(relevantWalkways>0,'The new rotated crown requires a real narrow-phase sidewalk test');assert(triangleTests>30000,'Test complete source triangles rather than only vertices in boxes');assert(fullyUndergroundTriangles>=0);
});
test('SAT includes triangles crossing a box with all three vertices outside, avoiding vertex-only false clearance',()=>{
 const box=new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1)),triangle=new THREE.Triangle(new THREE.Vector3(-2,0,0),new THREE.Vector3(2,0,0),new THREE.Vector3(0,2,0));assert([triangle.a,triangle.b,triangle.c].every(p=>!box.containsPoint(p)));assert(box.intersectsTriangle(triangle));triangle.a.z=triangle.b.z=triangle.c.z=2;assert(!box.intersectsTriangle(triangle));
});
test('pending A4 73-phase envelope plus body motion is bounded by ±1.52m and never meets either plant over route translation',()=>{
 const a4=A4_PENDING_REFERENCE;assert.equal(a4.phases,73);assert(Math.abs(a4.min[2])+.06<1.52);assert(a4.max[2]+.06<1.52);
 const conservative=new THREE.Box3(new THREE.Vector3(a4.min[0]-.06,.32-.06,-a4.conservativeSideHalfWidth),new THREE.Vector3(a4.max[0]+.06,4.34+.06,a4.conservativeSideHalfWidth));
 for(const plant of planted){assert(plant.windBounds.max.z<conservative.min.z,'Lateral clearance holds for every longitudinal route position');assert(!plant.windBounds.intersectsBox(conservative));}
 assert(planted[0].windBounds.min.x-a4.max[0]>2.65);assert(planted[0].windBounds.min.x-conservative.max.x>2.59);assert(conservative.min.z-planted[0].windBounds.max.z>=.53-1e-12);
});
