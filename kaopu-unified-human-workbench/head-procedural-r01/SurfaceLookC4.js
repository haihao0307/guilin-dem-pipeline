/* R01-C4. Independent optical calibration on the same native person.
 * No input skin images, environment images or reference model. Inspection lights
 * are separate viewport state, not a baked compensation in the surface recipe. */
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
   // Retain the platform's actual pinna/head occlusion, not a painted dark mask.
   s.fragmentShader=once(s.fragmentShader,'RE_Direct_Physical(light,pos,N,V,CN,material,reflectedLight);','IncidentLight hcLight=light;hcLight.color*=hcEarVisibility(light.direction);RE_Direct_Physical(hcLight,pos,N,V,CN,material,reflectedLight);');
   s.fragmentShader=once(s.fragmentShader,'*light.color*BRDF_Lambert(material.diffuseColor)','*hcLight.color*BRDF_Lambert(material.diffuseColor)');
   s.fragmentShader=once(s.fragmentShader,'psSrgb*vec3(1.03,.68,.72)+vec3(.028,.006,.006)','psSrgb*vec3(1.01,.74,.83)+vec3(.018,.004,.009)');
   s.fragmentShader=once(s.fragmentShader,'psBase*=clamp(1.+pcChroma,.9,1.08);',`float hcPigment=(psNoise(psMM*.19+vec3(73.))-0.5)*.72+(psNoise(psMM*.76+vec3(19.))-0.5)*.28;
    psBase*=exp(-vec3(.055,.105,.14)*hcPigment*psVariation*pcBlend*(1.-psLipFeather*.7));
    psBase*=clamp(1.+pcChroma,.9,1.08);`);
   // Compensate only the inherited collar transition for the changed specular gain.
   s.fragmentShader=s.fragmentShader.split('.52/.68').join('.52/.80');
   api.finalFragment=s.fragmentShader;
  };
  mat.customProgramCacheKey=()=>key()+'/C4-optics-and-native-ear-visibility';mat.needsUpdate=true;
  const lights=v.scene.children.filter(o=>o.isLight),snapshot=lights.map(o=>({object:o,color:o.color.clone(),ground:o.groundColor?.clone(),intensity:o.intensity}));
  const directional=snapshot.filter(x=>x.object.isDirectionalLight),hemi=snapshot.filter(x=>x.object.isHemisphereLight);
  if(directional.length!==3||hemi.length!==1)throw Error('C4 expects the retained three lamps and hemisphere');
  let mode='neutral';
  function applyLight(){
   if(mode==='native'){for(const x of snapshot){x.object.color.copy(x.color);x.object.intensity=x.intensity;if(x.ground)x.object.groundColor.copy(x.ground);}return;}
   const colours=[[1,.96,.92],[.87,.94,1],[1,.98,.96]],power=[3.0,1.05,.32];
   for(let i=0;i<3;i++){directional[i].object.color.setRGB(...colours[i]);directional[i].object.intensity=power[i];}
   hemi[0].object.color.setRGB(.92,.96,1);hemi[0].object.groundColor.setRGB(.12,.13,.15);hemi[0].object.intensity=.85;
  }
  function lightReport(){return{mode,viewStateOnly:true,source:'authored constant light colours and intensities; original directions retained',lights:snapshot.map(x=>({type:x.object.type,color:x.object.color.toArray(),ground:x.object.groundColor?.toArray(),intensity:x.object.intensity,position:x.object.position.toArray()})),native:snapshot.map(x=>({type:x.object.type,color:x.color.toArray(),ground:x.ground?.toArray(),intensity:x.intensity,position:x.object.position.toArray()}))};}
  const render=v.renderer.render.bind(v.renderer);v.renderer.render=(scene,camera)=>{if(scene===v.scene)applyLight();return render(scene,camera);};
  const panel=document.querySelector('#ps-controls'),bar=document.createElement('div');bar.className='ps-buttons';bar.id='hc-light-controls';bar.innerHTML='<button data-hc-light="neutral" aria-pressed="true">中性检查光</button><button data-hc-light="native" aria-pressed="false">原平台灯光</button>';
  panel.querySelector('h2 small').textContent='R01 · C4 表面与光学校准';panel.insertBefore(bar,panel.querySelector('.ps-buttons'));
  const note=document.createElement('p');note.id='hc-light-note';note.textContent='光照与皮肤独立切换；对照原皮肤时保持当前光照。';bar.after(note);
  function setLight(value){if(!['neutral','native'].includes(value))throw Error('Unknown inspection light');mode=value;applyLight();for(const b of bar.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.hcLight===mode));v.render();return lightReport();}
  bar.onclick=e=>{const b=e.target.closest('[data-hc-light]');if(b)setLight(b.dataset.hcLight);};
  api.inspection={set:setLight,report:lightReport};api.referenceRecipe=()=>({...recipe});
  // Existing file/identity/shape archives continue to carry all surface parameters.
  // Illumination remains explicitly separate viewport state.
  panel.addEventListener('click',e=>{if(e.target.closest('[data-ps-action="reset"]')){e.preventDefault();e.stopImmediatePropagation();api.set(recipe);}},true);
  const originalHeader=document.querySelector('header'),toggle=document.createElement('button');toggle.id='hc-native-toggle';toggle.textContent='展开人物总入口';toggle.setAttribute('aria-expanded','false');originalHeader.append(toggle);document.body.classList.add('hc-focused');
  toggle.onclick=()=>{const focused=document.body.classList.toggle('hc-focused');toggle.textContent=focused?'展开人物总入口':'回到皮肤检查';toggle.setAttribute('aria-expanded',String(!focused));};
  const style=document.createElement('style');style.textContent=`body.hc-focused.workbench-entry-layout{grid-template-rows:auto minmax(0,1fr)}body.hc-focused>#workbench-entries{display:none!important}body.hc-focused>header>*:not(:first-child):not(strong):not(#hc-native-toggle){display:none!important}#hc-native-toggle{margin-left:auto;font-size:12px}#hc-light-controls button[aria-pressed="true"]{border-color:#d2bb91;background:#354442}#hc-light-note{font-size:11px!important}.hc-focused .model-caption{font-size:11px}#ps-controls h2{font-size:18px}`;document.head.append(style);
  api.calibration={...api.calibration,version:'R01-C4',intrinsicPigmentVariation:true,lipMauveTransition:true,retainedEarVisibility:true,referenceDataCopied:false,lightingUnchanged:false,lightingIndependent:true,referenceEquivalenceAccepted:false};
  const report=api.report;api.report=()=>({...report(),calibration:api.calibration,inspection:lightReport()});
  api.set(recipe);applyLight();v.render();
 };
})();
