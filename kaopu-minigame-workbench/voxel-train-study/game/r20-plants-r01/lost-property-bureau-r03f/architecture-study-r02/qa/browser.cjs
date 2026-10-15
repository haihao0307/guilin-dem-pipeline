'use strict';
// Executed only by the existing remote QA workflow. No workflow changes are needed.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const OUT=path.resolve('bureau-r03f-public-preview-results');
const ROOT=process.cwd(),PORT=8785;
const ENTRY='kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/lost-property-bureau-r03f/architecture-study-r02/';
const EXPECTED_VIEWS=['whole','street','hall','warehouse','tower','service','section','back'];
const FILE_PREFIX='architecture-r02';
fs.mkdirSync(OUT,{recursive:true});
const receipt={schema:'bureau-architecture-r02-browser/1',commit:process.env.GITHUB_SHA||null,
  startedUtc:new Date().toISOString(),status:'running',
  backend:'Chromium WebGL2 with SwiftShader launch flags; actual GL identification recorded below',
  userHardwareVerified:false,artisticAcceptance:false,noAutomaticRetry:true,
  viewport:{width:1280,height:900},functionalContracts:{},performanceContracts:{},
  performancePolicy:{sampleMilliseconds:2500,minimumFramesExclusive:5,
    explanation:'Preserves the previous >5 frames in a 2.5 second sample gate. A functional pass cannot hide a performance failure. Software-renderer figures do not certify user-device FPS.'},
  errors:[],consoleErrors:[],httpErrors:[],failedRequests:[],views:[],captures:[],performanceSamples:[]};
const save=()=>fs.writeFileSync(path.join(OUT,FILE_PREFIX+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const finiteCamera=c=>!!c&&Array.isArray(c.eye)&&c.eye.length===3&&c.eye.every(Number.isFinite)
  &&Array.isArray(c.target)&&c.target.length===3&&c.target.every(Number.isFinite)&&Number.isFinite(c.radius)&&c.radius>0;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const cameraChanged=(a,b)=>finiteCamera(a)&&finiteCamera(b)&&(distance(a.eye,b.eye)>1e-5||distance(a.target,b.target)>1e-5);
function contract(name,ok,details){receipt.functionalContracts[name]={pass:ok===true,...(details===undefined?{}:{details})};save();}
function quantiles(values){const a=values.filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);return a.length?{count:a.length,min:a[0],median:a[Math.floor((a.length-1)*.5)],p95:a[Math.floor((a.length-1)*.95)],max:a.at(-1)}:{count:0};}

const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    let filename=path.resolve(ROOT,'.'+pathname);
    if(filename!==ROOT&&!filename.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}
    if(fs.statSync(filename).isDirectory())filename=path.join(filename,'index.html');
    res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(filename));
  }catch{res.writeHead(404).end();}
});

async function snapshot(page){return page.evaluate(()=>{
  const a=window.__bureauArchitecture,info=a.rendererInfo();
  const from=(key)=>info[key]??a[key]??null;
  const planes=from('clippingPlanes');
  return {camera:a.camera(),frames:a.frames,view:a.view??a.currentView??null,renderer:info,
    roofsVisible:from('roofsVisible'),floorsVisible:from('floorsVisible'),
    cutHeight:from('cutHeight')??a.cut??null,
    clippingPlaneCount:Array.isArray(planes)?planes.length:(Number.isFinite(planes)?planes:null),
    contextLost:!!a.contextLost,
    controls:{roofs:document.getElementById('roofs')?.checked,floors:document.getElementById('floors')?.checked,
      cut:document.getElementById('cut')?.value,lightQuality:document.getElementById('light-quality')?.value}};
});}
async function nextFrames(page,previous,amount=2){await page.waitForFunction(({f,n})=>window.__bureauArchitecture.frames>=f+n,{f:previous,n:amount},{timeout:30000});}
async function capture(page,name){
  const ui=path.join(OUT,FILE_PREFIX+'-'+name+'-ui.png'),canvas=path.join(OUT,FILE_PREFIX+'-'+name+'-canvas.png');
  const uiBytes=await page.screenshot({path:ui,timeout:30000});
  const canvasBytes=await page.locator('body > canvas').first().screenshot({path:canvas,timeout:30000});
  receipt.captures.push({name,ui:path.basename(ui),canvas:path.basename(canvas),uiSha256:digest(uiBytes),canvasSha256:digest(canvasBytes)});save();
}
async function chooseView(page,name){
  const views=page.locator('#views');
  if(await views.evaluate(el=>el.tagName==='SELECT'))await views.selectOption(name);
  else await views.locator('[data-view="'+name+'"]').click();
}
async function pointForDrag(page){return page.evaluate(()=>{
  const canvas=document.querySelector('body > canvas');if(!canvas)throw Error('Missing body-level canvas');
  const r=canvas.getBoundingClientRect();
  for(const [u,v]of [[.64,.56],[.70,.72],[.48,.75],[.32,.6],[.73,.38],[.45,.45]]){
    const x=r.x+r.width*u,y=r.y+r.height*v,dx=Math.min(120,r.width*.1),dy=Math.min(48,r.height*.06);
    if([[x,y],[x+dx,y+dy],[x+dx*1.35,y+dy*1.25]].every(([a,b])=>a<innerWidth&&b<innerHeight&&document.elementFromPoint(a,b)===canvas))return{x,y,dx,dy};
  }throw Error('No unobstructed canvas drag path; do not test by dragging a UI panel');
});}

