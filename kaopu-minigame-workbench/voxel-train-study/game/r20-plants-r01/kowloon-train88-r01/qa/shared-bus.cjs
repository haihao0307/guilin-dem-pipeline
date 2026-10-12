// Actual retained game and complete function buildings. Images are QA evidence;
// the deliverable remains the runnable same-game entry, not this image collection.
const{chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const out='train88-shared-bus-results';fs.mkdirSync(out,{recursive:true});
const report={commit:process.env.GITHUB_SHA,status:'running',viewport:[640,426],diagnosticShadow:[96,64],scope:'complete Kowloon and bureau in the original FH88 Session and renderer',errors:[],stages:[],views:[],hardwareAcceptance:false};
const save=()=>fs.writeFileSync(out+'/receipt.json',JSON.stringify(report,null,2));
const server=http.createServer((req,res)=>{const p=path.resolve('.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(process.cwd()+path.sep))return res.writeHead(403).end();try{res.setHeader('content-type',p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.png')?'image/png':p.endsWith('.woff2')?'font/woff2':'text/javascript');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{let browser;await new Promise(r=>server.listen(8784,'127.0.0.1',r));try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu-watchdog','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface']});
 const page=await browser.newPage({viewport:{width:640,height:426}});page.setDefaultTimeout(1200000);
 let fatalReject;const fatal=new Promise((_,reject)=>fatalReject=reject);fatal.catch(()=>{});
 const fail=e=>{report.errors.push(String(e));save();fatalReject(new Error(String(e)));};
 page.on('pageerror',e=>fail(e.message));page.on('console',m=>{if(m.type()==='error')fail(m.text());if(/KOWLOON_STAGE|BUREAU_STAGE/.test(m.text())){report.stages.push({time:new Date().toISOString(),message:m.text()});save();console.log(m.text());}});
 const bounded=p=>Promise.race([p,fatal]);
 const q=new URLSearchParams({bridgeQA:'1',bridgeWidth:'640',bridgeHeight:'426',bridgeShadowWidth:'96',bridgeShadowHeight:'64',bridgeView:'station',bridgeStartTicks:'240'});
 await bounded(page.goto('http://127.0.0.1:8784/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-train88-r01/index.html?'+q,{waitUntil:'domcontentloaded',timeout:1200000}));await bounded(page.waitForFunction(()=>window.__trainDriver?.ready));
 await page.addStyleTag({content:'#driverGame>*:not(#sceneWrap){visibility:hidden!important}#sceneWrap>*:not(canvas){visibility:hidden!important}'});
 function validate(state){for(const key of['kowloonFunction','bureauFunction']){const p=state[key];if(!p.complete||p.unresolved)throw Error(key+' incomplete');if(JSON.stringify(p.testShadowResolution)!==JSON.stringify(report.diagnosticShadow))throw Error(key+' actual shadow dimensions differ');const m=p.shared.projection;if(m[11]!==-1||m[15]!==0)throw Error(key+' lacks ordinary perspective');}if(JSON.stringify(state.cameraProjection.up)!=='[0,1,0]')throw Error('Camera is not upright');}
 let state=await page.evaluate(()=>window.__trainDriver.getState());validate(state);const tick=state.tick,distance=state.distance;
 report.views.push({name:'kowloon-complete-perspective',state});save();await bounded(page.screenshot({path:out+'/kowloon-complete-perspective.png',timeout:180000}));
 for(const [name,id]of[['yaumati-bureau-context','bureau:context'],['bureau-warehouse','bureau:warehouse']]){
  const started=Date.now();state=await bounded(page.evaluate(id=>window.__stationBridgeQA.scene(id),id));validate(state);
  if(state.tick!==tick||state.distance!==distance)throw Error('Observation changed authoritative Session');if(!state.routeObserver.activeStationIndices.includes(1))throw Error('Actual retained Yaumati station was not resident');
  report.views.push({name,id,wallMs:Date.now()-started,state});save();await bounded(page.screenshot({path:out+'/'+name+'.png',timeout:180000}));
 }
 state=await bounded(page.evaluate(()=>window.__stationBridgeQA.returnToDrive()));validate(state);if(state.routeObserver.active)throw Error('Remote observer domain was not retired');if(state.tick!==tick||state.distance!==distance)throw Error('Return changed Session');report.returned=state;save();
 await bounded(page.screenshot({path:out+'/returned-to-driving-platform.png',timeout:180000}));
 report.status='complete-same-game-scenes-rendered-awaiting-visual-review';report.remaining=['visual review','foreground-smoke versus bureau glass ordering','hardware-native interactive cost','resize/context recovery','optional A6 candidate integration'];save();
}catch(e){report.status='failed';report.failure=e.stack;save();process.exitCode=1;}finally{await browser?.close();server.close();}})();
