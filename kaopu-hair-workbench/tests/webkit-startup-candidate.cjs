const fs=require('fs'),path=require('path');
module.exports=async function(browser,{engine,kind,base,assetBase,modelBytes,baseline,output}){
 const api=kind==='gnm-groom-editor'?'groomStudy':'gnmStudy',file=kind==='gnm-groom-editor'?'experiment.html':'index.html';
 const result={engine,kind,physicalIPhoneTested:false,fullRegressionPassed:false,productionRuntimeModified:false,checks:[],errors:[],passed:false};
 const save=()=>fs.writeFileSync(path.join(output,engine+'-'+kind+'-candidate.json'),JSON.stringify(result,null,2));
 const check=(name,pass,detail)=>{result.checks.push({name,pass:!!pass,detail});save();if(!pass)throw Error(name+' '+JSON.stringify(detail));};
 let context;
 async function create(mode){
  context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
  await context.addInitScript(mode=>{
   window.__hairFault=mode;window.__hairContexts=[];
   const original=HTMLCanvasElement.prototype.getContext,query=WebGL2RenderingContext.prototype.getShaderPrecisionFormat;
   HTMLCanvasElement.prototype.getContext=function(...args){if(args[0]==='webgl2'&&window.__hairFault==='context')return null;const gl=original.apply(this,args);if(args[0]==='webgl2'&&gl&&!window.__hairContexts.includes(gl))window.__hairContexts.push(gl);return gl;};
   WebGL2RenderingContext.prototype.getShaderPrecisionFormat=function(...args){if(window.__hairFault==='high'||(window.__hairFault==='medium'&&args[1]===this.MEDIUM_FLOAT))return null;return query.apply(this,args);};
  },mode);
  let requests=0;await context.route(assetBase+'*',async route=>{requests++;await route.fulfill({body:modelBytes[new URL(route.request().url()).pathname.split('/').pop()],contentType:'application/octet-stream'});});
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(String(e)));return {page,requests:()=>requests};
 }
 async function wait(page,phase){await page.waitForFunction(({api,phase})=>window[api]?.graphicsDiagnostics?.().phase===phase,{api,phase},{timeout:180000});}
 async function probe(page){return page.evaluate(api=>{
  const app=window[api];app.render();const gl=document.getElementById('canvas').getContext('webgl2'),a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);
  const hash=a=>{let h=2166136261;for(const b of a)h=Math.imul(h^b,16777619)>>>0;return h;};const positions=new Float32Array(app.getPositions());return {hash:hash(a),positionHash:hash(new Uint8Array(positions.buffer)),error:gl.getError(),lost:gl.isContextLost(),graphics:app.graphicsDiagnostics(),liveContexts:window.__hairContexts.filter(x=>!x.isContextLost()).length,canvases:document.querySelectorAll('canvas').length};
 },api);}
 try{
  let r=await create('medium');await r.page.goto(base+'/qa/'+kind+'/'+file,{waitUntil:'domcontentloaded'});await wait(r.page,'error');
  const rejected=await r.page.evaluate(api=>window[api].graphicsDiagnostics(),api);
  check('unchanged baseline rejects unnecessary medium-null probe',rejected.attempts===2&&rejected.lastError?.code==='graphics-init'&&r.requests()===0,rejected);await context.close();context=null;
  r=await create('high');await r.page.goto(base+'/candidate/qa/'+kind+'/'+file,{waitUntil:'domcontentloaded'});await wait(r.page,'error');
  const failed=await r.page.evaluate(api=>window[api].graphicsDiagnostics(),api);
  check('candidate still refuses truly unavailable high precision with exact stage',failed.attempts===2&&failed.lastError?.code==='precision-unavailable'&&failed.lastError.stage==='precision-vertex-high'&&r.requests()===0,failed);
  await r.page.evaluate(()=>{window.__hairFault='medium';for(let i=0;i<3;i++)document.getElementById('graphicsRetry').click();});await wait(r.page,'ready');
  const initial=await probe(r.page);result.initial=initial;
  check('candidate renders actual unchanged model and pixels with valid highp and null unused medium',initial.hash===baseline.hash&&initial.positionHash===baseline.positionHash&&initial.error===0&&!initial.lost,{baseline,initial});
  check('rapid retry creates only one live context',initial.graphics.attempts===3&&initial.liveContexts===1&&initial.canvases===1,initial.graphics);
  for(const action of ['context-loss','page-return']){
   const before=await r.page.evaluate(api=>window[api].graphicsDiagnostics().recoveries,api);
   if(action==='context-loss')await r.page.evaluate(()=>{const g=document.getElementById('canvas').getContext('webgl2');const e=g.getExtension('WEBGL_lose_context');if(!e)throw Error('WEBGL_lose_context unavailable');e.loseContext();});
   else{await r.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await r.page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));}
   await r.page.waitForFunction(({api,before})=>window[api]?.graphicsDiagnostics?.().phase==='ready'&&window[api].graphicsDiagnostics().recoveries>before,{api,before},{timeout:180000});
   const now=await probe(r.page);check(action+' keeps original pixels/model and one context',now.hash===initial.hash&&now.positionHash===initial.positionHash&&now.error===0&&!now.lost&&now.liveContexts===1&&now.canvases===1,now);
  }
  check('restoration reuses the two verified model downloads',r.requests()===2,{requests:r.requests()});
  check('no uncaught candidate exceptions',result.errors.length===0,result.errors);
  await r.page.screenshot({path:path.join(output,engine+'-'+kind+'-candidate-recovered.png'),fullPage:true,timeout:60000});result.passed=true;
 }catch(e){result.failure=String(e.stack||e);}finally{await context?.close();save();}
 return result;
};
