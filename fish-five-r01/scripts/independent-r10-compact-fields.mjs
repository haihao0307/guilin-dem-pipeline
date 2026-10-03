import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const T={Float32Array,Float64Array,Int16Array,Uint16Array,Uint8Array,Uint32Array};
const registryBytes=fs.readFileSync(path.join(root,'data/r10/registry.json'));
const registry=JSON.parse(registryBytes),report={schema:'FISH_R10_INDEPENDENT_COMPACT_FIELDS_1',createdAt:new Date().toISOString(),registrySha256:sha(registryBytes),rows:[],failures:[],limitations:['QEM-reported normalized error is recorded but is not an independently measured Hausdorff bound. Attribute subset exactness and animation compatibility do not replace actual rendered silhouette/material comparison.','No browser or GPU was launched. Image proof PSNR/alpha is producer evidence; independent pixel validation remains pending.'],visualAcceptance:false,productionReady:false};
function check(id,name,passed,detail){report.rows.push({id,name,passed:!!passed,detail});if(!passed)report.failures.push(id+':'+name);}
function compact(item){
  const packed=fs.readFileSync(path.join(root,'data',item.file));
  if(sha(packed)!==item.sha256||packed.length!==item.bytes)throw Error('Frozen packet mismatch '+item.id);
  const raw=zlib.gunzipSync(packed),magic=raw.subarray(0,4).toString();
  if(!['FCP0','FCP1'].includes(magic)||raw.readUInt32LE(4)!==1)throw Error('Independent product magic');
  const n=raw.readUInt32LE(8),count=raw.readUInt32LE(12),start=Math.ceil((16+n)/8)*8;
  if(start+count!==raw.length)throw Error('Independent product bounds');
  const head=JSON.parse(raw.subarray(16,16+n).toString());
  const allowed=magic==='FCP0'?['positions','normalOct','uv','weights','partInfo','partRoot','indices']:['positions','normals','uvs','indices','finId','finWeight','finGradient'];
  let end=0;const seen=new Set(),out=magic==='FCP0'?{}:head.score;
  for(const b of head.blocks){
    const C=T[b.type],key=(b.primitive??'legacy')+':'+b.field;
    const decoded=b.decodedBytes??b.bytes;
    if(!C||!allowed.includes(b.field)||seen.has(key)||!Number.isSafeInteger(b.offset)||b.offset<end||b.offset%C.BYTES_PER_ELEMENT||b.length*C.BYTES_PER_ELEMENT!==decoded||b.offset+b.bytes>count)throw Error('Independent product block '+key);
    const target=magic==='FCP0'?out:out.primitives[b.primitive];if(!target)throw Error('Unknown primitive');
    const src=raw.subarray(start+b.offset,start+b.offset+b.bytes),copy=new Uint8Array(decoded);
    if(b.encoding==='BYTE_PLANE_DELTA_1'){
      const width=C.BYTES_PER_ELEMENT;
      if(src.length!==decoded||b.bytes!==decoded)throw Error('Independent delta size');
      // Decode into element-major byte storage; each byte lane is an independent prefix sum.
      for(let j=0;j<width;j++){let byte=0;for(let element=0;element<b.length;element++){byte=(byte+src[j*b.length+element])%256;copy[element*width+j]=byte;}}
    }
    else if(!b.encoding||b.encoding==='RAW'){if(src.length!==copy.length)throw Error('Independent raw field length');copy.set(src);}
    else throw Error('Unknown independent codec');
    target[b.field]=new C(copy.buffer);end=b.offset+b.bytes;seen.add(key);
  }
  for(const im of head.images){if(im.offset<end||im.offset+im.length>count||im.mime!=='image/webp')throw Error('Independent image bounds');end=im.offset+im.length;}
  if(end!==count)throw Error('Unexplained product trailing bytes');
  const text=raw.subarray(16,16+n).toString();
  check(item.id,'no-full-source-reconstruction-payload',!head.blocks.some(b=>['base','paramAddress','residual'].includes(b.field))&&!/"(paramAddress|residual|baseKfs2Gzip|residualGzip|coefficientCount)"/.test(text),{fields:[...new Set(head.blocks.map(b=>b.field))],magic});
  check(item.id,'finite-numeric-fields',head.blocks.every(b=>{const a=magic==='FCP0'?out[b.field]:out.primitives[b.primitive][b.field];return a.every(Number.isFinite);}));
  return{head,out,packed,raw};
}
function source(item){
  const raw=zlib.gunzipSync(fs.readFileSync(path.join(root,'data',item.file))),n=raw.readUInt32LE(8),start=Math.ceil((16+n)/8)*8,head=JSON.parse(raw.subarray(16,16+n).toString()),types={f32:Float32Array,f64:Float64Array,u32:Uint32Array};
  for(const b of head.blocks){const C=types[b.type],copy=Uint8Array.from(raw.subarray(start+b.offset,start+b.offset+b.length*C.BYTES_PER_ELEMENT));head.score.primitives[b.primitive][b.field]=new C(copy.buffer);}
  return head.score;
}
const original=JSON.parse(fs.readFileSync(path.join(root,'data/r07/registry.json')));
for(const item of registry.items.filter(i=>i.id!=='barracuda')){
  const {head,out}=compact(item),old=source(original.items.find(i=>i.id===item.id));
  check(item.id,'all-rest-geometry-rig-fields-bit-exact',out.primitives.length===old.primitives.length&&out.primitives.every((p,i)=>['positions','normals','uvs','indices','finId','finWeight','finGradient'].every(f=>p[f].constructor===old.primitives[i][f].constructor&&bytes(p[f]).equals(bytes(old.primitives[i][f])))));
  check(item.id,'rig-eyes-materials-unchanged',JSON.stringify(out.rig)===JSON.stringify(old.rig)&&JSON.stringify(out.eyes)===JSON.stringify(old.eyes)&&JSON.stringify(out.materials)===JSON.stringify(old.materials));
  check(item.id,'valid-index-cardinality',out.primitives.every(p=>p.positions.length%3===0&&p.normals.length===p.positions.length&&p.uvs.length===p.positions.length/3*2&&p.finId.length===p.positions.length/3&&p.finWeight.length===p.positions.length/3&&p.finGradient.length===p.positions.length&&p.indices.length%3===0&&p.indices.every(i=>i<p.positions.length/3)));
  check(item.id,'same-source-image-dimensions-and-alpha-proof',out.textures.length===old.textures.length&&head.images.length===out.textures.length&&head.images.every(im=>{const a=old.textures[im.texture],p=im.proof;return p.alphaMax===0&&p.accepted&&(!a.width||a.width===p.width)&&(!a.height||a.height===p.height);}));
}
const item=registry.items.find(i=>i.id==='barracuda'),{head,out:h}=compact(item);
const instrument=fs.readFileSync(path.join(root,'../local-r14/src/instrument.js'),'utf8');
if(sha(instrument)!==item.sourceProof.instrumentSha256)throw Error('Immutable legacy instrument mismatch');
const fbr=zlib.gunzipSync(fs.readFileSync(path.join(root,'data/r07/barracuda.fbr7.gz'))),n=fbr.readUInt32LE(8),start=Math.ceil((16+n)/8)*8,carrier=Uint8Array.from(fbr.subarray(start));
if(sha(carrier)!==item.sourceProof.carrierSha256)throw Error('Immutable legacy carrier mismatch');
const ctx={TextDecoder,TextEncoder,ArrayBuffer,DataView,Uint8Array,Uint16Array,Uint32Array,Int16Array,Float32Array,Float64Array,Blob,Response,DecompressionStream};vm.createContext(ctx);vm.runInContext(instrument,ctx);
const api=ctx.KaopuFishSchool,old=await api.build(carrier);h.metadata=head.metadata;h.disposed=false;h.binding=null;h.textures={};
check(item.id,'all-seven-adopted-rest-fields-and-index-order-bit-exact',['positions','normalOct','uv','weights','partInfo','partRoot','indices'].every(f=>h[f].constructor.name===old[f].constructor.name&&bytes(h[f]).equals(bytes(old[f]))),{fields:['positions','normalOct','uv','weights','partInfo','partRoot','indices'],method:'Independent byte-lane prefix-sum decoder reads custom packet; all decoded bytes compared to immutable original adopted GPU input. Index sequence order preserved. No production codec imported.'});
const fields={positions:3,normalOct:2,uv:2,weights:12,partInfo:2,partRoot:3},sourceMap=new Map(),row=Buffer.alloc(48);
function vertexKey(g,i){let off=0;for(const [f,s]of Object.entries(fields)){const src=bytes(g[f]),len=s*g[f].BYTES_PER_ELEMENT;src.copy(row,off,i*len,(i+1)*len);off+=len;}return row.toString('base64');}
const locked=new Set();for(let i=0;i<old.positions.length/3;i++){const key=vertexKey(old,i);if(!sourceMap.has(key))sourceMap.set(key,i);if(old.weights[i*12+2]||old.weights[i*12+3]||old.weights[i*12+4]||i===old.metadata.continuum.axialGait.caudalTipVertex)locked.add(key);}
const mapped=new Uint32Array(h.positions.length/3),represented=new Set();let subsetMismatch=0;
for(let i=0;i<mapped.length;i++){const key=vertexKey(h,i),index=sourceMap.get(key);if(index===undefined)subsetMismatch++;mapped[i]=index??0;represented.add(key);}
check(item.id,'all-retained-vertex-attributes-exact-source-subset',subsetMismatch===0,{candidateVertices:mapped.length,sourceVertices:old.positions.length/3,mismatch:subsetMismatch});
check(item.id,'all-protected-cranial-tail-attributes-retained',[...locked].every(k=>represented.has(k)),{protectedUniqueVertices:locked.size,missing:[...locked].filter(k=>!represented.has(k)).length});
check(item.id,'valid-index-and-field-cardinality',h.indices.every(i=>i<mapped.length)&&h.indices.length===h.metadata.counts.triangles*3&&Object.entries(fields).every(([f,s])=>h[f].length===mapped.length*s));
const oldContinuum=structuredClone(old.metadata.continuum),newContinuum=structuredClone(h.metadata.continuum);delete oldContinuum.axialGait.caudalTipVertex;delete newContinuum.axialGait.caudalTipVertex;
check(item.id,'motion-cranial-fin-configuration-unchanged',JSON.stringify(old.metadata.motion)===JSON.stringify(h.metadata.motion)&&JSON.stringify(oldContinuum)===JSON.stringify(newContinuum));
check(item.id,'tail-diagnostic-mapped-to-source',mapped[h.metadata.continuum.axialGait.caudalTipVertex]===old.metadata.continuum.axialGait.caudalTipVertex||vertexKey(h,h.metadata.continuum.axialGait.caudalTipVertex)===vertexKey(old,old.metadata.continuum.axialGait.caudalTipVertex));
let maxPositionError=0,maxTipVelocityError=0,maxNormalLengthError=0,nonFinite=0;const modes=['REST','CRUISE','BURST','TURN_LEFT','FIN_FAN'];
for(const mode of modes){if(!h.metadata.motion.modes[mode])continue;api.reset(old,mode,{amplitude:1.6,swing:1.35});api.reset(h,mode,{amplitude:1.6,swing:1.35});for(let frame=0;frame<240;frame++){api.update(old,1/60,{mode,amplitude:1.6,swing:1.35});api.update(h,1/60,{mode,amplitude:1.6,swing:1.35});maxTipVelocityError=Math.max(maxTipVelocityError,Math.abs(old.state.tailTipVelocityMps-h.state.tailTipVelocityMps));if(frame%20===0){for(let i=0;i<mapped.length;i+=Math.max(1,Math.floor(mapped.length/1024))){const a=api.deformPoint(old,mapped[i]),b=api.deformPoint(h,i);maxPositionError=Math.max(maxPositionError,Math.hypot(...a.map((v,k)=>v-b[k])));if(!a.every(Number.isFinite)||!b.every(Number.isFinite))nonFinite++;}}}}
check(item.id,'existing-full-motion-extreme-envelope-compatible',nonFinite===0&&maxPositionError<1e-10&&maxTipVelocityError<1e-10,{modes,secondsPerMode:4,samplesPerFrame:1024,amplitude:1.6,swing:1.35,maxPositionError,maxTipVelocityError,nonFinite});
const diskTotal=registry.items.reduce((s,i)=>s+fs.statSync(path.join(root,'data',i.file)).size,0);
check('all','actual-product-size-lower',diskTotal===registry.totalBytes&&diskTotal<registry.originalBytes,{productBytes:diskTotal,originalBytes:registry.originalBytes,reductionFraction:1-diskTotal/registry.originalBytes,fullyProceduralAppearance:registry.fullyProceduralAppearance});
report.passed=report.failures.length===0&&sha(fs.readFileSync(path.join(root,'data/r10/registry.json')))===report.registrySha256;report.status=report.passed?'PASS_CPU_FIELDS_PENDING_RENDER':'HOLD';
fs.writeFileSync(path.join(root,'evidence/INDEPENDENT_R10_COMPACT_FIELDS.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:report.rows.length,failures:report.failures,legacyMotion:{maxPositionError,maxTipVelocityError,nonFinite},registrySha256:report.registrySha256}));
if(!report.passed)process.exitCode=1;
