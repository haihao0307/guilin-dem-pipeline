import {chromium} from 'playwright';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';import assert from 'node:assert/strict';import{PNG}from'pngjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),url=process.argv[2],isPublic=process.argv.includes('--public'),out=root+'/evidence/'+(isPublic?'public':'candidate');fs.mkdirSync(out,{recursive:true});
const expected=JSON.parse(fs.readFileSync(root+'/BASELINE_HASHES.json'));
const report={success:false,url,checks:[],errors:[],requests:[],states:[],injectedFaults:[],realPhoneTest:false};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name);assert(pass,name);}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
async function ready(p){await p.waitForFunction(()=>window.lengthGroom&&(lengthGroom.diagnostics().ready||lengthGroom.diagnostics().startup?.failure),{},{timeout:300000});const d=await p.evaluate(()=>lengthGroom.diagnostics());assert(d.ready,JSON.stringify(d.startup));await p.evaluate(()=>lengthGroom.whenRendered());return p.evaluate(()=>lengthGroom.diagnostics());}
async function image(p,name){await p.evaluate(()=>lengthGroom.whenRendered());const bytes=await p.locator('#canvas').screenshot({path:out+'/'+name+'.png'}),im=PNG.sync.read(bytes);let varied=0;for(let i=0;i<im.data.length;i+=16)if(Math.abs(im.data[i]-43)+Math.abs(im.data[i+1]-50)+Math.abs(im.data[i+2]-57)>30)varied++;check(name+' actual rendered pixels',varied>1000,{varied});}
async function blockModels(p){await p.route('**/*',route=>{const u=route.request().url();report.requests.push(u);if(/gnm_(?:head|samplers)_web\.bin/.test(u)){report.inadvertentModelRequests=(report.inadvertentModelRequests||0)+1;return route.abort('timedout');}return route.continue();});}
try{
 const context=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:1}),p=await context.newPage();await blockModels(p);p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await p.goto(url,{waitUntil:'domcontentloaded',timeout:180000});let d=await ready(p);report.states.push(d);
 check('startup ready with same original GNM, not white fallback',d.version==='R14.2-L01'&&d.headCount===1&&d.headIntegration?.face?.ready&&d.headIntegration?.eyes?.ready);
 check('model is verified from embedded document',d.assets[0]?.transport==='embedded-verified-gzip'&&d.assets[0]?.bytes===34937952);
 for(const style of ['textured-fringe','side-flow','curtain-layer']){
  if(style!=='textured-fringe'){await p.locator('[data-preset="'+style+'"]').click();await p.waitForFunction(s=>lengthGroom.diagnostics().recipe.style===s&&!lengthGroom.diagnostics().busy,style,{timeout:240000});d=await ready(p);}
  const e=expected[style];check(style+' unchanged roots/head/curves/buffers',Object.keys(e).every(k=>d[k]===e[k]),{expected:e,actual:Object.fromEntries(Object.keys(e).map(k=>[k,d[k]]))});
  await p.locator('[data-view="top"]').click();await image(p,style+'-top');
 }
 await p.locator('[data-view="left"]').click();await image(p,'left');await p.locator('[data-inspect="root-shafts"]').click();await image(p,'root-shafts');await p.locator('[data-inspect="fibers"]').click();
 const snapshot=await p.evaluate(()=>lengthGroom.snapshot());await p.locator('#save').click();await p.locator('#restore').click();await p.evaluate(()=>lengthGroom.whenRendered());check('save and restore remain usable',(await p.evaluate(()=>lengthGroom.snapshot())).macro.style===snapshot.macro.style);
 check('no GNM download attempted despite network block',!report.inadvertentModelRequests);
 check('no shader/page/console errors',report.errors.length===0,report.errors);
 await context.close();
 if(!isPublic){
  // Failure is injected only into this test response, never the delivered HTML.
  const ctx=await browser.newContext({viewport:{width:1000,height:850}}),q=await ctx.newPage();
  await q.route(url,async route=>{const response=await route.fetch(),html=await response.text();await route.fulfill({response,body:html.replace('id="gnmHeadPayload"','id="heldGnmPayload"')});});
  await q.goto(url,{waitUntil:'domcontentloaded'});await q.waitForFunction(()=>window.lengthGroom?.diagnostics().startup?.failure,{},{timeout:30000});
  const before=await q.evaluate(()=>lengthGroom.diagnostics());report.injectedFaults.push(before.startup);
  check('missing embedded asset shows accurate startup error and enabled retry',!before.ready&&before.startup.failure.code==='HEAD_PAYLOAD_MISSING'&&await q.locator('#startupRecovery').isVisible()&&await q.locator('#retryStartup').isEnabled());
  await q.screenshot({path:out+'/injected-missing-payload.png'});
  await q.evaluate(()=>{document.getElementById('heldGnmPayload').id='gnmHeadPayload';});await q.locator('#retryStartup').click();const after=await ready(q);
  check('real retry recovers once without duplicate head or changed hair',after.ready&&after.headCount===1&&after.curveHash===expected['textured-fringe'].curveHash);
  await image(q,'recovered-after-retry');await ctx.close();
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),m=await mobile.newPage();await blockModels(m);await m.goto(url,{waitUntil:'domcontentloaded',timeout:180000});const md=await ready(m);
 check('390x844 viewport starts with 36k roots',md.qualityRoots===36000&&md.ready&&md.assets[0].transport==='embedded-verified-gzip');await image(m,'mobile-390x844');await m.locator('#panelToggle').click();check('mobile controls drawer opens',await m.locator('#controls').isVisible());await m.screenshot({path:out+'/mobile-controls.png'});await mobile.close();
 report.success=true;
}catch(e){report.failure=String(e.stack||e);console.error(report.failure);process.exitCode=1;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
