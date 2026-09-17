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
  lastError:c.dataset.history1953LastError||'',
  refinementError:c.dataset.history1940sRefinementError||'',
  refined:c.dataset.history1940sRefined||'',
  maskWidth:Number(c.dataset.history1940sMaskWidth||0),
  maskHeight:Number(c.dataset.history1940sMaskHeight||0),
  historicalWaterPixels:Number(c.dataset.history1940sHistoricalWaterPixels||0),
  reclaimedPixels:Number(c.dataset.history1940sReclaimedPixels||0),
  islandRestoredPixels:Number(c.dataset.history1940sIslandRestoredPixels||0),
  xuanmenForcedWaterPixels:Number(c.dataset.history1940sXuanmenForcedWaterPixels||0),
  xuanmenConnectivity:c.dataset.history1940sXuanmenConnectivity||'',
  seaMaskUpdated:c.dataset.history1940sSeaMaskUpdated||'',
  rawGuideLinesVisible:c.dataset.history1940sRawGuideLinesVisible||'',
  osmObjects:Number(c.dataset.history1940sOsmObjects||0),
  roadSegmentsHiddenWater:Number(c.dataset.history1940sRoadSegmentsHiddenWater||0),
  buildingSegmentsHiddenWater:Number(c.dataset.history1940sBuildingSegmentsHiddenWater||0),
  osmPatch:c.dataset.osmPatch||'',osmLoaded:c.dataset.osmLoaded||'',patch:c.dataset.patch||''
}));}
try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r3',{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch,{},{timeout:120000});
  const history=await page.evaluate(()=>window.__wenzhouHistory1942Preclean);
  check(history?.active===true,'history preclean not active');
  check(history?.summary?.motorway>0,'no motorway parts removed');
  check(history?.summary?.motorwayLink>0,'no motorway_link parts removed');
  check(history?.summary?.majorBridge>0,'no major bridge parts removed');
  const manifest=await page.evaluate(()=>fetch('../r3-5/data/osm/osm-context.json').then(r=>r.json()));
  const verifyPatch=id=>{const p=manifest.patches.find(x=>x.id===id),s=history.summary.patches.find(x=>x.id===id),source=p.roads.sourceModernClassPartCounts||{},active=p.roads.classPartCounts||{},motorway=(source.motorway||0)+(source.motorway_link||0),construction=source.construction||0,bridge=s.majorBridge||0;check(!('motorway' in active),`${id}: motorway survived`);check(!('motorway_link' in active),`${id}: motorway_link survived`);check(!('construction' in active),`${id}: construction survived`);check(p.roads.sourcePartCount-p.roads.partCount===motorway+construction+bridge,`${id}: road subtraction mismatch`);return{p,s};};
  const overviewCheck=verifyPatch('overview'),overview=overviewCheck.p;
  await page.selectOption('#location','query-02');
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='query-02',{},{timeout:120000});
  const q2Check=verifyPatch('query-02'),q2=q2Check.p,q2summary=q2Check.s;
  await page.screenshot({path:`${out}/desktop-query-02.png`,fullPage:true});
  await page.selectOption('#location','overview');
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='overview',{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.history1940sRefined==='true',{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmLoaded==='true',{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('.brand p')?.textContent?.includes('1940s Map Mother'),{},{timeout:30000});
  await page.waitForTimeout(800);
  const h=await diag(page),mm=await page.evaluate(()=>window.__wenzhouMapMother1940s||null),control=await page.evaluate(()=>window.__wenzhouHistoricalControl1953||null);
  check(h.terrainEvents>0,'Map Mother received no terrain events');
  check(h.lastError==='','Map Mother V1 error: '+h.lastError);
  check(h.refinementError==='','Map Mother V2 refinement error: '+h.refinementError);
  check(h.committedPatch==='overview','Map Mother did not commit overview');
  check(h.controls>0,'historical controls missing');
  check(h.refined==='true','1940s coast refinement did not commit');
  check(mm?.schema==='wenzhou-map-mother/1940s-land-water-delta-v2','1940s Map Mother V2 state missing');
  check(mm?.coastRefinement==='highres-linear-island-protected-xuanmen-open','coast refinement contract mismatch');
  check(mm?.storage==='runtime-derived-vector-plus-procedural-protection-no-epoch-dem-copy','epoch DEM duplication guard missing');
  check(h.maskWidth>=1800||h.maskHeight>=1800,'refined historical mask did not reach 2048-class resolution');
  check(mm?.acceptedControlPolygons>0,'no historical water controls survived quality gate');
  check(mm?.rejectedControlPolygons>0,'false-water quality gate rejected nothing');
  check(mm?.rejectedControls?.some(x=>x.sheet==='NH51-13'&&x.reason.startsWith('reject-')),'NH51-13 false-water controls were not rejected');
  check(mm?.islandProtectionHeightM===8,'mountain-island protection height mismatch');
  check(mm?.islandProtectionRadiusM===220,'mountain-island protection radius mismatch');
  check(Number(mm?.islandProtectionSeedVertices||0)>0,'no mountain-island protection seeds');
  check(Number(mm?.islandProtectionPixels||0)>0,'mountain-island protection mask empty');
  check(h.islandRestoredPixels>0,'no mountain-island pixels were restored');
  check(mm?.xuanmenConnectivity==='forced-open-derived-topology','Xuanmen topology rule not committed');
  check(mm?.xuanmenCorridorWidthM===1200,'Xuanmen corridor width mismatch');
  check(h.xuanmenConnectivity==='open','Xuanmen runtime connectivity is not open');
  check(Number(mm?.xuanmenForcedWaterPixels??-1)>=0,'Xuanmen corridor was not evaluated');
  check(h.seaMaskUpdated==='true','sea renderer did not receive refined historical land mask');
  check(h.roadSegmentsHiddenWater>0,'modern roads were not removed from restored historical water');
  check(control?.visualized===false,'raw historical control must remain nonvisual');
  check(h.rawGuideLinesVisible==='false','raw guide lines are visible');
  check(await page.locator('#history-1953-toggle').count()===0,'legacy visual guide toggle survived');
  check(await page.locator('#history-1953-layer-card').count()===0,'legacy visual guide card survived');
  await page.screenshot({path:`${out}/desktop-overview-1940s.png`,fullPage:true});
  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
  const mp=await mobile.newPage();
  await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await mp.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r3',{},{timeout:120000});
  await mp.waitForFunction(()=>document.querySelector('#terrain')?.dataset.history1940sRefined==='true',{},{timeout:120000});
  await mp.waitForFunction(()=>document.querySelector('.brand p')?.textContent?.includes('1940s Map Mother'),{},{timeout:30000});
  check(await mp.locator('#history-1953-toggle').count()===0,'mobile legacy guide toggle survived');
  await mp.screenshot({path:`${out}/mobile-390x844-1940s.png`,fullPage:true});await mobile.close();
  console.log(JSON.stringify({passed:!failures.length,target,removedRoadParts:history.summary.removedParts,removedRoadSegments:history.summary.removedSegments,mapMother1940s:{schema:mm?.schema,coastRefinement:mm?.coastRefinement,mask:[h.maskWidth,h.maskHeight],reclaimedPixels:h.reclaimedPixels,acceptedControlPolygons:mm?.acceptedControlPolygons,rejectedControlPolygons:mm?.rejectedControlPolygons,islandProtectionSeedVertices:mm?.islandProtectionSeedVertices,islandProtectionPixels:mm?.islandProtectionPixels,islandRestoredPixels:h.islandRestoredPixels,xuanmenConnectivity:h.xuanmenConnectivity,xuanmenCorridorWidthM:mm?.xuanmenCorridorWidthM,xuanmenForcedWaterPixels:h.xuanmenForcedWaterPixels,seaMaskUpdated:h.seaMaskUpdated,roadSegmentsHiddenWater:h.roadSegmentsHiddenWater,buildingSegmentsHiddenWater:h.buildingSegmentsHiddenWater},overview:{sourceParts:overview.roads.sourcePartCount,filteredParts:overview.roads.partCount},query02:{sourceParts:q2.roads.sourcePartCount,filteredParts:q2.roads.partCount,removedParts:q2summary.removedParts},failures},null,2));
}catch(e){failures.push(e.stack||String(e));let h={};try{h=await diag(page);}catch{}console.log(JSON.stringify({passed:false,target,mapMother1940s:h,failures},null,2));}
finally{await browser.close();}if(failures.length)process.exit(1);
