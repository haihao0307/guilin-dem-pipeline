import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as THREE from '../../../vendor/three.module.js';
import * as I from '../street/instrument.mjs';
import * as R17 from '../../r17/street/instrument.mjs';
import {SHOP_CATALOG} from '../street/glyphs.mjs';
import {createRoutePlan,resolveChunk,desiredChunks,validateRoute,ROUTE_SCHEMA} from '../street/route-plan.mjs';
import {createStreetDistrict,GROUND_Y} from '../street-district.mjs';
import {Session,replay,DT,TICK_HZ,FRONT_X} from '../../r17/session.mjs';
import {kcrRoute,MILEAGE} from '../../r17/timetable.mjs';
import {PLATFORM_LAYOUT} from '../../r17/metre-scale.mjs';
import {VIEW_STORAGE_KEY} from '../view-profile-storage.mjs';
const text=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const json=path=>JSON.parse(text(path));
const routeScore=()=>json('../street/route.score.json');
const anchor=()=>json('../street/first-street.score.json');
const plan=()=>createRoutePlan(routeScore(),kcrRoute(1978));
const resolved=(p,c,detail='near')=>resolveChunk(p,c,anchor(),detail);
const geometrySet=h=>{const out=new Set();h.root.traverse(o=>{if(o.geometry)out.add(o.geometry);});return out;};
function settle(d,distance,elapsed=12,cameraTarget=[-8,0,1]){
 for(let n=0;n<32;n++){d.update({distance,elapsed},kcrRoute(1978),{cameraTarget});assert.equal(d.proof.error,undefined,d.proof.error);if(!d.proof.pending)return;}
 assert.fail('Streaming did not settle within its finite chunk/build bounds');
}

// Minimal local evaluator for the JSON Schema keywords actually shipped here.
// Runtime validate/validateRoute remain authoritative for cross-field restrictions.
function schemaAccepts(value,node,root=node){
 if(node.$ref){const target=node.$ref.split('/').slice(1).reduce((o,k)=>o[k],root);return schemaAccepts(value,target,root);}
 if('const'in node&&!Object.is(value,node.const))return false;
 if(node.enum&&!node.enum.some(v=>Object.is(value,v)))return false;
 if(node.type){const types={object:v=>v!==null&&typeof v==='object'&&!Array.isArray(v),array:Array.isArray,integer:Number.isInteger,number:v=>typeof v==='number'&&Number.isFinite(v),string:v=>typeof v==='string',boolean:v=>typeof v==='boolean'};if(!types[node.type](value))return false;}
 if(typeof value==='number'&&((node.minimum!==undefined&&value<node.minimum)||(node.maximum!==undefined&&value>node.maximum)))return false;
 if(typeof value==='string'&&((node.pattern&&!new RegExp(node.pattern).test(value))||(node.maxLength!==undefined&&value.length>node.maxLength)))return false;
 if(Array.isArray(value)&&((node.minItems!==undefined&&value.length<node.minItems)||(node.maxItems!==undefined&&value.length>node.maxItems)||(node.items&&!value.every(v=>schemaAccepts(v,node.items,root)))))return false;
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  if(node.required?.some(k=>!Object.hasOwn(value,k)))return false;
  for(const[k,s]of Object.entries(node.properties||{}))if(Object.hasOwn(value,k)&&!schemaAccepts(value[k],s,root))return false;
 }
 if(node.allOf&&!node.allOf.every(s=>schemaAccepts(value,s,root)))return false;
 if(node.oneOf&&node.oneOf.filter(s=>schemaAccepts(value,s,root)).length!==1)return false;
 return true;
}

test('Scene route remains exactly 0–700 metres; 4.4 km is timetable display only',()=>{
 const host=kcrRoute(1978),p=plan();assert.deepEqual([host[0].target,host[1].target,p.start,p.end],[0,700,0,700]);
 assert.deepEqual([host[0].english,host[1].english],['Kowloon','Yaumati']);assert.equal(MILEAGE[1][1],'4.4');
 assert.equal(p.score.span.historicalDisplayKm,4.4);assert.notEqual(p.end-p.start,Number(MILEAGE[1][1])*1000);
 assert.equal(p.bridge,355);assert.equal(p.bridge,(host[0].target+host[1].target)/2+FRONT_X);
 assert.throws(()=>createRoutePlan(routeScore(),[{target:0},{target:4400}]));
 for(const target of [NaN,Infinity,-Infinity])assert.throws(()=>createRoutePlan(routeScore(),[{target},{target:700}]));
});

