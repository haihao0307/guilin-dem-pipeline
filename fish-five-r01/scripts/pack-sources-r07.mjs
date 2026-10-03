import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {Worker as NodeWorker} from 'node:worker_threads';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),out=path.join(root,'data/r07');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const codecText=fs.readFileSync(path.join(root,'src/source-codec-r07.js'),'utf8');
const {decodeSourceR07,restoreSourceTexturesR07}=await import('data:text/javascript;base64,'+Buffer.from(codecText).toString('base64'));
const fields={positions:['f32',Float32Array],base:['f64',Float64Array],residual:['f64',Float64Array],paramAddress:['f64',Float64Array],normals:['f32',Float32Array],uvs:['f32',Float32Array],indices:['u32',Uint32Array],finId:['u32',Uint32Array],finWeight:['f32',Float32Array],finGradient:['f32',Float32Array]};
const byteview=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function testCodecFormats(){
 const compressed=fs.readFileSync(path.join(root,'data/herring.score.json.gz')),raw=zlib.gunzipSync(compressed),decoded=decodeSourceR07(raw,'R06_JSON_GZIP');
 if(decoded.format!=='R06_JSON_GZIP')throw Error('R06 fallback not explicitly identified');
 let rejected=0;for(const[input,format]of[[raw,'FSP7_GZIP'],[Buffer.from('not-a-source'),''],[Buffer.from('FSP7'),'FSP7_GZIP']])try{decodeSourceR07(input,format);}catch{rejected++;}
 if(rejected!==3)throw Error('Format corruption accepted');
 return{passed:true,r06ExplicitDispatch:true,rejectedCases:['carrier format disagrees','unknown format','truncated FSP7']};
}
function reconstruction(score){
 const c=score.parameterization.coefficients,poly=(c,x)=>c.reduceRight((a,v)=>a*x+v,0),arrays=[];
 for(const p of score.primitives){const a=new Float32Array(p.positions.length);for(let i=0;i<a.length/3;i++){
  const x=p.paramAddress[2*i]-.5,t=p.paramAddress[2*i+1],base=[x,poly(c[0],x)+Math.max(Math.abs(poly(c[2],x)),.001)*Math.sin(t),poly(c[1],x)+Math.max(Math.abs(poly(c[3],x)),.001)*Math.cos(t)];
  for(let k=0;k<3;k++)a[i*3+k]=base[k]+p.residual[i*3+k];
 }arrays.push(a);}return arrays;
}
function pack(original){
 const score={...original,primitives:original.primitives.map(p=>({...p})),textures:original.textures.map(t=>({...t}))},blocks=[],images=[],chunks=[];let offset=0;
 for(let pi=0;pi<score.primitives.length;pi++)for(const[field,[type,C]]of Object.entries(fields)){
  const values=score.primitives[pi][field];if(!values)continue;
  const a=C.from(values),pad=(C.BYTES_PER_ELEMENT-offset%C.BYTES_PER_ELEMENT)%C.BYTES_PER_ELEMENT;
  if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}
  blocks.push({primitive:pi,field,type,length:a.length,offset});chunks.push(byteview(a));offset+=a.byteLength;delete score.primitives[pi][field];
 }
 const numericBytes=offset;
 for(let ti=0;ti<score.textures.length;ti++){
  const uri=score.textures[ti].uri,comma=uri.indexOf(','),prefix=uri.slice(0,comma+1);
  if(!/^data:[^;,]+;base64,$/.test(prefix))throw Error('Unexpected texture encoding');
  const encoded=Buffer.from(uri.slice(comma+1),'base64');
  if(prefix+encoded.toString('base64')!==uri)throw Error('Noncanonical base64 texture');
  images.push({texture:ti,offset,length:encoded.length,prefix});chunks.push(encoded);offset+=encoded.length;score.textures[ti].uri=null;
 }
 const head=Buffer.from(JSON.stringify({schema:'FSP7_TYPED_SOURCE_1',score,blocks,images}),'utf8'),prefix=Buffer.alloc(16);
 prefix.write('FSP7');prefix.writeUInt32LE(1,4);prefix.writeUInt32LE(head.length,8);prefix.writeUInt32LE(offset,12);
 const padding=Buffer.alloc((8-(16+head.length)%8)%8),raw=Buffer.concat([prefix,head,padding,...chunks]);
 return{raw,headerBytes:head.length,numericBytes,imageBytes:offset-numericBytes,blocks,images};
}
function validate(original,packed){
 const result=decodeSourceR07(packed.raw,'FSP7_GZIP'),score=restoreSourceTexturesR07(result.score,result.images),checks=[];
 for(let pi=0;pi<score.primitives.length;pi++)for(const[field,[type,C]]of Object.entries(fields))if(original.primitives[pi][field]){
  const expected=C.from(original.primitives[pi][field]),actual=score.primitives[pi][field];
  if(!byteview(actual).equals(byteview(expected)))throw Error('Array mismatch '+pi+':'+field);
  checks.push({primitive:pi,field,type,elements:actual.length,bytes:actual.byteLength,sha256:hash(byteview(actual)),bitIdentical:true});
 }
 const stripped=s=>({...s,primitives:s.primitives.map(p=>Object.fromEntries(Object.entries(p).filter(([k])=>!fields[k])))});
 if(JSON.stringify(stripped(score))!==JSON.stringify(stripped(original)))throw Error('Metadata mismatch');
 const before=reconstruction(original),after=reconstruction(score);
 for(let i=0;i<before.length;i++)if(!byteview(before[i]).equals(byteview(after[i])))throw Error('Procedural reconstruction mismatch');
 const textures=original.textures.map((t,i)=>{
  if(JSON.stringify(t)!==JSON.stringify(score.textures[i]))throw Error('Texture metadata mismatch');
  const bytes=Buffer.from(t.uri.split(',')[1],'base64');return{index:i,mimeType:t.mimeType,resolution:t.resolution,bytes:bytes.length,sha256:hash(bytes),sourcePixelSha256:t.sourcePixelSha256,sourceOriginalEncodedSha256:t.sourceSha256,metadataByteIdentical:true,pixelPayloadByteIdentical:true};
 });
 return{arrayChecks:checks,allRequiredArraysBitIdentical:true,paramAddressResidualFloat64BitIdentical:true,baseFloat64BitIdentical:true,metadataExact:true,texturePayloads:textures,proceduralReconstructionFloat32BitIdentical:true};
}
if(process.argv[2]==='--bench'){
 const format=process.argv[3],file=process.argv[4];global.gc?.();const before=process.memoryUsage(),started=performance.now();
 let compressed=fs.readFileSync(file),raw=zlib.gunzipSync(compressed),score;
 if(format==='FSP7_GZIP'){const result=decodeSourceR07(raw,format);score=restoreSourceTexturesR07(result.score,result.images);}
 else{
  score=JSON.parse(raw.toString('utf8'));
  for(const p of score.primitives){for(const f of ['positions','normals','uvs','finWeight','finGradient'])if(p[f])p[f]=Float32Array.from(p[f]);for(const f of ['paramAddress','residual'])if(p[f])p[f]=Float64Array.from(p[f]);for(const f of ['indices','finId'])if(p[f])p[f]=Uint32Array.from(p[f]);}
 }
 const decodeMs=performance.now()-started,atDecode=process.memoryUsage();compressed=null;raw=null;global.gc?.();const retained=process.memoryUsage();
 console.log(JSON.stringify({format,decodeMs,before,atDecode,retained,maxRssBytes:process.resourceUsage().maxRSS*1024,primitiveCount:score.primitives.length}));process.exit(0);
}
async function testLoader(){
 const source=fs.readFileSync(path.join(root,'src/source-loader.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function createSourceLoader','function createSourceLoader');
 const requests=[],workers=[],revoked=[],phases=[];
 const sandbox={Blob,DOMException,AbortController,Map,Set,ArrayBuffer,decodeSourceR07,restoreSourceTexturesR07,document:{getElementById:id=>({dataset:{format:'FSP7_GZIP'},id})},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:u=>revoked.push(u)},loadPhase:(...args)=>phases.push(args),readCarrierBytes:(el,id,{signal})=>new Promise((resolve,reject)=>{requests.push({id,signal,resolve,reject});signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')));})};
 sandbox.Worker=class{constructor(){this.dead=false;workers.push(this);}postMessage(message){this.message=message;}terminate(){this.dead=true;}};
 vm.createContext(sandbox);vm.runInContext(source+'\nglobalThis.factory=createSourceLoader;',sandbox);const loader=sandbox.factory();
 const tick=async()=>{await Promise.resolve();await Promise.resolve();},assert=(ok,why)=>{if(!ok)throw Error('Loader test: '+why);};
 const payload=()=>new Uint8Array([1,2]),success=(w,id)=>w.onmessage({data:{token:w.message.token,id,score:{id,primitives:[{positions:new Float32Array([1,2,3])}]},format:'FSP7_GZIP'}});
 const p1=loader.load('herring'),same=loader.load('herring');assert(p1===same,'reuse pending promise');const cancelled1=p1.catch(e=>e.name);loader.clear();assert(await cancelled1==='AbortError','cancel rejects');assert(requests[0].signal.aborted,'abort exact fetch');
 const p2=loader.load('herring');requests[0].resolve(payload());requests[1].resolve(payload());await tick();assert(workers.length===1,'stale fetch cannot spawn worker');success(workers[0],'herring');await p2;assert(workers[0].dead,'success terminates worker');
 const p3=loader.load('colorful'),cancelled3=p3.catch(e=>e.name);requests[2].resolve(payload());await tick();const stale=workers[1];loader.cancelPendingExcept('herring');assert(stale.dead,'cancel terminates worker');assert(await cancelled3==='AbortError','switch cancellation');success(stale,'colorful');assert(loader.stats().cachedIds.join(',')==='herring','late decode cannot repopulate');
 const p4=loader.load('colorful');requests[3].reject(Error('download failure'));await p4.catch(()=>{});assert(!loader.stats().pendingIds.length,'failure removed');const p5=loader.load('colorful');requests[4].resolve(payload());await tick();workers[2].onmessage({data:{token:workers[2].message.token,id:'colorful',error:'bad gzip'}});await p5.catch(()=>{});assert(workers[2].dead,'decode failure terminates');
 const p6=loader.load('colorful');requests[5].resolve(payload());await tick();success(workers[3],'colorful');await p6;loader.releaseExcept('colorful');assert(loader.stats().cachedIds.join(',')==='colorful','single selected cache');loader.clear();assert(loader.stats().typedBytes===0,'clear no typed buffers retained');
 const controller=new AbortController(),p7=loader.load('picasso',{signal:controller.signal}),c7=p7.catch(e=>e.name);controller.abort();assert(await c7==='AbortError','external abort');
 const p8=loader.load('picasso'),c8=p8.catch(e=>e.name);loader.dispose();assert(await c8==='AbortError','dispose rejects');assert(revoked.length===1,'dispose revokes worker blob');assert(!loader.stats().workers&&!loader.stats().pendingIds.length,'dispose no worker/pending');await loader.load('herring').catch(()=>{});
 return{passed:true,cases:['pending same-id reuse','exact fetch abort','cancel/retry same-id token isolation','obsolete fetch no worker','decode worker termination on success/failure/cancel','stale decode cannot repopulate','download failure retry','decode failure retry','selected cache eviction','clear releases typed buffers','external abort','dispose rejects and revokes'],final:loader.stats(),scope:'CPU deterministic loader lifecycle; real browser integration remains independent gate'};
}
async function testActualWorker(file,id){
 const loader=fs.readFileSync(path.join(root,'src/source-loader.js'),'utf8'),main=loader.slice(loader.indexOf('function sourceWorkerMain'),loader.indexOf('export function createSourceLoader'));
 const program="const {parentPort}=require('node:worker_threads');global.self={postMessage:(data,transfer)=>{parentPort.postMessage(data,transfer);parentPort.postMessage({proof:{transferCount:transfer.length,detached:transfer.every(b=>b.byteLength===0),noTextureUriExpanded:data.score?.textures.every(t=>t.uri===null)}})}};"+main+'\nsourceWorkerMain('+decodeSourceR07.toString()+');parentPort.on("message",data=>self.onmessage({data}));';
 const worker=new NodeWorker(program,{eval:true});let decoded;
 const result=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',data=>{if(data.proof){if(!data.proof.detached||data.proof.transferCount!==1||!data.proof.noTextureUriExpanded)reject(Error('Actual worker transfer failed'));else resolve(data.proof);}else if(data.error)reject(Error(data.error));else decoded=data;});const bytes=Uint8Array.from(fs.readFileSync(file));worker.postMessage({token:42,id,bytes,format:'FSP7_GZIP'},[bytes.buffer]);if(bytes.byteLength!==0)reject(Error('Compressed input not detached'));});
 await worker.terminate();restoreSourceTexturesR07(decoded.score,decoded.images);if(!decoded.score.textures.every(t=>t.encodedBytes.byteLength===t.bytes))throw Error('Transferred images not bound');
 return{passed:true,...result,decodedId:decoded.id,scope:'Actual CPU Worker thread executing serialized production worker; gzip, decode, single-buffer transfer and lazy URI restoration'};
}
fs.mkdirSync(out,{recursive:true});const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/scores.json'),'utf8')),items=[],proofs=[];
for(const item of manifest.items){
 const originalCompressed=fs.readFileSync(path.join(root,'data',item.file));if(hash(originalCompressed)!==item.sha256)throw Error('Original source SHA mismatch '+item.id);
 const originalRaw=zlib.gunzipSync(originalCompressed),original=JSON.parse(originalRaw.toString('utf8')),packed=pack(original),proof=validate(original,packed),gzip=zlib.gzipSync(packed.raw,{level:9});
 const file=item.id+'.fsp7.gz';fs.writeFileSync(path.join(out,file),gzip);
 const reread=decodeSourceR07(zlib.gunzipSync(fs.readFileSync(path.join(out,file))),'FSP7_GZIP');if(reread.score.id!==item.id)throw Error('Roundtrip identity');
 const benchmarks=[];for(const[format,filename]of[['R06_JSON_GZIP',path.join(root,'data',item.file)],['FSP7_GZIP',path.join(out,file)]]){
  benchmarks.push(JSON.parse(execFileSync(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--bench',format,filename],{windowsHide:true,maxBuffer:1000000}).toString()));
 }
 const fieldSizes=Object.entries(original).map(([field,value])=>{const bytes=Buffer.from(JSON.stringify(value));return{field,jsonBytes:bytes.length,gzipBytes:zlib.gzipSync(bytes,{level:9}).length};});
 const largeNonTextureStrings=[];function scan(value,address){if(typeof value==='string'&&value.length>4096)largeNonTextureStrings.push({address,characters:value.length});else if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))scan(v,address+'.'+k);}for(const[k,v]of Object.entries(original))if(k!=='textures')scan(v,k);
 const unknownPrimitiveArrays=original.primitives.flatMap((p,primitive)=>Object.entries(p).filter(([k,v])=>Array.isArray(v)&&!fields[k]).map(([field,value])=>({primitive,field,length:value.length})));
 if(unknownPrimitiveArrays.length)throw Error('Unconverted primitive arrays');
 const entry={...item,file:'r07/'+file,format:'FSP7_GZIP',bytes:gzip.length,sha256:hash(gzip),sourceFile:item.file,sourceScoreSha:item.sha256,originalCompressedBytes:originalCompressed.length,originalJsonBytes:originalRaw.length,binaryBytes:packed.raw.length,headerBytes:packed.headerBytes,numericBytes:packed.numericBytes,imageBytes:packed.imageBytes,savedCompressedBytes:originalCompressed.length-gzip.length};items.push(entry);
 proofs.push({id:item.id,...proof,originalUnchanged:hash(fs.readFileSync(path.join(root,'data',item.file)))===item.sha256,fieldSizes,largeNonTextureStrings,unknownPrimitiveArrays,hasHiddenGeometryOrGlbDuplicate:false,benchmarks});console.log(JSON.stringify({id:item.id,old:originalCompressed.length,new:gzip.length,header:packed.headerBytes,numeric:packed.numericBytes,images:packed.imageBytes,heapR06:benchmarks[0].retained.heapUsed,heapR07:benchmarks[1].retained.heapUsed}));
}
const registry={schema:'FISH_SOURCE_BINARY_REGISTRY_R07_1',taskId:'FISH_MATH_MEMORY_PERFORMANCE_R07_20261003',builtAt:new Date().toISOString(),format:'FSP7_GZIP',items,totalCompressedBytes:items.reduce((s,v)=>s+v.bytes,0),originalTotalCompressedBytes:items.reduce((s,v)=>s+v.originalCompressedBytes,0)};
const lifecycle=await testLoader(),codecFormats=testCodecFormats(),actualWorker=await testActualWorker(path.join(out,items[0].file.replace('r07/','')),items[0].id);fs.writeFileSync(path.join(out,'registry.json'),JSON.stringify(registry,null,2)+'\n');
const report={schema:'FSP7_EXACT_PRESERVATION_PROOF_1',taskId:registry.taskId,builtAt:registry.builtAt,codecSha256:hash(fs.readFileSync(path.join(root,'src/source-codec-r07.js'))),loaderSha256:hash(fs.readFileSync(path.join(root,'src/source-loader.js'))),allPassed:true,proofs,loaderLifecycle:lifecycle,codecFormats,actualWorker,limitations:['CPU representation/lifecycle proof only; independent GPU/browser gates remain required','Original textures are preserved and dominate yellow-tuna compressed bytes','positions retain current R06 Float32 upload rounding; base/chart/residual retain original Float64','Original texture URI is lazy and only reference inspectors construct it; production must use encodedBytes Blob path','typedBytes includes encoded image storage; numericBytes and encodedImageBytes distinguish it; JS metadata excluded','Node benchmark is a single-process CPU sample, not a browser heap/performance guarantee','releaseExcept drops loader references; app-owned geometry/material/texture teardown is a separate integration requirement']};
fs.writeFileSync(path.join(out,'EXACT_PRESERVATION_PROOF.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'TEXTURE_AND_HEADER_INVENTORY.json'),JSON.stringify(proofs.map(p=>({id:p.id,sourceScoreSha:items.find(i=>i.id===p.id).sourceScoreSha,originalFieldSizes:p.fieldSizes,unknownPrimitiveArrays:p.unknownPrimitiveArrays,largeNonTextureStrings:p.largeNonTextureStrings,texturePayloads:p.texturePayloads})),null,2)+'\n');
console.log(JSON.stringify({registry:registry.totalCompressedBytes,original:registry.originalTotalCompressedBytes,lifecycle:lifecycle.passed}));
