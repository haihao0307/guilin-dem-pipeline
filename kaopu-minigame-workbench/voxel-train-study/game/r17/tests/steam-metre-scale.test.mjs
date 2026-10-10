import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import {createSteamLocomotive,STEAM_SPEC,STEAM_BRAKE_SHOE_OFFSET} from '../steam-model.mjs';
import {TRACK,WD_VERIFIED,WD_AXLES,CONSIST} from '../metre-scale.mjs';
import {STEAM_AUTHORING,STEAM_CAB_REAR_X,STEAM_CAB_FLOOR_Y,STEAM_CHIMNEY_TOP_Y,STEAM_BOILER_CENTER_Y} from '../steam-scale.mjs';
const near=(a,b,e=2e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function rangeBounds(mesh,predicate=()=>true){const b=new THREE.Box3(),p=mesh.geometry.attributes.position,v=new THREE.Vector3();mesh.updateWorldMatrix(true,false);for(const r of mesh.geometry.userData.partRanges||[{start:0,count:p.count}]){if(!predicate(r))continue;for(let i=r.start;i<r.start+r.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));}return b;}
function boxSize(b){return b.getSize(new THREE.Vector3()).toArray();}
function mesh(model,name){return model.root.getObjectByName(name);}

test('exact WD wheel and axle datums, fictional identity and unknowns are explicit',()=>{
 const m=createSteamLocomotive();assert.equal(m.proof.wheelArrangement,'2-8-0');assert.equal(m.wheels.length,18);assert.match(m.proof.calibration.status,/partial/);assert.equal(m.proof.calibration.verified.overallLength,null);assert.ok(m.proof.calibration.unknown.includes('tender dimensions'));
 const ax=[...WD_AXLES.guide,...WD_AXLES.drivers.slice().reverse()];for(let i=1;i<ax.length;i++)near(ax[i-1]-ax[i],WD_VERIFIED.axleIntervalsFrontToRear[i-1]);near(ax[0]-ax.at(-1),7.5692);near(WD_AXLES.drivers[0]-STEAM_CAB_REAR_X,2.2606);
 for(const w of m.wheels){near(Math.abs(w.position.z),.7825);near(w.position.y-w.userData.radius,TRACK.railHead);if(w.userData.kind==='driver')near(2*w.userData.radius,1.4351);if(w.userData.kind==='guide')near(2*w.userData.radius,.9652);}
});

test('real merged vertices confirm boiler centre/circular diameter, chimney top and cab datums',()=>{
 const m=createSteamLocomotive(),upper=mesh(m,'Batched riveted locomotive upper body');
 const boiler=rangeBounds(upper,r=>r.tag==='boiler-shell');near((boiler.min.y+boiler.max.y)/2,STEAM_BOILER_CENTER_Y);near(boiler.max.y-boiler.min.y,1.75);near(boiler.max.z-boiler.min.z,1.75);
 const chimney=rangeBounds(upper,r=>r.tag==='chimney');near(chimney.max.y,STEAM_CHIMNEY_TOP_Y);near(chimney.max.x-chimney.min.x,chimney.max.z-chimney.min.z);
 const sides=rangeBounds(upper,r=>r.tag==='cab'&&r.sourcePosition[0]===-1.37&&r.sourcePosition[1]===3.06);near(sides.max.z-sides.min.z,2.5908);
 const back=rangeBounds(upper,r=>r.tag==='cab'&&r.sourcePosition[0]===-2.0875);near(back.min.x,STEAM_CAB_REAR_X);
 const floor=rangeBounds(upper,r=>r.tag==='cab'&&r.sourcePosition[0]===-1.34&&r.sourcePosition[1]===1.51);near(floor.max.y,STEAM_CAB_FLOOR_Y);
});

test('all 18 circular wheel treads remain above and across actual rail heads through rotation; flanges stay inside',()=>{
 const m=createSteamLocomotive(),matrix=new THREE.Matrix4(),v=new THREE.Vector3();
 for(const d of [0,.1,.72,2.14,-1.2]){m.update(d);for(const w of m.wheels){const {batch,instance,radius,sign}=w.userData;batch.getMatrixAt(instance,matrix);const p=batch.geometry.attributes.position;let nearest=Infinity,treadCount=0;for(let i=0;i<p.count;i++){const local=new THREE.Vector3().fromBufferAttribute(p,i),radial=Math.hypot(local.x,local.y);if(Math.abs(radial-radius)<1e-6&&local.z>=-.065-1e-6&&local.z<=.085+1e-6){v.copy(local).applyMatrix4(matrix);near(Math.hypot(v.x-w.position.x,v.y-w.position.y),radius);assert.ok(Math.abs(v.z)>=TRACK.gauge/2-2e-6&&Math.abs(v.z)<=TRACK.gauge/2+TRACK.headWidth+2e-6);assert.ok(v.y>=TRACK.railHead-2e-6);nearest=Math.min(nearest,v.y-TRACK.railHead);treadCount++;}if(radial>radius+.015){v.copy(local).applyMatrix4(matrix);assert.ok(Math.abs(v.z)<TRACK.gauge/2,`flange over rail head ${v.z}`);}}assert.ok(treadCount>64);assert.ok(nearest<.001,'64-segment circle contact tolerance');}}
});

