import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {VERSION} from '../src/instrument.js';
const url=process.env.TARGET_URL;if(!url)throw Error('TARGET_URL required');
const prefix=url.startsWith('file:')?'standalone':'public';await mkdir('qa-artifacts',{recursive:true});
const assert=(v,m)=>{if(!v)throw Error(m);};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const reports=[];
try{for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
 const name=viewport.width>500?'desktop':'mobile-viewport',page=await browser.newPage({viewport,deviceScaleFactor:1}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(r.resourceType()!=='document'&&/^https?:/.test(r.url()))requests.push(r.url());});
 try{
  const res=await page.goto(url,{waitUntil:'load',timeout:120000});if(!url.startsWith('file:'))assert(res.ok(),'HTTP failed');
  await page.waitForFunction(()=>window.__ANIMAL_QA__?.info().kind==='B',null,{timeout:90000});
  const frame=await page.locator('#viewport').boundingBox(),screen=await page.locator('#viewport canvas').boundingBox();
  assert(Math.abs(frame.width-screen.width)<2&&Math.abs(frame.height-screen.height)<2,'canvas does not fill viewport');
  assert(await page.evaluate(()=>__ANIMAL_QA__.info().version)===VERSION,'stale version');
  const animals=[];
  for(const kind of ['B','E','T']){
   await page.locator(`[data-kind="${kind}"]`).click();await page.waitForFunction(k=>window.__ANIMAL_QA__?.info().kind===k,kind,{timeout:90000});
   await page.locator('#viewport').scrollIntoViewIfNeeded();await page.waitForTimeout(1200);
   const info=await page.evaluate(()=>__ANIMAL_QA__.info());assert(info.metrics.scoreBytes<=80,'score budget');assert(info.metrics.triangles>80000,'no detail');assert(info.calls>10&&info.triangles>80000,'not real rendered geometry');
   await page.screenshot({path:`qa-artifacts/${prefix}-${name}-${kind}.png`});
   assert(await page.evaluate(()=>__ANIMAL_QA__.verify()),kind+' replay mismatch');
   await page.locator('[data-view=side]').click();await page.waitForTimeout(500);
   if(name==='desktop')await page.screenshot({path:`qa-artifacts/${prefix}-${name}-${kind}-side.png`});animals.push(info);
  }
  await page.locator('#viewport').scrollIntoViewIfNeeded();const before=await page.evaluate(()=>__ANIMAL_QA__.info().camera),box=await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.66,box.y+box.height*.50,{steps:10});await page.mouse.up();
  const after=await page.evaluate(()=>__ANIMAL_QA__.info().camera);assert(JSON.stringify(before)!==JSON.stringify(after),'camera unchanged');
  const h=await page.evaluate(()=>__ANIMAL_QA__.info().hash);await page.locator('#score').fill('K3|B,100');await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#status').classList.contains('error'));assert(h===await page.evaluate(()=>__ANIMAL_QA__.info().hash),'invalid input replaced output');
  assert(errors.length===0,JSON.stringify(errors));assert(requests.length===0,'external runtime requests');
  reports.push({name,viewport,animals,errors,requiredExternalRequests:requests.length,replay:true,canvasFillsViewport:true,cameraInteraction:true,invalidInputProtected:true});
 }catch(e){await page.screenshot({path:`qa-artifacts/${prefix}-${name}-failure.png`,fullPage:true}).catch(()=>{});console.error({errors,requests});throw e;}finally{await page.close();}
}
 const p=await browser.newPage({viewport:{width:1100,height:800}}),player=new URL('KAOPU_ANIMAL_PLAYER.html',url).href;await p.goto(player,{waitUntil:'load'});await p.waitForFunction(()=>window.__ANIMAL_QA__);
 assert((await p.evaluate(()=>__ANIMAL_QA__.info().kind))===undefined,'player contains hidden animal');
 const scores=JSON.parse(await readFile(new URL('../src/scores.json',import.meta.url)));
 for(const [kind,score]of Object.entries(scores)){
  await p.locator('#import').setInputFiles({name:`KAOPU_${kind}_K3.score`,mimeType:'text/plain',buffer:Buffer.from(score+'\n')});
  await p.waitForFunction(k=>__ANIMAL_QA__.info().kind===k,kind,{timeout:90000});assert(await p.evaluate(()=>__ANIMAL_QA__.verify()),'portable player replay');
  const wait=p.waitForEvent('download');await p.locator('#export').click();const downloaded=await wait;
  const text=await readFile(await downloaded.path(),'utf8');assert(text.trim()===score,'exported score mismatch');
 }
 await p.close();
 await writeFile(`qa-artifacts/${prefix}.json`,JSON.stringify({url,reports,portableEmptyPlayerPassed:true,threeScoreFileImportsAndExportsPassed:true,physicalPhoneTested:false,pixelExactAcrossGPU:false},null,2));
}finally{await browser.close();}
console.log('BROWSER_PASSED',url);
