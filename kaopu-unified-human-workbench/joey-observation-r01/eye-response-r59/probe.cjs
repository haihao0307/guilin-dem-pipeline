'use strict';
// Reuses the original R47 complete-native-mesh component pass. No photo inputs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const {makeCandidate}=require('../lower-face-relations-r57/candidate.cjs'),base=require('../appearance-r54/archive-r52.json'),views=require('../appearance-r54/views.json');
const URL='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/joey-observation-r01/appearance-r54/index.html',OUT='joey-eye-response-r59';fs.mkdirSync(OUT,{recursive:true});
const hash=a=>crypto.createHash('sha256').update(Buffer.from(new Float32Array(a).buffer)).digest('hex');
const report={schema:'native-independent-eyelid-response-r59/1',scope:'Observe existing single-axis static responses; no selected face candidate',sourcePhotosIncluded:false,rows:[],errors:[],identityAccepted:false};
const save=()=>fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));let browser;
const deadline=setTimeout(()=>{report.failure='Bounded response observation exceeded 540 seconds';save();process.exit(124)},540000);deadline.unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(URL);await page.waitForFunction(()=>['ready','error'].includes(window.r54PreviewState?.phase));assert.equal((await page.evaluate(()=>r54PreviewState)).phase,'ready');const f=page.mainFrame().childFrames()[0];
 assert.equal(await f.evaluate(()=>r54Preview.report().facePositionSHA),'199e277439ac12afdcaa0587e4acbfd28e4fbadd5297d30060cab0d508677b19');const original=await f.evaluate(()=>fullCommonWorkbench.archive());await f.evaluate(()=>{r54Preview.dispose();window.r54Preview=null});
 await page.addStyleTag({content:'#viewport{width:797px!important;height:590px!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important}'});
 await f.evaluate(()=>{const v=fullCommonWorkbench.motion().viewer;v.renderer.setPixelRatio(1);v.renderer.setSize(797,590,false);v.orbit.enabled=false;});
 const frozen=makeCandidate(base);frozen.state.owners.expression='anny';frozen.state.anny.facialActions={};
 await f.evaluate(a=>fullCommonWorkbench.restore(a),frozen);
 const initial=await f.evaluate(()=>{const m=fullCommonWorkbench.motion().controller.model,labels=new Int16Array(m.positions.length/3).fill(-1),regions=labels.slice();for(let i=0;i<m.canonical.gnmRecipes.length;i++){const[a,b,t]=m.canonical.gnmRecipes[i],j=m.bodyCount+i;labels[j]=m.gnm.componentId[a]===m.gnm.componentId[b]?m.gnm.componentId[a]:-2;regions[j]=m.gnm.regionId[a]===m.gnm.regionId[b]?m.gnm.regionId[a]:-2;}return{positions:Array.from(m.positions),faces:Array.from(m.faces),labels:Array.from(labels),regions:Array.from(regions),axisLabels:Array.from(m.anny.localChangeLabels)};});
 assert.equal(hash(initial.positions),'7afada1538c086096e5e5f8e46aead5b8d5c0c5b19025f4cbb045920e5be869c');
 const specs=[{id:'base'}];for(const i of[1,2,3])for(const delta of[-.1,.1])specs.push({id:'left-height'+i+(delta<0?'-minus':'-plus'),label:'l-eye-height'+i+'-incr',delta});
 report.specs=specs;report.fixedNativeSHA=hash(initial.positions);report.regionCodes={region1:1,region3:3,region6:6,region7:7};report.sideConvention='Anny label left is not yet assumed to match native component1 or screen-left; centres and responses are recorded';report.photoTargetsUsed=false;
 for(const spec of specs){
  console.log('Native static eye response',spec.id);report.stage=spec.id;save();
  const a=structuredClone(frozen);if(spec.label){assert(initial.axisLabels.includes(spec.label));a.state.anny.localChanges[spec.label]=(a.state.anny.localChanges[spec.label]||0)+spec.delta;assert(Math.abs(a.state.anny.localChanges[spec.label])<=1);}
  await f.evaluate(a=>fullCommonWorkbench.restore(a),a);assert.deepEqual(await f.evaluate(()=>fullCommonWorkbench.archive()),a);
  const positions=await f.evaluate(()=>Array.from(fullCommonWorkbench.positions()));assert(positions.every(Number.isFinite));assert.equal(positions.length,initial.positions.length);assert.deepEqual(await f.evaluate(()=>Array.from(fullCommonWorkbench.faces())),initial.faces);
  const displacement={};for(const [name,predicate]of Object.entries({all:()=>true,region1:i=>initial.regions[i]===1,region3:i=>initial.regions[i]===3,region6:i=>initial.regions[i]===6,region7:i=>initial.regions[i]===7,eye1:i=>initial.labels[i]===1,eye2:i=>initial.labels[i]===2})){
   let count=0,maxM=0,mean=[0,0,0],center=[0,0,0];for(let i=0;i<positions.length/3;i++)if(predicate(i)){count++;const d=[0,1,2].map(k=>positions[3*i+k]-initial.positions[3*i+k]);maxM=Math.max(maxM,Math.hypot(...d));d.forEach((x,k)=>{mean[k]+=x;center[k]+=positions[3*i+k]});}displacement[name]={count,maxM,meanCommonXYZ:mean.map(x=>x/(count||1)),centerCommonM:center.map(x=>x/(count||1))};
  }
  if(spec.label)assert(displacement.all.maxM>1e-6,'Original axis must be effective');
  for(const viewId of['U07','E04']){
   const row=views.rows.find(x=>x.id===viewId);
   const snapshot=await f.evaluate(async({row,labels,eyeCenters})=>{
    const THREE=await import('/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js'),v=fullCommonWorkbench.motion().viewer,c=v.camera,mesh=v.mesh;
    new THREE.Matrix4().fromArray(row.camera.cameraWorld).decompose(c.position,c.quaternion,c.scale);c.near=row.camera.near;c.far=row.camera.far;c.updateMatrixWorld(true);c.projectionMatrix.fromArray(row.camera.projection);c.projectionMatrixInverse.copy(c.projectionMatrix).invert();v.orbit.enabled=false;
    if(!mesh.geometry.index||mesh.geometry.attributes.position.count!==25417||mesh.geometry.index.count!==50624*3)throw Error('Viewer/common topology mismatch');
    window.__r59Saved={geometry:mesh.geometry,material:mesh.material,visible:[]};v.scene.traverse(o=>{if(o!==mesh&&(o.isMesh||o.isLine||o.isPoints)&&o.visible){__r59Saved.visible.push(o);o.visible=false;}});
    const g=mesh.geometry.toNonIndexed(),faces=fullCommonWorkbench.faces(),col=new Float32Array(g.attributes.position.count*3),color=new THREE.Color();
    for(let t=0;t<faces.length/3;t++){const ids=[labels[faces[t*3]],labels[faces[t*3+1]],labels[faces[t*3+2]]],id=ids.every(x=>x===ids[0])?ids[0]:-2;color.setRGB(id===0?.55:id===1?1:0,id===0?.55:id===2?1:0,id===0?.55:id>=3?1:0);for(let j=0;j<3;j++)color.toArray(col,(t*3+j)*3);}
    g.setAttribute('color',new THREE.BufferAttribute(col,3));mesh.geometry=g;mesh.material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.FrontSide,toneMapped:false});v.render();
    const rect=v.canvas.getBoundingClientRect(),projectedEyeCenters=eyeCenters.map(common=>{const p=new THREE.Vector3(common[0],common[2],-common[1]).applyMatrix4(mesh.matrixWorld).project(c);return[(p.x+1)*v.canvas.width/2,(1-p.y)*v.canvas.height/2]});return{width:v.canvas.width,height:v.canvas.height,cssWidth:rect.width,cssHeight:rect.height,cssX:rect.x,cssY:rect.y,pngDataUrl:v.canvas.toDataURL('image/png'),projectedEyeCenters,meshWorld:mesh.matrixWorld.toArray(),cameraWorld:c.matrixWorld.toArray(),cameraView:c.matrixWorldInverse.toArray(),cameraProjection:c.projectionMatrix.toArray()};
   },{row,labels:initial.labels,eyeCenters:[displacement.eye1.centerCommonM,displacement.eye2.centerCommonM]});assert.deepEqual([snapshot.width,snapshot.height],[797,590]);assert(Math.abs(snapshot.cssWidth-797)<1e-4&&Math.abs(snapshot.cssHeight-590)<1e-4,'Canvas CSS/drawing buffer scale');assert.deepEqual(snapshot.cameraProjection,row.camera.projection);assert(snapshot.cameraWorld.every((x,i)=>Math.abs(x-row.camera.cameraWorld[i])<1e-12),'Camera world transform');
   const file=viewId+'-'+spec.id+'-components.png';assert(snapshot.pngDataUrl.startsWith('data:image/png;base64,'));const png=Buffer.from(snapshot.pngDataUrl.split(',')[1],'base64');delete snapshot.pngDataUrl;fs.writeFileSync(path.join(OUT,file),png);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[797,590]);
   await f.evaluate(()=>{const v=fullCommonWorkbench.motion().viewer,s=__r59Saved;v.mesh.geometry.dispose();v.mesh.material.dispose();v.mesh.geometry=s.geometry;v.mesh.material=s.material;for(const o of s.visible)o.visible=true;window.__r59Saved=null;v.render();});
   report.rows.push({spec,viewId,file,nativeSHA:hash(positions),displacement,snapshot,expression:{}});save();
  }
 }
 await f.evaluate(a=>fullCommonWorkbench.restore(a),original);assert.deepEqual(await f.evaluate(()=>fullCommonWorkbench.archive()),original);assert.equal(report.errors.length,0);
 report.archiveRestored=true;report.status='component-observations-rendered';report.boundaryEvaluation='Local component contour scanner still required; rendering success is not eye-shape acceptance';save();
})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1}).finally(async()=>{clearTimeout(deadline);if(browser)await browser.close()});
