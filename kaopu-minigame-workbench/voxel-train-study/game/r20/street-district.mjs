import * as THREE from '../../vendor/three.module.js';
import * as Instrument from './street/instrument.mjs';
import {createDistrictBatches} from './street/render-batches.mjs';
import {createRoutePlan,resolveChunk,desiredChunks,validateRoute} from './street/route-plan.mjs';
export const GROUND_Y=.0805;
export function createStreetDistrict({routeScore=null,anchorScore=null,onChange=()=>{},instrument=Instrument,loadText=async url=>{const r=await fetch(url);if(!r.ok)throw new Error('Street Score HTTP '+r.status);return r.text();}}={}){
 const root=new THREE.Group();root.name='KST1 R20 first-interstation streaming district';root.position.y=0;const renderer=createDistrictBatches();root.add(renderer.root);let dirty=true;
 const lights=Array.from({length:2},(_,i)=>{const l=new THREE.PointLight(0xffcf8c,0,3.8,2);l.name='R20-persistent-shop-light-'+i;root.add(l);return l;});
 const proof={version:'r20-kst1',schema:'kaopu.street.route/1',instrument:instrument.INSTRUMENT_ID,abi:instrument.ABI,status:'score-loading',ready:false,active:false,externalMesh:false,externalImageTextures:false,clock:'Session.view.elapsed',loadCount:0,unloadCount:0,lodReplacements:0,buildAttempts:0,lastUpdateAttempts:0,pending:0,activeChunks:[],peak:{chunks:0,triangles:0,geometryBytes:0,instanceBytes:0,buildOverlapBytes:0},events:[],elapsed:0,lightingSlots:2,sourcePoolGpuResident:false};root.userData.proof=proof;
 let routeData=null,anchor=null,plan=null,latest=null,pool=instrument.createSharedResources(),closed=false;const live=new Map(),failures=new Set();
 const event=(kind,c,more={})=>{proof.events.push({kind,id:c.id,detail:c.detail,distance:latest?.view.distance??0,elapsed:latest?.view.elapsed??0,...more});if(proof.events.length>300)proof.events.shift();};
 function notify(){onChange(proof);}
 function release(id,reason='distance'){const c=live.get(id);if(!c)return;live.delete(id);dirty=true;instrument.dispose(c.handle);proof.unloadCount++;event('release',c,{reason});}
 function account(){
  if(!dirty)return;
  const geometry=new Set(),materials=new Set();let triangles=0,instances=0,instanceBytes=0,meshes=0;
  for(const c of live.values()){triangles+=c.metrics.expandedTriangles;instances+=c.metrics.instances;instanceBytes+=c.metrics.instanceBytes;meshes+=c.metrics.meshes;c.handle.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[]))materials.add(m);});}
  let bytes=0;for(const g of geometry){bytes+=g.index?.array.byteLength||0;for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;}
  proof.metrics={expandedTriangles:triangles,instances,meshes,geometries:geometry.size,geometryBytes:bytes,instanceBytes,materials:materials.size,textures:0};proof.liveResources={geometries:geometry.size,materials:materials.size};proof.shared=pool.snapshot();
  proof.activeChunks=[...live.values()].sort((a,b)=>a.center-b.center).map(c=>({id:c.id,index:c.index,center:c.center,detail:c.detail,seed:c.seed,triangles:c.metrics.expandedTriangles,buildings:c.score.construction.buildings.map(b=>({id:b.id,floors:b.floors,facade:b.facade,width:b.width,frontZ:b.frontZ,age:b.age,shops:b.shops.map(s=>s.text)}))}));
  const p=proof.peak;p.chunks=Math.max(p.chunks,live.size);p.triangles=Math.max(p.triangles,triangles);p.geometryBytes=Math.max(p.geometryBytes,bytes);p.instanceBytes=Math.max(p.instanceBytes,instanceBytes);proof.active=live.size>0;
  if(plan&&(live.size>plan.score.streaming.maxActiveChunks||triangles>plan.score.streaming.maxExpandedTriangles||bytes>plan.score.streaming.maxGeometryBytes))throw new Error('Live streaming budget exceeded '+JSON.stringify(proof.metrics));
 }
 function build(c,view){
  const offset=c.center-view.distance,score=resolveChunk(plan,c,anchor,c.detail);let handle;
  try{
   handle=instrument.build(score,{shared:pool,analyticWind:true,timeSeconds:view.elapsed,originOffset:[offset,GROUND_Y,0],wetness:score.appearance.wetness});
   const emitters=[];handle.root.traverse(o=>{if(o.isLight)emitters.push(o);});const shopLights=emitters.map(l=>({position:l.position.clone(),color:l.color.clone(),intensity:l.intensity,distance:l.distance,decay:l.decay}));for(const light of emitters){light.removeFromParent();light.dispose();}
   const metrics=instrument.measure(handle),old=live.get(c.id),nextTriangles=(proof.metrics?.expandedTriangles||0)-(old?.metrics.expandedTriangles||0)+metrics.expandedTriangles;
   proof.peak.buildOverlapBytes=Math.max(proof.peak.buildOverlapBytes,(proof.metrics?.geometryBytes||0)+metrics.geometryBytes);
   const prospective=new Set();for(const item of live.values())if(item!==old)item.handle.root.traverse(o=>{if(o.geometry)prospective.add(o.geometry);});handle.root.traverse(o=>{if(o.geometry)prospective.add(o.geometry);});
   let nextBytes=0;for(const g of prospective){nextBytes+=g.index?.array.byteLength||0;for(const a of Object.values(g.attributes))nextBytes+=a.array.byteLength;}
   if(nextTriangles>plan.score.streaming.maxExpandedTriangles||nextBytes>plan.score.streaming.maxGeometryBytes)throw new Error('Prospective live street budget exceeded; old parcel retained');
   if(old){release(c.id,'lod');proof.lodReplacements++;}
   handle.root.position.x=0;dirty=true;live.set(c.id,{...c,score,handle,metrics,shopLights});proof.loadCount++;event('load',c,{triangles:metrics.expandedTriangles});account();
  }catch(e){if(live.get(c.id)?.handle===handle)live.delete(c.id);if(handle&&!handle.disposed)instrument.dispose(handle);throw e;}
 }
 function sync(){
  if(closed||!routeData||!anchor||!latest)return;const {view,route,context}=latest;if(!plan){try{plan=createRoutePlan(routeData,route);}catch(e){proof.status='error';proof.error=String(e);notify();return;}proof.plan={start:plan.start,end:plan.end,sceneMetres:700,historicalDisplayKm:4.4,chunks:plan.chunks.length,buildings:plan.chunks.length*2,bridge:plan.bridge};}
  const focus=view.distance+(context.cameraTarget?.[0]??-8),desired=desiredChunks(plan,focus,live),wanted=new Map(desired.map(c=>[c.id,c]));
  for(const [id]of live)if(!wanted.has(id))release(id);
  for(const id of failures)if(!wanted.has(id))failures.delete(id);
  account();let builds=0,attempts=0;proof.lastUpdateAttempts=0;
  // Coverage precedes detail: an incoming parcel first receives its own
  // far architecture (pierced walls, balcony/cage silhouettes and sign frames).
  // Otherwise an endless queue of old LOD downgrades can starve new parcels
  // when the shared host advances by 24–36m between software-rendered frames.
  // Only after every requested outline exists do we spend work on LOD changes.
  const rank={near:0,mid:1,far:2};
  const missing=desired.filter(c=>!live.has(c.id)).map(c=>({...c,detail:'far'}));
  const changes=desired.filter(c=>live.has(c.id)).sort((a,b)=>Number(rank[b.detail]>rank[live.get(b.id).detail])-Number(rank[a.detail]>rank[live.get(a.id).detail]));
  const ordered=[...missing,...changes];
  for(const c of ordered){const old=live.get(c.id);if(failures.has(c.id)||(old&&old.detail===c.detail))continue;
   if(attempts>=plan.score.streaming.maxBuildsPerFrame)break;attempts++;proof.buildAttempts++;proof.lastUpdateAttempts=attempts;
   try{build(c,view);failures.delete(c.id);builds++;}catch(e){if(!failures.has(c.id)){proof.error=String(e);event('error',c,{error:String(e)});failures.add(c.id);} }
  }
  for(const c of live.values())instrument.update(c.handle,view.elapsed,{railDistance:view.distance});
  if(dirty){renderer.rebuild([...live.values()]);proof.renderBatch=renderer.proof;}renderer.update(view.elapsed,view.distance,GROUND_Y);
  for(const l of lights)l.intensity=0;
  const nearest=[...live.values()].sort((a,b)=>Math.abs(a.center-8-focus)-Math.abs(b.center-8-focus));let n=0;
  for(const c of nearest)for(const source of c.shopLights){if(n>=lights.length)break;const l=lights[n++];l.position.copy(source.position);l.position.x+=c.center-view.distance;l.position.y+=GROUND_Y;l.color.copy(source.color);l.intensity=source.intensity;l.distance=source.distance;l.decay=source.decay;}
  proof.lightingActive=n;proof.elapsed=view.elapsed;proof.focus=focus;proof.pending=desired.filter(c=>!failures.has(c.id)&&(!live.has(c.id)||live.get(c.id).detail!==c.detail)).length;
  if(!failures.size)delete proof.error;
  proof.status=failures.size?'error':proof.pending?'streaming':live.size?'active':'released';account();dirty=false;
  const required=desired.filter(c=>c.distance<=70);proof.coverage={radius:70,required:required.map(c=>c.id),missing:required.filter(c=>!live.has(c.id)).map(c=>c.id)};
  if(!live.size&&pool.snapshot().cachedGeometries){pool.dispose();pool=instrument.createSharedResources();proof.shared=pool.snapshot();event('shared-cache-released',{id:'finite-pool',detail:'all'});}
  if(attempts||proof.pending)notify();
 }
 const ready=(async()=>{try{routeData=typeof routeScore==='string'?JSON.parse(routeScore):routeScore??JSON.parse(await loadText(new URL('./street/route.score.json',import.meta.url)));anchor=typeof anchorScore==='string'?JSON.parse(anchorScore):anchorScore??JSON.parse(await loadText(new URL('./street/first-street.score.json',import.meta.url)));routeData=validateRoute(routeData);if(closed)return proof;proof.ready=true;proof.scoreBytes=new TextEncoder().encode(JSON.stringify(routeData)).length;proof.status='score-ready';sync();notify();return proof;}catch(e){proof.status='error';proof.error=String(e);notify();return proof;}})();
 return{root,proof,ready,update(view,route,context={}){if(closed)return;latest={view,route,context};sync();},exclusions(distance){if(!plan)return[];return[{minX:plan.chunks[0].center-18-distance,maxX:plan.chunks.at(-1).center+8-distance,minZ:-25,maxZ:24}];},get renderBatches(){return renderer;},get handles(){return[...live.values()].map(c=>c.handle);},get handle(){return[...live.values()].find(c=>c.detail==='near')?.handle||null;},snapshot(){return{proof:structuredClone(proof),chunks:[...live.values()].map(c=>({id:c.id,detail:c.detail,...instrument.snapshot(c.handle)}))};},dispose(){if(closed)return;closed=true;for(const id of [...live.keys()])release(id,'manager-dispose');pool.dispose();renderer.dispose();dirty=true;for(const l of lights)l.dispose();root.removeFromParent();root.clear();proof.status='disposed';proof.active=false;proof.pending=0;account();}};
}
