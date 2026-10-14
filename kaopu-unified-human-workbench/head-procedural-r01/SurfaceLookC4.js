/* R01-C4. Independent surface optics on the retained native person.
 * Inspection light changes target the ACTIVE named fold rig, not hidden scene
 * lamps. The native lighting controller remains authoritative in native mode. */
(()=>{'use strict';
 const previous=window.__installHeadCalibration;
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('C4 shader contract changed: '+a);return s.replace(a,()=>b);};
 const recipe={enabled:true,seed:731,tone:.72,warmth:.46,blood:.48,variation:.90,pores:.88,poreRadius:.09,poreSpacing:.58,microrelief:.72,roughness:.51,oil:.26,scatter:.62,freckles:.20,lipColor:.54,lipWetness:.24,eyeThinness:.34,diagnostic:0};
 window.__installHeadCalibration=(api,v)=>{
  previous(api,v);const mat=api.material(),compile=mat.onBeforeCompile,key=mat.customProgramCacheKey;
  mat.specularIntensity=.80;
  mat.onBeforeCompile=s=>{compile(s);
   s.fragmentShader=once(s.fragmentShader,'vec3 psBase=vec3(0.);',`uniform float uE6Enabled;uniform vec3 uE6WorldDirections[3];varying vec3 vE6Direct;varying float vE6Weight;
float hcEarVisibility(vec3 direction){float agreement=-2.,visible=1.;for(int i=0;i<3;i++){vec3 d=normalize((viewMatrix*vec4(uE6WorldDirections[i],0.)).xyz);float a=dot(direction,d);if(a>agreement){agreement=a;visible=vE6Direct[i];}}return mix(1.,clamp(visible,0.,1.),clamp(vE6Weight,0.,1.)*uE6Enabled);}
vec3 psBase=vec3(0.);`);
   s.fragmentShader=once(s.fragmentShader,'RE_Direct_Physical(light,pos,N,V,CN,material,reflectedLight);','IncidentLight hcLight=light;hcLight.color*=hcEarVisibility(light.direction);RE_Direct_Physical(hcLight,pos,N,V,CN,material,reflectedLight);');
   s.fragmentShader=once(s.fragmentShader,'*light.color*BRDF_Lambert(material.diffuseColor)','*hcLight.color*BRDF_Lambert(material.diffuseColor)');
   s.fragmentShader=once(s.fragmentShader,'psSrgb*vec3(1.03,.68,.72)+vec3(.028,.006,.006)','psSrgb*vec3(1.01,.74,.83)+vec3(.018,.004,.009)');
   s.fragmentShader=once(s.fragmentShader,'psBase*=clamp(1.+pcChroma,.9,1.08);',`float hcPigment=(psNoise(psMM*.19+vec3(73.))-0.5)*.72+(psNoise(psMM*.76+vec3(19.))-0.5)*.28;
    psBase*=exp(-vec3(.055,.105,.14)*hcPigment*psVariation*pcBlend*(1.-psLipFeather*.7));
    psBase*=clamp(1.+pcChroma,.9,1.08);`);
   s.fragmentShader=s.fragmentShader.split('.52/.68').join('.52/.80');api.finalFragment=s.fragmentShader;
  };
  mat.customProgramCacheKey=()=>key()+'/C4-optics-and-native-ear-visibility';mat.needsUpdate=true;
  const rig=v.foldLights;
  if(!rig?.key?.isDirectionalLight||!rig?.fill?.isDirectionalLight||!rig?.ambient?.isHemisphereLight||!rig.group)throw Error('Active native lighting rig is missing');
  const lamps=[{role:'key',object:rig.key},{role:'fill',object:rig.fill},{role:'ambient',object:rig.ambient}];
  let snapshot=lamps.map(x=>({...x,color:x.object.color.clone(),ground:x.object.groundColor?.clone(),intensity:x.object.intensity})),mode='neutral';
  function restoreNative(){for(const x of snapshot){x.object.color.copy(x.color);x.object.intensity=x.intensity;if(x.ground)x.object.groundColor.copy(x.ground);}}
  function captureNative(){snapshot=lamps.map(x=>({...x,color:x.object.color.clone(),ground:x.object.groundColor?.clone(),intensity:x.object.intensity}));}
  // Remove our previous override BEFORE the original controller computes its
  // current native settings. Thus native controls and preset edits are not lost.
  const nativeSetFoldLook=v.setFoldLook.bind(v);
  v.setFoldLook=function(...args){restoreNative();const result=nativeSetFoldLook(...args);captureNative();return result;};
  function applyLight(){
   if(mode==='native'||!rig.group.visible){restoreNative();return;}
   rig.key.color.setRGB(1,.965,.93);rig.key.intensity=3.2;
   rig.fill.color.setRGB(.91,.955,1);rig.fill.intensity=1.35;
   rig.ambient.color.setRGB(.95,.975,1);rig.ambient.groundColor.setRGB(.12,.13,.145);rig.ambient.intensity=.38;
  }
  function visible(o){for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;}
  function values(x,native=false){return{role:x.role,type:x.object.type,parent:x.object.parent?.name||'',effectiveVisible:visible(x.object),color:(native?x.color:x.object.color).toArray(),ground:(native?x.ground:x.object.groundColor)?.toArray(),intensity:native?x.intensity:x.object.intensity,position:x.object.position.toArray(),target:x.object.target?.position.toArray()};}
  function lightReport(){return{mode,viewStateOnly:true,binding:'named foldLights key/fill/ambient, not hidden scene children',source:'authored colours/intensities; original directions and visibility preserved',lights:snapshot.map(x=>values(x)),native:snapshot.map(x=>values(x,true)),nativeControlsRetained:true};}
  const render=v.renderer.render.bind(v.renderer);v.renderer.render=(scene,camera)=>{if(scene===v.scene)applyLight();return render(scene,camera);};
  const panel=document.querySelector('#ps-controls'),bar=document.createElement('div');bar.className='ps-buttons';bar.id='hc-light-controls';bar.innerHTML='<button data-hc-light="neutral" aria-pressed="true">中性检查光</button><button data-hc-light="native" aria-pressed="false">原平台灯光</button>';
  panel.querySelector('h2 small').textContent='R01 · C4 表面与光学校准';panel.insertBefore(bar,panel.querySelector('.ps-buttons'));
  const note=document.createElement('p');note.id='hc-light-note';note.textContent='光照与皮肤独立切换；对照原皮肤时保持当前光照。';bar.after(note);
  function setLight(value){if(!['neutral','native'].includes(value))throw Error('Unknown inspection light');mode=value;applyLight();for(const b of bar.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.hcLight===mode));v.render();return lightReport();}
  bar.onclick=e=>{const b=e.target.closest('[data-hc-light]');if(b)setLight(b.dataset.hcLight);};api.inspection={set:setLight,report:lightReport};api.referenceRecipe=()=>({...recipe});
  panel.addEventListener('click',e=>{if(e.target.closest('[data-ps-action="reset"]')){e.preventDefault();e.stopImmediatePropagation();api.set(recipe);}},true);
  const originalHeader=document.querySelector('header'),toggle=document.createElement('button');toggle.id='hc-native-toggle';toggle.textContent='展开人物总入口';toggle.setAttribute('aria-expanded','false');originalHeader.append(toggle);document.body.classList.add('hc-focused');
  toggle.onclick=()=>{const focused=document.body.classList.toggle('hc-focused');toggle.textContent=focused?'展开人物总入口':'回到皮肤检查';toggle.setAttribute('aria-expanded',String(!focused));};
  const style=document.createElement('style');style.textContent=`body.hc-focused.workbench-entry-layout{grid-template-rows:auto minmax(0,1fr)}body.hc-focused>#workbench-entries{display:none!important}body.hc-focused>header>*:not(:first-child):not(strong):not(#hc-native-toggle){display:none!important}#hc-native-toggle{margin-left:auto;font-size:12px}#hc-light-controls button[aria-pressed="true"]{border-color:#d2bb91;background:#354442}#hc-light-note{font-size:11px!important}.hc-focused .model-caption{font-size:11px}#ps-controls h2{font-size:18px}`;document.head.append(style);
  api.calibration={...api.calibration,version:'R01-C4',intrinsicPigmentVariation:true,lipMauveTransition:true,retainedEarVisibility:true,referenceDataCopied:false,lightingUnchanged:false,lightingIndependent:true,activeRigBinding:true,referenceEquivalenceAccepted:false};
  const report=api.report;api.report=()=>({...report(),calibration:api.calibration,inspection:lightReport()});api.set(recipe);applyLight();v.render();
 };
})();
