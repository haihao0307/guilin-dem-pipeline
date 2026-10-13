'use strict';
// Deterministic recovery from the last readable source of the interrupted PR258.
// Old source and preview directories are immutable. This script only writes here.
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const parent='7dc53a7812d1edca0473fa12b848a919448c8ad4',old='kaopu-unified-human-workbench/head-look-r03-local',dest=__dirname;
const files=['Profile.mjs','LocalFeatures.mjs','Studio.mjs','Visibility.mjs','UI.mjs','build.cjs','layout.css','test.mjs','verify.cjs'];
const sourceHashes={};
function once(s,a,b){assert.equal(s.split(a).length,2,'Recovery anchor drift: '+a.slice(0,100));return s.replace(a,()=>b);}
for(const file of files){let s=cp.execFileSync('git',['show',parent+':'+old+'/'+file],{encoding:'utf8',maxBuffer:20e6});sourceHashes[file]=crypto.createHash('sha256').update(s).digest('hex');
 s=s.replaceAll('head-look-r03-local','head-look-r03-1-recovery').replaceAll('HUMAN-LOCAL-FEATURES-R03','HUMAN-LOCAL-FEATURES-R03.1');
 if(file==='UI.mjs'){
  s=once(s,"function clearDebug(){window.unifiedHuman.set({diagnostic:0});window.geometricSkin.set({gray:false});model.eyeSurface.set({gray:false,grid:false});model.faceSurface.set({layer:'beauty'});viewer.skin.earTissueDebug?.(0);model.lipStructure.debug=0;model.lipStructure.update();document.body.classList.remove('ear-focus','lips-focus');viewer.earInspection=false;}",`function clearDebug(){
   // A camera view is not a recipe edit. Do not repeatedly notify the canonical
   // model / regenerate lip geometry and the native idle basis for no-op resets.
   if(model.regionalFace.settings.diagnostic!==0)window.unifiedHuman.set({diagnostic:0});
   if(model.foldProfile.settings.gray)window.geometricSkin.set({gray:false});
   if(model.eyeSurface.settings.gray||model.eyeSurface.settings.grid)model.eyeSurface.set({gray:false,grid:false});
   if(model.faceSurface.settings.layer!=='beauty')model.faceSurface.set({layer:'beauty'});
   viewer.skin.earTissueDebug?.(0);
   if(model.lipStructure.debug!==0){model.lipStructure.debug=0;model.lipStructure.update();}
   document.body.classList.remove('ear-focus','lips-focus');viewer.earInspection=false;
  }`);
  s=s.replace('R03 · ORIGINAL SKIN','R03.1 · ORIGINAL SKIN').replace('原皮肤保留 · 局部继续做','原皮肤保留 · 五官局部完善');
 }
 if(file==='build.cjs')s=s.replace('人物总台 · 原皮肤＋局部五官 R03','人物总台 · 原皮肤＋局部五官 R03.1').replace('局部完善 R03 ·','局部完善 R03.1 ·');
 if(file==='verify.cjs'){
  s=s.replace("'--enable-unsafe-swiftshader'","'--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding'");
  const anchor='const modes={};for(const mode of';
  s=once(s,anchor,`// Verify real hit-tested pointer events without Playwright's two-RAF
// actionability wait, which hung after the original expensive camera reset.
const pointer=async(selector,fraction=.5)=>{
 const loc=p.locator(selector);
 await loc.evaluate(e=>e.scrollIntoView({block:'nearest',behavior:'instant'}));
 const read=()=>loc.evaluate((e,f)=>{const b=e.getBoundingClientRect(),x=b.x+b.width*f,y=b.y+b.height*.5,hit=document.elementFromPoint(x,y);return{x,y,w:b.width,h:b.height,hit:e===hit||e.contains(hit),disabled:e.disabled===true};},fraction);
 const a=await read();await p.waitForTimeout(60);const z=await read();
 assert(z.w>0&&z.h>0&&z.hit&&!z.disabled,'pointer must hit a visible enabled control');
 assert(Math.abs(a.x-z.x)<1&&Math.abs(a.y-z.y)<1,'pointer target must be stable');
 await p.mouse.click(z.x,z.y);
};
await p.evaluate(()=>{window.__lfPointerLog=[];document.querySelector('#local-feature-controls').addEventListener('click',e=>__lfPointerLog.push({trusted:e.isTrusted,mode:e.target.closest('[data-lf-mode]')?.dataset.lfMode||null}));});
const viewState=await p.evaluate(()=>{const v=__IDENTITY_QA__.viewer(),a=lifelikeIdle.runtime().generation,position=v.geometry.attributes.position.version;for(const view of ['eyes','face','eye','face'])localFeatures.view(view);return{generationBefore:a,generationAfter:lifelikeIdle.runtime().generation,positionBefore:position,positionAfter:v.geometry.attributes.position.version};});
assert.equal(viewState.generationBefore,viewState.generationAfter,'camera changes must not invalidate the idle cache');
assert.equal(viewState.positionBefore,viewState.positionAfter,'camera changes must not regenerate geometry');pass('camera-only-views-no-geometry-or-idle-rebuild',viewState);
const modes={};for(const mode of`);
  s=once(s,`await p.locator('[data-lf-mode="'+mode+'"]').click();`,`await pointer('[data-lf-mode="'+mode+'"]');const actual=await p.evaluate(()=>localFeatures.settings());assert.equal(actual.lighting,['both','light'].includes(mode));assert.equal(actual.lips,['both','features'].includes(mode));`);
  s=once(s,"pass('four-real-pointer-A-B-modes',modes);","pass('four-real-pointer-A-B-modes',modes);const pointerLog=await p.evaluate(()=>__lfPointerLog);assert.equal(pointerLog.filter(x=>x.trusted&&x.mode).length,4);pass('trusted-pointer-events',pointerLog);");
  s=once(s,"const slider=p.locator('[data-lf=\"lipBorder\"]');await slider.scrollIntoViewIfNeeded();const box=await slider.boundingBox();await p.mouse.click(box.x+box.width*.85,box.y+box.height/2);","await pointer('[data-lf=\"lipBorder\"]',.85);");
  // Readiness checks must follow a view change if a genuine debug reset occurred.
  s=once(s,"r.initial=await p.evaluate(()=>localFeatures.report());","await ready();r.initial=await p.evaluate(()=>localFeatures.report());");
  // Keep public inspection focused on the actual target; record cumulative stages.
  s=once(s,"const frame=async name=>p.evaluate(name=>{const v=__IDENTITY_QA__.viewer();v.render();","const frame=async name=>p.evaluate(name=>{const v=__IDENTITY_QA__.viewer();const started=performance.now();v.render();");
  s=once(s,"return{hash,mean:sum/(pixels.length*.75),error:gl.getError()","return{hash,renderAndReadbackMS:performance.now()-started,mean:sum/(pixels.length*.75),error:gl.getError()");
 }
 fs.writeFileSync(path.join(dest,file),s);
}
fs.writeFileSync(path.join(dest,'RECOVERY_SOURCE.json'),JSON.stringify({parent,originalPublicBaseline:'e468c26bd2baddd8cd7b35b066e44f4e5c92dc9b',sourceHashes,changes:['Guard no-op debug resets before camera views; preserve idle basis and canonical geometry','Real hit-tested trusted-pointer regression; do not use force click or DOM click','Preserve all four appearance comparisons, three local domains, neutral PCF lights and exit-visibility guard'],priorFailure:'PR258 run38388636867 stopped at first locator actionability wait; no public build was published',oldSourcesChanged:false},null,2)+'\n');
fs.writeFileSync(path.join(dest,'README.md'),`# HUMAN-LOCAL-FEATURES-R03.1\n\nRecovery of interrupted PR258, from ${parent}. User baseline is head-look-r02-native at e468c26bd2baddd8cd7b35b066e44f4e5c92dc9b.\n\nKeep the original overall skin, character, body, rig, eyes, lip geometry and native idle. Continue lip colour/vermilion blending and inner wetness, landmark-bound orbital local texture/tint, ear regional pigment and bounded transmission, neutral illumination/soft-edge shadows/leak guards. Restoring skin never canceled these tasks. No rejected R01 whole-face material, reference model or reference texture is imported.\n\nCamera-only views now avoid no-op model/geometry resets. QA retains actual trusted pointer clicks, all four comparisons, protected albedo pixels, expression/idle and versioned archive checks. Existing source and frozen pages are not changed.\n\nBuild/public verification is pending until DELIVERY.json records success. Keep Draft. This is not user visual acceptance or photorealistic equivalence. Ear transmission is thickness-estimated; PCF is not contact-hardening or area-light path tracing. Original shape limitations remain. Native person load and idle calibration remain costs. Physical phone, Safari, Vision Pro and consumer GPU FPS are not certified.\n`);
console.log('Recovered readable source from '+parent+' into '+dest);
