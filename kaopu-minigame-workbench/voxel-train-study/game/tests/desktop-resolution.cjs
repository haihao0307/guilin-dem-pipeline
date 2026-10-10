const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),{chromium}=require('playwright');
const out='desktop-resolution',candidate=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/',published='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/',classic=new URL('../?layout=immersive',published).href;
fs.mkdirSync(out,{recursive:true});
const gitHash=s=>crypto.createHash('sha1').update(Buffer.from('blob '+Buffer.byteLength(s)+'\0')).update(s).digest('hex');
(async()=>{
 const browser=await chromium.launch(),results=[],errors=[];
 try{
  for(const config of [{width:1920,height:1000,dpr:1},{width:2048,height:1016,dpr:1},{width:2048,height:1016,dpr:2},{width:2560,height:1336,dpr:2}]){
   for(const [variant,url] of [['published-driver',published],['candidate-clear',candidate],['classic-reference',classic]]){
    const context=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.dpr}),page=await context.newPage();page.on('pageerror',e=>errors.push({variant,config,error:e.message}));
    await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__trainDriver?.ready||window.__voxelTrain?.ready);
    if(variant==='classic-reference')await page.evaluate(()=>{__voxelTrain.setTime(0);});else await page.locator('#startGame').click();
    await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(150);
    const metrics=await page.evaluate(()=>{
     const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),gl=c.getContext('webgl2'),state=window.__trainDriver?.getState()||window.__voxelTrain.getState();
     return{devicePixelRatio,cssWidth:c.clientWidth,cssHeight:c.clientHeight,screenWidth:r.width,screenHeight:r.height,canvasWidth:c.width,canvasHeight:c.height,drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],antialias:gl.getContextAttributes().antialias,imageRendering:getComputedStyle(c).imageRendering,renderRatio:state.renderRatio,qualityMode:state.qualityMode,revision:state.viewSettings?.frameRevision,renderer:state.rendererName,maxRenderbuffer:gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)};
    });
    if(variant==='candidate-clear'){
     assert.equal(metrics.qualityMode,'clear');assert.equal(metrics.renderRatio,config.dpr);assert(Math.abs(metrics.canvasWidth-metrics.cssWidth*config.dpr)<=1);assert(Math.abs(metrics.canvasHeight-metrics.cssHeight*config.dpr)<=1);assert.equal(metrics.antialias,true);assert.equal(metrics.imageRendering,'auto');
    }else if(variant==='published-driver')assert(metrics.canvasWidth<=Math.max(1101,metrics.cssWidth*.65+1),'Baseline matches its width limit / adaptive floor');
    const point=await page.evaluate(async()=>{
     const c=document.querySelector('canvas'),r=c.getBoundingClientRect();let camera;
     if(window.__voxelTrain)camera=__voxelTrain.camera;else{const THREE=await import(new URL('../vendor/three.module.js',location.href).href),v=__trainDriver.getState().viewSettings;camera=new THREE.PerspectiveCamera(32,c.clientWidth/c.clientHeight,.1,180);camera.position.fromArray(v.position);camera.zoom=v.zoom;camera.updateProjectionMatrix();camera.lookAt(...v.target);camera.updateMatrixWorld();}
     const THREE=await import(new URL(window.__voxelTrain?'./vendor/three.module.js':'../vendor/three.module.js',location.href).href),p=new THREE.Vector3(0,2,0).project(camera);
     return{x:Math.max(0,Math.min(innerWidth-240,r.x+(p.x+1)*r.width/2-120)),y:Math.max(0,Math.min(innerHeight-200,r.y+(1-p.y)*r.height/2-100))};
    });
    const stem=variant+'-'+config.width+'x'+config.height+'-dpr'+config.dpr;await page.screenshot({path:out+'/'+stem+'-detail.png',clip:{...point,width:240,height:200},timeout:30000});
    if(config.width===2048)await page.screenshot({path:out+'/'+stem+'.png',timeout:30000});
    results.push({variant,url,config,...metrics});console.log('RESOLUTION '+JSON.stringify(results.at(-1)));await context.close();
   }
  }
  const api=await browser.newContext(),r04=await(await api.request.get('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/2ac350c3b717b8bc2eb3df81588935b40d845358/kaopu-minigame-workbench/voxel-train-study/game/app.mjs')).text(),r05=await(await api.request.get(new URL('./app.mjs',published).href)).text();
  const policy=s=>s.split('\n').filter(l=>/function resize\(|const next=frameMs>48/.test(l)).map(l=>l.includes('function resize')?l.slice(l.indexOf('maxRenderRatio='),l.indexOf('renderer.setPixelRatio')):l.match(/const next=frameMs>48[^;]+;/)?.[0]);assert.deepEqual(policy(r04),policy(r05));await api.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({status:'passed',results,errors,publishedDriverSha:gitHash(r05),r04SourceSha:gitHash(r04),r04AndR05ResolutionPolicyIdentical:true,policy:policy(r05),candidateNativeDprVerified:true},null,2));
 }catch(error){fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(error),stack:error.stack,results,errors},null,2));throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
