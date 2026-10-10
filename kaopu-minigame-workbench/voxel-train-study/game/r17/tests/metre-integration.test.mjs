import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../../../vendor/three.module.js';
import {TRACK,WD_VERIFIED,COACH_DIMENSIONS as D,COACH_LAYOUT,COACH_FLOOR,PLATFORM_LAYOUT as P,CONSIST_BOUNDS} from '../metre-scale.mjs';
import {Session,replay,DT} from '../session.mjs';import {createGameWorld} from '../world.mjs';
import {createStationPlatform} from '../station-platform.mjs';import {createSteamDynamics} from '../steam-dynamics.mjs';
import {CAMERA_PRESETS,boundCameraPose,CAMERA_LIMITS} from '../camera-presets.mjs';
import {BRAKE_EMITTERS} from '../brake-effects.mjs';import {STEAM_SPEC} from '../steam-model.mjs';
const close=(a,b,s,eps=1e-5)=>assert(Math.abs(a-b)<eps,`${s}: ${a} vs ${b}`);
globalThis.document??={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
function bounds(o){o.updateWorldMatrix(true,true);const box=new THREE.Box3(),v=new THREE.Vector3(),mi=new THREE.Matrix4(),m=new THREE.Matrix4();o.traverse(a=>{if(!a.geometry)return;const p=a.geometry.attributes.position;for(let j=0;j<(a.isInstancedMesh?a.count:1);j++){if(a.isInstancedMesh){a.getMatrixAt(j,mi);m.multiplyMatrices(a.matrixWorld,mi);}else m.copy(a.matrixWorld);for(let i=0;i<p.count;i++)box.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(m));}});return box;}
const world=createGameWorld({street:false});
test('actual continuous and near-detail rail head faces both give 1435 mm gauge',()=>{
 const rail=world.terrain.getObjectByName('Unbroken straight ballast and rails'),p=rail.geometry.attributes.position;
 const box=(start)=>{const b=new THREE.Box3(),v=new THREE.Vector3();for(let i=start;i<start+24;i++)b.expandByPoint(v.fromBufferAttribute(p,i));return b;};
 close(box(96).min.z-box(48).max.z,TRACK.gauge,'continuous inner gauge');
 const zs=[];world.terrain.traverse(o=>{if(!o.visible||!o.name.startsWith('Original close detail'))return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-TRACK.railHead)<1e-6&&Math.abs(p.getZ(i))<1)zs.push(Math.abs(p.getZ(i)));});
 assert(zs.length>100);close(Math.min(...zs)*2,TRACK.gauge,'near rail inner faces');close(Math.max(...zs),TRACK.centerOffset+TRACK.headWidth/2,'near outer face');
});
test('full-size coach door coverage is derived from the rebuilt platform, not a 24m legacy interval',()=>{
 const s=new Session({line:'kcr1'});s.command('start');s.stepTicks(30);assert(s.canOpen());assert(s.platformCoversDoors());
 for(const car of COACH_LAYOUT)for(const x of [car.frontDoor,car.rearDoor])assert(x>P.minX+.22&&x<P.maxX-.22);
 s.distance=s.station.target-7;assert.equal(s.platformCoversDoors(),false,'rear door is outside platform at excessive early stop');
});
test('actual deck geometry, crew foot anchor and geometry width follow the platform metre contract',()=>{
 const station=createStationPlatform({index:0,name:'尖沙咀',english:'Kowloon'}),b=bounds(station.group.getObjectByName('Station deck surface'));
 close(b.min.x,P.minX,'deck start');close(b.max.x,P.maxX,'deck end');close(b.min.z,P.minZ,'edge');close(b.max.z,P.maxZ,'rear edge');close(b.max.y,P.top,'surface');
 close(station.crew.root.position.y,P.top,'guard foot anchor');const person=bounds(station.crew.root);close(person.min.y,P.top,'guard soles');assert(person.max.y-P.top>1.72&&person.max.y-P.top<1.9,'guard cap additional');station.dispose();
});
test('all four doors use a valid external landing and two actual step levels',()=>{
 const s=new Session({line:'kcr1'});s.command('start');s.stepTicks(30);s.command('station-action');for(let i=0;i<2000&&s.phase!=='ready-depart';i++)s.stepTicks(1);assert.equal(s.phase,'ready-depart');assert.equal(s.stats.stops,1);assert.equal(s.stats.pickedUp,3);assert.equal(s.stats.delivered,2);
 assert(s.actors.filter(a=>a.kind==='seated').every(a=>Math.abs(a.position[1]-COACH_FLOOR)<1e-9));
 for(const coach of world.train.coaches)for(const d of coach.doors.filter(d=>d.active))assert(d.x>P.minX&&d.x<P.maxX);
});
test('authoritative replay, pause and ordinary pedestrian speed survive physical-length changes',()=>{
 const s=new Session({line:'kcr1',seed:'metre-path'});s.command('start');s.stepTicks(30);s.command('station-action');let moving=0;
 for(let i=0;i<1200&&s.phase!=='ready-depart';i++){const before=new Map(s.actors.filter(a=>a.path).map(a=>[a.id,a.position.slice()]));s.stepTicks(1);for(const a of s.actors)if(before.has(a.id)&&a.frame==='world'){const d=Math.hypot(...a.position.map((v,j)=>v-before.get(a.id)[j]));assert(d<=1.65*DT+1e-6);moving++;}}
 assert(moving>100);assert.equal(replay(s.replayPacket()).signature(),s.signature());s.command('pause',true);const x=s.signature();s.advance(2);assert.equal(s.signature(),x);
});
test('steam exhaust phase and source sockets use the same actual driver radius as wheels',()=>{
 const dynamics=createSteamDynamics(),s=new Session({line:'kcr1'});s.command('start');s.command('throttle-up');let report;for(let i=0;i<240;i++){s.stepTicks(1);world.train.update(s.view());report=dynamics.update(s.view(),{emitters:world.fillSteamEmitters({chimney:[],cylinderLeft:[],cylinderRight:[]})});}
 close(report.proof.wheelRadius,WD_VERIFIED.driverDiameter/2,'exhaust radius');close(report.proof.wheelAngle,world.train.steam.motion.angle,'exhaust versus wheel angle');
 const emit=world.fillSteamEmitters({chimney:[],cylinderLeft:[],cylinderRight:[]});assert(emit.chimney[1]>4,'source is on taller calibrated engine');assert.deepEqual(emit.cylinderLeft,world.train.steam.emitters.cylinderLeft);
});
test('rim-effect origins remain on verified driver circles and within rail tread axial width',()=>{
 for(const e of BRAKE_EMITTERS){close(Math.hypot(e.position[0]-STEAM_SPEC.driverAxles[e.axleIndex],e.position[1]-TRACK.railHead-STEAM_SPEC.driverRadius),STEAM_SPEC.driverRadius,'rim radius');assert(Math.abs(e.position[2])>=TRACK.gauge/2);assert(Math.abs(e.position[2])<=TRACK.centerOffset+TRACK.headWidth/2);}
});
test('camera safety enclosure contains the actual longer train and clamps sweeps out of it',()=>{
 const b=bounds(world.train.root),c=CAMERA_LIMITS.trainClearance;assert(b.min.x>c.min[0]&&b.max.x<c.max[0]);assert(b.min.z>c.min[2]&&b.max.z<c.max[2]);assert(b.max.y<c.max[1]);
 for(let x=b.min.x;x<=b.max.x;x+=.5)for(const z of [-1,0,1]){const p=boundCameraPose([x,2,z],[x,2,0]).position;assert(!p.every((v,i)=>v>c.min[i]&&v<c.max[i]));}
 for(const preset of Object.values(CAMERA_PRESETS))for(const layout of ['landscape','portrait'])assert(preset[layout].position.every(Number.isFinite));
});

