import {sha256,R52_REFERENCE_SHA,R52_ARCHIVE_SHA} from './FrozenR52Lock.mjs';
export const DIAGNOSTIC_VERSION='R54-device-diagnostic/3';
export const TOPOLOGY_SHA='e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de';
const SOURCE_MANIFEST_SHA='3dc98b7d120613172f0f52e15bbadf7eb1c45ec5409b0791c91a345e70965565';
const VERTICES=25417,BODY=9253,INDICES=151872;
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
export function float32Rank(bits){const magnitude=bits&0x7fffffff;return 0x80000000+((bits&0x80000000)?-magnitude:magnitude);}
export function finiteULP(a,b){if((a&0x7f800000)===0x7f800000||(b&0x7f800000)===0x7f800000)return null;return Math.abs(float32Rank(a)-float32Rank(b));}
function stats(){return{vertices:0,bitDifferentCoordinates:0,numericallyDifferentCoordinates:0,differentVertices:0,signedZeroDifferences:0,nonFiniteCoordinates:0,maxAxisAbsoluteM:0,maxAxisAt:null,maxVertexDistanceM:0,maxVertexAt:null,maxFiniteULP:0,maxULPAt:null};}
function update(s,vertex,rows){s.vertices++;let differs=false,d2=0,finite=true;for(const d of rows){if(d.bitsDiffer){s.bitDifferentCoordinates++;differs=true;}if(d.numericDiffer)s.numericallyDifferentCoordinates++;if(d.signedZeroDifference)s.signedZeroDifferences++;if(!d.finite){s.nonFiniteCoordinates++;finite=false;continue;}d2+=d.absoluteM*d.absoluteM;if(d.absoluteM>s.maxAxisAbsoluteM){s.maxAxisAbsoluteM=d.absoluteM;s.maxAxisAt={vertex,axis:d.axis};}if(d.ULP>s.maxFiniteULP){s.maxFiniteULP=d.ULP;s.maxULPAt={vertex,axis:d.axis};}}
 if(differs)s.differentVertices++;const distance=finite?Math.sqrt(d2):null;if(distance!==null&&distance>s.maxVertexDistanceM){s.maxVertexDistanceM=distance;s.maxVertexAt=vertex;}}
