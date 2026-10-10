const assert=require('assert/strict'),fs=require('fs');
module.exports=async function preflight(page,out){
 const report={checks:[],errors:[]},original=await page.evaluate(()=>fullCommonWorkbench.archive());
 const probe=()=>page.evaluate(async()=>{
  cinemaWorkbench.render();const m=__IDENTITY_QA__.model(),v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
  gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);if(gl.getError()!==gl.NO_ERROR)throw Error('Preflight framebuffer read failed');
  const hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join('');
  const serialize=async value=>{
   if(value===null||['number','boolean','string','undefined'].includes(typeof value))return value??null;
   if(value.isTexture){const i=value.image;return{texture:true,type:value.type,format:value.format,colorSpace:value.colorSpace,minFilter:value.minFilter,magFilter:value.magFilter,generateMipmaps:value.generateMipmaps,width:i?.width,height:i?.height,depth:i?.depth,data:ArrayBuffer.isView(i?.data)?await hash(i.data):null};}
   if(value.toArray)return value.toArray();if(ArrayBuffer.isView(value))return{length:value.length,hash:await hash(value)};
   if(Array.isArray(value)&&value.length<100)return await Promise.all(value.map(serialize));return{class:value.constructor?.name};
  };
  const uniforms=async U=>{const a={};for(const[k,u]of Object.entries(U||{}))a[k]=await serialize(u.value);return a;};
  const attributes={};for(const[k,a]of Object.entries(v.mesh.geometry.attributes))attributes[k]={size:a.itemSize,count:a.count,hash:await hash(a.array)};
  const material={};for(const[k,x]of Object.entries(v.mesh.material))if(typeof x==='number'||typeof x==='boolean'||x?.isColor||x?.isVector2||x?.isVector3)material[k]=await serialize(x);
  const properties=v.renderer.properties.get(v.skin.material);
  const renderer={size:[gl.drawingBufferWidth,gl.drawingBufferHeight],toneMapping:v.renderer.toneMapping,exposure:v.renderer.toneMappingExposure,colorSpace:v.renderer.outputColorSpace,alpha:v.renderer.getClearAlpha(),target:!!v.renderer.getRenderTarget()};
  const lights=v.scene.children.filter(x=>x.isLight).map(x=>({type:x.type,intensity:x.intensity,position:x.position.toArray(),color:x.color.toArray(),groundColor:x.groundColor?.toArray(),matrix:x.matrixWorld.toArray()}));
  return{pixels:await hash(data),geometry:await hash(m.positions),index:await hash(m.faces),archive:fullCommonWorkbench.archive(),camera:v.cameraState(),projection:v.camera.projectionMatrix.toArray(),cameraMatrix:v.camera.matrixWorld.toArray(),meshMatrix:v.mesh.matrixWorld.toArray(),attributes,displayIndex:await hash(v.mesh.geometry.index.array),material,renderer,lights,nativeUniforms:await uniforms(v.skin.U),faceUniforms:await uniforms(v.skin.faceExtension.U),compiledUniforms:await uniforms(properties.uniforms),identityFields:m.identityLab.maps.report,cinema:cinemaWorkbench.report(),signatureCoherent:m.identityLab.mapSignature===JSON.stringify(m.identityLab.traits)};
 });
 const shot=async name=>{await page.locator('#canvas').screenshot({path:out+'/preflight-'+name+'.png'});};
 const check=(name,condition)=>{report.checks.push({name,pass:!!condition});assert(condition,name);};
 try{
  await page.evaluate(()=>{identityWorkbench.skinRecipe('mature');cinemaWorkbench.view('face');});report.mature=await probe();await shot('mature');
  check('current 42 identity curves reach the new field immediately',report.mature.identityFields.wrinkleCurves===42&&report.mature.cinema.fields.paths===42&&report.mature.signatureCoherent);
  check('folds contain a real negative trough and positive shoulders',report.mature.cinema.fields.minMM<0&&report.mature.cinema.fields.maxMM>0);
  await page.evaluate(a=>fullCommonWorkbench.restore(a),original);report.restoredClean=await probe();
  check('restoring clean profile leaves no stale wrinkle height',report.restoredClean.identityFields.wrinkleCurves===0&&report.restoredClean.cinema.fields.paths===0&&report.restoredClean.cinema.fields.minMM===0&&report.restoredClean.cinema.fields.maxMM===0);
  await page.evaluate(()=>{cinemaWorkbench.preset('dry');cinemaWorkbench.set({poreSize:1.25,oilFilm:.22});});report.before=await probe();await shot('before');
  await page.evaluate(()=>cinemaWorkbench.preset('oily'));report.changed=await probe();await shot('changed');
  await page.evaluate(a=>fullCommonWorkbench.restore(a),report.before.archive);report.after=await probe();await shot('after');report.afterSecondFrame=await probe();
  check('saved surface settings are restored exactly',JSON.stringify(report.before.archive)===JSON.stringify(report.after.archive));
  check('saved geometry is restored exactly',report.before.geometry===report.after.geometry&&report.before.index===report.after.index);
  check('saved surface frame is restored exactly',report.before.pixels===report.after.pixels);
  report.pass=true;
 }catch(e){report.pass=false;report.errors.push(e.stack);await page.screenshot({path:out+'/archive-preflight-failure.png'}).catch(()=>{});throw e;}
 finally{await page.evaluate(a=>fullCommonWorkbench.restore(a),original);fs.writeFileSync(out+'/archive-preflight.json',JSON.stringify(report,null,2));console.log('ET14_PREFLIGHT',JSON.stringify({pass:report.pass,checks:report.checks,errors:report.errors}));}
};
