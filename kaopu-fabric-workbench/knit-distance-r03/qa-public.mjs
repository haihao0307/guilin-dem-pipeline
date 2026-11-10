import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(process.env.SITE_DIR),out=root+'/evidence';await mkdir(out,{recursive:true});
const raw='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/350a41e2b1c853cce310f508e706e1d483eb7852/kaopu-fabric-workbench/knit-distance-r03/index.html';
const url='https://htmlpreview.github.io/?'+raw;
const result={version:'KNIT-DISTANCE-R03',taskId:'knit-distance-r03-direct-access-20261110',url,started:new Date().toISOString(),qaCommit:process.env.GITHUB_SHA,runtimeChanged:false,hardwareTested:false,phoneHardwareTested:false,visualAcceptance:false,pageErrors:[],consoleErrors:[],httpErrors:[],resourceFailures:[],routes:{},shareAllowed:false};let browser;
const sha=a=>createHash('sha256').update(a).digest('hex');
async function save(){await writeFile(out+'/PUBLIC_QA.json',JSON.stringify(result,null,2));}
try{
 const expected=sha(await readFile(root+'/index.html'));
 if(expected!=='382a76d04d4df588567890ccd5b1adfb6f14ef5ff2d816649d65e7b91eeaf499')throw Error('Runtime changed unexpectedly');
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--no-sandbox','--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface','--disable-dev-shm-usage']});
 const p=await browser.newPage({viewport:{width:1200,height:900}});p.setDefaultTimeout(600000);
 p.on('pageerror',e=>result.pageErrors.push(e.message));
 p.on('console',m=>{if(m.type()==='error'){const item={text:m.text(),location:m.location()};result.consoleErrors.push(item);console.log('CONSOLE_ERROR',JSON.stringify(item));}});
 p.on('response',r=>{if(r.status()>=400){const item={url:r.url(),status:r.status(),resourceType:r.request().resourceType()};result.httpErrors.push(item);console.log('HTTP_ERROR',JSON.stringify(item));}});
 p.on('requestfailed',r=>result.resourceFailures.push({url:r.url(),error:r.failure()?.errorText}));
 const sourcePending=p.waitForResponse(r=>r.url()===raw,{timeout:120000});
 const response=await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
 result.httpStatus=response?.status();if(!response?.ok())throw Error('Entry HTTP '+response?.status());
 const source=await sourcePending;result.sourceHTTPStatus=source.status();result.sourceSHA256=sha(await source.body());result.expectedSHA256=expected;
 if(!source.ok()||result.sourceSHA256!==expected)throw Error('Loaded source mismatch');
 console.log('PUBLIC_SOURCE_MATCHED');await save();
 await p.waitForFunction(()=>window.KnitDistance?.ready||window.KnitDistance?.state.failed,null,{timeout:300000});
 await p.evaluate(()=>KnitDistance.pause());
 const initial=await p.evaluate(()=>KnitDistance.state);if(initial.failed)throw Error(await p.locator('#status').innerText());
 result.initialMetadata=initial.metadata;result.defaultCompletedFrames=initial.frames;
 if(initial.frames<1||initial.metadata.width!==640||initial.metadata.height!==448)throw Error('Default full-size first frame not completed');
 const imageProbe=async()=>p.evaluate(async()=>{const a=await KnitDistance.read();let lo=1e9,hi=-1e9,hits=0;for(let i=0;i<a.length;i+=4){lo=Math.min(lo,a[i]);hi=Math.max(hi,a[i]);if(a[i+3]<1e7)hits++;}return{min:lo,max:hi,hits};});
 result.defaultImage=await imageProbe();if(result.defaultImage.hits<100||result.defaultImage.max-result.defaultImage.min<.05)throw Error('Default blank output');
 await p.screenshot({path:out+'/direct-default-640.png'});console.log('DEFAULT640_RENDERED');await save();
 await p.locator('#size').selectOption('160x112');await p.evaluate(()=>KnitDistance.pause());
 for(let m=0;m<3;m++){
  result.routes[m]=await p.evaluate(m=>KnitDistance.render(m),m);result.routes[m].image=await imageProbe();
  if(result.routes[m].image.hits<100||result.routes[m].image.max-result.routes[m].image.min<.05)throw Error('Blank route '+m);
 }
 const beforeDistance=await p.evaluate(()=>KnitDistance.state.metadata.distanceMm);
 await p.locator('#dist').evaluate(e=>{e.value='900';e.dispatchEvent(new Event('input',{bubbles:true}));});await p.evaluate(()=>KnitDistance.pause());
 result.distanceControl={before:beforeDistance,after:await p.evaluate(()=>KnitDistance.state.metadata.distanceMm)};
 if(result.distanceControl.after!==900)throw Error('Distance control failed');
 result.changedDistanceFrame=await p.evaluate(()=>KnitDistance.render(0));
 const before=await p.evaluate(()=>KnitDistance.state.metadata.eyeMm),box=await p.locator('#view').boundingBox();
 await p.mouse.move(box.x+box.width*.35,box.y+box.height*.4);await p.mouse.down();await p.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:3});await p.mouse.up();await p.evaluate(()=>KnitDistance.pause());
 const after=await p.evaluate(()=>KnitDistance.state.metadata.eyeMm);if(JSON.stringify(before)===JSON.stringify(after))throw Error('Orbit failed');result.orbit={before,after};
 const count=await p.evaluate(()=>KnitDistance.state.frames);await p.getByRole('button',{name:'距离驱动',exact:true}).click();
 await p.waitForFunction(n=>KnitDistance.state.frames>=n+2||KnitDistance.state.failed,count,{timeout:300000});await p.evaluate(()=>KnitDistance.pause());
 result.finalState=await p.evaluate(()=>KnitDistance.state);if(result.finalState.failed)throw Error('Live loop failed');
 result.noConfirmationPage=!(await p.getByRole('button',{name:'Open the page',exact:true}).isVisible());
 if(!result.noConfirmationPage)throw Error('Confirmation still present');
 // Do not intercept or hide errors. Preserve all evidence. A browser-tab icon missing from the external preview provider is not a shader, source or runtime dependency.
 // Only this exact provider URL with an observed404 is non-blocking; every page error, other console error, HTTP error or failed network request remains fatal.
 const icon='https://htmlpreview.github.io/favicon.ico';
 const iconHTTP=result.httpErrors.filter(e=>e.url===icon&&e.status===404);
 const iconConsole=result.consoleErrors.filter(e=>e.location.url===icon&&e.text.includes('404'));
 result.nonBlockingProviderIcon404={http:iconHTTP,console:iconConsole};
 result.criticalHttpErrors=result.httpErrors.filter(e=>!(e.url===icon&&e.status===404));
 result.criticalConsoleErrors=result.consoleErrors.filter(e=>!(e.location.url===icon&&e.text.includes('404')));
 result.runtimePassed=result.pageErrors.length===0&&result.criticalConsoleErrors.length===0&&result.criticalHttpErrors.length===0&&result.resourceFailures.length===0;
 if(!result.runtimePassed)throw Error('Browser/resource errors; see exact URLs in evidence');
 result.shareAllowed=true;result.finished=new Date().toISOString();
 const proof={schema:'kaopu/publication-proof@1',version:result.version,taskId:result.taskId,publicUrl:url,testedUrl:url,artifactCommit:'350a41e2b1c853cce310f508e706e1d483eb7852',runtimeChanged:false,sourceSHA256:expected,httpStatus:result.httpStatus,sourceHTTPStatus:result.sourceHTTPStatus,publicRuntimePassed:true,shareAllowed:true,requiresProviderConfirmation:false,defaultPixels:[640,448],interactionTestPixels:[160,112],hardwareTested:false,phoneHardwareTested:false,visualAcceptance:false,meaningfulSpeedupDemonstrated:false,qaCommit:process.env.GITHUB_SHA,qaRun:process.env.GITHUB_RUN_ID,verifiedAt:result.finished,pageErrors:result.pageErrors,criticalHttpErrors:result.criticalHttpErrors,criticalConsoleErrors:result.criticalConsoleErrors,nonBlockingProviderIcon404:result.nonBlockingProviderIcon404,notes:['Access-only repair: exact original material and rendering source.','Normal public URL tested at default size, not a QA-only entry.','Actual source fetched by preview was hash-matched; preview wrapper naturally changes DOM.','Testing used software WebGPU; no claim about user hardware performance.','Any provider favicon404 is retained in the evidence, never hidden or misreported as zero console messages.']};
 await writeFile(root+'/PUBLICATION_PROOF.json',JSON.stringify(proof,null,2));console.log('DIRECT_PUBLIC_RUNTIME_PASSED');
}catch(e){result.runtimePassed=false;result.failure=e.stack;result.finished=new Date().toISOString();console.error(e);process.exitCode=1;}finally{await save();if(browser)await browser.close();}
