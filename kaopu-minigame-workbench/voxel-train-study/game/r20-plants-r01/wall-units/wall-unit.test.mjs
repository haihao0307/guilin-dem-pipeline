import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {buildWallUnit,checkWallJoin,normalizeWallScore,planWallUnit,WALL_KINDS} from './wall-unit.mjs';
import {createWallUnitFixtures} from './fixtures.mjs';
const HOST=process.env.WALL_HOST_GAME_ROOT??'/workspace/scratch/2f609cc83d31/train-plants-r02-20261010/candidate/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r02';
const THREE=await import(pathToFileURL(HOST+'/../../vendor/three.module.js'));
const {createMaterialLibrary}=await import(pathToFileURL(HOST+'/street/materials.mjs'));
const library=()=>createMaterialLibrary(THREE,{performance:{limits:{maxMaterials:48}}});
function withWall(input,fn){const materials=library(),wall=buildWallUnit(input,{THREE,materials});try{fn(wall,materials);}finally{wall.dispose();materials.dispose();}}
function digest(root){const h=createHash('sha256');root.traverse(o=>{if(o.geometry){for(const a of Object.values(o.geometry.attributes))h.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));h.update(new Uint8Array(o.geometry.index.array.buffer));}});return h.digest('hex');}
function ray(root,x,y){root.updateWorldMatrix(true,true);return new THREE.Raycaster(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1),0,4).intersectObject(root,true);}

