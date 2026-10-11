'use strict';
// Official CI only. Existing production game, native input and real RAF clock.
// No source rewrite, artificial dt, test teleport, new page or synthetic commands.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {approachAction}=require('./approach-policy.cjs');
const gameDir=path.resolve(__dirname,'..'),repoRoot=path.resolve(gameDir,'../../../..');
const target=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/';
const out=path.resolve(process.env.TRAIN_QA_OUT||'train-a4-results/browser');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
// SQLite's JSON payload normalizes only the mathematical sign of zero. Keep
// every other value/type/key intact; do not weaken full physical-state equality.
const normalizeSignedZero=v=>typeof v==='number'?(Object.is(v,-0)?0:v):Array.isArray(v)?v.map(normalizeSignedZero):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,normalizeSignedZero(x)])):v;
const sources=new Map();
function visit(file){if(sources.has(file))return;const bytes=fs.readFileSync(file);sources.set(file,{file:path.relative(repoRoot,file),sha256:sha(bytes)});for(const m of bytes.toString().matchAll(/\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]/g))visit(path.resolve(path.dirname(file),m[1]||m[2]));}
visit(path.join(gameDir,'app.mjs'));
if(process.argv.includes('--self-check')){assert.deepEqual(normalizeSignedZero({x:-0,y:1e-12,n:NaN,i:Infinity,u:undefined}),{x:0,y:1e-12,n:NaN,i:Infinity,u:undefined});assert(sources.has(path.join(gameDir,'physics/driving-physics.mjs')));assert(sources.has(path.join(gameDir,'physics/parameters.mjs')));console.log(JSON.stringify({pass:true,requiredModules:sources.size,target,browserLaunched:false}));process.exit(0);}
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
  const check=async label=>{const s=await state(),p=s.physics;assert(p,'actual game must expose physical snapshot');assert.equal(s.proof.nativeA4,true);assert.equal(s.proof.wheels,36);assert.equal(s.proof.addedCoaches,2);assert.equal(s.proof.coaches.length,2);assert.equal(p.wheelDiameterM,2.032);assert.equal(s.distance,p.positionM);assert.equal(s.velocity,p.speedMps);assert(Math.abs((p.positionM-p.rollingOriginPositionM)-p.wheelRadiusM*p.wheelAngleRad)<1e-7);assert.equal(p.tick,s.tick*4);report.checkpoints.push({label,state:s});write();console.log('Verified game checkpoint:',label,'distance',s.distance,'tick',s.tick);return s;};
  const screenshot=async label=>{await until(()=>{const s=__trainDriver.getState();return !s.streetDistrict||s.streetDistrict.pending===0;});const png=await page.screenshot({path:path.join(out,label+'.png')});report.screenshots.push({label,bytes:png.length,sha256:sha(png),source:'Actual existing game; trusted controls; no simulation fixtures'});};
  await page.goto(target,{waitUntil:'domcontentloaded'});await until(()=>window.__trainDriver?.ready);await until(()=>['ready','error'].includes(__trainDriver.getState().nativePlants?.status));
  const np=(await state()).nativePlants;assert.equal(np.status,'ready',JSON.stringify(np.failure));assert.equal(np.count,2);assert.equal(np.generationCount,1);assert.equal(np.sharedGeometry,true);assert.equal(np.worldGeometryScale,1);assert.equal(np.elapsed,(await state()).elapsed);for(const plant of np.plants){assert.equal(plant.proof.triangles,36330);assert(Math.abs(plant.proof.bounds.max[1]-5.031538486480713)<1e-5);}const retained=(await state()).retainedPlants;assert.equal(retained.count,4);assert.equal(retained.elapsed,(await state()).elapsed);report.retainedPlantsInitial=retained;report.nativePlantsInitial=np;await click('#startGame');await until(()=>__trainDriver.getState().station.canOpen);if(report.mobile){await click('#openSettings');await click('#portraitView');await click('#closeSettings');assert.equal((await state()).viewSettings.layout,'portrait');assert.equal((await state()).viewSettings.rotated,false);}await check('initial-platform');
  await click('#stationAction');await until(()=>__trainDriver.getState().phase==='ready-depart');let s=await check('passenger-service');assert.equal(s.velocity,0);assert.equal(s.stats.stops,1);assert(s.stats.pickedUp>0);await screenshot('first-station-a4');
  // Existing camera menu and native drag provide both nose sides, mechanical detail,
  // the full two-coach consist and the tail. These never alter vehicle/Session state.
  for(const preset of (report.mobile?['front','overview']:['front','detail','overview'])){
    await click('#openCameraMenu');await click(`[data-camera="${preset}"]`);await page.waitForTimeout(500);await check('camera-'+preset);await screenshot('a4-'+preset);
    if(preset==='front'){
      const r=await page.locator('canvas').first().boundingBox(),x=r.x+r.width*.65,y=r.y+r.height*.50;
      if(report.mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+r.width*.06*i/12,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
      else {await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+r.width*.06,y,{steps:12});await page.mouse.up();}
      await page.waitForTimeout(500);await check('camera-front-native-drag');await screenshot('a4-front-native-drag');
    }
  }
  // The production photography UI only folds the HUD; it preserves the actual
  // scene and freezes the same Session/thermal clock. No DOM injection is used.
  assert.equal(await page.locator('#journeyHud').isVisible(),true);
  assert.equal(await page.locator('#drivePanel').isVisible(),true);
  await click('#openSettings');await click('#photoMode');await until(()=>__trainDriver.getState().paused);
  await page.waitForFunction(()=>document.getElementById('driverGame').dataset.photo==='true'&&!document.getElementById('photoTools').hidden&&document.getElementById('settingsScreen').hidden);
  const photoFrozen=await state(),frozenPart=value=>({tick:value.tick,elapsed:value.elapsed,distance:value.distance,velocity:value.velocity,physics:value.physics,actors:value.actors,door:value.door,stats:value.stats});
  assert.equal(await page.locator('#journeyHud').isVisible(),false);assert.equal(await page.locator('#drivePanel').isVisible(),false);assert.equal(await page.locator('canvas').first().isVisible(),true);
  report.photography={source:'Actual existing photography controls and scene; no fixture writes, background hiding or screenshot DOM injection',frozenState:frozenPart(photoFrozen),views:[]};
  for(const preset of ['tailBrand']){
    await click('#photoCamera');await page.waitForFunction(()=>!document.getElementById('settingsScreen').hidden);await click(`[data-camera="${preset}"]`);
    await page.waitForFunction(()=>document.getElementById('settingsScreen').hidden);await page.waitForTimeout(600);
    const photo=await check('photo-'+preset);assert.equal(photo.cameraMode,preset);assert.equal(photo.paused,true);assert.deepEqual(frozenPart(photo),frozenPart(photoFrozen));
    assert.equal(await page.locator('#photoTools').isVisible(),true);assert.equal(await page.locator('canvas').first().isVisible(),true);assert.equal(await page.locator('#journeyHud').isVisible(),false);assert.equal(await page.locator('#drivePanel').isVisible(),false);
    assert.equal(photo.nativePlants.count,photoFrozen.nativePlants.count);assert.equal(photo.worldMode,photoFrozen.worldMode);assert.deepEqual(photo.sceneFog,photoFrozen.sceneFog);
    await screenshot('photo-a4-'+preset);report.photography.views.push({preset,camera:photo.camera,frozen:true,scenePresent:true});
  }
  await click('#photoReturn');await page.waitForFunction(()=>document.getElementById('driverGame').dataset.photo==='false'&&document.getElementById('photoTools').hidden);
  assert.equal(await page.locator('#journeyHud').isVisible(),true);assert.equal(await page.locator('#drivePanel').isVisible(),true);assert.equal((await state()).paused,true);assert.deepEqual(frozenPart(await state()),frozenPart(photoFrozen));
  await click('#resume');await until(()=>!__trainDriver.getState().paused);await until(t=>__trainDriver.getState().elapsed>t,photoFrozen.elapsed);await screenshot('photo-return-driver-hud');report.photography.returnedToInteractiveDriving=true;
  await until(()=>!__trainDriver.getState().timetable||__trainDriver.getState().timetable.dwellRemaining<=0);await click('#stationAction');await until(()=>__trainDriver.getState().phase==='running');await click('#accelerate');await click('#accelerate');await until(()=>__trainDriver.getState().velocity>=2);
  s=await check('moving-physical-train');assert(s.physics.diagnostics.tractionForceN>0);assert(s.physics.ledger.steamMassKg>0);await screenshot('moving-a4');
  // Save/download and load/upload use the visible actual-game UI, not test globals.
  await click('#openSettings');await until(()=>__trainDriver.getState().paused);const saved=await state();
  const downloadPending=page.waitForEvent('download');await click('#saveNativeGame');const download=await downloadPending;
  assert(download.suggestedFilename().endsWith('.KaoPu'));const savePath=path.join(out,'Flying_Hongkonger_88.KaoPu');await download.saveAs(savePath);
  const bytes=fs.readFileSync(savePath);assert.equal(bytes.subarray(0,16).toString('binary'),'SQLite format 3\0');
  const sql=JSON.parse(execFileSync('python3',['-c',"import sqlite3,json,hashlib,sys\nc=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)\nrole,mime,sha,data=c.execute('select * from assets').fetchone()\nm=json.loads(data)\nprint(json.dumps({'integrity':c.execute('pragma integrity_check').fetchone()[0],'profile':dict(c.execute('select * from header'))['profile'],'role':role,'shaMatches':hashlib.sha256(data).hexdigest()==sha,'packet':m['packet'],'verification':m['verification'],'appearance':m['appearance']}))",savePath],{encoding:'utf8',maxBuffer:8*1024*1024}));
  assert.equal(sql.integrity,'ok');assert.equal(sql.shaMatches,true);assert.equal(sql.profile,'kaopu.fh88-game-session/1-experimental');// JSON defines -0 as 0; normalize only the serialization representation.
  assert.deepEqual(sql.verification.physics,normalizeSignedZero(saved.physics));
  report.nativeSave={filename:download.suggestedFilename(),bytes:bytes.length,sha256:sha(bytes),independentSQLite:sql,savedState:saved};
  await click('#closeSettings');await until(()=>!__trainDriver.getState().paused);await until(d=>__trainDriver.getState().distance>d+1,saved.distance);
  await click('#openSettings');await until(()=>__trainDriver.getState().paused);const beforeBad=await state();
  const chooseFile=async file=>{const chooserPending=page.waitForEvent('filechooser');await click('#openNativeGame');const chooser=await chooserPending;await chooser.setFiles(file);};
  await chooseFile({name:'Corrupt.KaoPu',mimeType:'application/vnd.kaopu.sqlite',buffer:Buffer.from('not a SQLite game save')});await page.waitForFunction(()=>document.getElementById('nativeSaveStatus').textContent.startsWith('未打开'));
  assert.deepEqual((await state()).physics,beforeBad.physics);report.nativeSave.badFilePreservesCurrent=true;
  await click('#photoMode');await until(()=>document.getElementById('driverGame').dataset.photo==='true');await click('#photoCamera');
  await chooseFile(savePath);await page.waitForFunction(()=>document.getElementById('nativeSaveStatus').textContent.startsWith('已校验恢复'));
  assert.equal(await page.locator('#driverGame').getAttribute('data-photo'),'false','loading from photography restores the complete driver controls');
  const restored=await check('restored-native-sqlite');assert.deepEqual({...restored.physics,paused:saved.physics.paused},saved.physics);assert.deepEqual(restored.actors,saved.actors);assert.deepEqual(restored.stats,saved.stats);assert.equal(restored.phase,saved.phase);assert.equal(restored.door,saved.door);assert.equal(restored.distance,saved.distance);
  await click('#closeSettings');assert.equal((await state()).paused,true,'closing settings after native load must not silently resume the restored train');const heldRestore=await state();await page.waitForTimeout(600);assert.deepEqual((await state()).physics,heldRestore.physics);await screenshot('native-save-restored-paused');report.nativeSave.exactRestore=true;report.nativeSave.staysPausedAfterSettings=true;
  await click('#resume');await until(()=>!__trainDriver.getState().paused);await until(t=>__trainDriver.getState().physics.timeS>t+.5,saved.physics.timeS);
  await click('#pause');await until(()=>__trainDriver.getState().paused);const paused=await state();await page.waitForTimeout(1000);assert.deepEqual((await state()).physics,paused.physics);await screenshot('paused-a4');await click('#resume');await until(()=>!__trainDriver.getState().paused);
  if(report.mobile){const r=await page.locator('#brake').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);/* touch tap smoke first, then sustained trusted pointer via CDP */const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await until(()=>__trainDriver.getState().velocity===0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else {await page.keyboard.down('Space');await until(()=>__trainDriver.getState().brake);await page.keyboard.press('w');assert.equal((await state()).throttle,0);await until(()=>__trainDriver.getState().velocity===0);await page.keyboard.up('Space');}
  s=await check('physical-brake-stop');assert.equal(s.velocity,0);assert(s.physics.ledger.brakeLossJ>0);const d=s.distance;await page.waitForTimeout(600);assert.equal((await state()).distance,d);await screenshot('stopped-a4');
  // Drive the same unmodified train through the next real passenger stop before
  // photographing it on open track. No position/time/scene writes or hidden city.
  await click('#openSettings');await page.locator('#renderQuality').selectOption('smooth');await click('#closeSettings');assert.equal((await state()).qualityMode,'smooth');report.longDriveQuality='Existing smooth setting, pixel ratio only; physics and scene geometry unchanged. Photography returns to clear.';
  const routeBrakeRect=report.mobile?await page.locator('#brake').boundingBox():null,routeBrakeCDP=report.mobile?await context.newCDPSession(page):null;
  for(let i=0;i<3;i++)await click('#accelerate');
  await page.waitForFunction(()=>{const v=__trainDriver.getState();return v.station.remaining<=v.brakingDistance+140;},null,{polling:50,timeout:600000});
  async function holdBrakeToStop(){
   if(report.mobile){const b=routeBrakeRect,cdp=routeBrakeCDP;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await until(()=>__trainDriver.getState().velocity===0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{await page.keyboard.down('Space');await until(()=>__trainDriver.getState().velocity===0);await page.keyboard.up('Space');}
  }
  async function preciseStop(target){
   const begin=Date.now();report.approach=report.approach||[];
   while(Date.now()-begin<600000){const view=await state(),action=approachAction(view,target);report.approach.push({wallTimeMs:Date.now(),target,action,tick:view.tick,physicsTimeS:view.physics.timeS,distance:view.distance,velocity:view.velocity,brakingDistance:view.brakingDistance,throttle:view.throttle,stationTarget:view.station.target});write();
    if(action==='brake'){await holdBrakeToStop();return;}
    if(action==='accelerate'||action==='decelerate')await click('#'+action);
    await page.waitForTimeout(200);
   }throw Error('Actual-control low-speed approach timed out');
  }
  await holdBrakeToStop();await check('early-second-station-brake');await preciseStop(700);await until(()=>__trainDriver.getState().station.canOpen);await click('#stationAction');await until(()=>__trainDriver.getState().phase==='ready-depart');
  const secondStation=await check('second-station-passenger-service');assert.equal(secondStation.stats.stops,2);assert.equal(secondStation.stats.missed,0);await screenshot('second-station-a4');
  await page.waitForFunction(()=>__trainDriver.getState().timetable.dwellRemaining<=0,null,{polling:50,timeout:600000});await click('#stationAction');await until(()=>__trainDriver.getState().phase==='running');
  await preciseStop(790);if(routeBrakeCDP)await routeBrakeCDP.detach();
  await click('#openSettings');await page.locator('#renderQuality').selectOption('clear');await click('#photoMode');await until(()=>__trainDriver.getState().paused);
  const openTrack=await state();assert.equal(openTrack.qualityMode,'clear');assert(openTrack.distance>=786&&openTrack.distance<=794,'The actual controlled stop must remain in the independently checked open-track window');assert.equal(openTrack.velocity,0);report.photography.openTrack={distance:openTrack.distance,stops:openTrack.stats.stops,actualControls:true,sceneHidden:false};
  for(const preset of ['leftSide','rightSide','overview']){
   await click('#photoCamera');await click(`[data-camera="${preset}"]`);await until(()=>document.getElementById('settingsScreen').hidden);await page.waitForTimeout(600);
   const frame=await check('open-track-'+preset);assert.deepEqual(frozenPart(frame),frozenPart(openTrack));assert.deepEqual(frame.cameraProjection.up,[0,1,0]);
   if(preset!=='overview'){const h=2*Math.atan(Math.tan(frame.cameraProjection.effectiveFov*Math.PI/360)*frame.cameraProjection.aspect)*180/Math.PI;assert(h>=35&&h<=55,'Conventional horizontal field of view, not an ultrawide lens');}
   await screenshot('photo-open-track-'+preset);
  }
  await click('#photoReturn');assert.equal(await page.locator('#drivePanel').isVisible(),true);await screenshot('open-track-restored-driver-controls');
  const packet=await page.evaluate(()=>__trainDriver.exportReplay());const {replay}=await import('../session.mjs');const played=replay(packet);assert.deepEqual(played.view().physics,(await state()).physics);report.replayMatches=true;
  await Promise.all(pending);for(const row of sources.values())assert(report.sources.some(r=>r.url===row.url&&r.matches),'missing/stale runtime: '+row.file);assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.pass=true;
 }catch(e){report.failure=e.stack;if(page){report.failureState=await page.evaluate(()=>window.__trainDriver?.getState()).catch(()=>null);report.failureReplay=await page.evaluate(()=>window.__trainDriver?.exportReplay()).catch(()=>null);}if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(e);}finally{write();if(context)await context.close();if(browser)await browser.close();}if(!report.pass)process.exitCode=1;
})();
