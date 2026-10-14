/* R02-C2 visual correction after actual candidate screenshots and ray-path probes.
 * Retain C4 head optics; soften only body pigment. No geometry modifications.
 * Ear probe 38547867723: through-skull lamp produces zero transmitted pixels;
 * rear-up lamp exposes the native pinna exit without bypassing head occlusion.
 */
(()=>{'use strict';const previous=window.__installHeadCalibration;
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('R02-C2 contract changed: '+a);return s.replace(a,()=>b);};
window.__installHeadCalibration=(api,v)=>{
 previous(api,v);const body=window.bodyProceduralSkin,mat=api.material(),prior=mat.onBeforeCompile,key=mat.customProgramCacheKey;let final='';
 mat.onBeforeCompile=s=>{prior(s);let f=s.fragmentShader;
  f=once(f,'psSrgb*=1.+psMacro*.105*psVariation;','psSrgb*=1.+psMacro*.105*psVariation*mix(1.,.32,fbBody*fbEnabled);');
  f=once(f,'bodyMottle*.085*fbVariation*fbBody','bodyMottle*.045*fbVariation*fbBody');
  f=once(f,'hcPigment*psVariation*pcBlend','hcPigment*psVariation*pcBlend*mix(1.,.52,fbBody*fbEnabled)');
  f=once(f,'pcChroma*=mix(1.,.72*fbPoreGain,fbEnabled);','pcChroma*=mix(1.,.72*fbPoreGain,fbEnabled*fbBody);');
  f=once(f,'min(1.10,fbTransmission*1.85)','(1.10*fbTransmission)');
  s.fragmentShader=f;final=f;api.finalFragment=f;
 };mat.customProgramCacheKey=()=>key()+'/C2b-restrained-body-and-verified-ear-path';mat.needsUpdate=true;body.fragment=()=>final;
 const rig=v.foldLights,originalFocus=body.focus;let backSnapshot=null,lastView='bust';
 function endBacklight(){if(backSnapshot){const s=backSnapshot;backSnapshot=null;rig.key.visible=s.key;rig.fill.visible=s.fill;v.earLight.intensity=s.earIntensity;v.earLighting=s.earMode;v.earLight.position.copy(s.position);v.earLight.target.position.copy(s.target);v.setFoldLook();}}
 // Native bottom-toolbar views and programmatic lighting changes must also
 // leave the isolated backlight inspection; not only our new camera buttons.
 const nativeView=v.view.bind(v);v.view=(...args)=>{endBacklight();return nativeView(...args);};
 const nativeInspection=api.inspection.set;api.inspection.set=(...args)=>{endBacklight();return nativeInspection(...args);};
 function focus(kind){
  endBacklight();lastView=kind;
  if(!['bust','profile','neck','shoulder'].includes(kind)){v.earLighting='front';return originalFocus(kind);}
  document.body.classList.remove('ear-focus','lips-focus');v.earInspection=false;v.earLight.intensity=0;api.inspection.set('neutral');
  headMorphology.view(kind==='profile'?'left':kind==='bust'?'oblique':'front');
  const delta=v.camera.position.clone().sub(v.orbit.target),target=v.orbit.target.clone();
  const setup={bust:{dy:-.073,scale:1.38,zoom:1.0},profile:{dy:-.075,scale:1.28,zoom:1.0},neck:{dy:-.158,scale:.85,zoom:1.35},shoulder:{dy:-.234,scale:1.15,zoom:1.3}}[kind];
  target.y+=setup.dy;if(kind==='shoulder')target.x+=.075;
  delta.multiplyScalar(setup.scale);v.orbit.target.copy(target);v.camera.position.copy(target).add(delta);v.camera.zoom=setup.zoom;v.camera.updateProjectionMatrix();v.orbit.update();v.render();
  return{kind,center:target.toArray(),camera:v.camera.position.toArray(),zoom:v.camera.zoom,source:'existing head framing, view-state offset only'};
 }
 function backlight(){
  focus('ear');backSnapshot={key:rig.key.visible,fill:rig.fill.visible,earIntensity:v.earLight.intensity,earMode:v.earLighting,position:v.earLight.position.clone(),target:v.earLight.target.position.clone()};
  v.earLighting='back';v.viewEar(1,'oblique');
  const f=v.currentEar.frame,center=v.currentEar.centers[1];
  v.earLight.position.set(...center.map((x,k)=>x+f.up[k]*.4-f.front[k]));v.earLight.target.position.set(...center);
  v.setFoldLook();rig.key.visible=false;rig.fill.visible=false;v.earLight.intensity=4.0;lastView='ear-backlight';v.render();
 }
 body.focus=focus;body.backlight=backlight;
 const section=document.querySelector('#fb-controls'),bar=section.querySelector('.ps-buttons'),extra=document.createElement('div');extra.className='ps-buttons';extra.innerHTML='<button data-fb-view="neck">颈部微距</button><button data-fb-view="shoulder">肩胸肌理</button>';bar.after(extra);
 const note=document.createElement('p');note.id='fb-look-note';note.textContent='逆光检查暂时关闭正面主/辅光，以耳后斜上方灯光观察薄处血色；切回视角即恢复。颈部细褶请在微距检查，不靠放大成沟壑来制造远景可见。';section.append(note);
 section.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{
  if(b.dataset.fbView){e.stopImmediatePropagation();e.preventDefault();focus(b.dataset.fbView);}
  else if(b.dataset.fbAction==='backlight'){e.stopImmediatePropagation();e.preventDefault();backlight();}
  else if(b.dataset.fbAction==='defaults'){e.stopImmediatePropagation();e.preventDefault();api.set(api.referenceRecipe());body.reset();focus('bust');}
 }catch(err){document.querySelector('#fb-status').textContent=String(err);console.error('FULLBODY_LOOK',err);}},true);
 document.querySelector('#ps-controls').addEventListener('click',e=>{if(e.target.closest('[data-ps-view],[data-hc-light],[data-ps-action="cheek"],[data-ps-action="lip"],[data-ps-action="reset"]'))endBacklight();},true);
 const report=body.report;body.report=()=>({...report(),lookCalibration:'R02-C2',bodyMottlingReduced:true,headC4ChromaRetained:true,view:lastView,earBacklightInspection:!!backSnapshot,earBacklightViewStateOnly:true,earLampDirectionInHeadFrame:[0,.4,-1],earLampIntensity:4,nativeViewLightingRestored:true,transmissionControlLinear:true});
 focus('bust');v.render();
};})();
