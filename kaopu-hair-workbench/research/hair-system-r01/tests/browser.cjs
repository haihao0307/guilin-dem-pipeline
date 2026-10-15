const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const P=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],hostResourceErrors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'){if(m.location().url==='https://htmlpreview.github.io/favicon.ico')hostResourceErrors.push({text:m.text(),url:m.location().url});else errors.push(m.text());}});
  const url=process.argv[2]||'http://127.0.0.1:8765/';await page.goto(url,{waitUntil:'load',timeout:90000});
  await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:120000});
  assert.equal(await page.locator('[data-specimen="fur"],#layerFilter').count(),0);
  assert.equal(await page.locator('body').innerText().then(x=>/底绒|针毛|短绒|毛皮/.test(x)),false);
  await page.evaluate(()=>HAIR_LAB.setManual(true));
  const before=await page.evaluate(()=>({state:HAIR_LAB.snapshot(),nodes:HAIR_LAB.readMotionNodes()}));
  await page.click('#brushMotion');
  const point=await page.evaluate(()=>{
   const s=HAIR_LAB.snapshot(),q=HAIR_LAB.guidePoint(42,.67),b=document.querySelector('canvas').getBoundingClientRect();
   // Project the known central guide for the initial near-frontal camera.
   const dx=q[0]-s.camera.target[0],dy=q[1]-s.camera.target[1],dz=q[2]-s.camera.target[2],yaw=s.camera.yaw,pitch=s.camera.pitch;
   const x=Math.cos(yaw)*dx-Math.sin(yaw)*dz,z=Math.sin(yaw)*dx+Math.cos(yaw)*dz,y=Math.cos(pitch)*dy-Math.sin(pitch)*z,depth=s.camera.distance-(Math.sin(pitch)*dy+Math.cos(pitch)*z),scale=1/Math.tan(31*Math.PI/360);
   return {x:b.x+b.width*.5+x/depth*scale*b.height*.5,y:b.y+b.height*.5-y/depth*scale*b.height*.5};
  });
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+95,point.y-30,{steps:12});
  await page.evaluate(()=>{for(let i=0;i<60;i++)HAIR_LAB.stepDynamics(1/120);});
  await page.evaluate(()=>HAIR_LAB.renderFrame());
  const held=await page.evaluate(()=>({state:HAIR_LAB.snapshot(),nodes:HAIR_LAB.readMotionNodes()}));
  assert.ok(held.state.guideMotion.maxOffset>.001,'Real pointer grab produces guide deformation');
  assert.equal(held.state.signature,before.state.signature);
  for(let i=0;i<before.nodes.length;i++)assert.deepEqual(held.nodes[i].position,before.nodes[i].position);
  await page.screenshot({path:path.join(P,'qa/hair-grab.png')});
  await page.mouse.up();
  await page.evaluate(()=>{for(let i=0;i<960;i++)HAIR_LAB.stepDynamics(1/120);});
  const released=await page.evaluate(()=>HAIR_LAB.snapshot());
  assert.ok(released.guideMotion.maxOffset<held.state.guideMotion.maxOffset*.15);
  const modes=[];
  for(const mode of [0,1,2,3]){
   await page.evaluate(v=>HAIR_LAB.setParam('mode',v),mode);await page.evaluate(()=>HAIR_LAB.renderFrame());
   modes.push(await page.evaluate(()=>HAIR_LAB.capture()));
  }
  assert.equal(new Set(modes).size,4,'Optical diagnostic modes are visibly different');
  await page.evaluate(()=>{HAIR_LAB.setParam('mode',0);HAIR_LAB.setWind(1.5);HAIR_LAB.setWindEnabled(true);for(let i=0;i<600;i++)HAIR_LAB.stepDynamics(1/120);});
  await page.evaluate(()=>HAIR_LAB.renderFrame());const wind=await page.evaluate(()=>HAIR_LAB.snapshot());
  assert.ok(wind.guideMotion.maxRelativeStretch<1e-10);assert.ok(wind.guideMotion.maxOffset>0.001&&wind.guideMotion.maxOffset<.2);
  await page.evaluate(()=>{HAIR_LAB.resetDynamics();HAIR_LAB.setWindEnabled(true);});
  await page.click('#pauseMotion');const paused=await page.evaluate(()=>HAIR_LAB.snapshot());await page.evaluate(()=>HAIR_LAB.stepDynamics(.05));assert.equal((await page.evaluate(()=>HAIR_LAB.snapshot())).guideMotion.steps,paused.guideMotion.steps);
  await page.click('#resetMotion');
  const report={passed:true,url,desktopMouseControlled:false,errors,hostResourceErrors,sourceHashes:JSON.parse(fs.readFileSync(path.join(P,'BUILD_MANIFEST.json'))).files,checks:['long hair only UI','actual pointer grab','GPU fixed roots','stable root signature','release recovery','R/TT/TRT and gray mode changes','maximum wind stability','pause freeze'],before:before.state,held:held.state,released,wind};
  fs.writeFileSync(path.join(P,'qa/interaction-report.json'),JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log('Actual browser interaction checks passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
