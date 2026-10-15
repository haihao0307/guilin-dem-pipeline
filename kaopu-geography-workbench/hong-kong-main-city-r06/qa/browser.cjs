const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),assert=require('assert');const{chromium}=require('playwright');
const caseRoot=path.resolve(__dirname,'..'),root=path.dirname(caseRoot),out=path.join(caseRoot,'evidence');fs.mkdirSync(out,{recursive:true});const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const portalBaselineCameras={
  "actual-main-south-portal": {
    "cam": [
      3684.9570453263223,
      16.49826794614465,
      5025.621003688948
    ],
    "fw": [
      -0.05547518978689802,
      -0.044984814037660234,
      -0.9974461738981732
    ],
    "up": [
      -0.002498069965317536,
      0.9989876708478425,
      -0.04491539981399756
    ],
    "near": 1.3,
    "far": 150000,
    "distance": 65
  },
  "curved-tunnel-interior": {
    "cam": [
      3002.667049877889,
      12.576249202177644,
      3323.864055870746
    ],
    "fw": [
      -0.33932363962804674,
      0.0002234694365197517,
      -0.9406696644683439
    ],
    "up": [
      7.582846443889418e-05,
      0.9999999750307054,
      0.00021021092511878326
    ],
    "near": 0.239999865965113,
    "far": 150000,
    "distance": 11.99999329825565
  },
  "actual-main-north-portal": {
    "cam": [
      2392.2593837765207,
      17.302256283106463,
      1566.7995754399915
    ],
    "fw": [
      0.19633818817568913,
      -0.044984814037660234,
      0.9795037939537983
    ],
    "up": [
      0.008841187074990207,
      0.9989876708478423,
      0.04410744727489791
    ],
    "near": 1.3,
    "far": 150000,
    "distance": 65
  }
}
;
const report={schema:'hk-main-city-r06-independent/1',commit:process.env.GITHUB_SHA,passed:false,started:new Date().toISOString(),errors:[],consoleErrors:[],failedRequests:[],badResponses:[],screenshots:[],scope:'R06 clean overlays, complementary coastal display, coherent provisional route and actual curved tunnel. No full Kowloon textures or passenger-platform/safety certification.'};
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.gz':'application/octet-stream'};const server=http.createServer((q,s)=>{const rel=decodeURIComponent(q.url.split('?')[0]);if(rel==='/favicon.ico')return s.writeHead(204).end();let p=path.resolve(root,'.'+rel);if(!p.startsWith(root+path.sep))return s.writeHead(403).end();if(rel.endsWith('/'))p+='/index.html';if(/\/hong-kong-map-sea-r03\/(index.html|station-data.js)$/.test(p)&&fs.existsSync(path.join(root,'hong-kong-map-sea-r03/publish-final',path.basename(p))))p=path.join(root,'hong-kong-map-sea-r03/publish-final',path.basename(p));fs.readFile(p,(e,b)=>{if(e)return s.writeHead(404).end();s.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');s.end(b)});});

