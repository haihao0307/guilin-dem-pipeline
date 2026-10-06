/* Overview navigation/layout QA. Each workbench owns model and inference acceptance. */
const assert=require('node:assert/strict'),fs=require('node:fs');
let playwright;try{playwright=require('playwright')}catch{playwright=require('/opt/codex/cua_node/lib/node_modules/playwright')}
const base=process.env.OVERVIEW_URL||'http://127.0.0.1:8000/kaopu-human-overview/',engine=process.env.OVERVIEW_BROWSER||'chromium',out=process.env.OVERVIEW_QA_DIR||'.';
assert.ok(['chromium','webkit'].includes(engine));fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await playwright[engine].launch(engine==='webkit'?{headless:true}:{headless:true,executablePath:process.env.CHROMIUM||undefined,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true}),page=await ctx.newPage();
 await page.emulateMedia({reducedMotion:'reduce'});
 const navCtx=await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true}),nav=await navCtx.newPage();
 const errors=[],badResponses=[],nonGets=[],navigationWarnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/kaopu-human-overview/'))badResponses.push({url:r.url(),status:r.status()})});page.on('request',r=>{if(r.method()!=='GET')nonGets.push(r.url())});nav.on('pageerror',e=>navigationWarnings.push({url:nav.url(),message:e.message}));
 await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.title(),'KAOPU · 统一创作工作台');
 assert.equal(await page.locator('article.workbench-card a.card-link').count(),3);
 assert.match(await page.locator('#gnm-name').textContent(),/手动捏脸/);assert.match(await page.locator('#gnm').textContent(),/照片对照/);assert.match(await page.locator('#gnm').textContent(),/不含自动照片重建/);
 assert.match(await page.locator('#anny-status').textContent(),/R02 已验收/);assert.equal(await page.locator('#anny a[href="../kaopu-anny-workbench/r02/"]').count(),1);assert.match(await page.locator('#anny').textContent(),/官方语义修正版/);assert.match(await page.locator('#anny').textContent(),/52 表情/);assert.match(await page.locator('#anny').textContent(),/自交诊断待补/);
 assert.equal(await page.locator('#people,#clothing,#animals,#hair').count(),4);
 assert.equal(await page.locator('canvas,iframe,script').count(),0,'Overview must remain static, without parallel model runtimes');
 assert.equal(await page.locator('a[target="_blank"]').count(),0);
 assert.equal(await page.locator('.shared-visual a').count(),1);
 assert.match(await page.locator('#shared-limit').textContent(),/1\/45/);assert.match(await page.locator('#shared-limit').textContent(),/未迁移 MHR 姿态与表情/);assert.match(await page.locator('#shared-limit').textContent(),/全量合并 R02 开发中/);assert.equal(await page.locator('.shared-visual a[href="../kaopu-unified-human-workbench/"]').count(),1);
 assert.equal(await page.locator('#skin a[href="../kaopu-skin-workbench/"]').count(),1);assert.match(await page.locator('#skin-limit').textContent(),/透光仅近似/);assert.match(await page.locator('#skin-limit').textContent(),/非 SkinGen 等效/);
 assert.equal(await page.locator('#clothing .tile-card').count(),2);assert.match(await page.locator('#clothing-r2-description').textContent(),/不是照片 AI 预测/);
 assert.equal(await page.locator('#animals .animal-card').count(),3);assert.match(await page.locator('#animals').textContent(),/三套模型尚未运行/);
 assert.equal(await page.locator('#ten24 img').count(),0,'TEN24 must not reuse the male render as the unavailable female model');assert.match(await page.locator('#ten24').textContent(),/接入待完成/);assert.match(await page.locator('#hair-male').textContent(),/原男性/);
 const routes=await page.locator('a[data-entry]').evaluateAll(as=>as.map(a=>({href:a.getAttribute('href'),returnMode:a.dataset.return,id:a.closest('[id]')?.id||'',label:a.getAttribute('aria-labelledby')||a.textContent.trim()})));
 assert.equal(routes.length,17);assert.equal(new Set(routes.map(r=>r.href)).size,routes.length);
 assert.equal(routes[0].href,'../kaopu-face-workbench/?loader=single-r01-20261006#edit');
 const images=[];
 for(const size of [{name:'desktop',width:1440,height:1100},{name:'mobile',width:390,height:844},{name:'small-mobile',width:320,height:750}]){
  await page.setViewportSize(size);await page.waitForTimeout(80);
  for(const id of ['people','clothing','animals','hair']){await page.locator('#'+id).scrollIntoViewIfNeeded();await page.locator('#'+id+' img').evaluateAll(async imgs=>{await Promise.all(imgs.map(i=>i.decode().catch(()=>{})))});await page.locator('#'+id).screenshot({path:`${out}/overview-${id}-${size.name}-${engine}.png`});}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),size.name+' horizontal overflow');
  for(const selector of ['.card-link','.tile-link','.shared-visual a','.section-nav a']){const boxes=await page.locator(selector).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height}}));assert.ok(boxes.every(b=>b.w>=44&&b.h>=44),size.name+' small touch target '+selector);}
  const previews=await page.locator('.tile-image').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));assert.ok(previews.every(h=>h>=145),size.name+' collapsed tile preview');
  for(const id of ['people','clothing','animals','hair']){await page.locator(`.section-nav a[href="#${id}"]`).tap();await page.waitForURL('**/#'+id);assert.ok(await page.locator('#'+id).isVisible());await page.waitForFunction(sectionId=>{const n=document.querySelector('.section-nav').getBoundingClientRect(),h=document.querySelector('#'+sectionId+' .section-heading').getBoundingClientRect();return h.top>=n.bottom-1&&h.top<innerHeight;},id,{timeout:5000});await page.screenshot({path:`${out}/overview-jump-${id}-${size.name}-${engine}.png`});}
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/overview-${size.name}-${engine}.png`,fullPage:true});
 }
 const checks=await page.locator('img').evaluateAll(is=>is.map(i=>({src:i.getAttribute('src'),ready:i.complete&&i.naturalWidth>0,width:i.naturalWidth,height:i.naturalHeight,alt:i.alt})));
 for(const i of checks){assert.ok(i.ready,i.src);assert.ok(i.alt.length>5,i.src);images.push(i)}
 for(const route of routes){
  assert.ok(route.href.startsWith('../kaopu-'));
  const url=new URL(route.href,base).href,response=await navCtx.request.get(url,{timeout:60000});assert.equal(response.status(),200,'Destination HTTP: '+route.href);assert.match(response.headers()['content-type']||'',/text\/html/);
  await nav.goto(base,{waitUntil:'domcontentloaded'});const link=nav.locator(`a[data-entry][href="${route.href}"]`);await link.focus();assert.equal(await link.evaluate(a=>a===document.activeElement),true);
  await Promise.all([nav.waitForURL(url,{waitUntil:'domcontentloaded',timeout:60000}),nav.keyboard.press('Enter')]);assert.equal(navCtx.pages().length,1);assert.ok(!/404|not found/i.test(await nav.title()));
  await nav.goBack({waitUntil:'domcontentloaded'});await nav.locator('#title').waitFor();assert.equal(nav.url(),base);
  await nav.goForward({waitUntil:'domcontentloaded'});assert.equal(nav.url(),url);
  if(route.returnMode==='direct'){const href=await nav.locator('a[href]').evaluateAll((as,expected)=>as.find(a=>a.href===expected)?.getAttribute('href'),base);assert.ok(href,'Missing resolved overview return link: '+route.href);const back=nav.locator('a[href='+JSON.stringify(href)+']');await back.first().click();await nav.waitForURL(base,{waitUntil:'domcontentloaded'});}else await nav.goBack({waitUntil:'domcontentloaded'});
  await nav.locator('#title').waitFor();assert.equal(navCtx.pages().length,1);
 }
 await page.locator('.guide-link').tap();await page.waitForURL('**/#guide');await page.locator('summary').tap();assert.equal(await page.locator('details').getAttribute('open'),'');await page.locator('summary').tap();assert.equal(await page.locator('details').getAttribute('open'),null);
 await nav.setViewportSize({width:390,height:844});await nav.goto(base,{waitUntil:'domcontentloaded'});await nav.locator('#gnm a').tap();await nav.waitForURL(new URL(routes[0].href,base).href,{waitUntil:'domcontentloaded'});await nav.goBack({waitUntil:'domcontentloaded'});await nav.locator('#title').waitFor();assert.equal(navCtx.pages().length,1);
 assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);assert.deepEqual(nonGets,[]);
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),np=await nojs.newPage();await np.goto(base,{waitUntil:'networkidle'});assert.equal(await np.locator('a[data-entry]').count(),17);assert.ok(await np.locator('#title').isVisible());
 const report={passed:true,engine,version:browser.version(),base,sections:['people','clothing','animals','hair'],images,routes,entryCount:routes.length,sameTab:true,keyboard:true,touch:true,backForward:true,inPageReturnForNewWorkbenches:true,browserReturnForLegacyAndAnimal:true,noJavaScriptOverview:true,noIframeOrCanvas:true,widths:[1440,390,320],actualPhoneTested:false,modelControlsTestedHere:false,animalInferenceClaimed:false,TEN24CompletedClaimed:false,errors,badResponses,nonGets,navigationWarnings};fs.writeFileSync(`${out}/overview-${engine}-result.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
