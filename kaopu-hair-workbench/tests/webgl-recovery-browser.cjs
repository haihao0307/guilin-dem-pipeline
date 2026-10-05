const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {chromium}=require('playwright');
const ROOT=process.env.HAIR_RECOVERY_ROOT||path.resolve(__dirname,'..'),OUT=process.env.HAIR_QA_OUT||path.join(ROOT,'qa-webgl-recovery'),KIND=process.env.HAIR_RECOVERY_PAGE||'gnm-groom-editor';
const filename=KIND==='gnm-groom-editor'?'experiment.html':'index.html',api=KIND==='gnm-groom-editor'?'groomStudy':'gnmStudy';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={passed:false,physicalIPhoneTested:false,fullRegressionPassed:false,contactAcceptance:false,kind:KIND,checks:[],errors:[],rounds:[]};
fs.mkdirSync(OUT,{recursive:true});const save=()=>fs.writeFileSync(path.join(OUT,KIND+'-results.json'),JSON.stringify(result,null,2));
function check(name,pass,detail){result.checks.push({name,pass:!!pass,detail});save();console.log(pass?'PASS':'FAIL',name);if(!pass)throw Error(name+' '+JSON.stringify(detail));}
async function get(url){const r=await fetch(url);if(!r.ok)throw Error(url+' '+r.status);return Buffer.from(await r.arrayBuffer());}
let browser,server,tempWork;
(async()=>{try{
 const pin=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/webgl-recovery-baseline.json'))),original=path.join(tempWork=fs.mkdtempSync(require('os').tmpdir()+'/hair-gl-'),'baseline');
 fs.cpSync(path.join(ROOT,'qa',KIND),path.join(original,KIND),{recursive:true});
 for(const f of pin.files.filter(x=>x.path.startsWith('qa/'+KIND+'/'))){const bytes=await get('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+pin.baseCommit+'/kaopu-hair-workbench/'+f.path);check('pinned original '+f.path,sha(bytes)===f.sha256);fs.writeFileSync(path.join(original,KIND,f.path.split('/').slice(2).join('/')),bytes);}
 const assetRoot=path.join(tempWork,'assets');fs.mkdirSync(assetRoot,{recursive:true});
 for(const [file,hash]of Object.entries(pin.assets)){const b=await get(pin.assetBase+file);check('official model '+file,sha(b)===hash);fs.writeFileSync(path.join(assetRoot,file),b);}
 server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://x');if(u.pathname==='/blank'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><title>Navigation test</title><a href="javascript:history.back()">Back</a>');return;}if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}let p=u.pathname.startsWith('/baseline/')?path.join(original,u.pathname.slice(10)):path.join(ROOT,u.pathname);if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.setHeader('content-type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end('missing');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,ignoreDefaultArgs:['--disable-back-forward-cache'],args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 async function context(mode='none'){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
  await ctx.addInitScript(mode=>{
   window.__glMode=mode;window.__allGL=[];if(mode==='interrupt-load'){const request=window.fetch;let once=false;window.fetch=function(...args){if(!once&&String(args[0]).includes('gnm_head_web.bin')){once=true;setTimeout(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})),25);setTimeout(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})),150);}return request.apply(this,args);};}const orig=HTMLCanvasElement.prototype.getContext,query=WebGL2RenderingContext.prototype.getShaderPrecisionFormat;
   HTMLCanvasElement.prototype.getContext=function(...args){const gl=orig.apply(this,args);if(args[0]==='webgl2'&&gl&&!window.__allGL.includes(gl))window.__allGL.push(gl);return gl;};
   const n=new WeakMap();WebGL2RenderingContext.prototype.getShaderPrecisionFormat=function(...args){const count=(n.get(this)||0)+1;n.set(this,count);if(window.__glMode==='permanent'||(this===window.__allGL[0]&&(window.__glMode==='first'||(window.__glMode==='after-probe'&&count>4))))return null;return query.apply(this,args);};
  },mode);
  let requests=0;await ctx.route(pin.assetBase+'*',async route=>{requests++;if(mode==='interrupt-load'&&requests===1)await new Promise(r=>setTimeout(r,400));await route.fulfill({path:path.join(assetRoot,new URL(route.request().url()).pathname.split('/').pop()),contentType:'application/octet-stream'}).catch(()=>{});});
  const page=await ctx.newPage();page.setDefaultTimeout(180000);page.on('pageerror',e=>{result.errors.push(String(e));save();});
  return {ctx,page,requests:()=>requests};
 }
 const target=process.env.HAIR_RECOVERY_PUBLIC_URL||base+'/qa/'+KIND+'/'+filename;
 async function ready(page){await page.waitForFunction(api=>window[api]?.ready,{api}.api,{timeout:240000});}
 async function probe(page){return page.evaluate(api=>{
  const app=window[api],d=app.diagnostics?app.diagnostics():app.getDiagnostics();app.render();const g=document.getElementById('canvas').getContext('webgl2'),bytes=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,bytes);
  const hash=a=>{let h=2166136261;for(const x of a)h=Math.imul(h^x,16777619)>>>0;return h;};
  const positions=new Float32Array(app.getPositions());let state=api==='groomStudy'?app.getState():app.getState();delete state.graphics;
  return {pixels:hash(bytes),positionHash:hash(new Uint8Array(positions.buffer)),state,camera:d.camera,geometryHashes:d.geometryHashes||null,graphics:app.graphicsDiagnostics?.(),glError:g.getError(),liveContexts:window.__allGL.filter(x=>!x.isContextLost()).length,canvases:document.querySelectorAll('canvas').length};
 },api);}
 let run=await context();await run.page.goto(base+'/baseline/'+KIND+'/'+filename,{waitUntil:'domcontentloaded'});await ready(run.page);result.baseline=await probe(run.page);await run.page.locator('#canvas').screenshot({path:path.join(OUT,KIND+'-baseline.png')});await run.ctx.close();
 run=await context('permanent');await run.page.goto(target,{waitUntil:'domcontentloaded'});await run.page.waitForSelector('#graphicsRetry');
 check('permanent precision null has bounded graphics-specific retry',await run.page.evaluate(api=>{const d=window[api].graphicsDiagnostics();return d.attempts===2&&d.phase==='error'&&d.activeContexts===0&&document.getElementById('error').textContent.includes('图形环境')&&!document.getElementById('error').textContent.includes('getMaxPrecision');},api));
 check('graphics failure never starts model downloads',run.requests()===0);
 await run.page.screenshot({path:path.join(OUT,KIND+'-graphics-error-mobile.png'),fullPage:true});
 await run.page.evaluate(()=>{window.__glMode='none';for(let i=0;i<3;i++)document.getElementById('graphicsRetry').click();});await ready(run.page);
 result.default=await probe(run.page);check('default pixels and geometry equal accepted original',result.default.pixels===result.baseline.pixels&&result.default.positionHash===result.baseline.positionHash&&JSON.stringify(result.default.geometryHashes)===JSON.stringify(result.baseline.geometryHashes),{baseline:result.baseline,current:result.default});
 check('rapid retry creates one live canvas/context',result.default.canvases===1&&result.default.liveContexts===1&&result.default.graphics.attempts===3,result.default.graphics);
 await run.page.locator('#canvas').screenshot({path:path.join(OUT,KIND+'-recovered-default.png')});
 await run.page.evaluate(api=>{const a=window[api];if(api==='groomStudy'){a.setGroom({hairColor:'#704129',hairLength:80,browsWidth:130,beardVisible:true,beardLength:20});a.setCamera('front');a.setZoom(2);}else{a.setGroom('hair',{color:'#704129',length:.08});a.setGroom('beard',{visible:true,length:.004});a.setCamera('front');a.setZoom(2);}},api);
 const edited=await probe(run.page);result.edited=edited;
 for(let i=0;i<20;i++){
  const previous=await run.page.evaluate(api=>window[api].graphicsDiagnostics().recoveries,api);
  if(i%5===4){await run.page.evaluate(()=>{window.__lostGL=document.getElementById('canvas').getContext('webgl2');window.__lostGL.getExtension('WEBGL_lose_context').loseContext();});if(i===14){await run.page.waitForSelector('#graphicsRetry');await run.page.locator('#graphicsRetry').click();}}
  else{
   await run.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
   check('round '+i+' releases graphics while hidden',await run.page.evaluate(api=>window[api].graphicsDiagnostics().activeContexts===0&&!window[api].ready,api));
   await run.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  }
  await run.page.waitForFunction(({api,previous})=>window[api].ready&&window[api].graphicsDiagnostics().recoveries>previous,{api,previous},{timeout:180000});
  const now=await probe(run.page);result.rounds.push({round:i,pixels:now.pixels,liveContexts:now.liveContexts,graphics:now.graphics});
  check('round '+i+' preserves edited pixels, geometry, camera and state',now.pixels===edited.pixels&&now.positionHash===edited.positionHash&&JSON.stringify(now.geometryHashes)===JSON.stringify(edited.geometryHashes)&&JSON.stringify(now.state)===JSON.stringify(edited.state)&&JSON.stringify(now.camera)===JSON.stringify(edited.camera)&&now.liveContexts===1&&now.canvases===1&&now.glError===0,{pixels:now.pixels,expected:edited.pixels,camera:now.camera,expectedCamera:edited.camera,stateEqual:JSON.stringify(now.state)===JSON.stringify(edited.state),live:now.liveContexts,gl:now.glError});
 }
 await run.page.locator('#canvas').screenshot({path:path.join(OUT,KIND+'-after-20-reentries.png')});
 const box=await run.page.locator('#canvas').boundingBox();await run.page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await run.page.mouse.down();await run.page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});await ready(run.page);await run.page.mouse.up();const beforeDrag=(await probe(run.page)).camera;await run.page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await run.page.mouse.down();await run.page.mouse.move(box.x+box.width*.7,box.y+box.height*.5,{steps:3});await run.page.mouse.up();check('interrupted gesture recovers fresh drag',JSON.stringify((await probe(run.page)).camera)!==JSON.stringify(beforeDrag));await run.page.goto(base+'/blank');await run.page.goBack({waitUntil:'domcontentloaded'});await ready(run.page);check('real browser Back reopens a usable single context',(await probe(run.page)).liveContexts===1);await run.page.goForward({waitUntil:'domcontentloaded'});await run.page.goBack({waitUntil:'domcontentloaded'});await ready(run.page);check('second Back/Forward works',(await probe(run.page)).glError===0);await run.ctx.close();
 run=await context('after-probe');await run.page.goto(target,{waitUntil:'domcontentloaded'});await ready(run.page);const post=await probe(run.page);check('null inside Three constructor retries with fresh canvas',post.graphics.attempts===2&&post.liveContexts===1&&post.pixels===result.baseline.pixels,post);await run.ctx.close();
 run=await context('interrupt-load');await run.page.goto(target,{waitUntil:'domcontentloaded'});await ready(run.page);const interrupted=await probe(run.page);check('pagehide during model loading cannot resurrect stale GPU',interrupted.liveContexts===1&&interrupted.graphics.history.some(x=>x.event==='pagehide')&&interrupted.pixels===result.baseline.pixels,interrupted);await run.ctx.close();
 check('no uncaught JS errors',result.errors.length===0,result.errors);result.passed=true;
}catch(e){result.failure=String(e.stack||e);console.error(e);process.exitCode=1;}finally{save();await browser?.close();if(server)await new Promise(r=>server.close(r));if(tempWork)fs.rmSync(tempWork,{recursive:true,force:true});}})();
