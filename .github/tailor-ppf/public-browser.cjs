const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const engine=process.env.PPF_BROWSER||'chromium',root=path.resolve(process.env.PPF_SITE_ROOT||'.');
const out=path.resolve('ppf-browser-'+engine);fs.mkdirSync(out,{recursive:true});
const report={engine,checks:[],errors:[],releases:[],screenshots:[]};let browser,server;
const waitReady=page=>page.waitForFunction(()=>window.ppfQA&&window.ppfQA.getState().current>=0&&!window.ppfQA.getState().busy&&!window.ppfQA.getState().error,null,{timeout:90000,polling:50});
const state=page=>page.evaluate(()=>window.ppfQA.getState());
async function shot(page,name){if(await page.evaluate(()=>!!window.ppfQA)){const before=(await state(page)).renderCount;await page.evaluate(()=>window.ppfQA.redraw());await page.waitForFunction(n=>{const s=window.ppfQA.getState();return s.renderCount>n&&s.renderedRevision===s.drawRevision;},before,{polling:50,timeout:30000});}const file=path.join(out,name+'-'+engine+'.png');await page.screenshot({path:file});report.screenshots.push(path.basename(file));}
async function check(page,name,fn){await fn();report.checks.push(name);}
(async()=>{
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');const bytes=fs.readFileSync(file);
      const ext=path.extname(file),types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png'};
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
    }catch{res.writeHead(404).end('Not found');}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=process.env.PPF_PUBLIC_BASE||('http://127.0.0.1:'+server.address().port);
  browser=await ({chromium,webkit}[engine]).launch({headless:true});
  const context=await browser.newContext({viewport:{width:2048,height:1040},deviceScaleFactor:1});
  await context.exposeFunction('ppfAuditRelease',data=>report.releases.push(data));
  await context.addInitScript(()=>{
    const rafs=new Set(),rafOrigins=new Map(),observers=new Set(),contexts=new Set();
    const request=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>{const origin={stack:new Error().stack,callback:String(callback).slice(0,600)};const id=request(t=>{rafs.delete(id);rafOrigins.delete(id);callback(t);});rafs.add(id);rafOrigins.set(id,origin);return id;};
    window.cancelAnimationFrame=id=>{rafs.delete(id);rafOrigins.delete(id);return cancel(id);};
    const RO=window.ResizeObserver;window.ResizeObserver=class extends RO{observe(...a){observers.add(this);return super.observe(...a);}disconnect(){observers.delete(this);return super.disconnect();}};
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=get.call(this,type,...args);if(gl&&(type==='webgl'||type==='webgl2')&&!contexts.has(gl)){
      contexts.add(gl);const original=gl.getExtension.bind(gl);gl.getExtension=name=>{const ext=original(name);if(name==='WEBGL_lose_context'&&ext&&!ext.__ppfObserved){const lose=ext.loseContext.bind(ext);ext.loseContext=()=>{contexts.delete(gl);return lose();};ext.__ppfObserved=true;}return ext;};
    }return gl;};
    window.addEventListener('ppf-lifecycle',e=>{if(e.detail.kind==='released')window.ppfAuditRelease({...e.detail,observedRafs:rafs.size,rafOrigins:[...rafOrigins.values()],observedResizeObservers:observers.size,observedContexts:contexts.size,href:location.href});});
    const OriginalWorker=window.Worker;window.__workersCreated=0;
    window.Worker=class extends OriginalWorker{constructor(...args){super(...args);window.__workersCreated++;}};
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await check(page,'published overview preserves old entries and opens PPF card',async()=>{await page.goto(base+'/kaopu-human-overview/#clothing',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('a[data-entry]').count(),22);const card=page.locator('#clothing-ppf');await card.scrollIntoViewIfNeeded();await shot(page,'overview-ppf-card');await card.locator('a[data-entry]').click();await waitReady(page);assert.equal((await state(page)).caseId,'drape');});
  for(const scene of ['drape','belt']){
    await page.goto(base+'/kaopu-tailor-workbench/?case=ppf&scene='+scene,{waitUntil:'domcontentloaded'});await waitReady(page);
    const metadata=JSON.parse(fs.readFileSync(path.join(root,'kaopu-tailor-workbench/ppf-teacher/data',scene,'manifest.json')));
    const audit=JSON.parse(fs.readFileSync(path.join(root,'kaopu-tailor-workbench/ppf-teacher/data',scene,'verification.json')));
    await check(page,scene+':one renderer and on-demand first view',async()=>{const s=await state(page);assert.equal(s.current,metadata.frames-1);assert.equal(s.rendererCount,1);assert.equal(s.workerCount,0);assert.equal(await page.evaluate(()=>window.__workersCreated),0);assert.equal(await page.locator('iframe').count(),0);assert(s.cachedChunks<=3);assert(s.bytes<(scene==='drape'?4.3e6:.3e6));});
    await shot(page,scene+'-final-cloth-2048');
    await check(page,scene+':shadow-only comparison retains every position',async()=>{const before=await page.evaluate(()=>Array.from(window.ppfQA.positions()));await page.uncheck('#ppf-shadows');await shot(page,scene+'-final-no-shadows');assert.deepEqual(await page.evaluate(()=>Array.from(window.ppfQA.positions())),before);await page.check('#ppf-shadows');});
    await check(page,scene+':desktop controls and viewport simultaneously visible',async()=>{
      for(const size of [{width:1440,height:900},{width:2048,height:1040}]){await page.setViewportSize(size);const boxes=await page.evaluate(()=>({canvas:document.querySelector('#ppf-canvas').getBoundingClientRect().toJSON(),control:document.querySelector('#ppf-case').getBoundingClientRect().toJSON(),scroll:document.documentElement.scrollWidth,width:innerWidth}));assert(boxes.canvas.width>size.width*.55);assert(boxes.canvas.height>size.height*.5);assert(boxes.control.x>=boxes.canvas.right-2);assert(boxes.control.right<=size.width);assert.equal(boxes.scroll,boxes.width);await shot(page,scene+'-desktop-'+size.width);}
    });
    await check(page,scene+':original-rest strain visualization',async()=>{await page.selectOption('#ppf-display','strain');const s=await state(page),expected=audit.perFrame.at(-1).maximumStretch;assert(Math.abs(s.maximumStretch-expected)<2e-6);await shot(page,scene+'-final-strain');await page.selectOption('#ppf-display','cloth');});
    await check(page,scene+':layer visibility and real contact statistics',async()=>{const cb=page.locator('#ppf-layers input').first();await cb.uncheck();assert.equal((await state(page)).visibleObjects.length,metadata.objects.length-1);await page.click('#ppf-show-all');assert.equal((await state(page)).visibleObjects.length,metadata.objects.length);await page.selectOption('#ppf-display','contacts');assert.match(await page.locator('#ppf-legend').innerText(),/不是接触点/);await shot(page,scene+'-contact-count');await page.selectOption('#ppf-display','cloth');});
    await check(page,scene+':all seeks match original frame hashes and 3-block cache',async()=>{
      for(const frame of [0,7,8,33,56,metadata.frames-1]){await page.evaluate(n=>window.ppfQA.seek(n),frame);const s=await state(page);assert.equal(s.current,frame);assert(s.cachedChunks<=3);const sha=await page.evaluate(async()=>{const p=window.ppfQA.positions();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',p))].map(x=>x.toString(16).padStart(2,'0')).join('');});assert.equal(sha,audit.perFrame[frame].sha256);}
    });
    await check(page,scene+':timeline keyboard and pause',async()=>{
      await page.focus('#ppf-seek');await page.keyboard.press('Home');await page.waitForFunction(()=>window.ppfQA.getState().current===0&&!window.ppfQA.getState().busy,null,{polling:50});await page.selectOption('#ppf-speed','1');await page.click('#ppf-play');await page.waitForFunction(()=>window.ppfQA.getState().current>=3,null,{polling:50});await page.click('#ppf-play');await page.waitForFunction(()=>!window.ppfQA.getState().busy,null,{polling:50});const frame=(await state(page)).current;await page.waitForTimeout(350);assert.equal((await state(page)).current,frame);assert.equal((await state(page)).playing,false);});
    await check(page,scene+':orbit and wire geometry',async()=>{const b=await page.locator('#ppf-canvas').boundingBox();await page.mouse.move(b.x+b.width*.45,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.57,b.y+b.height*.43,{steps:12});await page.mouse.up();await page.selectOption('#ppf-display','wire');await shot(page,scene+'-orbit-wire');await page.selectOption('#ppf-display','cloth');});
    await check(page,scene+':actual departure and Back restore',async()=>{await page.click('a[data-wb-back]');await page.waitForURL('**/kaopu-human-overview/');await page.goBack({waitUntil:'domcontentloaded'});await waitReady(page);assert.equal((await state(page)).caseId,scene);assert.equal((await state(page)).rendererCount,1);});
  }
  await check(page,'rapid scene switching rejects late old results',async()=>{await page.evaluate(()=>{window.ppfQA.selectCase('drape');window.ppfQA.selectCase('belt');});await waitReady(page);assert.equal((await state(page)).caseId,'belt');await page.waitForTimeout(500);assert.equal((await state(page)).caseId,'belt');assert.equal((await state(page)).rendererCount,1);});
  await check(page,'garment and teacher share one current viewport',async()=>{await page.selectOption('#case-select','shortsleeve');await page.waitForFunction(()=>window.__TAILOR_UNIFIED_QA__?.getState().ready,null,{timeout:90000,polling:50});const s=await page.evaluate(()=>window.__TAILOR_UNIFIED_QA__.getState());assert.equal(s.activeWorkerCount,1);assert.equal(s.rendererCount,1);await page.selectOption('#case-select','ppf');await waitReady(page);assert.equal(await page.evaluate(()=>window.__workersCreated),0);assert.equal((await state(page)).rendererCount,1);});
  assert(report.releases.length>=3);for(const r of report.releases){assert.equal(r.rendererCount,0);assert.equal(r.cachedChunks,0);assert.equal(r.workerCount,0);assert.equal(r.observedRafs,0);assert.equal(r.observedResizeObservers,0);assert.equal(r.observedContexts,0);}
  assert.deepEqual(report.errors,[]);report.success=true;
})().catch(e=>{report.success=false;report.failure=e.stack;process.exitCode=1;}).finally(async()=>{
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser?.close();if(server)await new Promise(r=>server.close(r));console.log(JSON.stringify({engine,success:report.success,checks:report.checks.length,failure:report.failure}));
});
