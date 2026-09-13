import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const target=process.env.R38_URL||'http://127.0.0.1:8768/site/dist/r3-8/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
if(target.includes('githack'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
const page=await context.newPage(),requests=[],failures=[];
page.on('request',r=>requests.push(r.url()));
const check=(v,label)=>{if(!v)failures.push(label);};
const waitEnv=async mode=>page.waitForFunction(m=>{const s=document.querySelector('#terrain')?.dataset;return s?.environmentLoaded==='true'&&s?.environmentMode===m&&s?.environmentPayloadTransport==='gzip';},mode,{timeout:120000});
const rawReq=()=>requests.filter(u=>/\/data\/(wrb|water)\/[^/]+\.(u8|u16le)$/.test(new URL(u).pathname));
const gzNames=()=>[...new Set(requests.filter(u=>/\/data\/evidence-gzip\/(wrb|water)\/.*\.gz$/.test(new URL(u).pathname)).map(u=>new URL(u).pathname.split('/').at(-1)))];
try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextLoaded==='true',null,{timeout:120000});
  const root=await page.locator('html').evaluate(e=>({...e.dataset}));
  check(root.wenzhouEvidenceGzipLoader==='true','evidence gzip loader not installed');
  const idx=await page.evaluate(()=>fetch('./data/evidence-gzip/index.json').then(r=>r.json()));
  check(idx.schema==='wenzhou-r3.9-evidence-gzip/v1'&&idx.lossless===true,'gzip manifest identity mismatch');
  check(idx.fileCount===41,'gzip manifest file count mismatch');
  check(idx.rawBytes===37239384&&idx.packedBytes===3424064,'gzip byte contract mismatch');

  await page.selectOption('#evidence-mode','wrb-official');await waitEnv('wrb-official');
  let state=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
  check(state.environmentPayloadLogicalPath==='wrb/wrb-most-probable-official.u8','official WRB did not use gzip logical payload');

  await page.selectOption('#evidence-mode','wrb-probability');await waitEnv('wrb-probability');
  await page.selectOption('#wrb-class','18');await waitEnv('wrb-probability');
  state=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
  check(state.environmentPayloadLogicalPath?.includes('wrb-prob-18-'),'WRB probability class 18 not served by gzip transport');

  await page.selectOption('#evidence-mode','wrb-derived');await waitEnv('wrb-derived');
  await page.selectOption('#evidence-mode','wrb-difference');await waitEnv('wrb-difference');

  await page.selectOption('#evidence-mode','water');await waitEnv('water');
  await page.selectOption('#water-product','change');await waitEnv('water');
  state=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
  check(state.environmentPayloadLogicalPath==='water/change.u8','JRC change not served by gzip transport');
  await page.selectOption('#water-product','extent');await waitEnv('water');

  check(rawReq().length===0,'legacy WRB/JRC raw binary network requests observed');
  check(gzNames().length>=7,'too few logical gzip payloads observed');

  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
  const mp=await mobile.newPage();await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await mp.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextLoaded==='true',null,{timeout:120000});
  await mp.selectOption('#evidence-mode','water');await mp.waitForFunction(()=>{const s=document.querySelector('#terrain')?.dataset;return s?.environmentLoaded==='true'&&s?.environmentMode==='water'&&s?.environmentPayloadTransport==='gzip';},null,{timeout:120000});
  const ms=await mp.locator('#terrain').evaluate(c=>({...c.dataset}));check(ms.environmentPayloadTransport==='gzip','mobile JRC did not use gzip transport');await mobile.close();

  console.log(JSON.stringify({passed:!failures.length,target,fileCount:idx.fileCount,rawBytes:idx.rawBytes,packedBytes:idx.packedBytes,reduction:idx.reduction,logicalGzipRequests:gzNames().length,legacyRawRequests:rawReq().length,failures},null,2));
}catch(e){failures.push(e.stack);console.log(JSON.stringify({passed:false,target,failures},null,2));}
finally{await browser.close();}
if(failures.length)process.exit(1);
