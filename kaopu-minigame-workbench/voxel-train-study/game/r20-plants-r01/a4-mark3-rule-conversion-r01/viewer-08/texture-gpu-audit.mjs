/**
 * Isolated texture-domain audit. This module never mutates the viewer, its renderer,
 * a material, an existing texture, or the source-exact acceptance state.
 *
 * Source: encoded bytes -> ImageBitmap(none/none/none) -> RGBA8 texture.
 * Rule: exact flat regions + explicit raster residual -> unpremultiplied RGBA bytes
 *       -> RGBA8 texture (the upload domain of an RGBA UnsignedByte DataTexture).
 * Both: NEAREST sample at texel centers -> RGBA8 FBO -> readPixels(RGBA, UBYTE).
 * No Canvas2D, blending, premultiplication, sRGB texture decode, or output transfer.
 */
import {makeRgbaPayload, comparePixelBytes} from '../texture-rules/texture-regions.mjs';

const INDEX_URL = new URL('../texture-rules/runtime-index.json', import.meta.url);
const INDEX_SHA256 = '40ed78f10fd467521d7fe21be09d48265ccdf2155b82e9f895ebc15a14a94356';
const EXPECTED = Object.freeze([
  {id:'a4-0', model:'a4', imageIndex:0, format:'PNG', width:512, height:512},
  {id:'a4-1', model:'a4', imageIndex:1, format:'PNG', width:1024, height:2048},
  {id:'mark3-0', model:'mark3', imageIndex:0, format:'JPEG', width:256, height:256},
  {id:'mark3-1', model:'mark3', imageIndex:1, format:'JPEG', width:512, height:512},
]);
const BITMAP_OPTIONS = Object.freeze({premultiplyAlpha:'none', colorSpaceConversion:'none', imageOrientation:'none'});
const message = error => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 requires crypto.subtle (HTTPS or localhost).');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,'0')).join('');
}
function equal(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}
async function fetchBytes(url, timeoutMs, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason ?? new Error('Audit aborted'));
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, {once:true});
  const timer = setTimeout(() => controller.abort(new Error(`Fetch timeout: ${url}`)), timeoutMs);
  try {
    const response = await fetch(url, {signal:controller.signal, cache:'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
  }
}
function decodeBitmap(blob, timeoutMs, signal) {
  if (typeof createImageBitmap !== 'function') return Promise.reject(new Error('createImageBitmap is unavailable.'));
  return new Promise((resolve,reject) => {
    let settled = false;
    const cleanup = () => {clearTimeout(timer); signal?.removeEventListener('abort', abort);};
    const fail = error => {if (!settled) {settled=true; cleanup(); reject(error);}};
    const abort = () => fail(new Error('Bitmap decode aborted.'));
    const timer = setTimeout(() => fail(new Error('ImageBitmap decode timeout.')), timeoutMs);
    if (signal?.aborted) {abort(); return;}
    signal?.addEventListener('abort', abort, {once:true});
    createImageBitmap(blob, BITMAP_OPTIONS).then(bitmap => {
      if (settled) {bitmap.close(); return;}
      settled=true; cleanup(); resolve(bitmap);
    },fail);
  });
}
async function decompressGzip(bytes) {
  if(typeof DecompressionStream!=='function') throw new Error('Gzip DecompressionStream is unavailable; audit residual transport cannot be decoded.');
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function nativePixelsFromRgba(payload, channels) {
  if (channels === 4) return payload.data;
  if (channels !== 3) throw new Error(`Unsupported reference channel count: ${channels}`);
  const pixels = payload.width * payload.height, rgb = new Uint8Array(pixels * 3);
  for (let p=0; p<pixels; p++) rgb.set(payload.data.subarray(p*4,p*4+3),p*3);
  return rgb;
}
function differenceDetails(source, candidate, width) {
  const difference = comparePixelBytes(source,candidate,4), examples=[];
  let sourceTransparentPixels=0, candidateTransparentPixels=0, sourceTransparentNonzeroRgbPixels=0,
    candidateTransparentNonzeroRgbPixels=0, changedRgbAtBothTransparentPixels=0;
  for (let at=0; at<source.length; at+=4) {
    const sa=source[at+3], ca=candidate[at+3];
    if (sa===0) {sourceTransparentPixels++; if(source[at]||source[at+1]||source[at+2]) sourceTransparentNonzeroRgbPixels++;}
    if (ca===0) {candidateTransparentPixels++; if(candidate[at]||candidate[at+1]||candidate[at+2]) candidateTransparentNonzeroRgbPixels++;}
    const rgbChanged=source[at]!==candidate[at]||source[at+1]!==candidate[at+1]||source[at+2]!==candidate[at+2];
    if (sa===0 && ca===0 && rgbChanged) changedRgbAtBothTransparentPixels++;
    if ((rgbChanged||sa!==ca) && examples.length<8) {
      const p=at/4; examples.push({x:p%width, uploadedRow:Math.floor(p/width), sourceRGBA:Array.from(source.subarray(at,at+4)), ruleRGBA:Array.from(candidate.subarray(at,at+4))});
    }
  }
  return {...difference, transparentRgb:{sourceTransparentPixels,candidateTransparentPixels,sourceTransparentNonzeroRgbPixels,candidateTransparentNonzeroRgbPixels,changedRgbAtBothTransparentPixels}, firstDifferences:examples};
}
function glCheck(gl, stage) {
  const errors=[]; let error;
  while ((error=gl.getError())!==gl.NO_ERROR && errors.length<16) errors.push(`0x${error.toString(16)}`);
  if (errors.length || gl.isContextLost()) throw new Error(`WebGL ${stage}: ${errors.join(',') || 'context lost'}`);
}
function makeGpuProbe() {
  const canvas=typeof OffscreenCanvas==='function' ? new OffscreenCanvas(1,1) :
    typeof document!=='undefined' ? Object.assign(document.createElement('canvas'),{width:1,height:1}) : null;
  if (!canvas) throw new Error('No offscreen WebGL canvas is available.');
  // This is a new, unmounted canvas. No Canvas2D context is ever requested.
  const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'});
  if (!gl) throw new Error('WebGL2 is unavailable; GPU sampling equivalence is unverified.');
  let program=null, vao=null;
  function shader(type,source) {
    const shader=gl.createShader(type); if(!shader) throw new Error('createShader failed.');
    gl.shaderSource(shader,source); gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(`Audit shader: ${log}`);}
    return shader;
  }
  try {
    const vs=shader(gl.VERTEX_SHADER,`#version 300 es
      precision highp float;
      void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`);
    let fs;
    try {fs=shader(gl.FRAGMENT_SHADER,`#version 300 es
      precision highp float;
      precision highp int;
      uniform highp sampler2D uTexture;
      uniform vec2 uSize;
      out vec4 sampled;
      void main(){sampled=texture(uTexture,gl_FragCoord.xy/uSize);}`);}
    catch(error){gl.deleteShader(vs);throw error;}
    program=gl.createProgram(); if(!program){gl.deleteShader(vs);gl.deleteShader(fs);throw new Error('createProgram failed.');}
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(`Audit program: ${gl.getProgramInfoLog(program)}`);
    vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program,'uTexture'),0);
    gl.disable(gl.BLEND);gl.disable(gl.DITHER);gl.disable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.CULL_FACE);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);gl.disable(gl.SAMPLE_COVERAGE);
    gl.colorMask(true,true,true,true);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.pixelStorei(gl.PACK_ALIGNMENT,1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH,0);gl.pixelStorei(gl.UNPACK_SKIP_ROWS,0);gl.pixelStorei(gl.UNPACK_SKIP_PIXELS,0);
    const maximumTextureSize=gl.getParameter(gl.MAX_TEXTURE_SIZE), maximumViewport=Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS));
    glCheck(gl,'initialization');
    const info={version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),renderer:gl.getParameter(gl.RENDERER),maximumTextureSize,maximumViewport,fragmentHighpPrecision:gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)?.precision??null,contextAttributes:gl.getContextAttributes(),canvasKind:canvas.constructor.name,internalFormat:'RGBA8 (linear UNORM bytes; no sRGB decode/encode)',filter:'NEAREST',target:'RGBA8 framebuffer COLOR_ATTACHMENT0',readback:'RGBA/UNSIGNED_BYTE; uploaded row 0 is returned first',blending:false,dithering:false,canvas2DUsed:false};
    function sample(input,width,height) {
      if(width>maximumTextureSize||height>maximumTextureSize||width>maximumViewport[0]||height>maximumViewport[1])throw new Error(`Texture ${width}x${height} exceeds GPU limits.`);
      const texture=gl.createTexture(),target=gl.createTexture(),framebuffer=gl.createFramebuffer();
      if(!texture||!target||!framebuffer)throw new Error('GPU resource allocation failed.');
      const setupTexture=tex=>{gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);};
      try {
        gl.activeTexture(gl.TEXTURE0);setupTexture(texture);
        if(input instanceof Uint8Array){equal(input.length,width*height*4,'RGBA upload byte count');gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,input);}
        else {gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,input);}
        glCheck(gl,'source texImage2D');
        setupTexture(target);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);
        equal(gl.checkFramebufferStatus(gl.FRAMEBUFFER),gl.FRAMEBUFFER_COMPLETE,'RGBA8 framebuffer status');
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.viewport(0,0,width,height);
        gl.useProgram(program);gl.bindVertexArray(vao);gl.uniform2f(gl.getUniformLocation(program,'uSize'),width,height);
        gl.bindTexture(gl.TEXTURE_2D,texture);gl.drawArrays(gl.TRIANGLES,0,3);
        const output=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,output);glCheck(gl,'nearest sampling/readPixels');
        return output;
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);
        gl.deleteFramebuffer(framebuffer);gl.deleteTexture(texture);gl.deleteTexture(target);
      }
    }
    return {info,sample,dispose(){gl.deleteVertexArray(vao);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
  } catch(error) {
    if(vao)gl.deleteVertexArray(vao);if(program)gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();throw error;
  }
}

