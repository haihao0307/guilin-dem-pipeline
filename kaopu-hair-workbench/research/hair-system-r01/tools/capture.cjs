const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(process.argv[2]||'http://127.0.0.1:8765/',{waitUntil:'load',timeout:90000});
  await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:180000});
  await page.evaluate(()=>HAIR_LAB.setManual(true));
  const records=[];
  async function frame(name,fn){if(fn)await page.evaluate(fn);await page.evaluate(()=>HAIR_LAB.renderFrame());await page.screenshot({path:path.join(out,name+'.png')});records.push({name,snapshot:await page.evaluate(()=>HAIR_LAB.snapshot())});console.log('Captured',name);}
  await frame('hair-full');
  await frame('hair-macro',()=>document.getElementById('macro').click());
  await frame('hair-backlight',()=>{document.getElementById('full').click();HAIR_LAB.setParam('lighting','back');});
  await frame('hair-black',()=>{HAIR_LAB.setParam('lighting','studio');HAIR_LAB.setParam('material','black');});
  await frame('hair-moved',()=>{HAIR_LAB.setParam('material','chestnut');HAIR_LAB.impulse();for(let n=0;n<45;n++)HAIR_LAB.stepDynamics(1/120);});
  await page.evaluate(()=>{HAIR_LAB.resetDynamics();document.getElementById('full').click();});await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(150);await frame('mobile');
  fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({url:page.url(),desktopMouseControlled:false,errors,records},null,2));
  if(errors.length)throw Error(errors.join('\n'));console.log('Actual WebGL captures complete; no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
