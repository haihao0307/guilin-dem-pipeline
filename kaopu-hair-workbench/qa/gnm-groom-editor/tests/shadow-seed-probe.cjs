'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{execFileSync}=require('child_process'),{pathToFileURL}=require('url');
module.exports=async function(browser,inputUrl,out){
 const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');fs.mkdirSync(out,{recursive:true});
 const result={passed:false,visualAcceptance:false,scope:'Two controlled stochastic-occupancy seed offsets; no geometry, light, bias, map or filter change',checks:[],errors:[],frames:[],executedRuntime:{}};let context,page,temp;
 const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
 const check=(name,passed,detail)=>{result.checks.push({name,passed:!!passed,detail});save();console.log('[Shadow seed]',passed?'PASS':'FAIL',name);if(!passed)throw Error(name+' '+JSON.stringify(detail));};
 try{
  const cert=JSON.parse(fs.readFileSync(path.join(root,'EAR-RUNTIME-CERTIFICATE.json')));result.contactAcceptance=cert.contactAcceptance;
  let url=inputUrl;if(url.startsWith('file:')){temp=fs.mkdtempSync(path.join(os.tmpdir(),'gnm-shadow-seed-'));const target=path.join(temp,'experiment.html');result.offline=JSON.parse(execFileSync('python3',[path.join(root,'tools/build-experiment-offline.py'),'--output',target,'--assets-dir',process.env.GNM_ASSETS_DIR||path.join(temp,'cache'),'--download'],{encoding:'utf8',timeout:180000,maxBuffer:2000000}));url=pathToFileURL(target).href;}
  context=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  const files=['experiment.html','experiment.css','src/experiment.js','src/FiberMaterial.js','src/TeacherGroomBinding.js','data/teacher-groom.js'],expected=Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))])),pending=[];
  if(url.startsWith('http')){
   const deadline=Date.now()+480000;let ready=false;
   do{const pairs=await Promise.all(files.map(async f=>{const r=await context.request.get(new URL(f,url).href);return[f,{status:r.status(),sha256:sha(await r.body())}];}));result.served=Object.fromEntries(pairs);ready=files.every(f=>result.served[f].status===200&&result.served[f].sha256===expected[f]);if(ready)break;await page.waitForTimeout(10000);}while(Date.now()<deadline);
   check('complete served runtime bytes match',ready,result.served);
   page.on('response',r=>{const f=files.find(f=>new URL(f,url).href===r.url());if(f)pending.push(r.body().then(b=>result.executedRuntime[f]={status:r.status(),sha256:sha(b)}).catch(e=>result.executedRuntime[f]={error:String(e)}));});
  }
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.groomStudy?.ready||!document.getElementById('error').hidden,null,{timeout:180000});check('real groom and shaders start',await page.evaluate(()=>!!groomStudy.ready));
  if(url.startsWith('http')){await Promise.all(pending);check('actual browser responses match source',files.every(f=>result.executedRuntime[f]?.status===200&&result.executedRuntime[f].sha256===expected[f]),result.executedRuntime);}
  const defaultFrame=await page.evaluate(()=>{groomStudy.freeze();const c=document.getElementById('canvas'),g=c.getContext('webgl2'),a=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,a);let hash=2166136261;for(let i=0;i<a.length;i+=4)hash=Math.imul(hash^a[i]^a[i+1]^a[i+2],16777619)>>>0;return{hash,glError:g.getError(),d:groomStudy.diagnostics()};});result.defaultFrame=defaultFrame;check('zero-offset default image equals previously recorded1d6 frame',defaultFrame.hash===977755421&&defaultFrame.glError===0,{actual:defaultFrame.hash,expected:977755421});
  await page.evaluate(()=>{groomStudy.freeze();groomStudy.setCamera('three');groomStudy.setLight('both');groomStudy.setShadows(true);groomStudy.setShadowFilter('soft');groomStudy.setShadowCasters('hair');groomStudy.setShadowSeedOffset(0);});
  async function sample(name){await page.evaluate(()=>groomStudy.freeze());const v=await page.evaluate(()=>{const c=document.getElementById('canvas'),g=c.getContext('webgl2'),a=new Uint8Array(g.drawingBufferWidth*g.drawingBufferHeight*4);g.readPixels(0,0,g.drawingBufferWidth,g.drawingBufferHeight,g.RGBA,g.UNSIGNED_BYTE,a);let hash=2166136261;for(let i=0;i<a.length;i++)hash=Math.imul(hash^a[i],16777619)>>>0;return{hash,glError:g.getError(),d:groomStudy.diagnostics()};});await page.locator('#canvas').screenshot({path:path.join(out,name+'.png')});v.image=name+'.png';result.frames.push(v);save();return v;}
  const base=await sample('01-hair-only-seed-0');check('actual neutral buffers equal audited seed724 Three result',base.d.model.positionHash===cert.states.neutral.modelPositionHash&&JSON.stringify(base.d.geometryHashes)===JSON.stringify(cert.states.neutral.geometryHashes));
  for(const offset of [.271,.619]){
   await page.evaluate(v=>groomStudy.setShadowSeedOffset(v),offset);const frame=await sample('02-hair-only-seed-'+Math.round(offset*1000));
   check('seed '+offset+' preserves curves, lamps, bias and filter',JSON.stringify(frame.d.geometryHashes)===JSON.stringify(base.d.geometryHashes)&&JSON.stringify(frame.d.shadowCameras)===JSON.stringify(base.d.shadowCameras)&&frame.d.shadowFilterType===base.d.shadowFilterType&&JSON.stringify(frame.d.shadowCasting)===JSON.stringify(base.d.shadowCasting));
   check('seed '+offset+' reaches actual depth uniforms',frame.d.shadowSeedSamples.length===2&&frame.d.shadowSeedSamples.every((x,i)=>Object.keys(x.seeds).length===2&&Object.keys(x.seeds).every(k=>Math.abs(x.seeds[k]-base.d.shadowSeedSamples[i].seeds[k]-offset)<1e-7)),frame.d.shadowSeedSamples);
   check('seed '+offset+' changes actual shadow pixels',frame.hash!==base.hash,{before:base.hash,after:frame.hash});
  }
  await page.evaluate(()=>groomStudy.setShadowSeedOffset(0));const restored=await sample('03-hair-only-seed-restored');check('seed zero restores exact image',restored.hash===base.hash);check('all real GL and JS checks',result.errors.length===0&&result.frames.every(f=>f.glError===0),result.errors);result.passed=true;
 }catch(e){result.failure=e.stack;if(page)try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});}catch{}}
 finally{if(context)try{await context.close();}catch(e){result.errors.push(String(e));result.passed=false;}if(temp)fs.rmSync(temp,{recursive:true,force:true});save();}
 return result;
};
