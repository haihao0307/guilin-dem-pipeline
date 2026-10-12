import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {applyBureauGroundClearance} from '../../bureau-train88-r01/host-ground-clearance.mjs';
import {createRouteObserverDomain} from '../route-observer-domain.mjs';
const host=new URL(existsSync(new URL('../../world.mjs',import.meta.url))?'../../':'../../kowloon-station-r03/restored/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/',import.meta.url);
const THREE=await import(new URL('../../vendor/three.module.js',host));
const {WORLD,partitionTerrain}=await import(new URL('world.mjs',host));
const {buildEnvironment}=await import(new URL('heritage.mjs',host));
const {createFlatTerrain,FLAT_WORLD}=await import(new URL('flat-terrain.mjs',host));
const {PLATFORM_LAYOUT}=await import(new URL('metre-scale.mjs',host));
const {Session}=await import(new URL('session.mjs',host));

const EARTH='Broad continuous earth, no exposed strip edge',RAIL='Unbroken straight ballast and rails',FIELDS='Fields extending on both sides of railway';
const box=view=>({minX:605-view.distance,maxX:785-view.distance,minZ:-141,maxZ:9});
const capture=root=>{const records=[];root.traverse(o=>{if(o.geometry)records.push({id:o.id,visible:o.visible,x:o.position.x,count:o.count,material:o.material,positions:o.geometry.attributes.position.array.slice(),instances:o.instanceMatrix?.array.slice()});});return records;};
const tileKey=(i,x)=>i+':'+Math.round(x*1e5);
function activeTiles(root){const chunks=new Set(),fields=new Set(),matrix=new THREE.Matrix4();root.traverse(o=>{
  if(!o.visible)return;
  const high=/^Original close detail (\d+):/.exec(o.name),low=/^Distant sleepers and fence (\d+)$/.exec(o.name);
  if(high)chunks.add(tileKey(high[1],root.position.x+o.position.x));
  if(low||o.name===FIELDS)for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);(low?chunks:fields).add(tileKey(low?.[1]||'field',root.position.x+o.position.x+matrix.elements[12]));}
});return{chunks,fields};}

