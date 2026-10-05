'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{execFileSync}=require('child_process'),{pathToFileURL}=require('url');
/** FILE-only visual preflight. Deliberately compact; not the full acceptance suite. */
module.exports=async function(browser,inputUrl,out){
 const root=path.resolve(__dirname,'..');fs.mkdirSync(out,{recursive:true});
 const report={passed:false,scope:'FILE-only GNM female skin visual preflight; two neutral identities, front and eye view',fullRegressionPassed:false,contactAcceptance:false,notTen24:true,checks:[],errors:[],frames:[]};
 const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
 const check=(name,ok,detail)=>{report.checks.push({name,pass:!!ok,detail});save();if(!ok)throw Error(name+' '+JSON.stringify(detail));};let context;
 try{
  if(!inputUrl.startsWith('file:'))throw Error('Female preview is FILE-only; public loading is not authorized for this stage');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gnm-female-preview-')),target=path.join(temp,'experiment.html');
  report.offline=JSON.parse(execFileSync('python3',[path.join(root,'tools/build-experiment-offline.py'),'--output',target,'--assets-dir',process.env.GNM_ASSETS_DIR||path.join(temp,'cache'),'--download'],{encoding:'utf8',timeout:240000,maxBuffer:2000000}));
  context=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:1,hasTouch:true});const page=await context.newPage();page.setDefaultTimeout(240000);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await page.goto(pathToFileURL(target).href,{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.groomStudy?.ready||!document.getElementById('error').hidden,null,{timeout:300000});
  check('female skin page initializes in real WebGL',await page.evaluate(()=>!!window.groomStudy?.ready));
  const act=(name,arg)=>page.evaluate(({name,arg})=>groomStudy[name](arg),{name,arg});
  const shot=async(name)=>{const d=await page.evaluate(async()=>{let d=groomStudy.diagnostics(),p=new Float32Array(groomStudy.getPositions());const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',p)),x=>x.toString(16).padStart(2,'0')).join('');const gl=document.getElementById('canvas').getContext('webgl2'),pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let hash=2166136261,min=255,max=0;for(let i=0;i<pixels.length;i+=4){hash=Math.imul(hash^pixels[i]^pixels[i+1]^pixels[i+2],16777619)>>>0;min=Math.min(min,pixels[i],pixels[i+1],pixels[i+2]);max=Math.max(max,pixels[i],pixels[i+1],pixels[i+2]);}return {diagnostics:d,modelSha256:sha,pixelHash:hash,pixelRange:[min,max],glError:gl.getError()}});await page.locator('#canvas').screenshot({path:path.join(out,name+'.png')});report.frames.push({name,...d});save();return d};
  const first=await shot('female-neutral-a-three');
  check('official default female identity exact',first.modelSha256==='40bd3203296ee0bcb7eca1224272f96a07c450f9661cdf48ca2630b2228a70bc',first.modelSha256);
  check('skin shader compiled and drew nonblank pixels',first.diagnostics.skin.compiled>0&&first.glError===0&&first.pixelRange[1]-first.pixelRange[0]>30,{skin:first.diagnostics.skin,gl:first.glError,pixelRange:first.pixelRange});
  check('official UV expands only render geometry',first.diagnostics.uvRender.sourceVertices===17821&&first.diagnostics.uvRender.renderVertices===18437&&first.diagnostics.uvRender.maxPositionError===0&&first.diagnostics.uvRender.maxNormalError===0&&first.diagnostics.uvRender.triangleCornerMismatch===0,first.diagnostics.uvRender);
  check('eyes and mouth remain separate protected components',first.diagnostics.skin.regions.eyeVertices>0&&first.diagnostics.skin.regions.nonSkinMapProtected>0&&first.diagnostics.skin.skinMapsOnly,first.diagnostics.skin.regions);
  check('R8 hair shading remains active',first.diagnostics.opacity.enabled&&first.diagnostics.state.shadowMode==='layered'&&!first.diagnostics.opacity.lastError,first.diagnostics.opacity);
  check('roots remain on actual female head',first.diagnostics.femaleRootBinding.every(b=>b.maxRootBarycentricError<1e-6&&b.maxRootNormalOffsetError<1e-6),first.diagnostics.femaleRootBinding);
  await act('setCase','identity');const second=await shot('female-neutral-b-three');check('alternate neutral is a distinct official female identity',second.modelSha256==='d9b08db5e3c1790c8c84a2c7a83dbc3ef7c54cca9464082888303a8e369e3335'&&second.diagnostics.femaleIdentity.seed===20261006&&second.glError===0,second.modelSha256);
  await act('setCase','neutral');await act('setCamera','front');const front=await shot('female-neutral-a-front');check('front retains exact female head',front.modelSha256===first.modelSha256&&front.glError===0);
  await act('setEyeCamera');const eye=await shot('female-neutral-a-eye');check('eye close-up still compiles correctly',eye.glError===0&&eye.diagnostics.skin.compiled>0);
  check('no browser or shader errors',report.errors.length===0,report.errors);report.passed=true;save();return report;
 }catch(e){report.errors.push(e.stack||String(e));save();throw e}finally{await context?.close()}
};