// Reference is an independently retained little-endian raw export. This routine
// only reads snapshots; no generated positions are replaced, rounded or accepted.
export function compareR52Coordinates(actual,referenceBytes){
 if(!(actual instanceof Float32Array)||actual.length!==VERTICES*3)throw Error('实际坐标长度/类型不符');
 if(referenceBytes.byteLength!==VERTICES*12)throw Error('基准字节长度不符');
 const ref=new DataView(referenceBytes),actualBits=new Uint32Array(actual.buffer,actual.byteOffset,actual.length),all=stats(),body=stats(),head=stats(),differences=[];
 for(let v=0;v<VERTICES;v++){const rows=[];for(let axis=0;axis<3;axis++){const i=v*3+axis,a=actual[i],b=ref.getFloat32(i*4,true),ab=actualBits[i],bb=ref.getUint32(i*4,true),finite=Number.isFinite(a)&&Number.isFinite(b),bitsDiffer=ab!==bb;
 const row={coordinate:i,vertex:v,axis:'xyz'[axis],actual:Number.isFinite(a)?a:String(a),reference:Number.isFinite(b)?b:String(b),actualBits:ab.toString(16).padStart(8,'0'),referenceBits:bb.toString(16).padStart(8,'0'),bitsDiffer,numericDiffer:a!==b,finite,signedZeroDifference:bitsDiffer&&a===0&&b===0,absoluteM:finite?Math.abs(a-b):null,ULP:finiteULP(ab,bb)};rows.push(row);if(bitsDiffer)differences.push(row);}
 update(all,v,rows);update(v<BODY?body:head,v,rows);}
 return{coordinateFrame:'native XYZ metres; display maps (x,z,-y)',partitions:{bodyVertexRange:[0,BODY],headVertexRange:[BODY,VERTICES]},all,body,head,differences};
}
async function bytes(url,fetcher){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetcher(url,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status+' '+new URL(url).pathname);return await r.arrayBuffer();}finally{clearTimeout(timer);}}
export async function diagnoseR52Device({positions,faces,state,archive,nativeArchive,fetcher=fetch,baseURL=import.meta.url,onProgress=()=>{}}){
 const snapshot=positions instanceof Float32Array?positions.slice():positions;
 const report={schema:DIAGNOSTIC_VERSION,referenceSHA:R52_REFERENCE_SHA,expectedArchiveSHA:R52_ARCHIVE_SHA,expectedTopologySHA:TOPOLOGY_SHA,createdAt:new Date().toISOString(),userAgent:globalThis.navigator?.userAgent||null,geometryAccepted:false,geometryWritten:false,automaticUpload:false,checks:{},failure:null};
 try{
  if(!(snapshot instanceof Float32Array)||snapshot.length!==VERTICES*3)throw Error('实际坐标类型或长度不符');
  report.actualSHA=await sha256(snapshot);report.actualCoordinateCount=snapshot.length;
  report.nonFiniteActualCoordinates=Array.from(snapshot,(x,i)=>Number.isFinite(x)?-1:i).filter(i=>i>=0);
  report.checks.stateMatches=equal(state,archive.state);if(!report.checks.stateMatches)throw Error('参数状态与已校验档案不一致');
  report.checks.archiveMetadataMatches=nativeArchive.topologySha256===archive.topologySha256&&nativeArchive.adapterFingerprint===archive.adapterFingerprint;if(!report.checks.archiveMetadataMatches)throw Error('原生拓扑/适配版本与档案不同');
  if(!(faces instanceof Uint32Array)||faces.length!==INDICES||!faces.every(i=>Number.isInteger(i)&&i>=0&&i<VERTICES))throw Error('实际三角索引类型/长度/范围不符');
  // Hash canonical little-endian uint32 indices, independent of machine byte order.
  const indexBytes=new ArrayBuffer(faces.length*4),iv=new DataView(indexBytes);faces.forEach((x,i)=>iv.setUint32(i*4,x,true));
  report.topologySHA=await sha256(indexBytes);report.checks.topologyMatches=report.topologySHA===TOPOLOGY_SHA;if(!report.checks.topologyMatches)throw Error('三角索引内容与固定拓扑不同');
  onProgress('3/5 校验本机诊断输入与源码');
  const archiveBytes=await bytes(new URL('archive-r52.json',baseURL),fetcher);report.archiveSHA=await sha256(archiveBytes);report.checks.archiveBytesMatch=report.archiveSHA===R52_ARCHIVE_SHA;if(!report.checks.archiveBytesMatch)throw Error('固定参数档案字节不同');
  if(!equal(JSON.parse(new TextDecoder().decode(archiveBytes)).state,state))throw Error('重新读取的固定档案与故障现场参数不同');
  const manifestBytes=await bytes(new URL('r52-diagnostic-sources.json',baseURL),fetcher);report.sourceManifestSHA=await sha256(manifestBytes);if(report.sourceManifestSHA!==SOURCE_MANIFEST_SHA)throw Error('诊断源码清单校验失败');
  const manifest=JSON.parse(new TextDecoder().decode(manifestBytes));report.sources=[];let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<manifest.files.length){const item=manifest.files[cursor++];try{const raw=await bytes(new URL(item.url,baseURL),fetcher),actual=await sha256(raw);report.sources.push({...item,actualSHA:actual,matches:actual===item.sha256});}catch(e){report.sources.push({...item,matches:false,error:e.message});}}}));
  report.sources.sort((a,b)=>a.url.localeCompare(b.url));report.checks.sourceFilesMatch=report.sources.every(x=>x.matches);if(!report.checks.sourceFilesMatch)throw Error('诊断发现源码/元数据不同或未读取成功');
  report.sourceCheckScope='Fetched exact versioned source URLs and metadata; native loader separately verifies asset hashes. A post-load refetch does not prove a previous browser module-cache byte identity.';
  onProgress('3/5 下载固定基准并在本机逐点比较');
  const reference=await bytes(new URL('r52-reference-positions.f32',baseURL),fetcher);report.loadedReferenceSHA=await sha256(reference);report.checks.referenceMatches=report.loadedReferenceSHA===R52_REFERENCE_SHA;if(!report.checks.referenceMatches)throw Error('原始基准字节校验失败');
  report.comparison=compareR52Coordinates(snapshot,reference);report.checks.actualFinite=report.nonFiniteActualCoordinates.length===0;
 }catch(e){report.failure=e.message;}
 return report;
}
export function formatR52Diagnostic(r){
 const lines=['本机诊断 '+r.schema,'实际输出 SHA256：'+(r.actualSHA||'未取得'),'固定基准 SHA256：'+r.referenceSHA,'参数档案字节：'+r.checks.archiveBytesMatch+'；参数匹配：'+r.checks.stateMatches,'拓扑匹配：'+r.checks.topologyMatches+'；源码取回匹配：'+r.checks.sourceFilesMatch,'基准文件校验：'+r.checks.referenceMatches];
 if(r.failure)lines.push('诊断未完成：'+r.failure);
 for(const[k,label]of[['all','全网格'],['body','身体'],['head','头部']]){const s=r.comparison?.[k];if(!s)continue;lines.push(label+'：'+s.differentVertices+' 个顶点 / '+s.bitDifferentCoordinates+' 个坐标位模式不同；数值不同 '+s.numericallyDifferentCoordinates,'最大单轴绝对差 '+s.maxAxisAbsoluteM+' 米；最大顶点距离 '+s.maxVertexDistanceM+' 米；最大有限 ULP '+s.maxFiniteULP,'非有限数 '+s.nonFiniteCoordinates+'；正负零位差 '+s.signedZeroDifferences);}
 lines.push('未知输出仍停止显示。ULP 是浮点位级步数，不等同可见形变。','结果仅保存在本机；复制/下载由你操作，不会自动上传。');return lines.join('\n');
}
