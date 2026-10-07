/* Official GarmentCode in a dedicated Pyodide worker. No main-thread Python work.
 * Files load only on the first generation request, never from module import or catalogue access.
 */
let runtime, initialization, manifest, runtimeBase, archiveURL;
const originalFetch=self.fetch.bind(self);
async function digest(data){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');}
async function checkedFetch(url,sha){const r=await originalFetch(url);if(!r.ok)throw Error(`HTTP ${r.status}: ${url}`);const b=await r.arrayBuffer();if(sha&&await digest(b)!==sha)throw Error(`Integrity check failed: ${url}`);return b;}
async function initialize(config={}){
 if(initialization)return initialization;
 initialization=(async()=>{
  const start=performance.now();
  const base=new URL(config.assetBase||'./',self.location.href);
  runtimeBase=new URL('vendor/pyodide/',base).href;
  const mr=await originalFetch(new URL('runtime-manifest.json',base));if(!mr.ok)throw Error('Runtime manifest unavailable');manifest=await mr.json();
  if(typeof DecompressionStream==='undefined')throw Error('This browser needs gzip DecompressionStream support for the local Python runtime');
  // The official loader receives byte-identical wheels/WASM after transfer decompression.
  // Restrict the substitution to our own pinned runtime URLs; do not intercept unrelated requests.
  self.fetch=async (input,init)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(url&&url.startsWith(runtimeBase)){
    const name=url.slice(runtimeBase.length),entry=manifest.files[name];
    if(entry){let compressedStream;
     if(entry.compressedParts){const parts=await Promise.all(entry.compressedParts.map(p=>checkedFetch(runtimeBase+p.file,p.sha256)));compressedStream=new Blob(parts).stream();}
     else {const {integrity:decodedWheelIntegrity,...transportInit}=init||{};const r=await originalFetch(runtimeBase+entry.compressed,transportInit);if(!r.ok)throw Error(`Runtime download failed ${name}: ${r.status}`);compressedStream=r.body;}
     const data=await new Response(compressedStream.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
     if(await digest(data)!==entry.sha256)throw Error(`Runtime integrity failed: ${name}`);
     return new Response(data,{headers:{'Content-Type':name.endsWith('.wasm')?'application/wasm':name.endsWith('.json')?'application/json':'application/octet-stream'}});
    }
   }
   return originalFetch(input,init);
  };
  importScripts(runtimeBase+'pyodide.js');
  runtime=await loadPyodide({indexURL:runtimeBase,stdout:()=>{},stderr:s=>self.postMessage({type:'log',level:'warning',message:s})});
  const packageErrors=[];await runtime.loadPackage(['numpy','scipy','pyyaml'],{checkIntegrity:true,messageCallback:message=>self.postMessage({type:'log',level:'info',message:String(message)}),errorCallback:message=>{packageErrors.push(String(message));self.postMessage({type:'log',level:'error',message:String(message)});}});
  if(packageErrors.length)throw Error('Python dependency loading failed: '+packageErrors.join(' | '));
  await runtime.runPythonAsync('import numpy, scipy, yaml');
  const a=manifest.patternArchive;
  const data=await checkedFetch(new URL(a.file,base),a.sha256);
  runtime.FS.mkdirTree('/pattern-generator');runtime.unpackArchive(data,'zip',{extractDir:'/pattern-generator'});
  await runtime.runPythonAsync("import sys, os\nsys.path.insert(0, '/pattern-generator')\nos.chdir('/pattern-generator/runtime')\nfrom pattern_catalogue import generatePattern, generateOfficialOracleCm, parameterSchema, listStyles\nimport json");
  const info={initializationMs:performance.now()-start,pyodideVersion:runtime.version,compressedRuntimeBytes:Object.values(manifest.files).reduce((n,e)=>n+e.bytes,0)+a.bytes};
  self.postMessage({type:'ready',info});return info;
 })().catch(e=>{initialization=undefined;throw e;});return initialization;
}
let queue=Promise.resolve();
self.onmessage=({data})=>{queue=queue.then(async()=>{
 const {id,request,config}=data;
 try{
  await initialize(config);
  const started=performance.now();runtime.globals.set('_request_json',JSON.stringify(request));
  const s=await runtime.runPythonAsync("json.dumps((generateOfficialOracleCm if json.loads(_request_json).get('op') == 'officialOracleCm' else generatePattern)(json.loads(_request_json)), allow_nan=False)");
  runtime.globals.delete('_request_json');
  const result=JSON.parse(s);if(result.diagnostics)result.diagnostics.browserWorkerMs=performance.now()-started;
  self.postMessage({id,type:'result',result});
 }catch(e){self.postMessage({id,type:'error',error:{name:e.name||'PatternError',message:String(e.message||e)}});}
});};
