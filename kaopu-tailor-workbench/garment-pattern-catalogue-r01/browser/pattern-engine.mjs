/** Composable live pattern engine. Run inside the owning cloth worker.
 * Import creates no worker and downloads no Python runtime.
 * Terminate the owning worker to release Python/WASM memory.
 */
const DEFAULT_BASE=new URL('./',import.meta.url);
let runtimeOwner=null;
const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
export function createPatternEngine(){
 const owner={};let runtime,initialization,lockedBase,manifest,progress=()=>{},queue=Promise.resolve(),phase='idle',fatalError;
 const originalFetch=globalThis.fetch.bind(globalThis);
 const emit=message=>{try{progress(message);}catch{/* A progress observer must not change pattern generation. */}};
 async function checkedFetch(url,sha){const r=await originalFetch(url);if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);const data=await r.arrayBuffer();if(sha&&await sha256(data)!==sha)throw Error(`Integrity check failed: ${url}`);return data;}
 function initFailure(error){phase='failed';const e=Error('Pattern runtime initialization failed; restart its owning worker: '+String(error.message||error));e.name='PatternRuntimeInitializationError';e.fatal=true;fatalError=e;return e;}
 async function initialize(config){
  if(fatalError)throw fatalError;
  const base=new URL(config.assetBase||DEFAULT_BASE.href,DEFAULT_BASE);
  if(lockedBase&&lockedBase!==base.href)throw Error('Changing pattern assetBase requires a fresh owning worker');
  if(initialization)return initialization;
  if(runtimeOwner&&runtimeOwner!==owner)throw Error('Only one pattern engine may own a Python runtime per worker; reuse its generate function');
  if(typeof document==='object')throw Error('Pattern generation must run in the cloth worker, not the window thread');
  runtimeOwner=owner;lockedBase=base.href;phase='initializing';
  initialization=(async()=>{
   const start=performance.now(),runtimeBase=new URL('vendor/pyodide/',base).href;
   const mr=await originalFetch(new URL('runtime-manifest.json',base));if(!mr.ok)throw Error('Runtime manifest unavailable');manifest=await mr.json();
   if(typeof DecompressionStream==='undefined')throw Error('gzip DecompressionStream support is required');
   const transportFetch=async(input,init)=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    if(url&&url.startsWith(runtimeBase)){
     const name=url.slice(runtimeBase.length),entry=manifest.files[name];
     if(entry){let compressed;
      if(entry.compressedParts){const parts=await Promise.all(entry.compressedParts.map(p=>checkedFetch(runtimeBase+p.file,p.sha256)));compressed=new Blob(parts).stream();}
      else{const {integrity:decodedWheelIntegrity,...transportInit}=init||{};const r=await originalFetch(runtimeBase+entry.compressed,transportInit);if(!r.ok)throw Error(`Runtime download failed ${name}: ${r.status}`);compressed=r.body;}
      const decoded=await new Response(compressed.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      if(await sha256(decoded)!==entry.sha256)throw Error(`Runtime integrity failed: ${name}`);
      return new Response(decoded,{headers:{'Content-Type':name.endsWith('.wasm')?'application/wasm':name.endsWith('.json')?'application/json':'application/octet-stream'}});
     }
    }
    return originalFetch(input,init);
   };
   const priorFetch=globalThis.fetch;globalThis.fetch=transportFetch;
   try{
    const {loadPyodide}=await import(runtimeBase+'pyodide.mjs');
    runtime=await loadPyodide({indexURL:runtimeBase,stdout:()=>{},stderr:message=>emit({type:'log',level:'warning',message})});
    const packageErrors=[];
    await runtime.loadPackage(['numpy','scipy','pyyaml'],{checkIntegrity:true,messageCallback:message=>emit({type:'log',level:'info',message:String(message)}),errorCallback:message=>{packageErrors.push(String(message));emit({type:'log',level:'error',message:String(message)});}});
    if(packageErrors.length)throw Error(packageErrors.join(' | '));
    await runtime.runPythonAsync('import numpy, scipy, yaml');
    const a=manifest.patternArchive,data=await checkedFetch(new URL(a.file,base),a.sha256);
    runtime.FS.mkdirTree('/pattern-generator');runtime.unpackArchive(data,'zip',{extractDir:'/pattern-generator'});
    await runtime.runPythonAsync("import sys, os, json\nsys.path.insert(0, '/pattern-generator')\nos.chdir('/pattern-generator/runtime')\nfrom pattern_catalogue import generatePattern, generateOfficialOracleCm");
    phase='ready';const info={initializationMs:performance.now()-start,pyodideVersion:runtime.version,compressedRuntimeBytes:Object.values(manifest.files).reduce((n,e)=>n+e.bytes,0)+a.bytes};emit({type:'ready',info});return info;
   }finally{if(globalThis.fetch===transportFetch)globalThis.fetch=priorFetch;}
  })().catch(e=>{throw initFailure(e)});
  return initialization;
 }
 function generate(request,config={},onProgress=()=>{}){
  const task=async()=>{progress=onProgress;await initialize(config);const started=performance.now();phase='generating';
   runtime.globals.set('_request_json',JSON.stringify(request));
   try{
    const output=await runtime.runPythonAsync("json.dumps((generateOfficialOracleCm if json.loads(_request_json).get('op') == 'officialOracleCm' else generatePattern)(json.loads(_request_json)), allow_nan=False)");
    const result=JSON.parse(output);if(result.diagnostics)result.diagnostics.browserWorkerMs=performance.now()-started;
    if(request.op!=='officialOracleCm'&&result.validation?.analytic2DPass!==true&&!config.allowInvalidForDiagnostics){const e=Error('Paper validation failed: '+(result.validation?.errors||[]).map(x=>`${x.code}${x.panel?' in '+x.panel:''}`).join('; '));e.name='PatternValidationError';e.validation=result.validation;e.diagnosticPattern=result;throw e;}
    return result;
   }finally{runtime.globals.delete('_request_json');phase='ready';progress=()=>{};}
  };
  const result=queue.then(task,task);queue=result.catch(()=>{});return result;
 }
 return {generate,status:()=>({phase,assetBase:lockedBase||null,ready:phase==='ready',requiresWorkerRestart:!!fatalError})};
}
let defaultEngine;
export function generate(request,config,onProgress){return(defaultEngine??=createPatternEngine()).generate(request,config,onProgress);}
export function status(){return defaultEngine?.status()||{phase:'idle',assetBase:null,ready:false,requiresWorkerRestart:false};}
