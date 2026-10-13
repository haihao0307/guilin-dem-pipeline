'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const {spec,makeCandidate}=require('./candidate.cjs'),{auditNativeGeometry}=require('../cheek-continuity-r55/native-geometry-qa.cjs');
const base=require('../appearance-r54/archive-r52.json'),views=require('../appearance-r54/views.json');
const URL='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/joey-observation-r01/appearance-r54/index.html',OUT='joey-face-r57';fs.mkdirSync(OUT,{recursive:true});
const hash=a=>crypto.createHash('sha256').update(Buffer.from(new Float32Array(a).buffer)).digest('hex'),report={schema:'native-lower-face-relations-r57/1',spec,sourcePhotosIncluded:false,identityAccepted:false,rows:[],errors:[],consoleErrors:[]};
const save=()=>fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));let browser;
const deadline=setTimeout(()=>{report.failure='Bounded QA exceeded 900 seconds';save();process.exit(124)},900000);deadline.unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});page.setDefaultTimeout(300000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text())});
 await page.goto(URL);await page.waitForFunction(()=>['ready','error'].includes(window.r54PreviewState?.phase));assert.equal((await page.evaluate(()=>r54PreviewState)).phase,'ready');const f=page.mainFrame().childFrames()[0];
 report.loadedBaseline=await f.evaluate(()=>r54Preview.report());assert.equal(report.loadedBaseline.facePositionSHA,'199e277439ac12afdcaa0587e4acbfd28e4fbadd5297d30060cab0d508677b19');
 await f.evaluate(()=>{r54Preview.dispose();window.r54Preview=null;});
 await page.addStyleTag({content:'#viewport{width:797px!important;height:590px!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important}'});
 await f.evaluate(()=>{const v=fullCommonWorkbench.motion().viewer;v.renderer.setPixelRatio(1);v.renderer.setSize(797,590,false);v.orbit.enabled=false;});
 const initial=await f.evaluate(()=>fullCommonWorkbench.archive());
 const candidate=makeCandidate(base);assert.notDeepEqual(candidate.state.anny.localChanges,base.state.anny.localChanges);
 const names=await f.evaluate(()=>fullCommonWorkbench.motion().controller.model.anny.localChangeLabels);for(const k of Object.keys(spec.values))assert(names.includes(k),'Missing actual native axis '+k);
 await f.evaluate(a=>fullCommonWorkbench.restore(a),base);report.individualResponses=[];const baselineNative=await f.evaluate(()=>Array.from(fullCommonWorkbench.positions()));
 for(const [label,value]of Object.entries(spec.values)){const a=structuredClone(base);a.state.anny.localChanges[label]=value;await f.evaluate(a=>fullCommonWorkbench.restore(a),a);assert.deepEqual(await f.evaluate(()=>fullCommonWorkbench.archive()),a);const positions=await f.evaluate(()=>Array.from(fullCommonWorkbench.positions()));let maxM=0,vertex=-1,moved=0;for(let i=0;i<positions.length;i+=3){const d=Math.hypot(positions[i]-baselineNative[i],positions[i+1]-baselineNative[i+1],positions[i+2]-baselineNative[i+2]);if(d>0)moved++;if(d>maxM){maxM=d;vertex=i/3;}}assert(maxM>1e-5,'Each named original axis must cause actual native geometry response');report.individualResponses.push({label,from:spec.baselineValues[label],to:value,maxM,maxVertex:vertex,moved,positionSHA256:hash(positions)});save();}
 await f.evaluate(a=>fullCommonWorkbench.restore(a),base);assert.equal(hash(await f.evaluate(()=>Array.from(fullCommonWorkbench.positions()))),'199e277439ac12afdcaa0587e4acbfd28e4fbadd5297d30060cab0d508677b19');
 const nativeMeshes={},cameras={};let currentAppearance=false;
 async function apply(archive,row){
  return f.evaluate(async({archive,row})=>{
   const api=fullCommonWorkbench,v=api.motion().viewer;
   if(window.__r55){__r55.eye.dispose();__r55.hair.dispose();__r55.guides.dispose();__r55.light.dispose();__r55.appearance.dispose();window.__r55=null;}
   const neutral=structuredClone(archive);neutral.state.anny.facialActions={};api.restore(neutral);
   const root=new URL('./',location.href).href;
   const {attachAppearanceR52}=await import(root+'base/brow-face-r52/AppearanceR52.mjs');
   const appearance=await attachAppearanceR52(api,{pigmentScale:.55,candidateBrows:true,taper:true});const browBind=appearance.report().brows.bindingFingerprint;
   api.restore(archive);if(appearance.report().brows.bindingFingerprint!==browBind)throw Error('Expression changed brow supports');
   const THREE=await import('/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js'),c=v.camera;
   new THREE.Matrix4().fromArray(row.camera.cameraWorld).decompose(c.position,c.quaternion,c.scale);c.near=row.camera.near;c.far=row.camera.far;c.updateMatrixWorld(true);c.projectionMatrix.fromArray(row.camera.projection);c.projectionMatrixInverse.copy(c.projectionMatrix).invert();v.orbit.enabled=false;
   const {attachObservationLighting}=await import(root+'ObservationLighting.mjs');const light=await attachObservationLighting(v,{options:row.light});
   const {attachGuideStructureR30}=await import(root+'legacy-r30/GuideStructureR30.js'),{buildPackedGroomR30}=await import(root+'legacy-r30/PackedGroomR30.js'),{attachPackedGroomR30}=await import(root+'legacy-r30/InstancedGroomR30.js');
   const guides=attachGuideStructureR30(api),packed=buildPackedGroomR30(api,guides,{count:8000,matchingRootSupport:false,repairPrefixRoutes:true,meridianStrength:.8,holdLateralThroughNeck:true}),hair=attachPackedGroomR30(api,packed);v.scene.traverse(o=>{if(o.name==='18 colour-coded structural guides (diagnostic thickness)')o.visible=false});
   const {attachNativeEyeSurfaceR54}=await import(root+'eye/NativeEyeSurfaceR54.mjs');const eye=attachNativeEyeSurfaceR54(v.skin);window.__r55={appearance,light,guides,hair,eye};v.render();
   const direction=new THREE.Vector3(0,0,-1).applyQuaternion(c.quaternion),target=c.position.clone().add(direction);
   return{appearance:appearance.report(),eye:eye.report(),hair:hair.report(),light:light.report(),camera:{position:c.position.toArray(),target:target.toArray(),up:c.up.toArray(),fov:c.fov,zoom:c.zoom,aspect:797/590,near:c.near,far:c.far,width:797,height:590,projectionMatrix:c.projectionMatrix.toArray(),matrixWorldInverse:c.matrixWorldInverse.toArray(),cameraWorld:c.matrixWorld.toArray()},canvas:[v.canvas.width,v.canvas.height]};
  },{archive,row});
 }
 const capture=()=>f.evaluate(()=>{const m=fullCommonWorkbench.motion().controller.model;return{positions:Array.from(m.positions),faces:Array.from(m.faces),mapping:{bodyCount:m.bodyCount,gnmRecipes:m.canonical.gnmRecipes.map(r=>Array.from(r)),componentId:Array.from(m.gnm.componentId),gnmTriangles:Array.from(m.gnm.triangles)}};});
 for(const row of views.rows){
  for(const [label,identity]of [['A-R52',base],['B-R57',candidate]]){
   const archive=structuredClone(identity);archive.state.owners.expression='anny';archive.state.anny.facialActions=row.actions;
   const detail=await apply(archive,row);assert.deepEqual(await f.evaluate(()=>fullCommonWorkbench.archive()),archive);assert.deepEqual(detail.canvas,[797,590]);assert.deepEqual(detail.camera.projectionMatrix,row.camera.projection);assert(detail.eye.compiles>=1);assert.equal(detail.appearance.brows.missingSupports,0);assert(detail.appearance.brows.diagnostics.finite);
   const mesh=await capture(),sha=hash(mesh.positions);if(label==='A-R52')assert.equal(sha,row.expectedPositionSHA256,'Original native R52 output');assert(mesh.positions.every(Number.isFinite));assert.equal(mesh.positions.length,25417*3);assert.equal(mesh.faces.length,50624*3);
   const stateKey=JSON.stringify(row.actions),key=label+'|'+stateKey;if(nativeMeshes[key])assert.deepEqual(mesh,nativeMeshes[key]);nativeMeshes[key]=mesh;cameras[row.id]=detail.camera;
   const file=row.id+'-'+label+'.png',image=await f.locator('#canvas').screenshot({path:path.join(OUT,file),timeout:90000}),pixelHash=crypto.createHash('sha256').update(image).digest('hex');
   report.rows.push({reference:row.id,label,file,positionSHA256:sha,pixelHash,actions:row.actions,...detail});save();
  }
 }
 report.geometry=[];for(const actions of [...new Set(views.rows.map(r=>JSON.stringify(r.actions)))]){
  const A=nativeMeshes['A-R52|'+actions],B=nativeMeshes['B-R57|'+actions];assert.notEqual(hash(A.positions),hash(B.positions),'Native controls must change current geometry');
  const selected=Object.fromEntries(views.rows.filter(r=>JSON.stringify(r.actions)===actions).map(r=>[r.id,cameras[r.id]]));
  const audit=auditNativeGeometry({baseline:A,candidate:B,mapping:A.mapping,cameras:selected});const name=actions==='{}'?'neutral':'expression';fs.writeFileSync(path.join(OUT,'geometry-'+name+'.json'),JSON.stringify(audit,null,2));report.geometry.push({actions:JSON.parse(actions),file:'geometry-'+name+'.json',gates:audit.gates,health:audit.health,contactChange:audit.contactChange});
  assert(audit.input.valid&&audit.mapping.fullNativeEyeTopologyVerified);assert.equal(audit.health.newDegenerateCount,0);assert.equal(audit.health.reversedNormalCount,0);
 }
 const row=views.rows.find(r=>r.id==='E04'),a=structuredClone(base);a.state.anny.facialActions=row.actions;await apply(a,row);assert.equal(hash((await capture()).positions),row.expectedPositionSHA256);
 const restored=await f.locator('#canvas').screenshot({path:path.join(OUT,'E04-A-R52-restored.png'),timeout:90000});report.restoredPixelHash=crypto.createHash('sha256').update(restored).digest('hex');report.baselinePixelsRestored=report.restoredPixelHash===report.rows.find(r=>r.reference==='E04'&&r.label==='A-R52').pixelHash;report.pixelRestoreBoundary='Measured separately from exact archive/native mesh restoration; prior residual appearance changes were localized to existing hair/eye lifecycle.';
 await f.evaluate(()=>{__r55.eye.dispose();__r55.hair.dispose();__r55.guides.dispose();__r55.light.dispose();__r55.appearance.dispose();window.__r55=null;});await f.evaluate(a=>fullCommonWorkbench.restore(a),initial);assert.deepEqual(await f.evaluate(()=>fullCommonWorkbench.archive()),initial);
 assert.equal(report.errors.length,0);assert.equal(report.consoleErrors.length,0,JSON.stringify(report.consoleErrors));report.status='rendered-with-structural-diagnostics';report.archiveRestored=true;report.eyeContactAppearanceAccepted=false;report.likenessAccepted=false;save();
})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1}).finally(async()=>{clearTimeout(deadline);if(browser)await browser.close()});
