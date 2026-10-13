// Original query -> compact -> advance -> full normal -> material architecture.
// Capture completion has no hidden 30-minute page deadline. Startup, progress,
// render-step and whole-job limits are separate and declared in the workflow.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http');
const {closeOwnedBrowser}=require('../../kowloon-train88-r01/qa/bounded-browser.cjs');
const view=process.argv[2]||'towerWhole',smoke=process.env.HERITAGE_SMOKE==='1';
const {layout}=require('./heritage-review-layout.cjs');
const tileIndex=process.env.HERITAGE_TILE_INDEX===undefined?null:Number(process.env.HERITAGE_TILE_INDEX);
const {width,height,scale,crop,tile,suffix}=layout(view,{smoke,scale:process.env.HERITAGE_REVIEW_SCALE||1,tileIndex});
const out='heritage-staged-'+view+suffix;fs.mkdirSync(out,{recursive:true});
const report={commit:process.env.GITHUB_SHA,modelCommit:process.env.HERITAGE_MODEL_COMMIT||process.env.GITHUB_SHA,attempt:Number(process.env.GITHUB_RUN_ATTEMPT||1),view,tile,status:'running',crop,canvas:[width,height],scale,shadow:[16,16],scope:(smoke?'18x18 diagnostic only; not architectural image acceptance. ':scale===.5?'Small native architectural review; human review precedes larger crops. ':'')+'native perspective crop from the original complete shared host using R05 architecture; low-resolution shadow diagnostic, not final scene or realtime acceptance',stages:[],errors:[]};
const atomicJSON=(name,value)=>{fs.writeFileSync(out+'/'+name+'.tmp',JSON.stringify(value,null,2));fs.renameSync(out+'/'+name+'.tmp',out+'/'+name);};
const save=()=>atomicJSON('receipt.json',report);
const server=http.createServer((req,res)=>{
 const p0=path.resolve('.'+decodeURIComponent(req.url.split('?')[0]));
 if(!p0.startsWith(process.cwd()+'/'))return res.writeHead(403).end();
 try{let p=p0;if(fs.statSync(p).isDirectory())p+='/index.html';res.setHeader('content-type',p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/javascript');res.end(fs.readFileSync(p));}
 catch{res.writeHead(404).end();}
});
(async()=>{
 let browser,owner,page,timer,reject;
 const fatal=new Promise((_,r)=>reject=r);fatal.catch(()=>{});
 const bounded=p=>Promise.race([p,fatal]);
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>reject(Error('No complete GPU stage for 240000ms')),240000);};
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  owner=await chromium.launchServer({headless:true,timeout:45000,args:['--no-sandbox','--disable-gpu-watchdog','--use-angle=swiftshader','--enable-logging=stderr']});
  for(const stream of ['stdout','stderr'])owner.process()[stream]?.on('data',x=>fs.appendFileSync(out+'/browser-'+stream+'.log',x));
  browser=await chromium.connect(owner.wsEndpoint(),{timeout:45000});
  page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});page.setDefaultTimeout(45000);
  page.on('pageerror',e=>{report.errors.push(e.message);save();reject(e);});
  page.on('console',m=>{
   const text=m.text();
   if(/HERITAGE_STARTUP|KOWLOON_STAGE|BUREAU_STAGE/.test(text)){
    if(/group-submitted|trace-batch/.test(text)&&!report.firstGPUProgressAt)report.firstGPUProgressAt=new Date().toISOString();
    report.stages.push({at:new Date().toISOString(),message:text});console.log(text);save();arm();
   }else if(m.type()==='error'){report.errors.push(text);save();reject(Error(text));}
  });
  const q=new URLSearchParams({bridgeQA:'1',bridgeCompactTrace:'1',bridgeActiveQueryBounds:'1',bridgeStageTiming:'1',bridgeWidth:String(width),bridgeHeight:String(height),bridgeShadowWidth:'16',bridgeShadowHeight:'16',bridgeView:'station',bridgeStartTicks:'240',bridgeCrop:JSON.stringify(crop),heritageView:view});
  arm();
  await bounded(page.goto('http://127.0.0.1:'+server.address().port+'/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-heritage-host-qa/index.html?'+q,{waitUntil:'domcontentloaded',timeout:45000}));
  await bounded(page.waitForFunction(()=>window.__heritageReviewStartup?.viewsBound,null,{timeout:45000}));
  report.startup=await bounded(page.evaluate(()=>window.__heritageReviewStartup));save();
  // The progress watchdog and render-step/job limits own this wait. A page
  // default must never discard a fully completed 31-minute GPU readback again.
  await bounded(page.waitForFunction(()=>window.__trainDriver?.ready,null,{timeout:0}));
  report.state=await bounded(page.evaluate(()=>window.__trainDriver.getState()));save();
  report.canvas=await bounded(page.evaluate(()=>{const c=document.querySelector('#sceneWrap canvas'),r=c.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,buffer:[c.width,c.height],dpr:devicePixelRatio};}));save();
  if(report.canvas.w!==width||report.canvas.h!==height||report.canvas.buffer.join(',')!==[width,height].join(',')||report.canvas.dpr!==1)throw Error('Native canvas unexpectedly resampled');
  await bounded(page.addStyleTag({content:'#driverGame>*:not(#sceneWrap){visibility:hidden!important}#sceneWrap>*:not(canvas){visibility:hidden!important}'}));
  // Save the actual completed frame and raw diagnostics before acceptance
  // assertions. A later bad normal/unresolved check cannot erase the evidence.
  await bounded(page.screenshot({path:out+'/perspective.png',timeout:45000}));
  await bounded(page.screenshot({path:out+'/native-crop.png',clip:{x:report.canvas.x+crop.x,y:report.canvas.y+crop.y,width:crop.w,height:crop.h},timeout:45000}));
  if(tile)await bounded(page.screenshot({path:out+'/tile-core.png',clip:{x:report.canvas.x+tile.core.x,y:report.canvas.y+tile.core.y,width:tile.core.w,height:tile.core.h},timeout:45000}));
  report.savedImageAt=new Date().toISOString();save();
  const raw=await bounded(page.evaluate(()=>window.__stationBridgeQA.focusReadback()));
  atomicJSON('readback.json',raw);
  report.readback={buffers:Object.keys(raw.buffers),footprint:raw.footprint};save();
  const station=report.state.kowloonFunction;
  if(process.env.HERITAGE_EXPECTED_FIELD_SHA&&station.sourceSHA256!==process.env.HERITAGE_EXPECTED_FIELD_SHA)throw Error('Frozen field source hash changed');
  if(!station.complete||station.unresolved||!station.shadowComplete||!station.hit)throw Error('Incomplete original staged function frame');
  if(station.shared.projection[11]!==-1||station.shared.projection[15]!==0)throw Error('Perspective camera required');
  const lens=report.state.cameraProjection;
  if(Math.abs(lens.fov-37.485728670400334)>1e-8||Math.abs(lens.zoom-.78)>1e-8||Math.abs(lens.aspect-640/426)>1e-8)throw Error('Heritage lens changed from the verified 640x426 view');
  report.status=report.errors.length?'rendered-with-errors':smoke?'native-smoke-rendered-not-visual-acceptance':'rendered-for-architectural-review';save();
  if(report.errors.length)process.exitCode=1;
 }catch(e){report.status='failed';report.failure=e.stack;save();process.exitCode=1;}
 finally{clearTimeout(timer);report.cleanup=await closeOwnedBrowser(browser,owner);save();server.closeAllConnections();server.close();}
})();
