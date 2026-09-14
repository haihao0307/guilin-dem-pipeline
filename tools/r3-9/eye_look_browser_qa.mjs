import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const target=process.env.R38_URL,out=process.env.QA_OUTPUT;
if(!target||!out)throw Error('R38_URL and QA_OUTPUT required');
await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});
const report={schema:'wenzhou-eye-look-qa/v1',target,passed:false,failures:[],errors:[]};
const check=(v,n)=>{if(!v)report.failures.push(n);};
async function open(viewport){const c=await browser.newContext({viewport,reducedMotion:'reduce'});if(target.includes('githack'))await c.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});await p.click('#mountains');await p.waitForFunction(()=>{const s=document.querySelector('#terrain').dataset;return s.patch==='mountains'&&s.soilContextLoaded==='true'&&s.soilContextPatch==='mountains';},null,{timeout:120000});return{c,p};}
const state=p=>p.locator('#terrain').evaluate(c=>({...c.dataset}));
try{
 const{c,p}=await open({width:1280,height:800});await p.click('#eye-view');
 await p.waitForFunction(()=>document.querySelector('#terrain').dataset.eyeLookContract==='target-synchronized',null,{timeout:120000});
 const start=await state(p),dir=start.eyeLookDirection.split(',').map(Number);
 check(Math.abs(dir[1])<1e-7,'eye camera still points down instead of horizontal');check(Number(start.eyeLookDirectionError)<1e-7,'camera is not aligned with actual eye target');check(Math.abs(Number(start.eyeHeightM)-1.6)<.002,'orientation fix moved camera');
 await p.screenshot({path:out+'/eye-forward-desktop.png'});const pixels=await p.locator('#terrain').screenshot();
 await p.locator('#terrain').focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(old=>document.querySelector('#terrain').dataset.eyeLookDirection!==old,start.eyeLookDirection);
 const turned=await state(p),changed=await p.locator('#terrain').screenshot();check(turned.camera===start.camera,'turning changed position');check(!pixels.equals(changed),'turning did not change rendered view');
 await p.keyboard.press('ArrowLeft');await p.keyboard.press('ArrowUp');await p.waitForFunction(()=>Number(document.querySelector('#terrain').dataset.eyeLookDirection.split(',')[1])>.02);
 const up=await state(p);check(up.camera===start.camera,'looking up changed position');await p.screenshot({path:out+'/eye-look-up-desktop.png'});
 await p.keyboard.press('ArrowDown');await p.mouse.move(650,400);await p.mouse.down();await p.mouse.move(750,430,{steps:4});await p.mouse.up();
 const dragged=await state(p);check(dragged.eyeLookDirection!==start.eyeLookDirection,'pointer drag did not rotate actual view');check(dragged.camera===start.camera,'pointer drag moved eye anchor');check(Number(dragged.eyeLookDirectionError)<1e-7,'pointer target and optical axis differ');
 report.desktop={initialDirection:dir,eyeHeightM:Number(start.eyeHeightM),turnDirection:turned.eyeLookDirection,lookUpDirection:up.eyeLookDirection,draggedDirection:dragged.eyeLookDirection,cameraPositionPreserved:true,pixelsChanged:true,directionError:Number(dragged.eyeLookDirectionError)};
 await c.close();
 const mobile=await open({width:390,height:844});await mobile.p.click('#eye-view');await mobile.p.waitForFunction(()=>document.querySelector('#terrain').dataset.eyeLookContract==='target-synchronized');const m=await state(mobile.p);check(Math.abs(Number(m.eyeLookDirection.split(',')[1]))<1e-7,'mobile eye not horizontal');check(await mobile.p.locator('#eye-card').isVisible(),'mobile eye status missing');await mobile.p.screenshot({path:out+'/eye-forward-mobile.png'});report.mobile={direction:m.eyeLookDirection,heightM:Number(m.eyeHeightM),error:Number(m.eyeLookDirectionError)};await mobile.c.close();
 check(!report.errors.length,'page errors');report.passed=!report.failures.length;
}catch(e){report.failures.push(String(e.stack));}
finally{await writeFile(out+'/eye-look-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
if(!report.passed)process.exitCode=1;
