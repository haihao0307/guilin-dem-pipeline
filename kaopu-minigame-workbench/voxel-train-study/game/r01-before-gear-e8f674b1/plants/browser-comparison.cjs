'use strict';
// Actual browser fixture only: identical explicit camera, time and scene distance
// in frozen R20 and the plant candidate. Native travel is a separate test.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const out=path.resolve(process.env.PLANTS_QA_OUT||'train-plants-r01-results/comparison');fs.mkdirSync(out,{recursive:true});
const GAME='kaopu-minigame-workbench/voxel-train-study/game';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stats=a=>{const x=a.slice().sort((a,b)=>a-b);return{count:x.length,median:x[Math.floor(x.length*.5)],p95:x[Math.floor(x.length*.95)],max:x.at(-1)};};
const cases=[
 {id:'first-station',distance:0,position:[9,19,70],target:[-24,2,0]},
 {id:'first-verge-close',distance:0,position:[-23,6,13],target:[-34,2.9,-4.55]},
 {id:'station-exit',distance:24,position:[12,6.2,15],target:[0,2.8,-4.55]},
 {id:'bridge-native-plant',distance:365,position:[12,9,22],target:[0,4,-6.2]},
 {id:'second-approach',distance:666,position:[12,6.5,17],target:[0,3,-4.4]},
 {id:'second-station',distance:700,position:[9,19,70],target:[-24,2,0]},
];
const inject=`\n;window.__plantFixture=async(spec)=>{game.paused=true;needsRender=false;camera.position.fromArray(spec.position);cameraTarget.fromArray(spec.target);camera.zoom=1;camera.fov=35;camera.updateProjectionMatrix();camera.lookAt(cameraTarget);const v={...game.view(),distance:spec.distance,elapsed:12};let count=0;for(;count<500;count++){world.update(v,game.route,{cameraTarget:spec.target,cameraPosition:spec.position});if(!world.streetDistrict.proof.pending)break;}if(count===500)throw Error('Pending render queue did not settle');const cpu=[],complete=[];for(let i=0;i<11;i++){const t=performance.now();world.update(v,game.route,{cameraTarget:spec.target,cameraPosition:spec.position});const m=performance.now();smoke.update(v.elapsed,camera,{view:v,emitters:world.fillSteamEmitters(steamEmitters)});renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));if(i>=4){cpu.push(m-t);complete.push(performance.now()-t);}needsRender=false;await new Promise(r=>setTimeout(r,0));}return{fixture:spec,settleUpdates:count+1,cpu,complete,glError:gl.getError(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory},rendererName,street:structuredClone(world.streetDistrict.proof),plants:world.nativePlants?.snapshot?.()||null,sessionDistance:game.distance,sessionElapsed:game.elapsed};};`;
const report={pass:false,commit:process.env.GITHUB_SHA,referenceCommit:'fdbc36e17a34c21c14cc9566a533bb080e3dacc2',environment:'Official GitHub Ubuntu24.04, pinned Playwright1.57 Chromium ANGLE SwiftShader software renderer; not physical phone or hardware GPU FPS',scope:'Explicit paused fixtures at identical camera/elapsed/quality/size. Does not claim native driving.',budgetDeclaredBeforeRun:{completeFrameRatio:1.45,cpuAddedMs:1.0,errors:0,expectedNativePlantCount:4},versions:{}};
const write=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const version of ['r20-baseline','r20-plants-r01']){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();page.setDefaultTimeout(180000);
  const errors=[],network=[],sources=[],requests=[],pending=[],base='http://127.0.0.1:8765/'+GAME+'/'+version+'/';
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)network.push({status:r.status(),url:r.url()});const u=new URL(r.url());if(u.origin===new URL(base).origin&&/\.(mjs|js|json|css)$/.test(u.pathname))pending.push(r.body().then(b=>{const file=path.resolve(u.pathname.slice(1));const source=fs.readFileSync(file),expected=u.pathname.endsWith('/app.mjs')?Buffer.concat([source,Buffer.from(inject)]):source;sources.push({path:u.pathname,bytes:b.length,sha256:sha(b),matches:sha(b)===sha(expected)});}));});
  await page.route(base+'app.mjs',async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+inject});});
  const start=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__plantFixture&&window.__trainDriver?.ready&&__trainDriver.getState().streetDistrict.status==='active'&&!__trainDriver.getState().streetDistrict.pending,null,{timeout:240000});
  const result=report.versions[version]={readyMs:Date.now()-start,cases:[],sources,requests,errors,network};await page.addStyleTag({content:'#journeyHud,#drivePanel,.screen,#notice,#tutorial,#loading{visibility:hidden!important}'});
  for(const spec of cases){const r=await page.evaluate(s=>__plantFixture(s),spec);assert.equal(r.glError,0);assert.equal(r.sessionDistance,0);assert.equal(r.sessionElapsed,0);assert(!r.street.error);assert.deepEqual(r.street.coverage.missing,[]);if(version==='r20-plants-r01'){assert.equal(r.plants.count,4);assert.equal(r.plants.worldGeometryScale,1);assert.equal(r.plants.elapsed,12);assert(r.plants.active<=2);assert(r.plants.plants.every(p=>p.proof.geometryDetail.leafSegments===28));}
   const png=version+'-'+spec.id+'.png';const bytes=await page.screenshot({path:path.join(out,png),timeout:180000});result.cases.push({...r,cpuMs:stats(r.cpu),completeMs:stats(r.complete),png,pngSha256:sha(bytes)});write();console.log(version,spec.id,r.drawCalls,r.triangles);}
  // Read-only paused replay of the same time must be pixel deterministic.
  const a=await page.evaluate(s=>__plantFixture(s),cases[2]),pngA=await page.screenshot();const b=await page.evaluate(s=>__plantFixture(s),cases[2]),pngB=await page.screenshot();result.pauseStable=sha(pngA)===sha(pngB);assert(result.pauseStable);
  await Promise.all(pending);assert.deepEqual(errors,[]);assert.deepEqual(network,[]);assert(sources.every(s=>s.matches));assert(!requests.some(u=>/\.(glb|gltf|bin|png|jpg|jpeg|webp)(\?|$)/i.test(u)));await context.close();write();
 }
 const baseline=report.versions['r20-baseline'],candidate=report.versions['r20-plants-r01'];report.cost=candidate.cases.map((c,i)=>({id:c.fixture.id,baselineCompleteMs:baseline.cases[i].completeMs,candidateCompleteMs:c.completeMs,completeRatio:c.completeMs.median/baseline.cases[i].completeMs.median,cpuDeltaMs:c.cpuMs.median-baseline.cases[i].cpuMs.median,drawCallsAdded:c.drawCalls-baseline.cases[i].drawCalls,trianglesAdded:c.triangles-baseline.cases[i].triangles,geometriesAdded:c.memory.geometries-baseline.cases[i].memory.geometries}));
 report.gates={noErrors:true,pauseStable:baseline.pauseStable&&candidate.pauseStable,boundedCost:report.cost.every(c=>c.completeRatio<=1.45&&c.cpuDeltaMs<=1),realGeometry:candidate.cases.some(c=>c.triangles>baseline.cases.find(b=>b.fixture.id===c.fixture.id).triangles)};assert(Object.values(report.gates).every(Boolean),'Native plant cost/geometry gate failed; keep evidence and do not publish');report.pass=true;
 }catch(e){report.failure=e.stack;console.error(e);}finally{write();if(browser)await browser.close();}if(!report.pass)process.exitCode=1;
})();
