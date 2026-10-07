/* QA-only lifecycle observations. Never imported by the product. */
const fs=require('node:fs'),path=require('node:path');
exports.start=async({browser,pages,contexts,out,engine})=>{
 const started=Date.now(),events=path.join(out,'lifecycle-'+engine+'.jsonl'),rssFile=path.join(out,'browser-rss-'+engine+'.jsonl');
 const record=(type,data={})=>fs.appendFileSync(events,JSON.stringify({at:Date.now(),elapsedMs:Date.now()-started,type,...data})+'\n');
 record('start',{engine,version:browser.version(),nodePid:process.pid,notes:'Trace records actions/screenshots without DOM snapshots or network body capture. Requests have a separate event log. RSS sums Node and its descendants, may double-count shared memory, and is not browser-only or an OOM diagnosis.'});
 let ended=false;
 function sampleRSS(){
  try{
   const processes=[];
   for(const name of fs.readdirSync('/proc')){
    if(!/^\d+$/.test(name))continue;
    try{const s=fs.readFileSync('/proc/'+name+'/status','utf8'),get=re=>s.match(re)?.[1];processes.push({pid:Number(name),ppid:Number(get(/^PPid:\s+(\d+)/m)),name:get(/^Name:\s+(.+)$/m),rssKiB:Number(get(/^VmRSS:\s+(\d+)/m)||0)});}catch{}
   }
   const ids=new Set([process.pid]);let changed=true;while(changed){changed=false;for(const p of processes)if(ids.has(p.ppid)&&!ids.has(p.pid)){ids.add(p.pid);changed=true;}}
   const descendants=processes.filter(p=>ids.has(p.pid));
   fs.appendFileSync(rssFile,JSON.stringify({at:Date.now(),elapsedMs:Date.now()-started,summedRSSKiB:descendants.reduce((s,p)=>s+p.rssKiB,0),sharedPagesMayBeCountedMoreThanOnce:true,processes:descendants})+'\n');
  }catch(e){record('rss-error',{message:e.message});}
 }
 sampleRSS();const timer=setInterval(sampleRSS,500);timer.unref();
 browser.on('disconnected',()=>record('browser-disconnected'));
 for(let i=0;i<contexts.length;i++){
  const ctx=contexts[i];ctx.on('close',()=>record('context-close',{context:i}));
  await ctx.tracing.start({screenshots:true,snapshots:false,sources:false});
  await ctx.exposeBinding('__overviewLifecycleEvent',(source,payload)=>record('page-event',{context:i,page:pages.indexOf(source.page),payload}));
  await ctx.addInitScript(()=>{
   const emit=(name,extra={})=>{try{window.__overviewLifecycleEvent({name,at:Date.now(),url:location.href,...extra}).catch(()=>{});}catch{}};
   const glContexts=[],seen=new WeakMap();let counter=0;
   emit('document-init');
   for(const name of ['pageshow','pagehide','visibilitychange','freeze','resume'])addEventListener(name,event=>emit(name,{persisted:event.persisted??null,visibility:document.visibilityState,glContexts:glContexts.map(x=>({id:x.id,deletes:x.deletes}))}),true);
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
 const saved=new Set();
 async function stopTrace(i){
  if(saved.has(i))return;saved.add(i);
  let timeout;try{await Promise.race([contexts[i].tracing.stop({path:path.join(out,`trace-${engine}-${i}.zip`)}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Trace finalization timeout')),10000)})]);record('trace-saved',{context:i});}catch(e){record('trace-save-error',{context:i,message:e.message});}finally{clearTimeout(timeout);}
 }
 return {closeContext:async i=>{record('layout-complete-release-context',{context:i});await stopTrace(i);await contexts[i].close();sampleRSS();},finish:async()=>{
  if(ended)return;ended=true;clearInterval(timer);sampleRSS();record('finish-start');
  for(let i=0;i<contexts.length;i++)await stopTrace(i);
  record('finish-end');
 }};
};
