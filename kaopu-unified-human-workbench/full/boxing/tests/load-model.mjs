/** Test-only model loader. Reuses the browser's pinned asset manifest.
 * Asset bytes are read in place or fetched into memory; nothing is materialized
 * into the repository and no additional model assets are republished.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const sha256=data=>createHash('sha256').update(data).digest('hex');
const buffer=data=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
const decode=data=>JSON.parse(Buffer.from(data).toString('utf8'));

/** Locate each logical asset through runtime-metadata.assetURLs first. The
 * assembled local source path is a verified fallback for offline QA copies.
 * The only network fallback is the manifest's immutable, SHA-pinned GNM URL.
 */
export function createAssetReader({base,metadata,allowNetwork=true,fetchImpl=globalThis.fetch}){
 const cache=new Map(),reads=[];
 const get=async(logical,expected=metadata.assetHashes?.[logical])=>{
  const key=logical+':'+(expected||'');if(cache.has(key))return cache.get(key);
  const pending=(async()=>{
   const mapped=metadata.assetURLs?.[logical]||logical,remote=/^https:\/\//i.test(mapped);
   const candidates=[...new Set([...(remote?[]:[path.resolve(base,mapped)]),path.resolve(base,logical)])];
   let data=null,source=null;
   for(const candidate of candidates){try{data=await fs.readFile(candidate);source=candidate;break;}catch(e){if(e.code!=='ENOENT')throw e;}}
   if(!data&&remote){
    if(!allowNetwork)throw Error(`Missing ${logical}. Offline mode: supply the existing pinned asset at ${path.resolve(base,logical)} or rerun with network access.`);
    const url=new URL(mapped);
    if(url.protocol!=='https:'||url.hostname!=='raw.githubusercontent.com'||!/^\/xrblocks\/assets-gnm\/[a-f0-9]{40}\/gnm_head_web\.bin$/.test(url.pathname)||!expected)throw Error('Refusing an unpinned external test asset: '+logical);
    if(typeof fetchImpl!=='function')throw Error('Node 20+ is required for the pinned external GNM fetch.');
    const response=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw Error(`${logical}: HTTP ${response.status} from its pinned upstream URL`);
    data=Buffer.from(await response.arrayBuffer());source=url.href;
   }
   if(!data)throw Error(`Missing ${logical}. This test expects a checkout with the existing sibling workbench assets. Checked: ${candidates.join(', ')}. runtime-metadata.assetURLs is the source of truth; no restricted asset is bundled by this test.`);
   if(expected&&sha256(data)!==expected)throw Error('SHA-256 mismatch: '+logical+' from '+source);
   reads.push({logical,source,sha256:sha256(data),bytes:data.length});return data;
  })();cache.set(key,pending);return pending;
 };
 return {get,reads,json:async logical=>decode(await get(logical))};
}

export async function loadLocal({allowNetwork=process.env.BOXING_OFFLINE!=='1',base=path.resolve(import.meta.dirname,'../..')}={}){
 const mod=p=>import(pathToFileURL(path.join(base,p)));
 const metadata=decode(await fs.readFile(path.join(base,'ui/runtime-metadata.json')));
 const assets=createAssetReader({base,metadata,allowNetwork}),{get,json}=assets;
 // Mirror the runtime's core checks; test helpers and motion files are separate.
 await Promise.all(Object.entries(metadata.coreHashes).map(([p,sha])=>get(p,sha)));
 const [{AnnyModel},{GNMHeadModel,parseContainer},{NeckSurface},{CommonPerson},{CommonBodyDriver},{MHRBodyAdapter},{MHRDetailedEngine,unpackModel},{HeadTransfer}]=await Promise.all([
  mod('source/kaopu-anny-workbench/r02/src/AnnyModel.js'),mod('source/kaopu-unified-human-workbench/src/GNMModel.js'),mod('source/neck-baseline/src/NeckSurface.js'),mod('src/CommonPerson.mjs'),mod('body-adapter/CommonBodyDriver.mjs'),mod('body-adapter/MHRBodyAdapter.mjs'),mod('body-adapter/MHRDetailedEngine.mjs'),mod('src/HeadTransfer.mjs'),
 ]);
 const [am,fm,mm,km,canonicalBytes,gnmBytes,facialZip,kernelZip,mapIndices,mapBary,headMeta,headZip,morphMeta,morphZip]=await Promise.all([
  json('source/kaopu-anny-workbench/assets/anny-model.json'),json('source/kaopu-anny-workbench/r02/assets/facial-actions.json'),json('source/kaopu-mhr-workbench/assets/model.json'),json('source/neck-baseline/assets/kernel.json'),
  get('source/kaopu-unified-human-workbench/assets/canonical.json.gz'),get('source/kaopu-face-workbench/assets/gnm_head_web.bin'),get('source/kaopu-anny-workbench/r02/assets/facial-actions.bin.gz'),get('source/neck-baseline/assets/kernel.bin.gz'),get('body-adapter/map-indices.u32'),get('body-adapter/map-bary.f32'),json('assets/head-transfer.json'),get('assets/head-transfer.bin.gz'),json('assets/head-morphology.json'),get('assets/head-morphology.bin.gz'),
 ]);
 const unzip=(data,expected,label)=>{const raw=zlib.gunzipSync(data);if(expected&&sha256(raw)!==expected)throw Error('Inflated SHA-256 mismatch: '+label);return buffer(raw);};
 const parts=async(specs,prefix,expected)=>{
  const compressed=await Promise.all(specs.map(p=>get(prefix+(p.file||p.url.split('/').at(-1)),p.sha256)));
  return unzip(Buffer.concat(compressed),expected,prefix);
 };
 const [bodyRaw,mhrRaw]=await Promise.all([parts(am.binary.compressed.parts,'source/kaopu-anny-workbench/assets/',am.binary.sha256),parts(mm.parts,'source/kaopu-mhr-workbench/assets/',metadata.mhrRawSHA256)]);
 const faceRaw=unzip(facialZip,fm.rawSha256,'facial actions'),canonical=decode(zlib.gunzipSync(canonicalBytes)),g=parseContainer(buffer(gnmBytes));
 const anny=new AnnyModel(am,bodyRaw,fm,faceRaw),gnm=new GNMHeadModel(g.meta,g.sections);
 const model=new CommonPerson(anny,gnm,canonical,{id:metadata.adapterFingerprint,acceptedParameterFingerprints:metadata.legacyArchiveFingerprints||[]},new NeckSurface({...km,vertexCount:metadata.vertices},unzip(kernelZip,null,'neck kernel')),mm);
 const adapter=new MHRBodyAdapter({engine:new MHRDetailedEngine(mm,unpackModel(mm,mhrRaw)),anny,canonical,mapIndices:new Uint32Array(buffer(mapIndices)),mapBary:new Float32Array(buffer(mapBary)),topologySha256:canonical.topologySha256});
 model.bodyDriver=new CommonBodyDriver({anny,mhrAdapter:adapter,canonical});
 model.headTransfer=new HeadTransfer(headMeta,unzip(headZip,headMeta.binary.sha256,'head transfer'));
 model.headTransfer.attachMorphologyField(morphMeta,unzip(morphZip,morphMeta.binary.sha256,'head morphology'));
 const {defaultState}=await mod('src/State.mjs');return {model,defaultState,metadata,assetReads:assets.reads};
}
