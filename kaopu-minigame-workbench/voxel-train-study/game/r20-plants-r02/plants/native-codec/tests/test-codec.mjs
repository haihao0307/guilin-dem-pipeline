import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import * as codec from '../codec.mjs';
import {LAYOUT} from '../template-data.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const root=fileURLToPath(new URL('../',import.meta.url));
const checks=[],test=async(name,fn)=>{const result=await fn();checks.push(result==='skip'?{name,skipped:true,reason:'Optional historical fixture not supplied in this environment'}:{name,pass:true});};
const clone=x=>structuredClone(x);
const canon=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canon).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}';
const hash=async b=>Buffer.from(await crypto.subtle.digest('SHA-256',b)).toString('hex');
const recipe=codec.createPlantRecipe(),encoded=await codec.encode(recipe);
async function rewrite(text){const payload=new Uint8Array(LAYOUT.capacityBytes).fill(32);payload.set(new TextEncoder().encode(text));const out=encoded.slice();for(const s of LAYOUT.segments)out.set(payload.subarray(s.logicalOffset,s.logicalOffset+s.length),s.fileOffset);out.set(new TextEncoder().encode(await hash(payload)),LAYOUT.digestOffset);return out;}
async function rejectChange(change,pattern){const r=clone(recipe);change(r);await assert.rejects(codec.encode(r),pattern);await assert.rejects(codec.decode(await rewrite(canon(r))),pattern);}
await test('real SQLite signature and pinned application ID',()=>{assert.equal(Buffer.from(encoded.subarray(0,16)).toString(),'SQLite format 3\0');assert.equal(new DataView(encoded.buffer).getUint32(68),0x4B505531);assert.equal(new DataView(encoded.buffer).getUint32(60),1);});
await test('complete JSON exact round trip',async()=>assert.deepEqual(await codec.decode(encoded),recipe));
await test('deterministic bytes',async()=>assert.deepEqual(await codec.encode(recipe),encoded));
await test('Uint8Array, ArrayBuffer, Blob and File supported',async()=>{assert.deepEqual(await codec.decode(encoded.buffer),recipe);assert.deepEqual(await codec.decodeFile(new Blob([encoded])),recipe);assert.deepEqual(await codec.decodeFile(new File([encoded],'young-ficus.KaoPu')),recipe);});
await test('decode snapshots input before await',async()=>{const b=encoded.slice(),pending=codec.decode(b);b.fill(0);assert.deepEqual(await pending,recipe);});
await test('Node Buffer input is copied, not an aliasing Buffer.slice',async()=>{const b=Buffer.from(encoded),pending=codec.decode(b);b.fill(0);assert.deepEqual(await pending,recipe);});
await test('constructor result is independent of pins',()=>{const r=codec.createPlantRecipe();r.resources[0].sha256='0'.repeat(64);assert.deepEqual(codec.createPlantRecipe(),recipe);const pins=codec.pinnedDependencies();pins[0].sha256='0'.repeat(64);assert.deepEqual(codec.createPlantRecipe(),recipe);});
await test('bounded instance and strength options round trip',async()=>{const r=codec.createPlantRecipe({instance:{id:'alternative-young-ficus',positionM:[3,2,1],yawRadians:1.2},motion:{strength:.5}});assert.deepEqual(await codec.decode(await codec.encode(r)),r);});
await test('unknown constructor option rejected',()=>assert.throws(()=>codec.createPlantRecipe({extra:true}),/UNKNOWN_OPTION/));
await test('null instance, motion and array options rejected',()=>{for(const o of [{profile:null},{instance:null},{motion:null},[]])assert.throws(()=>codec.createPlantRecipe(o));});
await test('complete tested native profile required',async()=>{for(const [k,v] of [['seed',15091],['seed',0],['stage','adult'],['habitatForm','open-grown'],['profileVersion',7],['productionSystemVersion',77],['material','plain'],['reproductive76',true],['species','pinus']])await rejectChange(r=>r.profile[k]=v,/UNTESTED_PLANT_PROFILE/);});
await test('unknown profile keys and partial profiles rejected',async()=>{await rejectChange(r=>r.profile.extra=1,/UNTESTED_PLANT_PROFILE/);await rejectChange(r=>delete r.profile.condition76,/UNTESTED_PLANT_PROFILE/);});
await test('wrong schema/version/operator rejected',async()=>{await rejectChange(r=>r.schema='kaopu.fh88-driving-restart/0.1-experimental',/UNKNOWN_PROFILE/);await rejectChange(r=>r.profileVersion=2,/UNKNOWN_PROFILE/);await rejectChange(r=>r.operator='FH88_DRIVING',/UNKNOWN_OPERATOR/);});
await test('dependency hashes, versions, ids and size pins enforced',async()=>{for(const [k,v] of [['sha256','0'.repeat(64)],['version','untrusted'],['id','arbitrary'],['bytes',12]])await rejectChange(r=>r.dependencies[0][k]=v,/RULE_DEPENDENCY_MISMATCH/);});
await test('source head and closure digest enforced',async()=>{await rejectChange(r=>r.source.head='0'.repeat(40),/SOURCE_CLOSURE_MISMATCH/);await rejectChange(r=>r.source.closureSha256='0'.repeat(64),/SOURCE_CLOSURE_MISMATCH/);});
await test('all eight resource pins/provenance enforced',async()=>{await rejectChange(r=>r.resources[0].sha256='0'.repeat(64),/RESOURCE_DEPENDENCY_MISMATCH/);await rejectChange(r=>r.resources[0].source.uri='https://evil.example/pixels',/RESOURCE_DEPENDENCY_MISMATCH/);await rejectChange(r=>r.resources.pop(),/RESOURCE_DEPENDENCY_MISMATCH/);});
await test('unit scale and Y-up enforced',async()=>{await rejectChange(r=>r.units.rootScale=[.1,.1,.1],/UNSUPPORTED_UNITS_OR_SCALE/);await rejectChange(r=>r.units.up='Z_UP',/UNSUPPORTED_UNITS_OR_SCALE/);});
await test('only host elapsed seconds and native76 wind permitted',async()=>{await rejectChange(r=>r.motion.timeSource='saved-frames',/HOST_CLOCK_REQUIRED/);await rejectChange(r=>r.motion.timeUnit='millisecond',/HOST_CLOCK_REQUIRED/);await rejectChange(r=>r.motion.model='fake-sway',/HOST_CLOCK_REQUIRED/);});
await test('native wind bounds enforced',async()=>{await rejectChange(r=>r.motion.strength=1.01,/INVALID_MOTION_STRENGTH/);await rejectChange(r=>r.motion.strength=-.1,/INVALID_MOTION_STRENGTH/);});
await test('placement, yaw and ID bounds enforced',async()=>{await rejectChange(r=>r.instance.positionM=[1,2],/INVALID_POSITION_METRES/);await rejectChange(r=>r.instance.positionM[0]=100001,/INVALID_POSITION_METRES/);await rejectChange(r=>r.instance.yawRadians=7,/INVALID_YAW_RADIANS/);await rejectChange(r=>r.instance.id='https://evil.example',/INVALID_INSTANCE_ID/);});
await test('nonfinite numbers rejected before JSON conversion',async()=>{for(const v of [NaN,Infinity,-Infinity]){const r=clone(recipe);r.instance.positionM[0]=v;await assert.rejects(codec.encode(r),/NON_FINITE_NUMBER/);}});
await test('rehashed JSON exponent overflow rejected',async()=>{const text=canon(recipe).replace('"strength":0.25','"strength":1e999');await assert.rejects(codec.decode(await rewrite(text)),/NON_FINITE_NUMBER/);});
await test('no arbitrary executable, URL, mesh, vertex, pixel or motion frame fields',async()=>{for(const key of ['code','url','mesh','vertex','vertices','pixels','positions','indices','keyframes','animationSamples','textureData']){const r=clone(recipe);r.metadata[key]=[1,2,3];await assert.rejects(codec.encode(r),/SOURCE_PAYLOAD_FORBIDDEN/);}});
await test('all unknown fields rejected recursively',async()=>{for(const change of [r=>r.extra=true,r=>r.instance.extra=0,r=>r.motion.extra=0,r=>r.metadata.extra=0,r=>r.resources[0].extra=0]){const r=clone(recipe);change(r);await assert.rejects(codec.encode(r));}});
await test('oversized strings, arrays and deep structures rejected',async()=>{for(const change of [r=>r.instance.id='x'.repeat(100000),r=>r.instance.positionM=Array(65).fill(0),r=>{let x={};r.extra=x;for(let i=0;i<15;i++)x=x.x={};}]){const r=clone(recipe);change(r);await assert.rejects(codec.encode(r));}});
await test('prototype keys rejected after valid checksum',async()=>{for(const key of ['__proto__','prototype','constructor']){const text=canon(recipe).replace('"schema":',JSON.stringify(key)+':{},"schema":');await assert.rejects(codec.decode(await rewrite(text)),/INVALID_OBJECT_KEY/);}});
await test('prototype instances rejected',async()=>{const r=clone(recipe);Object.setPrototypeOf(r.instance,{evil:1});await assert.rejects(codec.encode(r),/PLAIN_OBJECT_REQUIRED/);});
await test('object/array getters never invoked',async()=>{let calls=0;const r=clone(recipe);Object.defineProperty(r.instance,'id',{get(){calls++;throw Error('getter ran');},enumerable:true});await assert.rejects(codec.encode(r),/PLAIN_JSON_PROPERTY_REQUIRED/);const q=clone(recipe);Object.defineProperty(q.instance.positionM,'0',{get(){calls++;throw Error('getter ran');},enumerable:true});await assert.rejects(codec.encode(q),/PLAIN_ARRAY_PROPERTY_REQUIRED/);assert.equal(calls,0);});
await test('sparse arrays and array custom properties rejected',async()=>{const r=clone(recipe);delete r.instance.positionM[0];await assert.rejects(codec.encode(r));const q=clone(recipe);q.instance.positionM.extra=1;await assert.rejects(codec.encode(q),/ARRAY_EXTRA_PROPERTIES/);});
await test('nonenumerable/symbol fields rejected',async()=>{const r=clone(recipe);Object.defineProperty(r,'hidden',{value:1});await assert.rejects(codec.encode(r),/PLAIN_JSON_PROPERTY_REQUIRED/);const q=clone(recipe);q[Symbol('s')]=1;await assert.rejects(codec.encode(q),/INVALID_OBJECT_KEY/);});
await test('duplicate JSON fields and noncanonical whitespace rejected',async()=>{await assert.rejects(codec.decode(await rewrite(canon(recipe).replace('"profileVersion":1','"profileVersion":1,"profileVersion":1'))),/NON_CANONICAL_PAYLOAD/);await assert.rejects(codec.decode(await rewrite(JSON.stringify(recipe,null,2))),/NON_CANONICAL_PAYLOAD/);});
await test('bad signature, immutable schema and graph changes rejected',async()=>{const b=encoded.slice();b[0]^=1;await assert.rejects(codec.decode(b),/BAD_SQLITE_SIGNATURE/);for(const offset of [68,105,encoded.indexOf(new TextEncoder().encode('rules')[0],300)]){if(offset<0)continue;const q=encoded.slice();q[offset]^=1;await assert.rejects(codec.decode(q),/IMMUTABLE_CONTAINER_MISMATCH/);}});
await test('payload and checksum corruption rejected',async()=>{const b=encoded.slice();b[LAYOUT.segments[0].fileOffset+32]^=1;await assert.rejects(codec.decode(b),/ASSET_HASH_MISMATCH/);const q=encoded.slice();q[LAYOUT.digestOffset]=120;await assert.rejects(codec.decode(q),/ASSET_HASH_FORMAT/);});
await test('file size checked before allocating hostile Blob',async()=>{let called=false;await assert.rejects(codec.decodeFile({size:1e9,arrayBuffer(){called=true;throw Error('allocated');}}),/FILE_SIZE_MISMATCH/);assert.equal(called,false);await assert.rejects(codec.decode(encoded.subarray(1)),/FILE_SIZE_MISMATCH/);await assert.rejects(codec.decode(new Uint8Array(encoded.length+1)),/FILE_SIZE_MISMATCH/);});
await test('JSON renamed KaoPu cannot load',async()=>await assert.rejects(codec.decodeFile(new File([JSON.stringify(recipe)],'fake.KaoPu')),/FILE_SIZE_MISMATCH/));
await test('SQLite malformed UTF8 with valid payload digest rejected',async()=>{const payload=new Uint8Array(LAYOUT.capacityBytes).fill(32);payload[0]=255;const out=encoded.slice();for(const s of LAYOUT.segments)out.set(payload.subarray(s.logicalOffset,s.logicalOffset+s.length),s.fileOffset);out.set(new TextEncoder().encode(await hash(payload)),LAYOUT.digestOffset);await assert.rejects(codec.decode(out),/INVALID_JSON_PAYLOAD/);});
await test('legacy FH88 reader and new plant reader reject each other',async()=>{
 if(!process.env.KAOPU_FH88_CODEC)return 'skip';
 const fhURL=pathToFileURL(process.env.KAOPU_FH88_CODEC);
 try{await readFile(fhURL);}catch(e){if(e.code==='ENOENT')return 'skip';throw e;}
 const fh=await import(fhURL.href);
 await assert.rejects(fh.decode(encoded));
 const old=await readFile(new URL('fixtures/FH88-default-restart.KaoPu',fhURL));
 await assert.rejects(codec.decode(old));
});
const release=JSON.parse(await readFile(resolve(root,'release-input.json'),'utf8'));
const dependencyBytes={};for(const p of release.dependencies)dependencyBytes[p.id]=new Uint8Array(await readFile(resolve(root,p.localPath)));
await test('all actual pinned release dependency bytes verify',async()=>assert.equal(await codec.verifyDependencyBytes(dependencyBytes),true));
await test('bad actual dependency bytes, size and missing bytes rejected',async()=>{const id=release.dependencies[0].id,bad={...dependencyBytes,[id]:dependencyBytes[id].slice()};bad[id][0]^=1;await assert.rejects(codec.verifyDependencyBytes(bad),/LOADED_RULE_HASH_MISMATCH/);await assert.rejects(codec.verifyDependencyBytes({...dependencyBytes,[id]:new Uint8Array(1)}),/LOADED_RULE_SIZE_MISMATCH/);await assert.rejects(codec.verifyDependencyBytes({}),/MISSING_RULE_BYTES/);});
await test('dependency verification snapshots all bytes before await',async()=>{const b=Object.fromEntries(Object.entries(dependencyBytes).map(([k,v])=>[k,Buffer.from(v)]));const pending=codec.verifyDependencyBytes(b);for(const value of Object.values(b))value.fill(0);assert.equal(await pending,true);});
await test('resource pins reject missing and corrupt pixel bytes',async()=>{await assert.rejects(codec.verifyResourceBytes({}),/MISSING_RESOURCE_BYTES/);const b=Object.fromEntries(codec.pinnedResources().map(r=>[r.id,new Uint8Array(r.bytes)]));await assert.rejects(codec.verifyResourceBytes(b),/LOADED_RESOURCE_HASH_MISMATCH/);});
// Verify all eight generated native resources with original installed author rules.
const author=release.dependencies.find(d=>d.id==='mother-author'||d.id==='native-ficus-author');
if(author){
 const m=await import(pathToFileURL(resolve(root,author.localPath)).href);
 const native=m.generateTropical78(recipe.profile,{compactBlades76:true});
 const resourceMap=Object.fromEntries(native.surfaces.resources.map(r=>[r.id,r.bytes]));
 await test('all eight actual native generated resource pixel hashes verify',async()=>assert.equal(await codec.verifyResourceBytes(resourceMap),true));
 await test('resource corruption rejected before installation',async()=>{const id=codec.pinnedResources()[0].id,bad={...resourceMap,[id]:resourceMap[id].slice()};bad[id][7]^=1;await assert.rejects(codec.verifyResourceBytes(bad),/LOADED_RESOURCE_HASH_MISMATCH/);});
}
await writeFile(resolve(root,'objects/young-ficus.KaoPu'),encoded);
await writeFile(resolve(root,'objects/young-ficus.expected.json'),JSON.stringify(recipe,null,2)+'\n');
const moved=codec.createPlantRecipe({instance:{id:'roundtrip-placement',positionM:[-52.5,.081,-9],yawRadians:.2},motion:{strength:.4}});
await writeFile(resolve(root,'objects/placement-roundtrip.KaoPu'),await codec.encode(moved));
await writeFile(resolve(root,'objects/placement-roundtrip.expected.json'),JSON.stringify(moved,null,2)+'\n');
const result={status:'PASS',runtime:process.version,checks:checks.length,results:checks,profile:codec.PROFILE,
 fileBytes:encoded.length,payloadCapacityBytes:codec.MAX_PAYLOAD_BYTES,releaseId:recipe.metadata.releaseId,
 defaultFileSha256:await hash(encoded),dependencies:codec.pinnedDependencies().length,resources:codec.pinnedResources().length,
 nativeResourceBytesVerified:!!author,sceneMutation:false};
await writeFile(resolve(root,'JS_TEST_RESULTS.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
