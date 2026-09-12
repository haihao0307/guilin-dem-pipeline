import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const target=process.env.R38_URL||'http://127.0.0.1:8768/site/dist/r3-8/';
const output=process.env.QA_OUTPUT||'/tmp/wenzhou-r38';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
if(target.includes('githack'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
const page=await context.newPage(),failures=[],errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
const check=(v,label)=>{if(!v)failures.push(label);};
const state=()=>page.locator('#terrain').evaluate(c=>({...c.dataset}));
const wait=async(predicate,arg)=>page.waitForFunction(predicate,arg,{timeout:120000});
async function soil(depth,property='clay'){
  await page.selectOption('#evidence-mode','soil');await page.selectOption('#soil-depth',depth);await page.selectOption('#soil-property',property);
  await wait(([d,p])=>{const s=document.querySelector('#terrain').dataset;return s.soilContextLoaded==='true'&&s.soilContextDepth===d&&s.soilContextProperty===p;},[depth,property]);
}
async function environment(mode,value){
  await page.selectOption('#evidence-mode',mode);
  if(value!==undefined){const id=mode==='water'?'#water-product':'#wrb-class';if(mode==='wrb-probability')await wait(()=>document.querySelector('#wrb-class').options.length===30);await page.selectOption(id,String(value));}
  await wait(expected=>{const s=document.querySelector('#terrain').dataset;return s.environmentLoaded==='true'&&s.environmentMode===expected;},mode);
}
async function visiblePixels(label){
  await page.check('#show-soil-context');const on=await page.locator('#terrain').screenshot();
  await page.uncheck('#show-soil-context');const off=await page.locator('#terrain').screenshot();
  check(!on.equals(off),`${label}: overlay does not change rendered pixels`);await page.check('#show-soil-context');
}
try{
  const started=Date.now();await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await wait(()=>document.querySelector('#terrain')?.dataset.soilContextLoaded==='true');
  const firstInteractiveMs=Date.now()-started;
  check(!requests.some(u=>/\/data\/(wrb|water)\//.test(u)),'initial page eagerly downloads WRB/water');
  check([...new Set(requests.filter(u=>u.endsWith('.i16le')).map(u=>u.split('/').at(-1)))].length===2,'initial soil load is not exactly two layers');
  await page.selectOption('#location','query-01');
  await wait(()=>{const s=document.querySelector('#terrain').dataset;return s.patch==='query-01'&&s.soilContextPatch==='query-01'&&s.soilContextLoaded==='true'&&s.osmLoaded==='true'&&s.osmPatch==='query-01';});
  const profile=[];
  for(const d of ['0-5cm','5-15cm','15-30cm','30-60cm','60-100cm','100-200cm']){
    await soil(d);const s=await state();profile.push({depth:d,sha:s.soilContextMedianSha256});
    const match=await page.evaluate(async depth=>{const m=await fetch('./data/soil/soil-context.json').then(r=>r.json());return m.layers.find(x=>x.depth===depth&&x.property==='clay'&&x.statistic==='Q0.5').sha256;},d);
    check(s.soilContextMedianSha256===match,`${d}: wrong depth payload`);
  }
  await visiblePixels('soil-depth');
  const modes=[];
  for(const m of ['wrb-official','wrb-derived','wrb-difference','wrb-probability']){
    await environment(m);await visiblePixels(m);modes.push(await state());
  }
  for(const code of [0,11,29]){await environment('wrb-probability',code);const s=await state();
    const sha=await page.evaluate(async code=>(await fetch('./data/wrb/wrb-context.json').then(r=>r.json())).probabilityLayers.find(x=>x.code===code).sha256,code);check(s.environmentSha256===sha,`probability ${code}: stale result`);}
  await environment('wrb-official');
  const expected=await page.evaluate(async()=>{
    const [m,t]=await Promise.all([fetch('./data/wrb/wrb-context.json').then(r=>r.json()),fetch('../r3-1/data/terrain.json').then(r=>r.json())]);
    const q=t.queries.find(x=>x.patch==='query-01'),[e,n]=q.position.coordinates,g=m.grid,gt=g.geotransform;
    const i=Math.floor((n-gt[3])/gt[5])*g.columns+Math.floor((e-gt[0])/gt[1]);
    const b=new Uint8Array(await fetch('./data/wrb/'+m.outputs.officialMostProbable.path).then(r=>r.arrayBuffer()));return b[i];
  });check(Number((await state()).environmentRawAtAnchor)===expected,'WRB anchor sample does not match independently indexed binary');
  await page.screenshot({path:output+'/desktop-wrb.png'});
  const water=[];
  for(const p of ['occurrence','recurrence','transitions','change','seasonality','extent']){
    await environment('water',p);const s=await state();water.push({product:p,sha:s.environmentSha256});
    check((await page.locator('#environment-status').innerText()).includes(['seasonality','extent'].includes(p)?'2022-2024':'1984-2024'),`${p}: incorrect time window`);
    check(s.seaSurfaceKind==='demonstration','JRC changed demonstration sea semantics');
  }
  await environment('water','occurrence');await visiblePixels('historical-water');
  // Rapid changes must end at the latest request, even if earlier reads are in flight.
  await page.evaluate(()=>{const e=document.querySelector('#evidence-mode');for(const v of ['wrb-derived','water','wrb-official']){e.value=v;e.dispatchEvent(new Event('change'));}});
  await wait(()=>{const s=document.querySelector('#terrain').dataset;return s.environmentLoaded==='true'&&s.environmentMode==='wrb-official';});
  check(Number((await state()).environmentCacheEntries)<=4,'unbounded environment cache');
  const query=await page.evaluate(()=>window.wenzhouWorldScore.queryLocation({easting:300000,northing:3100000}));check(query.worldId==='wenzhou'&&Object.keys(query.voiceRefs).length===8,'unified location references missing');
  for(const [key,ref] of Object.entries(query.voiceRefs)){const ok=await page.evaluate(async url=>(await fetch(url)).ok,ref.url);check(ok,`${key}: broken evidence reference`);}
  await page.selectOption('#location','mountains');await wait(()=>{const s=document.querySelector('#terrain').dataset;return s.environmentLoaded==='true'&&s.environmentPatch==='mountains';});
  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
  const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push('mobile:'+e.message));await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await mp.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextLoaded==='true',null,{timeout:120000});
  await mp.selectOption('#evidence-mode','wrb-official');await mp.waitForFunction(()=>document.querySelector('#terrain').dataset.environmentLoaded==='true',null,{timeout:120000});
  await mp.screenshot({path:output+'/mobile-wrb.png'});
  const layout=await mp.evaluate(()=>{const f=document.querySelector('.focus-panel').getBoundingClientRect(),c=document.querySelector('.camera-controls').getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,panelAboveControls:f.bottom<c.top,controlsInside:c.left>=0&&c.right<=innerWidth};});
  check(layout.scrollWidth<=layout.width&&layout.panelAboveControls&&layout.controlsInside,'mobile layout collision');
  await mobile.close();check(errors.length===0,'runtime errors');
  const faultContext=await browser.newContext({reducedMotion:'reduce'});
  if(target.includes('githack'))await faultContext.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
  const fp=await faultContext.newPage();const failurePattern=/wrb-prob-29-vertisols\.u8/;
  await fp.route(failurePattern,route=>route.abort('failed'));
  await fp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await fp.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextLoaded==='true',null,{timeout:120000});
  await fp.selectOption('#evidence-mode','wrb-probability');
  await fp.waitForFunction(()=>document.querySelector('#wrb-class').options.length===30);
  await fp.selectOption('#wrb-class','29');
  await fp.waitForFunction(()=>!!document.querySelector('#terrain').dataset.environmentError,null,{timeout:120000});
  check(await fp.locator('#environment-retry').isVisible(),'network failure has no retry');
  check(await fp.locator('#terrain').evaluate(c=>c.dataset.environmentVisible==='false'),'failed load retains stale visible evidence');
  await fp.unroute(failurePattern);await fp.click('#environment-retry');
  await fp.waitForFunction(()=>document.querySelector('#terrain').dataset.environmentLoaded==='true',null,{timeout:120000});
  await faultContext.close();
  const result={passed:!failures.length,target,firstInteractiveMs,profile,modes,water,independentWrbAnchor:expected,layout,networkFailureRecovery:true,errors,failures};
  await writeFile(output+'/browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){failures.push(e.stack);console.log(JSON.stringify({passed:false,target,errors,failures},null,2));}
finally{await browser.close();}
if(failures.length)process.exit(1);
