const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,webkit}=require('playwright');
const engine=process.env.TRAIN_BROWSER||'chromium',out=process.env.TRAIN_LAYOUT_DIR||`layout-${engine}`,url=new URL(process.env.TRAIN_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/');
url.searchParams.set('layout','immersive');url.searchParams.set('paused','1');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await({chromium,webkit})[engine].launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,hasTouch:true}),page=await context.newPage(),errors=[],bad=[],views=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()});});
  await page.goto(url.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__voxelTrain?.ready);
  assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false,'Fullscreen must not start without a user click');
  assert.equal((await page.evaluate(()=>__voxelTrain.getState())).viewport.layout,'immersive');
  assert.equal(await page.locator('#resetView').isVisible(),false);await page.locator('#toolsToggle').click();assert.equal(await page.locator('#resetView').isVisible(),true);await page.locator('#toolsToggle').click();
  for(const size of [{name:'desktop',width:1440,height:1000},{name:'wide',width:1920,height:1080},{name:'ultrawide',width:2560,height:1080},{name:'phone-landscape',width:844,height:390},{name:'phone',width:390,height:844},{name:'small-phone',width:320,height:690}]){
    await page.setViewportSize({width:size.width,height:size.height});await page.evaluate(()=>__voxelTrain.setTime(0));await page.waitForTimeout(120);
    const m=await page.evaluate(()=>{
      const a=__voxelTrain,canvas=document.querySelector('#scene'),r=canvas.getBoundingClientRect();a.model.train.geometry.computeBoundingBox();const b=a.model.train.geometry.boundingBox,points=[];
      for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])points.push(new a.camera.position.constructor(x,y,z).project(a.camera).toArray());
      return{inner:[innerWidth,innerHeight],canvas:{x:r.x,y:r.y,width:r.width,height:r.height},aspect:a.camera.aspect,trainCorners:points,state:a.getState()};
    });
    assert.ok(Math.abs(m.canvas.width-size.width)<1&&Math.abs(m.canvas.height-size.height)<1,'Immersive canvas must occupy viewport');
    assert.ok(Math.abs(m.aspect-size.width/size.height)<1e-6,'Projection must match canvas without stretching');
    assert.ok(m.trainCorners.every(p=>Math.abs(p[0])<.98&&Math.abs(p[1])<.98),'Locomotive and tank must remain inside camera view');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    for(const selector of ['.controls','#layoutToggle','#fullscreenToggle','#aboutOpen']){const b=await page.locator(selector).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,`${size.name} ${selector} clipped`);}
    await page.screenshot({path:`${out}/${size.name}-${engine}.png`});views.push({name:size.name,...m});
  }
  await page.locator('#layoutToggle').click();assert.equal((await page.evaluate(()=>__voxelTrain.getState())).viewport.layout,'reference');assert.equal(new URL(page.url()).searchParams.get('layout'),'reference');const referenceBox=await page.locator('#scene').boundingBox();assert.equal(referenceBox.width,referenceBox.height,'Original phone view retains authored square');
  assert.equal(await page.locator('#resetView').isVisible(),true);await page.screenshot({path:`${out}/reference-phone-${engine}.png`});await page.locator('#layoutToggle').click();
  await page.locator('#playPause').tap();await page.waitForFunction(()=>__voxelTrain.getState().playing);await page.locator('#playPause').tap();await page.locator('#scene').focus();await page.keyboard.press('Space');assert.equal((await page.evaluate(()=>__voxelTrain.getState())).playing,true);await page.keyboard.press('Space');
  await page.setViewportSize({width:1440,height:1000});await page.locator('#toolsToggle').click();await page.locator('#rotate').click();await page.mouse.move(700,350);await page.mouse.down();await page.mouse.move(800,380,{steps:3});await page.mouse.up();await page.locator('#layoutToggle').click();
  let state=await page.evaluate(()=>__voxelTrain.getState());assert.equal(state.freeView,false);for(let i=0;i<3;i++)assert.ok(Math.abs(state.camera[i]-[26.02218051,21.84501768,24.22938217][i])<1e-5,'Original view restores authored camera');
  await page.locator('#layoutToggle').click();await page.locator('#toolsToggle').click();
  await page.locator('#fullscreenToggle').click();await page.waitForTimeout(180);const fullscreen=await page.evaluate(()=>({active:!!document.fullscreenElement,supported:__voxelTrain.getState().viewport.fullscreenSupported,fallback:!document.querySelector('#viewStatus').hidden}));assert.ok(fullscreen.active||fullscreen.fallback,'Native fullscreen or explicit browser fallback');
  if(fullscreen.active){await page.locator('#fullscreenToggle').click();await page.waitForFunction(()=>!document.fullscreenElement);}
  await page.locator('#aboutOpen').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#about').isVisible(),false);
  await page.waitForFunction(()=>document.querySelector('#viewStatus').hidden);await page.setViewportSize({width:1920,height:1080});for(const t of [0,4]){await page.evaluate(t=>__voxelTrain.setTime(t),t);await page.screenshot({path:`${out}/wide-phase-${t}-${engine}.png`});}
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);fs.writeFileSync(`${out}/result.json`,JSON.stringify({status:'passed',engine,url:url.href,fullscreen,views,errors,bad,scope:'Viewport and controls only; geometry and authored camera anchor retained'},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
