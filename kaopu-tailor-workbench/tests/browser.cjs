const assert=require('node:assert/strict'),fs=require('node:fs');
let pw;try{pw=require('playwright');}catch{pw=require('/opt/codex/cua_node/lib/node_modules/playwright');}
const engine=process.env.TAILOR_BROWSER||'chromium',base=process.env.TAILOR_URL||'http://127.0.0.1:8765/kaopu-tailor-workbench/',out=process.env.TAILOR_QA_DIR||'tailor-qa';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await pw[engine].launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1050},hasTouch:true}),page=await context.newPage(),errors=[],badResponses=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/kaopu-tailor-workbench/'))badResponses.push(r.url());});page.on('request',r=>{if(new URL(r.url()).origin!==new URL(base).origin)external.push(r.url());});
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__TAILOR_QA__?.getState().valid);
 assert.match(await page.title(),/裁缝工作台/);assert.equal(await page.locator('canvas').count(),2);
 await page.screenshot({path:`${out}/initial-${engine}.png`,fullPage:true});
 await page.locator('#cut').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#sew').isEnabled(),true);
 await page.locator('#sew').click();await page.locator('#pause').click();const joined=await page.evaluate(()=>window.__TAILOR_QA__.step(180));
 assert.equal(joined.activeStitches,17);assert.ok(joined.maxSeamGapMm<1.2,JSON.stringify(joined));assert.ok(joined.maxPrincipalStrain<.05,JSON.stringify(joined));assert.equal(await page.locator('#sew').isDisabled(),true);
 await page.screenshot({path:`${out}/sewn-${engine}.png`,fullPage:true});
 const downloadPromise=page.waitForEvent('download');await page.locator('#exportPattern').click();const download=await downloadPromise;const downloadPath=await download.path(),paper=fs.readFileSync(downloadPath);assert.equal(JSON.parse(paper).schema,'kaopu-sewing-graph@1');
 await page.locator('#detach').click();await page.locator('#pause').click();await page.locator('#pull').check();await page.locator('#pause').click();const separated=await page.evaluate(()=>window.__TAILOR_QA__.step(90));assert.equal(separated.activeStitches,0);assert.ok(separated.meanSeamGapMm>10);await page.screenshot({path:`${out}/detached-${engine}.png`,fullPage:true});
 await page.locator('#release').click();assert.equal((await page.evaluate(()=>window.__TAILOR_QA__.getState())).metrics.pins,0);
 await page.locator('#width').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#sew').isDisabled(),true);assert.equal((await page.evaluate(()=>window.__TAILOR_QA__.getState())).metrics.activeStitches,0);
 for(const bad of ['direction','easeError','reference']){await page.locator('#example').selectOption(bad);assert.equal(await page.locator('#cut').isDisabled(),true);assert.equal((await page.evaluate(()=>window.__TAILOR_QA__.getState())).valid,false);assert.match(await page.locator('#gate').innerText(),/已阻止制缝/);}
 await page.locator('#example').selectOption('ease');assert.equal(await page.locator('#cut').isEnabled(),true);
 await page.locator('#import').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:paper});assert.equal(await page.locator('#width').isDisabled(),true);assert.match(await page.locator('#revision').innerText(),/已导入/);
 await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"bad"}')});assert.match(await page.locator('#gate').innerText(),/导入失败/);
 await page.locator('#reset').click();assert.equal(await page.locator('#width').isEnabled(),true);await page.locator('#cut').click();await page.locator('#gravity').check();await page.locator('#obstacle').check();await page.locator('#pause').click();const obstacle=await page.evaluate(()=>window.__TAILOR_QA__.step(60));assert.ok(obstacle.finite);assert.ok(obstacle.maxVertexSpherePenetrationMm<1e-6);assert.equal(obstacle.bodyContact,'not_implemented');
 await page.locator('#reset').click();
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:width===1440?1050:844});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: horizontal overflow`);await page.screenshot({path:`${out}/width-${width}-${engine}.png`,fullPage:true});}
 await page.locator('a[href="#learning"]').tap();await page.waitForURL('**/#learning');await page.goBack();assert.ok(!page.url().endsWith('#learning'));await page.goForward();assert.ok(page.url().endsWith('#learning'));
 assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);assert.deepEqual(external,[]);
 const result={passed:true,engine,version:browser.version(),joined,separated,obstacle,widths:[1440,390,320],roundtrip:true,invalidImports:true,invalidatedAfterPatternEdit:true,keyboard:true,touch:true,backForward:true,actualPhone:false,errors,badResponses,external};fs.writeFileSync(`${out}/result-${engine}.json`,JSON.stringify(result,null,2));console.log('TAILOR_QA_RESULT '+JSON.stringify(result));
 // A small, genuine viewport capture is also logged for review without artifact credentials.
 await page.setViewportSize({width:1280,height:900});await page.goto(base,{waitUntil:'networkidle'});await page.locator('#cut').click();await page.locator('#sew').click();await page.locator('#pause').click();await page.evaluate(()=>window.__TAILOR_QA__.step(180));const shot=await page.screenshot({type:'jpeg',quality:55});console.log('TAILOR_SCREENSHOT_BASE64_BEGIN '+shot.toString('base64')+' TAILOR_SCREENSHOT_BASE64_END');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
