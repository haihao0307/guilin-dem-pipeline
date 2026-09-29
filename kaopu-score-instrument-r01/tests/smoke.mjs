import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const url = process.env.TARGET_URL;
if (!url) throw new Error('TARGET_URL required');
const prefix = url.startsWith('file:') ? 'standalone' : 'public';
await mkdir('qa-artifacts', {recursive:true});
const reports = [];
const browser = await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
async function run(name, viewport) {
  const page = await browser.newPage({viewport,deviceScaleFactor:1});
  const errors=[], requests=[];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on('request', r => { if(r.resourceType()!=='document' && !r.url().startsWith('data:')) requests.push(r.url()); });
  try {
    const response = await page.goto(url,{waitUntil:'load',timeout:90000});
    if (prefix==='public') { assert.equal(response.status(),200); assert.match(response.headers()['content-type'],/text\/html/); }
    await page.waitForFunction(() => window.__KAOPU_R01__?.state().frames>3);
    assert.equal(await page.title(),'KAOPU · Score Instrument R01');
    assert.equal(await page.evaluate(() => window.__KAOPU_R01__.version),'K1.0.1');
    const actualBytes = prefix==='standalone' ? (await readFile(fileURLToPath(url))).length : (await response.body()).length;
    assert.equal(Number(await page.locator('meta[name="kaopu-instrument-bytes"]').getAttribute('content')),actualBytes);
    const canvas=page.locator('#viewport canvas');
    let box=await canvas.boundingBox();
    assert.ok(box.width>200 && box.height>200);
    const examples=page.locator('[data-score]');
    const count=await examples.count();
    assert.equal(count,12);
    const samples=[];
    for(let i=0;i<count;i++) {
      await examples.nth(i).click();
      const result=await page.evaluate(() => ({metrics:window.__KAOPU_R01__.metrics(),error:window.__KAOPU_R01__.state().error,passed:window.__KAOPU_R01__.verify()}));
      assert.equal(result.error,null); assert.equal(result.passed,true); assert.ok(result.metrics.triangles>0);
      if(i<6) assert.equal(result.metrics.bytes,4);
      samples.push(result.metrics);
    }
    await examples.first().click();
    const original=await page.evaluate(() => window.__KAOPU_R01__.metrics());
    await page.locator('#score').fill('K1|b1,1,1');
    // Editing must not mix draft bytes with the previous output statistics.
    assert.equal(await page.locator('#bytes').textContent(),'4 B');
    await page.locator('#play').click();
    assert.equal(await page.locator('#hash').textContent(),original.hash);
    await page.locator('#verify').click();
    assert.match(await page.locator('#status').textContent(),/重演校验通过/);
    await page.locator('#score').fill('K1|A4,1{s.2#eb5};b.5,.8,.5');
    await page.locator('#play').click();
    assert.equal((await page.evaluate(() => window.__KAOPU_R01__.metrics())).objects,5);
    await canvas.scrollIntoViewIfNeeded();
    box=await canvas.boundingBox();
    const before=await page.evaluate(() => ({camera:window.__KAOPU_R01__.state().camera,hash:window.__KAOPU_R01__.metrics().hash}));
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width*.72,box.y+box.height*.32,{steps:10});
    await page.mouse.up();
    await page.waitForTimeout(350);
    assert.notDeepEqual(await page.evaluate(() => window.__KAOPU_R01__.state().camera),before.camera);
    assert.equal(await page.locator('#hash').textContent(),before.hash);
    const dragCamera=await page.evaluate(() => window.__KAOPU_R01__.state().camera);
    await page.mouse.wheel(0,-200); await page.waitForTimeout(250);
    assert.notDeepEqual(await page.evaluate(() => window.__KAOPU_R01__.state().camera),dragCamera);
    await page.locator('#camera').click();
    for(const invalid of ['K1|A0,1{s}', 'K1|A2,1,3{s}', 'K1|s@']) {
      await page.locator('#score').fill(invalid); await page.locator('#play').click();
      assert.match(await page.locator('#status').textContent(),/谱子未执行/);
      assert.equal(await page.locator('#hash').textContent(),before.hash);
    }
    // Fresh navigation must rebuild from the text, not a cached object.
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(() => window.__KAOPU_R01__?.state().frames>3);
    await page.locator('[data-score="K1|b"]').click();
    assert.equal(await page.locator('#hash').textContent(),original.hash);
    assert.equal(await page.evaluate(() => window.__KAOPU_R01__.verify()),true);
    assert.ok((await page.evaluate(() => window.__KAOPU_R01__.state())).calls>0);
    assert.deepEqual(requests,[]); assert.deepEqual(errors,[]);
    await page.locator('[data-score="K1|A12,1.2{s.15}"]').click();
    await canvas.scrollIntoViewIfNeeded();
    await page.screenshot({path:`qa-artifacts/${prefix}-${name}.png`,fullPage:true});
    reports.push({name,viewport,version:'K1.0.1',examples:count,actualHtmlBytes:actualBytes,externalRequests:requests.length,errors,outputReplay:true,equivalentScores:true,cameraMovement:true,samples});
  } catch(error) {
    console.error({name,errors,requests,url:page.url(),status:await page.locator('#status').textContent({timeout:1000}).catch(()=>null)});
    await page.screenshot({path:`qa-artifacts/${prefix}-${name}-failure.png`,fullPage:true}).catch(()=>{});
    throw error;
  } finally { await page.close(); }
}
try { await run('desktop',{width:1440,height:900}); await run('mobile-viewport',{width:390,height:844}); }
finally { await browser.close(); await writeFile(`qa-artifacts/${prefix}-results.json`,JSON.stringify({url,reports},null,2)); }
console.log(`PASS ${prefix}: 12 examples x 2 viewports; full-output replay, camera, input errors, fresh reload, byte ledger.`);
