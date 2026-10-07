import{HeadTransfer}from'../src/HeadTransfer.mjs';
import{AnnyModel}from'../source/kaopu-anny-workbench/r02/src/AnnyModel.js';
import{GNMHeadModel,parseContainer}from'../source/kaopu-unified-human-workbench/src/GNMModel.js';
import{NeckSurface}from'../source/neck-baseline/src/NeckSurface.js';
import{CommonPerson}from'../src/CommonPerson.mjs';
import{CommonBodyDriver}from'../body-adapter/CommonBodyDriver.mjs';
import{MHRBodyAdapter}from'../body-adapter/MHRBodyAdapter.mjs';
import{MHRDetailedEngine,unpackModel}from'../body-adapter/MHRDetailedEngine.mjs';
export const assetRoot=new URL('../',import.meta.url);
const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function loadCommon({signal,onProgress=()=>{},base=assetRoot}={}){
 const alive=()=>{if(signal?.aborted)throw new DOMException('Load cancelled','AbortError');};let finished=0,total=38;
 const get=async(path,expected)=>{alive();const response=await fetch(new URL(path,base),{signal});if(!response.ok)throw Error(path+': HTTP '+response.status);const data=await response.arrayBuffer();alive();if(expected&&await digest(data)!==expected)throw Error('资产校验失败：'+path);alive();finished++;onProgress({fraction:Math.min(.95,finished/total),label:path});return data;};
 const decode=data=>JSON.parse(new TextDecoder().decode(data)),inflate=async data=>{alive();const result=await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();alive();return result;};
 const metadata=decode(await get('ui/runtime-metadata.json'));total=Object.keys(metadata.coreHashes).length+Object.keys(metadata.assetHashes).length+10;
 await Promise.all(Object.entries(metadata.coreHashes).map(([path,sha])=>get(path,sha)));
 const read=path=>get(path,metadata.assetHashes[path]),json=async path=>decode(await read(path));
 const[am,fm,mm,km,canonicalBytes,gnmBytes,faceBytes,kernelBytes,indexBytes,baryBytes,gates]=await Promise.all([
  json('source/kaopu-anny-workbench/assets/anny-model.json'),json('source/kaopu-anny-workbench/r02/assets/facial-actions.json'),json('source/kaopu-mhr-workbench/assets/model.json'),json('source/neck-baseline/assets/kernel.json'),
  read('source/kaopu-unified-human-workbench/assets/canonical.json.gz').then(inflate),read('source/kaopu-face-workbench/assets/gnm_head_web.bin'),read('source/kaopu-anny-workbench/r02/assets/facial-actions.bin.gz').then(inflate),read('source/neck-baseline/assets/kernel.bin.gz').then(inflate),read('body-adapter/map-indices.u32'),read('body-adapter/map-bary.f32'),json('research/anny-local-region-gates.json')
 ]);
 const loadParts=async(parts,prefix,expected)=>{const buffers=[];for(const part of parts){const file=part.file||part.url.split('/').at(-1);buffers.push(await get(prefix+file,part.sha256));}alive();const raw=await new Response(new Blob(buffers).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();alive();if(await digest(raw)!==expected)throw Error('原生权重解压校验失败');return raw;};
 const[bodyRaw,mhrRaw]=await Promise.all([loadParts(am.binary.compressed.parts,'source/kaopu-anny-workbench/assets/',am.binary.sha256),loadParts(mm.parts,'source/kaopu-mhr-workbench/assets/',metadata.mhrRawSHA256)]);alive();
 if(await digest(faceBytes)!==fm.rawSha256)throw Error('Anny 面部权重校验失败');
 const canonical=decode(canonicalBytes),g=parseContainer(gnmBytes),anny=new AnnyModel(am,bodyRaw,fm,faceBytes),gnm=new GNMHeadModel(g.meta,g.sections),model=new CommonPerson(anny,gnm,canonical,{id:metadata.adapterFingerprint},new NeckSurface({...km,vertexCount:metadata.vertices},kernelBytes),mm);
 const adapter=new MHRBodyAdapter({engine:new MHRDetailedEngine(mm,unpackModel(mm,mhrRaw)),anny,canonical,mapIndices:new Uint32Array(indexBytes),mapBary:new Float32Array(baryBytes),topologySha256:canonical.topologySha256});model.bodyDriver=new CommonBodyDriver({anny,mhrAdapter:adapter,canonical});
 const headMeta=await json('assets/head-transfer.json'),headRaw=await read('assets/head-transfer.bin.gz').then(inflate);if(await digest(headRaw)!==headMeta.binary.sha256)throw Error('共同头部适配校验失败');model.headTransfer=new HeadTransfer(headMeta,headRaw);
 Object.assign(model.coverage,{mhrBodyIdentity45:true,mhrBodyRig204:true,mhrFullNonlinearCorrectives:true,mhrHeadIdentity:true,mhrExpression:true,annyHeadTransfer:true,annyFacialActions:true,crossTeacherHeadVisuallyAccepted:false});alive();onProgress({fraction:1,label:'同一共同网格已装配'});
 return {model,metadata,localGate:Object.fromEntries(gates.rows.map(r=>[r.label,{...r,enabled:true,headOnly:r.gate==='disabled-head-transfer-pending',partial:r.gate==='body-active-head-partial',reason:r.gate==='disabled-head-transfer-pending'?'纯头部局部形態；Anny接管头部形状时生效':r.gate==='body-active-head-partial'?'身体部分始终生效；头部部分由头形来源决定':'原生身体局部已连接'}]))};
}
