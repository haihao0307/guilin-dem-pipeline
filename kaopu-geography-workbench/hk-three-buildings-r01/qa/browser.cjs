/* Independent real Chromium/WebGL evidence. No mock canvas or generated image. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence');
fs.mkdirSync(out, {recursive: true});
const report = {schema:'hk-three-buildings-browser-qa/1', started:new Date().toISOString(),
  commit:process.env.GITHUB_SHA||null, passed:false, screenshots:[], checks:[], consoleErrors:[],
  pageErrors:[], failedRequests:[], metrics:[], notes:[
    'Screenshots are captured from the actual Chromium page and WebGL canvas.',
    'SwiftShader software-renderer measurements are diagnostic costs, not physical-device FPS.',
    'Mobile is an emulated viewport, not a physical-phone acceptance test.'
  ]};
const types={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.gltf':'model/gltf+json','.bin':'application/octet-stream','.png':'image/png'};
const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/favicon.ico'))return res.writeHead(204).end();
  let rel;try{rel=decodeURIComponent(req.url.split('?')[0]);}catch{return res.writeHead(400).end();}
  let p=path.resolve(root,'.'+rel);if(p!==root&&!p.startsWith(root+path.sep))return res.writeHead(403).end();
  if(rel.endsWith('/'))p=path.join(p,'index.html');
  fs.readFile(p,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',types[path.extname(p)]||'text/plain');res.end(data);});
});
function writeReport(){fs.writeFileSync(path.join(out,'BROWSER_QA.json'),JSON.stringify(report,null,2));}
function assert(name,ok,detail){report.checks.push({name,passed:!!ok,detail});writeReport();if(!ok)throw new Error(name+': '+JSON.stringify(detail));}
(async()=>{
  let browser;
  try{
    await new Promise(r=>server.listen(8197,'127.0.0.1',r));
    report.url=process.env.HK_TRIAL_QA_URL||'http://127.0.0.1:8197/viewer/';
    browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1600,height:1050},deviceScaleFactor:1});
    page.setDefaultTimeout(120000);
    page.on('pageerror',e=>{report.pageErrors.push(e.message);writeReport();});
    page.on('console',m=>{if(m.type()==='error'){report.consoleErrors.push(m.text());writeReport();}});
    page.on('requestfailed',r=>{report.failedRequests.push({url:r.url(),failure:r.failure()});writeReport();});
    const initialReferenceRequests=[];
    await page.route('**/*.source-preview.json',route=>{initialReferenceRequests.push(route.request().url());return route.abort();});
    await page.route('**/original/**',route=>{initialReferenceRequests.push(route.request().url());return route.abort();});
    const t0=Date.now(),response=await page.goto(report.url,{waitUntil:'networkidle',timeout:120000});
    assert('HTTP 200',response.status()===200,response.status());
    await page.waitForFunction(()=>window.__KAOPU_TRIAL__?.ready||window.__KAOPU_TRIAL__?.fatalError,null,{timeout:120000});
    assert('viewer ready',await page.evaluate(()=>window.__KAOPU_TRIAL__.ready),await page.evaluate(()=>window.__KAOPU_TRIAL__.fatalError||null));
    report.startupWallMs=Date.now()-t0;
    report.initialStats=await page.evaluate(()=>window.__KAOPU_TRIAL__.stats());
    assert('default reconstruction does not load reference meshes',initialReferenceRequests.length===0,initialReferenceRequests);
    await page.unroute('**/*.source-preview.json');await page.unroute('**/original/**');
    report.context=await page.evaluate(()=>window.__KAOPU_TRIAL__.contextProvenance||null);
    assert('authored courts installed',report.context?.pads?.length===3,report.context);
    assert('private vegetation not redistributed',report.context?.plants?.count===0,report.context?.plants);
    report.userAgent=await page.evaluate(()=>navigator.userAgent);
    async function call(method,...args){return page.evaluate(({method,args})=>window.__KAOPU_TRIAL__[method](...args),{method,args});}
    async function shot(name){
      await call('render');await page.waitForTimeout(300);
      const file=name+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});
      const bytes=fs.readFileSync(path.join(out,file));
      report.screenshots.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
        camera:await call('cameraSnapshot'),stats:await call('stats')});writeReport();
    }
    async function pixelHash(){return page.evaluate(async()=>{
      const api=window.__KAOPU_TRIAL__;api.render();const gl=api.renderer.getContext();gl.finish();
      const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const digest=await crypto.subtle.digest('SHA-256',pixels),hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');
      let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)opaque++;
      return {sha256:hash,nonTransparentPixels:opaque,totalPixels:pixels.length/4,glError:gl.getError()};
    });}
    for(let i=0;i<3;i++){
      await call('selectBuilding',i);await call('setParams',{windows:false});await call('setView','whole');
      const visiblePads=await page.evaluate(()=>window.__KAOPU_TRIAL__.context.children.filter(o=>o.name.startsWith('Authored presentation court:')&&o.visible).length);
      assert(`building ${i+1}: one matching court`,visiblePads===1,visiblePads);
      await call('setMode','source');await shot(`building-${i+1}-source-whole`);
      const before=await call('cameraSnapshot');
      await call('setMode','reconstruction');const after=await call('cameraSnapshot');
      assert(`building ${i+1}: source/reconstruction share camera`,JSON.stringify(before)===JSON.stringify(after),{before,after});
      await shot(`building-${i+1}-reconstruction-whole`);
      await call('setMode','material');
      for(const view of ['whole','mid','near']){await call('setView',view);await shot(`building-${i+1}-material-${view}`);}
    }
    await call('selectBuilding',0);await call('setView','near');await call('setMode','material');
    const stable=[];for(let i=0;i<3;i++)stable.push(await pixelHash());report.fixedViewPixels=stable;
    assert('actual canvas contains rendered pixels',stable[0].nonTransparentPixels>stable[0].totalPixels*.002,stable[0]);
    assert('fixed view is deterministic on this backend',new Set(stable.map(s=>s.sha256)).size===1,stable);
    const savedSettings=(await call('stats')).settings;await call('setParams',{age:.87,wet:.94});const changedPixels=await pixelHash();
    await call('setParams',savedSettings);const restoredPixels=await pixelHash();
    assert('editable material changes actual pixels',changedPixels.sha256!==stable[0].sha256,{before:stable[0],changed:changedPixels});
    assert('returning parameters restores actual pixels',restoredPixels.sha256===stable[0].sha256,{before:stable[0],restored:restoredPixels});
    for(const material of ['brick','plaster','concrete']){await call('setMaterial',material);await shot('material-'+material+'-near');}
    await call('setParams',{age:0.85,wet:0.9,windows:false});await shot('material-weathering-test');
    await call('setParams',{age:0.45,wet:0.25,windows:true});await shot('hypothetical-windows-explicit');
    await call('setParams',{windows:false});
    const labels=await page.locator('body').innerText();
    assert('attribution includes CSDI',labels.includes('CSDI'),labels.slice(-1200));
    assert('CSDI terms link retained',await page.locator('a[href="https://portal.csdi.gov.hk/csdi-webpage/doc/TNC"]').count()>0);
    assert('hypothetical appearance disclosed',/假设|实验设定|非.*实测|not.*surveyed/i.test(labels));
    await call('selectBuilding','all');await call('setMaterial','preset');await call('setParams',{age:.32,wet:.24,grain:1,windows:false});await call('setView','whole');await call('setMode','material');await shot('three-buildings-complete-scene');
    assert('all three matching courts visible',await page.evaluate(()=>window.__KAOPU_TRIAL__.context.children.filter(o=>o.name.startsWith('Authored presentation court:')&&o.visible).length)===3);
    await page.locator('#context').uncheck();assert('context checkbox hides real context',await page.evaluate(()=>window.__KAOPU_TRIAL__.context.visible===false));
    await page.locator('#context').check();assert('context checkbox restores real context',await page.evaluate(()=>window.__KAOPU_TRIAL__.context.visible===true));
    // GPU-completed timing: manual draws plus gl.finish include backend completion.
    for(const mode of ['source','reconstruction','material']){
      await call('setMode',mode);
      const result=await page.evaluate(async mode=>{
        const api=window.__KAOPU_TRIAL__,canvas=document.querySelector('canvas');
        const gl=canvas?.getContext('webgl2')||canvas?.getContext('webgl');
        if(!gl)throw Error('No actual WebGL context');
        const samples=[];
        for(let i=0;i<17;i++){
          const t=performance.now();api.render();gl.finish();const ms=performance.now()-t;if(i>=5)samples.push(ms);
          await new Promise(r=>setTimeout(r,0));
        }
        const sorted=[...samples].sort((a,b)=>a-b),ext=gl.getExtension('WEBGL_debug_renderer_info');
        return {mode,samplesMs:samples,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor((sorted.length-1)*.95)],
          renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),
          drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],stats:api.stats(),glError:gl.getError()};
      },mode);
      report.metrics.push(result);assert(mode+' WebGL error-free',result.glError===0,result.glError);writeReport();
    }
    await call('setMode','material');await page.setViewportSize({width:390,height:844});await call('setView','whole');await page.waitForTimeout(300);await shot('mobile-emulated-complete-scene');
    const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth}));
    assert('mobile has no horizontal overflow',overflow.scroll<=overflow.inner,overflow);
    // Repeated changes and return to source exercise retained object state.
    for(let i=0;i<6;i++){await call('selectBuilding',i%3);await call('setMode',i%2?'material':'source');}
    await call('selectBuilding','all');await call('setMode','material');await call('setView','whole');
    report.finalStats=await call('stats');
    const apiErrors=await page.evaluate(()=>window.__KAOPU_TRIAL__.errors||[]);report.apiErrors=apiErrors;
    assert('no page errors',report.pageErrors.length===0,report.pageErrors);
    assert('no failed asset requests',report.failedRequests.length===0,report.failedRequests);
    assert('no renderer/shader errors',apiErrors.length===0,apiErrors);
    assert('no console errors',report.consoleErrors.length===0,report.consoleErrors);
    report.passed=true;
  }catch(error){report.error=String(error.stack||error);process.exitCode=1;}
  finally{report.finished=new Date().toISOString();writeReport();console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await new Promise(r=>server.close(r));}
})();
