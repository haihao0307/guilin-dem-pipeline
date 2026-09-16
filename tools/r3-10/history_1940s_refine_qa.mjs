import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const target=process.env.WZ1942_URL||'http://127.0.0.1:8768/site/dist/r3-8/history-1942.html';
const out=process.env.WZ1942_OUT||'/tmp/wz1942-refine';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1536,height:960},reducedMotion:'reduce'});if(target.includes('githack'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});const page=await context.newPage();const failures=[];const check=(v,m)=>{if(!v)failures.push(m);};
try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__wenzhouMapMother1940sRefine?.schema==='wenzhou-map-mother/1940s-refine-r27',{},{timeout:120000});await page.waitForTimeout(700);
  const r=await page.evaluate(()=>window.__wenzhouMapMother1940sRefine);const ds=await page.locator('#terrain').evaluate(c=>({...c.dataset}));
  check(r?.mask?.[0]>=1500&&r?.mask?.[1]>=1500,'refined mask resolution too low');
  check(r?.highGroundSeeds>0,'no high-ground island seeds');check(r?.islandPixelsRestored>0,'no high-ground land restored');check(r?.xuanmenForcedWaterPixels>0,'Xuanmen Bay override opened no historical water');check(r?.seaMaskUpdated===true,'refined mask not connected to sea renderer');check((r?.osm?.roadHidden||0)>0,'refined historical water hid no modern roads');check(ds.history1940sRefine==='r27','R27 dataset marker missing');
  await page.screenshot({path:`${out}/desktop-refine-r27.png`,fullPage:true});
  console.log(JSON.stringify({passed:!failures.length,target,refinement:r,failures},null,2));
}catch(e){failures.push(e.stack||String(e));console.log(JSON.stringify({passed:false,target,failures},null,2));}finally{await browser.close();}if(failures.length)process.exit(1);
