import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(fs.readFileSync(path.join(root,'evidence/R10_BUILD_RECEIPT.json')));
const entry=path.join(root,'dist/online-r10/index.html');
if(sha(fs.readFileSync(entry))!==receipt.onlineEntrySha256)throw Error('Frozen entry required');
const report={schema:'FISH_R10_INDEPENDENT_WASM_MEMORY_1',sourceHead:receipt.sourceHead,htmlSha256:receipt.htmlSha256,onlineEntrySha256:receipt.onlineEntrySha256,createdAt:new Date().toISOString(),method:'Actual browser builds; instrument only instantiate/instantiateStreaming; exported memory tracked with WeakRef, never retained strongly by verifier. Record live linear-memory buffer byteLength after source decode, GC and fish switch. No network or production decoder mocking.',limits:'WebAssembly buffer byteLength records allocated linear address storage, not OS physical RSS or driver VRAM. CDP JS/backingStorage counters alone are not total RAM. Peak is maximum observed buffer size, not unobserved transient peak.',versions:[],errors:[],visualAcceptance:false,publication:'NOT_RUN'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'dist','.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(path.join(root,'dist')+path.sep)){res.writeHead(403);res.end();return;}try{const size=fs.statSync(file).size;res.writeHead(200,{'Content-Length':size,'Content-Type':file.endsWith('.html')?'text/html':'application/octet-stream'});fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=createRequire(import.meta.url)('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
function init(){
 const refs=[],events=[];let peak=0;
 function track(result,method){const instance=result.instance||result;if(!(instance instanceof WebAssembly.Instance))return;for(const [name,value] of Object.entries(instance.exports)){if(!(value instanceof WebAssembly.Memory))continue;if(refs.some(r=>r.ref.deref()===value))continue;refs.push({ref:new WeakRef(value),name,method});events.push({name,method,initialBytes:value.buffer.byteLength});}}
 for(const method of ['instantiate','instantiateStreaming']){const original=WebAssembly[method];if(typeof original==='function')WebAssembly[method]=async function(...args){const result=await original.apply(WebAssembly,args);track(result,method);return result;};}
 globalThis.__R10wasmMemory=()=>{const live=refs.flatMap(r=>{const memory=r.ref.deref();return memory?[{name:r.name,method:r.method,bytes:memory.buffer.byteLength}]:[];});const total=live.reduce((n,r)=>n+r.bytes,0);peak=Math.max(peak,total);return{tracked:refs.length,live,totalBytes:total,maxObservedBytes:peak,events:events.slice()};};
}
try{
 for(const version of ['online-r09','online-r10']){
  const context=await browser.newContext({viewport:{width:1440,height:950}});await context.addInitScript(init);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+server.address().port+'/'+version+'/index.html',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>globalThis.__FIVE_FISH__?.ready&&!__FIVE_FISH__.state.loading,null,{timeout:120000});
  const cdp=await context.newCDPSession(page),phases=[];
  async function record(phase){const main=await page.evaluate(()=>({memory:__R10wasmMemory(),id:__FIVE_FISH__.state.selected,loader:__FIVE_FISH__.sourceLoaderStats()}));const children=[];for(const frame of page.frames().filter(f=>f!==page.mainFrame()))children.push(await frame.evaluate(()=>({memory:typeof __R10wasmMemory==='function'?__R10wasmMemory():null})));const heap=await cdp.send('Runtime.getHeapUsage');phases.push({phase,...main,children,rendererHeap:heap});console.log(JSON.stringify({version,phase,memory:main.memory,backingStorageSize:heap.backingStorageSize}));}
  await record('barracuda-decoded');await cdp.send('HeapProfiler.collectGarbage');await record('barracuda-after-GC');
  await page.evaluate(async()=>{await __FIVE_FISH__.select('herring',{group:false});});await page.waitForFunction(()=>__FIVE_FISH__.state.selected==='herring'&&!__FIVE_FISH__.state.loading,null,{timeout:120000});await cdp.send('HeapProfiler.collectGarbage');await record('herring-after-GC');
  await page.evaluate(async()=>{await __FIVE_FISH__.select('barracuda',{group:false});});await page.waitForFunction(()=>__FIVE_FISH__.state.selected==='barracuda'&&!__FIVE_FISH__.state.loading,null,{timeout:120000});await cdp.send('HeapProfiler.collectGarbage');await record('barracuda-repeat-after-GC');
  report.versions.push({version,phases,errors});await context.close();
 }
 report.artifactsUnchanged=sha(fs.readFileSync(entry))===receipt.onlineEntrySha256;report.diagnosticComplete=report.versions.length===2&&report.versions.every(v=>!v.errors.length)&&report.artifactsUnchanged;
}catch(e){report.errors.push(String(e.stack||e));report.diagnosticComplete=false;}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(root,'evidence/INDEPENDENT_R10_WASM_MEMORY.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({diagnosticComplete:report.diagnosticComplete,errors:report.errors,browserClosed:true}));}
if(!report.diagnosticComplete)process.exitCode=1;
