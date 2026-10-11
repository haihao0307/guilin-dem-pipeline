import assert from 'node:assert/strict';
import {profile78,generateTropical78,fixedAsset76}from'./rules/native78-musa-author.mjs';
import {KNOWN_NATIVE_HASH_PAIRS,assertKnownNativeHashes}from'./rules/native78-equivalence.mjs';
import {createPlantRecipe}from'./native-codec/codec.mjs';
for(const p of KNOWN_NATIVE_HASH_PAIRS)assert.equal(assertKnownNativeHashes({geometryHash:p.geometry,contentHash:p.content}).matchedPair,p.id);
for(const a of KNOWN_NATIVE_HASH_PAIRS)for(const b of KNOWN_NATIVE_HASH_PAIRS)if(!KNOWN_NATIVE_HASH_PAIRS.some(p=>p.geometry===a.geometry&&p.content===b.content))assert.throws(()=>assertKnownNativeHashes({geometryHash:a.geometry,contentHash:b.content}),/Unqualified/);
assert.throws(()=>assertKnownNativeHashes({geometryHash:'0'.repeat(64),contentHash:'0'.repeat(64)}),/Unqualified/);
// Previously measured output from another stage/species is never interchangeable.
for(const pair of [{geometryHash:'a0879c7fb53d62d90ea1cc811001e9b2b41e38101a0ea9dc7a1c50210dee805d',contentHash:'7ea194b6b7820e5073cc7b7171740c9e6a0300f72c81dd0389df47bae8372707'},{geometryHash:'04f2540de4b18ce8c13eb5cf3122db93639d29430c11d6f42d72ad3469bb8d74',contentHash:'77a3555fbf894deb9b610e616e7c0d0955d53c341652343f3b7eaf5638e26ea5'}])assert.throws(()=>assertKnownNativeHashes(pair),/Unqualified/);
const p=createPlantRecipe().profile,s=generateTropical78(profile78(p.species,p),{compactBlades76:true});const original=await fixedAsset76(s);assertKnownNativeHashes(original);
async function reject(name,array,index,value){const old=array[index];array[index]=value;try{await assert.rejects(async()=>assertKnownNativeHashes(await fixedAsset76(s)),undefined,name);}finally{array[index]=old;}}
const next=a=>{const c=new Float32Array([a]);new Uint32Array(c.buffer)[0]++;return c[0];};
await reject('position ULP',s.geometry.positions,0,next(s.geometry.positions[0]));
await reject('normal ULP',s.geometry.normals,0,next(s.geometry.normals[0]));
await reject('index change',s.geometry.indices,0,(s.geometry.indices[0]+1)%s.geometry.positions.length);
await reject('growth exceeds bound',s.growth.axes[1],'birth',s.growth.axes[1].birth+2e-12);
await reject('resource pixel',s.surfaces.resources[0].bytes,0,(s.surfaces.resources[0].bytes[0]+1)%256);
await reject('nonfinite position',s.geometry.positions,0,NaN);
const restored=await fixedAsset76(s);assert.equal(restored.geometryHash,original.geometryHash);assert.equal(restored.contentHash,original.contentHash);
console.log(JSON.stringify({pass:true,qualifiedPairs:KNOWN_NATIVE_HASH_PAIRS.length,mixedPairsRejected:KNOWN_NATIVE_HASH_PAIRS.flatMap(a=>KNOWN_NATIVE_HASH_PAIRS.map(b=>({geometry:a.geometry,content:b.content}))).filter(c=>!KNOWN_NATIVE_HASH_PAIRS.some(p=>p.geometry===c.geometry&&p.content===c.content)).length,unknownPairRejected:true,actualNativeMutationCounterexamples:6,rawInputsRestored:true}));
