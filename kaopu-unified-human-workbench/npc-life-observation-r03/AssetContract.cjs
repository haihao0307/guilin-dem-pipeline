'use strict';
// The three accepted native R07 presets and their exact observed R05 packets.
// The manifest and all original byte buffers are independently SHA locked.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const MANIFEST_SHA256='f3075563d5b20ae6bd6471de77eb6394fa4cb12f5aa37774075ccaadd9c7fbd4';
const NATIVE_BASE='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/';
const FACE_BASE='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/02f596def9d07ebfc187e1eb18ad345a57c8a6b6/kaopu-unified-human-workbench/face-transfer/assets/';
const PACKET_IDS=Object.freeze(['hot','anny-0','anny-1','anny-2','anny-3','anny-5','anny-6','anny-9','anny-10','anny-19','anny-21','anny-22','anny-26','anny-28','anny-29','anny-32','anny-34','anny-35']);
const IMAGES=Object.freeze([
 {name:'detail.png',url:FACE_BASE+'detail.png',bytes:894772,sha256:'330121475d188b626b27138d1e41c1712201a605ef147bc62f549e262074417a',width:1024,height:512},
 {name:'chroma.png',url:FACE_BASE+'chroma.png',bytes:480198,sha256:'9d499858603d6b367a1bd6c844312d51573250835bba50a5177624b1d4485df4',width:1024,height:512}
]);
function contract(manifestBytes){
 assert.equal(hash(manifestBytes),MANIFEST_SHA256,'Exact original R06/R07 streaming manifest');
 const manifest=JSON.parse(manifestBytes),packets=PACKET_IDS.map(id=>{
  const matches=manifest.files.filter(f=>f.id===id);assert.equal(matches.length,1,'Exactly one native packet '+id);return matches[0];
 });
 const unique=new Map();
 for(const packet of packets)for(const chunk of packet.chunks){
  const url=new URL(chunk.url,NATIVE_BASE).href;assert(url.startsWith(NATIVE_BASE+'assets/chunk-'),'Original native chunk URL');
  if(unique.has(url))assert.deepEqual(unique.get(url),{url,local:path.basename(chunk.url),bytes:chunk.bytes,sha256:chunk.sha256},'Shared chunk metadata agrees');
  else unique.set(url,{url,local:path.basename(chunk.url),bytes:chunk.bytes,sha256:chunk.sha256});
 }
 const chunks=[...unique.values()];
 assert.equal(packets.length,18);assert.equal(chunks.length,55);
 assert.equal(chunks.reduce((n,c)=>n+c.bytes,0),44303931);
 return{manifest,packets,chunks};
}
function verifyBytes(bytes,entry,label){assert.equal(bytes.length,entry.bytes,label+' bytes');assert.equal(hash(bytes),entry.sha256,label+' SHA256');return bytes;}
function verifyPNG(bytes,entry){
 verifyBytes(bytes,entry,entry.name);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Original PNG signature');
 assert.equal(bytes.toString('ascii',12,16),'IHDR');assert.equal(bytes.readUInt32BE(16),entry.width);assert.equal(bytes.readUInt32BE(20),entry.height);return bytes;
}
function verifyCache(here,manifestBytes){
 const spec=contract(manifestBytes),vendor=path.join(here,'vendor'),lock=JSON.parse(fs.readFileSync(path.join(vendor,'PACKETS.json')));
 assert.equal(lock.sourceManifestSHA256,MANIFEST_SHA256);assert.deepEqual(lock.packetIds,PACKET_IDS);assert.equal(lock.allNativePackets,false);
 assert.deepEqual(lock.chunks,spec.chunks,'No substituted, missing or unrelated chunks');assert.equal(lock.compressedBytes,44303931);
 const chunkBuffers=new Map(spec.chunks.map(c=>[c.url,verifyBytes(fs.readFileSync(path.join(vendor,'assets',c.local)),c,c.local)]));
 for(const p of spec.packets){
  let offset=0;
  const buffers=p.chunks.map(c=>{assert.equal(c.offset,offset,'Native packet contiguous chunk offset');offset+=c.bytes;return chunkBuffers.get(new URL(c.url,NATIVE_BASE).href);});
  const compressed=Buffer.concat(buffers);verifyBytes(compressed,p,'Native packet '+p.id);
  const raw=zlib.gunzipSync(compressed);assert.equal(raw.length,p.rawBytes,'Native raw bytes '+p.id);assert.equal(hash(raw),p.rawSHA256,'Native raw SHA '+p.id);
 }
 const imageLock=JSON.parse(fs.readFileSync(path.join(vendor,'IMAGES.json')));assert.deepEqual(imageLock.images,IMAGES);
 const imageBuffers=new Map(IMAGES.map(i=>[i.url,verifyPNG(fs.readFileSync(path.join(vendor,'images',i.name)),i)]));
 return{lock,images:IMAGES,chunkBuffers,imageBuffers,spec};
}
module.exports={hash,MANIFEST_SHA256,NATIVE_BASE,FACE_BASE,PACKET_IDS,IMAGES,contract,verifyBytes,verifyPNG,verifyCache};
