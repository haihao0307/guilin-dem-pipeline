import * as THREE from '../../../vendor/three.module.js';
import {buildArchitecture} from './architecture.mjs';
import {createMaterialLibrary} from './materials.mjs';
import {createWordFactory,SHOP_CATALOG} from './glyphs.mjs';

// KST1 is an explicit architecture extension of the existing Score/Instrument
// pattern. It is not a renamed R15 mesh container or a universal legacy parser.
export const INSTRUMENT_ID='kaopu.street.architecture';
export const VERSION='1.1.0';
export const ABI='KST1';
export const SCHEMA='kaopu.street.resolved/1';
export const LIMITS=Object.freeze({scoreBytes:32768,buildings:2,floors:8,bays:5,triangles:240000,instances:12000,materials:48});
const WORDS=new Map(SHOP_CATALOG.map(s=>[s.text,s.style]));
const forbidden=new Set(['mesh','meshes','vertices','indices','buffer','bufferView','binary','binaryUrl','geometry','texture','textures','textureUrl','normalMap','roughnessMap','modelUrl','meshUrl','glbUrl','fbxUrl','runtimeMesh','runtimeModel']);
const finite=(v,min,max,label)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error(label+' out of bounds');};
const integer=(v,min,max,label)=>{finite(v,min,max,label);if(!Number.isInteger(v))throw new Error(label+' must be integer');};
const tuple=(v,n,label)=>{if(!Array.isArray(v)||v.length!==n||!v.every(Number.isFinite))throw new Error(label+' invalid');};
const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
function inspectData(x,path='score',depth=0){
 if(depth>16)throw new Error('Score nesting exceeds limit');
 if(typeof x==='number'&&!Number.isFinite(x))throw new Error(path+' nonfinite');
 if(typeof x==='string'&&(/^(?:https?:|data:|blob:|file:)/i.test(x)||x.length>1024))throw new Error(path+' external/oversized data is forbidden');
 if(x&&typeof x==='object')for(const[k,v]of Object.entries(x)){if(forbidden.has(k)||['__proto__','prototype','constructor'].includes(k))throw new Error('Forbidden score field '+path+'.'+k);inspectData(v,path+'.'+k,depth+1);}
}
export function validate(score){
 const errors=[];try{
  if(!score||typeof score!=='object'||Array.isArray(score))throw new Error('Score must be object');
  inspectData(score);if(new TextEncoder().encode(JSON.stringify(score)).length>LIMITS.scoreBytes)throw new Error('Score byte budget');
  if(score.schema!==SCHEMA||score.instrument?.id!==INSTRUMENT_ID||score.instrument?.version!==VERSION||score.instrument?.abi!==ABI)throw new Error('Score/Instrument version or ABI mismatch');
  if(score.units!=='metre'||score.axis!=='Y_UP')throw new Error('KST1 requires metre/Y_UP');
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(score.object?.id||''))throw new Error('Object id invalid');
  integer(score.object?.seed,0,0xffffffff,'seed');
  const c=score.construction;if(!c||!Array.isArray(c.buildings))throw new Error('Missing buildings');integer(c.buildings.length,1,LIMITS.buildings,'building count');
  finite(c.windowCageDensity,0,1,'cage density');finite(c.signDensity,0,1,'sign density');finite(c.wireSag,0,.9,'wire sag');
  finite(c.railClearance?.halfWidth,1.6,2.2,'rail half width');finite(c.railClearance?.height,4.75,6,'rail height');
  const ids=new Set();for(const b of c.buildings){
   if(typeof b.id!=='string'||ids.has(b.id))throw new Error('Duplicate/missing building id');ids.add(b.id);
   finite(b.x,-20,8,'building x');finite(b.frontZ,-12,-6,'frontZ');finite(b.width,6,10,'width');finite(b.depth,3,8,'depth');if(b.x-b.width/2 < -17 || b.x+b.width/2 > 8)throw new Error('Street parcel leaves station-safe host segment');
   integer(b.floors,2,LIMITS.floors,'floors');integer(b.bays,2,LIMITS.bays,'bays');finite(b.floorHeight,2.5,3.6,'floorHeight');finite(b.groundHeight,3.6,4.8,'groundHeight');
   if(!['brick_shophouse','timber_verandah'].includes(b.facade))throw new Error('Unsupported facade family');finite(b.age,0,1,'age');finite(b.repair,0,1,'repair');
   if(!Array.isArray(b.shops)||b.shops.length!==2)throw new Error('Two tenant bays required');
   for(const s of b.shops){if(!WORDS.has(s.text)||WORDS.get(s.text)!==s.signStyle)throw new Error('Unregistered glyph recipe/style');if(!['cinema','pharmacy','tea','watch','hardware'].includes(s.type))throw new Error('Unsupported shop');if(typeof s.open!=='boolean')throw new Error('Shop open must be boolean');finite(s.signAge,0,1,'sign age');}
  }
  const a=score.appearance;finite(a?.wetness,0,1,'wetness');finite(a?.saltExposure,0,1,'salt');for(const k of ['plasterTint','brickTint','woodTint'])if(!hex(a[k]))throw new Error('Invalid '+k);
  if(score.motion?.timeSource!=='host.elapsed')throw new Error('Only authoritative host elapsed supported');finite(score.motion.wind?.amplitude,0,.12,'wind amplitude');finite(score.motion.wind?.frequency,.1,2,'wind frequency');
  if(!['near','mid','far'].includes(score.performance?.detail))throw new Error('Unknown architecture detail');const l=score.performance.limits;integer(l?.maxTriangles,1,LIMITS.triangles,'triangle budget');integer(l?.maxInstances,1,LIMITS.instances,'instance budget');integer(l?.maxMaterials,1,LIMITS.materials,'material budget');
  if(score.provenance?.externalMesh!==false||score.provenance?.externalImageTextures!==false)throw new Error('Formal street excludes baked mesh/image assets');
 }catch(e){errors.push(e.message);}return{valid:errors.length===0,errors};
}
export function parseScore(textOrData){const score=typeof textOrData==='string'?JSON.parse(textOrData):structuredClone(textOrData);const report=validate(score);if(!report.valid)throw new Error(report.errors.join('; '));return score;}
function gather(root){const geometries=new Set(),materials=new Set(),instanced=new Set();root.traverse(o=>{if(o.isInstancedMesh)instanced.add(o);if(o.geometry)geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[]))materials.add(m);});return{geometries,materials,instanced};}
export function build(input,worldContext={}){
 const score=parseScore(input),library=createMaterialLibrary(THREE,score),shared=worldContext.shared||null,words=shared?.words||createWordFactory(THREE);let architecture;
 try{architecture=buildArchitecture(score,{THREE,materials:library,makeWord:shared?shared.makeWord:words.makeWord,sharedGeometry:shared});}catch(e){library.dispose();if(!shared)words.dispose();throw e;}
 const handle={score,root:architecture.root,cloth:architecture.cloth||[],stats:architecture.stats||{},resources:architecture.resources,state:{time:0,worldInputs:{}},disposed:false,analyticWind:worldContext.analyticWind===true,_library:library,_words:words,_shared:shared,_sharedRetained:false};
 handle.root.name=score.object.id;handle.root.userData.kaopu={schema:SCHEMA,instrument:INSTRUMENT_ID,version:VERSION,abi:ABI,source:'runtime functions; no delivered mesh/image assets'};
 const m=measure(handle),l=score.performance.limits;
 if(m.expandedTriangles>l.maxTriangles||m.instances>l.maxInstances||m.materials>l.maxMaterials){dispose(handle);throw new Error('Expanded resource budget exceeded: '+JSON.stringify(m));}
 if(shared){shared.retain(handle);handle._sharedRetained=true;}update(handle,worldContext.timeSeconds??0,worldContext);return handle;
}
export function update(handle,time,worldInputs={}){
 if(!handle||handle.disposed)throw new Error('Cannot update disposed street');finite(time,0,1e10,'host elapsed');
 if(handle.analyticWind){handle.state={time,worldInputs:{...worldInputs},initialized:true};return;}
 handle._library.update?.(time,worldInputs);
 if(handle.state.time===time&&handle.state.initialized){handle.state.worldInputs={...worldInputs};return;}
 const wind=handle.score.motion.wind;
 for(const c of handle.cloth){const a=c.mesh.geometry.attributes.position,rest=c.rest;let minY=Infinity,maxY=-Infinity;for(let i=1;i<rest.length;i+=3){minY=Math.min(minY,rest[i]);maxY=Math.max(maxY,rest[i]);}const height=Math.max(.1,maxY-minY);
  for(let i=0;i<a.count;i++){const k=i*3,free=c.pinned?.[i]?0:Math.max(0,Math.min(1,(maxY-rest[k+1])/height)),phase=time*wind.frequency*2*Math.PI+(c.seed||0)*.173+rest[k]*1.8;
   a.setXYZ(i,rest[k]+Math.sin(phase)*wind.amplitude*.35*free,rest[k+1],rest[k+2]+Math.sin(phase+.3)*wind.amplitude*free*free);}
  a.needsUpdate=true;c.mesh.geometry.computeVertexNormals();c.mesh.geometry.computeBoundingSphere();
 }
 handle.state={time,worldInputs:{...worldInputs},initialized:true};
}
export function measure(handle){
 const {geometries,materials}=gather(handle.root),allocatedMaterials=new Set([...materials,...(handle._library?.materials||[])]);let meshes=0,instances=0,expandedTriangles=0,geometryBytes=0,instanceBytes=0,positionCount=0;
 handle.root.traverse(o=>{if(!o.isMesh)return;meshes++;const n=o.isInstancedMesh?o.count:1;if(o.isInstancedMesh){instances+=n;instanceBytes+=o.instanceMatrix.array.byteLength;if(o.instanceColor)instanceBytes+=o.instanceColor.array.byteLength;}expandedTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*n;});
 for(const g of geometries){for(const a of Object.values(g.attributes))geometryBytes+=a.array.byteLength;if(g.index)geometryBytes+=g.index.array.byteLength;positionCount+=g.attributes.position?.count||0;}
 handle.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(handle.root);
 return{scoreBytes:new TextEncoder().encode(JSON.stringify(handle.score)).length,meshes,instances,geometries:geometries.size,materials:allocatedMaterials.size,renderMaterials:materials.size,expandedTriangles,geometryBytes,instanceBytes,positionCount,bounds:{min:b.min.toArray(),max:b.max.toArray()},textures:[...materials].filter(m=>m.map||m.normalMap||m.roughnessMap||m.emissiveMap).length,...{features:{...handle.stats}}};
}
function hashBytes(hash,array){const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);for(const b of bytes){hash^=b;hash=Math.imul(hash,16777619);}return hash>>>0;}
export function snapshot(handle){
 if(handle.disposed)throw new Error('Cannot snapshot disposed street');handle.root.updateMatrixWorld(true);let hash=2166136261;handle.root.traverse(o=>{if(!o.isMesh)return;for(const key of ['position','normal','uv'])if(o.geometry.attributes[key])hash=hashBytes(hash,o.geometry.attributes[key].array);if(o.geometry.index)hash=hashBytes(hash,o.geometry.index.array);if(o.isInstancedMesh)hash=hashBytes(hash,o.instanceMatrix.array);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)hash=hashBytes(hash,new TextEncoder().encode(JSON.stringify({color:m.color?.getHex(),roughness:m.roughness,metalness:m.metalness,street:m.userData?.street?.config})));hash=hashBytes(hash,new Float64Array(o.matrixWorld.elements));});
 hash=hashBytes(hash,new TextEncoder().encode(JSON.stringify(handle.state)));
 return{instrument:INSTRUMENT_ID,version:VERSION,time:handle.state.time,hash:hash.toString(16).padStart(8,'0'),measure:measure(handle)};
}
export function dispose(handle){
 if(!handle||handle.disposed)return;const r=gather(handle.root);for(const g of handle.resources?.geometries||[])r.geometries.add(g);for(const m of handle._library?.materials||[])r.materials.add(m);
 for(const mesh of r.instanced)mesh.dispose();for(const g of r.geometries)if(!g.userData.kstShared)g.dispose();if(handle._shared&&handle._sharedRetained)handle._shared.release(handle);else if(!handle._shared)for(const g of r.geometries)if(g.userData.kstShared)g.dispose();for(const m of r.materials)m.dispose();handle._library?.dispose({resources:false});if(!handle._shared)handle._words?.dispose({resources:false});handle.root.removeFromParent();handle.root.clear();handle.cloth.length=0;handle.resources=null;handle._library=null;handle._words=null;handle._shared=null;handle.disposed=true;
}
export const KST1=Object.freeze({INSTRUMENT_ID,VERSION,ABI,SCHEMA,LIMITS,validate,parseScore,build,update,measure,snapshot,dispose});

