import {fetchBytes,decompressOriginal,checkpoint,stageDeadline,releaseVerifiedDownloadCache} from './load-bytes.mjs';
import {restoreDecodedScene} from './scene-from-fields.mjs';
import {decodeStudentFields,assembleFallbackChunks,sha256,verifyBytes} from './data/student-full-decode.mjs';
import {decodeWheelGeometryPayload} from './data/wheel/analysis-payload/geometry-payload.mjs';
import {decodeRivetPosition} from './data/rivet/decoder.mjs';
import {PACKAGE_MANIFEST_SHA256} from './package-lock.mjs';
const base=new URL('./data/',import.meta.url);
async function verified(path,bytes,hash){const b=new Uint8Array(await fetchBytes(new URL(path,base)));if(bytes!=null&&b.byteLength!==bytes)throw Error('STUDENT_LENGTH_MISMATCH '+path);if(await sha256(b)!==hash)throw Error('STUDENT_SHA_MISMATCH '+path);return b;}
async function gzipResource(path,compressedBytes,compressedSHA,decodedBytes,decodedSHA){
 const bytes=new Uint8Array(await fetchBytes(new URL(path,base)));let out;
 if(bytes[0]===31&&bytes[1]===139){await verifyBytes(bytes,compressedBytes,compressedSHA,path);out=new Uint8Array(await stageDeadline(decompressOriginal(bytes,decodedBytes),'解压学生分片 '+path));}
 else out=bytes;
 return verifyBytes(out,decodedBytes,decodedSHA,path+' decoded');
}
async function loadWheel(p){
 const manifest=JSON.parse(new TextDecoder().decode(await verified(p.manifest,null,p.manifestSHA256)));
 const bytes=await gzipResource(p.payload,p.payloadCompressedBytes,p.payloadCompressedSHA256,p.payloadDecodedBytes,p.payloadDecodedSHA256);
 const decoded=decodeWheelGeometryPayload(manifest,bytes),geometries={};
 for(const [id,n]of Object.entries(decoded.nodes))geometries[id]={position:n.attributes.position.array,normal:n.attributes.normal.array,uv:n.attributes.uv.array,index:n.index};
 return geometries;
}
async function loadRivets(p){
 const manifest=JSON.parse(new TextDecoder().decode(await verified(p.manifest,null,p.manifestSHA256))),pack={manifest};
 for(const [name,r]of Object.entries(p.packets))pack[name]=await gzipResource(r.path,r.compressedBytes,r.compressedSHA256,r.decodedBytes,r.decodedSHA256);
 const positions={};for(const row of manifest.nodes)positions[row.node]=decodeRivetPosition(row.node,pack);return positions;
}
export async function restoreStudent(){
 if(!crypto?.subtle)throw Error('需要HTTPS与SHA-256校验支持');
 const manifest=JSON.parse(new TextDecoder().decode(await verified('student-full-manifest.json',null,PACKAGE_MANIFEST_SHA256)));
 await checkpoint('核验独立学生清单；尚未解释属性为显式残余');
 const decodedChunks=new Array(manifest.fallback.chunks.length);let cursor=0,completed=0;
 async function worker(){while(cursor<decodedChunks.length){const i=cursor++,c=manifest.fallback.chunks[i];decodedChunks[i]=await gzipResource(c.path,c.compressedBytes,c.compressedSHA256,c.decodedBytes,c.decodedSHA256);completed++;await checkpoint('学生残余分片已核验',{loaded:completed,total:decodedChunks.length,unit:'分片'});}}
 await Promise.all(Array.from({length:3},worker));
 const fallbackBytes=await assembleFallbackChunks(manifest,decodedChunks);decodedChunks.length=0;
 await checkpoint('从共享曲面与绑定生成轮位置');const wheelGeometries=await loadWheel(manifest.providers.wheel);
 await checkpoint('从球面与实例参数生成铆钉位置');const rivetPositions=manifest.providers.rivet?await loadRivets(manifest.providers.rivet):{};
 const decoded=await stageDeadline(decodeStudentFields(manifest,{fallbackBytes,wheelGeometries,rivetPositions}),'核验全部学生字段');
 const images=[],imageDefinitions=[];
 for(const img of manifest.images){const bytes=await verified(img.path,img.bytes,img.sha256);images[img.imageIndex]=URL.createObjectURL(new Blob([bytes]));imageDefinitions[img.imageIndex]=img.definition;}
 let scene;try{scene=await restoreDecodedScene(manifest.gltf,manifest.fields.map(f=>f.definition),decoded.fieldBytes,images,imageDefinitions);}finally{for(const url of images)URL.revokeObjectURL(url);releaseVerifiedDownloadCache();}
 const generatedNodes=new Set(Object.keys(wheelGeometries).concat(Object.keys(rivetPositions)).map(Number));for(const p of scene.primitives)if(generatedNodes.has(p.sourceNode)){p.object.geometry.computeBoundingBox();p.object.geometry.computeBoundingSphere();}
 scene.studentManifest=manifest;scene.studentAudit={expectedTeacherAssetRequests:0,fieldCount:decoded.fieldCount,sourcePositionInputForGeneratedWheel:false,partialConversion:true,materialAnimationSemanticsRetained:true};return scene;
}
