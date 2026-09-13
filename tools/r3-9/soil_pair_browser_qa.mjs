import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const target=process.env.R38_URL||'http://127.0.0.1:8768/site/dist/r3-8/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
if(target.includes('githack'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
const page=await context.newPage(),requests=[],failures=[];
page.on('request',r=>requests.push(r.url()));
const check=(v,label)=>{if(!v)failures.push(label);};
const wait=async()=>page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextLoaded==='true',null,{timeout:120000});
try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await wait();
  let state=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
  const root=await page.locator('html').evaluate(e=>({...e.dataset}));
  check(root.wenzhouSoilPairLoader==='true','soil pair loader not installed');
  check(state.soilContextPayloadTransport==='dual-channel-gzip','initial soil did not use dual-channel gzip');
  const index=await page.evaluate(()=>fetch('./data/soil-pairs/soil-pairs.json').then(r=>r.json()));
  check(index.schema==='wenzhou-soil-pair-payloads/v1'&&index.lossless===true,'pair manifest identity mismatch');
  check(index.pairCount===48,'pair manifest does not contain 48 property-depth pairs');
  check(index.compressedBytes<40*1024*1024,'pair payload set exceeds 40 MiB');
  const packed=()=>requests.filter(u=>/\/data\/soil-pairs\/.*\.s2gz$/.test(u));
  const legacy=()=>requests.filter(u=>u.endsWith('.i16le'));
  check(new Set(packed()).size===1,'initial soil should fetch exactly one packed pair');
  check(legacy().length===0,'initial soil still fetched legacy split i16 payloads');
  await page.selectOption('#location','query-01');await wait();
  for(const [property,depth] of [['clay','5-15cm'],['soc','100-200cm'],['wv0033','30-60cm']]){
    await page.selectOption('#soil-property',property);await page.selectOption('#soil-depth',depth);
    await page.waitForFunction(([p,d])=>{const s=document.querySelector('#terrain').dataset;return s.soilContextLoaded==='true'&&s.soilContextProperty===p&&s.soilContextDepth===d&&s.soilContextPayloadTransport==='dual-channel-gzip';},[property,depth],{timeout:120000});
    state=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
    const expected=await page.evaluate(async([p,d])=>{const m=await fetch('./data/soil/soil-context.json').then(r=>r.json());return {q:m.layers.find(x=>x.property===p&&x.depth===d&&x.statistic==='Q0.5').sha256,u:m.layers.find(x=>x.property===p&&x.depth===d&&x.statistic==='uncertainty').sha256};},[property,depth]);
    check(state.soilContextMedianSha256===expected.q,`${property} ${depth}: value hash changed`);
    check(state.soilContextUncertaintySha256===expected.u,`${property} ${depth}: uncertainty hash changed`);
  }
  check(legacy().length===0,'legacy split i16 requests reappeared after switching');
  check(new Set(packed()).size>=4,'pair switching did not request distinct packed payloads');
  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
  const mp=await mobile.newPage();await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await mp.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextLoaded==='true',null,{timeout:120000});
  const mobileState=await mp.locator('#terrain').evaluate(c=>({...c.dataset}));check(mobileState.soilContextPayloadTransport==='dual-channel-gzip','mobile did not use dual-channel gzip');await mobile.close();
  console.log(JSON.stringify({passed:!failures.length,target,pairCount:index.pairCount,rawBytes:index.rawBytes,compressedBytes:index.compressedBytes,reduction:index.reduction,packedRequests:new Set(packed()).size,legacyRequests:legacy().length,failures},null,2));
}catch(e){failures.push(e.stack);console.log(JSON.stringify({passed:false,target,failures},null,2));}
finally{await browser.close();}
if(failures.length)process.exit(1);
