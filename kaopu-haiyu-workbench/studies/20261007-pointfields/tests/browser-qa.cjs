'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright');
const root=path.resolve(process.env.HAIYU_HTML||'kaopu-haiyu-workbench/index.html'),out=path.resolve(process.env.HAIYU_POINTFIELD_OUT||'haiyu-pointfield-results');fs.mkdirSync(out,{recursive:true});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),report={commit:process.env.GITHUB_SHA,htmlSha256:hash(fs.readFileSync(root)),browser:'Official Playwright Chromium',physicalDevice:false,checks:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));
async function settle(p,stage){await p.waitForFunction(s=>document.body.dataset.pending==='0'&&document.body.dataset.stage===String(s),stage,{timeout:60000});}
async function source(p){const el=await p.$('#live');return await el.contentFrame();}
async function canvasHash(p){return hash(await(await source(p)).locator('canvas').evaluate(c=>c.toDataURL()));}
async function seek(p,f){await p.locator('#timeline').fill(String(f));await p.waitForFunction(f=>document.body.dataset.frame===String(f)&&document.body.dataset.pending==='0',f);}
(async()=>{let browser,ctx,p;try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 ctx=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await ctx.addInitScript(()=>{const raw=requestAnimationFrame,cancel=cancelAnimationFrame,live=new Set();window.__rafStats={live:()=>live.size,requests:0};window.requestAnimationFrame=fn=>{let id;window.__rafStats.requests++;id=raw(t=>{live.delete(id);fn(t)});live.add(id);return id};window.cancelAnimationFrame=id=>{live.delete(id);cancel(id)};});
 p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));const base=process.env.HAIYU_POINTFIELD_URL||'file://'+root;
 await p.goto(base+'?module=source08',{waitUntil:'load'});await settle(p,17);
 assert.equal(await p.locator('meta[name="haiyu-pointfield-study"]').getAttribute('content'),'20261007-source08-source09-r1');
 assert.equal(await p.locator('[data-module="source08"] img').count(),1);assert.equal(await p.locator('[data-module="source09"] img').count(),1);
 const iframeCount=await p.locator('iframe').count(),rafBaseline=await p.evaluate(()=>window.__rafStats.live());
 for(const [stage,module,N,frame]of [[17,'source08',40000,80],[18,'source09',10000,180]]){
  await p.locator(`button[data-stage="${stage}"]`).click();await settle(p,stage);await seek(p,1);
  const child=await source(p);assert.deepEqual(await child.locator('canvas').evaluate(c=>[c.width,c.height]),[400,400]);
  await child.evaluate(()=>{const original=point;window.__drawnPoints=0;window.point=(...p)=>{window.__drawnPoints++;return original(...p)}});
  const h1=await canvasHash(p);await p.screenshot({path:path.join(out,`${module}-default.png`),fullPage:true});await child.locator('canvas').screenshot({path:path.join(out,`${module}-default-canvas.png`)});await p.locator('#step').click();await settle(p,stage);assert.equal(await p.locator('body').getAttribute('data-frame'),'2');assert.equal(await child.evaluate(()=>window.__drawnPoints),N);
  const h2=await canvasHash(p);assert.notEqual(h1,h2);await p.waitForTimeout(450);assert.equal(await canvasHash(p),h2);
  await p.locator('#play').click();await p.waitForFunction(()=>Number(document.body.dataset.frame)>=5);await p.locator('#play').click();await settle(p,stage);const pausedFrame=await p.locator('body').getAttribute('data-frame'),pausedHash=await canvasHash(p);await p.waitForTimeout(350);assert.equal(await p.locator('body').getAttribute('data-frame'),pausedFrame);assert.equal(await canvasHash(p),pausedHash);
  await p.locator('#reset').click();await settle(p,stage);assert.equal(await canvasHash(p),h1);
  await seek(p,frame);await p.screenshot({path:path.join(out,`${module}-desktop.png`),fullPage:true});await child.locator('canvas').screenshot({path:path.join(out,`${module}-canvas.png`)});
  const before=await canvasHash(p);await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);assert.equal(await canvasHash(p),before);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:path.join(out,`${module}-mobile.png`),fullPage:true});await p.setViewportSize({width:1440,height:1000});assert.equal(await canvasHash(p),before);
  await seek(p,960);await p.locator('#step').click();await settle(p,stage);assert.equal(await p.locator('body').getAttribute('data-frame'),'960');await p.locator('#play').click();await p.waitForTimeout(180);assert.equal(await p.locator('#play').textContent(),'播放');assert.equal(await p.locator('body').getAttribute('data-frame'),'960');
  await p.locator('#pointfieldExtend').click();assert.equal(await p.locator('#timeline').getAttribute('max'),'1920');await p.locator('#step').click();await settle(p,stage);assert.equal(await p.locator('body').getAttribute('data-frame'),'961');
  await p.locator('#pointfieldReturn').click();await p.waitForFunction(()=>document.body.dataset.pending==='0'&&Number(document.body.dataset.stage)<17);assert.ok(await p.locator('#pointfieldCatalogue').isVisible());
  report.checks.push({module,N,initialFrameHash:h1,stepChanges:true,pauseStable:true,resetExact:true,sameCanvasAcrossResize:true,observationWindowStops:true,extensionContinues:true,samePageReturn:true});save();
 }
 const legacyHashes={};for(const stage of [1,2,3,4,5,9,12]){await p.locator(`button[data-stage="${stage}"]`).first().click();await settle(p,stage);await seek(p,60);legacyHashes[stage]=await canvasHash(p);}
 for(let round=0;round<3;round++)for(const stage of [17,18,1,2,3,4,5,9,12]){await p.locator(`button[data-stage="${stage}"]`).first().click();await settle(p,stage);await seek(p,60);assert.equal(await p.locator('iframe').count(),iframeCount);if(stage<17)assert.equal(await canvasHash(p),legacyHashes[stage]);}
 assert.ok((await p.evaluate(()=>window.__rafStats.live()))<=rafBaseline+1);report.checks.push({reentryCycles:3,legacySources:[1,2,3,4,5,6,7],legacyCanvasHashesStable:true,iframeCountStable:iframeCount,rafBaseline,rafAfter:await p.evaluate(()=>window.__rafStats.live())});
 // Verify the old sources against untouched R23 baseline in the same browser.
 const baseline=await ctx.newPage();const baselinePath=path.resolve(path.dirname(root),'baselines/r23/index.html');await baseline.goto('file://'+baselinePath,{waitUntil:'load'});await baseline.waitForFunction(()=>document.body.dataset.pending==='0');
 for(const stage of[1,2,3,4,5,9,12]){await baseline.locator(`button[data-stage="${stage}"]`).first().click();await settle(baseline,stage);await seek(baseline,60);assert.equal(await canvasHash(baseline),legacyHashes[stage]);}
 await baseline.close();report.checks.push({old01to07MatchesUntouchedR23:true,frame:60});
 await p.goto(base+'?module=source09&frame=180',{waitUntil:'load'});await settle(p,18);assert.equal(await p.locator('body').getAttribute('data-frame'),'180');await p.locator('#pointfieldReturn').click();await settle(p,5);report.checks.push({directSource09DeepLink:true,samePageDirectLinkReturn:true});
 assert.deepEqual(report.errors,[]);report.ok=true;save();console.log(JSON.stringify(report,null,2));
 }catch(e){report.ok=false;report.error=e.stack;save();if(p)await p.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();}})();
