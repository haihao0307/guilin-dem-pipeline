const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {spawnSync}=require('child_process');
const {webkit,chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=process.env.HAIR_QA_OUT||path.join(ROOT,'qa-ios-startup');
fs.mkdirSync(OUT,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const result={purpose:'Observe unchanged production startup using actual Linux WebKit and Chromium',physicalIPhoneTested:false,fullRegressionPassed:false,runtimeModified:false,engines:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(OUT,'webkit-startup-results.json'),JSON.stringify(result,null,2));
const assetBase='https://raw.githubusercontent.com/xrblocks/assets-gnm/134feb02b11fa642a43ff5e7e880246255a74e86/';
const assets={'gnm_head_web.bin':'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961','gnm_samplers_web.bin':'827fc7850022cbc62d4401c6f6782b876c4dfa48f2a6f446d9644b0ba2b8122b'};
function instrument(){
 window.__startupTrace=[];window.__contexts=[];
 const add=(stage,value={})=>{if(window.__startupTrace.length<160)window.__startupTrace.push({stage,at:Math.round(performance.now()),...value});};
 const gc=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(...args){let gl;try{gl=gc.apply(this,args);if(args[0]==='webgl2'){if(gl&&!window.__contexts.includes(gl)){window.__contexts.push(gl);this.addEventListener('webglcontextlost',e=>add('context-lost',{statusMessage:e.statusMessage}));this.addEventListener('webglcontextrestored',()=>add('context-restored'));}add('getContext',{type:args[0],id:this.id,attributes:args[1],returned:!!gl,lost:gl?.isContextLost(),width:this.width,height:this.height});}return gl;}catch(e){add('getContext-throw',{message:String(e)});throw e;}};
 addEventListener('webglcontextcreationerror',e=>add('context-creation-error',{statusMessage:e.statusMessage}),true);
 for(const proto of [window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  for(const method of ['getShaderPrecisionFormat','createShader','createProgram','getShaderParameter','getProgramParameter','drawArrays','drawElements']){
   const fn=proto[method];let count=0;
   proto[method]=function(...args){const value=fn.apply(this,args);count++;if(method==='getShaderPrecisionFormat')add(method,{shader:args[0],level:args[1],value:value?{precision:value.precision,rangeMin:value.rangeMin,rangeMax:value.rangeMax}:null,lost:this.isContextLost()});
   else if((method==='createShader'||method==='createProgram')&&!value)add(method+'-null',{lost:this.isContextLost()});
   else if(method==='getShaderParameter'&&args[1]===this.COMPILE_STATUS&&!value)add('shader-compile-failure',{log:this.getShaderInfoLog(args[0]),lost:this.isContextLost()});
   else if(method==='getProgramParameter'&&args[1]===this.LINK_STATUS&&!value)add('program-link-failure',{log:this.getProgramInfoLog(args[0]),lost:this.isContextLost()});
   else if(method.startsWith('draw')&&count<=3)add(method,{count,lost:this.isContextLost()});return value;};
  }
 }
 addEventListener('pagehide',e=>add('pagehide',{persisted:e.persisted}));addEventListener('pageshow',e=>add('pageshow',{persisted:e.persisted}));document.addEventListener('visibilitychange',()=>add('visibility',{hidden:document.hidden}));
}
let server;
(async()=>{try{
 // Only the pinned official browser package is used. No repository workflow or permissions change.
 const packageFile=require.resolve('playwright/package.json'),browserPackage=JSON.parse(fs.readFileSync(packageFile));
 const cli=path.resolve(path.dirname(packageFile),browserPackage.bin.playwright);
 if(browserPackage.version!=='1.55.0')throw Error('Expected official Playwright 1.55.0');
 const install=spawnSync(process.execPath,[cli,'install','--with-deps','webkit'],{encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
 result.webkitInstall={status:install.status,error:install.error?.message};fs.writeFileSync(path.join(OUT,'webkit-install.log'),String(install.stdout||'')+String(install.stderr||''));save();
 if(install.status!==0)throw Error('Official WebKit installation failed; see bounded install log');
 const modelBytes={};for(const [file,hash]of Object.entries(assets)){const r=await fetch(assetBase+file);if(!r.ok)throw Error('Model HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());if(sha(b)!==hash)throw Error('Model hash mismatch '+file);modelBytes[file]=b;}
 result.runtimeHashes={};for(const kind of ['gnm-groom-editor','gnm-study'])for(const file of ['src/GraphicsLifecycle.js',kind==='gnm-groom-editor'?'src/experiment.js':'src/app.js','vendor/three.module.js']){const rel='qa/'+kind+'/'+file;result.runtimeHashes[rel]=sha(fs.readFileSync(path.join(ROOT,rel)));}
 server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://x');if(u.pathname==='/blank'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Startup diagnostic</title>');return;}const candidate=u.pathname.startsWith('/candidate/'),rel=candidate?u.pathname.slice(10):u.pathname;let p=candidate&&rel.endsWith('/src/GraphicsLifecycle.js')?path.join(__dirname,'fixtures/GraphicsLifecycle.candidate.js'):path.join(ROOT,rel);if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.setHeader('content-type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(p));}catch{res.writeHead(404);res.end('missing');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 for(const [name,type]of [['webkit',webkit],['chromium',chromium]]){
  const engine={name,host:process.platform,started:false,pages:[]};result.engines.push(engine);save();let browser;
  try{
   browser=await type.launch(name==='chromium'?{headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{headless:true});engine.started=true;engine.version=browser.version();
   let ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true}),page=await ctx.newPage();await page.goto(base+'/blank');
   engine.tiny=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=64;document.body.append(c);let error=null;c.addEventListener('webglcontextcreationerror',e=>error=e.statusMessage);const g=c.getContext('webgl2',{alpha:true,depth:true,stencil:false,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance',failIfMajorPerformanceCaveat:false});if(!g)return {context:false,error};const vao=g.createVertexArray(),vaoBefore=vao?g.isVertexArray(vao):null;g.bindVertexArray(vao);const vaoAfter=vao?g.isVertexArray(vao):null;const vaoProbe={created:!!vao,beforeBind:vaoBefore,afterBind:vaoAfter,error:g.getError()};const precision=[];for(const stage of [g.VERTEX_SHADER,g.FRAGMENT_SHADER])for(const level of [g.HIGH_FLOAT,g.MEDIUM_FLOAT]){const v=g.getShaderPrecisionFormat(stage,level);precision.push({stage,level,value:v?{precision:v.precision,rangeMin:v.rangeMin,rangeMax:v.rangeMax}:null});}const shader=(type,src)=>{const s=g.createShader(type);if(!s)return null;g.shaderSource(s,src);g.compileShader(s);return s;};const v=shader(g.VERTEX_SHADER,'#version 300 es\nprecision highp float;void main(){vec2 p=vec2((gl_VertexID==1)?3.0:-1.0,(gl_VertexID==2)?3.0:-1.0);gl_Position=vec4(p,0.,1.);}'),f=shader(g.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(.2,.4,.8,1.);}');let linked=false;if(v&&f){const p=g.createProgram();if(p){g.attachShader(p,v);g.attachShader(p,f);g.linkProgram(p);linked=g.getProgramParameter(p,g.LINK_STATUS);g.useProgram(p);g.drawArrays(g.TRIANGLES,0,3);}}const pixel=new Uint8Array(4);g.readPixels(2,2,1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);const out={context:true,vaoProbe,precision,linked,pixel:[...pixel],error:g.getError(),lost:g.isContextLost(),renderer:g.getParameter(g.RENDERER)};g.getExtension('WEBGL_lose_context')?.loseContext();return out;});
   await ctx.close();save();console.log(name,'tiny',JSON.stringify(engine.tiny));
   if(!engine.tiny.context||!engine.tiny.linked||engine.tiny.lost){engine.appStage='not-run: tiny real WebGL2 unavailable';continue;}
   for(const kind of ['gnm-groom-editor','gnm-study']){
    const item={kind,ready:false,pageErrors:[],consoleErrors:[]};engine.pages.push(item);save();
    ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});await ctx.addInitScript(instrument);
    await ctx.route(assetBase+'*',route=>route.fulfill({body:modelBytes[new URL(route.request().url()).pathname.split('/').pop()],contentType:'application/octet-stream'}));
    page=await ctx.newPage();page.on('pageerror',e=>item.pageErrors.push(String(e)));page.on('console',m=>{if(m.type()==='error')item.consoleErrors.push(m.text());});
    const api=kind==='gnm-groom-editor'?'groomStudy':'gnmStudy';await page.goto(base+'/qa/'+kind+'/'+(kind==='gnm-groom-editor'?'experiment.html':'index.html'),{waitUntil:'domcontentloaded'});
    try{await page.waitForFunction(api=>window[api]?.ready||window[api]?.graphicsDiagnostics?.().phase==='error',api,{timeout:180000});}catch(e){item.waitError=String(e);}
    item.state=await page.evaluate(api=>({ready:window[api]?.ready,graphics:window[api]?.graphicsDiagnostics?.(),trace:window.__startupTrace,visible:!document.hidden,error:document.getElementById('error')?.textContent,canvas:{width:document.getElementById('canvas')?.width,height:document.getElementById('canvas')?.height},liveContexts:window.__contexts.filter(g=>!g.isContextLost()).length}),api);item.ready=!!item.state.ready;
    if(item.ready)item.pixels=await page.evaluate(api=>{window[api].render();const g=document.getElementById('canvas').getContext('webgl2'),a=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,a);let hash=2166136261,visible=0;const colors=new Set();for(let i=0;i<a.length;i++){if(i%16===0&&colors.size<1024)colors.add((a[i]<<16)|(a[i+1]<<8)|a[i+2]);hash=Math.imul(hash^a[i],16777619)>>>0;if(i%4===0&&(a[i]!==a[i+1]||a[i+1]!==a[i+2]))visible++;}const positions=new Float32Array(window[api].getPositions());let positionHash=2166136261;for(const b of new Uint8Array(positions.buffer))positionHash=Math.imul(positionHash^b,16777619)>>>0;return {hash,visible,uniqueColors:colors.size,positionHash,error:g.getError(),lost:g.isContextLost()};},api);
    save();await page.screenshot({path:path.join(OUT,name+'-'+kind+'-baseline.png'),fullPage:true,timeout:60000});await ctx.close();if(item.ready)item.candidate=await require('./webkit-startup-candidate.cjs')(browser,{engine:name,kind,base,assetBase,modelBytes,baseline:item.pixels,output:OUT});save();console.log(name,kind,JSON.stringify({ready:item.ready,graphics:item.state.graphics,pixels:item.pixels}));
   }
  }catch(e){engine.error=String(e.stack||e);}finally{await browser?.close();save();}
 }
 result.observationCompleted=result.engines.some(x=>x.started);result.iphoneIssueResolved=false;result.candidatePassed=result.engines.length===2&&result.engines.every(e=>e.started&&e.pages.length===2&&e.pages.every(p=>p.ready&&p.pixels?.uniqueColors>64&&p.pixels.positionHash===1686585375&&p.pixels.error===0&&p.candidate?.passed));if(!result.candidatePassed)process.exitCode=1;
}catch(e){result.errors.push(String(e.stack||e));process.exitCode=1;}finally{save();if(server)await new Promise(r=>server.close(r));}})();