/**
 * @param {{timeoutMs?:number, signal?:AbortSignal}} options
 * @returns {Promise<object>} Four items always returned. Mismatch/error/unavailable
 * results are evidence only; they never reject or disable existing source mode.
 */
export async function runTextureGpuAudit({timeoutMs=30000,signal}={}) {
  timeoutMs=Number.isFinite(timeoutMs)?Math.max(1000,Math.min(120000,timeoutMs)):30000;
  const startedAt=new Date().toISOString(),started=now();let gpu=null,gpuError=null,index=null;
  const report={schema:'kaopu.texture-gpu-upload-audit/1',startedAt,status:'running',sourceModePreserved:true,sourceModeCanRemainExact:true,candidateRuleTexturesEnabled:false,changesToViewer:[],decodeContract:{source:'Original encoded Blob -> createImageBitmap -> direct texImage2D (never Canvas2D)',imageBitmapOptions:{...BITMAP_OPTIONS},rule:'makeRgbaPayload -> RGBA Uint8Array -> texImage2D (RGBA UnsignedByte DataTexture-equivalent)',pixelStore:{premultiplyAlpha:false,flipY:false,colorSpaceConversion:'NONE',unpackAlignment:1},sampling:'texel-center NEAREST -> linear RGBA8 FBO -> RGBA/UNSIGNED_BYTE readPixels',colorConversion:'none in either upload/sampling path; this is not a PBR/sRGB material acceptance test'},runtime:{indexURL:INDEX_URL.href,indexExpectedSHA256:INDEX_SHA256},items:[]};
  try {
    const indexBytes=await fetchBytes(INDEX_URL,timeoutMs,signal);report.runtime.indexObservedSHA256=await sha256(indexBytes);
    equal(report.runtime.indexObservedSHA256,INDEX_SHA256,'Runtime index SHA-256');index=JSON.parse(new TextDecoder().decode(indexBytes));
    equal(index.schema,'kaopu.texture-gpu-audit-runtime/1','Runtime index schema');equal(index.records.length,EXPECTED.length,'Texture record count');report.runtime.transportAccounting=index.transportAccounting;
    for(let i=0;i<EXPECTED.length;i++)equal(index.records[i].id,EXPECTED[i].id,'Texture record identity');
    const helperBytes=await fetchBytes(new URL(index.helper.path,INDEX_URL),timeoutMs,signal);report.runtime.helperSHA256=await sha256(helperBytes);equal(report.runtime.helperSHA256,index.helper.sha256,'Pixel rule helper SHA-256');
    try{gpu=makeGpuProbe();report.gpu=gpu.info;}catch(error){gpuError=message(error);report.gpu={available:false,error:gpuError};}
    for(const spec of index.records){
      const at=now(),item={id:spec.id,model:spec.model,imageIndex:spec.imageIndex,format:spec.format,status:'running',width:spec.width,height:spec.height,sourceChannels:spec.sourceChannels,sourceSHA256:{expected:spec.source.sha256,observed:null,verified:false},rulesSHA256:{expected:spec.rules.sha256,observed:null,verified:false},residualTransportSHA256:{expected:spec.residual.sha256,observed:null,verified:false},residualSHA256:{expected:spec.residual.rawSha256,observed:null,verified:false},residualTransport:{compression:'gzip',encodedBytes:spec.residual.bytes,rawBytes:spec.residual.rawBytes},decode:{ruleReferenceDecoder:spec.referenceDecoder,imageBitmapOptions:{...BITMAP_OPTIONS}},difference:null,sourceModeUnaffected:true};let bitmap=null;
      report.items.push(item);
      try {
        const [sourceBytes,ruleBytes,residualTransportBytes]=await Promise.all([fetchBytes(new URL(spec.source.path,INDEX_URL),timeoutMs,signal),fetchBytes(new URL(spec.rules.path,INDEX_URL),timeoutMs,signal),fetchBytes(new URL(spec.residual.path,INDEX_URL),timeoutMs,signal)]);
        for(const[record,bytes,expected,label]of[[item.sourceSHA256,sourceBytes,spec.source,'Source encoded'],[item.rulesSHA256,ruleBytes,spec.rules,'Texture rules'],[item.residualTransportSHA256,residualTransportBytes,spec.residual,'Gzip raster residual transport']]){record.observed=await sha256(bytes);equal(bytes.length,expected.bytes,`${label} byte count`);equal(record.observed,expected.sha256,`${label} SHA-256`);record.verified=true;}
        equal(spec.residual.compression,'gzip','Raster residual compression');
        const residualBytes=await decompressGzip(residualTransportBytes);item.residualSHA256.observed=await sha256(residualBytes);equal(residualBytes.length,spec.residual.rawBytes,'Expanded raster residual byte count');equal(item.residualSHA256.observed,spec.residual.rawSha256,'Expanded raster residual SHA-256');item.residualSHA256.verified=true;
        const rules=JSON.parse(new TextDecoder().decode(ruleBytes));equal(rules.width,spec.width,'Rule width');equal(rules.height,spec.height,'Rule height');equal(rules.channels,spec.sourceChannels,'Rule channels');equal(rules.source.encodedSha256,spec.source.sha256,'Rule source identity');equal(rules.uninterpretedRasterResidual.sha256,spec.residual.rawSha256,'Rule residual identity');
        const payload=makeRgbaPayload(rules,residualBytes),native=nativePixelsFromRgba(payload,rules.channels),nativeSHA=await sha256(native);
        equal(nativeSHA,spec.decodedPixelSha256,'Reconstructed reference-domain pixel SHA-256');
        item.decode.rulePixels={referenceDecodedPixelSHA256:spec.decodedPixelSha256,reconstructedDecodedPixelSHA256:nativeSHA,referenceDomainExact:true,reconstructedRgbaSHA256:await sha256(payload.data),width:payload.width,height:payload.height,channels:4,unpremultiplied:true,rowOrder:payload.rowOrder,decoderDomain:payload.decoder};
        if(!gpu){item.status='unavailable';item.error=gpuError;item.decode.browserSource='not GPU-tested';continue;}
        if(typeof createImageBitmap!=='function'){item.status='unavailable';item.error='createImageBitmap is unavailable; no alternate Canvas decode was used.';continue;}
        bitmap=await decodeBitmap(new Blob([sourceBytes],{type:spec.format==='JPEG'?'image/jpeg':'image/png'}),timeoutMs,signal);
        item.decode.browserSource={path:'ImageBitmap -> direct WebGL2 texImage2D',width:bitmap.width,height:bitmap.height,options:{...BITMAP_OPTIONS}};
        equal(bitmap.width,payload.width,'Browser/rule image width');equal(bitmap.height,payload.height,'Browser/rule image height');
        const sourceSample=gpu.sample(bitmap,payload.width,payload.height),ruleSample=gpu.sample(payload.data,payload.width,payload.height);
        item.gpuSampleSHA256={source:await sha256(sourceSample),rule:await sha256(ruleSample)};
        item.ruleUploadRoundTrip=comparePixelBytes(payload.data,ruleSample,4);item.difference=differenceDetails(sourceSample,ruleSample,payload.width);
        if(!item.ruleUploadRoundTrip.exact){item.status='error';item.classification='rule-byte-upload-or-sampling-difference';item.error='The RGBA byte upload did not round-trip exactly; source-versus-rule differences are not attributable to image decoding alone.';}
        else if(item.difference.exact){item.status='pass';item.classification='browser-gpu-rgba-exact';}
        else {item.status='mismatch';item.classification=spec.format==='JPEG'?'jpeg-decode-domain-difference-possible':'png-imagebitmap-upload-domain-difference';item.note=spec.format==='JPEG'?'This browser ImageBitmap path differs from the recorded Pillow/libjpeg pixel domain. Platform JPEG decoding is a possible cause; exact browser GPU equivalence has not passed. Original encoded source mode remains unchanged.':'PNG direct ImageBitmap upload differs from the exact reconstructed RGBA bytes. Transparent RGB, browser decoding, or ImageBitmap upload behavior must be inspected; no approximate match is accepted.';}
      } catch(error){item.status=signal?.aborted?'aborted':'error';item.error=message(error);}
      finally {bitmap?.close();item.durationMs=now()-at;}
    }
  } catch(error) {
    report.error=message(error);
    for(const spec of EXPECTED)if(!report.items.some(item=>item.id===spec.id))report.items.push({...spec,status:signal?.aborted?'aborted':'error',error:report.error,sourceSHA256:{observed:null,verified:false},rulesSHA256:{observed:null,verified:false},decode:{verified:false},difference:null,sourceModeUnaffected:true});
  } finally {gpu?.dispose();}
  report.allFourGpuExact=report.items.length===4&&report.items.every(item=>item.status==='pass');
  report.summary=report.items.reduce((s,item)=>(s[item.status]=(s[item.status]||0)+1,s),{});
  report.status=report.allFourGpuExact?'pass':report.items.some(item=>item.status==='error'||item.status==='aborted')?'error':report.items.some(item=>item.status==='mismatch')?'mismatch':'unavailable';
  report.finishedAt=new Date().toISOString();report.durationMs=now()-started;
  return report;
}
