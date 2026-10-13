const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const family=process.env.QA_FAMILY||'knit',sets={knit:['K04','K01','K02','K03'],leather:['L04','L01','L02','L03'],denim:['D01','D02','D03','D04']},ids=sets[family];assert(ids);
const url=process.env.QA_URL;assert(url&&url.startsWith('https://haihao0307.github.io/'),'Must test the actual public HTTPS snapshot');
const out=path.join(__dirname,'public-'+family);fs.mkdirSync(out,{recursive:true});
const report={passed:false,family,entry:url,runtimeSource:process.env.RUNTIME_SOURCE,rows:[],errors:[],physicalDeviceTested:false,userAccepted:false,realPublicNetwork:true};
const save=()=>fs.writeFileSync(path.join(out,'BROWSER_REPORT.json'),JSON.stringify(report,null,2));save();
(async()=>{const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}),p=await browser.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(240000);
p.on('pageerror',e=>{report.errors.push(e.message);save();});p.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());save();}});
const audit=()=>p.evaluate(()=>window.__MP04__.audit());
const ready=async id=>{await p.waitForFunction(()=>{const a=window.__MP04__?.audit();return a&&!a.pending&&(a.selected||a.error);},{},{timeout:420000});const a=await audit();assert.equal(a.error,null);assert.equal(a.selected.id,id);assert.equal(a.version,'MP04.3');assert.equal(a.glError,0);assert.equal(a.bodyVertexCount,25417);assert(a.rows.every(r=>r.layers===1&&r.opaqueBackingSheets===0));assert.equal(report.errors.length,0);return a;};
const shot=async name=>{const clip=await p.locator('#stage').boundingBox();await p.screenshot({path:path.join(out,name+'.png'),clip,timeout:240000});console.log('PUBLIC_PIXELS',family,name);save();};
try{const response=await p.goto(url+'?look='+ids[0],{waitUntil:'domcontentloaded',timeout:120000});assert.equal(response.status(),200);
for(let i=0;i<ids.length;i++){const id=ids[i];if(i)await p.locator('[data-look="'+id+'"]').click();const a=await ready(id);report.rows.push({case:id,audit:a});save();await p.evaluate(()=>window.__MP04__.frame('whole','three'));await shot(id+'-whole');
 if(i===0){await p.evaluate(()=>window.__MP04__.macro('top'));await shot(id+'-material-macro');
  if(family==='knit'){
   const widths=await p.evaluate(async()=>{const imgs=[...document.querySelectorAll('#looks img')];await Promise.all(imgs.map(i=>{i.loading='eager';return i.decode();}));return imgs.map(i=>i.naturalWidth);});assert.equal(widths.length,12);assert(widths.every(n=>n>0));report.rows.push({case:'twelve-original-thumbnails',widths});
   await p.evaluate(()=>{window.__MP04__.frame('whole','rear');window.__MP04__.macro('top');});await shot('K04-back-exterior');
   await p.locator('#inspect-inside').click();assert.equal((await audit()).bodyVisible,false);await shot('K04-inside');
   await p.locator('#body-visible').check();await p.evaluate(()=>{window.__MP04__.frame('whole','three');window.__MP04__.macro('top');});
   const camera=await p.evaluate(()=>window.__MP04__.debug().viewer.camera.position.toArray());
   for(const angle of [30,160]){const a=await p.evaluate(x=>window.__MP04__.orbitLight(x),angle);assert.equal(a.activeLights,1);assert.equal(a.environmentLighting,false);assert.deepEqual(await p.evaluate(()=>window.__MP04__.debug().viewer.camera.position.toArray()),camera);report.rows.push({case:'single-lamp-'+angle,audit:a});await shot('single-light-'+angle);}
   await p.evaluate(()=>{const l=window.__MP04__.debug().lighting;l.setAngle(0);l.play();});await p.waitForFunction(()=>window.__MP04__.debug().lighting.angle>3,{},{timeout:30000});await p.locator('#light-pause').click();assert.equal((await audit()).lighting.running,false);await p.locator('#light-studio').click();
  }
  for(const[motion,frame]of[['raise',90],['twist',60],['step',30]]){
   await p.evaluate(()=>window.__MP04__.debug().physics.reset());await p.evaluate(()=>window.__MP04__.frame('whole','three'));
   const before=await p.evaluate(()=>({body:Array.from(window.__MP04__.debug().model.positions),cloth:Array.from(window.__MP04__.debug().items[0].mesh.geometry.attributes.position.array)}));
   await p.locator('[data-motion="'+motion+'"]').click();
   await p.waitForFunction(id=>{const d=window.__MP04__.debug().physics;return d.activeClip?.header.motion===id&&!d.baking&&d.fromCache;},motion,{timeout:240000});
   await p.locator('#motion-pause').click();await p.evaluate(i=>window.__MP04__.seekMotionFrame(i),frame);
   const a=await audit(),after=await p.evaluate(()=>({body:Array.from(window.__MP04__.debug().model.positions),cloth:Array.from(window.__MP04__.debug().items[0].mesh.geometry.attributes.position.array)}));
   const bodyChanges=before.body.filter((v,i)=>Math.abs(v-after.body[i])>.001).length,clothChanges=before.cloth.filter((v,i)=>Math.abs(v-after.cloth[i])>.00001).length;
   assert(bodyChanges>0&&clothChanges>0);assert(a.motionAndContact.cachedPhysicalReplay&&a.motionAndContact.clipProof.passed);assert(a.motionAndContact.bodyFrameMatchesCloth);assert(a.motionAndContact.nativeRig.maxBoneLengthErrorMM<.001);
   report.rows.push({case:id+'-'+motion,bodyChanges,clothChanges,audit:a});await shot(id+'-'+motion+'-physical');
  }
  await p.evaluate(()=>window.__MP04__.debug().physics.reset());
 }
}
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>window.__MP04__.frame('whole','three'));await p.screenshot({path:path.join(out,'mobile-viewport.png'),timeout:240000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(report.errors.length,0);report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));console.error(e);await p.screenshot({path:path.join(out,'failure.png'),timeout:30000}).catch(()=>{});process.exitCode=1;}finally{save();await browser.close();}})().catch(e=>{report.errors.push(e.stack||String(e));save();console.error(e);process.exitCode=1;});
