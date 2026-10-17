const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const engine=process.env.PPF_BROWSER||'chromium',out='ppf-card-'+engine;
fs.mkdirSync(out,{recursive:true});let browser;const report={engine,errors:[]};
(async()=>{
 browser=await({chromium,webkit}[engine]).launch({headless:true});const page=await browser.newPage({viewport:{width:2048,height:1040},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-human-overview/#clothing',{waitUntil:'domcontentloaded'});
 const card=page.locator('#clothing-ppf');await card.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const i=document.querySelector('#clothing-ppf img');return i?.complete&&i.naturalWidth>0;},null,{polling:50,timeout:30000});
 await card.locator('img').evaluate(i=>i.decode());
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 report.image=await card.locator('img').evaluate(i=>({src:i.currentSrc,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,box:i.getBoundingClientRect().toJSON(),complete:i.complete}));
 assert.equal(report.image.naturalWidth,2048);assert.equal(report.image.naturalHeight,1040);
 assert.equal(await page.locator('a[data-entry]').count(),22);
 await page.screenshot({path:path.join(out,'overview-loaded-'+engine+'.png')});
 await card.screenshot({path:path.join(out,'ppf-card-loaded-'+engine+'.png')});
 assert.deepEqual(report.errors,[]);report.success=true;
})().catch(e=>{report.success=false;report.failure=e.stack;process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser?.close();console.log(JSON.stringify(report));});
