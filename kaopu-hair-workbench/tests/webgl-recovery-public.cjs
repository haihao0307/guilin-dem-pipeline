const fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=async function(browser,root,base,out){
 fs.mkdirSync(out,{recursive:true});const result={passed:false,physicalIPhoneTested:false,fullRegressionPassed:false,observerInjected:true,heapBytesMeasured:false,checks:[],pages:{},errors:[]};
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 const check=(name,pass,detail)=>{result.checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name+' '+JSON.stringify(detail));};
 try{for(const [folder,file,api,expected]of [['gnm-groom-editor','experiment.html','groomStudy',3863130920],['gnm-study','index.html','gnmStudy',3753470069]]){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
  try{
   await ctx.addInitScript(()=>{window.__recoveryContexts=[];const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...a){const gl=get.apply(this,a);if(a[0]==='webgl2'&&gl&&!window.__recoveryContexts.includes(gl))window.__recoveryContexts.push(gl);return gl;};});
   const url=new URL('qa/'+folder+'/'+file,base).href,files=[file,'src/'+(api==='groomStudy'?'experiment.js':'app.js'),'src/GraphicsLifecycle.js'];let exact=false,last;
   for(let i=0;i<40;i++){last=await Promise.all(files.map(async f=>{const r=await ctx.request.get(new URL(f,url).href);return{file:f,status:r.status(),sha256:sha(await r.body()),expected:sha(fs.readFileSync(path.join(root,'qa',folder,f)))};}));exact=last.every(x=>x.status===200&&x.sha256===x.expected);if(exact)break;await new Promise(r=>setTimeout(r,10000));}
   check(folder+' public startup bytes match published commit',exact,last);
   const vendorUrl=new URL('vendor/three.module.js',url).href,vendorHash=sha(fs.readFileSync(path.join(root,'qa',folder,'vendor/three.module.js'))),hook=fs.readFileSync(path.join(root,'qa/gnm-webgl-listener-audit/observer.js'));let vendorVerified=false;
   await ctx.route(vendorUrl,async route=>{const response=await route.fetch(),body=await response.body();if(response.status()!==200||sha(body)!==vendorHash){await route.abort();return;}vendorVerified=true;const headers={...response.headers(),'content-type':'text/javascript'};delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:200,headers,body:Buffer.concat([body,Buffer.from('\n'),hook])});});
   const p=await ctx.newPage();p.on('pageerror',e=>result.errors.push(String(e)));await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
   await p.waitForFunction(api=>window[api]?.ready,api,{timeout:240000});
   async function probe(){return p.evaluate(api=>{const a=window[api],d=a.diagnostics?a.diagnostics():a.getDiagnostics(),g=document.getElementById('canvas').getContext('webgl2'),b=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,b);let h=2166136261;for(const x of b)h=Math.imul(h^x,16777619)>>>0;const positions=new Float32Array(a.getPositions());let modelHash=2166136261;for(const x of new Uint8Array(positions.buffer))modelHash=Math.imul(modelHash^x,16777619)>>>0;return{pixels:h,modelHash,callbacks:__hairDisposeObservation(),glError:g.getError(),geometry:d.geometryHashes,model:d.model,graphics:a.graphicsDiagnostics(),state:a.getState(),live:window.__recoveryContexts.filter(x=>!x.isContextLost()).length};},api);}
   const first=await probe();check(folder+' real public default retains accepted pixels',first.pixels===expected&&first.modelHash===1686585375&&first.glError===0&&first.live===1&&vendorVerified,first);await p.locator('#canvas').screenshot({path:path.join(out,folder+'-public-default.png')});
   await p.evaluate(api=>{const a=window[api];api==='groomStudy'?a.setGroom({hairColor:'#704129'}):a.setGroom('hair',{color:'#704129'});},api);const edited=await probe(),tracked=edited.callbacks.filter(x=>x.callbacks>0);
   for(const kind of ['context-loss','page-return']){
    const before=await p.evaluate(api=>window[api].graphicsDiagnostics().recoveries,api);
    await p.evaluate(kind=>{if(kind==='context-loss')document.getElementById('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();else{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}},kind);
    await p.waitForFunction(({api,before})=>window[api].ready&&window[api].graphicsDiagnostics().recoveries>before,{api,before},{timeout:180000});const after=await probe();
    check(folder+' public '+kind+' restores actual edited pixels and one context',after.pixels===edited.pixels&&after.modelHash===edited.modelHash&&after.glError===0&&after.live===1&&JSON.stringify(after.state)===JSON.stringify(edited.state),after);
    check(folder+' public '+kind+' retains bounded disposal callbacks',tracked.every(before=>(after.callbacks.find(x=>x.key===before.key)?.callbacks??0)<=before.callbacks)&&tracked.filter(x=>x.key.startsWith('geometry:')&&x.vertices>=1000).every(before=>after.callbacks.find(x=>x.key===before.key)?.callbacks===before.callbacks),{before:tracked,after:after.callbacks});
   }
   result.pages[folder]={default:first,edited,final:await probe()};await p.locator('#canvas').screenshot({path:path.join(out,folder+'-public-recovered.png')});
  }finally{await ctx.close();}
 }
 check('public recovery has no uncaught page errors',result.errors.length===0,result.errors);result.passed=true;
 }catch(error){result.failure=String(error.stack||error);}finally{fs.writeFileSync(path.join(out,'public-recovery-results.json'),JSON.stringify(result,null,2));}return result;
};
