/* QA-only lifecycle observations. Never imported by the product. */
const fs=require('node:fs'),path=require('node:path');
exports.start=async({browser,pages,contexts,out,engine})=>{
 const started=Date.now(),events=path.join(out,'lifecycle-'+engine+'.jsonl'),rssFile=path.join(out,'browser-rss-'+engine+'.jsonl'),memoryFile=path.join(out,'system-memory-'+engine+'.jsonl');
 const record=(type,data={})=>fs.appendFileSync(events,JSON.stringify({at:Date.now(),elapsedMs:Date.now()-started,type,...data})+'\n');
 record('start',{engine,version:browser.version(),nodePid:process.pid,notes:'Browser tracing is disabled. Only numeric resource, memory and exit observations are archived. RSS sums Node and its descendants, may double-count shared memory, and is not browser-only or an OOM diagnosis.'});
 let ended=false,previousProcesses=new Map();
 const observedHandles=new WeakSet(),cgroupPaths=new Set(['/sys/fs/cgroup']);
 const read=file=>{try{return fs.readFileSync(file,'utf8').trim()}catch(e){return {unavailable:e.code||e.message}}};
 const membership=read('/proc/self/cgroup');
 if(typeof membership==='string')for(const line of membership.split('\n')){const parts=line.split(':'),controller=parts[1],relative=parts.slice(2).join(':');if(parts[0]==='0'||controller.split(',').includes('memory')){const root=parts[0]==='0'?'/sys/fs/cgroup':'/sys/fs/cgroup/memory';let dir=path.resolve(root,'.'+relative);for(let i=0;i<12&&dir.startsWith(root);i++){cgroupPaths.add(dir);if(dir===root)break;dir=path.dirname(dir);}}}
 record('memory-sampling-scope',{membership,cgroupPaths:[...cgroupPaths],note:'Read-only /proc and cgroup counters. Counter changes alone do not identify which process failed; unavailable exit status is retained as unavailable.'});
 function sampleMemory(){const cgroups=[...cgroupPaths].map(dir=>({path:dir,events:read(path.join(dir,'memory.events')),eventsLocal:read(path.join(dir,'memory.events.local')),max:read(path.join(dir,'memory.max')),current:read(path.join(dir,'memory.current')),peak:read(path.join(dir,'memory.peak')),swapMax:read(path.join(dir,'memory.swap.max')),v1Limit:read(path.join(dir,'memory.limit_in_bytes')),v1Failcnt:read(path.join(dir,'memory.failcnt'))}));const meminfo=read('/proc/meminfo'),vmstat=read('/proc/vmstat');fs.appendFileSync(memoryFile,JSON.stringify({at:Date.now(),elapsedMs:Date.now()-started,cgroups,meminfo:typeof meminfo==='string'?Object.fromEntries(meminfo.split('\n').filter(x=>/^(MemTotal|MemFree|MemAvailable|SwapTotal|SwapFree):/.test(x)).map(x=>x.split(/:\s*/))):meminfo,oomKill:typeof vmstat==='string'?Number(vmstat.match(/^oom_kill (\d+)/m)?.[1]??NaN):vmstat,memoryPressure:read('/proc/pressure/memory')})+'\n');}
 function observeChildHandles(){for(const handle of process._getActiveHandles?.()||[]){if(handle.constructor?.name!=='ChildProcess'||!handle.pid||observedHandles.has(handle))continue;observedHandles.add(handle);record('child-process-observed',{pid:handle.pid});handle.once('exit',(exitCode,signal)=>record('child-process-exit',{pid:handle.pid,exitCode,signal}));handle.once('error',error=>record('child-process-error',{pid:handle.pid,message:error.message}));}}
 function sampleRSS(){
  try{
   const processes=[];
   for(const name of fs.readdirSync('/proc')){
    if(!/^\d+$/.test(name))continue;
    try{const s=fs.readFileSync('/proc/'+name+'/status','utf8'),get=re=>s.match(re)?.[1],stat=fs.readFileSync('/proc/'+name+'/stat','utf8'),fields=stat.slice(stat.lastIndexOf(')')+2).split(' '),rawExit=Number(fields[49]||0);processes.push({pid:Number(name),ppid:Number(get(/^PPid:\s+(\d+)/m)),name:get(/^Name:\s+(.+)$/m),state:fields[0],rssKiB:Number(get(/^VmRSS:\s+(\d+)/m)||0),startTicks:fields[19],rawExitStatus:fields[0]==='Z'?rawExit:null,exitSignal:fields[0]==='Z'?(rawExit&127):null,exitCode:fields[0]==='Z'?((rawExit>>8)&255):null});}catch{}
   }
   const ids=new Set([process.pid]);let changed=true;while(changed){changed=false;for(const p of processes)if(ids.has(p.ppid)&&!ids.has(p.pid)){ids.add(p.pid);changed=true;}}
   const descendants=processes.filter(p=>ids.has(p.pid)),current=new Map(descendants.map(p=>[p.pid+':'+p.startTicks,p]));for(const [key,p] of previousProcesses)if(!current.has(key))record('process-no-longer-observed',{...p,note:'Process absent from descendant sample; not proof of a signal or OOM. A zombie or ChildProcess exit event is required for an exit status.'});previousProcesses=current;
   fs.appendFileSync(rssFile,JSON.stringify({at:Date.now(),elapsedMs:Date.now()-started,summedRSSKiB:descendants.reduce((s,p)=>s+p.rssKiB,0),sharedPagesMayBeCountedMoreThanOnce:true,processes:descendants})+'\n');
   sampleMemory();observeChildHandles();
  }catch(e){record('rss-error',{message:e.message});}
 }
 sampleRSS();const timer=setInterval(sampleRSS,500);timer.unref();
 browser.on('disconnected',()=>record('browser-disconnected'));
 for(let i=0;i<contexts.length;i++){
  const ctx=contexts[i];ctx.on('close',()=>record('context-close',{context:i}));
  await ctx.exposeBinding('__overviewLifecycleEvent',(source,payload)=>record('page-event',{context:i,page:pages.indexOf(source.page),payload}));
  await ctx.addInitScript(()=>{
   const emit=(name,extra={})=>{try{window.__overviewLifecycleEvent({name,at:Date.now(),url:location.href,...extra}).catch(()=>{});}catch{}};
   const glContexts=[],seen=new WeakMap();let counter=0;
   const activeWorkers=new Set();let workerId=0;
   const NativeWorker=window.Worker;if(NativeWorker)window.Worker=new Proxy(NativeWorker,{construct(Target,args,newTarget){const worker=Reflect.construct(Target,args,newTarget),id=++workerId;activeWorkers.add(id);emit('worker-created',{id,url:String(args[0]),active:activeWorkers.size});const terminate=worker.terminate.bind(worker);worker.terminate=function(...values){const result=terminate(...values);activeWorkers.delete(id);emit('worker-terminate',{id,active:activeWorkers.size});return result;};return worker;}});
   const NativeResizeObserver=window.ResizeObserver;if(NativeResizeObserver)window.ResizeObserver=new Proxy(NativeResizeObserver,{construct(Target,args,newTarget){const observer=Reflect.construct(Target,args,newTarget),disconnect=observer.disconnect.bind(observer);observer.disconnect=function(...values){const result=disconnect(...values);emit('resize-observer-disconnect');return result;};return observer;}});
   const cancelRAF=window.cancelAnimationFrame.bind(window);window.cancelAnimationFrame=function(id){const result=cancelRAF(id);emit('animation-frame-cancel',{id});return result;};
   emit('document-init');
   for(const name of ['pageshow','pagehide','visibilitychange','freeze','resume'])addEventListener(name,event=>emit(name,{persisted:event.persisted??null,visibility:document.visibilityState,glContexts:glContexts.map(x=>({id:x.id,deletes:x.deletes}))}),true);
   addEventListener('pagehide',event=>queueMicrotask(()=>emit('pagehide-microtask-observation',{persisted:event.persisted,activeWorkers:activeWorkers.size,glContexts:glContexts.map(x=>({id:x.id,deletes:x.deletes})),note:'Runs only if the departing document permits this microtask; explicit terminate/delete/loseContext calls are separate evidence.'})),true);
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,...args){
    const gl=original.call(this,kind,...args);
    if(!gl||!/^webgl|experimental-webgl$/.test(kind))return gl;
    let entry=seen.get(gl);
    if(!entry){
     entry={id:++counter,deletes:{}};seen.set(gl,entry);glContexts.push(entry);emit('webgl-context-created',{id:entry.id,kind});
     this.addEventListener('webglcontextlost',e=>emit('webgl-context-lost',{id:entry.id,statusMessage:e.statusMessage||''}));
     this.addEventListener('webglcontextrestored',()=>emit('webgl-context-restored',{id:entry.id}));
     for(const method of ['deleteBuffer','deleteTexture','deleteProgram','deleteShader','deleteFramebuffer','deleteRenderbuffer','deleteVertexArray']){
      if(typeof gl[method]!=='function')continue;
      const fn=gl[method].bind(gl);gl[method]=function(...values){const n=entry.deletes[method]=(entry.deletes[method]||0)+1;if((n&(n-1))===0)emit('webgl-resource-delete',{id:entry.id,method,count:n});return fn(...values);};
     }
     const get=gl.getExtension.bind(gl);gl.getExtension=function(name){const ext=get(name);if(name==='WEBGL_lose_context'&&ext&&!ext.__overviewObserved){try{Object.defineProperty(ext,'__overviewObserved',{value:true});for(const method of ['loseContext','restoreContext']){const fn=ext[method].bind(ext);ext[method]=function(...v){emit('webgl-explicit-'+method,{id:entry.id});return fn(...v);};}}catch{}}return ext;};
    }
    emit('webgl-getContext',{id:entry.id,kind});return gl;
   };
  });
 }
 pages.forEach((page,index)=>{
  page.on('crash',()=>record('page-crash',{page:index,url:page.url()}));
  page.on('close',()=>record('page-close',{page:index,url:page.url()}));
  page.on('domcontentloaded',()=>record('domcontentloaded',{page:index,url:page.url()}));
  page.on('load',()=>record('load',{page:index,url:page.url()}));
  page.on('pageerror',e=>record('pageerror',{page:index,url:page.url(),message:e.message}));
  page.on('request',r=>record('request',{page:index,url:r.url(),resourceType:r.resourceType(),navigation:r.isNavigationRequest(),method:r.method()}));
  page.on('response',r=>record('response',{page:index,url:r.url(),status:r.status(),resourceType:r.request().resourceType(),navigation:r.request().isNavigationRequest()}));
  page.on('requestfinished',r=>record('requestfinished',{page:index,url:r.url(),resourceType:r.resourceType(),timing:r.timing()}));
  page.on('requestfailed',r=>record('requestfailed',{page:index,url:r.url(),resourceType:r.resourceType(),failure:r.failure()?.errorText,timing:r.timing()}));
 });
 function saveNumericEvidence(){
  const parse=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
  const eventRows=parse(events),rss=parse(rssFile),memory=parse(memoryFile);
  const numericPairs=value=>typeof value==='string'?Object.fromEntries(value.split('\n').map(row=>row.trim().split(/\s+/)).filter(row=>row.length===2&&Number.isFinite(Number(row[1]))).map(([k,v])=>[k,Number(v)])):value;
  const safePath=value=>{try{return new URL(value).pathname}catch{return null}};
  const timeline=eventRows.filter(e=>['page-event','page-crash','page-close','domcontentloaded','load','browser-disconnected','child-process-observed','child-process-exit','child-process-error','process-no-longer-observed','context-close'].includes(e.type)).map(e=>{const row={at:e.at,elapsedMs:e.elapsedMs,type:e.type};for(const k of ['page','context','pid','ppid','name','rssKiB','state','rawExitStatus','exitSignal','exitCode','signal'])if(k in e)row[k]=e[k];if(e.url)row.path=safePath(e.url);if(e.payload){row.event=e.payload.name;row.path=safePath(e.payload.url);for(const k of ['id','persisted','active','activeWorkers','glContexts','deletes','count','method','kind','visibility'])if(k in e.payload)row[k]=e.payload[k]}return row});
  const reducedMemory=memory.map(m=>({...m,cgroups:m.cgroups.map(c=>({...c,events:numericPairs(c.events),eventsLocal:numericPairs(c.eventsLocal)}))}));
  fs.writeFileSync(path.join(out,'numeric-diagnostics-'+engine+'.json'),JSON.stringify({engine,measurement:'Read-only memory/exit/resource lifecycle counters. Node is included in summed RSS. A missing exit signal is unknown, not an OOM diagnosis.',rss,memory:reducedMemory,timeline},null,2));
 }
 return {closeContext:async i=>{record('layout-complete-release-context',{context:i});await contexts[i].close();sampleRSS();},finish:async()=>{
  if(ended)return;ended=true;clearInterval(timer);sampleRSS();record('finish-start');saveNumericEvidence();record('finish-end');
 }};
};
