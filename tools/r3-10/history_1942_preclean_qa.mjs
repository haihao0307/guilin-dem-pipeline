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
async function exposeHistoryControls(p){
  await p.waitForSelector('#show-history-1953-control',{state:'attached',timeout:120000});
  const details=p.locator('details.base-layers');
  if(await details.count())await details.evaluate(el=>{el.open=true;});
}
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
  check(history?.controlSource1953==='records/R3_10/HISTORICAL_1953_CONTROL_SOURCE.json','1953 control source not registered');
  const manifest=await page.evaluate(()=>fetch('../r3-5/data/osm/osm-context.json').then(r=>r.json()));
  check(manifest.history1942Preclean?.active===true,'intercepted manifest missing history policy');
  const verifyPatch=(id)=>{
    const p=manifest.patches.find(x=>x.id===id),s=history.summary.patches.find(x=>x.id===id);
    const source=p.roads.sourceModernClassPartCounts||{},active=p.roads.classPartCounts||{};
    const motorway=(source.motorway||0)+(source.motorway_link||0),construction=(source.construction||0),bridge=s.majorBridge||0;
    check(!('motorway' in active),`${id}: motorway class survived`);
    check(!('motorway_link' in active),`${id}: motorway_link class survived`);
    check(!('construction' in active),`${id}: construction class survived`);
    check((s.construction||0)===construction,`${id}: construction subtraction mismatch`);
    check(p.roads.sourcePartCount-p.roads.partCount===motorway+construction+bridge,`${id}: source/filtered part delta mismatch`);
    for(const [name,count] of Object.entries(s.majorBridgeByClass||{}))check((source[name]||0)-(active[name]||0)===count,`${id}: ${name} bridge subtraction mismatch`);
    return{p,s,motorway,construction,bridge};
  };
  const overviewCheck=verifyPatch('overview'),overview=overviewCheck.p;
  await page.selectOption('#location','query-02');
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='query-02',{},{timeout:120000});
  const q2Check=verifyPatch('query-02'),q2=q2Check.p,q2summary=q2Check.s;
  const ds=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
  check(Number(ds.osmRoadParts)===q2.roads.partCount,'runtime did not consume filtered query-02 road parts');
  check(ds.historyMode==='1942-preclean-r3','canvas history mode missing');
  check(Number(ds.historyRemovedMajorBridgeParts)===history.summary.majorBridge,'canvas major bridge summary mismatch');
  check(Number(ds.historyRemovedConstructionParts)===history.summary.construction,'canvas construction summary mismatch');
  await page.screenshot({path:`${out}/desktop-query-02.png`,fullPage:true});

  await page.selectOption('#location','overview');
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmPatch==='overview',{},{timeout:120000});
  await exposeHistoryControls(page);
  check(!(await page.locator('#show-history-1953-control').isChecked()),'1953 control layer must default off');
  await page.waitForFunction(()=>Number(document.querySelector('#terrain')?.dataset.history1953ControlSegments||0)>0,{},{timeout:120000});
  const historicalSegments=Number(await page.locator('#terrain').getAttribute('data-history-1953-control-segments'));
  const frameRejected=Number(await page.locator('#terrain').getAttribute('data-history-1953-frame-segments-rejected'));
  check(historicalSegments>0,'1953 control layer generated no georeferenced segments');
  check(frameRejected>=0,'1953 frame rejection metric missing');
  await page.check('#show-history-1953-control');
  check(await page.locator('#history-1953-layer-card').isVisible(),'1953 control card not visible after toggle on');
  await page.screenshot({path:`${out}/desktop-overview-1953-on.png`,fullPage:true});
  await page.uncheck('#show-history-1953-control');
  check(!(await page.locator('#history-1953-layer-card').isVisible()),'1953 control card still visible after toggle off');
  await page.screenshot({path:`${out}/desktop-overview.png`,fullPage:true});

  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
  const mp=await mobile.newPage();await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await mp.waitForFunction(()=>document.documentElement.dataset.wenzhouHistoryMode==='1942-preclean-r3',{},{timeout:120000});
  check(await mp.locator('#history-1942-card').count()===1,'mobile history status card missing');
  const brand=await mp.locator('.brand p').textContent();check(brand?.includes('1942/1953'),'mobile header does not identify historical preclean');
  await exposeHistoryControls(mp);
  check(!(await mp.locator('#show-history-1953-control').isChecked()),'mobile 1953 layer must default off');
  await mp.check('#show-history-1953-control');
  check(await mp.locator('#history-1953-layer-card').count()===1,'mobile 1953 layer card missing');
  await mp.screenshot({path:`${out}/mobile-390x844-1953-on.png`,fullPage:true});await mobile.close();
  console.log(JSON.stringify({passed:!failures.length,target,removedMotorwayParts:history.summary.motorway,removedMotorwayLinkParts:history.summary.motorwayLink,removedConstructionParts:history.summary.construction,removedMajorBridgeParts:history.summary.majorBridge,removedMajorBridgeByClass:history.summary.majorBridgeByClass,removedRoadParts:history.summary.removedParts,removedRoadSegments:history.summary.removedSegments,historical1953Layer:{segments:historicalSegments,frameSegmentsRejected:frameRejected,defaultVisible:false,togglePassed:true},overview:{sourceParts:overview.roads.sourcePartCount,filteredParts:overview.roads.partCount,removedMotorwayClasses:overviewCheck.motorway,removedConstructionParts:overviewCheck.construction,removedMajorBridgeParts:overviewCheck.bridge},query02:{sourceParts:q2.roads.sourcePartCount,filteredParts:q2.roads.partCount,removedParts:q2summary.removedParts,removedConstructionParts:q2summary.construction,removedMajorBridgeParts:q2summary.majorBridge},failures},null,2));
}catch(e){failures.push(e.stack||String(e));console.log(JSON.stringify({passed:false,target,failures},null,2));}
finally{await browser.close();}
if(failures.length)process.exit(1);
