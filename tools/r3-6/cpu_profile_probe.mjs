import {chromium} from 'playwright';

const target=process.env.R36_URL||'http://127.0.0.1:8765/site/dist/r3-6/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
const page=await context.newPage();
const cdp=await context.newCDPSession(page);
await cdp.send('Profiler.enable');
const poll={timeout:180000,polling:100};

function summarizeProfile(profile){
  const nodes=new Map(profile.nodes.map(n=>[n.id,n]));
  const byName=new Map();
  const samples=profile.samples||[],deltas=profile.timeDeltas||[];
  for(let i=0;i<samples.length;i++){
    const node=nodes.get(samples[i]);if(!node)continue;
    const name=node.callFrame?.functionName||'(anonymous)';
    const url=node.callFrame?.url||'';
    const key=`${name} @ ${url.split('/').slice(-2).join('/')}`;
    const rec=byName.get(key)||{name,url,samples:0,us:0};
    rec.samples++;rec.us+=Number(deltas[i]||0);byName.set(key,rec);
  }
  const all=[...byName.values()].sort((a,b)=>b.us-a.us);
  const selectedNames=new Set(['buildForTerrain','terrainSampler','axisLocator','buildIndexedRoads','buildIndexedBuildings','maybeYield','loadPayload','typedFile','checkedBytes','sample','locate','roadColor','maxSegmentCount']);
  const selected=all.filter(x=>selectedNames.has(x.name)||x.url.includes('/r3-6/osm-runtime.js')).slice(0,80);
  return{
    totalProfileMs:(Number(profile.endTime)-Number(profile.startTime))/1000,
    sampledMs:all.reduce((s,x)=>s+x.us,0)/1000,
    selected:selected.map(x=>({...x,ms:x.us/1000})),
    top:all.slice(0,30).map(x=>({...x,ms:x.us/1000})),
  };
}
async function stopProfile(){const out=await cdp.send('Profiler.stop');if(!out?.profile?.nodes)throw new Error(`CDP Profiler.stop returned no profile nodes: ${JSON.stringify(Object.keys(out||{}))}`);return out.profile;}
async function resourceSnapshot(){
  return page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/r3-5/data/osm/')).map(e=>({name:e.name.split('/').at(-1),duration:e.duration,fetchStart:e.fetchStart,responseStart:e.responseStart,responseEnd:e.responseEnd,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize})).sort((a,b)=>a.fetchStart-b.fetchStart));
}
async function state(){return page.evaluate(()=>{const c=document.querySelector('#terrain');return{patch:c?.dataset.patch,osmPatch:c?.dataset.osmPatch,runtime:c?.dataset.osmRuntime,buildMs:Number(c?.dataset.osmBuildMs),maxChunkMs:Number(c?.dataset.osmMaxChunkMs),yieldCount:Number(c?.dataset.osmYieldCount),cacheHits:Number(c?.dataset.osmCacheHits),cacheMisses:Number(c?.dataset.osmCacheMisses),roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),roadRejected:Number(c?.dataset.osmRoadSegmentsRejectedNoSurface),roadSourceVertices:Number(c?.dataset.osmRoadSourceVertices),roadGpuVertices:Number(c?.dataset.osmRoadGpuVertices),roadGpuIndexCount:Number(c?.dataset.osmRoadGpuIndexCount),roadSampleCalls:Number(c?.dataset.osmRoadSampleCalls),samplerMode:c?.dataset.osmSamplerMode};});}
async function waitPatch(id){
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch===expected;},id,poll);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.osmLoaded==='true'&&c?.dataset.osmPatch===expected&&c?.dataset.osmRuntime==='indexed-r36';},id,poll);
}

await cdp.send('Profiler.start');
const nav0=performance.now();
await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await waitPatch('overview');
const initialOverviewWallMs=performance.now()-nav0;
const initialProfile=summarizeProfile(await stopProfile());
const initialResources=await resourceSnapshot();
const initialState=await state();

await page.evaluate(()=>performance.clearResourceTimings());
await cdp.send('Profiler.start');
const q0=performance.now();
await page.selectOption('#location','query-01');
await waitPatch('query-01');
const queryWallMs=performance.now()-q0;
const queryProfile=summarizeProfile(await stopProfile());
const queryResources=await resourceSnapshot();
const queryState=await state();

await page.evaluate(()=>performance.clearResourceTimings());
await cdp.send('Profiler.start');
const o0=performance.now();
await page.selectOption('#location','overview');
await waitPatch('overview');
const overviewRevisitWallMs=performance.now()-o0;
const overviewRevisitProfile=summarizeProfile(await stopProfile());
const overviewRevisitResources=await resourceSnapshot();
const overviewRevisitState=await state();

const report={schema:'wenzhou-r3.6-cpu-resource-profile/r2',target,engine:'Playwright Chromium software/headless environment; diagnostic attribution only, not real iPhone performance',initialOverview:{wallMs:initialOverviewWallMs,state:initialState,resources:initialResources,profile:initialProfile},query01:{wallMs:queryWallMs,state:queryState,resources:queryResources,profile:queryProfile},overviewRevisit:{wallMs:overviewRevisitWallMs,state:overviewRevisitState,resources:overviewRevisitResources,profile:overviewRevisitProfile},interpretation:{realIphoneVerified:false,resourceTimingIncludesBrowserCacheBehavior:true,cpuProfileIsSamplingNotExactInstrumentation:true}};
console.log(JSON.stringify(report,null,2));
await cdp.detach();await context.close();await browser.close();