test('distance rolling, quartered visible crank pins, constant rods and exactly 28 inch stroke',()=>{
 const m=createSteamLocomotive(),matrix=new THREE.Matrix4();
 for(const d of [0,.1,1.03,20,-3.15,500]){m.update(d);near(m.motion.angle,-d/STEAM_SPEC.driverRadius);for(let side=0;side<2;side++){const pins=m.motion.crankPins[side],slider=m.motion.crossheads[side],main=pins[1];near(Math.hypot(slider[0]-main[0],slider[1]-main[1]),4.2);for(let i=1;i<4;i++)near(pins[i][0]-pins[i-1][0],WD_AXLES.drivers[i]-WD_AXLES.drivers[i-1]);}for(const w of m.wheels.filter(w=>w.userData.kind==='driver')){w.userData.batch.getMatrixAt(w.userData.instance,matrix);const g=w.userData.batch.geometry,r=g.userData.partRanges.find(r=>r.sourcePosition[0]===.3556&&r.sourcePosition[2]===.15),b=new THREE.Box3(),v=new THREE.Vector3();assert.ok(r,'real cast-crank geometry exists');for(let i=r.start;i<r.start+r.count;i++)b.expandByPoint(v.fromBufferAttribute(g.attributes.position,i));const actual=b.getCenter(new THREE.Vector3()).applyMatrix4(matrix),side=w.userData.sign<0?0:1,index=WD_AXLES.drivers.indexOf(w.position.x);near(actual.x,m.motion.crankPins[side][index][0]);near(actual.y,m.motion.crankPins[side][index][1]);}}
 const rods=mesh(m,'Distance-driven coupled rods and piston slides');for(let side=0;side<2;side++){rods.getMatrixAt(side*9+3,matrix);const a=new THREE.Vector3(-.5,0,0).applyMatrix4(matrix),b=new THREE.Vector3(.5,0,0).applyMatrix4(matrix);near(a.distanceTo(b),4.2);near(a.x,m.motion.crankPins[side][1][0]);near(a.y,m.motion.crankPins[side][1][1]);near(b.x,m.motion.crossheads[side][0]);near(b.y,m.motion.crossheads[side][1]);}
 m.update(0);const x1=m.motion.crossheads[1][0];m.update(Math.PI*STEAM_SPEC.driverRadius);near(x1-m.motion.crossheads[1][0],.7112);near(STEAM_SPEC.crankRadius,.3556);near(STEAM_SPEC.driverRadius*Math.PI*2/4,1.1271258,1e-6);
 near(Math.hypot(...STEAM_BRAKE_SHOE_OFFSET),STEAM_SPEC.driverRadius);
});

test('driver uniformly scales torso limbs head and hat, soles touch cab floor',()=>{
 for(const heightM of [1.60,1.80,1.90]){const m=createSteamLocomotive({driverHeightM:heightM}),body=rangeBounds(m.driverBody),head=rangeBounds(m.crew.driverHead);near(body.min.y,STEAM_CAB_FLOOR_Y);near(head.max.y-STEAM_CAB_FLOOR_Y,heightM*1.475/1.385);near(boxSize(body)[0]/heightM,boxSize(rangeBounds(createSteamLocomotive({driverHeightM:1.8}).driverBody))[0]/1.8);assert.ok(head.max.y<TRACK.railHead+STEAM_AUTHORING.cabRoofAboveRail);near(m.proof.placeholderDriver.heightM,heightM);}
});

test('calibrated emission sockets follow only appropriate body motion and are not old authored coordinates',()=>{
 const m=createSteamLocomotive(),out={chimney:[],cylinderLeft:[],cylinderRight:[]};m.fillSteamEmitters(out);near(out.chimney[1]-TRACK.railHead,3.8354);assert.notEqual(out.chimney[0],3.03);assert.deepEqual(out.chimney,m.proof.emitters.chimney);
 m.resetBodyMotion({elapsed:0,distance:0,velocity:8});m.updateBodyMotion({elapsed:.2,distance:1.6,velocity:8,throttle:3},.2);m.fillSteamEmitters(out);const expected=m.transformBodyPoint(m.proof.emitters.chimney);for(let i=0;i<3;i++)near(out.chimney[i],expected[i]);assert.deepEqual(out.cylinderLeft,m.proof.emitters.cylinderLeft);assert.deepEqual(out.cylinderRight,m.proof.emitters.cylinderRight);
});

test('detailed finite geometry preserves tender packaging and explicitly provisional body size',()=>{
 const m=createSteamLocomotive();let meshes=0;m.root.traverse(o=>{if(o.isMesh){meshes++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));for(const v of o.geometry.attributes.normal.array)assert.ok(Number.isFinite(v));}});assert.equal(meshes,m.proof.drawCalls);assert.ok(m.proof.staticParts>700);const b=new THREE.Box3().setFromObject(m.root);near(b.min.x,CONSIST.tenderRearX);assert.ok(b.max.x<5.2);assert.ok(b.max.y<4.65);assert.ok(b.min.y>0);assert.equal(m.proof.coalPieces,112);
});
