const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),fs=require('fs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),p=await b.newPage({viewport:{width:1600,height:1150}}),r={errors:[],variants:[]};p.setDefaultTimeout(180000);p.on('pageerror',e=>r.errors.push(e.message));try{
 await p.goto('http://127.0.0.1:8897/MP05-Continuous-Demand-R01/candidate-r08/?look=D01');await p.waitForFunction(()=>window.__MP05__?.debug().physics?.running);
 await p.evaluate(async()=>{__MP05__.pause();await __MP05__.debug().physics.idle();});
 for(const [scale,packing] of [[4,1.08],[6,1.08],[8,1.08]]){
  await p.evaluate(async([scale,packing])=>{await __MP05__.setParameters('top',{weaveScale:scale,packing});await __MP05__.setParameters('bottom',{weaveScale:scale,packing});const d=__MP05__.debug();await d.physics.reset();__MP05__.frame('whole','front');d.lighting.preset('neutral');},[scale,packing]);await p.waitForTimeout(1800);
  const label='s'+scale+'-p'+packing;await p.locator('#canvas').screenshot({path:__dirname+'/R08_review_'+label+'.png'});
  r.variants.push({scale,packing,audit:await p.evaluate(()=>__MP05__.audit())});
  if(scale===6){await p.evaluate(()=>{const d=__MP05__.debug();d.viewer.mesh.visible=false;d.lighting.dirty();d.viewer.render();});await p.waitForTimeout(500);await p.locator('#canvas').screenshot({path:__dirname+'/R08_review_'+label+'_no-body.png'});await p.evaluate(()=>{const d=__MP05__.debug();d.viewer.mesh.visible=true;d.lighting.dirty();d.viewer.render();});}
  console.log('REVIEW',label);
 }
 }catch(e){r.failure=e.stack;console.error(e);}finally{fs.writeFileSync(__dirname+'/r08-material-review.json',JSON.stringify(r,null,2));await b.close();}})();
