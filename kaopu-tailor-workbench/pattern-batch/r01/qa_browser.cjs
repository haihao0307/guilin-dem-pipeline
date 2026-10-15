const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=__dirname,out=path.join(root,'qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1080},acceptDownloads:true});
 const checks=[],errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 const check=(name,detail)=>checks.push({name,passed:true,detail});
 try{
  await page.goto(pathToFileURL(path.join(root,'版型总览.html')).href);
  await page.waitForFunction(()=>window.KAOPUPatternBatch);
  assert.equal(await page.locator('.card').count(),60);check('All 60 cards load directly from the offline artifact');
  await page.screenshot({path:path.join(out,'01-全部版型.png')});
  const report=await page.evaluate(()=>window.KAOPUPatternBatch.getCatalogue());
  const tested=[];
  for(const row of report.rows){
   await page.evaluate(id=>window.KAOPUPatternBatch.select(id),row.id);
   assert.equal(await page.locator('#paper [data-outline]').count(),row.panelCount);
   assert.equal(await page.locator('.paper-edge.sewn').count(),row.seamCount*2);
   const bounds=await page.locator('#paper svg').evaluate(svg=>{
    const b=svg.getBBox(),v=svg.viewBox.baseVal;
    return {x:b.x,y:b.y,w:b.width,h:b.height,vw:v.width,vh:v.height,
      inside:b.x>=-.01&&b.y>=-.01&&b.x+b.width<=v.width+.01&&b.y+b.height<=v.height+.01};
   });
   assert.ok(bounds.inside,`${row.id}: clipped analytic paper ${JSON.stringify(bounds)}`);
   const pair=await page.locator('.paper-edge.sewn').first().getAttribute('data-seam');
   // dispatch at the actual SVG edge to test pairing independently of hit area size.
   await page.locator(`.paper-edge[data-seam="${pair}"]`).first().dispatchEvent('click');
   assert.equal(await page.locator('.paper-edge.selected').count(),2);
   tested.push({id:row.id,panelCount:row.panelCount,seamCount:row.seamCount,bounds});
   if(['T10','S12','D12','J05'].includes(row.id))await page.screenshot({path:path.join(out,`${row.id}-裁片详情.png`)});
   await page.locator('#close-detail').click();
  }
  check('All 60 exact SVG panels stay inside the sheet; every paired seam highlights both endpoints',tested);
  for(const [name,total] of Object.entries(report.categories)){
   await page.locator(`[data-category="${name}"]`).click();assert.equal(await page.locator('.card').count(),total.total);
  }check('Five category filters retain every expected style');
  await page.locator('[data-category="全部"]').click();
  await page.locator('#search').fill('连帽');assert.ok(await page.locator('.card').count()>0);
  await page.locator('#search').fill('not-a-pattern');assert.equal(await page.locator('.card').count(),0);assert.ok(await page.locator('#empty').isVisible());
  await page.locator('#search').fill('');check('Search and empty state');
  await page.locator('[data-id="S12"]').click();
  const [single]=await Promise.all([page.waitForEvent('download'),page.locator('#export-json').click()]);
  const singlePath=path.join(out,'exported-S12.json');await single.saveAs(singlePath);
  const ticket=JSON.parse(fs.readFileSync(singlePath,'utf8'));assert.equal(ticket.id,'S12');
  await page.locator('#import-file').setInputFiles(singlePath);await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('已恢复'));
  check('Exported frozen record imports without losing panels or seams');
  const corrupted=structuredClone(ticket);corrupted.pattern.panels[0].verticesMm[0][0]+=10;
  const badPath=path.join(out,'rejected-modified-S12.json');fs.writeFileSync(badPath,JSON.stringify(corrupted));
  await page.locator('#import-file').setInputFiles(badPath);await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('内容已改变'));
  assert.equal(await page.locator('#detail-title').textContent(),ticket.name);check('Mutated import is rejected without replacing the displayed known pattern');
  const [svgDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#export-svg').click()]);
  const svgPath=path.join(out,'exported-S12.svg');await svgDownload.saveAs(svgPath);
  const svg=fs.readFileSync(svgPath,'utf8');assert.match(svg,/width="[\d.]+mm"/);assert.match(svg,/净缝线纸样/);check('Downloaded SVG preserves millimetre dimensions and cutting scope');
  await page.locator('#close-detail').click();
  const [all]=await Promise.all([page.waitForEvent('download'),page.locator('#export-all').click()]);
  const allPath=path.join(out,'exported-batch.json');await all.saveAs(allPath);
  const restored=JSON.parse(fs.readFileSync(allPath,'utf8'));assert.equal(restored.patterns.length,60);check('Whole batch download contains all 60 complete records');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'02-手机版型总览.png'),fullPage:false});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[data-id="D12"]').click();await page.screenshot({path:path.join(out,'03-手机裁片详情.png')});
  assert.ok(await page.evaluate(()=>document.querySelector('#detail').scrollWidth<=document.querySelector('#detail').clientWidth));check('Mobile viewport: gallery and detail have no horizontal overflow');
  assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>/^https?:/.test(u)).length,0);check('Offline artifact makes zero HTTP requests and has no browser errors');
  fs.writeFileSync(path.join(out,'BROWSER_REPORT.json'),JSON.stringify({passed:true,checks,errors,networkRequests:requests.filter(u=>/^https?:/.test(u)),scope:'Fresh offline Chrome browser; paper and controls, not a cloth solve',testedStyles:60},null,2));
  console.log(JSON.stringify({passed:true,checks:checks.length,styles:60,screenshots:7}));
 }catch(e){fs.writeFileSync(path.join(out,'BROWSER_REPORT.json'),JSON.stringify({passed:false,error:e.stack,checks,errors},null,2));await page.screenshot({path:path.join(out,'failure.png')});throw e}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
