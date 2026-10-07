/** Lazy browser facade. Import/listStyles/parameterSchema never starts Pyodide. */
const BASE=new URL('./',import.meta.url);
const jsonCache=new Map();
async function readJSON(name){if(!jsonCache.has(name))jsonCache.set(name,fetch(new URL(name,BASE)).then(r=>{if(!r.ok)throw Error(`${name}: ${r.status}`);return r.json();}).catch(e=>{jsonCache.delete(name);throw e;}));return structuredClone(await jsonCache.get(name));}
export const listStyles=()=>readJSON('styles.json');
export const parameterSchema=()=>readJSON('parameter-schema.json');
export function createPatternGenerator({assetBase=BASE.href,onProgress=()=>{},timeoutMs=180000}={}){
 let worker,nextId=0,disposed=false;const pending=new Map();
 const stop=(reason)=>{if(worker){worker.terminate();worker=undefined;}for(const p of pending.values()){clearTimeout(p.timer);p.cleanup();p.reject(reason);}pending.clear();};
 function getWorker(){if(disposed)throw Error('Generator has been disposed');if(!worker){worker=new Worker(new URL('pattern-worker.js',BASE));worker.onmessage=({data})=>{if(data.type==='ready'||data.type==='log'){onProgress(data);return;}const p=pending.get(data.id);if(!p)return;pending.delete(data.id);clearTimeout(p.timer);p.cleanup();if(data.type==='result'){if(data.result.validation?.analytic2DPass!==true&&!p.allowInvalidForDiagnostics&&!p.isOracle){const e=Error('Paper validation failed: '+(data.result.validation?.errors||[]).map(x=>`${x.code}${x.panel?' in '+x.panel:''}`).join('; '));e.name='PatternValidationError';e.validation=data.result.validation;e.diagnosticPattern=data.result;p.reject(e);}else p.resolve(data.result);}else {const e=Error(data.error.message);e.name=data.error.name;p.reject(e);}};worker.onerror=e=>stop(Error(e.message||'Pattern worker failed'));}return worker;}
 return {listStyles,parameterSchema,generatePattern(request,{signal,allowInvalidForDiagnostics=false}={}){return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason||new DOMException('Aborted','AbortError'));return;}
  let w;try{w=getWorker();}catch(e){reject(e);return;}
  const id=++nextId;const abort=()=>stop(signal?.reason||new DOMException('Aborted','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});
  const cleanup=()=>signal?.removeEventListener('abort',abort);
  const timer=setTimeout(()=>stop(Error('Pattern generation timed out; worker terminated and can be restarted')),timeoutMs);
  pending.set(id,{resolve,reject,timer,cleanup,allowInvalidForDiagnostics,isOracle:request.op==='officialOracleCm'});w.postMessage({id,request,config:{assetBase}});
 });},cancel(reason=new DOMException('Cancelled','AbortError')){stop(reason);},dispose(){disposed=true;stop(new DOMException('Disposed','AbortError'));}};
}
let defaultGenerator;
export function generatePattern(request,options){return(defaultGenerator??=createPatternGenerator()).generatePattern(request,options);}
export function disposePatternGenerator(){defaultGenerator?.dispose();defaultGenerator=undefined;}
