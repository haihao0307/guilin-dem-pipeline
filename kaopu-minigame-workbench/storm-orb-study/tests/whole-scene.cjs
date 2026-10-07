const {chromium,webkit}=require('playwright');const fs=require('fs'),assert=require('assert');
(async()=>{
 const kind=process.env.STORM_BROWSER||'chromium',dir=`whole-${kind}`;fs.mkdirSync(dir,{recursive:true});const result={kind,stage:'G1 single subtractive bedrock study, pending human visual review',errors:[],frames:[]};
 const browser=await ({chromium,webkit}[kind]).launch({headless:true,...(kind==='chromium'?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{} )});const page=await browser.newPage({viewport:{width:720,height:882},deviceScaleFactor:1});page.setDefaultTimeout(180000);page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
 async function frame(t,name){const started=Date.now(),prior=await page.evaluate(t=>{const f=__storm.getState().renderFrame;__storm.setTime(t);return f;},t);await page.waitForFunction(({t,prior})=>__storm.getState().renderFrame>prior&&__storm.getState().renderedTime===t,{t,prior});const clip=await page.locator('#stage').boundingBox();await page.screenshot({path:`${dir}/${name}.png`,clip,timeout:180000});result.frames.push({name,t,renderAndCaptureMilliseconds:Date.now()-started,state:await page.evaluate(()=>__storm.getState())});}
 try{
  await page.goto('http://127.0.0.1:8765/kaopu-minigame-workbench/storm-orb-study/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__storm);await page.evaluate(()=>document.querySelector('.caption').style.visibility='hidden');await frame(2.5,'whole-reference-2_5');
  const s=await page.evaluate(()=>__storm.getState());assert.equal(s.pixelRatio,1);assert.equal(s.stats.cloud.renderScale,1);assert(s.stats.cloud.actualBuffers.some(b=>b.width===720&&b.height===720));assert(s.stats.cloud.actualBuffers.every(b=>b.renderScale===1));assert(s.stats.cloud.depthPrepass);assert(s.stats.rain.segments>0);for(const foot of s.stats.foundation)assert(foot.gap<=0&&foot.gap>-.06);assert(s.stats.river.planeMaxResidual<1e-6);
  await page.evaluate(pos=>__storm.inspectCamera(pos,[0,1.3,0]),s.camera);await frame(2.9,'whole-fixed-t2_9');
  await page.evaluate(()=>__storm.inspectCamera([8,1.9,12],[0,1.3,0]));await frame(2.5,'whole-low-angle-depth');
  await page.evaluate(()=>__storm.inspectCamera([-2.6,1.8,4.0],[-1.1,.35,1]));await frame(2.5,'bedrock-close-fixed');
  await page.evaluate(()=>__storm.setDiagnosticNormalStrength(0));await frame(2.5,'bedrock-close-geometry-only-normal');
  await page.evaluate(()=>__storm.setDiagnosticNormalStrength(.7));
  await page.evaluate(()=>__storm.setCloudVisible(false));await frame(2.5,'without-volume-depth-reference');
  assert.equal(result.errors.length,0,result.errors.join('\n'));result.functional='pass';result.performanceCaveat='Render-and-capture latency is not FPS; full dynamic/mobile performance is not established by this stage.';
 }catch(e){result.failure=e.stack;process.exitCode=1;}finally{fs.writeFileSync(`${dir}/result.json`,JSON.stringify(result,null,2));await browser.close();}
})();
