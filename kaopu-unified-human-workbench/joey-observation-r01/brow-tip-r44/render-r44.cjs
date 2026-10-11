// One reversible native R44 candidate; source references never enter this runner.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const {auditNativeGeometry}=require('./native-geometry-qa.cjs');
const OUT='joey-brow-tip-r44';fs.mkdirSync(OUT,{recursive:true});
const baseline=require('../macro-face-r43/archives/B-macro-layout.json'),candidate=require('./B-brow-tip.json'),golden=require('./golden-r43.json');
const baseWithoutTip=structuredClone(baseline),candidateWithoutTip=structuredClone(candidate);
delete baseWithoutTip.state.anny.localChanges['nose-point-width-incr'];delete candidateWithoutTip.state.anny.localChanges['nose-point-width-incr'];assert.deepEqual(candidateWithoutTip,baseWithoutTip);assert.equal(candidate.state.anny.localChanges['nose-point-width-incr'],-.44);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1080}});page.setDefaultTimeout(360000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8765/native/kaopu-unified-human-workbench/');await page.evaluate(()=>fullCommonWorkbench.load());await page.waitForFunction(()=>fullCommonWorkbench.diagnostics().ready&&!fullCommonWorkbench.diagnostics().busy&&fullCommonWorkbench.motion());await page.evaluate(()=>fullCommonWorkbench.motion().setMode('shape'));
 const original=await page.evaluate(()=>fullCommonWorkbench.archive());await page.evaluate(a=>{fullCommonWorkbench.restore(a);fullCommonWorkbench.view('face');},baseline);
 await page.evaluate(()=>{const v=fullCommonWorkbench.motion().viewer;v.camera.fov=12.659861730399786;v.camera.updateProjectionMatrix();});
 const camera={position:[-.000238269567489624,.7068516776479523,1.3108030863872036],target:[-.000238269567489624,.6909405291080475,.0682724928483367],zoom:1},rows=[],meshes={},cameras={};let binding=null;
 for(const stage of ['A-R43-baseline','B-R44-brow-tip','F-R43-restore']){
  const isCandidate=stage.startsWith('B-'),a=isCandidate?candidate:baseline;
  await page.evaluate(async({a,taper})=>{if(window.__appearance){__appearance.dispose();window.__appearance=null;}fullCommonWorkbench.restore(a);const{attachAppearanceR44}=await import('/kaopu-unified-human-workbench/joey-observation-r01/brow-tip-r44/AppearanceR44.mjs');window.__appearance=await attachAppearanceR44(fullCommonWorkbench,{pigmentScale:.55,candidateBrows:true,taper});},{a,taper:isCandidate});
  assert.deepEqual(await page.evaluate(()=>fullCommonWorkbench.archive()),a);
  const mesh=await page.evaluate(()=>{const m=fullCommonWorkbench.motion().controller.model;return{positions:Array.from(m.positions),faces:Array.from(m.faces)}});
  const positionSHA256=hash(Buffer.from(new Float32Array(mesh.positions).buffer));if(!isCandidate)assert.equal(positionSHA256,golden.positionSHA256,'R43 native geometry drift');
  if(stage!=='F-R43-restore')meshes[isCandidate?'candidate':'baseline']=mesh;else assert.deepEqual(mesh,meshes.baseline,'R43 geometry rollback');
  const bindingNow=await page.evaluate(()=>__appearance.bindingSnapshot()),bindingSHA256=hash(JSON.stringify(bindingNow));if(binding)assert.deepEqual(bindingNow,binding,'Original root pool / guide support changed');else binding=bindingNow;
  const appearance=await page.evaluate(()=>__appearance.report());assert(appearance.brows.diagnostics.finite);assert.equal(appearance.brows.missingSupports,0);assert.equal(appearance.brows.diagnostics.invalidTriangles,0);assert.equal(appearance.brows.diagnostics.invalidGuideTriangles,0);assert(appearance.brows.rootSurfaceErrorM<1e-7,'Float32 native root binding');
  if(isCandidate)assert(appearance.brows.diagnostics.activeCount<rows[0].appearance.brows.diagnostics.activeCount,'Taper must remove existing root visibility, not refill elsewhere');
  const row={stage,positionSHA256,bindingSHA256,appearance,views:{}};
  for(const [view,yaw] of [['front',0],['heldout-oblique',-.65],['profile',-Math.PI/2]]){
   const c=structuredClone(camera),d=Math.hypot(c.position[0]-c.target[0],c.position[2]-c.target[2]);c.position=[c.target[0]+Math.sin(yaw)*d,c.position[1],c.target[2]+Math.cos(yaw)*d];await page.evaluate(c=>fullCommonWorkbench.motion().viewer.restoreCamera(c),c);
   const hashes=[];for(let i=0;i<3;i++)hashes.push(hash(await page.evaluate(()=>{const v=fullCommonWorkbench.motion().viewer;v.render();return v.canvas.toDataURL()})));assert.equal(new Set(hashes).size,1);
   if(!isCandidate)assert.equal(hashes[0],golden.barePixelHashes[view],'Original R43 pixel parity');
   const pixels=await page.evaluate(()=>fullCommonWorkbench.pixelAudit());assert.equal(pixels.error,0);assert(pixels.colors>100);
   const saved=await page.evaluate(()=>{const v=fullCommonWorkbench.motion().viewer,r=v.canvas.getBoundingClientRect();v.camera.updateMatrixWorld(true);return{clip:{x:r.x,y:r.y,width:r.width,height:r.height},fov:v.camera.fov,aspect:v.camera.aspect,near:v.camera.near,far:v.camera.far,canvasWidth:v.canvas.width,canvasHeight:v.canvas.height,projectionMatrix:v.camera.projectionMatrix.toArray(),matrixWorldInverse:v.camera.matrixWorldInverse.toArray()}});
   assert.equal(saved.canvasWidth,797);assert.equal(saved.canvasHeight,590);const screenshot=await page.screenshot({path:path.join(OUT,stage+'-'+view+'.png'),clip:saved.clip});assert.equal(screenshot.readUInt32BE(16),797);assert.equal(screenshot.readUInt32BE(20),590);const nativeCanvas=await page.evaluate(()=>fullCommonWorkbench.motion().viewer.canvas.toDataURL());fs.writeFileSync(path.join(OUT,stage+'-'+view+'-native-canvas.png'),Buffer.from(nativeCanvas.split(',')[1],'base64'));
   row.views[view]={camera:c,hashes,pixels};if(stage==='A-R43-baseline')cameras[view]={...c,...saved,width:797,height:590};
  }
  if(stage!=='F-R43-restore'){
   row.hair=await page.evaluate(async()=>{const root='/hair/kaopu-hair-workbench/qa/isolated-longhair-r01/src';const{attachGuideStructureR30}=await import(root+'/GuideStructureR30.js');window.__fixedGuides=attachGuideStructureR30(fullCommonWorkbench);const{buildPackedGroomR30}=await import(root+'/PackedGroomR30.js');const{attachPackedGroomR30}=await import(root+'/InstancedGroomR30.js');const data=buildPackedGroomR30(fullCommonWorkbench,__fixedGuides,{count:8000,matchingRootSupport:false,repairPrefixRoutes:true,meridianStrength:.8,holdLateralThroughNeck:true});window.__fixedHair=attachPackedGroomR30(fullCommonWorkbench,data);const v=fullCommonWorkbench.motion().viewer;v.scene.traverse(o=>{if(o.name==='18 colour-coded structural guides (diagnostic thickness)')o.visible=false});v.render();return{commit:'d689a5ee8bc5d493d2b43e7b6ea10dbea1868b15',options:{count:8000,matchingRootSupport:false,repairPrefixRoutes:true,meridianStrength:.8,holdLateralThroughNeck:true},report:__fixedHair.report(),scope:'Frozen prior context only; no new hair quality acceptance'}});
   assert.deepEqual(await page.evaluate(()=>Array.from(fullCommonWorkbench.positions())),mesh.positions,'Groom must not modify native human');
   for(const [view,c] of Object.entries(cameras)){await page.evaluate(c=>fullCommonWorkbench.motion().viewer.restoreCamera(c),c);const clip=await page.evaluate(()=>{const r=fullCommonWorkbench.motion().viewer.canvas.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}});await page.screenshot({path:path.join(OUT,stage+'-fixed-hair-'+view+'.png'),clip});}
   await page.evaluate(()=>{__fixedHair.dispose();__fixedGuides.dispose();window.__fixedHair=null;window.__fixedGuides=null;fullCommonWorkbench.motion().viewer.render()});
  }
  rows.push(row);
 }
 const mapping=await page.evaluate(()=>{const m=fullCommonWorkbench.motion().controller.model;return{bodyCount:m.bodyCount,gnmRecipes:m.canonical.gnmRecipes,componentId:Array.from(m.gnm.componentId),gnmTriangles:Array.from(m.gnm.triangles)}});
 const qa=auditNativeGeometry({baseline:meshes.baseline,candidate:meshes.candidate,mapping,cameras,options:{maxBodyDisplacementM:.0001,maxEyeDisplacementM:.0001,rayDepthEpsilonM:1e-6}});fs.writeFileSync(path.join(OUT,'native-geometry-qa.json'),JSON.stringify(qa,null,2));assert(qa.structuralPass,'Native structural/frozen-displacement budget failed; inspect saved QA');
 await page.evaluate(()=>__appearance.dispose());await page.evaluate(a=>fullCommonWorkbench.restore(a),original);assert.deepEqual(await page.evaluate(()=>fullCommonWorkbench.archive()),original);assert.equal(errors.length,0);
 fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({schema:'joey-native-brow-tip-r44/1',rows,cameras,archiveRestored:true,originalR43GeometryAndBarePixelsRestored:true,rootAndGuideBindingsByteIdentical:true,geometryQAFile:'native-geometry-qa.json',likenessAccepted:false,candidateAdopted:false,experiment:'one original-root eyebrow taper plus native nose-point-width -0.24 to -0.44; broad face, eyes, body, head-hair, material, lighting and cameras held fixed',errors},null,2));
}catch(e){fs.writeFileSync(path.join(OUT,'failure.json'),JSON.stringify({error:e.stack},null,2));throw e}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