// Shared primitives and finite glyph meshes keep one CPU recipe cache. GPU storage
// is released on the final chunk reference, and recreated by Three on re-entry.
export function createSharedResources(){
 const words=createWordFactory(THREE),primitives=new Map(),registered=new Set(),refs=new Map();let releases=0,closed=false;
 const register=g=>{g.userData.kstShared=true;registered.add(g);return g;};
 const shared={words,primitive(key,create){if(closed)throw new Error('Shared pool disposed');if(!primitives.has(key))primitives.set(key,register(create()));return primitives.get(key);},
 makeWord(text,options){const word=words.makeWord(text,options);word.traverse(o=>{if(o.geometry)register(o.geometry);});return word;},
 retain(handle){for(const g of gather(handle.root).geometries)if(g.userData.kstShared)refs.set(g,(refs.get(g)||0)+1);},
 release(handle){for(const g of gather(handle.root).geometries)if(g.userData.kstShared){const n=refs.get(g);if(!n)throw new Error('Shared geometry reference underflow');if(n===1){refs.delete(g);g.dispose();releases++;}else refs.set(g,n-1);}},
 snapshot(){let bytes=0,activeBytes=0;for(const g of registered){let n=g.index?.array.byteLength||0;for(const a of Object.values(g.attributes))n+=a.array.byteLength;bytes+=n;if(refs.has(g))activeBytes+=n;}return{cachedGeometries:registered.size,referencedGeometries:refs.size,cpuBytes:bytes,activeBytes,gpuLastReferenceReleases:releases,referenceTotal:[...refs.values()].reduce((a,b)=>a+b,0)};},
 dispose(){if(closed)return;if(refs.size)throw new Error('Cannot dispose a referenced shared pool');for(const g of registered)g.dispose();words.dispose({resources:false});registered.clear();primitives.clear();closed=true;}};return shared;
}
