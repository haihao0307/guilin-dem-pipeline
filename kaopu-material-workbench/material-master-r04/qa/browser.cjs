/* Authorized CI-only Chromium QA. Do not use to bypass a local browser sandbox denial. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),parent=path.dirname(root),output=path.join(root,'qa');
const server=http.createServer((req,res)=>{
 if(req.url.startsWith('/favicon.ico'))return res.writeHead(204).end();
 const pathname=decodeURIComponent(req.url.split('?')[0]);let file=path.join(parent,pathname);
 for(const revision of ['r01','r02','r03','r04'])if(pathname.startsWith('/material-master-'+revision+'/')){let base=path.join(parent,'material-master-'+revision);if(!fs.existsSync(base))base=path.join(parent,'material-master-workbench-'+revision);file=path.join(base,pathname.slice(('/material-master-'+revision+'/').length));}
 if(!path.resolve(file).startsWith(parent+path.sep))return res.writeHead(403).end();
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 try{res.setHeader('Content-Type',/\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
}).listen(8799,'127.0.0.1');
(async()=>{let browser;const errors=[],checks=[];
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('BROWSER',m.text());}});
  await page.goto('http://127.0.0.1:8799/material-master-r04/',{waitUntil:'networkidle'});
  const ready=async()=>{try{await page.waitForFunction(()=>window.__tileLab?.ready,null,{timeout:120000});}catch(e){await page.screenshot({path:output+'/failure.png',fullPage:true});console.error(await page.evaluate(()=>({errors:window.__tileLab?.errors,state:window.__tileLab?.state,frames:window.__tileLab?.frames,status:document.querySelector('#status')?.textContent})));throw e;}};
  const render=async(index=null)=>page.evaluate(index=>{
   const lab=window.__tileLab,r=lab.renderer,gl=r.getContext();lab.controls.update();
   if(index!==null)lab.groups.forEach((g,i)=>{g.visible=i===index;});
   r.render(lab.scene,lab.camera);const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,p=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,p);
   let visible=0,hash=2166136261;for(let i=0;i<p.length;i+=16){if(p[i+3]>10)visible++;hash=Math.imul(hash^p[i],16777619);hash=Math.imul(hash^p[i+1],16777619);hash=Math.imul(hash^p[i+2],16777619);}
   if(index!==null){lab.groups.forEach(g=>{g.visible=true;});r.render(lab.scene,lab.camera);}
   return{hash:hash>>>0,visible,width:w,height:h,errors:[...lab.errors]};
  },index);
  const slider=async(id,value)=>{await page.locator('#'+id).evaluate((e,value)=>{e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));},value);await page.waitForTimeout(200);};
  for(const finish of ['glazed','unglazed','mosaic']){
   console.log('R04 case',finish);await page.click(`[data-case="${finish}"]`);await ready();await page.waitForTimeout(400);
   const initial=await render();assert(initial.visible>500,'nonempty '+finish);assert.deepEqual(initial.errors,[]);
   const info=await page.evaluate(()=>window.__tileLab.receivers);assert.equal(info.length,2);assert(info.every(r=>r.panels===6&&r.tileCount>50&&r.allTilesHavePhysicalThickness));
   await page.screenshot({path:output+'/'+finish+'-overview.png',fullPage:true});
   // Stable camera and isolated baseline pixel hash avoid confusing candidate updates with comparison changes.
   await page.evaluate(()=>{window.__tileLab.controls.enableDamping=false;window.__tileLab.controls.update();});
   const beforeBaseline=await render(0),beforeCandidate=await render(1),baselineState=await page.evaluate(()=>JSON.stringify(window.__tileLab.groups[0].userData.state));
   await slider('wear',1);await slider('stain',1);await slider('wetness',1);
   const afterBaseline=await render(0),afterCandidate=await render(1);
   assert.equal(afterBaseline.hash,beforeBaseline.hash,finish+' baseline pixels unchanged');assert.notEqual(afterCandidate.hash,beforeCandidate.hash,finish+' candidate changes');assert.equal(await page.evaluate(()=>JSON.stringify(window.__tileLab.groups[0].userData.state)),baselineState);
   for(const view of ['close','joint']){await page.click(`[data-view="${view}"]`);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.__tileLab.view),view);assert((await render()).visible>500);await page.locator('#viewport').screenshot({path:output+'/'+finish+'-'+view+'-wet-worn.png'});}
   // Explicit channel controls must compile/render, and switching back must restore final material.
   for(const mode of [1,2,3,4,5,0]){await page.click(`[data-mode="${mode}"]`);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__tileLab.state.mode),mode);assert.deepEqual((await render()).errors,[]);}
   await page.click('#reset');await ready();assert.equal(await page.evaluate(()=>window.__tileLab.state.wetness),0);assert.equal(await page.evaluate(()=>window.__tileLab.state.wear),.52);await page.click('[data-view="close"]');await page.waitForTimeout(300);await page.locator('#viewport').screenshot({path:output+'/'+finish+'-close-dry.png'});
   await page.click('#resetView');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__tileLab.view),'front');
   const beforeCamera=await page.evaluate(()=>window.__tileLab.camera.position.toArray()),box=await page.locator('#canvas').boundingBox();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.68,box.y+box.height*.55,{steps:8});await page.mouse.up();await page.waitForTimeout(200);assert.notDeepEqual(await page.evaluate(()=>window.__tileLab.camera.position.toArray()),beforeCamera,'orbit drag changes camera');await page.click('#resetView');
   checks.push({finish,initial,receiver:info[1],baselineImmutable:true,candidateResponds:true,views:['close','joint','orbit','reset'],diagnosticChannels:6});
  }
  await page.click('[data-case="glazed"]');await ready();await slider('joint',7);await ready();assert.equal(await page.evaluate(()=>window.__tileLab.receivers[1].joint),.007);assert.equal(await page.evaluate(()=>window.__tileLab.receivers[0].joint),.007);await page.click('#reset');await ready();assert.equal(await page.evaluate(()=>window.__tileLab.state.joint),.004);
  for(const finish of ['glazed','mosaic']){await page.setViewportSize({width:390,height:844});await page.click(`[data-case="${finish}"]`);await ready();await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'390px overflow');await page.screenshot({path:output+'/'+finish+'-mobile.png',fullPage:true});await page.click('[data-view="close"]');await page.waitForTimeout(250);assert((await render()).visible>300);await page.locator('#viewport').screenshot({path:output+'/'+finish+'-mobile-close.png'});await page.click('#resetView');}
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__tileLab.errors),[]);
  const receipt={passed:true,environment:'GitHub CI Chromium / ANGLE SwiftShader',checks,errors,coverage:['3 cases actual nonempty pixels','baseline pixel and state immutability','wear/stain/wetness response','all six diagnostic channels','metric joint rebuild/reset','close/joint views','mouse orbit/reset','390px responsive overflow','overview/close/joint/mobile screenshots'],limitation:'Automated render checks and screenshots do not establish historical/material accuracy or artistic approval'};
  fs.writeFileSync(output+'/browser-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:true,cases:checks.length,errors}));
 }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
