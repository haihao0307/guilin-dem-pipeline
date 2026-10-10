/* Approved official CI only. Native inputs and production clock, with read-only
 * WebGL allocation/render observation. No Session placement or artificial dt. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {clickTarget}=require('../../tests/browser-controls.cjs');
const drive=require('./native-first-leg.cjs');
const out=path.resolve(process.env.TRAIN_QA_OUT||'train-r18-results/browser'),base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/r18/';fs.mkdirSync(out,{recursive:true});
const report={pass:false,commit:process.env.GITHUB_SHA,base,environment:'Ubuntu24.04 Chromium Playwright1.57 ANGLE SwiftShader software rasterizer; not physical-device performance',fixtureStateWrites:false,errors:[],network:[],sourceHashes:[],screenshots:[]};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),write=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
function observe(){
 const q=window.__r18GL={contexts:[],frames:[],samples:[],inputs:[],shaderErrors:[]};
 for(const event of ['keydown','keyup','click'])document.addEventListener(event,e=>{if(q.inputs.length<2000)q.inputs.push({type:event,key:e.key,id:e.target?.id,trusted:e.isTrusted,at:performance.now()});},true);
 const original=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();HTMLCanvasElement.prototype.getContext=function(...args){const gl=original.apply(this,args);if(!gl||!/^webgl/.test(args[0])||seen.has(gl))return gl;seen.add(gl);
  const c={created:0,deleted:0,live:0,peak:0,liveBytes:0,peakBytes:0};q.contexts.push(c);const buffers=new Map(),bindings=new Map();
  const create=gl.createBuffer.bind(gl),del=gl.deleteBuffer.bind(gl),bind=gl.bindBuffer.bind(gl),data=gl.bufferData.bind(gl),link=gl.linkProgram.bind(gl);
  gl.createBuffer=()=>{const b=create();buffers.set(b,0);c.created++;c.live=buffers.size;c.peak=Math.max(c.peak,c.live);return b;};
  gl.deleteBuffer=b=>{if(buffers.has(b)){c.liveBytes-=buffers.get(b);buffers.delete(b);c.deleted++;c.live=buffers.size;}return del(b);};
  gl.bindBuffer=(target,b)=>{bindings.set(target,b);return bind(target,b);};
  gl.bufferData=(...v)=>{const b=bindings.get(v[0]),a=v[1],bytes=typeof a==='number'?a:(v[4]?v[4]*a.BYTES_PER_ELEMENT:a?.byteLength||0);if(b&&buffers.has(b)){c.liveBytes+=bytes-buffers.get(b);buffers.set(b,bytes);c.peakBytes=Math.max(c.peakBytes,c.liveBytes);}return data(...v);};
  gl.linkProgram=p=>{const x=link(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))q.shaderErrors.push(gl.getProgramInfoLog(p));return x;};return gl;
 };
}
const observer=`\n;(()=>{const qa=window.__r18GL,old=renderer.render.bind(renderer);let lastBin=-1;renderer.render=function(...args){const t=performance.now();const r=old(...args);qa.frames.push(performance.now()-t);if(qa.frames.length>2000)qa.frames.shift();const v=game.view(),d=world.streetDistrict.proof,bin=Math.floor(v.distance/10);if(bin!==lastBin){lastBin=bin;qa.samples.push({distance:v.distance,elapsed:v.elapsed,phase:v.phase,street:structuredClone(d),rendererMemory:{...renderer.info.memory},glBuffers:structuredClone(qa.contexts)});}return r;};window.__r18Read=()=>({glError:gl.getError(),memory:{...renderer.info.memory},programs:renderer.info.programs.length,street:structuredClone(world.streetDistrict.proof),chunks:world.streetDistrict.handles.map(h=>({id:h.score.object.id,detail:h.score.performance.detail,time:h.state.time,disposed:h.disposed})),clock:game.elapsed,gl:structuredClone(qa.contexts),frames:qa.frames.slice(),samples:qa.samples.slice(),inputs:qa.inputs.slice(),shaderErrors:qa.shaderErrors.slice()});})();`;
(async()=>{let browser,page;try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(90000);await page.addInitScript(observe);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const pending=[];page.on('response',r=>{const u=new URL(r.url());if(r.status()>=400)report.network.push({url:r.url(),status:r.status()});if(u.origin===new URL(base).origin&&/\.(mjs|js|json|css)$/.test(u.pathname)){pending.push(r.body().then(b=>{const file=path.resolve(u.pathname.slice(1)),exists=fs.existsSync(file),isApp=u.pathname.endsWith('/r18/app.mjs');const disk=exists?fs.readFileSync(file):null;report.sourceHashes.push({path:u.pathname,bytes:b.length,sha256:sha(b),sourceSHA256:disk?sha(disk):null,matches:disk?sha(b)===(isApp?sha(Buffer.concat([disk,Buffer.from(observer)])):sha(disk)):false,readOnlyObserverSuffix:isApp});}).catch(e=>report.errors.push('response: '+e)));}});
 await page.route(new URL('app.mjs',base).href,async route=>{const response=await route.fetch();await route.fulfill({response,body:await response.text()+observer});});
 const nav=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>__trainDriver?.ready&&__trainDriver.getState().streetDistrict.status==='active'&&!__trainDriver.getState().streetDistrict.pending,{},{timeout:180000});report.readyMs=Date.now()-nav;
 assert.equal(await page.evaluate(()=>__trainDriver.version),'kcr-kst1-r18');
 const checkpoint=async name=>{
  const wasPaused=await page.evaluate(()=>__trainDriver.getState().paused);if(!wasPaused){await page.keyboard.press('p');await page.waitForFunction(()=>__trainDriver.getState().paused);}
  await page.waitForFunction(()=>!__trainDriver.getState().streetDistrict.pending,{},{timeout:90000});
  // Hide only pause-sheet presentation during proof PNG. Simulation remains
  // paused by its real P control; geometry, camera and rendering are untouched.
  const style=await page.addStyleTag({content:'#pauseScreen{visibility:hidden!important}'});
  const s=await page.evaluate(()=>({state:__trainDriver.getState(),observation:__r18Read()}));assert.equal(s.observation.glError,0);assert.equal(s.state.streetDistrict.status,'active');assert(s.state.streetDistrict.activeChunks.length<=16);assert(s.state.streetDistrict.metrics.expandedTriangles<=520000);assert(s.observation.chunks.every(c=>Math.abs(c.time-s.state.elapsed)<1e-8));
  const png=await page.screenshot({path:path.join(out,name+'.png'),timeout:90000});assert(png.length>12000);const after=await page.evaluate(()=>__trainDriver.getState());assert.equal(after.distance,s.state.distance);assert.equal(after.elapsed,s.state.elapsed);
  report.screenshots.push({name,pngSHA256:sha(png),pngBytes:png.length,source:'Actual candidate WebGL; native travelled position paused with P; pause overlay hidden only',...s});write();console.log('R18 capture',name,s.state.distance,s.state.streetDistrict.metrics.expandedTriangles);
  await style.evaluate(el=>el.remove());if(!wasPaused){await page.keyboard.press('p');await page.waitForFunction(()=>!__trainDriver.getState().paused);}
 };
 report.nativeJourney=await drive(page,clickTarget,checkpoint);
 const final=await page.evaluate(()=>({state:__trainDriver.getState(),observation:__r18Read()}));report.final=final;
 assert.equal(final.state.stats.stops,2);assert.equal(final.state.stats.missed,0);assert(final.state.distance>=695.6965&&final.state.distance<=707);assert(final.observation.samples.length>=60,'Actual native trip must observe most 10m bins');assert(final.observation.samples.every(x=>x.street.activeChunks.length>0&&x.street.status!=='error'));assert(final.state.streetDistrict.loadCount>37&&final.state.streetDistrict.unloadCount>25);assert(final.observation.gl[0].deleted>100,'Actual streaming must delete driver buffers');assert.deepEqual(final.observation.shaderErrors,[]);assert.equal(final.observation.glError,0);
 await Promise.all(pending);assert(report.sourceHashes.length>50);assert(report.sourceHashes.every(x=>x.matches),'Every candidate/shared runtime response must match this checkout bytes');assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);
 const f=final.observation.frames.slice().sort((a,b)=>a-b);report.renderMs={median:f[Math.floor(f.length*.5)],p95:f[Math.floor(f.length*.95)],max:f.at(-1),count:f.length,boundary:'CPU wall time around renderer.render on software SwiftShader; not hardware GPU frame rate'};report.pass=true;
 }catch(e){report.failure=e.stack;console.error(e);if(page)await page.screenshot({path:path.join(out,'failure.png'),timeout:90000}).catch(()=>{});}finally{write();if(browser)await browser.close();}if(!report.pass)process.exitCode=1;})();
