import{HeadTransfer}from'../full/src/HeadTransfer.mjs';
import{AnnyModel}from'../full/source/kaopu-anny-workbench/r02/src/AnnyModel.js';
import{GNMHeadModel,parseContainer}from'../full/source/kaopu-unified-human-workbench/src/GNMModel.js';
import{NeckSurface}from'../full/source/neck-baseline/src/NeckSurface.js';
import{CommonPerson}from'../full/src/CommonPerson.mjs';
import{CommonBodyDriver}from'../full/body-adapter/CommonBodyDriver.mjs';
import{MHRBodyAdapter}from'../full/body-adapter/MHRBodyAdapter.mjs';
import{MHRDetailedEngine,unpackModel}from'../full/body-adapter/MHRDetailedEngine.mjs';
import{loadVerified,loadParts,inflate,sha,mark}from'./AssetCache.mjs';
import{metadata,gnmPack}from'./TransportManifest.mjs';
export const assetRoot=new URL('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe/kaopu-unified-human-workbench/full/');
/** Same constructors, complete native weights, metadata and byte digests as
 * ET19-L3. Source integrity is checked in the build instead of re-downloading
 * sixteen bundled source files on every browser launch. */
export async function loadCommon({signal,onProgress=()=>{},base=assetRoot}={}){
 const alive=()=>{if(signal?.aborted)throw new DOMException('Load cancelled','AbortError');};
 const resolve=path=>new URL(metadata.assetURLs[path]||path,base).href;
 let complete=0;const read=async(path,expected=metadata.assetHashes[path])=>{const b=await loadVerified(resolve(path),expected,signal);alive();onProgress({fraction:Math.min(.94,++complete/30),label:path});return b;};
 const decode=data=>JSON.parse(new TextDecoder().decode(data)),json=async path=>decode(await read(path));
 mark('完整权重并行下载 / 复用校验缓存');
 const amTask=json('source/kaopu-anny-workbench/assets/anny-model.json'),mmTask=json('source/kaopu-mhr-workbench/assets/model.json');
 const bodyTask=amTask.then(am=>loadParts(am.binary.compressed.parts,'',am.binary.sha256,signal,file=>resolve('source/kaopu-anny-workbench/assets/'+file)));
 const mhrTask=mmTask.then(mm=>loadParts(mm.parts,'',metadata.mhrRawSHA256,signal,file=>resolve('source/kaopu-mhr-workbench/assets/'+file)));
 const gnmTask=loadParts(gnmPack.parts,'',gnmPack.rawSHA256,signal,file=>new URL(file,globalThis.__LIP_STARTUP__.base).href);
 const [am,mm,fm,km,canonicalBytes,gnmBytes,faceBytes,kernelBytes,indexBytes,baryBytes,gates,headMeta,headRaw,morphologyMeta,morphologyRaw,bodyRaw,mhrRaw]=await Promise.all([
  amTask,mmTask,json('source/kaopu-anny-workbench/r02/assets/facial-actions.json'),json('source/neck-baseline/assets/kernel.json'),
  read('source/kaopu-unified-human-workbench/assets/canonical.json.gz').then(inflate),gnmTask,read('source/kaopu-anny-workbench/r02/assets/facial-actions.bin.gz').then(inflate),read('source/neck-baseline/assets/kernel.bin.gz').then(inflate),read('body-adapter/map-indices.u32'),read('body-adapter/map-bary.f32'),json('research/anny-local-region-gates.json'),
  json('assets/head-transfer.json'),read('assets/head-transfer.bin.gz').then(inflate),json('assets/head-morphology.json'),read('assets/head-morphology.bin.gz').then(inflate),bodyTask,mhrTask
 ]);alive();mark('原始权重就绪 / 装配同一人物');
 if(await sha(faceBytes)!==fm.rawSha256)throw Error('Anny 面部权重校验失败');if(await sha(headRaw)!==headMeta.binary.sha256)throw Error('共同头部适配校验失败');if(await sha(morphologyRaw)!==morphologyMeta.binary.sha256)throw Error('源头部连续场校验失败');
 const canonical=decode(canonicalBytes),g=parseContainer(gnmBytes),anny=new AnnyModel(am,bodyRaw,fm,faceBytes),gnm=new GNMHeadModel(g.meta,g.sections),model=new CommonPerson(anny,gnm,canonical,{id:metadata.adapterFingerprint,acceptedParameterFingerprints:metadata.legacyArchiveFingerprints||[]},new NeckSurface({...km,vertexCount:metadata.vertices},kernelBytes),mm);
 const adapter=new MHRBodyAdapter({engine:new MHRDetailedEngine(mm,unpackModel(mm,mhrRaw)),anny,canonical,mapIndices:new Uint32Array(indexBytes),mapBary:new Float32Array(baryBytes),topologySha256:canonical.topologySha256});model.bodyDriver=new CommonBodyDriver({anny,mhrAdapter:adapter,canonical});
 model.headTransfer=new HeadTransfer(headMeta,headRaw);model.headTransfer.attachMorphologyField(morphologyMeta,morphologyRaw);
 Object.assign(model.coverage,{mhrBodyIdentity45:true,mhrBodyRig204:true,mhrFullNonlinearCorrectives:true,mhrHeadIdentity:true,mhrExpression:true,annyHeadTransfer:true,annyFacialActions:true,crossTeacherHeadVisuallyAccepted:false});alive();mark('原人物与完整权重装配完成');onProgress({fraction:1,label:'同一共同网格已装配'});
 return {model,metadata,localGate:Object.fromEntries([...gates.rows,...['nipple-point-incr','nipple-size-incr'].map(label=>({label,gate:'body-active'}))].map(r=>[r.label,{...r,enabled:true,headOnly:r.gate==='disabled-head-transfer-pending',partial:r.gate==='body-active-head-partial',reason:r.gate==='disabled-head-transfer-pending'?'纯头部局部形態；Anny接管头部形状时生效':r.gate==='body-active-head-partial'?'身体部分始终生效；头部部分由头形来源决定':'原生身体局部已连接'}]))};
}
