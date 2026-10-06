/* Overview-only browser QA. Workbench model/control QA belongs to each workbench. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/codex/cua_node/lib/node_modules/playwright'); }
const base = process.env.OVERVIEW_URL || 'http://127.0.0.1:8000/kaopu-human-overview/';
const engine = process.env.OVERVIEW_BROWSER || 'chromium';
const out = process.env.OVERVIEW_QA_DIR || '.';
const fixtureNavigation = process.env.OVERVIEW_NAV_FIXTURE === '1';
assert.ok(['chromium','webkit'].includes(engine));
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser = await playwright[engine].launch(engine==='webkit'?{headless:true}:{headless:true,executablePath:process.env.CHROMIUM||undefined,args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true});
  const page = await context.newPage();
  const navContext=await browser.newContext({viewport:{width:1440,height:1100},hasTouch:true});
  const navPage=await navContext.newPage(),navigationWarnings=[];
  navPage.on('pageerror',e=>navigationWarnings.push({url:navPage.url(),message:e.message}));
  const errors=[],badResponses=[],unexpectedRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/kaopu-human-overview/'))badResponses.push({url:r.url(),status:r.status()})});
  page.on('request',r=>{if(r.method()!=='GET')unexpectedRequests.push(r.url())});
  if(fixtureNavigation){
    await navPage.route('**/*',async route=>{
      const r=route.request(),u=new URL(r.url());
      if(r.isNavigationRequest()&&!u.pathname.includes('/kaopu-human-overview/')){
        await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html lang="zh-CN"><title>Navigation-only fixture</title><body><h1>Navigation-only fixture</h1></body></html>'});
      }else await route.continue();
    });
  }
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('h1').waitFor();
  assert.equal(await page.title(),'KAOPU · 人物工作台');
  assert.equal(await page.locator('article.workbench-card').count(),3);
  assert.equal(await page.locator('iframe,canvas').count(),0,'Overview must not preload parallel WebGL workbenches');
  assert.equal(await page.locator('article.is-pending a').count(),0,'Pending cards cannot be live links');
  assert.equal(await page.locator('a[target="_blank"]').count(),0,'Model entries stay in the same tab');
  const images=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>({src:i.getAttribute('src'),ready:i.complete&&i.naturalWidth>0,width:i.naturalWidth,height:i.naturalHeight,alt:i.alt})));
  assert.ok(images.length>=1);
  for(const i of images){assert.ok(i.ready,i.src);assert.ok(i.alt.length>5,i.src)}
  const routes=await page.locator('.card-link[href],.shared-visual a[href]').evaluateAll(as=>as.map(a=>({href:a.getAttribute('href'),label:a.getAttribute('aria-labelledby')||a.textContent.trim(),id:a.closest('[id]')?.id})));
  assert.equal(routes[0].href,'../kaopu-face-workbench/?loader=single-r01-20261006#edit');
  for(const route of routes){
    assert.ok(route.href.startsWith('../kaopu-'));
    await navPage.goto(base,{waitUntil:'domcontentloaded'});
    const link=navPage.locator(`a[href="${route.href}"]`);
    await link.focus();
    assert.equal(await link.evaluate(a=>a===document.activeElement),true);
    await Promise.all([navPage.waitForURL(new URL(route.href,base).href,{waitUntil:'domcontentloaded'}),navPage.keyboard.press('Enter')]);
    assert.equal(navContext.pages().length,1,'Keyboard entry opened an extra tab');
    assert.ok(!await navPage.title().then(t=>/404|not found/i.test(t)),'Entry must not show a 404 page');
    await navPage.goBack({waitUntil:'domcontentloaded'});
    await navPage.locator('#title').waitFor();
    assert.equal(navPage.url(),base);
    await navPage.goForward({waitUntil:'domcontentloaded'});
    assert.equal(navPage.url(),new URL(route.href,base).href);
    await navPage.goBack({waitUntil:'domcontentloaded'});
    await navPage.locator('#title').waitFor();
  }
  for(const size of [{name:'desktop',width:1440,height:1100},{name:'mobile',width:390,height:844},{name:'small-mobile',width:320,height:750}]){
    await page.setViewportSize(size);
    await page.waitForTimeout(80);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),size.name+' horizontal overflow');
    const boxes=await page.locator('.card-link').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height}}));
    assert.ok(boxes.every(b=>b.w>=44&&b.h>=44));
    await page.screenshot({path:`${out}/overview-${size.name}-${engine}.png`,fullPage:true});
  }
  await page.locator('.guide-link').tap();
  await page.waitForURL('**/#guide');
  await page.locator('summary').tap();
  assert.equal(await page.locator('details').getAttribute('open'),'');
  await page.locator('summary').tap();
  assert.equal(await page.locator('details').getAttribute('open'),null);
  await navPage.goto(base,{waitUntil:'networkidle'});
  await navPage.locator('#gnm a').tap();
  await navPage.waitForURL(new URL(routes[0].href,base).href);
  assert.equal(navContext.pages().length,1);
  await navPage.goBack({waitUntil:'domcontentloaded'});
  await navPage.locator('#title').waitFor();
  assert.deepEqual(badResponses,[]);
  assert.deepEqual(unexpectedRequests,[]);
  assert.deepEqual(errors,[]);
  const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const nopage=await nojs.newPage();
  await nopage.goto(base,{waitUntil:'networkidle'});
  assert.equal(await nopage.locator('#gnm a').count(),1);
  assert.ok(await nopage.locator('#title').isVisible());
  const result={passed:true,engine,version:browser.version(),base,images,routes,pending:await page.locator('.is-pending').count(),navigation:fixtureNavigation?'fixture-only: real workbench destinations not verified':'real destination document and same-tab Back; model controls tested separately',keyboard:true,touch:true,backForward:true,noJavaScript:true,noIframeOrCanvas:true,widths:[1440,390,320],actualPhoneTested:false,errors,badResponses,unexpectedRequests,navigationWarnings};
  fs.writeFileSync(`${out}/overview-${engine}-result.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
