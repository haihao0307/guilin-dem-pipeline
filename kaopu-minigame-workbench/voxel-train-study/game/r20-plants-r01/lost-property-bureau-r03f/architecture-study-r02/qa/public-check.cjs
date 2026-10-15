'use strict';
// Existing Bureau QA runner only. Reads the authorized public preview and does
// real pointer/wheel/view interactions without changing public content.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const OUT=path.resolve('bureau-r03f-public-preview-results');fs.mkdirSync(OUT,{recursive:true});
const BASE='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/lost-property-bureau-r03f/architecture-study-r02/';
const VERSION='f13953907a0dbed0cce8a33813d3ff7630a909d8';
const receipt={schema:'bureau-r02-public-browser/1',version:VERSION,url:BASE+'?v='+VERSION.slice(0,8),startedUtc:new Date().toISOString(),artisticAcceptance:false,userHardwareVerified:false,errors:[],consoleErrors:[],files:[],captures:[],checks:{}};
const save=()=>fs.writeFileSync(path.join(OUT,'architecture-r02-public-receipt.json'),JSON.stringify(receipt,null,2));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const changed=(a,b)=>Math.hypot(...a.eye.map((v,i)=>v-b.eye[i]))>.01;
async function run(){let browser,page;try{
 for(const name of['index.html','model.mjs','construction.mjs','viewer.mjs','spatial.mjs']){const r=await fetch(BASE+name+'?v='+VERSION.slice(0,8));if(!r.ok)throw Error(name+' HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer()),expected=sha(fs.readFileSync(path.join(__dirname,'..',name)));receipt.files.push({name,status:r.status,sha256:sha(b),expected,match:sha(b)===expected});if(sha(b)!==expected)throw Error('Public version mismatch '+name);}
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});page.setDefaultTimeout(30000);page.on('pageerror',e=>receipt.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')receipt.consoleErrors.push(m.text());});
 const start=Date.now(),response=await page.goto(receipt.url,{waitUntil:'domcontentloaded',timeout:60000});receipt.http=response.status();await page.waitForFunction(()=>window.__bureauArchitecture?.ready,null,{timeout:120000});
 const snap=()=>page.evaluate(()=>{const a=window.__bureauArchitecture;return{camera:a.camera(),frames:a.frames,view:a.view,renderer:a.rendererInfo(),firstFrameMs:a.firstFrameMs,contextLost:!!a.contextLost};});
 const rendered=async()=>{const f=(await snap()).frames;await page.waitForFunction(f=>window.__bureauArchitecture.frames>=f+2,f,{timeout:30000});};
 const capture=async name=>{const file='architecture-r02-public-'+name+'.png',b=await page.screenshot({path:path.join(OUT,file),timeout:30000});receipt.captures.push({name,file,sha256:sha(b),navigationToCaptureMs:Date.now()-start});save();};
 await rendered();receipt.initial=await snap();receipt.webgl=await page.evaluate(()=>{const g=document.querySelector('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return{renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),error:g.getError(),lost:g.isContextLost()};});await capture('whole');
 await page.mouse.move(830,570);const before=await snap();await page.mouse.down();await page.mouse.move(960,620,{steps:12});await page.waitForTimeout(500);const held=await snap();await page.mouse.up();receipt.drag={before,held};receipt.checks.dragBeforeRelease=changed(before.camera,held.camera)&&held.frames-before.frames>=3;
 const zoomBefore=await snap();await page.mouse.wheel(0,-500);await rendered();const zoomAfter=await snap();receipt.zoom={before:zoomBefore,after:zoomAfter};receipt.checks.zoomIn=zoomAfter.camera.radius<zoomBefore.camera.radius*.95;
 for(const name of['hall','warehouse']){await page.locator('[data-view="'+name+'"]').click();await rendered();const state=await snap();receipt.checks[name+'View']=state.view===name;await capture(name);}
 await page.locator('[data-view="whole"]').click();await rendered();const p=await snap(),t=Date.now();await page.waitForTimeout(2500);const q=await snap(),elapsed=Date.now()-t;receipt.performance={view:'whole',frames:q.frames-p.frames,elapsedMs:elapsed,fps:(q.frames-p.frames)/(elapsed/1000),gate:'>5 frames in 2500ms',passed:q.frames-p.frames>5};
 receipt.checks.noErrors=!receipt.errors.length&&!receipt.consoleErrors.length&&!q.contextLost&&receipt.webgl.error===0;receipt.checks.publicFilesExact=receipt.files.every(x=>x.match);receipt.functionalPassed=Object.values(receipt.checks).every(Boolean);receipt.performancePassed=receipt.performance.passed;receipt.status=receipt.functionalPassed?(receipt.performancePassed?'public-functional-and-performance-passed-art-unaccepted':'public-functional-passed-performance-failed'):'failed';receipt.completedUtc=new Date().toISOString();save();console.log(JSON.stringify(receipt));if(!receipt.functionalPassed||!receipt.performancePassed)process.exitCode=1;
}catch(e){receipt.status='failed';receipt.failure=e.stack;save();console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();}}
run();
