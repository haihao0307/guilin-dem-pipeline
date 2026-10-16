const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const [folder='candidate-r08',look='D01',label='local',motionList='walk,run,jump']=process.argv.slice(2),url=folder.startsWith('https:')?folder+'?look='+look:'http://127.0.0.1:8897/MP05-Continuous-Demand-R01/'+folder+'/?look='+look;
 const r={url,look,label,started:new Date().toISOString(),errors:[],httpErrors:[],segments:[]};
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),p=await b.newPage({viewport:{width:1600,height:1150}});p.setDefaultTimeout(240000);
 p.on('pageerror',e=>r.errors.push(e.message));p.on('response',x=>{if(x.status()>=400&&!x.url().includes('favicon'))r.httpErrors.push({url:x.url(),status:x.status()});});
 try{
  await p.goto(url);await p.waitForFunction(()=>window.__MP05__?.debug().physics?.running);await p.waitForTimeout(5000);console.log('READY',label);
  r.device=await p.evaluate(()=>{const gl=__MP05__.debug().viewer.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
  await p.evaluate(()=>{const d=__MP05__.debug(),gl=d.viewer.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),begin=gl.beginQuery.bind(gl),end=gl.endQuery.bind(gl);let current;window.trace=[];gl.beginQuery=(target,q)=>{if(target===ext.TIME_ELAPSED_EXT)current={wall:performance.now(),sim:d.physics.frame.audit.simulationSeconds,solverMS:d.physics.frame.audit.solverMs,resamples:d.items.map(i=>i.solid.stats.resamples),triangles:d.items.map(i=>i.solid.stats.submittedYarnTriangles),atlas:d.items.map(i=>i.solid.stats.frameAtlasBytes)};return begin(target,q);};gl.endQuery=target=>{const out=end(target);if(target===ext.TIME_ELAPSED_EXT&&current){current.cpuMS=performance.now()-current.wall;trace.push(current);}return out;};});
  for(const motion of motionList.split(',')){
   await p.locator('[data-motion='+motion+']').click();if(motion==='jump')await p.evaluate(()=>{window.jumpRepeat=setInterval(()=>__MP05__.playMotion('jump'),2500);});await p.waitForTimeout(2500);
   const result=await p.evaluate(async()=>{const d=__MP05__.debug();trace.length=0;const t=performance.now(),sim=d.physics.frame.audit.simulationSeconds,f=d.viewer.frameGate.audit().completed;await new Promise(r=>setTimeout(r,12000));return{wallSeconds:(performance.now()-t)/1000,simulationSeconds:d.physics.frame.audit.simulationSeconds-sim,frames:d.viewer.frameGate.audit().completed-f,trace:trace.slice(),audit:__MP05__.audit()};});
   if(motion==='jump')await p.evaluate(()=>clearInterval(window.jumpRepeat));r.segments.push({motion,...result});console.log(label,motion,JSON.stringify({fps:result.frames/result.wallSeconds,error:result.audit.error,glError:result.audit.glError}));
  }
  await p.evaluate(async()=>{const a=__MP05__,d=a.debug();await d.physics.reset();a.frame('whole','front');d.lighting.preset('neutral');});await p.waitForTimeout(1500);
  await p.screenshot({path:__dirname+'/R08_'+label+'_full.png'});await p.locator('#canvas').screenshot({path:__dirname+'/R08_'+label+'_canvas.png'});
  r.final=await p.evaluate(()=>__MP05__.audit());r.completed=new Date().toISOString();
 }catch(e){r.failure=e.stack;console.error(e);await p.screenshot({path:__dirname+'/r08-'+label+'-failure.png'}).catch(()=>{});}finally{fs.writeFileSync(__dirname+'/r08-'+label+'.json',JSON.stringify(r,null,2));await b.close();}
})();
