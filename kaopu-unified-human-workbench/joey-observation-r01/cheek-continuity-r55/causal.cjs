'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const base=require('../appearance-r54/archive-r52.json'),row=require('../appearance-r54/views.json').rows.find(x=>x.id==='E04');
const OUT='joey-face-r55-causal';fs.mkdirSync(OUT,{recursive:true});const report={schema:'r52-nasal-side-causal-diagnostic/1',identityCandidate:false,referencePhotosIncluded:false,rows:[],errors:[]};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),save=()=>fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));let browser;
function mark(stage){report.stage=stage;console.log(new Date().toISOString(),stage);save();}
const deadline=setTimeout(()=>{report.failure='Bounded causal diagnostic exceeded 480 seconds';save();process.exit(124)},480000);deadline.unref();
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});page.setDefaultTimeout(240000);page.on('pageerror',e=>report.errors.push(e.message));
 mark('load-existing-native-engine');await page.goto('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/joey-observation-r01/appearance-r54/index.html');await page.waitForFunction(()=>['ready','error'].includes(window.r54PreviewState?.phase));assert.equal((await page.evaluate(()=>r54PreviewState)).phase,'ready');const f=page.mainFrame().childFrames()[0];
 mark('fix-camera-and-snapshot');await page.addStyleTag({content:'#viewport{width:797px!important;height:590px!important;aspect-ratio:auto!important;border:0!important}'});
 const setup=await f.evaluate(async({base,row})=>{
  const api=fullCommonWorkbench,v=api.motion().viewer,m=api.motion().controller.model,T=await import('/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js');api.restore(base);v.renderer.setPixelRatio(1);v.renderer.setSize(797,590,false);v.orbit.enabled=false;
  new T.Matrix4().fromArray(row.camera.cameraWorld).decompose(v.camera.position,v.camera.quaternion,v.camera.scale);v.camera.near=row.camera.near;v.camera.far=row.camera.far;v.camera.updateMatrixWorld(true);v.camera.projectionMatrix.fromArray(row.camera.projection);v.camera.projectionMatrixInverse.copy(v.camera.projectionMatrix).invert();
  const visibility=[];v.scene.traverse(o=>{if(o.isMesh&&o!==v.mesh)visibility.push([o,o.visible]);});const clay=new T.MeshStandardMaterial({color:0xa9a9a9,roughness:.8,metalness:0});window.__cause={api,v,m,T,base,visibility,originalMaterial:v.mesh.material,originalCast:v.mesh.castShadow,originalReceive:v.mesh.receiveShadow,clay};
  const light=[];v.scene.traverse(o=>{if(o.isLight)light.push({type:o.type,name:o.name,intensity:o.intensity,color:o.color.toArray(),position:o.position.toArray()})});return{light,cameraWorld:v.camera.matrixWorld.toArray(),projection:v.camera.projectionMatrix.toArray(),gnmIdentity:base.state.gnm.identity,localChanges:base.state.anny.localChanges};
 },{base,row});report.fixed=setup;
 async function png(name){const encoded=await f.evaluate(()=>{const v=__cause.v;v.render();return v.canvas.toDataURL('image/png').split(',')[1]});const b=Buffer.from(encoded,'base64');fs.writeFileSync(path.join(OUT,name+'.png'),b);return hash(b);}
 report.originalPixels=await png('R52-original');report.repeatPixels=await png('R52-repeat');report.sameObjectImmediateRepeatExact=report.originalPixels===report.repeatPixels;
 mark('raw-normals-and-fixed-geometric-region');
 const init=await f.evaluate(()=>{
  const {v,m,T,visibility,clay}=__cause;for(const[o]of visibility)o.visible=false;v.mesh.material=clay;v.mesh.castShadow=false;v.mesh.receiveShadow=false;
  const g=v.mesh.geometry,orig=g.attributes.normal.array.slice(),copy=g.clone();copy.computeVertexNormals();let max=0,rms=0;for(let i=0;i<orig.length;i++){const d=orig[i]-copy.attributes.normal.array[i];max=Math.max(max,Math.abs(d));rms+=d*d;}copy.dispose();
  const P=m.positions,F=m.faces,pt=i=>new T.Vector3(P[i*3],P[i*3+2],-P[i*3+1]),nrm=i=>{const a=pt(F[i*3]),b=pt(F[i*3+1]),c=pt(F[i*3+2]);return b.sub(a).cross(c.sub(a)).normalize();};
  const edges=new Map();for(let i=0;i<F.length/3;i++)for(let k=0;k<3;k++){const a=F[i*3+k],b=F[i*3+(k+1)%3],key=a<b?a+':'+b:b+':'+a;if(!edges.has(key))edges.set(key,[]);edges.get(key).push(i);}
  // Screen rectangle refers only to our already rendered native diagnostic,
  // not to a photograph or a facial observation target. Actual front visibility
  // is checked by the existing original full native mesh ray intersection.
  const ray=new T.Raycaster(),roi=[];v.mesh.updateMatrixWorld(true);
  for(const[key,ids]of edges){if(ids.length!==2)continue;const[a,b]=key.split(':').map(Number);if(a<m.bodyCount||b<m.bodyCount)continue;const mid=pt(a).add(pt(b)).multiplyScalar(.5),ndc=mid.clone().project(v.camera),x=(ndc.x+1)*797/2,y=(1-ndc.y)*590/2;if(x<400||x>520||y<275||y>420)continue;
   const dir=mid.clone().sub(v.camera.position).normalize();ray.set(v.camera.position,dir);const hits=ray.intersectObject(v.mesh,false);if(!hits.length||Math.abs(hits[0].distance-mid.distanceTo(v.camera.position))>.001)continue;
   const angle=Math.acos(Math.max(-1,Math.min(1,nrm(ids[0]).dot(nrm(ids[1])))))*180/Math.PI;roi.push({a,b,faces:ids,pixel:[x,y],baselineAngleDeg:angle});
  }roi.sort((a,b)=>b.baselineAngleDeg-a.baselineAngleDeg);__cause.edges=roi;__cause.baselinePositions=Array.from(P);return{normalRecomputeMaxDifference:max,normalRecomputeRMS:Math.sqrt(rms/orig.length),roi:{screenRectangle:[400,275,520,420],frontRayDepthToleranceM:.001,edgeCount:roi.length,topEdges:roi.slice(0,40)}};
 });report.region=init;assert(init.roi.edgeCount>0);report.clayBaselinePixel=await png('R52-raw-clay');save();
 async function measure(id,archive,render=false){mark('native-field-'+id);await f.evaluate(a=>__cause.api.restore(a),archive);const result=await f.evaluate(()=>{
   const{m,T,edges,baselinePositions:B}=__cause,P=m.positions,F=m.faces,pt=i=>new T.Vector3(P[i*3],P[i*3+2],-P[i*3+1]),nrm=i=>{const a=pt(F[i*3]),b=pt(F[i*3+1]),c=pt(F[i*3+2]);return b.sub(a).cross(c.sub(a)).normalize();};let maxDisplacementM=0;for(let i=0;i<P.length;i+=3)maxDisplacementM=Math.max(maxDisplacementM,Math.hypot(P[i]-B[i],P[i+1]-B[i+1],P[i+2]-B[i+2]));const values=edges.map(e=>({...e,angleDeg:Math.acos(Math.max(-1,Math.min(1,nrm(e.faces[0]).dot(nrm(e.faces[1])))))*180/Math.PI}));return{finite:Array.from(P).every(Number.isFinite),maxDisplacementM,edges:values.slice(0,40),meanAngleDeg:values.reduce((s,e)=>s+e.angleDeg,0)/values.length,top20MeanAngleDeg:values.slice(0,20).reduce((s,e)=>s+e.angleDeg,0)/Math.min(20,values.length)};
  });assert(result.finite);if(render)result.pixel=await png(id);report.rows.push({id,...result});save();}
 await measure('baseline',base);
 const noseKeys=Object.keys(base.state.anny.localChanges).filter(k=>k.startsWith('nose-')&&base.state.anny.localChanges[k]!==0),cheekKeys=Object.keys(base.state.anny.localChanges).filter(k=>/^[lr]-cheek-/.test(k)&&base.state.anny.localChanges[k]!==0);report.groups={noseKeys,cheekKeys};
 for(const[id,keys]of [['nose-local-zero',noseKeys],['cheek-local-zero',cheekKeys]]){const a=structuredClone(base);for(const k of keys)a.state.anny.localChanges[k]=0;await measure(id,a,true);}
 for(const k of noseKeys){const a=structuredClone(base);a.state.anny.localChanges[k]=0;await measure('zero-'+k,a);}
 mark('restore-original-same-objects');await f.evaluate(a=>{const c=__cause;c.api.restore(a);c.v.mesh.material=c.originalMaterial;c.v.mesh.castShadow=c.originalCast;c.v.mesh.receiveShadow=c.originalReceive;for(const[o,visible]of c.visibility)o.visible=visible;c.clay.dispose();},base);
 assert.deepEqual(await f.evaluate(()=>fullCommonWorkbench.archive()),base);const positions=await f.evaluate(()=>Array.from(__cause.m.positions));report.restoredPositionSHA=hash(Buffer.from(new Float32Array(positions).buffer));assert.equal(report.restoredPositionSHA,'199e277439ac12afdcaa0587e4acbfd28e4fbadd5297d30060cab0d508677b19');
 report.restoredPixels=await png('R52-restored');report.sameObjectRestorePixelsExact=report.restoredPixels===report.originalPixels;report.archiveRestored=true;report.status='diagnosed-not-a-new-identity';assert.equal(report.errors.length,0);save();
})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1}).finally(async()=>{clearTimeout(deadline);if(browser)await browser.close()});
