'use strict';
// Diagnostic interception only. Never changes production quality or runtime files.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {compare}=require('./png-audit.cjs');
const repo=path.resolve(__dirname,'../../../../..'),game=path.resolve(__dirname,'..');
const variants=[
 {id:'baseline',purpose:'Unchanged R20 scene, materials, geometry and production shadow cadence.'},
 {id:'no-shadows',purpose:'Disable shadow-map generation and shadow sampling; retain production surface and lighting.'},
 {id:'flat-unlit',purpose:'Whole-scene MeshBasicMaterial override, shadows disabled; diagnostic geometry/raster floor, not final quality.'},
 {id:'lit-no-noise',purpose:'Street-only procedural color, roughness, metalness and bump terms removed; original base parameters and MeshStandard lighting remain.'},
 {id:'constant-table',purpose:'Diagnostic only: always select appearance row zero; intentionally changes appearances to test dynamic-index sensitivity.'},
 {id:'vertex-table',purpose:'Move five indexed appearance-table reads to vertex stage and pass five flat vec4 values; preserve formulas, per-triangle appearance and geometry.'},
];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const stats=a=>{const s=a.slice().sort((a,b)=>a-b);return{n:s.length,median:s[Math.floor(s.length*.5)],p95:s[Math.min(s.length-1,Math.floor(s.length*.95))],min:s[0],max:s.at(-1)}};
function once(source,from,to){assert.equal(source.split(from).length-1,1,'Expected one diagnostic hook: '+from);return source.replace(from,to);}
function vertexTableShaderPatch(shader){
 const count=24,decl=[],vary=[];
 for(let i=0;i<5;i++){
  const d='uniform vec4 stTable'+i+'['+count+'];',v='flat varying vec4 vStPacked'+i+';';
  if(!shader.fragmentShader.includes(d))throw Error('Missing vertex-table declaration '+d);
  shader.fragmentShader=shader.fragmentShader.replace(d,v);decl.push(d);vary.push(v);
  const lookup='vec4 stPacked'+i+'=stTable'+i+'[stMaterialIndex];';
  if(!shader.fragmentShader.includes(lookup))throw Error('Missing fragment table lookup '+i);
  shader.fragmentShader=shader.fragmentShader.replace(lookup,'vec4 stPacked'+i+'=vStPacked'+i+';');
 }
 shader.vertexShader=decl.join('\n')+'\n'+vary.join('\n')+'\n'+shader.vertexShader;
 const old='vStMaterial=stMaterial;',assign=old+'\nint stVertexMaterialIndex=int(stMaterial+.5);\n'+Array.from({length:5},(_,i)=>'vStPacked'+i+'=stTable'+i+'[stVertexMaterialIndex];').join('\n');
 if(!shader.vertexShader.includes(old))throw Error('Missing vertex material assignment');
 shader.vertexShader=shader.vertexShader.replace(old,assign);
}
function patchBatchSource(source,id){
 if(id==='lit-no-noise')for(const name of ['surface','roughness','metalness','normal'])source=once(source,'SURFACE_SHADER.'+name,"''");
 if(id==='constant-table')source=once(source,'int stMaterialIndex=int(vStMaterial+.5);','int stMaterialIndex=0;');
 if(id==='vertex-table'){
  assert(source.includes('export const MATERIAL_TABLE_SIZE=24;'),'Diagnostic assumes the current 24-row table');
  const hook="shader.fragmentShader=add(shader.fragmentShader,'#include <emissivemap_fragment>','totalEmissiveRadiance=stPacked4.rgb;\\n'+SURFACE_SHADER.emissive);";
  source=once(source,hook,hook+'\n   __r20DiagnosticVertexTables(shader);');
  source+='\nconst __r20DiagnosticVertexTables='+vertexTableShaderPatch.toString()+';\n';
 }
 return source;
}
function pageFixture(){
 // Runs inside the existing app module, with access to its lexical bindings.
 window.__gpuIsolationFixture=async function(id){
  game.paused=true;const distance=350,time=12,view={...game.view(),distance,elapsed:time};
  const fixed=DEFAULT_VIEWS.landscape;camera.position.fromArray(fixed.position);cameraTarget.fromArray(fixed.target);camera.zoom=fixed.zoom;syncProjection(fixed);camera.updateProjectionMatrix();camera.lookAt(cameraTarget);camera.updateMatrixWorld(true);
  let override=null;
  if(id==='no-shadows'||id==='flat-unlit'){renderer.shadowMap.enabled=false;scene.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:o.material?[o.material]:[]))m.needsUpdate=true;});}
  if(id==='flat-unlit'){override=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide});override.name='QA-only-flat-unlit';scene.overrideMaterial=override;}
  let settleUpdates=0;const settleStart=performance.now();
  do{world.update(view,game.route,{cameraTarget:cameraTarget.toArray(),cameraPosition:camera.position.toArray()});if(++settleUpdates>30)throw Error('Diagnostic district failed to settle');}while(world.streetDistrict.proof.pending);
  if(world.streetDistrict.proof.error)throw Error(world.streetDistrict.proof.error);
  const settleMs=performance.now()-settleStart;needsRender=false;
  // This flush precedes the recorded samples and does not count as a warmup draw.
  gl.finish();const samples=[],warmups=[],pixel=new Uint8Array(4),pixelXY=[Math.floor(canvas.width/2),Math.floor(canvas.height/2)];
  const wallStart=performance.now();
  for(let i=0;i<8;i++){
   const shadowUpdate=renderer.shadowMap.enabled&&i%3===0;
   const t=performance.now();world.update(view,game.route,{cameraTarget:cameraTarget.toArray(),cameraPosition:camera.position.toArray()});const u=performance.now();
   smoke.update(time,camera,{view,emitters:world.fillSteamEmitters(steamEmitters)});
   renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=shadowUpdate;renderer.render(scene,camera);const submitted=performance.now();
   gl.finish();const finished=performance.now();gl.readPixels(pixelXY[0],pixelXY[1],1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const read=performance.now();
   const sample={iteration:i,shadowUpdate,updateMs:u-t,submissionMs:submitted-u,finishMs:finished-submitted,readbackMs:read-finished,completionMs:read-t,drawCalls:renderer.info.render.calls,submittedTriangles:renderer.info.render.triangles,pixel:Array.from(pixel)};
   (i<3?warmups:samples).push(sample);needsRender=false;await new Promise(resolve=>setTimeout(resolve,0));needsRender=false;
  }
  const street=structuredClone(world.streetDistrict.proof),batchMeshes=[];world.streetDistrict.renderBatches.root.traverse(o=>{if(o.isMesh)batchMeshes.push({name:o.name,frustumCulled:o.frustumCulled,instanced:!!o.isInstancedMesh,count:o.isInstancedMesh?o.count:null});});
  // Keep the selected diagnostic appearance for its screenshot. Context close disposes it.
  return{id,fixture:{distance,time,kind:'deterministic diagnostic placement; not native driving',clockUnmodified:game.distance===0,settleUpdates,settleMs},samples,warmups,timedLoopWallMs:performance.now()-wallStart,glError:gl.getError(),contextLost:gl.isContextLost(),readback:{x:pixelXY[0],y:pixelXY[1],width:1,height:1,format:'RGBA/UNSIGNED_BYTE'},camera:{position:camera.position.toArray(),target:cameraTarget.toArray(),fov:camera.fov,aspect:camera.aspect,projection:camera.projectionMatrix.toArray()},canvasPixels:[canvas.width,canvas.height],canvasCss:[wrap.clientWidth,wrap.clientHeight],renderRatio,devicePixelRatio,rendererName,contextAttributes:gl.getContextAttributes(),programs:renderer.info.programs.length,memory:{...renderer.info.memory},capabilities:{vertexAttributes:gl.getParameter(gl.MAX_VERTEX_ATTRIBS),varyingVectors:gl.getParameter(gl.MAX_VARYING_VECTORS),fragmentUniformVectors:gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),vertexUniformVectors:gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)},street,batchMeshes,shadowEnabled:renderer.shadowMap.enabled,overrideMaterial:override?.name||null};
 };
}
function injection(){return '\n;('+pageFixture.toString()+')();\n';}
async function verifyOnly(){
 const {spawnSync}=require('node:child_process'),source=fs.readFileSync(path.join(game,'street/batch-materials.mjs'),'utf8'),app=fs.readFileSync(path.join(game,'app.mjs'),'utf8');
 for(const v of variants){const transformed=patchBatchSource(source,v.id);const r=spawnSync(process.execPath,['--check','--input-type=module'],{input:transformed,encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
 const a=spawnSync(process.execPath,['--check','--input-type=module'],{input:app+injection(),encoding:'utf8'});assert.equal(a.status,0,a.stderr);
 // Exercise the shader rewrite directly, without a browser or mocked rendering.
 const shader={vertexShader:'vStMaterial=stMaterial;',fragmentShader:Array.from({length:5},(_,i)=>'uniform vec4 stTable'+i+'[24];\nvec4 stPacked'+i+'=stTable'+i+'[stMaterialIndex];').join('\n')};vertexTableShaderPatch(shader);assert.equal((shader.vertexShader.match(/stTable\d\[stVertexMaterialIndex\]/g)||[]).length,5);assert(!/stTable\d\[stMaterialIndex\]/.test(shader.fragmentShader));
 const {pathToFileURL}=require('node:url'),threeUrl=pathToFileURL(path.resolve(game,'../../vendor/three.module.js')).href,materialsUrl=pathToFileURL(path.join(game,'street/materials.mjs')).href,THREE=await import(threeUrl);
 for(const v of variants){let code=patchBatchSource(source,v.id);code=once(code,"'../../../vendor/three.module.js'",JSON.stringify(threeUrl));code=once(code,"'./materials.mjs'",JSON.stringify(materialsUrl));const module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')),library=module.createBatchMaterials();for(const family of ['iron','cloth','paper','neon']){const m=library.get(family),shader={uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);if(v.id==='vertex-table'){assert.equal((shader.vertexShader.match(/uniform vec4 stTable/g)||[]).length,5);assert.equal((shader.fragmentShader.match(/uniform vec4 stTable/g)||[]).length,0);assert.equal((shader.fragmentShader.match(/vec4 stPacked[0-4]=vStPacked/g)||[]).length,5);}if(v.id==='lit-no-noise')assert(!shader.fragmentShader.includes('float stLarge=stNoise'));}library.dispose();}
 console.log('All six diagnostic transforms, injected module syntax, and 24 actual Three shader-hook combinations verified; no WebGL execution performed.');
}
async function main(){
 const {chromium}=require('playwright'),out=path.resolve(process.env.TRAIN_QA_OUT||'train-r20-results/gpu-isolation');fs.mkdirSync(out,{recursive:true});
 const report={pass:false,commit:process.env.GITHUB_SHA||null,environment:'Official Playwright Chromium ANGLE SwiftShader software renderer; not a user GPU benchmark',fixture:'Fixed 350 m and 12 s, unchanged resolution/camera; diagnostic page interceptions only, not native driving',samplePolicy:{warmups:3,recorded:5,shadowCadence:'every third draw when shadows are enabled',sync:'gl.finish followed by actual center-pixel gl.readPixels'},cases:[],comparisons:[],failures:[]};
 const save=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/r20/';
  for(const variant of variants){
   const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();page.setDefaultTimeout(240000);
   const row={id:variant.id,purpose:variant.purpose,errors:[],requests:[],sources:[]},pending=[];report.cases.push(row);let interceptError=null;
   const appUrl=new URL('app.mjs',base).href,batchUrl=new URL('street/batch-materials.mjs',base).href;
   page.on('pageerror',e=>row.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text());});page.on('request',r=>row.requests.push(r.url()));
   page.on('response',response=>{const u=new URL(response.url());if(response.status()>=400)row.errors.push(response.status()+' '+response.url());if(u.origin===new URL(base).origin&&/\.(mjs|js|json|css)$/.test(u.pathname))pending.push((async()=>{const body=await response.body(),file=path.resolve(repo,u.pathname.slice(1));assert(file.startsWith(repo+path.sep));const original=fs.readFileSync(file);let expected=original;if(response.url()===appUrl)expected=Buffer.from(original.toString()+injection());if(response.url()===batchUrl)expected=Buffer.from(patchBatchSource(original.toString(),variant.id));row.sources.push({path:u.pathname,bytes:body.length,sha256:hash(body),originalSHA256:hash(original),expectedSHA256:hash(expected),modified:!body.equals(original),matches:body.equals(expected)});})().catch(e=>row.errors.push('source verification: '+e.stack)));});
   await page.route(appUrl,async route=>{try{const response=await route.fetch();await route.fulfill({response,body:await response.text()+injection()});}catch(e){interceptError=e;await route.abort();}});
   await page.route(batchUrl,async route=>{try{const response=await route.fetch();await route.fulfill({response,body:patchBatchSource(await response.text(),variant.id)});}catch(e){interceptError=e;await route.abort();}});
   try{
    const begin=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gpuIsolationFixture&&window.__trainDriver?.ready&&__trainDriver.getState().streetDistrict.status==='active'&&!__trainDriver.getState().streetDistrict.pending,null,{timeout:240000});row.readyMs=Date.now()-begin;if(interceptError)throw interceptError;
    await page.addStyleTag({content:'.screen{visibility:hidden!important}'});
    const evalStart=Date.now();row.result=await page.evaluate(id=>__gpuIsolationFixture(id),variant.id);row.evaluateWallMs=Date.now()-evalStart;
    assert.equal(row.result.glError,0);assert.equal(row.result.contextLost,false);assert(row.result.fixture.clockUnmodified);assert.deepEqual(row.result.street.coverage.missing,[]);assert.equal(row.result.samples.length,5);assert.equal(row.result.warmups.length,3);assert.equal(row.result.street.renderBatch.renderTriangles,row.result.street.metrics.expandedTriangles);
    row.timings=Object.fromEntries(['updateMs','submissionMs','finishMs','readbackMs','completionMs'].map(k=>[k,stats(row.result.samples.map(s=>s[k]))]));
    row.shadowSamples={withShadowUpdate:row.result.samples.filter(s=>s.shadowUpdate).map(s=>s.completionMs),withoutShadowUpdate:row.result.samples.filter(s=>!s.shadowUpdate).map(s=>s.completionMs)};
    const fontsStart=Date.now();await page.evaluate(()=>document.fonts.ready.then(()=>true));row.fontsReadyWaitMs=Date.now()-fontsStart;
    const shotStart=Date.now(),file=variant.id+'.png',png=await page.screenshot({path:path.join(out,file),timeout:240000});row.screenshotMs=Date.now()-shotStart;row.png=file;row.pngSHA256=hash(png);
    await Promise.all(pending);assert(row.sources.length>30,'Expected actual module source evidence');assert(row.sources.every(s=>s.matches));assert.deepEqual(row.errors,[]);row.pass=true;
    console.log(variant.id,JSON.stringify({complete:row.timings.completionMs,submit:row.timings.submissionMs,finish:row.timings.finishMs,readback:row.timings.readbackMs,triangles:row.result.samples.map(s=>s.submittedTriangles),programs:row.result.programs,screenshotMs:row.screenshotMs}));
   }catch(e){row.pass=false;row.failure=(interceptError||e).stack;report.failures.push({id:variant.id,failure:row.failure});console.error(variant.id,row.failure);}finally{await Promise.all(pending);save();await context.close();}
  }
  const baseline=report.cases.find(c=>c.id==='baseline'&&c.pass);
  if(baseline)for(const row of report.cases.filter(c=>c.pass&&c.id!=='baseline')){
   assert.deepEqual(row.result.camera,baseline.result.camera,'Diagnostic camera drift');assert.deepEqual(row.result.canvasPixels,baseline.result.canvasPixels,'Diagnostic resolution drift');assert.equal(row.result.street.metrics.expandedTriangles,baseline.result.street.metrics.expandedTriangles,'Source geometry drift');
   const regions=compare(fs.readFileSync(path.join(out,baseline.png)),fs.readFileSync(path.join(out,row.png)));report.comparisons.push({id:row.id,appearanceExpected:row.id==='vertex-table'?'equivalent within Float32/render tolerance':'intentionally diagnostic/altered',regions,completionMedianRatio:row.timings.completionMs.median/baseline.timings.completionMs.median,submittedTriangles:row.result.samples.map(s=>s.submittedTriangles)});if(row.id==='vertex-table'&&!regions.every(r=>r.meanAbsoluteError<1)){report.failures.push({id:row.id,failure:'Formula-preserving vertex-table appearance exceeded MAE 1 in a sampled region'});}
  }
  report.pass=report.cases.every(c=>c.pass)&&report.failures.length===0;
 }catch(e){report.failures.push({id:'harness',failure:e.stack});console.error(e);}finally{save();if(browser)await browser.close();}
 if(!report.pass)process.exitCode=1;
}
module.exports={variants,patchBatchSource,vertexTableShaderPatch,pageFixture};
if(require.main===module){if(process.argv.includes('--verify-only'))verifyOnly().catch(e=>{console.error(e);process.exitCode=1;});else main();}
