import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import * as THREE from '../../../vendor/three.module.js';
import {build,validate,parseScore,update,measure,snapshot,dispose} from '../street/instrument.mjs';
import {createStreetDistrict,streetOffset,streetToGame,STREET_PLACEMENT} from '../street-district.mjs';
import {Session,COACHES} from '../session.mjs';
import {Session as OldSession} from '../../session.mjs';
const source=readFileSync(new URL('../street/first-street.score.json',import.meta.url),'utf8');
const score=()=>JSON.parse(source);
const withHandle=(fn,s=score())=>{const h=build(s);try{return fn(h);}finally{dispose(h);}};

test('Versioned resolved Score rejects foreign ABI, units, baked assets, nonfinite values and budget abuse',()=>{
 assert(validate(score()).valid);assert.deepEqual(parseScore(source),score());
 for(const mutate of [s=>s.instrument.abi='K2',s=>s.axis='Z_UP',s=>s.construction.meshes=[],s=>s.construction.vertices=[0,1,2],s=>s.appearance.textureUrl='anything',s=>s.object.seed=NaN,s=>s.motion.timeSource='wallclock',s=>s.construction.buildings[0].floors=99,s=>s.performance.limits.maxTriangles=1e9,s=>s.provenance.externalMesh=true,s=>s.construction.buildings[0].shops[0].text='未知字']){const s=score();mutate(s);assert.equal(validate(s).valid,false);assert.throws(()=>parseScore(s));}
});
test('Runtime creates detailed finite geometry with shared instances and no image textures',()=>withHandle(h=>{
 const m=measure(h);assert(m.expandedTriangles>15000&&m.expandedTriangles<=180000);assert(m.instances>500&&m.instances<=12000);assert(m.materials<=48);assert.equal(m.textures,0);assert(m.geometries<m.meshes);assert(m.bounds.max[1]>17);assert(m.bounds.max[0]-m.bounds.min[0]>15);
 h.root.traverse(o=>{if(!o.geometry)return;for(const a of Object.values(o.geometry.attributes))for(const v of a.array)assert(Number.isFinite(v));if(o.geometry.index)for(const i of o.geometry.index.array)assert(i<o.geometry.attributes.position.count);for(const k of ['map','normalMap','roughnessMap','emissiveMap'])assert(!o.material?.[k]);});
}));
test('Same recipe and explicit time reconstruct exactly; edits truly change generated output',()=>{
 const a=build(score()),b=build(score());try{assert.equal(snapshot(a).hash,snapshot(b).hash);update(a,3);update(b,3);assert.equal(snapshot(a).hash,snapshot(b).hash);const before=snapshot(a).hash;update(a,3);assert.equal(snapshot(a).hash,before);update(a,0);update(b,0);assert.equal(snapshot(a).hash,snapshot(b).hash);}finally{dispose(a);dispose(b);}
 const base=withHandle(h=>snapshot(h));
 for(const change of [s=>s.construction.buildings[0].floors=3,s=>s.construction.windowCageDensity=0,s=>s.construction.signDensity=0,s=>s.construction.buildings[0].age=.1,s=>s.construction.buildings[0].repair=.9]){const s=score();change(s);const changed=withHandle(h=>snapshot(h),s);assert.notEqual(changed.hash,base.hash);}
});
test('All generated transformed vertices remain outside actual rail swept clearance',()=>withHandle(h=>{
 const p=new THREE.Vector3(),instance=new THREE.Matrix4(),world=new THREE.Matrix4();h.root.updateMatrixWorld(true);
 h.root.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let n=0;n<(o.isInstancedMesh?o.count:1);n++){if(o.isInstancedMesh){o.getMatrixAt(n,instance);world.multiplyMatrices(o.matrixWorld,instance);}else world.copy(o.matrixWorld);for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(world);assert(!(Math.abs(p.z)<1.6&&p.y>.27&&p.y<4.75),'rail intrusion '+o.name+' '+p.toArray());}}});
}));
test('Cloth uses pure Session elapsed and leaves every authored pin unchanged',()=>withHandle(h=>{
 assert(h.cloth.length>0);const before=h.cloth.map(c=>c.mesh.geometry.attributes.position.array.slice());update(h,1.1);let moved=0;
 h.cloth.forEach((c,j)=>{const a=c.mesh.geometry.attributes.position.array;for(let i=0;i<c.pinned.length;i++){if(c.pinned[i])assert.deepEqual([...a.slice(i*3,i*3+3)],[...c.rest.slice(i*3,i*3+3)]);else if(a[i*3+2]!==before[j][i*3+2])moved++;}});assert(moved>0);const paused=h.cloth.map(c=>c.mesh.geometry.attributes.position.array.slice());update(h,1.1,{wetness:.8});h.cloth.forEach((c,i)=>assert.deepEqual(c.mesh.geometry.attributes.position.array,paused[i]));assert.equal(h.state.time,1.1);assert.throws(()=>update(h,Infinity));
}));
test('Disposal is idempotent and releases each tracked GPU resource exactly once',()=>{
 const h=build(score()),g=new Set(),m=new Set();h.root.traverse(o=>{if(o.geometry)g.add(o.geometry);for(const v of(Array.isArray(o.material)?o.material:o.material?[o.material]:[]))m.add(v);});let gd=0,md=0;for(const x of g)x.addEventListener('dispose',()=>gd++);for(const x of m)x.addEventListener('dispose',()=>md++);const parent=new THREE.Group();parent.add(h.root);dispose(h);dispose(h);assert.equal(gd,g.size);assert.equal(md,m.size);assert.equal(h.root.children.length,0);assert.equal(parent.children.length,0);assert.equal(h.cloth.length,0);assert.throws(()=>update(h,2));
});
test('Host coordinate boundary, load hysteresis, release/re-entry and same-time state are real',async()=>{
 assert.equal(new THREE.Matrix4().makeTranslation(0,.0805,0).determinant(),1);assert.deepEqual(streetToGame([1,2,-7],30),[-2,2.0805,-7]);assert.equal(streetOffset(30),-3);assert.equal(COACHES.length,2);
 const district=createStreetDistrict({score:score()});await district.ready;const view={distance:30,elapsed:2};district.update(view,[{target:0}]);assert(district.proof.active);assert.equal(district.root.position.x,-3);assert.equal(district.handle.state.time,2);const first=district.snapshot().hash;
 district.update({distance:31,elapsed:2},[{target:0}]);assert.equal(district.handle.state.time,2);assert.equal(district.proof.loadCount,1);
 district.update({distance:1000,elapsed:20},[{target:0}]);assert(!district.proof.active);assert.equal(district.proof.unloadCount,1);assert.equal(district.root.children.length,2);assert(district.root.children.every(o=>o.isPointLight&&o.visible&&o.intensity===0));
 district.update(view,[{target:0}]);assert.equal(district.proof.loadCount,2);assert.equal(district.snapshot().hash,first);district.dispose();assert.equal(district.proof.status,'disposed');assert.equal(district.root.children.length,0);
});
test('Late score load after disposal cannot attach objects; invalid score keeps host alive',async()=>{
 let resolve;const d=createStreetDistrict({loadText:()=>new Promise(r=>resolve=r)});d.update({distance:30,elapsed:0},[{target:0}]);d.dispose();resolve(source);await d.ready;assert.equal(d.root.children.length,0);assert.equal(d.proof.loadCount,0);
 const bad=score();bad.instrument.abi='wrong';const e=createStreetDistrict({score:bad});await e.ready;assert.equal(e.proof.status,'error');assert.doesNotThrow(()=>e.update({distance:30,elapsed:0},[{target:0}]));e.dispose();
});
test('R17 keeps authoritative 30 Hz driving/pause clock and unchanged controls while replacing dimensions',()=>{
 for(const name of ['timetable.mjs','driver-input.mjs','audio-spatial.mjs','station-room.mjs','view-controls.mjs']){
  const old=readFileSync(new URL('../../'+name,import.meta.url),'utf8').replaceAll("'../vendor/","'../../vendor/");assert.equal(readFileSync(new URL('../'+name,import.meta.url),'utf8'),old,name);
 }
 const a=new Session({line:'kcr1',seed:'KST1-clock'}),b=new OldSession({line:'kcr1',seed:'KST1-clock'});
 for(const state of[a,b]){state.command('start');state.command('throttle-up');state.stepTicks(1200);state.command('pause',true);}
 for(const key of ['tick','elapsed','distance','velocity'])assert.equal(a[key],b[key],key);
 const frozen=a.signature();a.stepTicks(90);assert.equal(a.signature(),frozen);
 assert.equal(a.actors.filter(p=>p.kind==='seated').length,b.actors.filter(p=>p.kind==='seated').length);
});
test('Entry is the full game with isolated storage, shared host engine and no R15 mesh dependency',()=>{
 const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),views=readFileSync(new URL('../view-profile-storage.mjs',import.meta.url),'utf8');assert.match(app,/kcr-kst1-r17/);assert.match(app,/kaopu\.train-driver\.r17\.save\.v1/);assert.match(app,/kaopu\.train-driver\.r17\.quality\.v1/);assert.match(views,/kaopu\.train-driver\.r17\.views\.v1/);assert.match(html,/id="startGame"/);assert.match(html,/data-camera="city"/);assert.match(html,/href="\.\.\/" class="classic-link">回到 R14/);
 for(const name of['street-district.mjs','street/instrument.mjs','street/architecture.mjs','street/materials.mjs','street/glyphs.mjs']){const s=readFileSync(new URL('../'+name,import.meta.url),'utf8');assert.doesNotMatch(s,/TextureLoader|CanvasTexture|DataTexture|city-assets|\.bin\.gz/);assert.doesNotMatch(s,/requestAnimationFrame|performance\.now\(|Date\.now\(|Math\.random\(/);}
});

test('InstancedMesh owns per-object GPU buffers and receives exactly one dispose event',()=>{
 const h=build(score()),instances=[];let events=0;h.root.traverse(o=>{if(o.isInstancedMesh){instances.push(o);o.addEventListener('dispose',()=>events++);}});assert(instances.length>0);dispose(h);dispose(h);assert.equal(events,instances.length);
});
