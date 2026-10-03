import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=k=>process.argv.find(v=>v.startsWith('--'+k+'='))?.slice(k.length+3);
if(!process.argv.includes('--execute')){console.log('DRAFT_ONLY: requires frozen source/html/online hashes and explicit --execute; no browser started.');process.exit(0);}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const offline=path.join(root,'dist/KAOPU_FISH_SCOREMAKER_R07.html'),onlineDir=path.join(root,'dist/online-r07'),online=path.join(onlineDir,'index.html');
const expected={sourceHead:arg('source-head'),html:arg('expected-html'),online:arg('expected-online')};
if(Object.values(expected).some(x=>!x))throw Error('Missing frozen arguments');
const receipt=JSON.parse(fs.readFileSync(path.join(root,'evidence/R07_BUILD_RECEIPT.json')));
const fresh=()=>{if(sha(fs.readFileSync(offline))!==expected.html||sha(fs.readFileSync(online))!==expected.online||receipt.sourceHead!==expected.sourceHead)throw Error('Frozen candidate mismatch');};fresh();
const {chromium}=createRequire(import.meta.url)('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const report={schema:'fish.independent-r07-startup/1',taskId:'FISH_MATH_MEMORY_PERFORMANCE_R07_20261003',sourceHead:expected.sourceHead,testedHtmlSha256:expected.html,testedOnlineEntrySha256:expected.online,createdAt:new Date().toISOString(),cases:[],checks:[],failures:[],visualAcceptance:false,productionReady:false};
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});if(!pass)report.failures.push(name);};
const ids=receipt.assets.map(a=>a.id),payloads=new Map(receipt.assets.map(a=>['/'+a.file,{...a,bytesData:fs.readFileSync(path.join(onlineDir,a.file))}]));
check('online-shell-under-1.2MB',fs.statSync(online).size<=1200000,fs.statSync(online).size);
let current=null;
const timers=new Set(),later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),record={path:url.pathname,at:Date.now(),chunks:[],sent:0,completeAt:null,closedAt:null,status:200};current?.requests.push(record);
 res.on('close',()=>record.closedAt=Date.now());
 if(url.pathname==='/'||url.pathname==='/index.html'){
  const bytes=fs.readFileSync(online);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store'});
  const send=(offset=0)=>{if(res.destroyed)return;const chunk=bytes.subarray(offset,offset+32768);record.sent+=chunk.length;record.chunks.push({at:Date.now(),sent:record.sent});res.write(chunk);if(record.sent===bytes.length){record.completeAt=Date.now();res.end();}else later(()=>send(offset+chunk.length),current?.slowShell?20:0);};send();return;
 }
 const payload=payloads.get(url.pathname);if(!payload){res.writeHead(404);res.end();return;}
 record.id=payload.id;const selected=current,mode=selected?.fault&&payload.id==='barracuda'?selected.fault:'normal';
 if(mode==='500'){record.status=500;res.writeHead(500);res.end('independent injected data failure');return;}
 let bytes=payload.bytesData;if(mode==='corrupt'){bytes=Buffer.from(bytes);bytes[Math.floor(bytes.length/2)]^=1;}
 if(mode==='truncate')bytes=bytes.subarray(0,Math.min(131072,bytes.length));
 res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});
 const send=(offset=0)=>{if(res.destroyed)return;const chunk=bytes.subarray(offset,offset+262144);record.sent+=chunk.length;record.chunks.push({at:Date.now(),sent:record.sent});res.write(chunk);if(mode==='stall')return;if(record.sent===bytes.length){record.completeAt=Date.now();res.end();}else later(()=>send(offset+chunk.length),selected?.slowAsset?50:0);};
 later(()=>send(),selected?.slowAsset?500:0);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
