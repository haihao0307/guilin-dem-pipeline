'use strict';
// Official CI only. Existing production game, native input and real RAF clock.
// No source rewrite, artificial dt, test teleport, new page or synthetic commands.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {approachAction}=require('./approach-policy.cjs');
const gameDir=path.resolve(__dirname,'..'),repoRoot=path.resolve(gameDir,'../../../..');
const target=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/?surfaceAudit=1';
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

  await click('#openSettings');await page.locator('#renderQuality').selectOption('smooth');await click('#closeSettings');
  await until(()=>!__trainDriver.getState().timetable||__trainDriver.getState().timetable.dwellRemaining<=0);await click('#stationAction');await until(()=>__trainDriver.getState().phase==='running');for(let i=0;i<3;i++)await click('#accelerate');
  await page.waitForFunction(()=>__trainDriver.getState().distance>=80,null,{polling:100,timeout:600000});await page.keyboard.down('Space');await until(()=>__trainDriver.getState().velocity===0);await page.keyboard.up('Space');await check('cleared-platform-with-actual-controls');
  await click('#openSettings');await page.locator('#renderQuality').selectOption('clear');await click('#photoMode');await until(()=>__trainDriver.getState().paused);await page.waitForFunction(()=>document.getElementById('driverGame').dataset.photo==='true');
  const frozen=(await state()).physics;

  await click('#photoCamera');await click('[data-camera="runningGear"]');await page.waitForFunction(()=>document.getElementById('settingsScreen').hidden);
  for(const mode of ['original','no-effects','no-terrain','original']){await page.evaluate(mode=>__trainSurfaceAudit.setMode(mode),mode);await page.waitForTimeout(600);await screenshot('surface-'+mode);assert.deepEqual((await state()).physics,frozen);await check('surface-'+mode);}
  report.pixelObjects=await page.evaluate(()=>__trainSurfaceAudit.samplePixels([[250,420],[500,451],[750,482],[1000,515],[500,459],[750,491],[1000,529],[1250,548]]));
  await Promise.all(pending);for(const row of sources.values())assert(report.sources.some(r=>r.url===row.url&&r.matches),'missing/stale runtime: '+row.file);assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.pass=true;
 }catch(e){report.failure=e.stack;if(page){report.failureState=await page.evaluate(()=>window.__trainDriver?.getState()).catch(()=>null);report.failureReplay=await page.evaluate(()=>window.__trainDriver?.exportReplay()).catch(()=>null);}if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(e);}finally{write();if(context)await context.close();if(browser)await browser.close();}if(!report.pass)process.exitCode=1;
})();