test('Deterministic finite plan has exactly 37 unique chunks, 74 buildings, and explicit margins',()=>{
 const p=plan();assert.equal(p.chunks.length,37);assert.deepEqual(p,plan());assert.equal(new Set(p.chunks.map(c=>c.id)).size,37);
 assert.deepEqual([p.chunks[0].index,p.chunks.at(-1).index,p.chunks[0].center,p.chunks.at(-1).center],[-4,32,-61,731]);
 assert.equal(p.chunks.filter(c=>c.anchor).length,1);assert.equal(p.chunks.find(c=>c.anchor).center,27);
 let buildings=0;const recipes=[];
 for(const c of p.chunks){assert.equal(c.center,27+c.index*22);assert.equal(c.seed,(1978+Math.imul(c.index+5,104729))>>>0);
  for(const detail of ['near','mid','far']){const s=resolved(p,c,detail);assert(I.validate(s).valid,I.validate(s).errors.join(';'));assert.deepEqual(s,resolved(p,c,detail));assert.equal(s.performance.detail,detail);}
  const s=resolved(p,c);buildings+=s.construction.buildings.length;recipes.push(JSON.stringify(s.construction.buildings));
 }
 assert.equal(buildings,74);assert.equal(new Set(recipes).size,37);
 const altered=routeScore();altered.object.seed++;const other=createRoutePlan(altered,kcrRoute(1978));assert.notDeepEqual(resolved(p,p.chunks[0]),resolved(other,other.chunks[0]));
});

test('Route validator rejects unsupported versions, geometry assets, mutable units, and budget abuse',()=>{
 assert.deepEqual(validateRoute(routeScore()),routeScore());
 const mutations=[s=>s.instrument.id='foreign',s=>s.instrument.version='1.0.0',s=>s.instrument.abi='other',s=>s.units='kilometre',s=>s.axis='Z_UP',s=>s.timeSource='wallclock',s=>s.span.sceneMetres=4400,s=>s.span.anchorOffset=28,s=>s.span.historicalDisplayKm=700,s=>s.span.lastIndex=99,s=>s.layout.frontZRange=[-9,0],s=>s.layout.bridgeSetbackZ=-7,s=>s.layout.railHalfClearance=0,s=>s.layout.side=1,s=>s.layout.observerSide=-1,s=>s.object.seed=NaN,s=>s.object.seed=-1,s=>s.provenance.externalMesh=true,s=>s.provenance.externalImageTextures=true,s=>s.streaming.nearExit=s.streaming.nearEnter,s=>s.streaming.maxExpandedTriangles=600001,s=>s.streaming.maxGeometryBytes=64000001,s=>s.streaming.maxBuildsPerFrame=4,s=>s.streaming.maxActiveChunks=1.5,s=>s.streaming.maxNearChunks=.5];
 for(const key of ['mesh','vertices','textureUrl','bufferView','runtimeMesh','runtimeModel'])mutations.push(s=>s.extra={nested:{[key]:'forbidden'}});
 for(const url of ['https://example.invalid/model.glb','data:image/png;base64,AA','blob:fake','file:///private'])mutations.push(s=>s.extra={asset:url});
 for(const mutate of mutations){const s=routeScore();mutate(s);assert.throws(()=>validateRoute(s),'Accepted unsupported route: '+JSON.stringify(s));}
});

test('Manifest and resolved schema describe the actual 1.1.0 runtime, all three LODs, and all glyph recipes',()=>{
 const m=json('../street/instrument.manifest.json'),s=json('../street/resolved-score.schema.json'),p=plan();
 assert.deepEqual(m.instrument,{id:I.INSTRUMENT_ID,version:I.VERSION,abi:I.ABI});assert.deepEqual(m.limits,I.LIMITS);
 assert(m.scoreSchemas.includes(I.SCHEMA)&&m.scoreSchemas.includes(ROUTE_SCHEMA));assert.deepEqual(m.streaming,p.score.streaming);
 assert.equal(m.route.chunks,p.chunks.length);assert.equal(m.route.buildings,74);assert.equal(m.externalAssetInFormalBuild,false);assert.equal(m.provenance.gpuVerified,false);
 for(const detail of ['near','mid','far'])for(const c of p.chunks)assert(schemaAccepts(resolved(p,c,detail),s),c.id+' '+detail);
 assert.deepEqual(s.$defs.shop.properties.text.enum,SHOP_CATALOG.map(c=>c.text));
 assert.equal(schemaAccepts(anchor(),s),false,'R17 template requires resolveChunk before R18 validation');
 const invalid=resolved(p,p.chunks[0]);invalid.performance.detail='ultra';assert.equal(schemaAccepts(invalid,s),false);
 const raw=anchor();const copied=structuredClone(raw);resolveChunk(p,p.chunks[0],raw);assert.deepEqual(raw,copied,'Resolution must not edit immutable anchor input');
});

