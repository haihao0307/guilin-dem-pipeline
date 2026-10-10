const {chromium,webkit}=require('playwright');
const fs=require('fs'),assert=require('assert');
(async()=>{
 const kind=process.env.STORM_BROWSER||'chromium',dir=`rebuild-${kind}`;fs.mkdirSync(dir,{recursive:true});
 const browser=await ({chromium,webkit}[kind]).launch({headless:true,...(kind==='chromium'?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{} )});
 const page=await browser.newPage({viewport:{width:720,height:882},deviceScaleFactor:1});page.setDefaultTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 let result={stage:'D2 water evidence — NOT FINAL VISUAL APPROVAL',kind};
 async function frame(t){const prior=await page.evaluate(t=>{const f=__storm.getState().renderFrame;__storm.setTime(t);return f;},t);await page.waitForFunction(({t,prior})=>__storm.getState().renderFrame>prior&&__storm.getState().renderedTime===t,{t,prior});}
 async function shot(name){const clip=await page.locator('#stage').boundingBox();assert(clip&&clip.width>0&&clip.height>0);return page.screenshot({path:`${dir}/${name}.png`,clip,timeout:90000});}
 async function inspect(pos,target){await page.evaluate(({pos,target})=>__storm.inspectCamera(pos,target),{pos,target});await frame(2.5);}
 async function sample(enabled){await page.evaluate(v=>__storm.setWaterCaptureEnabled(v),enabled);return page.evaluate(()=>new Promise(resolve=>{const before=__storm.getState().stats.river.captures,start=performance.now();let frames=0,submit=[];function tick(){submit.push(__storm.getState().drawSubmitMilliseconds);if(++frames>=10){const elapsed=performance.now()-start;resolve({frames,milliseconds:elapsed,rafFPS:frames*1000/elapsed,submitMilliseconds:submit,capturePasses:__storm.getState().stats.river.captures-before,drawCalls:__storm.getState().drawCalls,triangles:__storm.getState().triangles});}else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));}
 try{
  await page.goto('http://127.0.0.1:8765/kaopu-minigame-workbench/storm-orb-study/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__storm);await page.evaluate(()=>document.querySelector('.caption').style.visibility='hidden');await frame(2.5);await shot('reference-2_5');
  result.state=await page.evaluate(()=>__storm.getState());result.pixels=await page.evaluate(()=>{const g=__storm.renderer.getContext();return[g.drawingBufferWidth,g.drawingBufferHeight];});assert.equal(result.state.stats.materialStudy.textures,7);
  const idleFrame=result.state.renderFrame;await page.waitForTimeout(500);result.pausedExtraFrames=(await page.evaluate(()=>__storm.getState().renderFrame))-idleFrame;assert(result.pausedExtraFrames<=1,'Paused frame must not redraw continuously');
  for(const p of result.state.stats.foundation){assert(p.bottom<=p.groundY&&p.bottom>p.groundY-.06);assert(p.top>p.groundY);}
  result.river=await page.evaluate(async()=>{const m=await import('./scene.mjs');let min=99,max=-99,buried=0;for(let i=0;i<=220;i++){const z=-2.69+i/220*5.38,e=m.riverEdges(z);for(let j=0;j<=12;j++){const x=m.riverCenter(z)-e[0]+(e[0]+e[1])*j/12,d=m.waterLevel(z)-m.height(x,z);min=Math.min(min,d);max=Math.max(max,d);buried+=d<0;}}return{min,max,buried};});assert.equal(result.river.buried,0);assert(result.river.min>.005);
  await inspect([2.4,2.9,5.8],[.45,.10,.3]);await frame(2.5);const a=await shot('water-t2_5');await frame(2.8);const b=await shot('water-t2_8');assert(!a.equals(b),'Water must visibly flow with fixed camera');
  result.water=await page.evaluate(()=>__storm.getState().stats.river);assert(result.water.normalAngleError<1e-6);assert(result.water.planeMaxResidual<1e-6);assert(result.water.captures>0);await frame(result.water.cycleSeconds-.001);await shot('water-cycle-before');await frame(result.water.cycleSeconds+.001);await shot('water-cycle-after');
  await page.locator('#play').click();result.captureCost={fresh:await sample(true),cached:await sample(false),caveat:'Cloud CI RAF and CPU submission measurements, not mobile GPU performance'};await page.evaluate(()=>__storm.setWaterCaptureEnabled(true));await frame(2.5);
  await page.evaluate(()=>__storm.setEnvelope(true));await frame(2.5);await shot('envelope-2_5');await page.evaluate(()=>__storm.setEnvelope(false));
  await inspect([8,2,12],[1,.5,0]);await shot('foundation-side');await inspect([1,10,4],[0,0,0]);await shot('river-plan');
  await inspect([1.8,3.5,5.5],[-.5,.3,.25]);await shot('material-close-720');await page.evaluate(()=>__storm.setDiagnosticNormalStrength(0));await frame(2.5);await shot('material-close-no-normal');await page.evaluate(()=>__storm.setDiagnosticNormalStrength(.70));
  await page.setViewportSize({width:1440,height:1602});await frame(2.5);await shot('material-close-1440');
  assert.equal(errors.length,0,errors.join('\n'));result.functional='pass';
 }catch(e){result.failure=e.stack;process.exitCode=1;}finally{result.errors=errors;fs.writeFileSync(`${dir}/result.json`,JSON.stringify(result,null,2));await browser.close();}
})();
