const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(process.argv[2]||'.'),out=path.join(root,'qa');fs.mkdirSync(out,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report={sourceCommit:process.env.GITHUB_SHA||null,renderer:'Chromium / ANGLE SwiftShader software',physicalGpu:false,physicalMobile:false,tests:[],passed:false,standaloneSha256:hash(path.join(root,'spirit-r03-connected-wind.html'))};
const check=(condition,message)=>{if(!condition)throw Error(message)};
const field=async(page,id,v)=>{await page.locator('#'+id).evaluate((e,value)=>{e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));},v);};
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [name,width,height] of [['desktop',1440,900],['mobile-viewport',390,844]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:name.startsWith('mobile'),hasTouch:name.startsWith('mobile')});const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.route(/^https?:/,r=>r.abort());
  const uri='file://'+path.join(root,'spirit-r03-connected-wind.html');await page.goto(uri,{waitUntil:'load'});await page.waitForFunction(()=>window.__native3dR03Ready===true,{timeout:60000});await page.waitForTimeout(400);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow '+name);
  const initial=await page.evaluate(()=>SpiritR03Study.getState());await page.screenshot({path:path.join(out,name+'-default.png'),fullPage:true});
  const canvasSize=await page.locator('canvas').evaluate(c=>({w:c.width,h:c.height}));check(canvasSize.w>100&&canvasSize.h>100,'No canvas');
  await page.click('#windPlay');const pauseTime=await page.evaluate(()=>SpiritR03Study.getState().motion.time);await page.waitForTimeout(180);check((await page.evaluate(()=>SpiritR03Study.getState().motion.time))===pauseTime,'Pause did not stop time');
  await field(page,'windTime',8);await field(page,'windStrength',1.5);await page.click('#restOverlay');await page.click('#localFrames');await page.click('#windField');await page.waitForTimeout(100);
  await page.screenshot({path:path.join(out,name+'-wind-structure.png'),fullPage:true});
  for(const id of ['localFrames','windField','restOverlay','front','side','fit','windOn','windOn','windReset','windPlay','windPlay'])await page.click('#'+id);
  await page.locator('#plantSeed').fill('42');await page.click('#applySeed');await page.waitForTimeout(100);
  check((await page.evaluate(()=>SpiritR03Study.getState().identity.topologyHash))!==initial.identity.topologyHash,'Seed did not change identity');
  await page.click('#originalSeed');check((await page.evaluate(()=>SpiritR03Study.getState().identity.topologyHash))===initial.identity.topologyHash,'Seed restoration failed');
  check(await page.locator('#originalSeed').innerText()==='恢复原始种子','Seed button semantic mismatch');
  const state=await page.evaluate(()=>SpiritR03Study.getState());check(state.metrics.connectionError<1e-10&&state.metrics.lengthError<1e-10&&state.metrics.rootError===0,'Pose constraints');
  check(errors.length===0,'Console errors '+JSON.stringify(errors));check(requests.length===0,'External core requests');
  report.tests.push({name,width,height,errors,requiredNetworkRequests:requests.length,initial,state,canvasSize,controlsPassed:true});
  await context.close();
 }
 // Frozen baseline and zero-wind candidate, same viewport, stage size and camera.
 const ctx=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1});const images=[];
 for(const file of ['baseline-standalone.html','spirit-r03-connected-wind.html']){
  const page=await ctx.newPage();await page.route(/^https?:/,r=>r.abort());await page.goto('file://'+path.join(root,file),{waitUntil:'load'});await page.waitForFunction(()=>window.__native3dR03Ready===true,{timeout:60000});
  await page.addStyleTag({content:'.wrap,.stage{height:900px!important;min-height:900px!important}.panel{height:900px!important;overflow:hidden!important}.bar,.caption,.info,.badges{visibility:hidden!important}'});
  if(file.startsWith('spirit'))await page.evaluate(()=>{document.getElementById('windOn').click();});
  await page.evaluate(()=>{dispatchEvent(new Event('resize'));Native3DFractalR03.fit();});await page.waitForTimeout(400);
  const image=path.join(out,file.startsWith('baseline')?'baseline-zero.png':'candidate-zero.png');await page.locator('canvas').screenshot({path:image});images.push(image);await page.close();
 }
 report.zeroWindPixelHashes=images.map(hash);check(report.zeroWindPixelHashes[0]===report.zeroWindPixelHashes[1],'Zero wind pixel AB differs');await ctx.close();report.passed=true;
 }catch(e){report.failure=String(e.stack||e);}finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'BROWSER_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}if(!report.passed)process.exit(1);
})();
