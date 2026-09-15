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
async function historyDiag(p){return p.locator('#terrain').evaluate(c=>({
  terrainEvents:Number(c.dataset.history1953TerrainEvents||0),
  staleEvents:Number(c.dataset.history1953StaleEvents||0),
  lastEventPatch:c.dataset.history1953LastEventPatch||'',
  lastPatch:c.dataset.history1953LastPatch||'',
  committedPatch:c.dataset.history1953CommittedPatch||'',
  segments:Number(c.dataset.history1953ControlSegments||0),
  frameRejected:Number(c.dataset.history1953FrameSegmentsRejected||0),
  rejectedOutside:Number(c.dataset.history1953RejectedOutsidePatch||0),
  visualized:c.dataset.history1953Visualized||'',
  lastError:c.dataset.history1953LastError||'',
  osmPatch:c.dataset.osmPatch||'',
  patch:c.dataset.patch||''
}));}
try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r3',{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch,{},{timeout:120000});
  const history=await page.evaluate(()=>window.__wenzhouHistory1942Preclean);
  check(history?.active===true,'history preclean not active');
  check(history?.schema==='wenzhou-history-1942-preclean/r3','history schema mismatch');
  check(history?.summary?.motorway>0,'no motorway parts removed');
  check(history?.summary?.motorwayLink>0,'no motorway_link parts removed');
  check(history?.summary?.majorBridge>0,'no major bridge parts removed');
  check(history?.summary?.construction>=0,'construction summary missing');
  check(history?.summary?.removedParts===history.summary.motorway+history.summary.motorwayLink+history.summary.construction+history.summary.majorBridge,'removed part count mismatch');
  check(history?.removedBridgePolicy?.minorBridgeClassesPreserved===true,'minor bridge preservation boundary missing');
  check(history?.railwayAction==='none-current-runtime-has-no-railway-layer','railway boundary mismatch');
  const manifest=await page.evaluate(()=>fetch('../r3-5/data/osm/osm-context.json').then(r=>r.json()));
  check(manifest.history1942Preclean?.active===true,'intercepted manifest missing history policy');
  const verifyPatch=id=>{const p=manifest.patches.find(x=>x.id===id),s=history.summary.patches.find(x=>x.id===id),source=p.roads.sourceModernClassPartCounts||{},active=p.roads.classPartCounts||{},motorway=(source.motorway||0)+(source.motorway_link||0),construction=source.construction||0,bridge=s.majorBridge||0;check(!('motorway' in active),`${id}: motorway class survived`);check(!('motorway_link' in active),`${id}: motorway_link class survived`);check(!('construction' in active),`${id}: construction class survived`);check((s.construction||0)===construction,`${id}: construction subtraction mismatch`);check(p.roads.sourcePartCount-p.roads.partCount===motorway+construction+bridge,`${id}: source/filtered part delta mismatch`);for(const[name,count]of Object.entries(s.majorBridgeByClass||{}))check((source[name]||0)-(active[name]||0)===count,`${id}: ${name} bridge subtraction mismatch`);return{p,s,motorway,construction,bridge};};
  const overviewCheck=verifyPatch('overview'),overview=overviewCheck.p;
  await page.selectOption('#location','query-02');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='query-02',{},{timeout:120000});
  const q2Check=verifyPatch('query-02'),q2=q2Check.p,q2summary=q2Check.s,ds=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
  check(Number(ds.osmRoadParts)===q2.roads.partCount,'runtime did not consume filtered query-02 road parts');check(ds.historyMode==='1942-preclean-r3','canvas history mode missing');check(Number(ds.historyRemovedMajorBridgeParts)===history.summary.majorBridge,'canvas major bridge summary mismatch');check(Number(ds.historyRemovedConstructionParts)===history.summary.construction,'canvas construction summary mismatch');await page.screenshot({path:`${out}/desktop-query-02.png`,fullPage:true});

  await page.selectOption('#location','overview');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='overview',{},{timeout:120000});
  try{await page.waitForFunction(()=>Number(document.querySelector('#terrain')?.dataset.history1953ControlSegments||0)>0,{},{timeout:30000});}catch{}
  await page.waitForTimeout(600);
  const hdiag=await historyDiag(page),control=await page.evaluate(()=>window.__wenzhouHistoricalControl1953||null);
  check(hdiag.terrainEvents>0,'1953 control index received no canonical terrain event');
  check(hdiag.lastError==='','1953 control index error: '+hdiag.lastError);
  check(hdiag.committedPatch==='overview','1953 control index did not commit overview patch');
  check(hdiag.segments>0,'1953 control index has no georeferenced segments');
  check(control?.schema==='wenzhou-historical-control-index/1953-v1','1953 control index schema missing');
  check(control?.visualized===false,'1953 raw controls must remain nonvisual');
  check(await page.locator('#history-1953-toggle').count()===0,'legacy 1953 visual toggle still present');
  check(await page.locator('#history-1953-layer-card').count()===0,'legacy 1953 visual card still present');
  check(await page.locator('html').getAttribute('data-wenzhou-history-1953-visual')==='false','document does not declare nonvisual 1953 controls');
  await page.screenshot({path:`${out}/desktop-overview.png`,fullPage:true});

  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});const mp=await mobile.newPage();await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await mp.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r3',{},{timeout:120000});check(await mp.locator('#history-1942-card').count()===1,'mobile history status card missing');const brand=await mp.locator('.brand p').textContent();check(brand?.includes('1942/1953'),'mobile header does not identify historical preclean');check(await mp.locator('#history-1953-toggle').count()===0,'mobile legacy 1953 visual toggle still present');await mp.screenshot({path:`${out}/mobile-390x844.png`,fullPage:true});await mobile.close();
  console.log(JSON.stringify({passed:!failures.length,target,removedMotorwayParts:history.summary.motorway,removedMotorwayLinkParts:history.summary.motorwayLink,removedConstructionParts:history.summary.construction,removedMajorBridgeParts:history.summary.majorBridge,removedMajorBridgeByClass:history.summary.majorBridgeByClass,removedRoadParts:history.summary.removedParts,removedRoadSegments:history.summary.removedSegments,historical1953Control:hdiag,overview:{sourceParts:overview.roads.sourcePartCount,filteredParts:overview.roads.partCount,removedMotorwayClasses:overviewCheck.motorway,removedConstructionParts:overviewCheck.construction,removedMajorBridgeParts:overviewCheck.bridge},query02:{sourceParts:q2.roads.sourcePartCount,filteredParts:q2.roads.partCount,removedParts:q2summary.removedParts,removedConstructionParts:q2summary.construction,removedMajorBridgeParts:q2summary.majorBridge},failures},null,2));
}catch(e){failures.push(e.stack||String(e));let diag={};try{diag=await historyDiag(page);}catch{}console.log(JSON.stringify({passed:false,target,historical1953Control:diag,failures},null,2));}
finally{await browser.close();}if(failures.length)process.exit(1);
