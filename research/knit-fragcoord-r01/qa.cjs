// Software-WebGPU correctness tests, not a hardware performance or visual-fidelity acceptance.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=__dirname,out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
const template=fs.readFileSync(path.join(root,'template.html'),'utf8');
const html=template.replace('__FIELD__',fs.readFileSync(path.join(root,'field.glsl'),'utf8')).replace('__RENDER__',fs.readFileSync(path.join(root,'test-fixture-render.glsl'),'utf8')).replace('__APP__',fs.readFileSync(path.join(root,'runtime.js'),'utf8'));
fs.writeFileSync(path.join(root,'diagnostic.html'),html);
const buildSha256=crypto.createHash('sha256').update(html).digest('hex');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:640,height:720},deviceScaleFactor:1});
 const errors=[],network=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(/^https?:/i.test(r.url()))network.push(r.url());});
 const result={buildSha256,testFixtureOnly:true,visualAcceptance:false,productionReady:false,softwareRendering:true,hardwarePerformanceClaimed:false,mobilePhysicalDeviceTested:false,checks,errors,network};
 async function completed(n=2){const start=await page.evaluate(()=>window.__KNIT__.frames);await page.waitForFunction(s=>window.__KNIT__.errors.length||window.__KNIT__.frames>=s+2,start,{timeout:150000});const q=await page.evaluate(()=>({errors:window.__KNIT__.errors,frames:window.__KNIT__.frames}));assert.equal(q.errors.length,0,JSON.stringify(q.errors));}
 try{
  await page.goto(pathToFileURL(path.join(root,'diagnostic.html')).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__KNIT__&&(window.__KNIT__.ready||window.__KNIT__.errors.length),null,{timeout:180000});
  let q=await page.evaluate(()=>({ready:window.__KNIT__.ready,errors:window.__KNIT__.errors,adapter:window.__KNIT__.adapter}));
  assert.equal(q.errors.length,0,JSON.stringify(q.errors));assert.equal(q.ready,true);
  await completed();const a=await page.evaluate(()=>window.__KNIT__.probe());
  assert.ok(a.bins>40,JSON.stringify(a));assert.ok(a.brownFraction>.08,JSON.stringify(a));assert.equal(a.opaqueFraction,1);
  await page.screenshot({path:path.join(out,'collar.png')});checks.push({name:'actual-compute-image',result:a});
  await completed();const same=await page.evaluate(()=>window.__KNIT__.probe());assert.equal(a.sha256,same.sha256);checks.push({name:'fixed-view-deterministic',passed:true});
  await page.mouse.move(300,300);await page.mouse.down();await page.mouse.move(430,330,{steps:6});await page.mouse.up();await completed();const rotated=await page.evaluate(()=>window.__KNIT__.probe());assert.notEqual(rotated.sha256,a.sha256);checks.push({name:'pointer-orbit',result:rotated});
  await page.locator('[data-view="whole"]').click();await completed();const whole=await page.evaluate(()=>window.__KNIT__.probe());assert.equal(whole.view,'whole');assert.notEqual(whole.sha256,rotated.sha256);await page.screenshot({path:path.join(out,'carrier-UNACCEPTED.png')});checks.push({name:'isolated-carrier-view',result:whole});
  await page.locator('#options').click();await page.locator('#fuzz').uncheck();await completed();const yarn=await page.evaluate(()=>window.__KNIT__.probe());assert.notEqual(yarn.sha256,whole.sha256);checks.push({name:'fuzz-control',result:yarn});
  await page.locator('#closePanel').click();await page.locator('[data-view="collar"]').click();await completed();
  await page.setViewportSize({width:390,height:700});await completed();const narrow=await page.evaluate(()=>window.__KNIT__.probe());assert.equal(narrow.resolution[0],390);checks.push({name:'narrow-viewport-not-physical-phone',result:narrow});
  const before=await page.evaluate(()=>window.__KNIT__.frames);await completed();const after=await page.evaluate(()=>window.__KNIT__.frames);assert.ok(after>before);assert.equal(network.length,0);assert.equal(errors.length,0);
  result.runtime=await page.evaluate(()=>({build:window.__KNIT__.build,frames:window.__KNIT__.frames,adapter:window.__KNIT__.adapter,cacheBytes:window.__KNIT__.cacheBytes,cacheBuildMs:window.__KNIT__.cacheBuildMs,resolution:window.__KNIT__.resolution,completedFPS:window.__KNIT__.completedFPS,errors:window.__KNIT__.errors}));
  result.correctnessTestsPassed=true;
 }catch(e){result.correctnessTestsPassed=false;result.failure=String(e.stack||e);try{result.runtime=await page.evaluate(()=>window.__KNIT__?{errors:window.__KNIT__.errors,frames:window.__KNIT__.frames,ready:window.__KNIT__.ready}:null);await page.screenshot({path:path.join(out,'failure.png')});}catch(_){}process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify(result,null,2));console.log('KNIT_TEST_RESULT\n'+JSON.stringify(result,null,2));await browser.close();}
})();
