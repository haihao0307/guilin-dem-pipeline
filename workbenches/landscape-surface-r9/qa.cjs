// Run with Playwright on NODE_PATH, LM_CHROME pointing to Chrome if needed,
// and LM_QA_OUT to an internal screenshot directory outside the source tree.
const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),out=process.env.LM_QA_OUT;
assert(out,'Set LM_QA_OUT to a directory outside the protected source tree');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{try{const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));assert(p.startsWith(root+path.sep));res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(p))}catch(e){res.statusCode=404;res.end('missing')}});
let browser;
(async()=>{
await new Promise(r=>server.listen(8798,'127.0.0.1',r));
browser=await chromium.launch({executablePath:process.env.LM_CHROME||undefined,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:780}}),errors=[],checks=[],frames={};page.on('pageerror',e=>errors.push(e.message));
async function frame(label,expected=initialFP){
 const data=await page.evaluate(()=>({fp:__LM__.bufferFingerprint(),frame:__LM__.auditFrame(),errors:__LM__.errors}));
 assert.equal(data.fp,expected);assert.equal(data.frame.glError,0);assert.equal(data.errors.length,0);assert(data.frame.unique>100);checks.push(label);frames[label]=data.frame;console.log('PASS',label);return data;
}
async function shot(name){await page.evaluate(()=>__LM__.auditFrame());await page.screenshot({path:path.join(out,name+'.png')});}
async function crop(){await page.evaluate(()=>__LM__.auditFrame());return page.screenshot({clip:{x:300,y:180,width:450,height:420}});}
await page.goto('http://127.0.0.1:8798/workbenches/landscape-surface-r9/index.html#micro');
await page.waitForFunction(()=>window.__LM_READY__===true||window.__LM_ERROR__,{},{timeout:240000});
assert.equal(await page.evaluate(()=>window.__LM_ERROR__||null),null);
const initialFP=await page.evaluate(()=>__LM__.bufferFingerprint());assert.notEqual(initialFP,'a91a59e3');const sceneChecks=await page.evaluate(()=>({habitat:__LM__.report.habitat.parts[0],supportFailures:__LM__.report.supports.filter(s=>!s.centerInsideSupportHull).length,motherCollisions:__LM__.report.events.filter(s=>s.insideMotherSamples>0).length,maxWaterError:Math.max(...__LM__.report.waterRouting.map(r=>r.balanceErrorM2)),batches:__LM__.report.renderBatches,mainSignature:__LM__.report.parts[0].signature}));assert.equal(sceneChecks.supportFailures,0);assert.equal(sceneChecks.motherCollisions,0);assert(sceneChecks.maxWaterError<1e-7);assert(sceneChecks.habitat.zones.summit.mean>.3);assert(sceneChecks.habitat.zones.roof.mean<.01);checks.push('final geometry support and summit/roof habitat');const gpuDerivative=await require('../landscape-surface-r7/gpu_derivatives.cjs')(page);checks.push('production GPU frame derivative finite difference');console.log('PASS GPU derivatives',gpuDerivative);
const focus=await page.evaluate(()=>({focus:__LM__.focus,state:__LM__.getState(),hit:__LM__.surfaceHit(innerWidth/2,innerHeight/2)}));
assert(focus.focus);assert(focus.state.view.radius<3);assert(Math.abs(focus.hit.rayDistance-focus.state.view.radius)<1e-5);checks.push('direct micro link focuses a real rendered triangle');
await frame('micro default');await shot('r9-micro');const defaultCrop=await crop();
await page.evaluate(()=>__LM__.setMaterial({scope:0,micro:0}));await frame('both detail controls off');await shot('r9-all-off');const offCrop=await crop();
await page.evaluate(()=>__LM__.setMaterial({scope:1,micro:0}));await frame('microscope independent of legacy micro switch');await shot('r9-microscope-only');const scopeCrop=await crop();assert(!scopeCrop.equals(offCrop));checks.push('visible microscope-only image difference inside canvas');
await page.evaluate(()=>__LM__.setMaterial({scope:1.35,micro:1.4,wet:1}));await frame('maximum detail and wetness keep every buffer');
await page.evaluate(s=>__LM__.restoreState(s),focus.state);await frame('micro state restoration');assert.deepEqual(await page.evaluate(()=>__LM__.getState()),focus.state);assert((await crop()).equals(defaultCrop));checks.push('exact same camera image after state roundtrip');
await page.mouse.move(550,420);await page.mouse.wheel(0,-1450);await page.waitForTimeout(250);assert((await page.evaluate(()=>__LM__.state.radius))<.5);await frame('sub-metre zoom');await shot('r9-ultra');
await page.mouse.wheel(0,-10000);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__LM__.state.radius),.12);await frame('closest allowed zoom');await shot('r9-minimum-zoom');
await page.evaluate(s=>__LM__.restoreState(s),focus.state);const before=await page.evaluate(()=>__LM__.state.theta);
await page.mouse.move(550,420);await page.mouse.down();await page.mouse.move(640,440,{steps:8});await page.mouse.up();await page.waitForTimeout(250);assert.notEqual(await page.evaluate(()=>__LM__.state.theta),before);await frame('near-surface mouse orbit');await shot('r9-micro-side');
await page.locator('[data-view="cliff"]').click();await page.mouse.dblclick(660,400);assert(await page.evaluate(()=>!!__LM__.focus));await frame('double-click picks visible rock');
for(const view of ['hero','cliff','summit','cave','foot','back','stone','section']){await page.locator('[data-view="'+view+'"]').click();await frame(view);await shot('r9-'+view);}
await page.setViewportSize({width:390,height:844});await page.locator('[data-view="micro"]').click();await frame('phone viewport microscope');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('r9-mobile-micro');
const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
const prior=await page.evaluate(()=>__LM__.getState());
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:170,y:390,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:205,y:405,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notEqual(await page.evaluate(()=>__LM__.state.theta),prior.view.theta);await frame('touch orbit');
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:410,id:1},{x:230,y:410,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:100,y:405,id:1},{x:260,y:405,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert((await page.evaluate(()=>__LM__.state.radius))<prior.view.radius);await frame('touch pinch zoom');
await page.locator('#panelbtn').click();await page.locator('#reset').click();await page.locator('#closepanel').click();await frame('mobile reset returns whole specimen');await shot('r9-mobile-hero');
await page.setViewportSize({width:1100,height:780});await page.evaluate(()=>__LM__.build({schema:'landscape-function-world/1',core:'limestone-water-2',seed:211,stage:4,fracture:1,relief:1}));await page.locator('[data-view="micro"]').click();const otherFP=await page.evaluate(()=>__LM__.bufferFingerprint());assert.notEqual(otherFP,initialFP);assert(await page.evaluate(()=>!!__LM__.focus));await frame('another seed has real surface focus',otherFP);
await page.goto('http://127.0.0.1:8798/workbenches/landscape-surface-r8/index.html');await page.waitForFunction(()=>window.__LM_READY__===true,{},{timeout:240000});await page.locator('[data-view=cliff]').click();await frame('R8 reference cliff','a91a59e3');await shot('r8-reference-cliff');
assert.equal(errors.length,0);
const report={date:new Date().toISOString().slice(0,10),htmlSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'index.html'))).digest('hex'),browser:'Chromium headless / SwiftShader',realHTTP:true,physicalPhoneTested:false,hardwarePerformanceApproved:false,geometryFingerprint:initialFP,focusTriangle:focus.focus,sceneChecks,gpuDerivative,checks,frames,errors,visualApproved:false,productionReady:false};
fs.writeFileSync(path.join(__dirname,'QA.json'),JSON.stringify(report,null,2)+'\n');console.log('DONE',checks.length);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server.close()});
