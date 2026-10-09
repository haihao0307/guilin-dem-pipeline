import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {createSteamLocomotive,STEAM_SPEC} from '../steam-model.mjs';
import {createGameTrain,WHEEL_RADIUS} from '../train-model.mjs';
import {COACHES} from '../session.mjs';
const approx=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('Original 2-8-0 engine and eight-wheel tender have an explicit mechanical manifest',()=>{
 const m=createSteamLocomotive();assert.equal(m.proof.original,true);assert.equal(m.proof.wheelArrangement,'2-8-0');assert.equal(m.proof.leadingWheels,2);assert.equal(m.proof.drivingWheels,8);assert.equal(m.proof.trailingWheels,0);assert.equal(m.proof.tenderWheels,8);assert.equal(m.wheels.length,18);assert.equal(m.proof.cylinderDimensions,'19 x 28 in');assert.equal(m.proof.coalPieces,112);assert.ok(m.proof.staticParts>700);
 for(const wheel of m.wheels)approx(wheel.position.y-wheel.userData.radius,STEAM_SPEC.railHead);
 let meshes=0;m.root.traverse(o=>{if(o.isMesh){meshes++;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});assert.equal(meshes,9);assert.equal(m.proof.drawCalls,meshes);assert.ok(m.proof.staticTriangles<30000);
});
test('Wheels roll by distance, are quartered, and main rods keep a constant 2.6 m length',()=>{
 const m=createSteamLocomotive();for(const distance of [0,.1,1.03,20,-3.15,500]){m.update(distance);approx(m.motion.angle,-distance/STEAM_SPEC.driverRadius);for(let side=0;side<2;side++){const pins=m.motion.crankPins[side],slider=m.motion.crossheads[side],main=pins[1];approx(Math.hypot(slider[0]-main[0],slider[1]-main[1]),2.6);for(let i=1;i<4;i++)approx(pins[i][0]-pins[i-1][0],1.28);}
 // A visible cast crank pin exactly follows the corresponding rod endpoint on both sides.
 for(const wheel of m.wheels.filter(w=>w.userData.kind==='driver')){const matrix=new THREE.Matrix4();wheel.userData.batch.getMatrixAt(wheel.userData.instance,matrix);const crank=new THREE.Vector3(STEAM_SPEC.driverRadius*.43,0,0).applyMatrix4(matrix),side=wheel.userData.sign<0?0:1,axle=STEAM_SPEC.driverAxles.indexOf(wheel.position.x),pin=m.motion.crankPins[side][axle];approx(crank.x,pin[0]);approx(crank.y,pin[1]);}}
});
test('Default steam train preserves two coaches, passenger doors, interior mode and old wheel export',()=>{
 const t=createGameTrain();assert.equal(t.proof.wheelArrangement,'2-8-0');assert.equal(t.wheels.length,34);assert.equal(t.proof.count,34);assert.equal(t.coaches.length,2);assert.equal(WHEEL_RADIUS,.285);assert.deepEqual(COACHES.map(c=>c.x),[-11.1,-18]);assert.doesNotMatch(t.root.name,/diesel|FUEL/i);
 t.update({distance:12,brake:true,phase:'boarding',throttle:0,door:1},{interior:true});for(const c of t.coaches){assert.equal(c.roof.material.opacity,.22);for(const door of c.doors)for(const leaf of door.leaves)approx(leaf.mesh.position.x,leaf.x+leaf.side*(door.active?.44:0));}
 t.update({distance:0,brake:false,phase:'running',throttle:1,door:0});for(const c of t.coaches){assert.equal(c.roof.material.opacity,1);for(const door of c.doors)for(const leaf of door.leaves)approx(leaf.mesh.position.x,leaf.x);}
 t.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(t.root);assert.ok(bounds.min.x>-22&&bounds.max.x<5.2&&bounds.max.y<3.8);assert.ok(bounds.min.y>0);
});
test('Legacy option explicitly retains previous diesel study without mutating defaults',()=>{
 const t=createGameTrain({legacy:true});assert.match(t.root.name,/diesel and FUEL/);assert.equal(t.steam,null);assert.equal(t.wheels.length,32);assert.equal(t.proof.inherited.originalBlocks,2102);assert.equal(createGameTrain().proof.original,true);
});