test('Anchor near geometry and explicit-time reconstruction preserve R17 exactly',()=>{
 assert.equal(text('../street/first-street.score.json'),text('../../r17/street/first-street.score.json'));
 const p=plan(),s=resolved(p,p.chunks.find(c=>c.anchor)),a=I.build(s),b=R17.build(anchor());
 try{for(const t of [0,2.75,2.75,0]){I.update(a,t);R17.update(b,t);assert.equal(I.snapshot(a).hash,R17.snapshot(b).hash);}
  const x=I.measure(a),y=R17.measure(b);for(const key of ['meshes','instances','geometries','expandedTriangles','geometryBytes','instanceBytes'])assert.equal(x[key],y[key],key);assert.deepEqual(x.bounds,y.bounds);
  assert.equal(x.expandedTriangles,161930);assert.equal(x.textures,0);
 }finally{I.dispose(a);R17.dispose(b);}
});

test('Both station approaches keep buildings negative Z, opposite positive-Z platform and boarding routes',()=>{
 const p=plan();assert(PLATFORM_LAYOUT.minZ>0);assert(PLATFORM_LAYOUT.maxZ>PLATFORM_LAYOUT.minZ);
 for(const station of [p.start,p.end]){
  const c=p.chunks.reduce((best,c)=>Math.abs(c.center-station)<Math.abs(best.center-station)?c:best),s=resolved(p,c);
  assert(s.construction.buildings.every(b=>b.frontZ<=-8.3));const h=I.build(s);
  try{const m=I.measure(h);assert(m.bounds.max[2]<-1.6,'Rail-side clearance');assert(m.bounds.max[2]<PLATFORM_LAYOUT.minZ);assert.equal(m.features.buildings,2);}finally{I.dispose(h);}
 }
 const session=new Session({line:'kcr1',seed:'R18-stations'});assert(session.actors.filter(a=>a.kind==='waiting').every(a=>a.position[2]>0));
});

test('Bridge-centred parcels use the 355 metre setback; every resolved facade respects rail side',()=>{
 const p=plan(),setback=p.chunks.filter(c=>Math.abs(c.center-p.bridge)<30);assert.deepEqual(setback.map(c=>c.center),[335,357,379]);
 for(const c of p.chunks){const s=resolved(p,c);for(const b of s.construction.buildings){assert(b.frontZ<0);assert(b.x-b.width/2>=-17&&b.x+b.width/2<=8);if(setback.includes(c))assert.equal(b.frontZ,-10.8);}}
 for(const c of setback){const h=I.build(resolved(p,c,'far'));try{assert(I.measure(h).bounds.max[2]<-7);}finally{I.dispose(h);}}
});

test('LOD near geometry is detailed; mid/far are actually cheaper deterministic generated models',()=>{
 const p=plan(),c=p.chunks.find(c=>c.anchor),counts=[];
 for(const detail of ['near','mid','far']){const a=I.build(resolved(p,c,detail)),b=I.build(resolved(p,c,detail));try{const m=I.measure(a);counts.push(m.expandedTriangles);assert.equal(m.textures,0);assert.equal(I.snapshot(a).hash,I.snapshot(b).hash);assert.equal(m.features.buildings,2);assert(m.expandedTriangles<=I.LIMITS.triangles);}finally{I.dispose(a);I.dispose(b);}}
 assert(counts[0]>counts[1]&&counts[1]>counts[2],JSON.stringify(counts));
});

