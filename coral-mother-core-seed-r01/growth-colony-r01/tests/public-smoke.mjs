import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const manifest=JSON.parse(await fs.readFile(new URL('./public-smoke-manifest.json',import.meta.url),'utf8'));
const out=process.env.CORAL_OUT||'coral-public-smoke';await fs.mkdir(out,{recursive:true});
const report={status:'running',at:new Date().toISOString(),qaScriptCommit:process.env.GITHUB_SHA,publishedCommit:manifest.publishedCommit,fullMatrixTestedCommit:manifest.testedCommit,url:manifest.base,scope:'Actual public HTTPS Chromium desktop smoke, not a physical phone or a repeat of the full performance matrix',http:[],loadedResources:[],steps:[],pageErrors:[],consoleErrors:[],networkFailures:[]};
const blobHash=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
let browser,page,phase='launch';const responseChecks=[];
const progress=setInterval(()=>console.log('PUBLIC_SMOKE',phase),20000);progress.unref();
try{
 browser=await chromium.launch({headless:true});report.browserVersion=browser.version();
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(60000);
 const expected=new Map(manifest.files.map(f=>[manifest.base+f.path,f.sha]));expected.set(manifest.base,expected.get(manifest.base+'index.html'));expected.set(manifest.mother.url,manifest.mother.sha);
 phase='verify exact seventeen public files';
 for(const item of [...manifest.files.map(f=>({...f,url:manifest.base+f.path})),{path:'../index.html',...manifest.mother}]){
  const response=await context.request.get(item.url,{timeout:30000});assert.equal(response.status(),200,item.url);const body=await response.body(),sha=blobHash(body);assert.equal(sha,item.sha,item.url+' public bytes changed');report.http.push({path:item.path,url:item.url,status:response.status(),gitBlob:sha,bytes:body.length});
 }
 assert.equal(report.http.length,17);
 page.on('pageerror',e=>report.pageErrors.push({phase,message:e.message}));
 page.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))report.consoleErrors.push({phase,text:m.text(),location:m.location()});});
 page.on('requestfailed',r=>{if(!r.url().endsWith('/favicon.ico'))report.networkFailures.push({phase,url:r.url(),error:r.failure()?.errorText});});
 context.on('response',response=>{const url=response.url().split('?')[0];if(!expected.has(url))return;responseChecks.push((async()=>{const data=await response.body(),sha=blobHash(data);assert.equal(response.status(),200,url);assert.equal(sha,expected.get(url),url+' loaded browser bytes changed');report.loadedResources.push({url,status:response.status(),gitBlob:sha,bytes:data.length});})());});
 async function ready(){await page.waitForFunction(()=>{const s=window.__coralAudit?.state;return s?.faces>0&&!s.geometryBusy&&!s.queued&&s.lifecycle.phase==='running';});}
 async function capture(name){phase=name;const result=await page.evaluate(()=>{const pixels=window.__coralAudit.pixelDigest();return {state:window.__coralAudit.state,pixels};});assert.equal(result.pixels.glErrorBefore,0);assert.equal(result.pixels.glError,0);assert.ok(result.pixels.nonBackgroundPixels>200);assert.equal(result.pixels.mainDrawCalls,1);assert.equal(result.pixels.mainTriangles,result.state.faces);report.steps.push({name,...result});await page.screenshot({path:path.join(out,name+'.png')});return result;}
 async function stage(time,name){const before=(await page.evaluate(()=>window.__coralAudit.state)).generationId;await page.locator('#time').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},time);await page.waitForFunction(({before,time})=>{const s=window.__coralAudit.state;return s.generationId>before&&s.displayedTime===time&&!s.geometryBusy&&!s.queued;},{before,time});return capture(name);}
 phase='open exact production root';await page.goto(manifest.base,{waitUntil:'domcontentloaded',timeout:90000});assert.equal(page.url(),manifest.base);await ready();
 const initial=await capture('public-mature-initial');assert.equal(initial.state.faces,731552);assert.equal(initial.state.parts,479);assert.equal(initial.state.buffers.total,17580240);
 const early=await stage(.18,'public-early-stage');assert.equal(early.state.parts,15);assert.ok(early.state.faces<initial.state.faces);
 const late=await stage(1,'public-mature-replayed');assert.deepEqual(late.state.geometryFingerprint,initial.state.geometryFingerprint);assert.equal(late.pixels.hash,initial.pixels.hash);
 phase='native mouse rotation';await page.mouse.move(940,490);await page.mouse.down();await page.mouse.move(885,520,{steps:5});await page.mouse.up();await page.waitForTimeout(300);const rotated=await capture('public-rotated');assert.notDeepEqual(rotated.state.camera.position,late.state.camera.position);assert.notEqual(rotated.pixels.hash,late.pixels.hash);
 phase='native wheel zoom';await page.mouse.wheel(0,-160);await page.waitForTimeout(300);const zoomed=await capture('public-zoomed');assert.notDeepEqual(zoomed.state.camera.position,rotated.state.camera.position);assert.notEqual(zoomed.pixels.hash,rotated.pixels.hash);
 phase='return to public mother';const mother=new URL('../',manifest.base);assert.equal(await page.locator('#return').getAttribute('href'),mother.href);await Promise.all([page.waitForURL(u=>u.origin===mother.origin&&u.pathname===mother.pathname,{waitUntil:'domcontentloaded',timeout:90000}),page.locator('#return').click()]);assert.match(await page.title(),/Coral Mother/i);report.motherURL=page.url();
 const cleanupKey=`coral-growth:${new URL(manifest.base).pathname}:cleanup`;const cleanup=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),cleanupKey);assert.ok(cleanup);assert.equal(cleanup.instanceId,zoomed.state.lifecycle.instanceId);assert.deepEqual(cleanup.errors,[]);assert.equal(cleanup.after.buffers.total,0);assert.equal(cleanup.after.workerAlive,false);assert.equal(cleanup.after.rafPending,false);assert.equal(cleanup.after.rendererMemory.geometries,0);assert.equal(cleanup.after.rendererMemory.programs,0);assert.equal(cleanup.gpuContextLost,true);report.cleanup=cleanup;
 phase='public browser Back';await page.goBack({waitUntil:'domcontentloaded',timeout:90000});await ready();const back=await capture('public-returned-from-mother');assert.equal(new URL(page.url()).pathname,new URL(manifest.base).pathname);assert.deepEqual(back.state.geometryFingerprint,initial.state.geometryFingerprint);assert.deepEqual(back.state.displayedParameters,initial.state.displayedParameters);assert.equal(back.state.faces,731552);assert.equal(back.state.lifecycle.previousCleanup.instanceId,cleanup.instanceId);
 await Promise.all(responseChecks);assert.ok(report.loadedResources.some(x=>x.url===manifest.base));assert.ok(report.loadedResources.some(x=>x.url===manifest.base+'viewer.mjs'));assert.ok(report.loadedResources.some(x=>x.url===manifest.base+'coral-growth.mjs'));
 assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.networkFailures,[]);report.status='passed';report.bfcache=cleanup.persisted?'BFCache recovery exercised; disposed candidate reloaded safely':'Normal history restoration; BFCache-specific path untested';
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,publishedCommit:report.publishedCommit,fullMatrixTestedCommit:report.fullMatrixTestedCommit,httpFiles:report.http.length,loadedResources:report.loadedResources.length,steps:report.steps.map(x=>x.name),url:manifest.base}));
}catch(error){report.status='failed';report.phase=phase;report.error={message:error.message,stack:error.stack};if(page){try{await page.screenshot({path:path.join(out,'failure.png'),timeout:10000});}catch{}}await fs.writeFile(path.join(out,'failure.json'),JSON.stringify(report,null,2));console.error(error);process.exitCode=1;}finally{clearInterval(progress);if(browser)await browser.close();}
