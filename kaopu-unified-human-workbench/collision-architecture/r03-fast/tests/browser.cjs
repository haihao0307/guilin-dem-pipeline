const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const url=process.env.FAST_SURFACE_URL||'http://127.0.0.1:8765/collision-architecture/r03-fast/';
const out=process.env.FAST_QA_OUT||path.join(__dirname,'browser-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const options={headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.CHROMIUM_PATH)options.executablePath=process.env.CHROMIUM_PATH;
 const browser=await chromium.launch(options),page=await browser.newPage({viewport:{width:1460,height:1100}}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.stack));
 try{
  await page.goto(url);await page.waitForFunction(()=>!!window.fastSurfaceDemo);await page.click('#start');
  await page.waitForFunction(()=>fastSurfaceDemo.diagnostics().ready||fastSurfaceDemo.diagnostics().errors.length,null,{timeout:300000});assert.ok((await page.evaluate(()=>fastSurfaceDemo.diagnostics())).ready,'Actual assets must load');
  for(const preset of [16,12,35]){
   if(preset!==16){await page.evaluate(index=>fastSurfaceDemo.setPreset(index),preset);await page.waitForFunction(()=>fastSurfaceDemo.diagnostics().ready,null,{timeout:300000});}
   for(const pose of [0,.55,1.1]){
    await page.evaluate(t=>fastSurfaceDemo.setPose(t),pose);const result=await page.evaluate(()=>fastSurfaceDemo.validate());assert.ok(result.passed);assert.equal(result.rows.length,4);assert.equal(result.geometry.vertices,25417);assert.equal(result.geometry.weightsTruncated,false);assert.deepEqual(result.geometry.gloveTriangles,[770,770]);
    for(const row of result.rows){assert.equal(row.comparison.matched,true);assert.deepEqual(row.oracle.hit,row.fast.hit);assert.equal(row.oracle.trianglePairs,row.fast.trianglePairs);assert.equal(row.oracle.unresolved,row.fast.unresolved);assert.equal(row.fast.unresolved,false);assert.ok(row.fast.hit);assert.ok(row.fastTotalMs>=row.fastQueryMs);if(row.cache==='warm')assert.equal(row.fastPreparationMs,0);}
    cases.push(result);
    if(preset===16&&pose===0){await page.evaluate(()=>{fastSurfaceDemo.showContact('body');fastSurfaceDemo.overview();});await page.screenshot({path:path.join(out,'overview.png')});await page.evaluate(()=>{fastSurfaceDemo.showContact('guard');fastSurfaceDemo.focusContact();});await page.screenshot({path:path.join(out,'contact.png')});}
    await page.evaluate(()=>fastSurfaceDemo.clear());assert.equal((await page.evaluate(()=>fastSurfaceDemo.diagnostics())).lastResult,null);
   }
  }
  // Repeated validation after returning to a prior case must retain exact hits.
  await page.evaluate(()=>fastSurfaceDemo.setPose(1.1));const repeat=await page.evaluate(()=>fastSurfaceDemo.validate());assert.deepEqual(repeat.rows.map(r=>r.fast.hit),cases.at(-1).rows.map(r=>r.fast.hit));
  assert.deepEqual(errors,[]);const diagnostics=await page.evaluate(()=>fastSurfaceDemo.diagnostics());
  fs.writeFileSync(path.join(out,'BROWSER-VALIDATION.json'),JSON.stringify({schema:'r03-fast-browser-actual-fixtures/1',passed:true,url,cases,caseCount:cases.length,comparisonCount:cases.length*4,repeatExact:true,resetClearsContact:true,screenshots:['overview.png','contact.png'],renderer:diagnostics.renderer,errors,limits:'Single diagnostic. No 18-arena real-time claim. SwiftShader/headless if launched with defaults; not user hardware FPS.'},null,2));
 }catch(error){fs.writeFileSync(path.join(out,'BROWSER-FAILURE.json'),JSON.stringify({message:error.stack,errors,cases,diagnostics:await page.evaluate(()=>window.fastSurfaceDemo?.diagnostics()).catch(()=>null)},null,2));throw error;}
 finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
