const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const P=path.resolve(__dirname,'..'),Q=path.join(P,'qa'),base=process.argv[2]||'http://127.0.0.1:8766/preview.html';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],hostErrors=[],records=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'){const x={text:m.text(),url:m.location().url};if(x.url==='https://htmlpreview.github.io/favicon.ico')hostErrors.push(x);else errors.push(x);}});
  await page.goto(base,{waitUntil:'load',timeout:90000});await page.waitForFunction(()=>window.HAIR_LAB?.snapshot().firstFrameMS>0,null,{timeout:120000});await page.evaluate(()=>HAIR_LAB.setManual(true));
  async function shot(name,fn){if(fn)await page.evaluate(fn);await page.evaluate(()=>HAIR_LAB.renderFrame());await page.screenshot({path:path.join(Q,name+'.png')});records.push({name,state:await page.evaluate(()=>HAIR_LAB.snapshot())});console.log('Captured',name);}
  for(const style of ['medium','long']){
   await page.evaluate(v=>HAIR_LAB.setStyle(v),style);await shot(style+'-full');
   await shot(style+'-macro',()=>document.getElementById('macro').click());
   await shot(style+'-side',()=>document.getElementById('sideView').click());
   await shot(style+'-black',()=>{document.getElementById('full').click();HAIR_LAB.setParam('material','black');});
   await shot(style+'-backlight',()=>{HAIR_LAB.setParam('material','chestnut');HAIR_LAB.setParam('lighting','back');});
   await shot(style+'-weights',()=>{HAIR_LAB.setParam('lighting','studio');document.getElementById('weightsView').click();});
   await shot(style+'-loose',()=>{document.getElementById('weightsView').click();HAIR_LAB.setWeights(.1,.1);});
   await shot(style+'-silky',()=>HAIR_LAB.setWeights(.88,.60));
   await page.evaluate(()=>{HAIR_LAB.resetDynamics();HAIR_LAB.setSway(true);});
   const dir=path.join(Q,'motion-'+style);fs.mkdirSync(dir,{recursive:true});
   for(let i=0;i<60;i++){
    await page.evaluate(()=>{HAIR_LAB.stepDynamics(1/24);});await page.evaluate(()=>HAIR_LAB.renderFrame());
    const data=await page.evaluate(()=>HAIR_LAB.capture());fs.writeFileSync(path.join(dir,String(i).padStart(3,'0')+'.png'),Buffer.from(data.split(',')[1],'base64'));
   }
   await shot(style+'-sway');await page.evaluate(()=>HAIR_LAB.resetDynamics());
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);await shot('mobile');
  fs.writeFileSync(path.join(Q,'browser-report.json'),JSON.stringify({passed:errors.length===0,url:base,desktopMouseControlled:false,sourceHashes:JSON.parse(fs.readFileSync(path.join(P,'BUILD_MANIFEST.json'))).files,errors,hostErrors,records},null,2));
  if(errors.length)throw Error(JSON.stringify(errors));console.log('Actual rendering and motion captures passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
