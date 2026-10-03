// R10 checks exact inherited samples before testing new inspection facilities.
const {chromium}=require('playwright');const fs=require('fs');const crypto=require('crypto');
const phase=process.argv[2]||'local';const root='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/';
const url=phase==='local'?'http://127.0.0.1:8793/index.html?case=iq':root+'?case=iq&v=r10';
const report={version:'R10',phase,url,environment:'Chromium + ANGLE SwiftShader',checks:{},errors:[],limits:['Mobile uses a 390px viewport, not physical phone hardware.','Not a user-GPU performance benchmark or a claim of photographic perfection.']};
fs.mkdirSync('evidence',{recursive:true});const assert=(v,m)=>{if(!v)throw Error(m);};const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function stable(p){await p.waitForTimeout(220);await p.evaluate(()=>KAOPU9.draw());}
async function pixels(p){return await p.evaluate(()=>KAOPU9.pixels());}
function difference(a,b){assert(a.length===b.length,'pixel dimensions differ');let changed=0,max=0,total=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){changed++;max=Math.max(max,d);total+=d;}}return {changed,max,mean:total/a.length};}
async function hash(p){const a=await pixels(p);return crypto.createHash('sha256').update(Buffer.from(a)).digest('hex');}
async function input(p,path,v){await p.locator(`[data-path="${path}"]`).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},String(v));await stable(p);}
(async()=>{
 if(phase==='public'){
  const expected=JSON.parse(fs.readFileSync('r10_build/release.json')).publicIndexSHA256;let last;
  for(let i=0;i<75;i++){try{const r=await fetch(root+'?v=r10&probe='+Date.now(),{signal:AbortSignal.timeout(20000)});const text=await r.text();const h=crypto.createHash('sha256').update(text).digest('hex');last={status:r.status,sha:h};if(r.status===200&&h===expected)break;}catch(e){last={error:e.message};}await pause(12000);}
  assert(last.status===200&&last.sha===expected,'public R10 not yet visible '+JSON.stringify(last));report.publicIndex=last;
  report.resources={};for(const n of ['app.js','ui.css','iq-merged.frag','wet-material.frag','iq-baseline.frag','wet-material-baseline.frag','wet-baseline.frag']){const r=await fetch(root+'lab-r10/'+n+'?v=r10');const b=Buffer.from(await r.arrayBuffer()),expected=fs.readFileSync('r10_build/'+n);assert(r.status===200&&b.equals(expected),'public resource mismatch '+n);report.resources[n]=crypto.createHash('sha256').update(b).digest('hex');}
 }
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:1600,height:1050},deviceScaleFactor:1});p.setDefaultTimeout(90000);p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(url,{waitUntil:'load',timeout:90000});await p.waitForFunction(()=>window.KAOPU10?.ready);await stable(p);
  assert(await p.locator('iframe').count()===0,'iframe found');report.checks.native3D=true;
  assert((await p.evaluate(()=>KAOPU9.getRig())).enabled,'shared rig disabled at launch');assert((await p.evaluate(()=>KAOPU9.getRig().background)).some(v=>v>0.02),'background still black');report.checks.sharedRigAndGreyDefault=true;
  const native=await p.locator('#resultCanvas').evaluate(c=>[c.width,c.height,c.clientWidth,c.clientHeight]);assert(native[0]>=native[2],'canvas upscaled beyond its rendered pixels');report.checks.nativePixels=native;
  await p.screenshot({path:`evidence/${phase}_iq.png`});
  if(phase==='local'){
   const old=await browser.newPage({viewport:{width:1600,height:1050}});old.setDefaultTimeout(90000);await old.goto('http://127.0.0.1:8793/original/index.html?case=iq');await old.waitForFunction(()=>window.KAOPU9?.ready);
   report.checks.originalRegression={};
   for(const id of ['iq','wet']){
    await old.evaluate(id=>{KAOPU9.select(id,false);KAOPU9.reset();KAOPU9.setResolution(960);KAOPU9.stop();},id);
    await p.evaluate(id=>{KAOPU9.select(id,false);KAOPU9.reset();KAOPU9.legacy();KAOPU9.setResolution(960);KAOPU9.stop();},id);await stable(old);await stable(p);
    const d=difference(await pixels(old),await pixels(p));report.checks.originalRegression[id]=d;assert(d.max<=1&&d.changed<300,'old shape/material regression failed '+id+' '+JSON.stringify(d));
   }await old.close();
  }
  await p.evaluate(()=>{KAOPU9.select('iq',false);KAOPU9.reset();KAOPU9.setQuality({hd:true,mode:'auto',samples:1});KAOPU9.setRig({enabled:true,background:[.058,.064,.073],look:0});KAOPU9.setResolution(640);});await stable(p);
  report.checks.parameters={};
  // Independent layers change surface, not geometry. Shared UI keeps parameters exposed without losing state.
  await p.locator('[data-tab="layers"]').click();assert(await p.locator('#layersPanel').isVisible(),'layer panel not visible');
  const before=await hash(p);await p.locator('[data-path="layers.0.on"]').check();await stable(p);assert((await hash(p))!==before,'layer toggle has no effect');
  await input(p,'layers.0.strength',.64);await input(p,'layers.0.seed',11);
  const saved=await p.evaluate(()=>KAOPU9.getState().iq.layers[0]);await p.locator('[data-tab="shape"]').click();await p.locator('[data-tab="layers"]').click();assert(JSON.stringify(saved)===JSON.stringify(await p.evaluate(()=>KAOPU9.getState().iq.layers[0])),'parameters lost when changing tabs');
  const seedbefore=await hash(p);await input(p,'layers.0.seed',23);assert((await hash(p))!==seedbefore,'layer seed not applied');
  await p.locator('#layer2 [data-mask]').click();await stable(p);await p.locator('#returnMaterial').click();assert((await p.evaluate(()=>KAOPU9.getState().iq.view))===0,'diagnostic channel did not return');report.checks.parameters.layerTabIndependentAndPersistent=true;
  // Color-only changes must not distort the actual field.
  await p.evaluate(()=>{KAOPU9.setValues({view:1});});await stable(p);const clay=await hash(p);
  await p.locator('[data-tab="color"]').click();await p.locator('[data-palette="7"]').click();await stable(p);assert((await hash(p))===clay,'color changed geometry');report.checks.colorKeepsGeometry=true;
  await p.evaluate(()=>KAOPU9.setValues({view:0}));await p.locator('#darkLook').click();await stable(p);assert((await p.evaluate(()=>KAOPU9.getState().iq.look))===1,'old blue-grey look missing');assert((await p.evaluate(()=>KAOPU9.getRig().look))===1,'blue light rig not applied');report.checks.originalBlueLook=true;
  await p.locator('[data-tab="shape"]').click();const sh=await hash(p);await p.locator('[data-seed="11"]').click();await stable(p);assert((await hash(p))!==sh,'shape seed not applied');await p.locator('#resetShape').click();await stable(p);assert((await hash(p))===sh,'original shape seed did not restore');report.checks.shapeSeedRestores=true;
  await p.evaluate(()=>KAOPU9.setLayer(0,{on:true,seed:23}));const remember=await p.evaluate(()=>KAOPU9.getState().iq.layers[0].seed);await p.evaluate(()=>{KAOPU9.select('wet',false);KAOPU9.select('iq',false);});assert((await p.evaluate(()=>KAOPU9.getState().iq.layers[0].seed))===remember,'case navigation dropped parameters');report.checks.navigationPreserves=true;
  await p.evaluate(()=>{KAOPU9.select('iq',false);KAOPU9.setResolution(640);});await stable(p);const zoomBefore=await hash(p);await p.locator('[data-pane="result"][data-act="in"]').click();await stable(p);assert(await hash(p)!==zoomBefore,'zoom is not redrawn');report.checks.zoomRecomputes=true;
  await p.evaluate(()=>{KAOPU9.action('result','reset');KAOPU9.setQuality({mode:'1920',hd:true,samples:1});});await stable(p);assert((await p.locator('#resultCanvas').evaluate(c=>c.width))===1920,'1080p setting did not reach actual buffer');report.checks.HD1920=true;
  if(phase==='local'){
   await p.evaluate(()=>KAOPU9.setQuality({mode:'1920',hd:true,samples:2}));await stable(p);report.checks.fourRayAA=await p.evaluate(()=>KAOPU9.quality().samples===2);
   await p.screenshot({path:'evidence/local_hq_four_samples.png'});
   await p.evaluate(()=>KAOPU9.setQuality({mode:'2560',hd:true,samples:1}));await stable(p);report.checks.HD2560=await p.locator('#resultCanvas').evaluate(c=>c.width===2560);
  }
  await p.evaluate(()=>{KAOPU9.setQuality({mode:'auto',samples:1,hd:true});KAOPU9.select('wet',false);});await stable(p);assert((await p.evaluate(()=>KAOPU9.getRig())).enabled,'01 not using common rig');await p.screenshot({path:`evidence/${phase}_wet.png`});report.checks.wetSharedLight=true;
  await p.locator('[data-tab="color"]').click();assert(await p.locator('#palettes button').count()===10,'ten colors missing');await p.locator('[data-effect="forest"]').click();await stable(p);report.checks.tenColorsAndMoss=true;
  await p.evaluate(()=>{KAOPU9.select('iq',false);KAOPU9.reset();KAOPU9.chooseLook(true);});await stable(p);await p.screenshot({path:`evidence/${phase}_blue.png`});
  report.glErrors=await p.evaluate(()=>KAOPU9.glErrors());assert(report.glErrors.every(x=>x===0),'GL error');assert(report.errors.length===0,'JS error '+report.errors.join(';'));
  await p.setViewportSize({width:390,height:844});await stable(p);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');await p.locator('[data-tab="layers"]').click();assert(await p.locator('#layersPanel').isVisible(),'mobile controls unavailable');report.mobile={viewport:[390,844],physicalDevice:false,noOverflow:true,layerControls:true};await p.screenshot({path:`evidence/${phase}_mobile.png`});
  report.passed=true;report.browserPassed=true;report.shareAllowed=phase==='public';
 }finally{await browser.close();}
})().catch(e=>{report.failure=e.stack;report.passed=false;report.shareAllowed=false;process.exitCode=1;}).finally(()=>{report.checkedAt=new Date().toISOString();fs.writeFileSync(phase==='public'?'evidence/PUBLICATION_PROOF.json':'evidence/LOCAL_PROOF.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