test('existing route truss is raised to clear the complete metre train envelope',async()=>{
 const {Blocks,bridge}=await import('../heritage.mjs'),b=new Blocks();bridge(b,0);const g=b.geometry(),p=g.attributes.position;
 const top=[];for(let i=p.count-6*24;i<p.count;i++)top.push(p.getY(i)); // final six spanning crossbeams, actual vertices
 assert(Math.min(...top)>4,'selected complete top beam geometry');
 assert(top.length>0);assert(Math.min(...top)>=CONSIST_BOUNDS.max[1]+.25-1e-5);g.dispose();
});

test('all existing station variants and waiting-room roofs stay outside the moving train side envelope',async()=>{
 const {createStationRoom}=await import('../station-room.mjs');const movingSide=1.49; // actual maximum 1.45531 plus 34mm body-motion allowance
 for(let index=0;index<9;index++){
  const station=createStationPlatform({index,name:'TEST',english:'TEST'}),room=createStationRoom({index});room.group.position.y+=P.top-.82;station.group.add(room.group);station.group.updateMatrixWorld(true);
  let nearest=Infinity;const v=new THREE.Vector3();station.group.traverse(o=>{if(!o.geometry)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y>.4)nearest=Math.min(nearest,v.z);}});
  assert(nearest>movingSide,`station ${index} nearest fixed above-rail structure ${nearest}`);room.dispose();station.dispose();
 }
});

test('stop-zone cross-track marking is ground paint, never an 80mm obstacle above rails',()=>{
 const s=createStationPlatform({index:0,name:'TEST',english:'TEST'}),o=s.group.getObjectByName('Ground-painted stopping zone and side marker'),p=o.geometry.attributes.position;
 for(let i=0;i<4*24;i++)assert(p.getY(i)<TRACK.railHead-.12);s.dispose();
});
