'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const {makeCandidate}=require('../lower-face-relations-r57/candidate.cjs');
const base=require('../appearance-r54/archive-r52.json'),views=require('../appearance-r54/views.json');
const URL='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/joey-observation-r01/appearance-r54/index.html',OUT='joey-brow-r58';
const QA_MODULE=new global.URL('__qa_r58/BrowCandidate.mjs',URL).href;
const EXPECTED={neutral:'7afada1538c086096e5e5f8e46aead5b8d5c0c5b19025f4cbb045920e5be869c',smile:'9cfab89d1afee9f975f9252baafd429f68aa92e479ec742e95eb7a3292de0857'};
fs.mkdirSync(OUT,{recursive:true});
const hash=a=>crypto.createHash('sha256').update(Buffer.from(new Float32Array(a).buffer)).digest('hex');
const report={schema:'native-brow-direction-r58-render/1',fixedIdentity:'R57',photosIncluded:false,rows:[],states:[],errors:[],consoleErrors:[],likenessAccepted:false};
const save=()=>fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
function stage(s){report.stage=s;report.updatedAt=new Date().toISOString();save();console.log(s);}
let browser,frame;const deadline=setTimeout(()=>{report.failure='Bounded brow comparison exceeded 660 seconds';save();process.exit(124)},660000);deadline.unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
 await page.route(QA_MODULE,route=>route.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,'BrowCandidate.mjs'),'utf8')}));
 stage('Load original locked R52 engine');await page.goto(URL);await page.waitForFunction(()=>['ready','error'].includes(window.r54PreviewState?.phase));assert.equal((await page.evaluate(()=>r54PreviewState)).phase,'ready');
 frame=page.mainFrame().childFrames()[0];const initial=await frame.evaluate(()=>fullCommonWorkbench.archive());
 report.originalOutput=await frame.evaluate(()=>r54Preview.report().facePositionSHA);assert.equal(report.originalOutput,'199e277439ac12afdcaa0587e4acbfd28e4fbadd5297d30060cab0d508677b19');
 await frame.evaluate(()=>{r54Preview.dispose();window.r54Preview=null;});
 await page.addStyleTag({content:'#viewport{width:797px!important;height:590px!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important}'});
 await frame.evaluate(()=>{const v=fullCommonWorkbench.motion().viewer;v.renderer.setPixelRatio(1);v.renderer.setSize(797,590,false);v.orbit.enabled=false;});
 const identity=makeCandidate(base);
 async function dispose(){await frame.evaluate(()=>{const s=window.__r58;if(!s)return;s.browB.dispose();s.eye.dispose();s.hair.dispose();s.guides.dispose();s.light?.dispose();s.appearance.dispose();window.__r58=null;});}
 const states=[{name:'neutral',actions:{},viewIds:['E04','U05','profile']},{name:'smile',actions:views.rows.find(r=>r.id==='U07').actions,viewIds:['U07']}];
 for(const state of states){
  stage('Build one unchanged R57 '+state.name+' head and hairstyle');await dispose();
  const archive=structuredClone(identity);archive.state.owners.expression='anny';archive.state.anny.facialActions=state.actions;
  const detail=await frame.evaluate(async({archive,QA_MODULE})=>{
   const api=fullCommonWorkbench,v=api.motion().viewer,root=new globalThis.URL('./',location.href).href;
   const {withCandidateProfile,SPEC}=await import(QA_MODULE),{BROW_PROFILE}=await import(root+'base/brow-face-r52/BrowProfile.mjs'),{attachNativeBrows}=await import(root+'base/brow-face-r52/BrowAdapter.mjs');
   const savedProfile=structuredClone(BROW_PROFILE),neutral=structuredClone(archive);neutral.state.anny.facialActions={};api.restore(neutral);
   const {attachAppearanceR52}=await import(root+'base/brow-face-r52/AppearanceR52.mjs');
   const appearance=await attachAppearanceR52(api,{pigmentScale:.55,candidateBrows:true,taper:true});
   const existing=[];v.scene.traverse(o=>{if(o.name==='Mindfront CC0 surface-bound eyebrows')existing.push(o)});if(existing.length!==1)throw Error('Expected one original surface-bound brow mesh');
   // All geometry, optical surface, lighting and hair are shared between A/B.
   const {attachGuideStructureR30}=await import(root+'legacy-r30/GuideStructureR30.js'),{buildPackedGroomR30}=await import(root+'legacy-r30/PackedGroomR30.js'),{attachPackedGroomR30}=await import(root+'legacy-r30/InstancedGroomR30.js');
   api.restore(archive);const guides=attachGuideStructureR30(api),packed=buildPackedGroomR30(api,guides,{count:8000,matchingRootSupport:false,repairPrefixRoutes:true,meridianStrength:.8,holdLateralThroughNeck:true}),hair=attachPackedGroomR30(api,packed);v.scene.traverse(o=>{if(o.name==='18 colour-coded structural guides (diagnostic thickness)')o.visible=false});
   const {attachNativeEyeSurfaceR54}=await import(root+'eye/NativeEyeSurfaceR54.mjs');const eye=attachNativeEyeSurfaceR54(v.skin);
   // Bind the candidate on neutral, then restore the same expression on both supports.
   api.restore(neutral);let browB;
   try{browB=await withCandidateProfile(BROW_PROFILE,()=>attachNativeBrows(api));}catch(e){if(JSON.stringify(BROW_PROFILE)!==JSON.stringify(savedProfile))throw Error('Profile rollback failed after binding error');throw e;}
   if(JSON.stringify(BROW_PROFILE)!==JSON.stringify(savedProfile))throw Error('Profile leaked after candidate construction');
   const all=[];v.scene.traverse(o=>{if(o.name==='Mindfront CC0 surface-bound eyebrows')all.push(o)});const added=all.filter(o=>!existing.includes(o));if(added.length!==1)throw Error('Expected one candidate brow mesh');
   api.restore(archive);added[0].visible=false;existing[0].visible=true;
   window.__r58={appearance,eye,guides,hair,browB,meshA:existing[0],meshB:added[0],light:null,savedProfile,originalProfile:BROW_PROFILE};
   return{spec:SPEC,profileRestored:true,original:appearance.report().brows,candidate:browB.report(),hair:hair.report(),native:Array.from(api.positions())};
  },{archive,QA_MODULE});
  const nativeSHA=hash(detail.native);delete detail.native;assert.equal(nativeSHA,EXPECTED[state.name]);assert.deepEqual(await frame.evaluate(()=>fullCommonWorkbench.archive()),archive);
  const A=detail.original,B=detail.candidate;for(const d of[A,B]){assert.equal(d.missingSupports,0);assert(d.diagnostics.finite&&d.orderedTrianglesVerified);assert.equal(d.diagnostics.rejectedRoots,0);assert(d.diagnostics.activeCount>=900);assert(d.diagnostics.minNeutralEyeGap>=.0035);}
  assert.notEqual(A.bindingFingerprint,B.bindingFingerprint);assert.notEqual(A.diagnostics.curveHash,B.diagnostics.curveHash);
  report.states.push({state:state.name,nativeSHA,...detail});save();
  for(const viewId of state.viewIds){
   const row=views.rows.find(r=>r.id===viewId);stage('Render '+viewId+' A/B on the same original scene');
   const camera=await frame.evaluate(async row=>{const s=__r58,v=fullCommonWorkbench.motion().viewer,root=new globalThis.URL('./',location.href).href,THREE=await import('/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js'),c=v.camera;
    s.light?.dispose();new THREE.Matrix4().fromArray(row.camera.cameraWorld).decompose(c.position,c.quaternion,c.scale);c.near=row.camera.near;c.far=row.camera.far;c.updateMatrixWorld(true);c.projectionMatrix.fromArray(row.camera.projection);c.projectionMatrixInverse.copy(c.projectionMatrix).invert();v.orbit.enabled=false;
    const{attachObservationLighting}=await import(root+'ObservationLighting.mjs');s.light=await attachObservationLighting(v,{options:row.light});v.render();return{projection:c.projectionMatrix.toArray(),cameraWorld:c.matrixWorld.toArray(),light:s.light.report()};
   },row);assert.deepEqual(camera.projection,row.camera.projection);
   const captures=[];
   for(const label of['A-current','B-R58','A-restored']){
    const meta=await frame.evaluate(label=>{const s=__r58,v=fullCommonWorkbench.motion().viewer;s.meshA.visible=label!=='B-R58';s.meshB.visible=label==='B-R58';v.render();v.render();return{positions:Array.from(fullCommonWorkbench.positions()),profileRestored:JSON.stringify(s.originalProfile)===JSON.stringify(s.savedProfile),eye:s.eye.report(),brow:(label==='B-R58'?s.browB.report():s.appearance.report().brows)}},label);
    assert.equal(hash(meta.positions),nativeSHA);delete meta.positions;assert(meta.profileRestored);assert(meta.eye.compiles>=1);
    const file=viewId+'-'+label+'.png',bytes=await frame.locator('#canvas').screenshot({path:path.join(OUT,file),timeout:90000}),pngSHA256=crypto.createHash('sha256').update(bytes).digest('hex');
    const record={view:viewId,label,file,pngSHA256,nativeSHA,actions:state.actions,camera,...meta};captures.push(record);report.rows.push(record);save();
   }
   assert.notEqual(captures[0].pngSHA256,captures[1].pngSHA256,'Effective eyebrow change must be visible in real pixels');
   assert.equal(captures[0].pngSHA256,captures[2].pngSHA256,'Same-object visibility rollback must restore exact pixels');
  }
 }
 stage('Restore original full archive and profile');await dispose();await frame.evaluate(a=>fullCommonWorkbench.restore(a),initial);assert.deepEqual(await frame.evaluate(()=>fullCommonWorkbench.archive()),initial);
 assert.equal(report.errors.length,0);assert.equal(report.consoleErrors.length,0,JSON.stringify(report.consoleErrors));
 report.status='actual-brow-comparison-rendered';report.archiveRestored=true;report.sameScenePixelRollback=true;report.likenessAccepted=false;report.limitations=['Root/segment support distance safeguards are checked at neutral binding, not an exhaustive swept-fibre/eyelid collision test.','Exact skin/eye geometry equality isolates this eyebrow-only test but does not certify pre-existing eye appearance.','Photographic pose, focal length and light remain approximate.'];save();
})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1}).finally(async()=>{clearTimeout(deadline);if(browser)await browser.close()});