const init=()=>{
 const qa=globalThis.__STARTUP_QA__={events:[],snapshots:[],errors:[],timeOrigin:performance.timeOrigin};
 document.addEventListener('fish-load-progress',e=>qa.events.push({at:Date.now(),perf:performance.now(),...e.detail}));
 addEventListener('error',e=>qa.errors.push({at:Date.now(),message:e.message}));
 addEventListener('unhandledrejection',e=>qa.errors.push({at:Date.now(),message:String(e.reason)}));
 let last='';setInterval(()=>{const cards=[...document.querySelectorAll('#fishList [data-fish]')],images=cards.map(c=>c.querySelector('img')),phase=globalThis.__FISH_BOOT__?.phase||null,p=document.getElementById('loadingProgress');const snap={at:Date.now(),perf:performance.now(),cards:cards.length,imagesLoaded:images.filter(i=>i?.complete&&i.naturalWidth>0).length,phase,text:document.getElementById('loadingText')?.textContent||'',progressVisible:!!p&&!p.hidden,progressValue:p?.value||0,progressMax:p?.max||0,retryVisible:!!document.getElementById('loadingRetry')&&!document.getElementById('loadingRetry').hidden,ready:!!globalThis.__FIVE_FISH__?.ready,selected:globalThis.__FIVE_FISH__?.state.selected,loading:globalThis.__FIVE_FISH__?.state.loading};const key=JSON.stringify({...snap,at:0,perf:0});if(key!==last){qa.snapshots.push(snap);last=key;}},16);
};
const open=async(name,opts={})=>{
 current={name,requests:[],...opts};const ctx=await browser.newContext({viewport:opts.mobile?{width:390,height:844}:{width:1440,height:950}});await ctx.addInitScript(init);
 if(opts.webgl)await ctx.addInitScript(()=>{const native=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:native.call(this,type,...args);};});
 const page=await ctx.newPage(),errors=[],responses=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.url().includes('/assets/'))responses.push({url:r.url(),status:r.status(),at:Date.now()});});
 const start=Date.now();await page.goto(opts.file?pathToFileURL(offline).href:url,{waitUntil:'commit',timeout:120000});return {ctx,page,errors,responses,start,serverCase:current};
};
const ready=page=>page.waitForFunction(()=>globalThis.__FIVE_FISH__?.ready&&__FIVE_FISH__.state.loaded&&!__FIVE_FISH__.state.loading,null,{timeout:120000});
const snapshot=async c=>{const result={name:c.serverCase.name,start:c.start,requests:structuredClone(c.serverCase.requests),responses:structuredClone(c.responses),errors:[...c.errors],qa:await c.page.evaluate(()=>__STARTUP_QA__),runtime:await c.page.evaluate(()=>{const a=globalThis.__FIVE_FISH__;return a?{ready:a.ready,state:{selected:a.state.selected,loaded:a.state.loaded,loading:a.state.loading,group:a.state.group,mode:a.state.mode},capture:a.state.loaded?a.captureState():null,delivery:a.manifest.deliveryMode,automatic:a.cycle.automatic,error:String(a.error||'')}:null;})};report.cases.push(result);return result;};
const continuity=async(page,name)=>{
 const a=await page.evaluate(()=>__FIVE_FISH__.captureState());await page.waitForTimeout(350);const b=await page.evaluate(()=>__FIVE_FISH__.captureState());check(name+'-actual-frame-advances',b.frames>a.frames,{before:a.frames,after:b.frames});check(name+'-30-source-preserved',b.instances===30&&b.sourceTriangleCount>0,b);
};
try{
 for(const mobile of [false,true]){
  const c=await open(mobile?'online-mobile':'online-slow-desktop',{mobile,slowShell:!mobile,slowAsset:!mobile});await ready(c.page);await continuity(c.page,c.serverCase.name);
  await c.page.screenshot({path:path.join(root,'evidence/independent-r07-'+(mobile?'mobile':'desktop')+'.png')});
  const beforeSwitch=await snapshot(c),firstAsset=beforeSwitch.requests.find(r=>r.id==='barracuda'),catalog=beforeSwitch.qa.snapshots.find(s=>s.cards===6&&s.imagesLoaded===6),partial=beforeSwitch.qa.snapshots.find(s=>s.progressVisible&&s.progressValue>0&&s.progressValue<s.progressMax);
  check(c.serverCase.name+'-real-six-thumbnails-before-source-complete',!!catalog&&catalog.at<firstAsset?.completeAt,{catalog,completeAt:firstAsset?.completeAt});
  check(c.serverCase.name+'-only-default-selected-source-fetched',beforeSwitch.requests.filter(r=>r.id).length===1&&firstAsset?.id==='barracuda',beforeSwitch.requests.filter(r=>r.id).map(r=>r.id));
  if(!mobile){check('slow-desktop-actual-partial-byte-progress',!!partial,{partial});check('slow-desktop-catalog-before-full-entry-arrived',catalog?.at<beforeSwitch.requests.find(r=>r.path==='/')?.completeAt,{catalogAt:catalog?.at,entryComplete:beforeSwitch.requests.find(r=>r.path==='/')?.completeAt});}
  c.serverCase.slowAsset=false;c.serverCase.slowShell=false;
  for(const id of ids.filter(i=>i!=='barracuda')){await c.page.evaluate(id=>__FIVE_FISH__.select(id),id);await ready(c.page);const result=await c.page.evaluate(()=>({id:__FIVE_FISH__.state.selected,source:__FIVE_FISH__.score.id,vertices:__FIVE_FISH__.captureState().sourceVertexCount,triangles:__FIVE_FISH__.captureState().sourceTriangleCount,instances:__FIVE_FISH__.captureState().instances,error:__FIVE_FISH__.renderer.getContext().getError(),automatic:__FIVE_FISH__.cycle.automatic}));check(c.serverCase.name+'-switch-'+id,result.id===id&&result.source===id&&result.instances===30&&result.error===0&&result.automatic,result);}
  const final=await snapshot(c);check(c.serverCase.name+'-no-normal-js-errors',final.errors.length===0,final.errors);check(c.serverCase.name+'-six-exact-selected-downloads',final.requests.filter(r=>r.id).length===6,final.requests.filter(r=>r.id).map(r=>r.id));await c.ctx.close();
 }
 for(const fault of ['500','corrupt','truncate','stall']){
  const c=await open('fault-'+fault,{fault});await c.page.waitForFunction(()=>globalThis.__FISH_BOOT__?.phase==='failed',null,{timeout:fault==='stall'?45000:120000});await c.page.waitForTimeout(50);
  const failed=await snapshot(c),ui=failed.qa.snapshots.at(-1);check('fault-'+fault+'-visible-clear-failure',ui?.cards===6&&ui?.retryVisible&&ui?.text.length>10,{ui});
  if(fault==='corrupt')check('fault-corrupt-integrity-before-decode',failed.qa.events.some(e=>e.phase==='verify')&&!failed.qa.events.some(e=>e.phase==='decode'),failed.qa.events);
  if(fault==='stall')check('fault-stall-bounded-30sec',ui.at-c.start>=29000&&ui.at-c.start<44000,ui.at-c.start);
  c.serverCase.fault=null;await c.page.locator('#loadingRetry').click();await ready(c.page);await continuity(c.page,'retry-'+fault);const recovered=await snapshot(c);check('retry-'+fault+'-ready-and-default-source',recovered.runtime?.ready&&recovered.runtime.state.selected==='barracuda'&&recovered.qa.snapshots.some(s=>s.phase==='ready'),recovered.runtime);await c.ctx.close();
 }
 {
  const c=await open('initial-selection-cancel',{slowAsset:true});await c.page.waitForFunction(()=>document.querySelectorAll('#fishList [data-fish]').length===6&&globalThis.__FIVE_FISH__?.state.loading,null,{timeout:30000});await c.page.locator('[data-fish="herring"]').click();await ready(c.page);await continuity(c.page,'initial-selection-cancel');await c.page.waitForTimeout(200);const r=await snapshot(c);check('initial-selection-cancel-ready-without-stale-failure',r.runtime?.ready&&r.runtime.state.selected==='herring'&&r.runtime.error===''&&r.qa.snapshots.at(-1)?.phase==='ready',r.runtime);check('initial-selection-cancel-original-download-aborted',r.requests.find(x=>x.id==='barracuda')?.completeAt===null,r.requests.filter(x=>x.id).map(x=>({id:x.id,sent:x.sent,completeAt:x.completeAt,closedAt:x.closedAt})));await c.ctx.close();
 }
 {
  const c=await open('webgl-unavailable',{webgl:true});await c.page.waitForFunction(()=>globalThis.__FISH_BOOT__?.phase==='failed',null,{timeout:30000});await c.page.waitForTimeout(50);const r=await snapshot(c),ui=r.qa.snapshots.at(-1);check('webgl-unavailable-visible-diagnostic',ui?.cards===6&&ui.retryVisible&&/三维|WebGL|绘制/.test(ui.text),ui);await c.ctx.close();
 }
 for(const mobile of [false,true]){
  const c=await open(mobile?'standalone-mobile':'standalone-desktop',{file:true,mobile});await ready(c.page);await continuity(c.page,c.serverCase.name);const urls=[];c.page.on('request',r=>urls.push(r.url()));
  for(const id of ids.filter(i=>i!=='barracuda')){await c.page.evaluate(id=>__FIVE_FISH__.select(id),id);await ready(c.page);check(c.serverCase.name+'-switch-'+id,await c.page.evaluate(id=>__FIVE_FISH__.state.selected===id&&__FIVE_FISH__.captureState().instances===30,id));}
  const r=await snapshot(c);check(c.serverCase.name+'-no-network-or-js-errors',!urls.some(u=>/^https?:/.test(u))&&r.errors.length===0,{urls,errors:r.errors});check(c.serverCase.name+'-inline-delivery',r.runtime?.delivery==='STANDALONE_INLINE',r.runtime);await c.ctx.close();
 }
 fresh();report.passed=report.failures.length===0;report.status=report.passed?'STARTUP_TECHNICAL_PASS':'HOLD';
}catch(error){report.failures.push('unhandled-verifier:'+String(error));report.passed=false;report.status='HOLD';report.verifierError=String(error.stack||error);}
finally{await browser.close();for(const id of timers)clearTimeout(id);server.closeAllConnections();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(root,'evidence/INDEPENDENT_R07_STARTUP.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,failures:report.failures,browserClosed:true}));}
if(!report.passed)process.exitCode=1;
