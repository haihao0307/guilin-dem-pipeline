import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const target=process.env.WZ1942_URL||'http://127.0.0.1:8768/site/dist/r3-8/history-1942.html';
const out=process.env.WZ1942_OUT||'/tmp/wz1942';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
if(target.includes('githack'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
const page=await context.newPage();
const failures=[];const check=(v,m)=>{if(!v)failures.push(m);};
try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r1',{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch,{},{timeout:120000});
  const history=await page.evaluate(()=>window.__wenzhouHistory1942Preclean);
  check(history?.active===true,'history preclean not active');
  check(history?.summary?.motorway>0,'no motorway parts removed');
  check(history?.summary?.motorwayLink>0,'no motorway_link parts removed');
  check(history?.summary?.removedParts===history.summary.motorway+history.summary.motorwayLink,'removed part count mismatch');
  check(history?.railwayAction==='none-current-runtime-has-no-railway-layer','railway boundary mismatch');
  const manifest=await page.evaluate(()=>fetch('../r3-5/data/osm/osm-context.json').then(r=>r.json()));
  check(manifest.history1942Preclean?.active===true,'intercepted manifest missing history policy');
  const overview=manifest.patches.find(p=>p.id==='overview');
  check(!('motorway' in overview.roads.classPartCounts),'overview motorway class survived');
  check(!('motorway_link' in overview.roads.classPartCounts),'overview motorway_link class survived');
  check(overview.roads.sourcePartCount>overview.roads.partCount,'overview road part count did not shrink');
  await page.selectOption('#location','query-02');
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='query-02',{},{timeout:120000});
  const q2=manifest.patches.find(p=>p.id==='query-02'),q2summary=history.summary.patches.find(p=>p.id==='query-02');
  check(q2summary?.removedParts>0,'query-02 has no removed motorway parts');
  check(q2.roads.sourcePartCount-q2.roads.partCount===q2summary.removedParts,'query-02 source/filtered part delta mismatch');
  const ds=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
  check(Number(ds.osmRoadParts)===q2.roads.partCount,'runtime did not consume filtered query-02 road parts');
  check(ds.historyMode==='1942-preclean-r1','canvas history mode missing');
  await page.screenshot({path:`${out}/desktop-query-02.png`,fullPage:true});
  await page.selectOption('#location','overview');
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='overview',{},{timeout:120000});
  await page.screenshot({path:`${out}/desktop-overview.png`,fullPage:true});

  const modernTarget=target.replace('history-1942.html','index.html');
  const modern=await context.newPage();await modern.goto(modernTarget,{waitUntil:'domcontentloaded',timeout:120000});
  await modern.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch,{},{timeout:120000});
  await modern.selectOption('#location','query-02');
  await modern.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='query-02',{},{timeout:120000});
  const modernParts=Number(await modern.locator('#terrain').getAttribute('data-osm-road-parts'));
  check(modernParts===q2.roads.sourcePartCount,'modern baseline road count changed');
  check(modernParts>Number(ds.osmRoadParts),'modern baseline is not larger than historical preclean');
  await modern.close();

  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
  const mp=await mobile.newPage();await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await mp.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r1',{},{timeout:120000});
  const mcard=await mp.locator('#history-1942-card').isVisible();check(mcard,'mobile history status card not visible');
  await mp.screenshot({path:`${out}/mobile-390x844.png`,fullPage:true});await mobile.close();
  console.log(JSON.stringify({passed:!failures.length,target,removedMotorwayParts:history.summary.motorway,removedMotorwayLinkParts:history.summary.motorwayLink,removedRoadParts:history.summary.removedParts,removedRoadSegments:history.summary.removedSegments,overview:{sourceParts:overview.roads.sourcePartCount,filteredParts:overview.roads.partCount},query02:{sourceParts:q2.roads.sourcePartCount,filteredParts:q2.roads.partCount,removedParts:q2summary.removedParts},failures},null,2));
}catch(e){failures.push(e.stack||String(e));console.log(JSON.stringify({passed:false,target,failures},null,2));}
finally{await browser.close();}
if(failures.length)process.exit(1);
