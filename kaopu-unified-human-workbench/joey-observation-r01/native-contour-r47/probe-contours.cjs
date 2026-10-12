// Original bounded response experiment on the fixed R45 native actor.
// No source photographs, target coordinates, new identity or learned model.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const archive=require('../face-relation-r45/candidate.json');
const input=require('../multiview-r46/fit-input.json');
const OUT=process.env.CONTOUR_OUT||'joey-native-contour-r47';fs.mkdirSync(OUT,{recursive:true});
const SPECS=require(process.env.CONTOUR_SPECS||'./probe-specs.json');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1080}});page.setDefaultTimeout(360000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/native/kaopu-unified-human-workbench/');
  await page.evaluate(()=>fullCommonWorkbench.load());
  await page.waitForFunction(()=>fullCommonWorkbench.diagnostics().ready&&!fullCommonWorkbench.diagnostics().busy&&fullCommonWorkbench.motion());
  await page.evaluate(()=>fullCommonWorkbench.motion().setMode('shape'));
  const original=await page.evaluate(()=>fullCommonWorkbench.archive());
  const data={schema:'frozen-R45-native-surface-observation/1',identityCommit:'18ae96619fd627496097bb2740e2a0828cb6a4ff',engineCommit:'0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe',newIdentity:false,sourcePhotographsUploaded:false,specs:SPECS,rows:[]};
  for(const item of input.rows){for(const spec of SPECS){
   const a=structuredClone(archive);a.state.owners.expression='anny';a.state.anny.facialActions=structuredClone(item.baselineActions);
   for(const [key,delta] of Object.entries(spec.identity||{})){a.state.anny.localChanges[key]=(a.state.anny.localChanges[key]||0)+delta;assert(Math.abs(a.state.anny.localChanges[key])<=1);}
   for(const [key,delta] of Object.entries(spec.expression||{}))a.state.anny.facialActions[key]=(a.state.anny.facialActions[key]||0)+delta;
   const frameId=item.id+'-'+spec.id;console.log('Native contour probe',frameId);
   await page.evaluate(async a=>{
    if(window.__light){__light.dispose();window.__light=null;}if(window.__appearance){__appearance.dispose();window.__appearance=null;}
    fullCommonWorkbench.restore(a);
    const {attachAppearanceR45}=await import('/kaopu-unified-human-workbench/joey-observation-r01/face-relation-r45/AppearanceR45.mjs');
    window.__appearance=await attachAppearanceR45(fullCommonWorkbench,{pigmentScale:.55,candidateBrows:true,taper:true});
   },a);
   assert.deepEqual(await page.evaluate(()=>fullCommonWorkbench.archive()),a);
   const state=await page.evaluate(async item=>{
    const THREE=await import('/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js');
    const api=fullCommonWorkbench,m=api.motion().controller.model,g=m.gnm,v=api.motion().viewer,c=v.camera;
    v.orbit.enabled=false;new THREE.Matrix4().fromArray(item.camera.cameraWorld).decompose(c.position,c.quaternion,c.scale);
    c.near=item.camera.near;c.far=item.camera.far;c.updateMatrixWorld(true);c.projectionMatrix.fromArray(item.camera.projection);c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
    const {attachReferenceLighting}=await import('/kaopu-unified-human-workbench/joey-observation-r01/face-relation-r45/ReferenceLighting.mjs');window.__light=await attachReferenceLighting(v,{reference:item.id});v.render();
    const reverse=new Int32Array(g.numVertices).fill(-1),components=new Int16Array(m.positions.length/3).fill(-1),regions=new Int16Array(m.positions.length/3).fill(-1);
    for(let i=0;i<m.canonical.gnmRecipes.length;i++){const[a,b,t]=m.canonical.gnmRecipes[i],j=m.bodyCount+i;if(a===b&&t===0)reverse[a]=j;components[j]=g.componentId[a]===g.componentId[b]?g.componentId[a]:-2;regions[j]=g.regionId[a]===g.regionId[b]?g.regionId[a]:-2;}
    const landmarks=[];
    for(let id=0;id<68;id++){
     const source=Array.from(g.landmarkIndices.slice(id*3,id*3+3)),weights=Array.from(g.landmarkWeights.slice(id*3,id*3+3)),sum=weights.reduce((a,b)=>a+b,0),supports=source.map(i=>reverse[i]);
     if(supports.some(i=>i<0)||!Number.isFinite(sum)||sum<=0)throw Error('Invalid native landmark support');
     const normalized=weights.map(w=>w/sum),common=[0,0,0];for(let k=0;k<3;k++)for(let j=0;j<3;j++)common[j]+=m.positions[3*supports[k]+j]*normalized[k];
     const world=new THREE.Vector3(common[0],common[2],-common[1]).applyMatrix4(v.mesh.matrixWorld),pixel=world.clone().project(c);
     landmarks.push({id,source,supports,rawWeights:weights,normalizedWeights:normalized,common,world:world.toArray(),pixel:[(pixel.x+1)*v.canvas.width/2,(1-pixel.y)*v.canvas.height/2]});
    }
    const box=v.canvas.getBoundingClientRect();
    return{id:item.id,positions:Array.from(m.positions),faces:Array.from(m.faces),bodyCount:m.bodyCount,components:Array.from(components),regions:Array.from(regions),gnmMeta:g.meta,landmarks,meshWorld:v.mesh.matrixWorld.toArray(),cameraWorld:c.matrixWorld.toArray(),cameraView:c.matrixWorldInverse.toArray(),cameraProjection:c.projectionMatrix.toArray(),width:v.canvas.width,height:v.canvas.height,clip:{x:box.x,y:box.y,width:box.width,height:box.height},lighting:__light.report(),appearance:__appearance.report()};
   },item);
   state.positionSHA256=sha(Buffer.from(new Float32Array(state.positions).buffer));
   if(spec.id==='base')assert.equal(state.positionSHA256,item.beforePositionSHA256,'Frozen R45 native geometry');
   state.id=frameId;state.photo=item.id;state.spec=spec;state.actions=a.state.anny.facialActions;
   assert.equal(state.positions.length,25417*3);assert.equal(state.faces.length,50624*3);assert(state.positions.every(Number.isFinite));
   await page.screenshot({path:path.join(OUT,frameId+'-bare.png'),clip:state.clip});
   for(const pass of ['components']){
    await page.evaluate(async({labels,pass})=>{
     const THREE=await import('/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js'),v=fullCommonWorkbench.motion().viewer,mesh=v.mesh;
     if(!mesh.geometry.index||mesh.geometry.attributes.position.count!==25417||mesh.geometry.index.count!==50624*3)throw Error('Viewer/common topology mismatch');
     window.__semanticSaved={geometry:mesh.geometry,material:mesh.material,visible:[]};
     v.scene.traverse(o=>{if(o!==mesh&&(o.isMesh||o.isLine||o.isPoints)&&o.visible){__semanticSaved.visible.push(o);o.visible=false;}});
     const g=mesh.geometry.toNonIndexed(),faces=Array.from(fullCommonWorkbench.faces()),col=new Float32Array(g.attributes.position.count*3),color=new THREE.Color();
     for(let f=0;f<faces.length/3;f++){const vals=faces.slice(3*f,3*f+3).map(i=>labels[i]);const id=vals.every(v=>v===vals[0])?vals[0]:-2;const code=id<0?0:id+1;if(pass==='components')color.setRGB(code===1?.55:code===2?1:0,code===1?.55:code===3?1:0,code===1?.55:code>=4?1:0);else color.setHSL((code*.137)%1,.7,code? .55:.15);for(let k=0;k<3;k++)color.toArray(col,(f*3+k)*3);}
     g.setAttribute('color',new THREE.BufferAttribute(col,3));mesh.geometry=g;mesh.material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.FrontSide,toneMapped:false});v.render();
    },{labels:state[pass],pass});
    await page.screenshot({path:path.join(OUT,frameId+'-'+pass+'.png'),clip:state.clip});
    await page.evaluate(()=>{const v=fullCommonWorkbench.motion().viewer;v.mesh.geometry.dispose();v.mesh.material.dispose();v.mesh.geometry=__semanticSaved.geometry;v.mesh.material=__semanticSaved.material;for(const o of __semanticSaved.visible)o.visible=true;window.__semanticSaved=null;v.render();});
   }
   state.positionsFile=frameId+'-positions.f32';fs.writeFileSync(path.join(OUT,state.positionsFile),Buffer.from(new Float32Array(state.positions).buffer));delete state.positions;
   if(data.rows.length===0)data.topology={faces:state.faces,components:state.components,regions:state.regions,bodyCount:state.bodyCount,gnmMeta:state.gnmMeta};
   delete state.faces;delete state.components;delete state.regions;delete state.gnmMeta;data.rows.push(state);
  }}
  await page.evaluate(a=>{if(window.__light)__light.dispose();if(window.__appearance)__appearance.dispose();fullCommonWorkbench.restore(a);},original);
  assert.deepEqual(await page.evaluate(()=>fullCommonWorkbench.archive()),original);assert.equal(errors.length,0);
  data.originalArchiveRestored=true;data.errors=errors;fs.writeFileSync(path.join(OUT,'native-contour-response.json'),JSON.stringify(data));
 }catch(e){fs.writeFileSync(path.join(OUT,'failure.json'),JSON.stringify({error:e.stack}));throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
