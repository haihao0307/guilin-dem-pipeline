const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,webkit}=require('playwright');
const {clickControl,openSettings,closeSettings}=require('./browser-controls.cjs');
const engine=process.env.TRAIN_BROWSER||'chromium',out='anchored-zoom-'+engine,base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';fs.mkdirSync(out,{recursive:true});
const pose=v=>({position:v.position,target:v.target,zoom:v.zoom,...v.projection?{projection:v.projection}:{}});
const near=(a,b,label,tol=.5)=>assert(Math.hypot(a[0]-b[0],a[1]-b[1])<tol,label+': '+JSON.stringify({a,b,tol}));
(async()=>{const browser=await({chromium,webkit})[engine].launch(),checks=[],errors=[];try{
 for(const size of [{width:2048,height:1016,dpr:1},{width:1920,height:1000,dpr:2},{width:390,height:844,dpr:1}]){
  const context=await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:size.dpr,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/game/app.mjs*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\n'+fs.readFileSync(__dirname+'/browser-harness.mjs','utf8')});});
  await page.goto(base);await page.waitForFunction(()=>window.__trainDriver?.test);await page.locator('#startGame').click();
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(120);
  const evidence=()=>page.evaluate(()=>__trainDriver.test.cameraEvidence()),state=()=>page.evaluate(()=>__trainDriver.getState());
  const canvas=await page.locator('#gameScene').boundingBox(),cx=canvas.x+canvas.width*.55,cy=canvas.y+canvas.height*.55;
  const initial=await evidence();await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+24,cy-18,{steps:5});await page.mouse.up();
  const manual=await evidence();assert.equal(manual.profile.manual,true);assert.notDeepEqual(manual.position,initial.position,'Actual pointer orbit adjusts the camera');
  let wheelMaxDrift=0;
  for(const delta of [-35,-35,-35,-35,-35,20,20]){const before=await evidence();await page.mouse.wheel(0,delta);await page.waitForFunction(z=>__trainDriver.getState().viewSettings.zoom!==z,before.zoom,{polling:20});const after=await evidence();const drift=Math.hypot(after.center[0]-before.center[0],after.center[1]-before.center[1]);wheelMaxDrift=Math.max(wheelMaxDrift,drift);near(after.center,before.center,'Repeated wheel holds manually adjusted train center');assert(delta<0?after.span[0]>before.span[0]:after.span[0]<before.span[0]);}
  let nativePinch='Playwright WebKit does not expose native multi-touch injection',pinchMaxDrift=null,panDelta=null,cancelNoStaleGesture=null;
  if(engine==='chromium'){
   const cdp=await context.newCDPSession(page),before=await evidence();let distance=30;pinchMaxDrift=0;
   const points=(d,dx=0,dy=0)=>[{x:cx-d+dx,y:cy+dy,id:1},{x:cx+d+dx,y:cy+dy,id:2}];
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(distance)});
   for(const d of [34,38,42,46]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(d)});const e=await evidence();pinchMaxDrift=Math.max(pinchMaxDrift,Math.hypot(e.center[0]-before.center[0],e.center[1]-before.center[1]));near(e.center,before.center,'Symmetric native pinch keeps subject fixed');distance=d;}
   const beforePan=await evidence();await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(distance,15,12)});const afterPan=await evidence();const rotated=(await state()).viewSettings.rotated;panDelta=rotated?[12,-15]:[15,12];near(afterPan.center,[beforePan.center[0]+panDelta[0],beforePan.center[1]+panDelta[1]],'Native pinch midpoint moves subject by the exact logical pixel delta');
   assert(afterPan.zoom>before.zoom*1.4);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   const cancelled=await evidence();await page.mouse.move(cx+80,cy+35);near((await evidence()).center,cancelled.center,'Cancelled touches leave no stale gesture');cancelNoStaleGesture=true;nativePinch=true;await cdp.detach();
  }
  // Resize and fullscreen may change projection, but may not rewrite a saved pose.
  const saved=pose((await state()).viewSettings),beforeResize=await evidence();
  const resized=size.width>1000?{width:2560,height:1336}:{width:844,height:390};await page.setViewportSize(resized);await page.waitForTimeout(120);assert.deepEqual(pose((await state()).viewSettings),saved,'Resize preserves manually adjusted pose and zoom');const afterResize=await evidence();assert(Number.isFinite(afterResize.fov));
  if(size.width>1000){assert(Math.abs(afterResize.span[0]/afterResize.width-beforeResize.span[0]/beforeResize.width)<1e-6,'Horizontal projection preserves relative width through desktop resize');}
  await clickControl(page,'fullScreen');const full=await page.evaluate(()=>!!document.fullscreenElement);assert.deepEqual(pose((await state()).viewSettings),saved,'Actual fullscreen action preserves pose');if(full){await clickControl(page,'fullScreen');await page.waitForFunction(()=>!document.fullscreenElement,null,{timeout:10000});assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false);assert.deepEqual(pose((await state()).viewSettings),saved,'Exiting fullscreen preserves pose');}
  await page.setViewportSize({width:size.width,height:size.height});await page.waitForTimeout(120);assert.deepEqual(pose((await state()).viewSettings),saved);
  await clickControl(page,'lockView');const locked=pose((await state()).viewSettings);await page.mouse.move(cx,cy);await page.mouse.wheel(0,-150);await page.waitForTimeout(100);assert.deepEqual(pose((await state()).viewSettings),locked,'Lock blocks wheel zoom');
  await page.reload();await page.waitForFunction(()=>window.__trainDriver?.test);assert.deepEqual(pose((await state()).viewSettings),locked,'Reload preserves adjusted pose and projection');assert.equal((await state()).qualityMode,'clear');assert.equal((await state()).renderRatio,size.dpr);
  checks.push({size,wheelMaxDrift,nativePinch,pinchMaxDrift,panDelta,cancelNoStaleGesture,resizePosePreserved:true,fullscreenSupported:full,fullscreenPosePreserved:true,reloadExact:true,clearNativeDpr:true});await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({engine,status:'passed',checks,errors},null,2));
}catch(e){fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(e),stack:e.stack,checks,errors},null,2));throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