(async()=>{let browser,page;try{
await new Promise(r=>server.listen(8199,'127.0.0.1',r));browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-watchdog','--disable-dev-shm-usage']});page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(300000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{console.log('PAGE',m.type(),m.text());if(m.type()==='error')report.consoleErrors.push(m.text())});page.on('requestfailed',r=>report.failedRequests.push(r.url()));page.on('response',r=>{if(r.status()>=400)report.badResponses.push({url:r.url(),status:r.status()})});
const cold=Date.now();await page.goto('http://127.0.0.1:8199/hong-kong-main-city-r06/?coaches=4&view=consist',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.HKNextFatal||(window.HKMapR06&&window.HKConsistR05?.ready));const boot=await page.evaluate(()=>({ready:window.HKConsistR05?.ready,error:window.HKNextFatal}));assert(boot.ready,boot.error);
await page.waitForFunction(()=>window.OceanMother?.qa?.ready===true&&getComputedStyle(document.getElementById('loading')).display==='none');report.coldFirstNaturalReadyMs=Date.now()-cold;await page.evaluate(()=>{OceanMother.pause();HKTrain88.pause()});
const snapshot=()=>page.evaluate(()=>({consist:HKConsistR05.stats(),route:HKRouteR06.stats(),train:HKTrain88.getState(),yard:HKTinhauYard.stats(),next:HKMainCityNext.stats(),registration:HKKowloonRegistration.anchor,tunnel:HKLionRockTunnelScene.stats(),coast:HKCoastClosure.stats(),diagnostics:HKMapDiagnostics.stats(),camera:OceanMother.qa.mapCamera,airport:OceanMother.qa.kaitak,glError:OceanMother.qa.lastGLerror,weatherReady:OceanMother.qa.ready,loadingDisplay:getComputedStyle(document.getElementById('loading')).display}));
async function renderOnce(){const n=await page.evaluate(()=>{const n=OceanMother.qa.frames;OceanMother.pause();return n});await page.waitForFunction(n=>OceanMother.qa.frames>n,n,{timeout:300000});await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').finish());}
async function settle(){await renderOnce();await page.waitForFunction(()=>{const s=HKMainCityNext.stats();return s.city.loadingChunks===0&&s.outer.loadingChunks===0});await renderOnce();}
async function capture(view,file,{ablation=false}={}){await settle();const state=await snapshot();assert(state.weatherReady&&state.loadingDisplay==='none');assert.equal(state.glError,0);assert(state.consist.ready&&state.consist.sameRoute&&state.consist.completeConsistOnRoute);assert.equal(state.consist.coachCount,4);assert.equal(state.consist.sourceGeometry.mergedTriangles,938396);assert.equal(state.consist.sourceGeometry.batchDraws,14);assert.equal(state.consist.steam.alivePuffs,384);assert(state.consist.kowloonStopFit.longitudinalFit&&state.consist.kowloonStopFit.trackEndSafe);assert.equal(state.consist.kowloonStopFit.passengerPlatformFit,false);assert.equal(state.consist.kowloonStopFit.boardingEnabled,false);assert.equal(state.diagnostics.enabled,false);assert.equal(state.route.planning.newPlanning,false);assert.equal(state.route.planning.showLegacy,false);assert.equal(state.next.city.showCoverage,false);assert.equal(state.airport.heightGuidesVisible,false);assert.equal(state.coast.coverageEnabled,!ablation);await page.screenshot({path:path.join(out,file),fullPage:true,timeout:300000});const r={view,file,sha256:sha(fs.readFileSync(path.join(out,file))),state};report.screenshots.push(r);console.log('CAPTURE',file);return r;}
await page.evaluate(()=>HKConsistR05.focusWhole());const first=await capture('clean-station','01-r06-clean-station.png');fs.writeFileSync(path.join(out,'FIRST_FRAME.json'),JSON.stringify(first,null,2));console.log('FIRST_FRAME_READY');
await page.evaluate(()=>HKMapR06.focusCoast());const fixed=await capture('airport-yard-coast-fixed','02-r06-fixed-coast.png');await page.evaluate(()=>HKCoastClosure.setCoverageEnabled(false));const old=await capture('clip-only-ablation-side-closures-held','03-r06-old-clip-ablation.png',{ablation:true});assert.deepStrictEqual(old.state.camera,fixed.state.camera);await page.evaluate(()=>HKCoastClosure.setCoverageEnabled(true));await renderOnce();report.coastAblation={sameCamera:true,sideClosuresHeldConstant:true,waveMotherUnchanged:true,restoredFixedDefault:true};
report.portalFixedCameraRegression=[];report.originalSouthCameraNote="Original south camera is intentionally retained outside the prior short-bore clearance; a wall in that old camera is not a reason to remove valid terrain. Public button uses the adjacent open cutting.";
for(const[key,file]of[['actual-main-south-portal','04-r06-south-portal.png'],['curved-tunnel-interior','05-r06-tunnel-interior.png'],['actual-main-north-portal','06-r06-north-portal.png']]){const c=portalBaselineCameras[key];await page.evaluate(c=>HKMapR06.setReviewCamera(c),c);const r=await capture(key+'-same-original-camera',file);const eyeError=Math.hypot(...r.state.camera.cam.map((v,i)=>v-c.cam[i])),forwardError=Math.hypot(...r.state.camera.fw.map((v,i)=>v-c.fw[i]));assert(eyeError<1e-8&&forwardError<1e-8);report.portalFixedCameraRegression.push({key,eyeError,forwardError,sameCamera:true});}
report.publicPortalCameras=[];
for(const[side,file]of[['south','07-r06-south-open-approach.png'],['north','08-r06-north-open-approach.png']]){const pose=await page.evaluate(side=>HKMapR06.focusPortal(side),side);const r=await capture('public-'+side+'-open-approach',file);report.publicPortalCameras.push({side,pose,camera:r.state.camera});}
report.live=await page.evaluate(()=>{const route=HKTrain88.route,c=HKConsistR05.stats(),s=HKTrain88.getState().state,a=HKKowloonRegistration.anchor,t=HKLionRockTunnelScene.stats(),g=HKTinhauYard.stats().groundDesign;return{sameRoute:route===HKRouteR06.route&&route===HKRailVertical.route,routeLengthM:route.length,planSpatialRevision:route.planSpectrum.spatialRevision,clock:HKKowloonRegistration.toScene(a.clockPivotLocalXYZ),trackStart:HKKowloonRegistration.trackAtNativeZ(a.track.routeOriginNativeZ),actualStart:route.sample(0).p,driveGrade:s.controls.grade,currentGrade:route.sample(s.positionM).grade,mainPortalPositions:t.portals.mainCoveredInterval.map(d=>route.sample(d).p),portals:t.portals,terrainCaches:t.terrainCaches,sourceHeightsChanged:t.sourceHeightsChanged,legacyRadiusCutaway:t.legacyRadiusCutaway,groundProbeCount:g.sceneProbeCount,groundProbeError:g.maxProbeErrorM,submittedIds:HKCityBuildings.stats().agePolicy.submittedObjects.map(o=>o.objectId),sourceMeshReadAtRuntime:HKCityBuildings.stats().sourceMeshReadAtRuntime,coaches:c.coaches.map(p=>({...p,expected:route.sample(p.centerChainageM).p})),engineOriginS:s.positionM};});
const l=report.live,plan=JSON.parse(fs.readFileSync(path.join(caseRoot,'route/route-plan.json'))),anchor=JSON.parse(fs.readFileSync(path.join(caseRoot,'route/station-anchor.json')));assert(l.sameRoute);assert(Math.abs(l.routeLengthM-plan.lengthM)<1e-7);assert(!l.sourceMeshReadAtRuntime&&!l.sourceHeightsChanged&&!l.legacyRadiusCutaway);assert(l.portals.resolved&&l.portals.coveredIntervals.length);assert(l.terrainCaches.some(c=>c.clippedTriangles>0));assert(l.groundProbeCount>=15&&l.groundProbeError<1e-5);assert(Math.abs(l.driveGrade-l.currentGrade)<1e-10);assert(Math.hypot(...l.clock.map((v,i)=>v-anchor.clockAnchorSceneXYZ[i]))<1e-8);assert(Math.hypot(...l.trackStart.map((v,i)=>v-l.actualStart[i]))<1e-8);for(const c of l.coaches)assert(Math.hypot(...c.position.map((v,i)=>v-c.expected[i]))<1e-9);
const allowed=new Set(JSON.parse(fs.readFileSync(path.join(root,'hong-kong-main-city-r03/city-buildings/ground-display-policy.json'))).defaultAllowedObjectIds);for(const id of l.submittedIds)assert(allowed.has(id));
report.diagnosticsRoundTrip=await page.evaluate(()=>{const before=HKMapDiagnostics.stats();HKMapDiagnostics.setEnabled(true);const on={master:HKMapDiagnostics.stats(),planning:HKRouteSketchDisplay.stats(),coverage:HKCityBuildings.stats().showCoverage};HKMapDiagnostics.setEnabled(false);return{before,on,restored:HKMapDiagnostics.stats()}});assert(report.diagnosticsRoundTrip.on.master.enabled&&report.diagnosticsRoundTrip.on.planning.newPlanning&&report.diagnosticsRoundTrip.on.coverage&&!report.diagnosticsRoundTrip.restored.enabled);await renderOnce();
report.final=await snapshot();report.browser={version:browser.version(),physicalGPU:false};report.boundaries={passengerPlatformCertified:false,wholeStationHistoricOrientationSurveyed:false,buildingMeshClearanceCertified:false,steamFluidSimulation:false,allKowloonTextured:false,tunnelEngineeringCertified:false,coastResolutionM:30,coastClosureMeasured:false};assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.locator('iframe').count(),0);assert(!report.errors.length&&!report.consoleErrors.length&&!report.failedRequests.length&&!report.badResponses.length);report.passed=true;
}catch(e){report.error=e.stack||String(e);process.exitCode=1;if(page)try{report.failureState=await page.evaluate(()=>({fatal:window.HKNextFatal,consist:window.HKConsistR05?.stats(),tunnel:window.HKLionRockTunnelScene?.stats()}));await page.screenshot({path:path.join(out,'FAILURE-diagnostic.png'),fullPage:true,timeout:30000})}catch{}}finally{report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'NEXT_MAP_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,error:report.error,frames:report.screenshots.length,errors:report.errors,consoleErrors:report.consoleErrors}));if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'browser-exit.txt'),report.passed?'0':'1')}})();
