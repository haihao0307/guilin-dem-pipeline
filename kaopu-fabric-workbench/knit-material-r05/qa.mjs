import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.env.SITE_DIR),out=root+'/evidence';await mkdir(out,{recursive:true});
const result={version:'KNIT-MATERIAL-R05',sourceCommit:process.env.GITHUB_SHA,started:new Date().toISOString(),hardwareTested:false,target60Verified:false,qualityComparisons:[],errors:[],checks:{}};
let browser;const save=()=>writeFile(out+'/QA.json',JSON.stringify(result,null,2));
function difference(a,b){if(a.length!==b.length)throw Error('Image length mismatch');let maxColor=0,sum=0,maxDepth=0,miss=0,extra=0,changed=0;for(let i=0;i<a.length;i+=4){for(let k=0;k<3;k++){const d=Math.abs(a[i+k]-b[i+k])*255;maxColor=Math.max(maxColor,d);sum+=d;if(d!==0)changed++;}const x=a[i+3]<1e7,y=b[i+3]<1e7;if(x&&!y)miss++;if(!x&&y)extra++;if(x&&y)maxDepth=Math.max(maxDepth,Math.abs(a[i+3]-b[i+3]));}return {maxColor255:maxColor,meanColor255:sum/(a.length/4*3),changedChannels:changed,maxDepthMm:maxDepth,missingPixels:miss,extraPixels:extra};}
function stats(a){a=[...a].sort((x,y)=>x-y);const q=p=>{const n=(a.length-1)*p,i=Math.floor(n);return a[i]+(a[Math.min(a.length-1,i+1)]-a[i])*(n-i);};return {n:a.length,median:q(.5),p95:q(.95),min:a[0],max:a.at(-1)};}
try{
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--no-sandbox','--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface','--disable-dev-shm-usage']});
 async function open(url){const p=await browser.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(600000);p.on('pageerror',e=>result.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))result.errors.push(m.text());});await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FabricLab?.ready||window.FabricLab?.state.failed,null,{timeout:600000});await p.evaluate(()=>FabricLab.pause());if(await p.evaluate(()=>FabricLab.state.failed))throw Error(await p.locator('#error').innerText());return p;}
 const base=await open('http://127.0.0.1:8925/kaopu-fabric-workbench/knit-material-r04/index.html?qa=1');
 const page=await open('http://127.0.0.1:8925/kaopu-fabric-workbench/knit-material-r05/index.html?qa=1');
 result.metadata=await page.evaluate(()=>FabricLab.state.metadata);await save();
 async function compare(name){
  console.log('COMPARE',name);const timingA=await base.evaluate(()=>FabricLab.render()),a=await base.evaluate(async()=>Array.from(await FabricLab.read()));
  const timingB=await page.evaluate(()=>FabricLab.render()),b=await page.evaluate(async()=>Array.from(await FabricLab.read()));
  const diff=difference(a,b),record={name,diff,original:timingA,optimized:timingB,sourceStats:await page.evaluate(()=>FabricLab.sourceStats())};result.qualityComparisons.push(record);await save();
  if(diff.maxColor255>1/255||diff.maxDepthMm>.0001||diff.missingPixels||diff.extraPixels)throw Error('Quality regression '+name+' '+JSON.stringify(diff));
  return record;
 }
 for(let i=0;i<6;i++){await base.evaluate(i=>FabricLab.select(i),i);await page.evaluate(i=>FabricLab.select(i),i);await compare('preset-'+i);}
 await base.evaluate(()=>FabricLab.select(0));await page.evaluate(()=>FabricLab.select(0));
 for(const v of [{distance:90,yaw:.18},{distance:270,yaw:1.2},{distance:270,yaw:3.1}]){await base.evaluate(v=>FabricLab.setView(v),v);await page.evaluate(v=>FabricLab.setView(v),v);await compare('view-'+JSON.stringify(v));}
 const exported=await page.evaluate(()=>FabricLab.exportText());await page.evaluate(t=>FabricLab.importText(t),exported);result.checks.materialImportExport=JSON.parse(exported).source===await page.evaluate(()=>FabricLab.state.material.source);
 await base.evaluate(()=>FabricLab.setView({distance:270,yaw:.12,pitch:.08}));await page.evaluate(()=>FabricLab.setView({distance:270,yaw:.12,pitch:.08}));
 const trials={original:[],optimized:[]};await base.evaluate(()=>FabricLab.render());await page.evaluate(()=>FabricLab.render());
 for(let i=0;i<6;i++){for(const k of (i%2?['optimized','original']:['original','optimized'])){console.log('PAIRED',i,k);trials[k].push(await (k==='original'?base:page).evaluate(()=>FabricLab.render()));}}
 const summary={};for(const k of ['original','optimized'])summary[k]={wall:stats(trials[k].map(x=>x.wallMs)),gpu:stats(trials[k].map(x=>x.gpuMs)),yarn:stats(trials[k].map(x=>x.stages.render)),hairs:stats(trials[k].map(x=>x.stages.hairs))};
 result.benchmark={condition:await page.evaluate(()=>FabricLab.state.metadata),trials,summary,speedup:summary.original.wall.median/summary.optimized.wall.median,reference:'unchanged accepted R04 standalone page',interleaved:true};await save();
 await base.evaluate(()=>FabricLab.setView({width:640}));await page.evaluate(()=>FabricLab.setView({width:640}));result.default640=await compare('default-640');await page.screenshot({path:out+'/default-640.png'});
 await page.evaluate(()=>FabricLab.setView({width:160}));result.motion=await page.evaluate(()=>FabricLab.motionTest(2));await save();
 const box=await page.locator('#view').boundingBox(),before=await page.evaluate(()=>FabricLab.state.metadata.camera);await page.mouse.move(box.x+box.width*.3,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:3});await page.mouse.up();await page.evaluate(()=>FabricLab.pause());const after=await page.evaluate(()=>FabricLab.state.metadata.camera);result.checks.orbit=before.yaw!==after.yaw;
 result.internalAB=await page.evaluate(()=>FabricLab.performanceAB(2));
 const standalone=await open('file://'+root+'/index.html?qa=1');result.checks.standalone=await standalone.evaluate(()=>FabricLab.ready&&!FabricLab.state.failed);await standalone.close();
 result.checks.materialSourceUnchanged=JSON.parse(exported).source===JSON.parse(await base.evaluate(()=>FabricLab.exportText())).source;
 result.runtimePassed=result.errors.length===0&&Object.values(result.checks).every(Boolean);result.finished=new Date().toISOString();if(!result.runtimePassed)throw Error('Runtime checks failed');
 console.log('PASSED',JSON.stringify({summary:result.benchmark.summary,speedup:result.benchmark.speedup,quality:result.qualityComparisons.map(q=>({name:q.name,diff:q.diff}))}));
}catch(e){result.runtimePassed=false;result.failure=e.stack;console.error(e);process.exitCode=1;}finally{await save();if(browser)await browser.close();}
