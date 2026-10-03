import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {MeshoptSimplifier} from 'meshoptimizer';
import {readLegacySource} from './legacy-oral-source-r04.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const codecText=fs.readFileSync(path.join(root,'src/source-codec-r07.js'),'utf8');
const {decodeSourceR07}=await import('data:text/javascript;base64,'+Buffer.from(codecText).toString('base64'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),asBytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const dir=path.join(root,'data/r10');fs.mkdirSync(dir,{recursive:true});
const legacyOnly=process.argv.includes('--legacy-only');
const previous=legacyOnly?JSON.parse(fs.readFileSync(path.join(dir,'registry.json'))):null;
const adoptedLegacy=legacyOnly?zlib.gunzipSync(fs.readFileSync(path.join(dir,'barracuda.fcp10.gz'))):null;
const adoptedHeader=adoptedLegacy?JSON.parse(adoptedLegacy.subarray(16,16+adoptedLegacy.readUInt32LE(8)).toString()):null;
const adoptedBegin=adoptedLegacy?Math.ceil((16+adoptedLegacy.readUInt32LE(8))/8)*8:0;
await MeshoptSimplifier.ready;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
await page.goto('about:blank');
async function imageProduct(bytes,mime,role){
 const result=await page.evaluate(async({base64,mime,role})=>{
  const s=atob(base64),b=Uint8Array.from(s,c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([b],{type:mime}),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(bitmap,0,0);bitmap.close();const before=c.getImageData(0,0,canvas.width,canvas.height).data;
  let blob=await canvas.convertToBlob({type:'image/webp',quality:.98}),image=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'});c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0);image.close();let after=c.getImageData(0,0,canvas.width,canvas.height).data;
  let firstError=0,firstMax=0;for(let i=0;i<before.length;i++)if(i%4!==3){const d=before[i]-after[i];firstError+=d*d;firstMax=Math.max(firstMax,Math.abs(d));}
  const firstPsnr=firstError?10*Math.log10(255*255/(firstError/(before.length/4*3))):999;
  let method='WEBP_FIDELITY_CHECKED';
  if(firstPsnr<(role==='normal'?44:38)||firstMax>(role==='normal'?8:32)||blob.size>=b.length){
   // Bound each channel error directly instead of accepting chroma-subsampling damage.
   // The retained alpha is exact. No image resizing, invented texture or normal-map replacement.
   const step=role==='normal'?4:8,quant=new Uint8ClampedArray(before.length);
   for(let i=0;i<before.length;i++)quant[i]=i%4===3?before[i]:Math.min(255,Math.round(before[i]/step)*step);
   c.putImageData(new ImageData(quant,canvas.width,canvas.height),0,0);
   blob=await canvas.convertToBlob({type:'image/webp',quality:1});image=await createImageBitmap(blob,{colorSpaceConversion:'none',premultiplyAlpha:'none'});c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0);image.close();after=c.getImageData(0,0,canvas.width,canvas.height).data;
   method='BOUNDED_CHANNEL_QUANTIZATION_LOSSLESS_WEBP';
  }
  let error=0,max=0,alphaMax=0;for(let i=0;i<before.length;i++){const d=Math.abs(before[i]-after[i]);if(i%4===3)alphaMax=Math.max(alphaMax,d);else{error+=d*d;max=Math.max(max,d);}}
  const mse=error/(before.length/4*3),psnr=mse?10*Math.log10(255*255/mse):999;
  const encoded=new Uint8Array(await blob.arrayBuffer());let out='';for(let o=0;o<encoded.length;o+=24576)out+=btoa(String.fromCharCode(...encoded.subarray(o,o+24576)));
  return {base64:out,width:canvas.width,height:canvas.height,psnr,max,alphaMax,role,method};
 },{base64:bytes.toString('base64'),mime,role});
 const product=Buffer.from(result.base64,'base64');delete result.base64;
 // No dimension reduction. Reject re-encoding that exceeds measured fidelity bounds.
 const accepted=result.psnr>=(role==='normal'?44:38)&&result.alphaMax===0;
 if(!accepted)throw Error('Texture fit exceeded error bounds '+JSON.stringify(result));
 return {bytes:product,mime:'image/webp',proof:{...result,accepted,originalBytes:bytes.length,productBytes:product.length}};
}
function pack(magic,header,streams,images){
 let offset=0;const chunks=[],blocks=[];
 for(const s of streams){const padding=(8-offset%8)%8;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}const b=asBytes(s.values);blocks.push({...s,values:undefined,offset,bytes:b.length,length:s.values.length});chunks.push(b);offset+=b.length;}
 const imageRecords=[];for(const im of images){imageRecords.push({...im,bytes:undefined,offset,length:im.bytes.length});chunks.push(im.bytes);offset+=im.bytes.length;}
 const head=Buffer.from(JSON.stringify({...header,blocks,images:imageRecords})),prefix=Buffer.alloc(16);prefix.write(magic);prefix.writeUInt32LE(1,4);prefix.writeUInt32LE(head.length,8);prefix.writeUInt32LE(offset,12);const pad=Buffer.alloc((8-(16+head.length)%8)%8);
 return zlib.gzipSync(Buffer.concat([prefix,head,pad,...chunks]),{level:9});
}
const items=[];
try{
 const legacy=JSON.parse(fs.readFileSync(path.join(root,'data/r07/legacy-registry.json'))),{h,sourceProof}=await readLegacySource();
 const attrs=new Float32Array(h.positions.length/3*20),locks=new Uint8Array(h.positions.length/3),N=locks.length;
 for(let i=0;i<N;i++){
  const j=i*20;attrs[j]=h.uv[i*2]/65535;attrs[j+1]=h.uv[i*2+1]/65535;attrs[j+2]=h.normalOct[i*2]/32767;attrs[j+3]=h.normalOct[i*2+1]/32767;
  for(let k=0;k<12;k++)attrs[j+4+k]=h.weights[i*12+k]/255;
  attrs[j+16]=h.partInfo[i*2+1]/65535;for(let k=0;k<3;k++)attrs[j+17+k]=h.partRoot[i*3+k];
  // Eye socket and source cranial controls are protected. Border lock preserves thin fins and seams.
  if(h.weights[i*12+4]>0||h.weights[i*12+2]>0||h.weights[i*12+3]>0)locks[i]=1;
 }
 // Render ablation proved UV/normal interpolation, rather than texture coding,
 // caused the first candidate's body highlights to change. Protect these fields
 // strongly enough for the retained 4096px texture; do not relax the visual gate.
 const weights=[8,8,1,1,...Array(12).fill(.25),.25,.2,.2,.2];
 locks[h.metadata.continuum.axialGait.caudalTipVertex]=1;
 const [indices,error]=MeshoptSimplifier.simplifyWithAttributes(h.indices,h.positions,3,attrs,20,weights,locks,100000*3,.0001,['LockBorder']);
 const [remap,count]=MeshoptSimplifier.compactMesh(indices),fields={positions:3,normalOct:2,uv:2,weights:12,partInfo:2,partRoot:3},streams=[],products={};
 for(const [field,stride] of Object.entries(fields)){const a=h[field],v=new a.constructor(count*stride);for(let i=0;i<N;i++)if(remap[i]!==0xffffffff)v.set(a.subarray(i*stride,(i+1)*stride),remap[i]*stride);products[field]=v;streams.push({field,type:a.constructor.name,values:v});}
 streams.push({field:'indices',type:'Uint32Array',values:indices});
 const meta=structuredClone(h.metadata);meta.counts={...meta.counts,vertices:count,triangles:indices.length/3};
 const oldTip=meta.continuum.axialGait.caudalTipVertex;if(remap[oldTip]===0xffffffff)throw Error('Protected tail diagnostic point removed');meta.continuum.axialGait.caudalTipVertex=remap[oldTip];
 const images=[];for(const [field,mime] of [['base','image/jpeg'],['normal',meta.package.normalMime],['rm','image/jpeg']]){if(adoptedHeader){const im=adoptedHeader.images.find(i=>i.field===field);images.push({...im,bytes:Buffer.from(adoptedLegacy.subarray(adoptedBegin+im.offset,adoptedBegin+im.offset+im.length))});}else{const p=await imageProduct(Buffer.from(h.textures[field]),mime,field==='normal'?'normal':'color');images.push({field,mime:p.mime,bytes:p.bytes,proof:p.proof});}}
 meta.package={...meta.package,chunks:undefined,normalMime:images.find(i=>i.field==='normal').mime,baseMime:images.find(i=>i.field==='base').mime,rmMime:images.find(i=>i.field==='rm').mime};
 meta.surface={...meta.surface,method:'OFFLINE_ATTRIBUTE_CONSTRAINED_COMPACT_PRODUCT',originalSurfaceAtRuntime:false,originalChartResidualAtRuntime:false,compactErrorNormalized:error};
 const compressed=pack('FCP0',{schema:'FISH_COMPACT_LEGACY_10',metadata:meta},streams,images),file='barracuda.fcp10.gz';fs.writeFileSync(path.join(dir,file),compressed);
 items.push({id:'barracuda',file:'r10/'+file,bytes:compressed.length,sha256:sha(compressed),format:'FCP10_LEGACY_GZIP',originalBytes:legacy.bytes,vertices:count,triangles:indices.length/3,originalVertices:N,originalTriangles:h.indices.length/3,errorNormalized:error,originalSourceOnlyOffline:true,sourceProof,images:images.map(i=>({field:i.field,mime:i.mime,...i.proof}))});console.log(JSON.stringify(items.at(-1)));
 const registry=JSON.parse(fs.readFileSync(path.join(root,'data/r07/registry.json')));
 for(const item of legacyOnly?[]:registry.items){
  const decoded=decodeSourceR07(zlib.gunzipSync(fs.readFileSync(path.join(root,'data',item.file))),'FSP7_GZIP'),score=decoded.score,streams=[],images=[];
  // Existing five sources are already small meshes. Keep rest shape/rig exactly; discard redundant source chart/base/residual after adopting.
  for(let pi=0;pi<score.primitives.length;pi++){const p=score.primitives[pi];for(const field of ['positions','normals','uvs','indices','finId','finWeight','finGradient']){const a=p[field];streams.push({primitive:pi,field,type:a.constructor.name,values:a});delete p[field];}delete p.base;delete p.paramAddress;delete p.residual;}
  const normalIds=new Set(score.materials.map(m=>m.normalTexture?.index).filter(i=>i!==undefined));
  for(const old of decoded.images){const im=score.textures[old.texture],p=await imageProduct(Buffer.from(old.encodedBytes),im.mimeType,normalIds.has(old.texture)?'normal':'color');im.mimeType=p.mime;im.uri=null;im.sourceOriginalEncodedSha256=im.sourceSha256;delete im.sourceSha256;im.sha256=sha(p.bytes);im.bytes=p.bytes.length;im.losslessPixelVerified=false;im.productApproximation=p.proof;images.push({texture:old.texture,mime:p.mime,bytes:p.bytes,proof:p.proof});}
  score.schema='FISH_COMPACT_PRODUCT_10';score.parameterization={method:'OFFLINE_ADOPTED_REST_SURFACE',sourceChartsAtRuntime:false};
  const compressed=pack('FCP1',{schema:'FISH_COMPACT_PRODUCT_10',score},streams,images),file=item.id+'.fcp10.gz';fs.writeFileSync(path.join(dir,file),compressed);
  items.push({id:item.id,label:item.label,file:'r10/'+file,metadataFile:item.metadataFile,bytes:compressed.length,sha256:sha(compressed),format:'FCP10_GZIP',originalBytes:item.bytes,vertices:item.vertices,triangles:item.triangles,restGeometryBitIdentical:true,originalSourceOnlyOffline:true,images:images.map(i=>({texture:i.texture,mime:i.mime,...i.proof}))});console.log(JSON.stringify(items.at(-1)));
 }
 if(previous)items.push(...previous.items.filter(i=>i.id!=='barracuda'));
 const receipt={taskId:'FISH_COMPACT_RUNTIME_R10_20261003',builtAt:new Date().toISOString(),items,totalBytes:items.reduce((s,i)=>s+i.bytes,0),originalBytes:items.reduce((s,i)=>s+i.originalBytes,0),fullSourceRuntime:false,fullyProceduralAppearance:false,visualAcceptance:false,productionReady:false};fs.writeFileSync(path.join(dir,'registry.json'),JSON.stringify(receipt,null,2)+'\n');
}finally{await browser.close();}
