'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const base=path.resolve(__dirname,'..');
const out=process.env.NPC_OWNERSHIP_OUT||'/tmp/npc-host-ownership';
const url=process.env.PREVIEW_URL||pathToFileURL(path.join(base,'preview.html')).href;
const build=JSON.parse(fs.readFileSync(path.join(base,'BUILD.json')));
const report={schema:'kaopu/npc-host-ownership-browser@1',sourceHead:process.env.GITHUB_SHA||null,url,previewSHA256:build.previewSHA256,passed:false,checks:[],pageErrors:[],consoleErrors:[],visualAcceptance:false,productionReady:false};
fs.mkdirSync(out,{recursive:true});
const save=()=>fs.writeFileSync(path.join(out,'ownership.json'),JSON.stringify(report,null,2)+'\n');
const check=(name,fn)=>{fn();report.checks.push({name,passed:true});save();};
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>report.pageErrors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 const started=Date.now();
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:200000});
  if(url.startsWith('https:')){
   assert.equal(response.status(),200);
   report.observedPreviewSHA256=crypto.createHash('sha256').update(await response.body()).digest('hex');
   assert.equal(report.observedPreviewSHA256,build.previewSHA256);
  }
  await page.waitForFunction(()=>window.__NPC_OBSERVATION__?.ready||window.__NPC_BOOT__?.snapshot().status==='failed',null,{timeout:200000});
  report.boot=await page.evaluate(()=>window.__NPC_BOOT__?.snapshot());
  check('bounded complete native startup',()=>{assert.equal(report.boot.status,'ready');assert(Date.now()-started<=200000);});
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('npc-pause').textContent==='继续',null,{timeout:45000});
  report.frame=await page.evaluate(()=>window.__NPC_OBSERVATION__.awaitFrame({fresh:true}));
  async function ownership(){return page.evaluate(()=>{
   const viewer=window.__IDENTITY_QA__.viewer();
   return {receipt:window.__NPC_HOST_AUTHORITY__||null,nativeControllerAbsent:window.fullCommonWorkbench.motion()===null,
    nativePanelCount:document.querySelectorAll('.motion-studio').length,
    nativeControlsCount:document.querySelectorAll('[id^="motion-"]').length,
    legacySceneRootAbsent:!viewer.scene.getObjectByName('existing-human-motion-modes'),
    retainedOriginalHidden:viewer.mesh.visible===false,npcReady:window.__NPC_OBSERVATION__.ready,
    errors:window.__NPC_OBSERVATION__.errors};
  });}
  function assertOwnership(s){assert.equal(s.receipt?.owner,'npc-life-observation');assert.equal(s.receipt?.legacyMotionController,'not-created');assert.equal(s.nativeControllerAbsent,true);assert.equal(s.nativePanelCount,0);assert.equal(s.nativeControlsCount,0);assert.equal(s.legacySceneRootAbsent,true);assert.equal(s.retainedOriginalHidden,true);assert.equal(s.npcReady,true);assert.deepEqual(s.errors,[]);}
  report.desktop=await ownership();check('no second controller, RAF owner, controls or scene root',()=>assertOwnership(report.desktop));
  await page.screenshot({path:path.join(out,'desktop.png')});
  await page.getByRole('button',{name:'B 矮壮 原生身体 / P02',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('npc-pick').textContent==='B 拿放',null,{timeout:45000});
  await page.evaluate(()=>window.__NPC_OBSERVATION__.awaitFrame({fresh:true}));
  report.afterActorSwitch=await ownership();check('native generator and actor switching preserved',()=>assertOwnership(report.afterActorSwitch));
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.__NPC_OBSERVATION__.awaitFrame({fresh:true}));
  report.mobileViewport=await ownership();check('390 by 844 viewport does not resurrect legacy controls',()=>assertOwnership(report.mobileViewport));
  await page.screenshot({path:path.join(out,'mobile-viewport.png')});
  check('no page or console errors',()=>{assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.consoleErrors,[]);});
  report.passed=true;report.elapsedMS=Date.now()-started;save();
  console.log(JSON.stringify({passed:true,sourceHead:report.sourceHead,checks:report.checks.length,elapsedMS:report.elapsedMS,url}));
 }catch(e){report.error=e.stack;save();try{await page.screenshot({path:path.join(out,'failure.png')});}catch(_){}throw e;}
 finally{await browser.close();}
}
main().catch(e=>{report.error=e.stack;save();console.error(e);process.exitCode=1;});