for(const kind of WALL_KINDS)test(kind+': real geometry, finite metre bounds, zero image textures',()=>withWall({kind},wall=>{
  const m=wall.measure();assert(m.triangles>0);assert(m.geometryBytes>0);assert(m.triangles<20000);assert(m.worldBounds.min.every(Number.isFinite));assert(m.worldBounds.max.every(Number.isFinite));
  assert.equal(wall.proof.opening.physicalVoid,true);assert.equal(wall.proof.externalMesh,false);
  wall.root.traverse(o=>{for(const value of Object.values(o.material??{}))assert(!value?.isTexture);if(o.geometry){for(const a of Object.values(o.geometry.attributes))assert([...a.array].every(Number.isFinite));}});
}));
test('normalizer rejects malformed and out-of-bounds openings before generation',()=>{
  for(const bad of [{kind:'wall-from-mesh'},{url:'x'},{dimensions:{width:NaN}},{opening:{x:4}},{kind:'tile-door',opening:{bottom:.1}},{tile:{joint:.1}},{pipe:{role:'untyped-wire'}}])assert.throws(()=>normalizeWallScore(bad));
  assert.equal(normalizeWallScore({material:{ageYears:0}}).material.repairAgeYears,0);
});
test('same recipe repeats geometry and material recipes exactly',()=>{
  assert.deepEqual(planWallUnit({kind:'cage-window'}),planWallUnit({kind:'cage-window'}));
  const lib=library(),a=buildWallUnit({kind:'tile-door'},{THREE,materials:lib}),b=buildWallUnit({kind:'tile-door'},{THREE,materials:lib});try{assert.equal(digest(a.root),digest(b.root));}finally{a.dispose();b.dispose();lib.dispose();}
});
test('door is a real void; opening/closing changes collision and walk edge together',()=>withWall({kind:'tile-door'},wall=>{
  assert.equal(ray(wall.root,0,1).length,0);assert.equal(wall.passageFits({width:.55,height:1.70}).fits,true);
  assert.equal(wall.passageFits({width:1.1,height:1.70}).fits,false);
  wall.setDoorOpen(false);assert(ray(wall.root,0,1).some(h=>h.object.name==='door/door'));assert.equal(wall.passageFits({width:.55,height:1.70}).fits,false);
  wall.setDoorOpen(true);assert.equal(ray(wall.root,0,1).length,0);assert.equal(wall.snapshot().score.door.open,true);
}));
test('window rays pass through wall material and only hit actual pane/frame',()=>withWall({kind:'plaster-window'},wall=>{
  const hits=ray(wall.root,.21,1.45);assert(hits.some(h=>h.object.name==='static/glass'));assert(!hits.some(h=>['static/wall','static/repair'].includes(h.object.name)));
}));
test('tiles and repairs are clipped to the shared opening, not painted over it',()=>{
  for(const kind of WALL_KINDS){const p=planWallUnit({kind}),[x0,y0,x1,y1]=p.opening.rect;
    for(const q of p.parts.filter(q=>['ceramic-tile','younger-plaster-repair','pierced-wall'].includes(q.tag))){const [x,y]=q.position,[w,h]=q.size;const area=Math.max(0,Math.min(x+w/2,x1)-Math.max(x-w/2,x0))*Math.max(0,Math.min(y+h/2,y1)-Math.max(y-h/2,y0));assert(area<1e-10);}
  }
});
test('sill shader coordinates and physical runoff sources share opening parameters',()=>withWall({opening:{x:.25,width:.9,bottom:.83}},wall=>{
  assert.deepEqual(wall.proof.runoffSources.map(s=>s.position.slice(0,2)),[[-.2,.83],[.7,.83]]);
  for(const m of wall.materials){assert.equal(m.userData.street.uniforms.wallOpeningX.value,.25);assert.equal(m.userData.street.config.sill[0],.83);assert.equal(m.userData.street.config.sill[1],(2.6-.9)/(2*2.6));}
}));
test('KST1 shader hooks use whole-wall local positions/normals under rigid placement',()=>withWall({placement:{position:[14,6,-8],yaw:Math.PI/2}},wall=>{
  for(const m of wall.materials){const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(shader);
    assert(shader.vertexShader.includes('vWallLocalPosition=transformed'));assert(shader.fragmentShader.includes('vec3 stP=vWallLocalPosition'));
    assert(shader.fragmentShader.includes('abs(normalize(vWallLocalNormal))'));assert(!shader.fragmentShader.includes('vStreetPosition-stWorldOffset-stOrigin'));
    assert(shader.fragmentShader.includes('stRising*=wallGroundContact'));assert(shader.fragmentShader.includes('stUV.x-wallOpeningX'));
  }
}));
test('host translation and yaw change graph locations without changing native geometry',()=>withWall({kind:'tile-door'},wall=>{
  const hash=digest(wall.root),before=wall.worldGraph();wall.root.position.set(11,3,-8);wall.root.rotation.y=Math.PI/2;
  const after=wall.worldGraph();assert.equal(digest(wall.root),hash);for(let i=0;i<before.nodes.length;i++){const p=before.nodes[i].position,actual=after.nodes[i].position;assert(Math.abs(actual[0]-(11+p[2]))<1e-8);assert(Math.abs(actual[1]-(3+p[1]))<1e-8);assert(Math.abs(actual[2]-(-8-p[0]))<1e-8);}
}));
test('no implicit stretch to fit a site',()=>withWall({},wall=>{wall.root.scale.set(1,2,1);assert.throws(()=>wall.update(0),/scale 1/);wall.root.scale.set(1,1,1);}));
test('shared world time/weather is deterministic and per-unit uniforms are isolated',()=>{
  const lib=library(),a=buildWallUnit({},{THREE,materials:lib}),b=buildWallUnit({},{THREE,materials:lib});try{
    a.update(12,{wetness:.8});assert.equal(a.materials[0].userData.street.uniforms.stTime.value,12);assert.equal(b.materials[0].userData.street.uniforms.stTime.value,0);
    const snap=a.snapshot();a.update(12,{wetness:.8});assert.deepEqual(a.snapshot(),snap);assert.throws(()=>a.update(NaN));
  }finally{a.dispose();b.dispose();lib.dispose();}
});
test('pipe endpoints are traceable, declared unconnected and do not block the door',()=>withWall({kind:'tile-door'},wall=>{
  const graph=wall.worldGraph();assert.equal(graph.utilityPorts.length,2);assert(graph.utilityPorts.every(p=>p.connected===false));
  assert.equal(wall.proof.utilityPaths[0].from,'pipe-inlet');assert.equal(wall.proof.utilityPaths[0].to,'pipe-outlet');assert.equal(ray(wall.root,0,1).length,0);
}));
test('cage only declares hanging sockets, not a walkable balcony or occupants',()=>withWall({kind:'cage-window'},wall=>{
  assert.equal(wall.proof.hangingSockets.length,2);assert.equal(wall.proof.cageIsWalkableBalcony,false);assert.equal(wall.proof.graph.edges.length,0);assert.equal(wall.proof.populationProvided,false);
}));
test('matching wall endpoints connect; no automatic movement or magic corner link',()=>{
  const lib=library(),a=buildWallUnit({},{THREE,materials:lib}),b=buildWallUnit({placement:{position:[2.6,0,0]}},{THREE,materials:lib});try{
    assert.equal(checkWallJoin(a,'join-right',b,'join-left').connected,true);b.root.position.x+=.1;assert.equal(checkWallJoin(a,'join-right',b,'join-left').connected,false);
  }finally{a.dispose();b.dispose();lib.dispose();}
});
test('dispose releases own geometry/materials once, never the host library',()=>{
  const lib=library(),wall=buildWallUnit({kind:'tile-door'},{THREE,materials:lib});let disposed=0,hostDisposed=0;wall.root.traverse(o=>o.geometry?.addEventListener('dispose',()=>disposed++));for(const m of wall.materials)m.addEventListener('dispose',()=>disposed++);for(const m of lib.materials)m.addEventListener('dispose',()=>hostDisposed++);
  wall.dispose();const first=disposed;assert(first>0);wall.dispose();assert.equal(disposed,first);assert.equal(hostDisposed,0);assert.throws(()=>wall.update(0),/disposed/);lib.dispose();assert(hostDisposed>0);
});
test('three-piece opt-in host fixture has no occupants, textures, or route side effects',()=>{
  const f=createWallUnitFixtures({THREE,createMaterialLibrary,origin:[0,0,0]});try{assert.equal(f.handles.length,3);f.update(9,{wetness:.5});const m=f.measure();assert.equal(m.textures,0);assert(m.units.reduce((s,x)=>s+x.triangles,0)<25000);assert(f.handles.every(h=>h.proof.time===9));}finally{f.dispose();}
});