test('Hysteresis keeps existing near/mid/far chunks until exit and bounds near count',()=>{
 const p=plan(),c=p.chunks.find(c=>c.anchor),get=(distance,old)=>desiredChunks({...p,chunks:[c]},c.center-8-distance,old?new Map([[c.id,{detail:old}]]):new Map()).find(t=>t.id===c.id)?.detail;
 assert.equal(get(23),'mid');assert.equal(get(23,'near'),'near');assert.equal(get(28,'near'),'mid');
 assert.equal(get(80),'far');assert.equal(get(80,'mid'),'mid');assert.equal(get(90,'mid'),'far');
 assert.equal(get(145),undefined);assert.equal(get(145,'far'),'far');assert.equal(get(157,'far'),undefined);
 for(let distance=0;distance<=700;distance+=5){const active=desiredChunks(p,distance-8);assert(active.length<=p.score.streaming.maxActiveChunks);assert(active.filter(c=>c.detail==='near').length<=1);}
});

test('Shared primitive/glyph resources survive sibling release; last owner, re-entry, and final pool cleanup are balanced',()=>{
 const p=plan(),s=resolved(p,p.chunks.find(c=>c.anchor)),pool=I.createSharedResources(),a=I.build(s,{shared:pool}),b=I.build(s,{shared:pool});
 const ga=geometrySet(a),gb=geometrySet(b),common=[...ga].filter(g=>gb.has(g));assert(common.length>10);
 const counts=new Map(common.map(g=>[g,0]));for(const g of common)g.addEventListener('dispose',()=>counts.set(g,counts.get(g)+1));
 try{assert(pool.snapshot().referenceTotal>pool.snapshot().referencedGeometries);assert.throws(()=>pool.dispose());
  I.dispose(a);I.dispose(a);assert(common.every(g=>counts.get(g)===0),'Sibling still owns common geometry');assert(pool.snapshot().referenceTotal>0);
  const before=I.snapshot(b).hash;I.update(b,0,{shared:pool});assert.equal(I.snapshot(b).hash,before);
  I.dispose(b);assert(common.every(g=>counts.get(g)===1),'Last live reference disposes each common geometry');assert.equal(pool.snapshot().referenceTotal,0);assert.equal(pool.snapshot().activeBytes,0);
  const c=I.build(s,{shared:pool});try{assert.equal(I.snapshot(c).hash,before);}finally{I.dispose(c);}
  assert.equal(pool.snapshot().referenceTotal,0);pool.dispose();pool.dispose();assert.equal(pool.snapshot().cachedGeometries,0);assert.equal(pool.snapshot().cpuBytes,0);
 }finally{I.dispose(a);I.dispose(b);pool.dispose();}
});

test('Actual streaming covers departure, bridge, arrival, unload and return without clock drift or live-budget breach',async()=>{
 const d=createStreetDistrict({routeScore:routeScore(),anchorScore:anchor()});await d.ready;
 try{assert.equal(d.root.position.y,GROUND_Y);settle(d,0,2);assert.equal(d.proof.plan.sceneMetres,700);assert.equal(d.proof.plan.historicalDisplayKm,4.4);assert.equal(d.proof.plan.chunks,37);const initial=d.snapshot().chunks;
  for(const distance of [120,260,355,490,650,700]){settle(d,distance,2);assert(d.proof.active);assert.equal(d.proof.elapsed,2);assert(d.handles.every(h=>h.state.time===2));assert(d.proof.activeChunks.length<=16);assert(d.proof.metrics.expandedTriangles<=520000);assert(d.proof.metrics.geometryBytes<=48000000);assert.equal(d.proof.metrics.textures,0);assert.equal(d.root.children.filter(o=>o.isPointLight).length,2);assert(d.handles.every(h=>{let count=0;h.root.traverse(o=>{if(o.isLight)count++;});return count===0;}));}
  assert(d.proof.unloadCount>0);assert(d.proof.lodReplacements>0);settle(d,930,2);assert.equal(d.proof.active,false);assert.equal(d.handles.length,0);assert.equal(d.proof.metrics.geometryBytes,0);assert.equal(d.proof.shared.cpuBytes,0);assert(d.root.children.every(o=>o.isPointLight&&o.intensity===0));
  settle(d,0,2);assert.deepEqual(d.snapshot().chunks,initial,'Same seed, location and Session time reconstruct identically');
 }finally{d.dispose();d.dispose();}
 assert.equal(d.proof.status,'disposed');assert.equal(d.root.children.length,0);assert.equal(d.proof.shared.referenceTotal,0);assert.equal(d.proof.metrics.geometryBytes,0);
});

