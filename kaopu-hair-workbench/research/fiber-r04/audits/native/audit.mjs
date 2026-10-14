import {chromium} from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
const url=process.env.PUBLIC_URL,source=process.env.RUNTIME_SOURCE;
if(!url||!source)throw Error('Fixed public URL and runtime source required');
const results=[],errors=[],timings=[];fs.mkdirSync('audits/native',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1100,height:820},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,pass,info={})=>{results.push({name,pass,...info});console.log(pass?'PASS':'FAIL',name,JSON.stringify(info).slice(0,1500));if(!pass)throw Error(name);};
const snap=()=>page.evaluate(()=>HAIR_LAB.snapshot());
async function capture(name){const d=await page.evaluate(()=>HAIR_LAB.capture());const b=Buffer.from(d.split(',')[1],'base64');fs.writeFileSync(`audits/native/${name}.png`,b);const crop=await page.evaluate(()=>{const c=document.querySelector('canvas'),a=document.createElement('canvas');a.width=210;a.height=330;a.getContext('2d').drawImage(c,c.width*.31,0,c.width*.38,c.height,0,0,210,330);return a.toDataURL('image/jpeg',.5).split(',')[1];});fs.writeFileSync(`audits/native/${name}.base64.txt`,crop+'\n');return crypto.createHash('sha256').update(b).digest('hex');}
async function settled(){await page.waitForFunction(()=>{const s=HAIR_LAB.snapshot();return s.completed>=1&&s.completedRevision===s.revision;},null,{timeout:180000});}
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.HAIR_LAB?.snapshot().completed>=1,null,{timeout:180000});
 check('exact fixed runtime',(await snap()).source===source);
 await page.evaluate(()=>HAIR_LAB.setManual(true));
 for(const samples of[81,21,81,21]){
  await page.evaluate(n=>{HAIR_LAB.resetDynamics();HAIR_LAB.setOpticalSamples(n);HAIR_LAB.setCamera({yaw:.12,pitch:.035,distance:.66,target:[0,-.002,0]});},samples);
  let s=await page.evaluate(()=>HAIR_LAB.renderFrame());
  await page.evaluate(()=>HAIR_LAB.setCamera({yaw:.19}));
  s=await page.evaluate(()=>HAIR_LAB.renderFrame());
  timings.push({samples,wallMS:s.completedFrameWallMS.at(-1),cpuGuideMS:s.guideMotion.cpuMS,width:s.width,height:s.height});
 }
 await page.evaluate(()=>{HAIR_LAB.resetDynamics();HAIR_LAB.setCamera({yaw:.12,pitch:.035,distance:.66,target:[0,-.002,0]});HAIR_LAB.setOpticalSamples(21);});await page.evaluate(()=>HAIR_LAB.renderFrame());
 await page.evaluate(()=>HAIR_LAB.setManual(false));
 await page.click('#brushMotion');
 const box=await page.locator('canvas').boundingBox();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.55);await page.mouse.down();
 await page.mouse.move(box.x+box.width*.5+14,box.y+box.height*.55-5,{steps:1});
 await page.waitForFunction(()=>{const s=HAIR_LAB.snapshot();return s.renderedGuideState?.maxOffset>.002&&s.completedRevision>=2;},null,{timeout:180000});
 await page.evaluate(()=>HAIR_LAB.setManual(true));
 const held=await snap();
 check('native local brush produces bounded guide motion',held.guideMotion.maxOffset>.002&&held.guideMotion.maxOffset<=.035001,{guideMotion:held.guideMotion,renderedGuideState:held.renderedGuideState});
 const heldHash=await capture('native-brush-held');
 await page.mouse.up();
 await page.evaluate(()=>{HAIR_LAB.setManual(false);HAIR_LAB.setWindEnabled(false);});
 await page.waitForFunction(()=>HAIR_LAB.snapshot().guideMotion.maxOffset<.0001,null,{timeout:180000});await settled();
 const released=await snap(),releaseHash=await capture('native-brush-released');
 check('native release returns to rest without fixed motion clip',released.guideMotion.maxOffset<.0001&&heldHash!==releaseHash,{guideMotion:released.guideMotion});
 await page.click('#brushMotion');
 await page.click('#windMotion');const start=await snap();
 await page.waitForFunction(n=>HAIR_LAB.snapshot().seq>=n+2,start.seq,{timeout:180000});
 await page.click('#pauseMotion');await page.evaluate(()=>HAIR_LAB.setManual(true));
 const wind=await snap();
 check('native wind button drives hair rather than camera',wind.guideMotion.windEnabled&&wind.guideMotion.maxOffset>.0001&&wind.camera.yaw===start.camera.yaw,{guideMotion:wind.guideMotion,frameWallMS:wind.completedFrameWallMS.slice(-4)});
 await capture('native-wind');
 await page.click('#resetMotion');await page.evaluate(()=>HAIR_LAB.renderFrame());const reset=await snap();
 check('native static reset restores exact root recipe',reset.guideMotion.maxOffset===0&&reset.signature==='eaadb8b8');
 check('no runtime errors',errors.length===0&&reset.errors.length===0,{errors});
 fs.writeFileSync('audits/native/REPORT.json',JSON.stringify({url,source,results,timings,errors,final:reset,limits:['SwiftShader timings, not physical GPU FPS','Fixed-step spring motion, not elastic rod or contacts','No cinematic acceptance claimed']},null,2));
}catch(e){fs.writeFileSync('audits/native/REPORT.json',JSON.stringify({url,source,results,timings,errors,failure:String(e),snapshot:await snap().catch(()=>null)},null,2));throw e;}finally{await browser.close();}
