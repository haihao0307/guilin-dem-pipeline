import {chromium} from 'playwright';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const site=resolve(process.env.SITE_DIR||'kaopu-fabric-workbench/knit-three-live-r02'),out=resolve(process.env.QA_OUT||'evidence/knit-live-r02');await mkdir(out,{recursive:true});
const target=process.env.QA_URL||'http://127.0.0.1:8925/kaopu-fabric-workbench/knit-three-live-r02/index.html?qa=1&size=160x112&density=40x12';
const result={schema:'kaopu/knit-live-browser-qa@1',version:'KNIT-LIVE-R02',target,testStarted:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA||null,browserTested:true,hardwareTested:false,phoneHardwareTested:false,visualAcceptance:false,shareAllowed:false,errors:[],routes:{}};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-vulkan-surface','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});page.setDefaultTimeout(300000);page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))result.errors.push(m.text());console.log('browser',m.type(),m.text().slice(0,1200));});
 const response=await page.goto(target,{waitUntil:'domcontentloaded'});result.httpStatus=response?.status();if(!response?.ok())throw Error('HTTP startup failed');
 if(process.env.QA_URL){const bytes=await response.body();result.servedSHA256=createHash('sha256').update(bytes).digest('hex');result.expectedSHA256=createHash('sha256').update(await readFile(site+'/index.html')).digest('hex');if(result.servedSHA256!==result.expectedSHA256)throw Error('Public HTML differs from built HTML');}
 await page.waitForFunction(()=>window.KnitLive?.ready||window.KnitLive?.state.failed,null,{timeout:300000});
 if(await page.evaluate(()=>KnitLive.state.failed))throw Error(await page.locator('#status').innerText());
 await page.evaluate(()=>KnitLive.pause());result.device=await page.evaluate(()=>KnitLive.engine.metadata());
 for(const m of ['reference','proxy','surfel']){
  console.log('ROUTE',m);result.routes[m]=await page.evaluate(m=>KnitLive.render(m),m);
  const sample=await page.evaluate(async()=>{const a=new Float32Array(await KnitLive.engine.read(7));let lo=1e9,hi=-1e9,s=0;const n=KnitLive.engine.w*KnitLive.engine.h;for(let i=0;i<n;i++)for(let k=0;k<3;k++){lo=Math.min(lo,a[i*4+k]);hi=Math.max(hi,a[i*4+k]);s+=a[i*4+k];}return{min:lo,max:hi,mean:s/(n*3)};});
  result.routes[m].imageRange=sample;if(!(sample.max-sample.min>.05))throw Error(m+' empty or constant output');
  await page.screenshot({path:out+'/'+m+'.png'});
 }
 result.quality=await page.evaluate(()=>KnitLive.check());if(!result.quality?.proxy)throw Error('No quality results');
 result.benchmark=await page.evaluate(()=>KnitLive.compare(6));if(result.benchmark.incomplete)throw Error('Incomplete benchmark');
 const before=await page.evaluate(()=>[...KnitLive.engine.eye]);const box=await page.locator('#stage').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.55,{steps:3});await page.mouse.up();await page.evaluate(()=>KnitLive.pause());const after=await page.evaluate(()=>[...KnitLive.engine.eye]);if(JSON.stringify(before)===JSON.stringify(after))throw Error('Orbit input had no effect');result.orbitInputChangedCamera={before,after};
 await page.getByRole('button',{name:'函数代理',exact:true}).click();await page.evaluate(()=>KnitLive.pause());if(await page.evaluate(()=>KnitLive.state.active)!=='proxy')throw Error('Route tab failed');result.routeTabWorks=true;
 await page.selectOption('#view','back');await page.evaluate(()=>KnitLive.pause());result.back=await page.evaluate(()=>KnitLive.render('proxy'));await page.screenshot({path:out+'/back.png'});
 await page.selectOption('#view','near');await page.evaluate(()=>KnitLive.pause());
 await page.selectOption('#extent','640x448');await page.waitForFunction(()=>KnitLive.engine.w===640&&!document.getElementById('extent').disabled);await page.evaluate(()=>KnitLive.pause());
 result.defaultView={};for(const m of ['reference','proxy','surfel']){result.defaultView[m]=await page.evaluate(m=>KnitLive.render(m),m);await page.screenshot({path:out+'/desktop-640-'+m+'.png'});}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile-layout.png'});result.mobileLayoutOnly=true;
 if(!process.env.QA_URL){
  const file=await browser.newPage({viewport:{width:1000,height:800}});file.setDefaultTimeout(300000);const requests=[];file.on('request',r=>{if(!r.url().startsWith('file:'))requests.push(r.url());});file.on('pageerror',e=>result.errors.push('file: '+e.message));
  await file.goto('file://'+site+'/index.html?qa=1&size=160x112&density=40x12');await file.waitForFunction(()=>window.KnitLive?.ready||window.KnitLive?.state.failed,null,{timeout:300000});if(await file.evaluate(()=>KnitLive.state.failed))throw Error('Standalone file runtime failed: '+await file.locator('#status').innerText());await file.evaluate(()=>KnitLive.pause());result.standaloneFile={rendered:true,networkRequests:requests};if(requests.length)throw Error('Standalone runtime made network requests');await file.close();
 }
 result.runtimePassed=result.errors.length===0;result.testFinished=new Date().toISOString();
 if(!result.runtimePassed)throw Error('Browser errors: '+result.errors.join('\n'));
 console.log('RUNTIME_QA_PASSED',JSON.stringify({device:result.device.adapter,benchmark:result.benchmark.summary,quality:result.quality}));
}catch(e){result.failure=e.stack||String(e);result.runtimePassed=false;console.error(result.failure);process.exitCode=1;}
finally{await writeFile(out+'/BROWSER_QA.json',JSON.stringify(result,null,2));await browser.close();}
