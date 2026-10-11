'use strict';
// Official CI only. Existing production game, native input and real RAF clock.
// No source rewrite, artificial dt, test teleport, new page or synthetic commands.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const gameDir=path.resolve(__dirname,'..'),repoRoot=path.resolve(gameDir,'../../../..');
const target=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/';
const out=path.resolve(process.env.TRAIN_QA_OUT||'train-a4-results/browser');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=new Map();
function visit(file){if(sources.has(file))return;const bytes=fs.readFileSync(file);sources.set(file,{file:path.relative(repoRoot,file),sha256:sha(bytes)});for(const m of bytes.toString().matchAll(/\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]/g))visit(path.resolve(path.dirname(file),m[1]||m[2]));}
visit(path.join(gameDir,'app.mjs'));
if(process.argv.includes('--self-check')){assert(sources.has(path.join(gameDir,'physics/driving-physics.mjs')));assert(sources.has(path.join(gameDir,'physics/parameters.mjs')));console.log(JSON.stringify({pass:true,requiredModules:sources.size,target,browserLaunched:false}));process.exit(0);}
(async()=>{
 assert.equal(process.env.GITHUB_ACTIONS,'true','Use approved official CI for browser execution; --self-check is safe locally.');
 const {chromium}=require('playwright');assert.equal(require('playwright/package.json').version,'1.57.0');fs.mkdirSync(out,{recursive:true});
 const report={pass:false,target,commit:process.env.GITHUB_SHA||null,fixtureStateWrites:false,runtimeSourceModified:false,clock:'production RAF + Session/DrivingPhysics fixed ticks',environment:'Playwright Chromium ANGLE SwiftShader, not physical-device performance',mobile:process.env.TRAIN_QA_MOBILE==='1',errors:[],network:[],sources:[],screenshots:[],checkpoints:[]};
 const write=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));let browser,context,page;const pending=[];
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});context=await browser.newContext(report.mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:1280,height:800},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(180000);
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  for(const [file,row] of sources)row.url=new URL(path.relative(gameDir,file).split(path.sep).join('/'),target).href;
  page.on('response',response=>{if(response.status()>=400)report.network.push({url:response.url(),status:response.status()});const entry=[...sources.values()].find(s=>s.url===response.url());if(entry)pending.push(response.body().then(b=>report.sources.push({...entry,responseSHA256:sha(b),matches:sha(b)===entry.sha256})).catch(e=>report.errors.push(String(e))));});
  const state=()=>page.evaluate(()=>window.__trainDriver.getState());
  const until=(predicate,arg)=>page.waitForFunction(predicate,arg,{polling:50,timeout:180000});
  const click=async id=>{const button=page.locator(id);await button.waitFor({state:'visible'});if(report.mobile)await button.tap();else await button.click();};
  const check=async label=>{const s=await state(),p=s.physics;assert(p,'actual game must expose physical snapshot');assert.equal(s.proof.nativeA4,true);assert.equal(s.proof.wheels,36);assert.equal(s.proof.addedCoaches,2);assert.equal(s.proof.coaches.length,2);assert.equal(p.wheelDiameterM,2.032);assert.equal(s.distance,p.positionM);assert.equal(s.velocity,p.speedMps);assert(Math.abs((p.positionM-p.rollingOriginPositionM)-p.wheelRadiusM*p.wheelAngleRad)<1e-7);assert.equal(p.tick,s.tick*4);report.checkpoints.push({label,state:s});write();return s;};
  const screenshot=async label=>{const png=await page.screenshot({path:path.join(out,label+'.png')});report.screenshots.push({label,bytes:png.length,sha256:sha(png),source:'Actual existing game; trusted controls; no simulation fixtures'});};
  await page.goto(target,{waitUntil:'domcontentloaded'});await until(()=>window.__trainDriver?.ready);await click('#startGame');await until(()=>__trainDriver.getState().station.canOpen);await check('initial-platform');
  await click('#stationAction');await until(()=>__trainDriver.getState().phase==='ready-depart');let s=await check('passenger-service');assert.equal(s.velocity,0);assert.equal(s.stats.stops,1);assert(s.stats.pickedUp>0);await screenshot('first-station-a4');
  // Existing camera menu and native drag provide both nose sides, mechanical detail,
  // the full two-coach consist and the tail. These never alter vehicle/Session state.
  for(const preset of ['front','detail','overview','rear','platform']){
    await click('#openCameraMenu');await click(`[data-camera="${preset}"]`);await page.waitForTimeout(500);await check('camera-'+preset);await screenshot('a4-'+preset);
    if(preset==='front'){
      const r=await page.locator('canvas').first().boundingBox(),x=r.x+r.width*.65,y=r.y+r.height*.50;
      if(report.mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-r.width*.15*i/12,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
      else {await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-r.width*.15,y,{steps:12});await page.mouse.up();}
      await page.waitForTimeout(500);await check('camera-front-opposite');await screenshot('a4-front-opposite');
    }
  }
  await until(()=>!__trainDriver.getState().timetable||__trainDriver.getState().timetable.dwellRemaining<=0);await click('#stationAction');await until(()=>__trainDriver.getState().phase==='running');await click('#accelerate');await click('#accelerate');await until(()=>__trainDriver.getState().velocity>=2);
  s=await check('moving-physical-train');assert(s.physics.diagnostics.tractionForceN>0);assert(s.physics.ledger.steamMassKg>0);await screenshot('moving-a4');
  await click('#pause');await until(()=>__trainDriver.getState().paused);const paused=await state();await page.waitForTimeout(1000);assert.deepEqual((await state()).physics,paused.physics);await screenshot('paused-a4');await click('#resume');await until(()=>!__trainDriver.getState().paused);
  if(report.mobile){const r=await page.locator('#brake').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);/* touch tap smoke first, then sustained trusted pointer via CDP */const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await until(()=>__trainDriver.getState().velocity===0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else {await page.keyboard.down('Space');await until(()=>__trainDriver.getState().brake);await page.keyboard.press('w');assert.equal((await state()).throttle,0);await until(()=>__trainDriver.getState().velocity===0);await page.keyboard.up('Space');}
  s=await check('physical-brake-stop');assert.equal(s.velocity,0);assert(s.physics.ledger.brakeLossJ>0);const d=s.distance;await page.waitForTimeout(600);assert.equal((await state()).distance,d);await screenshot('stopped-a4');
  await click('#pause');await until(()=>__trainDriver.getState().paused);const packet=await page.evaluate(()=>__trainDriver.exportReplay());const {replay}=await import('../session.mjs');const played=replay(packet);assert.deepEqual(played.view().physics,(await state()).physics);report.replayMatches=true;
  await Promise.all(pending);for(const row of sources.values())assert(report.sources.some(r=>r.url===row.url&&r.matches),'missing/stale runtime: '+row.file);assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.pass=true;
 }catch(e){report.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(e);}finally{write();if(context)await context.close();if(browser)await browser.close();}if(!report.pass)process.exitCode=1;
})();