async function run(){
  let browser,page;
  save();
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,'127.0.0.1',resolve);});
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:receipt.viewport,deviceScaleFactor:1});
    page=await context.newPage();page.setDefaultTimeout(30000);
    page.on('pageerror',e=>{receipt.errors.push(e.stack||e.message);save();});
    page.on('console',m=>{if(m.type()==='error'){receipt.consoleErrors.push(m.text());save();}});
    page.on('response',r=>{if(r.status()>=400){receipt.httpErrors.push({status:r.status(),url:r.url()});save();}});
    page.on('requestfailed',r=>{receipt.failedRequests.push({url:r.url(),failure:r.failure()});save();});
    await page.addInitScript(()=>{
      window.__architectureQaContextLosses=[];
      document.addEventListener('webglcontextlost',e=>window.__architectureQaContextLosses.push({time:performance.now(),target:e.target?.tagName}),true);
    });
    const navigationStarted=Date.now();
    const response=await page.goto('http://127.0.0.1:'+PORT+'/'+ENTRY,{waitUntil:'domcontentloaded',timeout:60000});
    if(!response?.ok())throw Error('Candidate entry HTTP failure: '+response?.status());
    await page.waitForFunction(()=>window.__bureauArchitecture?.ready||window.__bureauArchitectureError,null,{timeout:120000});
    receipt.navigationToReadyMs=Date.now()-navigationStarted;
    const startupError=await page.evaluate(()=>window.__bureauArchitectureError||null);if(startupError)throw Error(startupError);
    receipt.api=await page.evaluate(()=>{
      const a=window.__bureauArchitecture;
      return{ready:a.ready,frames:a.frames,firstFrameMs:a.firstFrameMs,views:a.views,
        methods:['camera','setView','rendererInfo','passages'].map(name=>({name,present:typeof a[name]==='function'})),
        frameTimes:Array.isArray(a.frameTimes),proof:a.proof};
    });
    contract('apiReady',receipt.api.ready===true&&receipt.api.frames>=1&&receipt.api.methods.every(m=>m.present)&&receipt.api.frameTimes);
    contract('allExpectedViewDefinitions',Array.isArray(receipt.api.views)&&EXPECTED_VIEWS.every(v=>receipt.api.views.includes(v)),receipt.api.views);
    contract('firstFrameMeasured',Number.isFinite(receipt.api.firstFrameMs)&&receipt.api.firstFrameMs>=0,receipt.api.firstFrameMs);
    receipt.webgl=await page.evaluate(()=>{
      const canvas=document.querySelector('body > canvas'),gl=canvas?.getContext('webgl2');
      if(!gl)return{webgl2:false};const debug=gl.getExtension('WEBGL_debug_renderer_info');
      return{webgl2:gl instanceof WebGL2RenderingContext,lost:gl.isContextLost(),
        version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),
        unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,
        drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],glError:gl.getError()};
    });
    const initial=await snapshot(page);receipt.initial=initial;
    contract('realWebGL2Frame',receipt.webgl.webgl2&&!receipt.webgl.lost&&receipt.webgl.glError===0&&receipt.webgl.drawingBuffer.every(n=>n>0)&&initial.renderer.calls>0&&initial.renderer.triangles>0,receipt.webgl);
    contract('finiteInitialCamera',finiteCamera(initial.camera));
    contract('requiredControlsPresent',await page.locator('#views').count()===1&&await page.locator('#roofs').count()===1&&await page.locator('#floors').count()===1&&await page.locator('#cut').count()===1&&await page.locator('#light-quality').count()===1);
    await capture(page,'initial-whole');

    // Real pointer events, including an observation BEFORE releasing the button.
    const point=await pointForDrag(page);receipt.dragPoint=point;
    await page.mouse.move(point.x,point.y);const beforeDrag=await snapshot(page);
    await page.mouse.down();await page.mouse.move(point.x+point.dx,point.y+point.dy,{steps:16});await page.waitForTimeout(500);
    const held=await snapshot(page);receipt.drag={before:beforeDrag,held};
    contract('cameraMovesBeforePointerUp',cameraChanged(beforeDrag.camera,held.camera));
    contract('framesWhilePointerHeld',held.frames-beforeDrag.frames>=3,{frames:held.frames-beforeDrag.frames,minimum:3});
    await capture(page,'drag-held');
    await page.mouse.move(point.x+point.dx*1.35,point.y+point.dy*1.25,{steps:12});await page.mouse.up();
    await page.waitForTimeout(600);
    const beforeZoom=await snapshot(page);await page.mouse.wheel(0,-550);await page.waitForTimeout(600);const zoomIn=await snapshot(page);
    await page.mouse.wheel(0,550);await page.waitForTimeout(600);const zoomOut=await snapshot(page);
    receipt.zoom={before:beforeZoom,zoomIn,zoomOut};
    contract('wheelZoomIn',zoomIn.camera.radius<beforeZoom.camera.radius*.95);
    contract('wheelZoomOut',zoomOut.camera.radius>zoomIn.camera.radius*1.05);
    contract('framesDuringBothZoomDirections',zoomIn.frames>beforeZoom.frames&&zoomOut.frames>zoomIn.frames);
    await capture(page,'zoom-restored');

    for(const name of EXPECTED_VIEWS){
      const before=await snapshot(page);await chooseView(page,name);await nextFrames(page,before.frames);await page.waitForTimeout(350);
      const after=await snapshot(page);receipt.views.push({name,...after});
      contract('view_'+name,finiteCamera(after.camera)&&after.frames>before.frames&&(after.view===null||after.view===name));
      if(name!=='whole')contract('viewCameraChanged_'+name,cameraChanged(before.camera,after.camera));
      await capture(page,'view-'+name);
    }
    contract('allEightViewsExercised',receipt.views.length===EXPECTED_VIEWS.length);

    // Whole view must make hidden-layer checks observable in actual renderer state.
    await chooseView(page,'whole');await page.waitForTimeout(400);
    for(const [id,stateKey]of [['roofs','roofsVisible'],['floors','floorsVisible']]){
      const control=page.locator('#'+id);await control.setChecked(true);let before=await snapshot(page);await nextFrames(page,before.frames);before=await snapshot(page);
      await control.setChecked(false);await nextFrames(page,before.frames);const hidden=await snapshot(page);
      await capture(page,id+'-hidden');
      await control.setChecked(true);await nextFrames(page,hidden.frames);const restored=await snapshot(page);
      receipt[id+'Toggle']={before,hidden,restored};
      contract(id+'ActualVisibility',before[stateKey]===true&&hidden[stateKey]===false&&restored[stateKey]===true,
        {before:before[stateKey],hidden:hidden[stateKey],restored:restored[stateKey],note:'These fields must describe scene objects, not merely copy checkbox state.'});
      contract(id+'ChangeRenderedTriangles',hidden.renderer.triangles<before.renderer.triangles&&restored.renderer.triangles===before.renderer.triangles,
        {before:before.renderer.triangles,hidden:hidden.renderer.triangles,restored:restored.renderer.triangles});
    }
    const cut=page.locator('#cut');
    const cutRange=await cut.evaluate(el=>({min:Number(el.min||0),max:Number(el.max||35),step:Number(el.step||.1),original:Number(el.value)}));
    if(!Number.isFinite(cutRange.min)||!Number.isFinite(cutRange.max)||cutRange.max<=cutRange.min)throw Error('Invalid cut control range');
    const requested=4.8>cutRange.min&&4.8<cutRange.max?4.8:(cutRange.min+cutRange.max)/2;
    const step=Number.isFinite(cutRange.step)&&cutRange.step>0?cutRange.step:.1;
    const cutValue=cutRange.min+Math.round((requested-cutRange.min)/step)*step;
    const setCut=async value=>{await cut.evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);};
    await setCut(cutRange.max);let beforeCut=await snapshot(page);await nextFrames(page,beforeCut.frames);beforeCut=await snapshot(page);
    await setCut(cutValue);await nextFrames(page,beforeCut.frames);const clipped=await snapshot(page);await capture(page,'manual-section');
    await setCut(cutRange.max);await nextFrames(page,clipped.frames);const cutRestored=await snapshot(page);
    receipt.cut={range:cutRange,requested:cutValue,before:beforeCut,clipped,restored:cutRestored};
    const heightMatches=Number.isFinite(clipped.cutHeight)&&Math.abs(clipped.cutHeight-cutValue)<=Math.max(step*.51,1e-6);
    contract('cutAppliedToRenderer',heightMatches&&(clipped.clippingPlaneCount===null||clipped.clippingPlaneCount>0),{height:clipped.cutHeight,planes:clipped.clippingPlaneCount});
    contract('cutRestored',Number.isFinite(cutRestored.cutHeight)&&Math.abs(cutRestored.cutHeight-cutRange.max)<1e-6&&(cutRestored.clippingPlaneCount===null||cutRestored.clippingPlaneCount===0));
    await capture(page,'layers-and-cut-restored');

    receipt.passages=await page.evaluate(()=>window.__bureauArchitecture.passages());
    const passageList=Object.entries(receipt.passages||{});
    contract('passageProbesProvided',passageList.length===14);
    contract('allLateralPassageSamplesPresent',passageList.length===14&&passageList.every(([,p])=>Array.isArray(p.samples)&&p.samples.length===3&&[0,-.35,.35].every(offset=>p.samples.some(s=>s.offset===offset))),{routes:passageList.length,rays:passageList.reduce((n,[,p])=>n+(p.samples?.length||0),0),requiredOffsetsMetres:[0,-.35,.35]});
    contract('allSampledPassagesClear',passageList.length>0&&passageList.every(([,p])=>Number.isFinite(p?.hits)&&p.hits===0),
      {probes:passageList.map(([name,p])=>({name,hits:p?.hits})),limitation:'Only the reported sampled rays; this is not whole-building walkability, accessibility or code compliance.'});

    // Do not retry failed samples, extend them to obtain a pass, or silently lower >5.
    for(const view of ['whole','section']){
      await chooseView(page,view);let settled=await snapshot(page);await nextFrames(page,settled.frames);await page.waitForTimeout(500);
      const before=await snapshot(page),started=Date.now();await page.waitForTimeout(2500);const after=await snapshot(page),elapsedMs=Date.now()-started;
      const frames=after.frames-before.frames;const sample={view,requestedMs:2500,elapsedMs,frames,fps:frames/(elapsedMs/1000),pass:frames>5};
      receipt.performanceSamples.push(sample);receipt.performanceContracts[view+'_continuousFrames']={pass:sample.pass,frames,required:'>5 in one requested 2500 ms sample',elapsedMs};save();
    }
    receipt.frameTimeMilliseconds=quantiles(await page.evaluate(()=>window.__bureauArchitecture.frameTimes));
    receipt.contextLossEvents=await page.evaluate(()=>window.__architectureQaContextLosses);
    receipt.final=await snapshot(page);
    receipt.finalWebgl=await page.evaluate(()=>{const gl=document.querySelector('body > canvas').getContext('webgl2');return{lost:gl.isContextLost(),error:gl.getError()};});
    contract('noContextLoss',!receipt.final.contextLost&&!receipt.finalWebgl.lost&&receipt.contextLossEvents.length===0);
    contract('noWebGLErrorAtEnd',receipt.finalWebgl.error===0,receipt.finalWebgl);
    contract('noPageConsoleOrNetworkErrors',receipt.errors.length===0&&receipt.consoleErrors.length===0&&receipt.httpErrors.length===0&&receipt.failedRequests.length===0);
    receipt.functionalPassed=Object.values(receipt.functionalContracts).every(c=>c.pass===true);
    receipt.performancePassed=Object.values(receipt.performanceContracts).every(c=>c.pass===true);
    receipt.technicalPassed=receipt.functionalPassed&&receipt.performancePassed;
    receipt.status=receipt.technicalPassed?'passed-awaiting-visual-review':receipt.functionalPassed?'functional-passed-performance-failed':'failed';
    receipt.completedUtc=new Date().toISOString();save();
    console.log('BUREAU_ARCHITECTURE_R02_RESULT',JSON.stringify({status:receipt.status,functionalPassed:receipt.functionalPassed,performancePassed:receipt.performancePassed,performanceSamples:receipt.performanceSamples,receipt:path.join(OUT,FILE_PREFIX+'-receipt.json')}));
    if(!receipt.technicalPassed)process.exitCode=1;
  }catch(error){
    receipt.status='failed';receipt.failure=error.stack||String(error);receipt.completedUtc=new Date().toISOString();
    if(page){receipt.lastSnapshot=await snapshot(page).catch(()=>null);await page.screenshot({path:path.join(OUT,FILE_PREFIX+'-failure.png'),timeout:30000}).catch(()=>{});}
    save();console.error(receipt.failure);process.exitCode=1;
  }finally{
    if(browser)await browser.close().catch(error=>{receipt.cleanupError=String(error);save();process.exitCode=1;});
    if(server.listening)await new Promise(resolve=>server.close(resolve));
  }
}
module.exports=run();
