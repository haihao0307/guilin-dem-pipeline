const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const group=process.env.MP03_GROUP||'knit';
const sets={knit:['K04','K01','K02','K03'],leather:['L01','L02','L03','L04'],denim:['D01','D02','D03','D04']};
assert(sets[group]);
const url='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp03-r1-fbbef8bc7df2/';
const out=path.join(__dirname,'public-'+group);fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.setDefaultTimeout(240000);
 const report={passed:false,group,entry:url,sourceCommit:'fbbef8bc7df2172f492dd60875432f4ffeff2429',rows:[],errors:[],warnings:[],renderer:'Chromium 1.58.2 Playwright / SwiftShader on GitHub Actions',physicalDeviceTested:false,visualQualityAcceptedByUser:false};
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('requestfailed',r=>report.warnings.push({url:r.url(),failure:r.failure()}));
 const audit=()=>page.evaluate(()=>window.__MP03__.audit());
 const ready=async id=>{
  await page.waitForFunction(()=>{const a=window.__MP03__?.audit();return a&&!a.pending&&(a.selected||a.error);},{},{timeout:480000});
  const a=await audit();assert.equal(a.selected?.id,id);assert.equal(a.error,null);assert.equal(a.glError,0);assert.equal(a.rows.length,2);assert.equal(a.bodyVertexCount,25417);
  for(const r of a.rows){assert.equal(r.physics.seamGapMM,0);assert(r.physics.minBodyVertexDistanceMM>-.1);assert(r.physics.minBodyInteriorSampleMM>-.1);assert(r.physics.maxEdgeStretch<1.25);}
  return a;
 };
 const shot=async name=>{await page.locator('#stage').screenshot({path:path.join(out,name+'.png'),timeout:240000});console.log('CAPTURE',name);};
 try {
  const response=await page.goto(url+'?look='+sets[group][0],{waitUntil:'domcontentloaded',timeout:120000});assert.equal(response.status(),200);
  for(const [i,id]of sets[group].entries()){
   if(i)assert(await page.evaluate(id=>window.__MP03__.select(id),id));
   const a=await ready(id);report.rows.push({case:id,audit:a});
   await page.evaluate(()=>window.__MP03__.frame('whole','three'));await shot(id+'-whole');
   if(id==='K04'){
    const thumbs=await page.evaluate(async()=>{const imgs=[...document.querySelectorAll('#looks img')];await Promise.all(imgs.map(i=>{i.loading='eager';return i.decode();}));return imgs.map(i=>({src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight}));});assert.equal(thumbs.length,12);assert(thumbs.every(i=>i.width>0));report.rows.push({case:'twelve-original-thumbnails',thumbs});
    await page.screenshot({path:path.join(out,'desktop-ui.png')});
    for(const angle of ['rear','side']){await page.evaluate(a=>window.__MP03__.frame('whole',a),angle);await shot('K04-'+angle);}
    await page.evaluate(()=>window.__MP03__.macro('top'));await shot('K04-knit-macro');
    await page.evaluate(()=>window.__MP03__.frame('whole','three'));
    const before=await page.evaluate(()=>Array.from(window.__MP03__.debug().items[0].mesh.geometry.attributes.position.array));
    await page.evaluate(()=>window.__MP03__.settle(.12));
    const after=await page.evaluate(()=>Array.from(window.__MP03__.debug().items[0].mesh.geometry.attributes.position.array));
    const changed=before.filter((v,i)=>Math.abs(v-after[i])>1e-6).length;assert(changed>0);report.rows.push({case:'gravity-changes-real-geometry',changedCoordinates:changed,audit:await audit()});await shot('K04-gravity');
    await page.evaluate(()=>window.__MP03__.setParameters('top',{diameter:2.8,doubleLayer:false}));const single=await ready('K04');assert.equal(single.rows[0].layers,1);assert.equal(single.parameters[0].diameter,2.8);report.rows.push({case:'top-single-layer-diameter',audit:single});await shot('K04-single-layer');
    await page.evaluate(()=>window.__MP03__.setParameters('bottom',{gauge:5.5,doubleLayer:true,gap:1}));const bottom=await ready('K04');assert.equal(bottom.parameters[1].gauge,5.5);assert.equal(bottom.parameters[1].gap,1);assert.equal(bottom.rows[1].layers,2);report.rows.push({case:'bottom-stitch-and-double-layer-gap',audit:bottom});
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__MP03__.frame('whole','three'));await page.screenshot({path:path.join(out,'mobile-viewport.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);report.rows.push({case:'mobile-viewport-only',width:390,height:844,notPhysicalDevice:true});await page.setViewportSize({width:1440,height:1000});
   }
   if(id==='L01'||id==='L04'){await page.evaluate(()=>window.__MP03__.macro('top'));await shot(id+'-leather-macro');}
  }
  assert.equal(report.errors.length,0,report.errors.join('\n'));report.passed=true;
 } catch(e){report.errors.push(e.stack||String(e));console.error(e.stack||e);try{report.failureAudit=await audit();await page.screenshot({path:path.join(out,'failure.png'),timeout:30000});}catch(_){}process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'PUBLIC_REPORT.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({group,passed:report.passed,cases:report.rows.map(r=>r.case),errors:report.errors}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
