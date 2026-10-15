/* Host integration only. The seven frozen R07 surface modules are unmodified. */
(()=>{'use strict';
const install=window.__installHeadCalibration;
const originalHeaderText=document.querySelector('header strong')?.textContent;
const originalStyles=new Set(document.head.querySelectorAll('style'));
window.__installHeadCalibration=(api,v)=>{
 const header=document.querySelector('header strong'),title=originalHeaderText;
 const camera={p:v.camera.position.clone(),q:v.camera.quaternion.clone(),target:v.orbit.target.clone(),zoom:v.camera.zoom};
 const shell=document.querySelector('#control-shell'),shellStyle=shell?.getAttribute('style');
 const nativeGeometry=v.geometry,nativeModel=window.__IDENTITY_QA__.model();
 const canonicalPositions=nativeModel.positions,canonicalFaces=nativeModel.faces;
 install(api,v);
 // Pose and legacy person archives predate the new surface fields. Migrate
 // only missing skin records; preserve explicitly saved new surface settings.
 const controller=window.__IDENTITY_QA__.controller(),restore=controller.restore.bind(controller);
 async function restoreWithSkin(archive){
  const next=structuredClone(archive),current=controller.archive();
  for(const name of ['proceduralHeadSurface','proceduralBodySurface'])if(!next[name])next[name]=structuredClone(current[name]);
  return restore(next);
 }
 controller.restore=restoreWithSkin;window.fullCommonWorkbench.restore=restoreWithSkin;
 api.restore=restoreWithSkin;window.bodyProceduralSkin.restore=restoreWithSkin;
 let presetsBound=false;
 function connectPresets(){if(presetsBound)return true;const platformSkin=window.platformSkin;if(!platformSkin)return false;
  const select=platformSkin.select.bind(platformSkin),base=api.referenceRecipe();
  const presets={silk:{},freckle:{tone:.80,warmth:.44,blood:.56,freckles:.42,variation:.92},outdoor:{tone:.56,warmth:.62,variation:1.05,roughness:.57,pores:1.05},deep:{tone:.20,warmth:.47,blood:.30,roughness:.48,oil:.34},mature:{tone:.70,roughness:.70,oil:.12,microrelief:.90},dewy:{tone:.66,roughness:.42,oil:.72}};
  platformSkin.select=id=>{const result=select(id);api.set({...base,...presets[id]});return result;};
  platformSkin.compare=()=>api.set({enabled:!api.settings().enabled});
  const report=platformSkin.report;platformSkin.report=()=>({...report(),surfaceOwner:'SKIN-FULLBODY-R02',procedural:window.bodyProceduralSkin.report()});
  presetsBound=true;return true;
 }
 connectPresets();
 // Motion adapters extend the native vertex compiler on the same material
 // object. Three checks material.version before its custom program cache key.
 let nativeVersion=-1,nativeKey='';const render=v.renderer.render.bind(v.renderer);
 v.renderer.render=(scene,camera)=>{if(scene===v.scene){const m=v.skin.material,key=m.customProgramCacheKey();if(m.version!==nativeVersion||key!==nativeKey){nativeVersion=m.version;nativeKey=key;api.material().needsUpdate=true;}}return render(scene,camera);};
 // Each workshop owns its lighting and camera. Keep the transplanted surface,
 // while restoring the workshop's existing presentation and preset-only UI.
 api.inspection.set('native');
 for(const el of document.head.querySelectorAll('style'))if(!originalStyles.has(el))el.remove();
 document.querySelector('#hc-native-toggle')?.remove();
 document.body.classList.remove('hc-focused');
 if(header)header.textContent=title;
 if(shell){if(shellStyle===null)shell.removeAttribute('style');else shell.setAttribute('style',shellStyle);}
 const panel=document.querySelector('#ps-controls');if(panel){panel.hidden=true;panel.style.setProperty('display','none','important');}
 v.camera.position.copy(camera.p);v.camera.quaternion.copy(camera.q);v.camera.zoom=camera.zoom;v.orbit.target.copy(camera.target);v.camera.updateProjectionMatrix();v.orbit.update();
 window.__UNIFIED_SKIN__={version:'SKIN-FULLBODY-R02',sourceBuild:'50f9dd769893584dedb62f0bc62db07ebcb1dcc0',mainline:'f723d28a45327d4b70fed68338eb6a31693792e5',integration:'SKIN-HOST-R01-20261015',ready:false,errors:[],report:()=>({version:'SKIN-FULLBODY-R02',sameModel:window.__IDENTITY_QA__.model()===nativeModel,samePositions:nativeModel.positions===canonicalPositions,sameFaces:nativeModel.faces===canonicalFaces,skin:window.bodyProceduralSkin.report(),head:api.report()})};
 v.render();
 const timer=setInterval(()=>{const s=window.__HEAD_PROC__;if(s?.errors?.length){window.__UNIFIED_SKIN__.errors=s.errors.slice();clearInterval(timer);}else if(s?.gpuVerified&&connectPresets()){window.__UNIFIED_SKIN__.ready=true;window.dispatchEvent(new Event('unified-skin-ready'));clearInterval(timer);}},100);
};
})();
