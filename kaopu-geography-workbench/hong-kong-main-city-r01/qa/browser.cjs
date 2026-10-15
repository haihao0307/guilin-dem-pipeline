// New main-map integration acceptance. Does not complete the older airport task.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),assert=require('assert');
const {chromium}=require('playwright');
const caseRoot=path.resolve(__dirname,'..'),root=path.dirname(caseRoot),out=path.join(caseRoot,'evidence');fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={schema:'hk-main-city-integration-qa/1',commit:process.env.GITHUB_SHA,passed:false,started:new Date().toISOString(),scope:'New integrated map: fixed R03 terrain, existing 88/Kai Tak/calibrated clock tower layers and explicitly progressive KAOPU building recipes. This is not completion of the old independent airport task or a claim all source models are displayed.',errors:[],failedRequests:[],badResponses:[],screenshots:[]};
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.gz':'application/octet-stream'};
const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]);if(rel==='/favicon.ico')return s.writeHead(204).end();let p=path.resolve(root,'.'+rel);if(!p.startsWith(root+path.sep))return s.writeHead(403).end();if(rel.endsWith('/'))p+='/index.html';// Local checkout stores the same verified R03 bytes in publish-final.
 if(/\/hong-kong-map-sea-r03\/(index.html|station-data.js)$/.test(p)&&fs.existsSync(path.join(root,'hong-kong-map-sea-r03/publish-final',path.basename(p))))p=path.join(root,'hong-kong-map-sea-r03/publish-final',path.basename(p));
 fs.readFile(p,(e,b)=>{if(e)return s.writeHead(404).end();s.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');s.end(b);});});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(8199,'127.0.0.1',r));browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-watchdog','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.setDefaultTimeout(300000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>console.log('PAGE',m.type(),m.text()));page.on('requestfailed',r=>report.failedRequests.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.badResponses.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:8199/hong-kong-main-city-r01/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.getElementById('load-status')?.textContent.startsWith('未能')||document.getElementById('error')?.textContent.trim()||window.HKCityBuildings?.ready||window.OceanMother?.qa?.cityBuildings?.fatalError);
 const boot=await page.evaluate(()=>({ready:window.HKCityBuildings?.ready,error:document.getElementById('load-status')?.textContent||document.getElementById('error')?.textContent||window.OceanMother?.qa?.cityBuildings?.fatalError}));assert(boot.ready,boot.error);
 const weatherWaitStart=Date.now();
 await page.waitForFunction(()=>window.OceanMother?.qa?.ready===true&&document.getElementById('loading')&&getComputedStyle(document.getElementById('loading')).display==='none');
 report.weatherInitialization={waitMs:Date.now()-weatherWaitStart,readiness:await page.evaluate(()=>OceanMother.getReadiness())};
 await page.evaluate(()=>{OceanMother.pause();HKTrain88.pause();HKCityBuildings.focusTile('11-NW-15B');});
 await page.waitForFunction(()=>HKCityBuildings.getState().visibleModels>0&&HKCityBuildings.getState().loadingChunks===0);
 const snapshot=()=>page.evaluate(()=>({city:HKCityBuildings.getState(),map:HKMap.getState(),airport:HKKaiTak.getState(),train:HKTrain88.getState(),gl:OceanMother.qa.lastGLerror,weatherReady:OceanMother.qa.ready,loadingDisplay:getComputedStyle(document.getElementById('loading')).display,cityCountText:document.getElementById('cityCounts').textContent}));
 async function shot(file){
  await page.waitForTimeout(400);
  await page.waitForFunction(()=>HKCityBuildings.getState().loadingChunks===0);
  const n=await page.evaluate(()=>{const n=HKCityBuildings.getState().frames;OceanMother.pause();return n;});
  await page.waitForFunction(n=>HKCityBuildings.getState().frames>n,n,{timeout:30000});
  await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').finish());
  const before=await snapshot();assert(before.weatherReady&&before.loadingDisplay==='none','Real weather initialization must finish before capture');
  assert(before.cityCountText.includes(`当前已画 ${before.city.visibleModels}。`),'UI and rendered count disagree before capture');
  await page.screenshot({path:path.join(out,file),fullPage:true,timeout:300000});
  const state=await snapshot();assert.equal(state.city.visibleModels,before.city.visibleModels,'Rendered count changed during capture');
  assert(state.weatherReady&&state.loadingDisplay==='none');
  const item={file,sha256:sha(fs.readFileSync(path.join(out,file))),beforeState:before,state};report.screenshots.push(item);return item;
 }
 const groundProbeInput=JSON.parse(fs.readFileSync(path.join(caseRoot,'qa/ground-probes.json'),'utf8'));
 report.groundProbes=await page.evaluate(probes=>probes.map(p=>({...p,terrainSamples:p.terrainQueriesLocalXZ.map(([x,z])=>({x,z,terrainY:HKMap.sampleHeight(x,z)}))})),groundProbeInput.probes);
 fs.writeFileSync(path.join(out,'GROUND_PROBES.json'),JSON.stringify(report.groundProbes,null,2));
 const first=await shot('01-main-map-first-city.png');fs.writeFileSync(path.join(out,'FIRST_FRAME.json'),JSON.stringify(first,null,2));console.log('FIRST_FRAME_READY');
 assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('iframe').count(),0);assert.equal(first.state.city.sourceTiles,113);assert.equal(first.state.city.sourceModels,23414);assert.equal(first.state.city.usableSourceModels,23413);assert.equal(first.state.map.heightExaggeration,1);assert.equal(first.state.city.sourceMeshReadAtRuntime,false);
 report.captureScope='One real desktop view after natural weather initialization, original camera focus and one explicit render request; five source/model/terrain height probes. Earlier interaction suite retained separately.';
 report.groundProbes.forEach(p=>{p.terrainCenterY=p.terrainSamples[0].terrainY;p.baseMinusTerrainM=p.displayBaseEGM2008===null?null:p.displayBaseEGM2008-p.terrainCenterY;p.roofMinusTerrainM=p.displayRoofEGM2008===null?null:p.displayRoofEGM2008-p.terrainCenterY;});
 fs.writeFileSync(path.join(out,'GROUND_PROBES.json'),JSON.stringify(report.groundProbes,null,2));
 report.final=await snapshot();report.browser={name:browser.version(),physicalGPU:false,backend:await page.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl2'),d=g.getExtension('WEBGL_debug_renderer_info');return d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)})};
 for(const s of report.screenshots){assert.equal(s.state.gl,0);assert(s.state.city.gpuBytes<=s.state.city.gpuBudgetBytes);assert(s.state.airport.triangleCount>100);}
 assert(!report.errors.length&&!report.failedRequests.length&&!report.badResponses.length);report.passed=true;
}catch(e){report.error=e.stack||String(e);process.exitCode=1;}finally{report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'MAIN_MAP_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'browser-exit.txt'),report.passed?'0':'1');}})();