test('real original terrain adds one finite domain; authoritative Session and host meshes remain untouched',()=>{
  const game=new Session({line:'kcr1',seed:'ROUTE-OBSERVER-CPU'}),view=game.view(),route=game.route;
  assert.equal(route[1].target,700);assert.equal(view.distance,0);
  const original=createFlatTerrain(partitionTerrain(buildEnvironment(WORLD,{platformCorridor:true,includeBridge:false,optimizeGeometry:true}))),hostRoot=new THREE.Group();hostRoot.add(original.root);
  let hostIndices=[0];const world={root:hostRoot,terrain:original.root,stationProof:()=>hostIndices.map(index=>({index}))};
  const updates=[],models=[];
  // Station factory spy checks reference/retirement contracts only. This is not
  // a visual substitute and does not claim a canvas/font or GPU station test.
  const createStationModel=plan=>{const group=new THREE.Group(),record={plan,group,disposed:0,update(v,p){updates.push({view:v,plan:p});group.position.x=p.target-v.distance;group.visible=false;},dispose(){this.disposed++;}};models.push(record);return record;};
  const source={createStationModel,createFlatTerrain,partitionTerrain,buildEnvironment,WORLD,FLAT_WORLD,PLATFORM_LAYOUT};
  assert.throws(()=>createRouteObserverDomain({THREE,world,source:{...source,FLAT_WORLD:{...FLAT_WORLD,terrainRadius:1400}},applyGroundClearance:()=>{}}),/seven-slot/);
  assert.throws(()=>createRouteObserverDomain({THREE,world,source:{...source,FLAT_WORLD:{...FLAT_WORLD,slotCount:70}},applyGroundClearance:()=>{}}),/seven-slot/);
  const adapter=createRouteObserverDomain({THREE,world,source,
    applyGroundClearance:(w,getView,getRoute)=>applyBureauGroundClearance(w,getView,getRoute,(v)=>box(v)),getExclusions:v=>[box(v)]});
  const signature=game.signature(),beforeView=JSON.stringify(view),beforeRoute=JSON.stringify(route),beforeHost=capture(original.root);
  let p=adapter.update(view,route,{enabled:true,centerX:700});
  assert.equal(p.active,true);assert.deepEqual(p.activeStationIndices,[1]);assert.equal(p.terrainBuilds,1);assert.equal(p.frame.samplingChainage,708);
  assert.equal(updates[0].view,view);assert.equal(updates[0].plan,route[1]);assert.equal(models[0].group.position.x,700);assert.equal(models[0].group.visible,true);
  const auxiliary=adapter.root.children.find(o=>o.name===original.root.name);
  assert.ok(auxiliary);assert.equal(auxiliary.position.x,708);assert.equal(auxiliary.getObjectByName(EARTH),undefined);assert.ok(original.root.getObjectByName(EARTH));
  assert.equal(auxiliary.userData.proof.sourceVertexDeviation,0);assert.equal(auxiliary.userData.proof.terrainRadius,224);assert.ok(auxiliary.children.length<140);
  assert.deepEqual(p.groundClearance.targets,[EARTH,FIELDS]);assert.deepEqual(p.hostRailWorld,[-252,236]);
  assert.deepEqual(capture(original.root),beforeHost);
  assert.equal(game.signature(),signature);assert.equal(JSON.stringify(view),beforeView);assert.equal(JSON.stringify(route),beforeRoute);

  // Intermediate observer overlap: no second copy of any host tile or field.
  p=adapter.update(view,route,{enabled:true,centerX:280});
  assert.equal(p.terrainBuilds,1);assert.ok(p.droppedDuplicateChunks>0);assert.ok(p.droppedDuplicateFields>0);assert.ok(p.droppedOverlapPlants>0);
  const hostTiles=activeTiles(original.root),extraTiles=activeTiles(auxiliary);
  for(const kind of ['chunks','fields'])for(const key of extraTiles[kind])assert.equal(hostTiles[kind].has(key),false,key);
  assert.equal(models[0].disposed,1);assert.deepEqual(p.activeStationIndices,[]);

  // The original shader still supplies appearance; the ownership addition only
  // discards auxiliary railway fragments inside the exact native rail interval.
  const rail=auxiliary.getObjectByName(RAIL),shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};rail.material.onBeforeCompile(shader,null);
  assert.equal(shader.uniforms.routeObserverHostRail.value.x,-252);assert.equal(shader.uniforms.routeObserverHostRail.value.y,236);
  assert.ok(shader.fragmentShader.includes('routeObserverWorldX>=routeObserverHostRail.x'));assert.ok(shader.fragmentShader.includes('routeObserverWorldX<=routeObserverHostRail.y'));
  const fields=auxiliary.getObjectByName(FIELDS),fieldShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};fields.material.onBeforeCompile(fieldShader,null);fields.onBeforeRender();
  assert.deepEqual([...fieldShader.uniforms.bureauPlotXZ.value],[605,785,-141,9]);

  // Native streaming ownership precludes any extra station, with no aliasing.
  hostIndices=[0,1];p=adapter.update(view,route,{enabled:true,centerX:700});assert.deepEqual(p.activeStationIndices,[]);assert.equal(models.length,1);
  hostIndices=[0];p=adapter.update(view,route,{enabled:true,centerX:700});assert.deepEqual(p.activeStationIndices,[1]);assert.equal(models.length,2);
  assert.throws(()=>adapter.update(view,route,{enabled:true,centerX:1700}),/broad earth/);

  // Track each shared auxiliary resource exactly once on release. No host
  // material/geometry is disposed and re-entry constructs no retained cache.
  const geometries=new Set(),materials=new Set(),events=new Map();auxiliary.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  for(const r of [...geometries,...materials]){events.set(r,0);r.addEventListener('dispose',()=>events.set(r,events.get(r)+1));}
  let hostDisposed=0;original.root.traverse(o=>{o.geometry?.addEventListener('dispose',()=>hostDisposed++);o.material?.addEventListener('dispose',()=>hostDisposed++);});
  p=adapter.update(view,route,{enabled:false,centerX:700});assert.equal(p.active,false);assert.equal(p.terrainDisposals,1);assert.equal(adapter.root.children.length,0);assert.equal(models[1].disposed,1);
  for(const count of events.values())assert.equal(count,1);assert.equal(hostDisposed,0);
  adapter.leave();assert.equal(adapter.snapshot().terrainDisposals,1);
  p=adapter.update(view,route,{enabled:true,centerX:700});assert.equal(p.terrainBuilds,2);
  p=adapter.update(view,route,{enabled:true,centerX:0});assert.equal(p.active,false);assert.equal(p.terrainDisposals,2);
  adapter.dispose();adapter.dispose();assert.equal(adapter.root.parent,null);assert.equal(adapter.root.children.length,0);
  assert.equal(adapter.update(view,route,{enabled:true,centerX:700}).active,false);
  assert.equal(game.signature(),signature);assert.equal(JSON.stringify(view),beforeView);assert.equal(JSON.stringify(route),beforeRoute);assert.deepEqual(capture(original.root),beforeHost);assert.equal(hostDisposed,0);
});
