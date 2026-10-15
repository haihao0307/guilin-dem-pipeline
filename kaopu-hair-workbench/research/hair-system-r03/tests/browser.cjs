const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const P=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],hostErrors=[],results=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'){const item={text:m.text(),url:m.location().url};if(item.url==='https://htmlpreview.github.io/favicon.ico')hostErrors.push(item);else errors.push(item);}});
  const url=process.argv[2]||'http://127.0.0.1:8767/preview.html';await page.goto(url,{waitUntil:'load',timeout:90000});await page.waitForFunction(()=>window.HAIR_LAB?.snapshot().firstFrameMS>0,null,{timeout:120000});await page.evaluate(()=>HAIR_LAB.setManual(true));
  assert.equal(await page.locator('#layerFilter,[data-specimen="fur"]').count(),0);
  for(const style of ['medium','long']){
   await page.evaluate(v=>HAIR_LAB.setStyle(v),style);await page.evaluate(()=>{HAIR_LAB.resetDynamics();document.getElementById('full').click();});await page.evaluate(()=>HAIR_LAB.renderFrame());
   const before=await page.evaluate(()=>({state:HAIR_LAB.snapshot(),nodes:HAIR_LAB.readMotionNodes()}));assert.equal(before.state.style,style);
   if(!await page.locator('#brushMotion').evaluate(e=>e.classList.contains('selected')))await page.click('#brushMotion');
   const point=await page.evaluate(()=>{
    const s=HAIR_LAB.snapshot(),q=HAIR_LAB.guidePoint(42,.66),b=document.querySelector('canvas').getBoundingClientRect(),dx=q[0]-s.camera.target[0],dy=q[1]-s.camera.target[1],dz=q[2]-s.camera.target[2],yaw=s.camera.yaw,pitch=s.camera.pitch;
    const x=Math.cos(yaw)*dx-Math.sin(yaw)*dz,z=Math.sin(yaw)*dx+Math.cos(yaw)*dz,y=Math.cos(pitch)*dy-Math.sin(pitch)*z,depth=s.camera.distance-(Math.sin(pitch)*dy+Math.cos(pitch)*z),scale=1/Math.tan(31*Math.PI/360);
    return {x:b.x+b.width*.5+x/depth*scale*b.height*.5,y:b.y+b.height*.5-y/depth*scale*b.height*.5};
   });
   await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+95,point.y-20,{steps:12});
   await page.evaluate(()=>{for(let i=0;i<30;i++)HAIR_LAB.stepDynamics(1/60);});await page.evaluate(()=>HAIR_LAB.renderFrame());
   const held=await page.evaluate(()=>({state:HAIR_LAB.snapshot(),nodes:HAIR_LAB.readMotionNodes()}));assert.ok(held.state.guideMotion.maxOffset>.003,'Native pointer grab must deform hair');assert.equal(held.state.signature,before.state.signature);
   assert.ok(held.state.guideMotion.maxRelativeStretch<1e-4);for(let i=0;i<before.nodes.length;i++)assert.deepEqual(held.nodes[i].position,before.nodes[i].position);
   await page.screenshot({path:path.join(P,'qa',style+'-pointer-grab.png')});await page.mouse.up();
   await page.evaluate(()=>{for(let i=0;i<180;i++)HAIR_LAB.stepDynamics(1/60);});const released=await page.evaluate(()=>HAIR_LAB.snapshot());assert.ok(released.guideMotion.maxVelocity<.05);
   await page.evaluate(()=>HAIR_LAB.resetDynamics());await page.evaluate(()=>HAIR_LAB.renderFrame());
   const normal=await page.evaluate(()=>HAIR_LAB.capture());await page.click('#weightsView');await page.evaluate(()=>HAIR_LAB.renderFrame());const debug=await page.evaluate(()=>HAIR_LAB.capture());assert.notEqual(normal,debug);await page.click('#weightsView');
   await page.evaluate(()=>HAIR_LAB.setWeights(0,0));await page.evaluate(()=>HAIR_LAB.renderFrame());const loose=await page.evaluate(()=>HAIR_LAB.capture());await page.evaluate(()=>HAIR_LAB.setWeights(.88,.22));await page.evaluate(()=>HAIR_LAB.renderFrame());assert.notEqual(loose,await page.evaluate(()=>HAIR_LAB.capture()));
   const optical=[];for(const mode of [0,1,2,3]){await page.evaluate(v=>HAIR_LAB.setParam('mode',v),mode);await page.evaluate(()=>HAIR_LAB.renderFrame());optical.push(await page.evaluate(()=>HAIR_LAB.capture()));}assert.equal(new Set(optical).size,4);await page.evaluate(()=>HAIR_LAB.setParam('mode',0));
   results.push({style,before:before.state,held:held.state,released,rootPositionsStable:true,shaderWeightPixelChanges:true,opticalModeCount:new Set(optical).size});
  }
  await page.click('#pauseMotion');const count=await page.evaluate(()=>HAIR_LAB.snapshot().guideMotion.steps);await page.evaluate(()=>HAIR_LAB.stepDynamics(.05));assert.equal(await page.evaluate(()=>HAIR_LAB.snapshot().guideMotion.steps),count);
  fs.writeFileSync(path.join(P,'qa/interaction-report.json'),JSON.stringify({passed:errors.length===0,url,desktopMouseControlled:false,sourceHashes:JSON.parse(fs.readFileSync(path.join(P,'BUILD_MANIFEST.json'))).files,errors,hostErrors,results},null,2));assert.equal(errors.length,0);console.log('Both lengths passed native pointer/GPU root/shader weight/optical checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
