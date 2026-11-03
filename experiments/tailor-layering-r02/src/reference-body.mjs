import {sha} from './upstream/source-contract.mjs';
import {loadJSON,loadBytes,unzip} from './upstream/fast-assets.mjs';

// The old body is only a coordinate reference for the retained paper patterns.
// The visible native person is initialized independently and is never replaced.
// The build extracts unchanged position/index bytes from the pinned source and
// verifies its two geometry identities. The browser verifies them again while
// omitting the old body's unused skin/rig/archive payload and actor allocations.
export async function loadReferenceBody() {
  const base=new URL('./reference-body/',import.meta.url);
  const descriptor=await loadJSON(new URL('manifest.json',base)),manifest=descriptor.sourceManifest;
  if(descriptor.schema!=='kaopu-reference-body-geometry@1'||descriptor.file!=='geometry.bin.gz'||
    descriptor.byteOrder!=='little-endian'||new Uint8Array(new Uint32Array([1]).buffer)[0]!==1)
    throw Error('衣片参考几何格式不匹配');
  const bytes=await loadBytes(new URL(descriptor.file,base),descriptor.compressedSHA256);
  if(await sha(bytes)!==descriptor.compressedSHA256)throw Error('衣片参考几何包哈希不符');
  const data=await unzip(bytes),p=descriptor.positions,f=descriptor.faces;
  if(data.byteLength!==descriptor.uncompressedBytes||p.offsetBytes!==0||p.bytes!==p.length*4||
    f.offsetBytes!==p.bytes||f.bytes!==f.length*4||p.bytes+f.bytes!==data.byteLength)
    throw Error('衣片参考几何长度不符');
  const positions=new Float32Array(data,p.offsetBytes,p.length),faces=new Uint32Array(data,f.offsetBytes,f.length);
  const positionBytes=new Uint8Array(data,p.offsetBytes,p.bytes),faceBytes=new Uint8Array(data,f.offsetBytes,f.bytes);
  if(await sha(positionBytes)!==manifest.geometrySHA256||await sha(faceBytes)!==manifest.topologySHA256)
    throw Error('衣片参考人物几何或拓扑不匹配');
  return {model:{positions,faces},manifest,allocationAudit:{
    oldSkinTypedArraysCreated:false,oldActorCreated:false,
    avoidedTypedArrayBytes:descriptor.avoidedOldSkinAndActorTypedArrayBytes,
    sourceCompressedBytes:descriptor.sourceCompressedBytes,loadedCompressedBytes:bytes.byteLength,
    avoidedCompressedPayloadBytes:descriptor.avoidedCompressedPayloadBytes,
    networkPayloadChanged:true,geometryIdentityVerified:true,
    scope:'Only the old coordinate-reference asset is reduced; current native person, skin and garment geometry are unchanged'
  }};
}
