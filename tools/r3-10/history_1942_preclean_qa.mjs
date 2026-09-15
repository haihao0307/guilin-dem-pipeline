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
async function diag(p){return p.locator('#terrain').evaluate(c=>({
  terrainEvents:Number(c.dataset.history1953TerrainEvents||0),
  staleEvents:Number(c.dataset.history1953StaleEvents||0),
  committedPatch:c.dataset.history1953CommittedPatch||'',
  controls:Number(c.dataset.history1953ControlSegments||0),
  visualized:c.dataset.history1953Visualized||'',
  lastError:c.dataset.history1953LastError||'',
  maskWidth:Number(c.dataset.history1940sMaskWidth||0),
  maskHeight:Number(c.dataset.history1940sMaskHeight||0),
  historicalWaterPixels:Number(c.dataset.history1940sHistoricalWaterPixels||0),
  reclaimedPixels:Number(c.dataset.history1940sReclaimedPixels||0),
  seaMaskUpdated:c.dataset.history1940sSeaMaskUpdated||'',
  rawGuideLinesVisible:c.dataset.history1940sRawGuideLinesVisible||'',
  osmPatch:c.dataset.osmPatch||'',patch:c.dataset.patch||''
}));}
try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r3',{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch,{},{timeout:120000});
  const history=await page.evaluate(()=>window.__wenzhouHistory1942Preclean);
  check(history?.active===true,'history preclean not active');check(history?.summary?.motorway>0,'no motorway parts removed');check(history?.summary?.motorwayLink>0,'no motorway_link parts removed');check(history?.summary?.majorBridge>0,'no major bridge parts removed');
  const manifest=await page.evaluate(()=>fetch('../r3-5/data/osm/osm-context.json').then(r=>r.json()));
  const verifyPatch=id=>{const p=manifest.patches.find(x=>x.id===id),s=history.summary.patches.find(x=>x.id===id),source=p.roads.sourceModernClassPartCounts||{},active=p.roads.classPartCounts||{},motorway=(source.motorway||0)+(source.motorway_link||0),construction=source.construction||0,bridge=s.majorBridge||0;check(!('motorway' in active),`${id}: motorway survived`);check(!('motorway_link' in active),`${id}: motorway_link survived`);check(!('construction' in active),`${id}: construction survived`);check(p.roads.sourcePartCount-p.roads.partCount===motorway+construction+bridge,`${id}: road subtraction mismatch`);return{p,s,motorway,construction,bridge};};
  const overviewCheck=verifyPatch('overview'),overview=overviewCheck.p;
  await page.selectOption('#location','query-02');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='query-02',{},{timeout:120000});const q2Check=verifyPatch('query-02'),q2=q2Check.p,q2summary=q2Check.s;await page.screenshot({path:`${out}/desktop-query-02.png`,fullPage:true});
  await page.selectOption('#location','overview');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='overview',{},{timeout:120000});
  await page.waitForFunction(()=>Number(document.querySelector('#terrain')?.dataset.history1940sMaskWidth||0)>0,{},{timeout:60000});
  await page.waitForFunction(()=>document.querySelector('.brand p')?.textContent?.includes('1940s Map Mother'),{},{timeout:30000});await page.waitForTimeout(500);
  const h=await diag(page),mm=await page.evaluate(()=>window.__wenzhouMapMother1940s||null),control=await page.evaluate(()=>window.__wenzhouHistoricalControl1953||null);
  check(h.terrainEvents>0,'Map Mother received no terrain events');check(h.lastError==='','Map Mother error: '+h.lastError);check(h.committedPatch==='overview','Map Mother did not commit overview');check(h.controls>0,'historical controls missing');
  check(mm?.schema==='wenzhou-map-mother/1940s-land-water-delta-v1','1940s Map Mother state missing');check(mm?.storage==='runtime-derived-from-vector-controls-no-epoch-dem-copy','epoch DEM duplication guard missing');
  check(h.maskWidth>=256&&h.maskHeight>=256,'historical land-water mask resolution invalid');check(h.historicalWaterPixels>0,'historical water mask empty');check(h.reclaimedPixels>0,'no modern land was rolled back to historical water');check(h.seaMaskUpdated==='true','sea renderer did not receive historical land mask');
  check(control?.visualized===false,'raw historical control must remain nonvisual');check(h.rawGuideLinesVisible==='false','raw guide lines are visible');check(await page.locator('#history-1953-toggle').count()===0,'legacy visual guide toggle survived');check(await page.locator('#history-1953-layer-card').count()===0,'legacy visual guide card survived');check(await page.locator('html').getAttribute('data-wenzhou-history-1953-visual')==='false','nonvisual control contract missing');
  const brand=await page.locator('.brand p').textContent();check(brand?.includes('1940s Map Mother'),'desktop brand does not identify Map Mother state');await page.screenshot({path:`${out}/desktop-overview-1940s.png`,fullPage:true});
  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});const mp=await mobile.newPage();await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await mp.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r3',{},{timeout:120000});await mp.waitForFunction(()=>Number(document.querySelector('#terrain')?.dataset.history1940sMaskWidth||0)>0,{},{timeout:60000});await mp.waitForFunction(()=>document.querySelector('.brand p')?.textContent?.includes('1940s Map Mother'),{},{timeout:30000});check(await mp.locator('#history-1953-toggle').count()===0,'mobile legacy guide toggle survived');const mbrand=await mp.locator('.brand p').textContent();check(mbrand?.includes('1940s Map Mother'),'mobile Map Mother label missing');await mp.screenshot({path:`${out}/mobile-390x844-1940s.png`,fullPage:true});await mobile.close();
  console.log(JSON.stringify({passed:!failures.length,target,removedRoadParts:history.summary.removedParts,removedRoadSegments:history.summary.removedSegments,mapMother1940s:{schema:mm?.schema,mask:[h.maskWidth,h.maskHeight],historicalWaterPixels:h.historicalWaterPixels,reclaimedPixels:h.reclaimedPixels,seaMaskUpdated:h.seaMaskUpdated,rawGuideLinesVisible:h.rawGuideLinesVisible,controlPolygons:mm?.historicalControlPolygonCount,projectedPoints:mm?.projectedPointCount},overview:{sourceParts:overview.roads.sourcePartCount,filteredParts:overview.roads.partCount},query02:{sourceParts:q2.roads.sourcePartCount,filteredParts:q2.roads.partCount,removedParts:q2summary.removedParts},failures},null,2));
}catch(e){failures.push(e.stack||String(e));let h={};try{h=await diag(page);}catch{}console.log(JSON.stringify({passed:false,target,mapMother1940s:h,failures},null,2));}
finally{await browser.close();}if(failures.length)process.exit(1);
