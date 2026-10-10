const assert=require('assert/strict'),fs=require('fs');
module.exports=async function preflight(page,out){
 const report={checks:[],errors:[]},original=await page.evaluate(()=>fullCommonWorkbench.archive());
 const probe=()=>page.evaluate(async()=>{
  cinemaWorkbench.render();const m=__IDENTITY_QA__.model(),v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
  gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);if(gl.getError()!==gl.NO_ERROR)throw Error('Preflight framebuffer read failed');
  const hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),v=>v.toString(16).padStart(2,'0')).join('');
  return{pixels:await hash(data),geometry:await hash(m.positions),index:await hash(m.faces),archive:fullCommonWorkbench.archive(),camera:v.cameraState(),identityFields:m.identityLab.maps.report,cinema:cinemaWorkbench.report(),signatureCoherent:m.identityLab.mapSignature===JSON.stringify(m.identityLab.traits)};
 });
 const check=(name,condition)=>{report.checks.push({name,pass:!!condition});assert(condition,name);};
 try{
  await page.evaluate(()=>{identityWorkbench.skinRecipe('mature');cinemaWorkbench.view('face');});report.mature=await probe();
  check('current 42 identity curves reach the new field immediately',report.mature.identityFields.wrinkleCurves===42&&report.mature.cinema.fields.paths===42&&report.mature.signatureCoherent);
  check('folds contain a real negative trough and positive shoulders',report.mature.cinema.fields.minMM<0&&report.mature.cinema.fields.maxMM>0);
  await page.evaluate(a=>fullCommonWorkbench.restore(a),original);report.restoredClean=await probe();
  check('restoring clean profile leaves no stale wrinkle height',report.restoredClean.identityFields.wrinkleCurves===0&&report.restoredClean.cinema.fields.paths===0&&report.restoredClean.cinema.fields.minMM===0&&report.restoredClean.cinema.fields.maxMM===0);
  await page.evaluate(()=>{cinemaWorkbench.preset('dry');cinemaWorkbench.set({poreSize:1.25,oilFilm:.22});});report.before=await probe();
  await page.evaluate(()=>cinemaWorkbench.preset('oily'));report.changed=await probe();
  await page.evaluate(a=>fullCommonWorkbench.restore(a),report.before.archive);report.after=await probe();
  check('saved surface settings are restored exactly',JSON.stringify(report.before.archive)===JSON.stringify(report.after.archive));
  check('saved geometry is restored exactly',report.before.geometry===report.after.geometry&&report.before.index===report.after.index);
  check('saved surface frame is restored exactly',report.before.pixels===report.after.pixels);
  report.pass=true;
 }catch(e){report.pass=false;report.errors.push(e.stack);await page.screenshot({path:out+'/archive-preflight-failure.png'}).catch(()=>{});throw e;}
 finally{await page.evaluate(a=>fullCommonWorkbench.restore(a),original);fs.writeFileSync(out+'/archive-preflight.json',JSON.stringify(report,null,2));console.log('ET14_PREFLIGHT',JSON.stringify({pass:report.pass,checks:report.checks,errors:report.errors}));}
};
