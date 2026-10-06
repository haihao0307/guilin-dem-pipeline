const assert=require('node:assert/strict'),fs=require('node:fs');
let playwright;try{playwright=require('playwright')}catch{playwright=require('/opt/codex/cua_node/lib/node_modules/playwright')}
const engine=process.env.FACE_BROWSER||'chromium',url=process.env.FACE_URL||'http://127.0.0.1:8765/kaopu-face-workbench/';
(async()=>{
 const browser=await playwright[engine].launch(engine==='webkit'?{headless:true}:{headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={engine,version:browser.version(),url,legacyReproduction:null,cases:[],actualUserWindowsBrowser:false};
 async function fresh(options={}){const c=await browser.newContext({viewport:{width:1366,height:900},...options});return[c,await c.newPage()];}
 async function ready(page){await page.waitForFunction(()=>window.faceWorkbench&&window.faceWorkbench.diagnostics().ready,null,{timeout:180000});const d=await page.evaluate(()=>({model:window.faceWorkbench.diagnostics(),pixel:window.faceWorkbench.pixelAudit()}));assert.equal(d.model.vertices,17821);assert.ok(d.pixel.colors>20);return d;}
 if(process.env.ENTRY_EXPECT_LEGACY==='1'){
  const[c,p]=await fresh();await p.route('**/kaopu-face-workbench/src/app.js',r=>r.abort());await p.goto('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-face-workbench/',{waitUntil:'domcontentloaded'});await p.click('#enter');await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>document.getElementById('home').hidden),false);assert.equal(await p.evaluate(()=>location.hash),'');assert.equal(await p.evaluate(()=>!!window.faceWorkbench),false);await p.screenshot({path:'entry-legacy-inert.png'});report.legacyReproduction='Original public R01 module request failure reproduces visible intro and inert entry';await c.close();
 }
 {
  const[c,p]=await fresh();let moduleRequests=0;await p.route('**/vendor/three.module.js',async r=>{await new Promise(resolve=>setTimeout(resolve,2000));await r.continue();});p.on('request',r=>{if(r.url().includes('/src/app.js'))moduleRequests++});await p.goto(url,{waitUntil:'domcontentloaded'});await p.click('#enter');assert.equal(await p.evaluate(()=>document.getElementById('workbench').hidden),false);assert.match(await p.locator('#loadText').textContent(),/三维组件/);assert.equal(await p.evaluate(()=>!!window.faceWorkbench),false);await p.screenshot({path:'entry-slow-visible.png'});await p.click('#back');assert.equal(await p.evaluate(()=>document.getElementById('home').hidden),false);await p.waitForFunction(()=>window.faceBoot.ready);assert.equal(await p.evaluate(()=>document.getElementById('home').hidden),false);await p.click('#enter');await ready(p);assert.equal(moduleRequests,1);await p.screenshot({path:'entry-cold-ready.png'});report.cases.push('cold-cache delayed dependency: immediate visible state, early back retained, one module instance, real GNM after reenter');await c.close();
 }
 {
  const[c,p]=await fresh();let failed=false;await p.route('**/src/app.js?*',async r=>{if(!failed){failed=true;await r.fulfill({status:404,contentType:'text/plain',body:'Synthetic one-shot missing module'});}else await r.continue();});await p.goto(url,{waitUntil:'domcontentloaded'});await p.click('#enter');await p.waitForFunction(()=>window.faceBoot.phase==='failed');assert.equal(await p.locator('#bootRetry').isVisible(),true);assert.match(await p.locator('#loadText').textContent(),/组件.*(失败|未能)/);await p.screenshot({path:'entry-module-failed.png'});await p.click('#bootRetry');await ready(p);await p.screenshot({path:'entry-retry-ready.png'});report.cases.push('module404: clear visible failure and one explicit reload recovers actual GNM');await c.close();
 }
 {
  const[c,p]=await fresh();await p.route('**/src/app.js?*',r=>r.fulfill({status:200,contentType:'text/javascript',body:'export const = !!!;'}));await p.goto(url,{waitUntil:'domcontentloaded'});await p.click('#enter');await p.waitForFunction(()=>window.faceBoot.phase==='failed');assert.equal(await p.locator('#bootRetry').isVisible(),true);assert.equal(await p.evaluate(()=>!!window.faceWorkbench),false);report.cases.push('module syntax/compatibility failure remains visible without a fake head');await c.close();
 }
 {
  const[c,p]=await fresh();await p.addInitScript(()=>{Object.defineProperty(window,'fetch',{value:undefined,configurable:true});});await p.goto(url,{waitUntil:'domcontentloaded'});await p.click('#enter');await p.waitForFunction(()=>window.faceBoot.phase==='failed');assert.match(await p.locator('#loadText').textContent(),/浏览器缺少/);await p.screenshot({path:'entry-unsupported-visible.png'});report.cases.push('missing required browser capability gets explicit guidance');await c.close();
 }
 {
  const[c,p]=await fresh({javaScriptEnabled:false});await p.goto(url);assert.equal(await p.locator('noscript').isVisible(),true);report.cases.push('JavaScript disabled has static noscript guidance');await c.close();
 }
 report.passed=true;fs.writeFileSync('entry-qa-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
