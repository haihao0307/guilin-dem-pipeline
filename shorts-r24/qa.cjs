const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL,fileURLToPath}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_ROOT||'../../Human-Fabric-Workbench/node_modules/playwright');
const target=process.env.REVIEW_URL||pathToFileURL(path.resolve('../Human-Work-Preparation-20260930/dist-r24/shorts-r24-reviewed/index.html')).href;
const output=path.resolve(process.env.PROOF_DIR||'proof-r24');fs.mkdirSync(output,{recursive:true});
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-dev-shm-usage',...(process.platform==='linux'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[])]});
const context=await browser.newContext({viewport:{width:1200,height:900},acceptDownloads:true});if(target.startsWith('file:'))await context.setOffline(true);
const page=await context.newPage(),errors=[],requests=[];page.setDefaultTimeout(600000);
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
let result={url:target,checkedAt:new Date().toISOString()},stage='startup';const shot=async name=>{stage=name;console.log('CHECK '+name);await page.screenshot({path:path.join(output,name+'.png')});};
try{
 console.log('OPEN '+target);const response=await page.goto(target,{waitUntil:'domcontentloaded'});if(response&&!response.ok())throw Error('HTTP '+response.status());result.httpStatus=response?.status()||null;
 // Read large standalone HTML through the HTTP client. Chromium's inspector
 // may evict a 14 MB document body even while the actual page loads correctly.
 const local=target.startsWith('file:'),readback=local?null:await context.request.get(target);if(readback&&!readback.ok())throw Error('Readback HTTP '+readback.status());
 const bytes=local?fs.readFileSync(fileURLToPath(target)):await readback.body(),build=local?JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(target)),'BUILD.json'),'utf8')):await (await context.request.get(new URL('BUILD.json',target).href)).json();
 result.htmlSHA256=crypto.createHash('sha256').update(bytes).digest('hex');result.build=build;if(result.htmlSHA256!==build.htmlSHA256||build.source!=='c595390448b7c307ebf1fcd26566bd947411c319')throw Error('Published content/build provenance mismatch');
 await page.waitForFunction(()=>window.ShortsR24?.ready||window.__startupError||window.__humanStartup?.status==='ready');
 await page.waitForFunction(()=>window.ShortsR24?.ready||window.__startupError||window.HumanLab?.compact?.skirt?.assemblyState==='continuation-checkpoint-failed',null,{timeout:10000});
 if(!await page.evaluate(()=>window.ShortsR24?.ready)){const diagnosis=await page.evaluate(()=>({startup:window.__humanStartup,continuation:window.HumanLab?.compact?.skirt?.continuationReport}));result.diagnosis=diagnosis;throw Error('Continuation failed: '+JSON.stringify(diagnosis).slice(0,1800));}
 const state=await page.evaluate(()=>({version:ShortsR24.version,source:ShortsR24.source,report:ShortsR24.report(),embedded:window.__SHORTS_R54_EMBEDDED__}));Object.assign(result,state);const r=state.report.rise;
 if(state.version!=='R2.4-open-waist-continuation-20261001'||state.source!=='c595390448b7c307ebf1fcd26566bd947411c319'||!state.embedded)throw Error('Wrong reviewed source');
 const c=state.report.continuation;
 if(state.report.assemblyState!=='continuation-ready'||!r.valid||!c.valid||!c.priorClosed||!c.cuffsValid||!c.bodyContact||!c.selfContact||!c.strictUnexpectedIntersectionFree||c.material.maxAbsPrincipalStrain>.05||!c.sourceIdentityPreserved||!c.expectedDofs||!c.mainUnchanged||!c.orangeUnchanged||!c.pendingUnstarted||!c.handling.waist.mainUnchanged)throw Error('Continuation regression gate failed');
 if(c.sideOpeningClosed||c.waistbandConnected||c.gussetConnected||!c.waistbandAttached||c.closedSeams.length!==13||state.report.assemblyReady||c.productionReady||c.motionValidated)throw Error('Sewing scope/acceptance mismatch');
 for(const view of ['front','back','left','right','cloth','below']){await page.locator('[data-r24-view='+view+']').click();await shot('view-'+view);}
 const before=await page.evaluate(()=>JSON.stringify(HumanLab.compact.skirt.simulation.snapshot()));await page.locator('#r24-material').click();if(await page.evaluate(()=>window.__SHORTS_PANEL_COLORS__)!==false)throw Error('Linen material switch failed');await page.locator('[data-r24-view=cloth]').click();await shot('linen-cloth');await page.locator('[data-r24-view=front]').click();await shot('linen-front');
 if(await page.evaluate(()=>JSON.stringify(HumanLab.compact.skirt.simulation.snapshot()))!==before)throw Error('Material/view switch changed cloth');await page.locator('#r24-material').click();if(await page.evaluate(()=>window.__SHORTS_PANEL_COLORS__)!==true)throw Error('Panel colour switch failed');result.materialSwitchPassed=true;
 await page.locator('#r24-info').evaluate(e=>e.open=true);const pending=page.waitForEvent('download');await page.locator('#r24-export').click();const download=await pending;await download.saveAs(path.join(output,'EXPORTED_REPORT.json'));const exported=JSON.parse(fs.readFileSync(path.join(output,'EXPORTED_REPORT.json'),'utf8'));if(exported.source!==state.source||!exported.report.rise.valid)throw Error('Report export mismatch');await page.locator('#r24-info').evaluate(e=>e.open=false);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-r24-view=front]').click();await shot('mobile-390');result.mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(result.mobileOverflow)throw Error('Mobile overflow');
 if(await page.locator('#body-settings-open').isVisible())throw Error('Unvalidated body edit controls exposed');
 if(errors.length)throw Error(errors.join('\n'));if(target.startsWith('file:')&&requests.length)throw Error('Offline external requests');result.passed=true;result.desktopPassed=true;result.mobileViewportPassed=true;result.exportPassed=true;result.offline=target.startsWith('file:');result.interaction='view and material controls; cloth motion intentionally unavailable';
}catch(e){result.failure=e.stack||String(e);await shot('failure').catch(()=>{});}
finally{result.stage=stage;result.errors=errors;result.networkRequests=requests;fs.writeFileSync(path.join(output,'QA.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,failure:result.failure,stage,errors:errors.length,requests:requests.length}));await browser.close();}
if(!result.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
