const{chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),fs=require('fs');
(async()=>{const report={errors:[],cases:[]},browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:1600,height:1150}});page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(e.message));try{
 await page.goto('http://127.0.0.1:8897/MP05-Continuous-Demand-R01/r09-board/');await page.waitForFunction(()=>window.__MP05__?.audit().ready&&window.GarmentBoard);
 for(const bottom of(process.argv[2]?[process.argv[2]]:['P01','P02','P04'])){
  await page.evaluate(bottom=>__MP05__.compose({topPattern:'T03',bottomPattern:bottom,topMaterial:'denim-bleach',bottomMaterial:'denim-bleach'}),bottom);
  for(const motion of(process.argv[3]?[process.argv[3]]:['walk','run','jump'])){
   await page.evaluate(async motion=>{const p=__MP05__.debug().physics;__MP05__.pause();await p.idle();await p.reset();await p.command('motion',{motion});},motion);
   for(const frame of[15,30,45,60].filter(f=>f<=Number(process.argv[4]||60))){
    const row=await page.evaluate(async()=>{const d=__MP05__.debug();for(let i=0;i<15;i++)await d.physics.command('step');await d.physics.command('seam-audit');return{regions:d.physics.frame.audit.seamRegionValidation,pipeline:d.physics.frame.audit.pipeline,solverMS:d.physics.frame.audit.solverMs,GL:d.viewer.renderer.getContext().getError(),safetyTrips:d.physics.frame.audit.safetyTrips};});report.cases.push({bottom,motion,frame,...row});
    if(bottom==='P02'&&motion==='run'&&frame===15){await page.evaluate(()=>__MP05__.frame('bottom','front'));await page.locator('#canvas').screenshot({path:__dirname+'/R09_crotch_front.png'});await page.evaluate(()=>__MP05__.frame('bottom','side'));await page.locator('#canvas').screenshot({path:__dirname+'/R09_crotch_side.png'});await page.evaluate(()=>__MP05__.frame('bottom','rear'));await page.locator('#canvas').screenshot({path:__dirname+'/R09_crotch_rear.png'});}
   }
   console.log('SWEEP',bottom,motion,JSON.stringify(report.cases.filter(r=>r.bottom===bottom&&r.motion===motion).map(r=>({frame:r.frame,seam:r.regions[1].sewnBoundary.continuousSpanMaxMM,vertex:r.regions[1].minBodyVertexDistanceMM,triangle:r.regions[1].minBodyTriangleCentroidDistanceMM}))));
  }
 }
 }catch(e){report.failure=e.stack;console.error(e);}finally{fs.writeFileSync(__dirname+'/r09-crotch-sweep.json',JSON.stringify(report,null,2));await browser.close();}})();
