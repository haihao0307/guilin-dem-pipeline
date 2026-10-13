import{chromium}from'playwright';import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';import{PNG}from'pngjs';
const p=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),url=process.argv[2],publicMode=process.argv.includes('--public'),out=p+'/evidence/'+(publicMode?'public':'candidate');fs.mkdirSync(out,{recursive:true});
const expected=JSON.parse(fs.readFileSync(p+'/BASELINE_HASHES.json')),manifest=JSON.parse(fs.readFileSync(p+'/ASSET_MANIFEST.json')),report={success:false,url,checks:[],errors:[],requests:[],timings:{},arraySHA:{},pixels:{},environment:{browser:'Playwright Chromium 1.55.1',gpu:'SwiftShader',viewport:[1280,1000],realPhone:false,throttle:'5 Mbps / 80ms latency; desktop only'},referenceMode:'L01 fetch-text/document-write transport replay in controlled server; not measured user network'};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name,detail??'');save();assert(pass,name);}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function ready(page){await page.waitForFunction(()=>window.lengthGroom?.diagnostics().startup?.stage==='ready'||window.__HAIR_LOAD?.failure||window.lengthGroom?.diagnostics().startup?.failure,{},{timeout:240000});const d=await page.evaluate(()=>lengthGroom.diagnostics());assert(d.ready&&!d.startup.failure,JSON.stringify(d.startup));await page.evaluate(()=>lengthGroom.whenRendered());return page.evaluate(()=>lengthGroom.diagnostics());}
async function arrays(page){return page.evaluate(async()=>{const out={};for(const[k,a]of Object.entries(lengthGroom.runtimeBuffers())){const hash=await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength));out[k]={bytes:a.byteLength,sha256:Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('')};}return out;});}
async function picture(page,name){await page.evaluate(()=>lengthGroom.whenRendered());const bytes=await page.locator('#canvas').screenshot({path:out+'/'+name+'.png'}),im=PNG.sync.read(bytes);let varied=0;for(let i=0;i<im.data.length;i+=16)if(Math.abs(im.data[i]-43)+Math.abs(im.data[i+1]-50)+Math.abs(im.data[i+2]-57)>30)varied++;check(name+' actual WebGL pixels',varied>1000);return im;}
function difference(a,b){assert.equal(a.width,b.width);assert.equal(a.height,b.height);let changed=0,sum=0,max=0;for(let i=0;i<a.data.length;i++){const d=Math.abs(a.data[i]-b.data[i]);if(d)changed++;sum+=d;max=Math.max(max,d);}return{changedChannels:changed,meanAbsolute:sum/a.data.length,max};}
async function pageIn(ctx,throttle=true){const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>report.requests.push(r.url()));if(throttle){const c=await ctx.newCDPSession(page);await c.send('Network.enable');await c.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:625000,uploadThroughput:625000,connectionType:'cellular4g'});}return page;}
const pictures={},references={};
try{
 if(!publicMode){
  const ctx=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:1}),ref=await pageIn(ctx);
  await ref.goto('http://127.0.0.1:8766/legacy.html',{waitUntil:'domcontentloaded',timeout:180000});let d=await ready(ref);report.timings.oldCold={fullyRenderedMs:await ref.evaluate(()=>performance.now()),buildMs:d.buildMs,firstPaintMs:await ref.evaluate(()=>performance.getEntriesByName('first-contentful-paint')[0]?.startTime)};save();
  for(const style of['textured-fringe','side-flow','curtain-layer']){if(style!=='textured-fringe'){await ref.evaluate(s=>lengthGroom.preset(s),style);d=await ready(ref);}check('reference matches fixed '+style,Object.keys(expected[style]).every(k=>d[k]===expected[style][k]));references[style]=await arrays(ref);await ref.evaluate(()=>lengthGroom.camera('top'));pictures[style]=await picture(ref,'reference-'+style);}
  await ref.evaluate(()=>lengthGroom.apply({lengthMM:117,crownCover:51,rootBlendMM:11}));await ready(ref);references.custom=await arrays(ref);report.arraySHA.reference=references;save();await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:1}),page=await pageIn(ctx);
 // No third-party previewer/model endpoint is allowed in the new runtime.
 await page.route(/https:\/\/(raw\.githubusercontent\.com|htmlpreview\.github\.io|api\.github\.com)\//,r=>r.abort());
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});let d=await ready(page);report.timings.newCold=d.startup.loading;report.timings.newColdBuildMs=d.buildMs;save();
 check('native shell paints before assets and full model generation',d.startup.loading.shellMs<d.startup.loading.assetsReadyMs&&d.startup.loading.assetsReadyMs<d.startup.loading.fullyRenderedMs,d.startup.loading);
 check('same original head and original default 64k render quality',d.headCount===1&&d.qualityRoots===64000&&d.headIntegration.face.ready&&d.headIntegration.eyes.ready&&d.renderPixelRatio===1.5);
 check('startup does not fetch unused bases',d.startup.loading.networkBytes===manifest.startupBytes&&!d.startup.loading.fullOriginalVerified);
 for(const style of['textured-fringe','side-flow','curtain-layer']){
  if(style!=='textured-fringe'){await page.locator('[data-preset="'+style+'"]').click();await page.waitForFunction(s=>lengthGroom.diagnostics().recipe.style===s&&!lengthGroom.diagnostics().busy,style,{timeout:180000});d=await ready(page);}
  check(style+' frozen roots, curves, head and full geometry buffer',Object.keys(expected[style]).every(k=>d[k]===expected[style][k]),{expected:expected[style],actual:Object.fromEntries(Object.keys(expected[style]).map(k=>[k,d[k]]))});
  const digest=await arrays(page);report.arraySHA[style]=digest;if(!publicMode)check(style+' every float/index array SHA identical',JSON.stringify(digest)===JSON.stringify(references[style]));
  await page.locator('[data-view="top"]').click();const im=await picture(page,style+'-top');if(!publicMode){const diff=difference(pictures[style],im);report.pixels[style]=diff;check(style+' same-environment pixel equality',diff.changedChannels===0,diff);}
 }
 if(!publicMode){await page.evaluate(()=>lengthGroom.apply({lengthMM:117,crownCover:51,rootBlendMM:11}));await ready(page);check('custom recipe complete arrays remain bit-identical',JSON.stringify(await arrays(page))===JSON.stringify(references.custom));}
 await page.locator('[data-view="left"]').click();await page.locator('[data-inspect="root-shafts"]').click();await picture(page,'root-shafts-left');await page.locator('[data-inspect="fibers"]').click();
 await page.locator('#save').click();const before=(await page.evaluate(()=>lengthGroom.diagnostics())).curveHash;await page.locator('#restore').click();await page.evaluate(()=>lengthGroom.whenRendered());check('existing storage actions preserved',(await page.evaluate(()=>lengthGroom.diagnostics())).curveHash===before);
 await page.reload({waitUntil:'domcontentloaded'});d=await ready(page);report.timings.newWarm=d.startup.loading;check('warm startup uses verified persistent blocks without downloading assets',d.startup.loading.networkBytes===0&&d.startup.loading.cacheBytes===manifest.startupBytes,d.startup.loading);check('warm startup original default groom',d.curveHash===expected['textured-fringe'].curveHash);
 if(!publicMode){
  const first=manifest.assets.core.chunks[0],broken=new URL(first.path,url).href;
  await page.evaluate(async u=>{const c=await caches.open(__HAIR_BOOT.cacheName);await c.put(u,new Response('deliberately corrupt QA bytes'));},broken);
  let injected=0;await page.route(broken,r=>{if(!injected++){return r.fulfill({status:503,body:'controlled temporary failure'});}return r.continue();});
  await page.reload({waitUntil:'domcontentloaded'});d=await ready(page);report.recovery=d.startup.loading;
  check('corrupt cache and temporary failed block recover without full redownload',injected===2&&d.startup.loading.retries===1&&d.startup.loading.cacheWarnings.length>0&&d.startup.loading.networkBytes===first.bytes,d.startup.loading);await picture(page,'cache-recovered');
  const full=await page.evaluate(()=>lengthGroom.loadOriginalBases());check('on-demand bases reconstruct original full model SHA',full.ready&&full.sha256===manifest.original.sha256);check('basis hydration cannot change hairstyle',(await page.evaluate(()=>lengthGroom.diagnostics())).curveHash===expected['textured-fringe'].curveHash);
 }
 await ctx.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),m=await pageIn(mobile,false);await m.goto(url,{waitUntil:'domcontentloaded',timeout:120000});const md=await ready(m);check('mobile viewport preserves inherited 36k setting',md.qualityRoots===36000&&md.ready);await picture(m,'mobile-390x844');await m.locator('#panelToggle').click();check('mobile parameter drawer opens',await m.locator('#controls').isVisible());await m.screenshot({path:out+'/mobile-controls.png'});await mobile.close();
 check('no page runtime errors',report.errors.length===0,report.errors);report.success=true;
}catch(e){report.failure=String(e.stack||e);console.error(report.failure);process.exitCode=1;}finally{save();await browser.close();}
