'use strict';
// Read-only public deployment smoke. No injected state, renderer wrappers or scene changes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const {clickTarget}=require('../../tests/browser-controls.cjs');
const repo=process.cwd(),entry='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/',url=entry+'r17/';
const out=path.resolve('train-r17-public-results');fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),write=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2));
const result={pass:false,kind:'actual-public-URL-native-input',expectedRuntimeHead:'3dcb618f32e65b58ef11d1799a6f08bec040fefb',publishedMerge:'6a366d5e104cd7125891e1b391397df9dbdd91b7',qaCommit:process.env.GITHUB_SHA,fixtureStateWrites:false,hashes:[],errors:[],consoleErrors:[],requests:[],screenshots:[]};
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(60000);
 const pending=[];page.on('pageerror',e=>result.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});page.on('request',r=>result.requests.push(r.url()));
 page.on('response',r=>{const u=new URL(r.url());if(u.origin!=='https://haihao0307.github.io'||!u.pathname.startsWith('/guilin-dem-pipeline/'))return;const rel=decodeURIComponent(u.pathname.slice('/guilin-dem-pipeline/'.length))+(u.pathname.endsWith('/')?'index.html':'');if(!/\.(mjs|json|css|html)$/.test(rel)||!fs.existsSync(path.join(repo,rel)))return;pending.push((async()=>{const body=await r.body(),actual=hash(body),expected=hash(fs.readFileSync(path.join(repo,rel)));result.hashes.push({url:r.url(),file:rel,status:r.status(),bytes:body.length,actual,expected,match:actual===expected});})());});
 // Allow Pages/CDN publication to finish; fixed URL and exact source content, no guessed version signal.
 const indexFile='kaopu-minigame-workbench/voxel-train-study/game/index.html',expectedIndex=hash(fs.readFileSync(path.join(repo,indexFile)));let matched=false;
 for(let n=0;n<36;n++){const r=await context.request.get(entry,{headers:{'Cache-Control':'no-cache'}});if(r.ok()&&hash(await r.body())===expectedIndex){matched=true;break;}await new Promise(r=>setTimeout(r,5000));}assert(matched,'Published original menu must match exact two-link source');
 const until=(fn,arg)=>page.waitForFunction(fn,arg,{polling:100,timeout:90000}),state=()=>page.evaluate(()=>__trainDriver.getState());
 const ready=async(version)=>{await until(()=>window.__trainDriver?.ready);assert.equal(await page.evaluate(()=>__trainDriver.version),version);};
 await page.goto(entry,{waitUntil:'load'});await ready('kcr-hud-r14');assert.equal(await page.locator('a[href="./r17/"]').count(),2);
 await clickTarget(page,'#startScreen a[href="./r17/"]');await page.waitForURL(url);await ready('kcr-kst1-r17');result.startLinkReached=page.url();
 await clickTarget(page,'#startScreen a[href="../"]');await page.waitForURL(entry);await ready('kcr-hud-r14');await clickTarget(page,'#startGame');await clickTarget(page,'#openSettings');
 await clickTarget(page,'#settingsScreen a[href="./r17/"]');await page.waitForURL(url);await ready('kcr-kst1-r17');result.settingsLinkReached=page.url();
 await until(()=>__trainDriver.getState().streetDistrict?.active);result.initial=await state();assert.equal(result.initial.proof.addedCoaches,2);assert.equal(result.initial.streetDistrict.externalMesh,false);assert.equal(result.initial.streetDistrict.externalImageTextures,false);assert(result.initial.drawCalls>0&&result.initial.triangles>100000);
 const shot=async name=>{const before=await state();await page.screenshot({path:path.join(out,name+'.png')});result.screenshots.push({name,state:before,sha256:hash(fs.readFileSync(path.join(out,name+'.png')))});};
 await clickTarget(page,'#startGame');await until(()=>__trainDriver.getState().station.canOpen);await clickTarget(page,'#stationAction');await until(()=>['doors-opening','unloading','boarding'].includes(__trainDriver.getState().phase));await page.keyboard.press('w');
 await until(()=>document.getElementById('accelerate').disabled);result.doorInterlock=await state();assert.equal(result.doorInterlock.throttle,0);assert.equal(result.doorInterlock.velocity,0);await shot('public-door-interlock');
 await clickTarget(page,'#pause');const paused=await state();await page.waitForTimeout(450);const still=await state();assert.equal(still.tick,paused.tick);assert.equal(still.streetDistrict.elapsed,paused.elapsed);result.pause={tick:paused.tick,unchangedTick:still.tick};await clickTarget(page,'#resume');await until(t=>__trainDriver.getState().tick>t,paused.tick);
 await clickTarget(page,'#openCameraMenu');await clickTarget(page,'[data-camera="city"]');await until(()=>__trainDriver.getState().cameraMode==='city');result.camera=await state();
 // Normal native restart, then depart without serving the first station to bound smoke duration.
 await clickTarget(page,'#pause');await clickTarget(page,'#restartPaused');await until(()=>__trainDriver.getState().streetDistrict?.active);await clickTarget(page,'#accelerate');await until(()=>__trainDriver.getState().distance>3);await page.keyboard.down('Space');await until(()=>__trainDriver.getState().velocity===0);await page.keyboard.up('Space');await clickTarget(page,'#pause');result.nativeDriven=await state();assert(result.nativeDriven.distance>3);assert.equal(result.nativeDriven.streetDistrict.elapsed,result.nativeDriven.elapsed);await shot('public-native-r17');
 await Promise.all(pending);assert(result.hashes.length>30);assert(result.hashes.every(x=>x.match&&x.status===200),'Every observed public source response must match this checked source');
 for(const file of ['r17/app.mjs','r17/metre-scale.mjs','r17/steam-scale.mjs','r17/street/first-street.score.json'])assert(result.hashes.some(x=>x.file.endsWith('/game/'+file)),'Critical public source observed: '+file);
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);assert(!result.requests.some(x=>/\/game\/(r15|city-assets)\/|\.(glb|gltf|bin)(\?|$)/.test(x)));
 result.gl=await page.evaluate(()=>{const g=document.getElementById('gameScene').getContext('webgl2');return{error:g.getError(),lost:g.isContextLost()};});assert.equal(result.gl.error,0);assert.equal(result.gl.lost,false);result.pass=true;
 }catch(e){result.failure={message:e.message,stack:e.stack};process.exitCode=1;}finally{write('result.json',result);await browser?.close();console.log(JSON.stringify({pass:result.pass,hashCount:result.hashes.length,failure:result.failure}));}})();
