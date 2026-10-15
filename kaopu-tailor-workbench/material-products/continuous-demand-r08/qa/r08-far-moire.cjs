const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1600,height:1150}}),report={errors:[],cases:[]};
 page.setDefaultTimeout(180000);page.on('pageerror',e=>report.errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8897/MP05-Continuous-Demand-R01/qa/r08-runtime-frozen/?look=D03');
  await page.waitForFunction(()=>window.__MP05__?.debug().physics?.running);
  await page.evaluate(async()=>{
   const old=await import('./material-shaders.mjs'),next=await import('../../candidate-r08/material-shaders.mjs');
   const d=__MP05__.debug(),v=d.viewer;__MP05__.pause();await d.physics.idle();await v.frameGate.idle();
   window.farFilter=async enabled=>{
    for(const item of d.items)for(const c of item.solid.chunks){const m=c.material;m.userData.moireBase??={compile:m.onBeforeCompile,key:m.customProgramCacheKey};const base=m.userData.moireBase;
     m.onBeforeCompile=shader=>{base.compile.call(m,shader);if(enabled){if(!shader.fragmentShader.includes(old.yarnNormalFragment))throw Error('Original yarn normal fragment missing');shader.fragmentShader=shader.fragmentShader.replace(old.yarnNormalFragment,next.yarnNormalFragment);}};
     m.customProgramCacheKey=()=>base.key.call(m)+':moire-'+enabled;m.needsUpdate=true;
    }
    await v.renderer.compileAsync(d.items[0].solid.group,v.camera,v.scene);await v.renderer.compileAsync(d.items[1].solid.group,v.camera,v.scene);
   };
  });
  for(const enabled of[false,true]){
   await page.evaluate(e=>farFilter(e),enabled);
   for(const distance of[1,1.5,2,3]){
    const data=await page.evaluate(async distance=>{
     const d=__MP05__.debug(),v=d.viewer,T=await import('./vendor/three.module.js');__MP05__.frame('whole','front');await v.frameGate.idle();
     v.camera.position.sub(v.orbit.target).multiplyScalar(distance).add(v.orbit.target);v.orbit.update();
     for(let i=0;i<8;i++)await v.render();
     const target=v.faceDiffusion.targets[0],w=target.width,h=target.height;
     const bounds=d.items[0].mesh.geometry.boundingBox,center=bounds.getCenter(new T.Vector3()).project(v.camera);
     const lo=bounds.min.clone().project(v.camera),hi=bounds.max.clone().project(v.camera);
     const rw=Math.max(8,Math.floor(Math.abs(hi.x-lo.x)*w*.11)),rh=Math.max(8,Math.floor(Math.abs(hi.y-lo.y)*h*.16));
     const roi={x:Math.round((center.x*.5+.5)*w-rw/2),y:Math.round((center.y*.5+.5)*h-rh/2),w:rw,h:rh};
     const half=x=>{const s=x&32768?-1:1,e=x>>10&31,m=x&1023;return s*(e?2**(e-15)*(1+m/1024):2**-14*m/1024);},phases=[];
     for(let y=0;y<4;y++)for(let x=0;x<4;x++){
      v.camera.setViewOffset(w,h,(x-1.5)/4,(y-1.5)/4,w,h);await v.render();const raw=new Uint16Array(rw*rh*4);v.renderer.readRenderTargetPixels(target,roi.x,roi.y,rw,rh,raw);
      const a=new Float32Array(rw*rh);for(let k=0;k<a.length;k++)a[k]=.2126*half(raw[k*4])+.7152*half(raw[k*4+1])+.0722*half(raw[k*4+2]);phases.push(a);
     }
     const means=phases[0].map((_,i)=>phases.reduce((s,a)=>s+a[i],0)/phases.length);let variance=0;
     for(const a of phases)for(let i=0;i<a.length;i++)variance+=(a[i]-means[i])**2/(a.length*phases.length);
     v.camera.clearViewOffset();await v.render();return{distance,roi,rmsPhaseVariation:Math.sqrt(variance),simulationSeconds:d.physics.frame.audit.simulationSeconds,glError:v.renderer.getContext().getError()};
    },distance);
    report.cases.push({enabled,...data});await page.locator('#canvas').screenshot({path:__dirname+'/R08_far_'+(enabled?'filtered':'before')+'_'+distance+'.png'});console.log('FAR',enabled,distance,data.rmsPhaseVariation);
   }
  }
  report.metric='Same frozen garment, central torso ROI, 4x4 offsets spanning 0.75 pixel, linear half-float beauty luminance. Includes real geometric coverage and is not a proof that all moire is eliminated.';
  report.audit=await page.evaluate(()=>__MP05__.audit());
 }catch(e){report.failure=e.stack;console.error(e);console.log((await page.locator('body').innerText()).slice(0,2500));}
 finally{fs.writeFileSync(__dirname+'/r08-far-moire.json',JSON.stringify(report,null,2));await browser.close();}
})();
