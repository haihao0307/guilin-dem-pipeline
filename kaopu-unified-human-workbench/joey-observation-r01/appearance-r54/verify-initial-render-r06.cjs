const {chromium,webkit}=require('playwright'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const browserName=process.env.R54_BROWSER||'webkit',candidate=process.env.R54_CANDIDATE_DIR;
const URL='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/joey-observation-r01/appearance-r54/index.html';
const out='r54-initial-render-r06-'+process.platform+'-'+process.arch+'-'+browserName;fs.mkdirSync(out,{recursive:true});
const report={schema:'R54-initial-render-QA/6',browserName,platform:process.platform,arch:process.arch,physicalIPhone:false,cases:[],claims:{forcedGC:false,measuredProcessPeak:false,provedIPhoneRestartCause:false}};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
let browser;const timeout=setTimeout(()=>{report.failure='QA exceeded 660 seconds';save();process.exit(124)},660000);timeout.unref();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function run(label,overlay){
 browser=await(browserName==='chromium'?chromium:webkit).launch({headless:true,...(browserName==='chromium'?{args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{})});
 const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const row={label,overlay,errors:[],consoleErrors:[],nonReadRequests:[],captures:[],startedAt:Date.now()};report.cases.push(row);p.on('pageerror',e=>row.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')row.consoleErrors.push(m.text())});p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))row.nonReadRequests.push({method:r.method(),url:r.url()});});
 if(overlay)for(const name of ['install-preview.mjs','hair/R14CoverageLayer.js','eye/NativeEyeSurfaceR54.mjs'])await p.route('**/appearance-r54/'+name+'*',r=>r.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(path.join(candidate,name))}));
 await p.goto(URL);await p.waitForFunction(()=>['ready','error'].includes(window.r54PreviewState?.phase),null,{timeout:300000});row.boot=await p.evaluate(()=>r54PreviewState);assert.equal(row.boot.phase,'ready',JSON.stringify(row.boot));row.readyAt=Date.now();
 const f=p.mainFrame().childFrames()[0];row.native=await f.evaluate(()=>r54Preview.report());assert(row.native.eye.compiles>=1);assert(row.native.coverage.valid&&row.native.coverage.geometryUnchanged);
 row.startup=await p.evaluate(()=>r54Boot.ledger.report());
 // Capture the first actual ready frame before any view click can repair it.
 const firstFile=label+'-initial.png',firstAt=Date.now(),firstBytes=await f.locator('#canvas').screenshot({path:path.join(out,firstFile),timeout:90000});row.captures.push({view:'initial',suffix:'',file:firstFile,sha:sha(firstBytes),startedAt:firstAt,completedAt:Date.now()});save();
 row.geometry=await f.evaluate(async()=>{
  const v=fullCommonWorkbench.motion().viewer,meshes=[];
  async function digest(a){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
  const objects=[];v.scene.traverse(o=>{if(o.geometry)objects.push(o)});
  for(const o of objects){const g=o.geometry,attributes={};for(const [k,a]of Object.entries(g.attributes))attributes[k]={type:a.array.constructor.name,itemSize:a.itemSize,length:a.array.length,sha:await digest(a.array)};
   async function uniformValue(value){
    if(value===null||['number','boolean','string'].includes(typeof value))return value;
    if(value?.isTexture)return{kind:'texture',width:value.image?.width,height:value.image?.height,channels:value.image?.data?.constructor.name,length:value.image?.data?.length,sha:value.image?.data?await digest(value.image.data):null,format:value.format,type:value.type,minFilter:value.minFilter,magFilter:value.magFilter,wrapS:value.wrapS,wrapT:value.wrapT,flipY:value.flipY,colorSpace:value.colorSpace};
    if(ArrayBuffer.isView(value))return{kind:value.constructor.name,length:value.length,sha:await digest(value)};
    if(Array.isArray(value))return Promise.all(value.map(uniformValue));
    if(value?.isColor)return{kind:'color',rgb:[value.r,value.g,value.b]};
    if(value?.toArray)return{kind:value.constructor.name,value:value.toArray()};
    return{kind:value?.constructor?.name||typeof value};
   }
   const materials=[];for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){
    const uniforms={};for(const[k,u]of Object.entries(m.uniforms||{}))uniforms[k]=await uniformValue(u.value);
    materials.push({type:m.type,color:m.color?.getHex(),roughness:m.roughness,metalness:m.metalness,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,depthWrite:m.depthWrite,uniforms});
   }
   meshes.push({name:o.name,type:o.type,visible:o.visible,attributes,index:g.index?{length:g.index.array.length,sha:await digest(g.index.array)}:null,materials});
  }return{meshes,face:r54Preview.report().facePositionSHA,hair:{...r54StartupDiagnostics}};
 });
 async function capture(view,suffix='',selectView=true){
  if(selectView)await p.locator('[data-view="'+view+'"]').click();assert(await f.evaluate(()=>fullCommonWorkbench.motion().viewer.camera.isPerspectiveCamera));
  const file=label+'-'+view+suffix+'.png',began=Date.now(),bytes=await f.locator('#canvas').screenshot({path:path.join(out,file),timeout:90000});row.captures.push({view,suffix,file,sha:sha(bytes),startedAt:began,completedAt:Date.now()});save();
 }
 for(const view of ['E04','U05','profile','back'])await capture(view);
 await capture('E04','-before-toggles');const onHash=row.captures.at(-1).sha;
 for(const id of ['hair-toggle','eye-toggle']){
  await p.locator('#'+id).click();assert.equal(await p.locator('#'+id).getAttribute('aria-pressed'),'false');
  const off=await f.evaluate(()=>r54Preview.report());assert.equal(id==='hair-toggle'?off.coverage.visible:off.eye.parameters.enabled,false);
  await capture('E04','-'+id+'-off',false);assert.notEqual(row.captures.at(-1).sha,onHash,'layer toggle must immediately change the framebuffer');
  await p.locator('#'+id).click();assert.equal(await p.locator('#'+id).getAttribute('aria-pressed'),'true');
  const on=await f.evaluate(()=>r54Preview.report());assert.equal(id==='hair-toggle'?on.coverage.visible:on.eye.parameters.enabled,true);
  await capture('E04','-'+id+'-restored',false);assert.equal(row.captures.at(-1).sha,onHash,'toggle itself must immediately restore the actual framebuffer');
 }
 assert.equal(row.errors.length,0,JSON.stringify(row.errors));assert.equal(row.nonReadRequests.length,0);assert.equal(row.consoleErrors.length,0,JSON.stringify(row.consoleErrors));row.final=await f.evaluate(()=>r54Preview.report());await p.close();await browser.close();browser=null;save();return row;
}
(async()=>{
 assert(candidate,'candidate directory is required');
 const A=await run('A-published-r05',false),B=await run('B-deferred-r06',true);
 assert.deepEqual(B.geometry,A.geometry,'every scene geometry attribute/index and authored material descriptor must remain identical');
 for(const key of ['count','segments','recipe','rootBinding','rootFrame','length','material','geometryBytes'])assert.deepEqual(B.native.coverage[key],A.native.coverage[key],key);
 assert.deepEqual(B.native.eye.parameters,A.native.eye.parameters);assert.equal(B.native.facePositionSHA,A.native.facePositionSHA);
 assert.deepEqual(B.captures.map(x=>({view:x.view,suffix:x.suffix,sha:x.sha})),A.captures.map(x=>({view:x.view,suffix:x.suffix,sha:x.sha})),'all four views and disabled/restored layer frames must match exactly');
 const submitted=x=>x.startup.history.find(e=>e.kind==='startup-verified').payload.renderCalls;report.initialRenderCounts={published:submitted(A),deferred:submitted(B)};
 assert.equal(report.initialRenderCounts.published-report.initialRenderCounts.deferred,2,'two intermediate renders should be eliminated');
 const history=B.startup.history,eyeAt=history.findIndex(e=>e.kind==='eye-attach-returned'),finalAt=history.findIndex(e=>e.kind==='final-view-returned');assert(eyeAt>=0&&finalAt>eyeAt);assert.equal(history[eyeAt].payload.eye.compiles,0);assert(history[finalAt].payload.eye.compiles>=1);assert.equal(history.slice(eyeAt,finalAt).filter(e=>e.kind==='render-submit-before').length,1);
 assert.equal(B.native.coverage.initialization.deferInitialRender,true);assert(B.native.coverage.initialization.compileArrayBytes>=33588000);assert.equal(B.native.coverage.initialization.referencesReleasedBeforeInitialRender,true);assert.equal(B.native.coverage.initialization.gcObserved,false);
 report.status='passed';save();
})().catch(e=>{report.status='failed';report.failure=e.stack;save();console.error(e);process.exitCode=1}).finally(async()=>{clearTimeout(timeout);if(browser)await browser.close()});