test('Canonical R17 Session imports preserve 30 Hz simulation, pause, replay, dimensions, and isolated R18 saves/views',()=>{
 const app=text('../app.mjs'),world=text('../world.mjs'),views=text('../view-profile-storage.mjs');
 assert.match(app,/import \{Session,replay\} from '\.\.\/r17\/session\.mjs'/);assert.match(world,/import \{FRONT_X\} from '\.\.\/r17\/session\.mjs'/);
 assert(!existsSync(new URL('../session.mjs',import.meta.url)));assert(!existsSync(new URL('../timetable.mjs',import.meta.url)));
 for(const [source,key]of [[app,'save'],[app,'quality'],[views,'views']])assert(source.includes('kaopu.train-driver.r18.'+key+'.v1'));
 assert.equal(VIEW_STORAGE_KEY,'kaopu.train-driver.r18.views.v1');assert.doesNotMatch(app,/kaopu\.train-driver\.r17\.(save|quality)\.v1/);assert.doesNotMatch(views,/kaopu\.train-driver\.r17\.views\.v1/);
 assert.match(app,/world\.update\(view,game\.route/);assert.match(app,/smoke\.update\(view\.elapsed/);assert.equal(TICK_HZ,30);assert.equal(DT,1/30);
 const a=new Session({line:'kcr1',seed:'R18-canonical'});a.command('start');a.command('throttle-up');a.stepTicks(300);const b=replay(a.replayPacket());assert.equal(a.signature(),b.signature());
 a.command('pause',true);const signature=a.signature(),elapsed=a.elapsed;a.stepTicks(90);assert.equal(a.signature(),signature);assert.equal(a.elapsed,elapsed);
 for(const name of ['../street-district.mjs','../street/route-plan.mjs','../street/instrument.mjs','../street/architecture.mjs','../street/materials.mjs','../street/glyphs.mjs']){const code=text(name);assert.doesNotMatch(code,/TextureLoader|CanvasTexture|DataTexture|city-assets|\.bin\.gz/);assert.doesNotMatch(code,/requestAnimationFrame|performance\.now\(|Date\.now\(|Math\.random\(/);}
});

test('Chunk-owned instance/material buffers dispose exactly once; rejected builds cannot retain shared geometry',()=>{
 const p=plan(),s=resolved(p,p.chunks.find(c=>c.anchor)),pool=I.createSharedResources(),h=I.build(s,{shared:pool}),instances=[],materials=new Set();let instanceDisposals=0,materialDisposals=0;
 h.root.traverse(o=>{if(o.isInstancedMesh){instances.push(o);o.addEventListener('dispose',()=>instanceDisposals++);}for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[]))materials.add(m);});
 for(const m of materials)m.addEventListener('dispose',()=>materialDisposals++);
 assert(instances.length>0);I.dispose(h);I.dispose(h);assert.equal(instanceDisposals,instances.length);assert.equal(materialDisposals,materials.size);assert.equal(pool.snapshot().referenceTotal,0);
 s.performance.limits.maxTriangles=1;assert.throws(()=>I.build(s,{shared:pool}),/budget exceeded/);assert.equal(pool.snapshot().referenceTotal,0);assert.equal(pool.snapshot().activeBytes,0);pool.dispose();
});

test('Late asynchronous route load cannot revive a disposed district',async()=>{
 let release;const routeText=new Promise(resolve=>release=resolve),d=createStreetDistrict({loadText:async url=>String(url).endsWith('/route.score.json')?routeText:text('../street/first-street.score.json')});
 d.update({distance:0,elapsed:0},kcrRoute(1978));d.dispose();release(text('../street/route.score.json'));await d.ready;
 assert.equal(d.proof.status,'disposed');assert.equal(d.proof.loadCount,0);assert.equal(d.root.children.length,0);assert.equal(d.proof.shared.referenceTotal,0);assert.doesNotThrow(()=>d.update({distance:0,elapsed:1},kcrRoute(1978)));
});

test('Invalid route data reports a district error without throwing through the host update',async()=>{
 const invalid=routeScore();invalid.instrument.id='unsupported';const d=createStreetDistrict({routeScore:invalid,anchorScore:anchor()});await d.ready;
 try{assert.doesNotThrow(()=>d.update({distance:0,elapsed:0},kcrRoute(1978)));assert.equal(d.proof.status,'error');assert.match(d.proof.error,/contract mismatch/);assert.equal(d.handles.length,0);}finally{d.dispose();}
});
