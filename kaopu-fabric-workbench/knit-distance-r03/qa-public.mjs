import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(process.env.SITE_DIR),out=root+'/evidence';await mkdir(out,{recursive:true});
const url=process.env.QA_URL;if(!url)throw Error('QA_URL required');
const result={version:'KNIT-DISTANCE-R03',url,started:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA,hardwareTested:false,phoneHardwareTested:false,visualAcceptance:false,errors:[],routes:{}};let browser;
try{
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--no-sandbox','--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface','--disable-dev-shm-usage']});
 const p=await browser.newPage({viewport:{width:1200,height:900}});p.setDefaultTimeout(300000);
 p.on('pageerror',e=>result.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
 const r=await p.goto(url,{waitUntil:'domcontentloaded'});result.httpStatus=r?.status();if(!r?.ok())throw Error('Public HTTP '+r?.status());
 const sha=a=>createHash('sha256').update(a).digest('hex');result.htmlSHA256=sha(await r.body());result.expectedSHA256=sha(await readFile(root+'/index.html'));if(result.htmlSHA256!==result.expectedSHA256)throw Error('Public HTML mismatch');
 await p.waitForFunction(()=>window.KnitDistance?.ready||window.KnitDistance?.state.failed,null,{timeout:300000});await p.evaluate(()=>KnitDistance.pause());if(await p.evaluate(()=>KnitDistance.state.failed))throw Error(await p.locator('#status').innerText());
 result.metadata=await p.evaluate(()=>KnitDistance.state.metadata);
 for(let m=0;m<3;m++){result.routes[m]=await p.evaluate(m=>KnitDistance.render(m),m);const image=await p.evaluate(async()=>{let a=await KnitDistance.read(),lo=1e9,hi=-1e9,n=0;for(let i=0;i<a.length;i+=4){lo=Math.min(lo,a[i]);hi=Math.max(hi,a[i]);if(a[i+3]<1e7)n++;}return{min:lo,max:hi,hits:n};});if(image.hits<100||image.max-image.min<.05)throw Error('Blank route '+m);result.routes[m].image=image;await p.screenshot({path:out+'/public-'+m+'.png'});}
 const before=await p.evaluate(()=>KnitDistance.state.metadata);await p.locator('#dist').evaluate(e=>{e.value='900';e.dispatchEvent(new Event('input',{bubbles:true}));});await p.evaluate(()=>KnitDistance.pause());result.distanceSlider=await p.evaluate(()=>KnitDistance.state.metadata.distanceMm);if(result.distanceSlider!==900)throw Error('Distance slider failed');result.changedView=await p.evaluate(()=>KnitDistance.render(0));
 const box=await p.locator('#view').boundingBox();await p.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await p.mouse.down();await p.mouse.move(box.x+box.width*.55,box.y+box.height*.52,{steps:3});await p.mouse.up();await p.evaluate(()=>KnitDistance.pause());result.orbitAfter=await p.evaluate(()=>KnitDistance.state.metadata.eyeMm);if(JSON.stringify(before.eyeMm)===JSON.stringify(result.orbitAfter))throw Error('Camera interaction failed');
 await p.evaluate(()=>KnitDistance.set({distance:450,yaw:.18}));const count=await p.evaluate(()=>KnitDistance.state.frames);await p.getByRole('button',{name:'距离驱动',exact:true}).click();await p.waitForFunction(n=>KnitDistance.state.frames>=n+3||KnitDistance.state.failed,count,{timeout:300000});await p.evaluate(()=>KnitDistance.pause());result.liveFPS=await p.locator('#fps').innerText();if(await p.evaluate(()=>KnitDistance.state.failed))throw Error('Live loop failed');if(!Number.isFinite(Number(result.liveFPS)))throw Error('FPS missing');
 result.benchmarkEnabled=await p.locator('#measure').isEnabled();result.runtimePassed=result.errors.length===0;result.finished=new Date().toISOString();if(!result.runtimePassed)throw Error('Console errors');
}catch(e){result.runtimePassed=false;result.failure=e.stack;console.error(e);process.exitCode=1;}finally{await writeFile(out+'/PUBLIC_QA.json',JSON.stringify(result,null,2));if(browser)await browser.close();}
