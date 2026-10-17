/** Lossless rule pixels -> glTF DataTexture bridge. No original encoded-image requests. */
import {makeRgbaPayload} from './texture-regions.mjs';
const DEFAULT_INDEX=new URL('./runtime-index.json',import.meta.url);
const INDEX_SHA='40ed78f10fd467521d7fe21be09d48265ccdf2155b82e9f895ebc15a14a94356';
const equal=(a,b,label)=>{if(a!==b)throw new Error(`TEXTURE_RULE_INTEGRITY ${label}: expected ${b}, received ${a}`);};
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
async function sha(bytes){if(!globalThis.crypto?.subtle)throw new Error('Texture rule SHA requires crypto.subtle');return hex(await crypto.subtle.digest('SHA-256',bytes));}
const json=bytes=>JSON.parse(new TextDecoder().decode(bytes));
const jsonSame=(a,b,label)=>equal(JSON.stringify(a),JSON.stringify(b),label);
const withoutUri=image=>Object.fromEntries(Object.entries(image).filter(([k])=>k!=='uri'));
async function inflate(bytes){if(typeof DecompressionStream!=='function')throw new Error('Texture rule gzip DecompressionStream unavailable');return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
function nativeBytes(payload,channels){if(channels===4)return payload.data;const out=new Uint8Array(payload.width*payload.height*3);for(let i=0;i<out.length/3;i++)out.set(payload.data.subarray(i*4,i*4+3),i*3);return out;}
async function defaultGetBytes(url,{signal,timeoutMs}){
 const ctl=new AbortController(),abort=()=>ctl.abort(signal?.reason),timer=setTimeout(()=>ctl.abort(new Error('Texture rule fetch timeout')),timeoutMs);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 try{const res=await fetch(url,{signal:ctl.signal,cache:'no-store'});if(!res.ok)throw new Error(`Texture rule HTTP ${res.status}: ${url}`);return new Uint8Array(await res.arrayBuffer());}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
/**
 * Prepare before parseAsync, so integrity failures cannot be swallowed by GLTFParser.
 * const bridge = await createGltfTextureRuleBridge(T,{model,document,gltf,getBytes});
 * loader.register(bridge.plugin); const loaded = await loader.parseAsync(...);
 * bridge.assertComplete(); // afterRoot also asserts, including otherwise-unused textures.
 * getBytes(url,{signal,timeoutMs}) may be supplied by the viewer's locked transport.
 */
export async function createGltfTextureRuleBridge(T,{model,document,gltf,getBytes=defaultGetBytes,indexURL=DEFAULT_INDEX,timeoutMs=30000,signal}={}){
 if(!T?.DataTexture||T.RGBAFormat===undefined||T.UnsignedByteType===undefined)throw new Error('Texture rule bridge requires the viewer THREE namespace');
 if(!['a4','mark3'].includes(model)||!document?.content?.images||!gltf)throw new Error('Texture rule bridge requires model, source document and glTF bridge');
 const base=new URL(indexURL,import.meta.url),c=document.content,requests=[];
 const read=async url=>{if(signal?.aborted)throw signal.reason||new Error('Texture rule bridge aborted');requests.push(String(url));const b=await getBytes(url,{signal,timeoutMs});return b instanceof Uint8Array?b:new Uint8Array(b);};
 const locked=async(record,label)=>{const bytes=await read(new URL(record.path,base));equal(bytes.length,record.bytes,`${label} bytes`);const observed=await sha(bytes);equal(observed,record.sha256,`${label} SHA`);return bytes;};
 const indexBytes=await read(base);equal(await sha(indexBytes),INDEX_SHA,'runtime index SHA');const index=json(indexBytes);
 equal(index.schema,'kaopu.texture-gpu-audit-runtime/1','runtime index schema');equal(index.records.length,4,'runtime texture count');
 await locked(index.helper,'pixel-rule implementation');
 const records=index.records.filter(r=>r.model===model).sort((a,b)=>a.imageIndex-b.imageIndex);
 equal(records.length,2,'model texture count');equal(c.images.length,records.length,'document image count');equal(gltf.images?.length,records.length,'glTF image count');
 jsonSame(gltf.textures,c.displaySkeleton.textures,'original texture definitions');jsonSame(gltf.samplers,c.displaySkeleton.samplers,'original sampler definitions');
 const report={schema:'kaopu.gltf-rule-texture-bridge/1',model,prepared:false,complete:false,originalEncodedImagesRequested:0,canvasUsed:false,reencodedImages:false,indexSHA256:INDEX_SHA,transportAccounting:{...index.transportAccounting,auditOnly:false,loadedOnlyWhenRunTextureGpuAuditIsCalled:false,loadPolicy:'Explicit createGltfTextureRuleBridge call; caller selects rule-texture mode',selectedModelResidualGzipBytes:records.reduce((n,r)=>n+r.residual.bytes,0),selectedModelRulesJsonBytes:records.reduce((n,r)=>n+r.rules.bytes,0)},fetchURLs:requests,images:[],textures:[],failures:[],limits:['Only exact flat regions are generated; explicit raster residuals remain.','Pillow pixel-domain hashes are locked. Browser GPU acceptance is a separate recorded test.','Source encoded images remain unchanged for comparison but this bridge never fetches them.']};
 const payloads=new Map();
 for(let i=0;i<records.length;i++){
  const r=records[i],im=c.images[i],gi=gltf.images[i];equal(r.imageIndex,i,'runtime image index');equal(im.index,i,'document image index');equal(im.sha256,r.source.sha256,'document source encoded SHA');equal(im.bytes,r.source.bytes,'document source encoded bytes');
  equal(r.source.path,`../generated/${model}/${im.payload}`,'document image payload');
  if(im.definition.bufferView!==undefined||gi.bufferView!==undefined)throw new Error('Texture rule bridge does not fetch embedded encoded image bufferViews');
  const sourceURL=new URL(r.source.path,base).href;
  if(![im.payload,im.definition.uri,sourceURL].includes(gi.uri))throw new Error(`TEXTURE_RULE_INTEGRITY glTF image URI ${i} is not the locked document image`);
  jsonSame(withoutUri(gi),withoutUri(im.definition),'original image metadata');
  const [rulesBytes,transport]=await Promise.all([locked(r.rules,`${r.id} rules`),locked(r.residual,`${r.id} gzip residual`)]);
  equal(r.residual.compression,'gzip','residual compression');const residual=await inflate(transport);equal(residual.length,r.residual.rawBytes,'raw residual bytes');equal(await sha(residual),r.residual.rawSha256,'raw residual SHA');
  const rule=json(rulesBytes);equal(rule.width,r.width,'rule width');equal(rule.height,r.height,'rule height');equal(rule.channels,r.sourceChannels,'rule source channels');
  equal(rule.source.name,im.payload.split('/').pop(),'rule source name');equal(rule.source.encodedSha256,im.sha256,'rule/source image identity');equal(rule.source.encodedBytes,im.bytes,'rule/source image bytes');equal(rule.uninterpretedRasterResidual.sha256,r.residual.rawSha256,'rule residual identity');equal(rule.source.decodedPixelSha256,r.decodedPixelSha256,'reference pixel identity');
  const payload=makeRgbaPayload(rule,residual),nativeSHA=await sha(nativeBytes(payload,r.sourceChannels));equal(nativeSHA,r.decodedPixelSha256,'reconstructed native pixel SHA');
  const row={id:r.id,imageIndex:i,width:payload.width,height:payload.height,sourceEncodedSHA256:im.sha256,sourceIdentityVerifiedAgainstDocument:true,encodedSourceFetched:false,rulesSHA256:r.rules.sha256,residualGzipSHA256:r.residual.sha256,residualRawSHA256:r.residual.rawSha256,nativePixelsSHA256:nativeSHA,rgbaPixelsSHA256:await sha(payload.data),pixelBytes:payload.data.length,customLoaderCalls:0,verified:true};report.images.push(row);payloads.set(i,{payload,row});
 }
 for(const [i,t]of(gltf.textures||[]).entries()){
  if(!payloads.has(t.source))throw new Error(`Texture ${i} has no locked rule image`);
  for(const extension of ['KHR_texture_basisu','EXT_texture_webp','EXT_texture_avif'])if(t.extensions?.[extension])throw new Error(`Texture ${i} overrides its locked source through ${extension}`);
 }
 const snapshot={images:structuredClone(gltf.images),textures:structuredClone(gltf.textures||[]),samplers:structuredClone(gltf.samplers)};
 let parserInstance=null;
 const seen=new Set(),errors=[];
 const fail=error=>{const e=error instanceof Error?error:new Error(String(error));if(!errors.includes(e)){errors.push(e);report.failures.push(e.message);}return e;};
 function assertComplete(){if(errors.length)throw errors[0];if(!report.complete)throw new Error('Texture rule parse has not completed its texture dependency checks');return report;}
 function plugin(parser){
  if(parserInstance&&parserInstance!==parser)throw new Error('Create one texture rule bridge per GLTF parse');parserInstance=parser;
  jsonSame(parser.json.images,snapshot.images,'parser image definitions');jsonSame(parser.json.textures||[],snapshot.textures,'parser texture definitions');jsonSame(parser.json.samplers,snapshot.samplers,'parser sampler definitions');
  return {name:'KAOPU_exact_rule_textures',
   loadTexture(textureIndex){
    const def=parser.json.textures[textureIndex],sourceIndex=def?.source,entry=payloads.get(sourceIndex);
    if(!entry)return Promise.reject(fail(new Error(`Missing locked texture source ${textureIndex}/${sourceIndex}`)));
    const loader={isImageBitmapLoader:false,load(_url,onLoad,_onProgress,onError){
     try{
      // Deliberately do not request _url: the original image is only parser identity metadata.
      const {payload,row}=entry,texture=new T.DataTexture(payload.data,payload.width,payload.height,T.RGBAFormat,T.UnsignedByteType);
      texture.flipY=false;texture.premultiplyAlpha=false;texture.unpackAlignment=1;
      if(T.NoColorSpace!==undefined)texture.colorSpace=T.NoColorSpace;
      texture.userData.exactTextureRule={model,imageIndex:sourceIndex,rgbaSHA256:row.rgbaPixelsSHA256,rulesSHA256:row.rulesSHA256};texture.needsUpdate=true;row.customLoaderCalls++;onLoad(texture);
     }catch(error){const e=fail(error);if(onError)onError(e);else throw e;}
    }};
    let pending;try{pending=parser.loadTextureImage(textureIndex,sourceIndex,loader);}catch(error){return Promise.reject(fail(error));}
    return Promise.resolve(pending).then(texture=>{
     // GLTFParser.loadTextureImage catches failures and returns null. Never accept that.
     if(!texture)throw fail(errors[0]||new Error(`GLTFParser swallowed texture load failure ${textureIndex}`));
     if(!texture.isDataTexture||texture.image?.data!==entry.payload.data)throw fail(new Error(`Texture ${textureIndex} bypassed locked RGBA DataTexture upload`));
     if(texture.flipY!==false||texture.premultiplyAlpha!==false)throw fail(new Error(`Texture ${textureIndex} changed alpha/orientation upload semantics`));
     if(!seen.has(textureIndex)){seen.add(textureIndex);report.textures.push({textureIndex,imageIndex:sourceIndex,isDataTexture:true,flipY:texture.flipY,premultiplyAlpha:texture.premultiplyAlpha,magFilter:texture.magFilter,minFilter:texture.minFilter,wrapS:texture.wrapS,wrapT:texture.wrapT,generateMipmaps:texture.generateMipmaps});}
     return texture;
    }).catch(error=>{throw fail(error);});
   },
   async afterRoot(){await parser.getDependencies('texture');if(errors.length)throw errors[0];equal(seen.size,snapshot.textures.length,'loaded glTF texture count');report.prepared=true;report.complete=true;assertComplete();}
  };
 }
 report.prepared=true;
 return {plugin,report,assertComplete,register(loader){loader.register(plugin);return loader;}};
}
