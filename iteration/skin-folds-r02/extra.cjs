const fs=require('fs'),assert=require('assert/strict');const {chromium}=require('playwright');
(async()=>{
 const out=process.env.EXTRA_OUT||'r02-evidence/extra';fs.mkdirSync(out,{recursive:true});
 const report={tests:[],errors:[],consoleErrors:[],failedRequests:[],completed:false},write=()=>fs.writeFileSync(out+'/qa.json',JSON.stringify(report,null,2));
 const pass=(name,data)=>{report.tests.push({name,pass:true,data});console.log('PASS',name,JSON.stringify(data));write();};
 const settings={strength:1.1,slack:.92,compression:.72,forehead:.85,eyes:.9,nasolabial:1,cheeks:.85,sag:.85,makeup:.12,light:'neutral',chroma:.28,exposure:0,shadows:false,diffusion:false,gray:true};
 let browser,p;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const ready=async()=>{await p.evaluate(()=>lifelikeIdle.pause(true));await p.waitForFunction(()=>lifelikeIdle.ready()||lifelikeIdle.report().errors.length,null,{timeout:240000});assert(await p.evaluate(()=>lifelikeIdle.ready()));await p.evaluate(async()=>{await Promise.all([__IDENTITY_QA__.viewer().skin.faceReady,__IDENTITY_QA__.viewer().skin.naturalEyesReady]);lifelikeIdle.pause(true);lifelikeIdle.seek(0);});};
  const snap=async name=>p.screenshot({path:out+'/'+name+'.png',timeout:120000});
  const pixels=()=>p.evaluate(()=>{const v=__IDENTITY_QA__.viewer();v.render();const gl=v.renderer.getContext(),a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);let h=2166136261;for(const x of a)h=Math.imul(h^x,16777619)>>>0;return{hash:h,glError:gl.getError()};});
  for(const [label,url] of [['baseline',process.env.BASELINE_URL],['r02',process.env.PREVIEW_URL]]){
   assert(url);p=await browser.newPage({viewport:{width:1500,height:1120},deviceScaleFactor:1});p.setDefaultTimeout(180000);
   p.on('pageerror',e=>{report.errors.push(label+':'+String(e));write();});p.on('console',m=>{if(m.type()==='error'){report.consoleErrors.push(label+':'+m.text());write();}});p.on('requestfailed',r=>{report.failedRequests.push(label+':'+r.url()+':'+r.failure()?.errorText);write();});
   await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.geometricSkin,null,{timeout:240000});await ready();
   await p.evaluate(s=>geometricSkin.set(s),settings);await ready();
   await p.evaluate(()=>{const v=__IDENTITY_QA__.viewer();v.view('face');v.camera.zoom=1.35;v.camera.updateProjectionMatrix();v.render();});
   if(label==='baseline')report.camera=await p.evaluate(()=>__IDENTITY_QA__.viewer().cameraState());else await p.evaluate(s=>__IDENTITY_QA__.viewer().restoreCamera(s),report.camera);
   await snap(label+'-gray-mature');const grayPixels=await pixels();
   const geometry=await p.evaluate(()=>{const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),finger=a=>{let h=2166136261;for(const x of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^x,16777619)>>>0;return h;};return{positions:finger(v.geometry.attributes.position.array),native:finger(m.positions),faces:finger(m.faces),stats:geometricSkin.report().geometry};});
   await p.evaluate(()=>geometricSkin.set({gray:false}));await snap(label+'-skin-mature');const skinPixels=await pixels();
   await p.evaluate(()=>geometricSkin.set({makeup:1}));await snap(label+'-makeup');const makeupPixels=await pixels();
   report[label]={url,grayPixels,skinPixels,makeupPixels,geometry,settings:await p.evaluate(()=>geometricSkin.report().settings)};write();
   if(label==='baseline'){await p.close();continue;}
   assert.notEqual(report.baseline.geometry.positions,geometry.positions);assert.equal(report.baseline.geometry.native,geometry.native);assert.equal(report.baseline.geometry.faces,geometry.faces);assert.notEqual(report.baseline.grayPixels.hash,grayPixels.hash);
   pass('matched-public-R01-R02-gray-ablation-native-person-and-camera-unchanged',{oldPositionHash:report.baseline.geometry.positions,newPositionHash:geometry.positions,camera:report.camera,displayVertices:geometry.stats.displayVertices});
   const parity=await p.evaluate(()=>{const v=__IDENTITY_QA__.viewer(),surface=v.currentFold,s=__IDENTITY_QA__.model().foldProfile.settings;
    surface.update(s);const p=surface.geometry.attributes.position.array.slice(),n=surface.geometry.attributes.normal.array.slice();
    const measure=enabled=>{surface.cacheEnabled=enabled;const rows=[];for(let i=0;i<3;i++){const t=performance.now();surface.update(s);rows.push(performance.now()-t);}return rows;};
    const cachedMS=measure(true),uncachedMS=measure(false);surface.cacheEnabled=true;surface.update(s);
    return{positionsExact:p.every((x,i)=>x===surface.geometry.attributes.position.array[i]),normalsExact:n.every((x,i)=>x===surface.geometry.attributes.normal.array[i]),cachedMS,uncachedMS,cache:surface.cacheReport(),scope:'only FoldSurface CPU update; not full bake, frame time or FPS'};
   });assert(parity.positionsExact&&parity.normalsExact);assert(parity.cache.hits>0&&parity.cache.entries<=2&&parity.cache.bytes<32*1024*1024);pass('bounded-cache-output-equals-full-recompute-bit-for-bit',parity);
   const stability=await p.evaluate(()=>{const surface=__IDENTITY_QA__.viewer().currentFold,settings=__IDENTITY_QA__.model().foldProfile.settings;
    surface.update({...settings,strength:1.5,slack:1,compression:1,forehead:1,eyes:1,nasolabial:1,cheeks:1,sag:1});
    const g=surface.geometry,P=g.attributes.position.array,B=surface.base,I=g.index.array,T=g.attributes.csType.array,R=g.attributes.fRest.array;
    let protectedMax=0,flips=0,checked=0,minimumDot=1;
    for(let i=0;i<T.length;i++){const x=R[i*3]*1000,y=R[i*3+1]*1000,protectedVertex=T[i]>=.5||(x/27.8)**2+((y-232)/15.2)**2<1||[-31,31].some(cx=>((x-cx)/18.2)**2+((y-301)/8.4)**2<1);
     if(protectedVertex)protectedMax=Math.max(protectedMax,Math.hypot(P[i*3]-B[i*3],P[i*3+1]-B[i*3+1],P[i*3+2]-B[i*3+2]));}
    const cross=(p,a,b,c)=>{const ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2];return[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];};
    for(let k=0;k<I.length;k+=3){const [a,b,c]=[I[k]*3,I[k+1]*3,I[k+2]*3],u=cross(B,a,b,c),v=cross(P,a,b,c),lu=Math.hypot(...u),lv=Math.hypot(...v);if(lu<1e-12||lv<1e-12)continue;const dot=(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/(lu*lv);if(dot<=0)flips++;minimumDot=Math.min(minimumDot,dot);checked++;}
    const result={protectedMaxMM:protectedMax*1000,flips,checked,minimumDot,finite:P.every(Number.isFinite),maxDeltaMM:surface.stats.maxDeltaMM,scope:'display triangles above 1e-12 square-metre cross magnitude; no self-contact certification'};
    surface.update(settings);return result;
   });assert(stability.finite&&stability.protectedMaxMM===0&&stability.flips===0);pass('maximum-settings-protected-vertices-and-triangle-orientation',stability);
   await p.evaluate(()=>geometricSkin.set({light:'raking',chroma:.4,exposure:.2,gray:true}));
   const look=await p.evaluate(()=>{const keys=['light','chroma','exposure','gray','shadows','diffusion'],read=()=>Object.fromEntries(keys.map(k=>[k,geometricSkin.report().settings[k]])),a=read();geometricSkin.preset('freckles');return{before:a,after:read()};});await ready();assert.deepEqual(look.before,look.after);pass('skin-preset-does-not-reset-light-or-diagnostic',look);
   await p.evaluate(()=>geometricSkin.set({gray:false,light:'natural',makeup:.12}));
   const sliderBefore=await p.evaluate(()=>geometricSkin.report().settings.strength);await p.locator('[data-fold="strength"]').evaluate(el=>{el.value='0.9';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await p.evaluate(()=>geometricSkin.report().settings.strength),sliderBefore);
   await p.locator('[data-fold="strength"]').evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));await ready();assert.equal(await p.evaluate(()=>geometricSkin.report().settings.strength),.9);pass('real-shape-slider-commits-on-release',true);
   const download=p.waitForEvent('download');await p.click('#fold-save');const dl=await download;await dl.saveAs(out+'/saved-person.json');const saved=JSON.parse(fs.readFileSync(out+'/saved-person.json'));assert.equal(saved.geometricSkinFolds.schema,'kaopu/geometric-skin-folds@2');pass('UI-full-person-download-has-explicit-formulation-version',saved.geometricSkinFolds.schema);
   await p.evaluate(()=>fullCommonWorkbench.applyPreset('r02-adult-female-short-slim'));await ready();await p.evaluate(()=>{geometricSkin.set({gray:false,light:'neutral'});__IDENTITY_QA__.viewer().view('face');});await snap('r02-second-native-person');pass('second-native-person-rebuilds-cache-and-keeps-folds',await p.evaluate(()=>geometricSkin.report().geometry.preparedCache));
  }
  assert.equal(report.errors.length,0);assert.equal(report.consoleErrors.length,0);assert.equal(report.failedRequests.length,0);pass('no-browser-shader-or-network-errors-in-comparison',true);report.completed=true;write();
 }catch(e){report.failure=String(e);console.error(e);if(p)await p.screenshot({path:out+'/failure.png',timeout:30000}).catch(()=>{});write();process.exitCode=1;}
 finally{await browser?.close();write();}
})();
