/* SKIN-FULLBODY-R02. Authored surface fields on the SAME native R06 person.
 * No image textures, external mesh, guessed displacement or second skin shell.
 * Biological variables below are appearance controls, not clinical measurements.
 */
(()=>{'use strict';
const VERSION='SKIN-FULLBODY-R02',SCHEMA='kaopu/procedural-fullbody-surface@1';
const defaults=Object.freeze({enabled:true,regionalColor:.72,lidWarmth:.46,noseWarmth:.38,earBlood:.44,earTransmission:.58,bodyVariation:.64,bodyPores:.78,jointTone:.42,neckCreases:.34,beardShadow:.04,audit:0});
const labels={regionalColor:'解剖分区色差',lidWarmth:'下睑 / 内眼角血色',noseWarmth:'鼻翼 / 鼻尖血色',earBlood:'耳轮 / 耳垂血色',earTransmission:'耳部厚度透光',bodyVariation:'身体肤色层次',bodyPores:'身体毛孔 / 细纹',jointTone:'关节 / 掌跖色差',neckCreases:'颈部浅细褶',beardShadow:'口周 / 下巴毛根底色'};
function validate(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('全身皮肤参数须为对象');const r={...defaults,...input};for(const[k,v]of Object.entries(r)){if(!(k in defaults))throw Error('未知全身皮肤参数 '+k);if(k==='enabled'){if(typeof v!=='boolean')throw Error('无效全身开关');}else if(!Number.isFinite(v)||v<0||v>(k==='audit'?4:1)||(k==='audit'&&!Number.isInteger(v)))throw Error('无效全身皮肤参数 '+k);}return r;}
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('R02 shader contract changed: '+a.slice(0,100));return s.replace(a,()=>b);};
const declaration=`
uniform float fbEnabled,fbRegional,fbLidWarmth,fbNoseWarmth,fbEarBlood,fbTransmission,fbVariation,fbPores,fbJointTone,fbNeckCreases,fbBeard,fbAudit;
uniform vec3 fbRestOffset;
varying vec4 vETissue;varying vec3 vE6Deep;
float fbHead=0.,fbBody=0.,fbLid=0.,fbCanthus=0.,fbNose=0.,fbCheek=0.,fbEarRim=0.,fbEarLobe=0.,fbGlabrous=0.,fbDry=0.,fbBloodMask=0.,fbNeck=0.,fbPoreGain=1.;
vec3 fbGeomN=vec3(0.,0.,1.);
float fbBell(vec3 p,vec3 c,vec3 r){vec3 q=(p-c)/r;return exp(-dot(q,q)*1.5);}
float fbDeepVisibility(vec3 direction){float best=-2.,value=0.;for(int i=0;i<3;i++){vec3 d=normalize((viewMatrix*vec4(uE6WorldDirections[i],0.)).xyz);float a=dot(direction,d);if(a>best){best=a;value=vE6Deep[i];}}return best>.97?clamp(value,0.,1.):0.;}
`;
const regions=`
 // Head masks use the native template frame. Body detail uses the SAME continuous rest field.
 vec3 fbQ=vec3(abs(psP.x),psP.y,psP.z);
 fbHead=smoothstep(.130,.240,psP.y);fbBody=1.-fbHead;
 fbLid=fbBell(fbQ,vec3(.031,.292,.108),vec3(.023,.0065,.025));
 fbCanthus=fbBell(fbQ,vec3(.015,.300,.113),vec3(.005,.005,.013));
 fbNose=.60*fbBell(fbQ,vec3(.018,.267,.122),vec3(.012,.011,.022))+.28*fbBell(fbQ,vec3(.004,.278,.137),vec3(.013,.012,.019));
 fbCheek=fbBell(fbQ,vec3(.044,.280,.080),vec3(.036,.029,.043));
 fbEarRim=psE*fbBell(fbQ,vec3(.077,.284,.009),vec3(.030,.027,.013));
 fbEarLobe=psE*fbBell(fbQ,vec3(.080,.249,.026),vec3(.030,.012,.017));
 fbDry=clamp(vCSExtra.y*2.,0.,1.)*fbBody;
 float fbSole=(1.-smoothstep(-.978,-.950,vCSRest.y))*fbBody;
 fbGlabrous=clamp(max(vCSExtra.z,fbSole),0.,1.);
 fbNeck=fbBell(fbQ,vec3(.025,.124,.033),vec3(.080,.080,.070))*(1.-smoothstep(.185,.225,psP.y));
 fbPoreGain=mix(1.,fbPores*.90,fbBody)*(1.-fbGlabrous*.98);
 fbBloodMask=clamp(fbLid*fbLidWarmth*.72+fbCanthus*fbLidWarmth*.80+fbNose*fbNoseWarmth+fbCheek*.15+psE*fbEarBlood*(.26+.50*fbEarRim+.36*fbEarLobe),0.,1.);
`;
const color=`
 // Restrained, correlated colour layers; never baked shadows or uniform red rings.
 if(fbEnabled>.5){
  float tissueNoise=.80+.20*psNoise(psMM*.095+vec3(9.,31.,67.));
  float warm=fbBloodMask*fbRegional*tissueNoise;
  psSrgb*=vec3(1.+.045*warm,1.-.145*warm,1.-.105*warm);
  float forehead=fbBell(fbQ,vec3(.021,.347,.065),vec3(.063,.031,.077));
  float temple=fbBell(fbQ,vec3(.069,.321,.023),vec3(.020,.032,.033));
  psSrgb+=fbRegional*(vec3(.008,.003,-.006)*forehead+vec3(-.005,-.004,.001)*temple);
  float beard=fbBell(fbQ,vec3(.016,.214,.082),vec3(.050,.027,.041))+.40*fbBell(fbQ,vec3(.020,.243,.106),vec3(.030,.011,.018));
  psSrgb*=exp(-vec3(.080,.070,.046)*beard*fbBeard*(1.-psLipFeather));
  float bodyMottle=(psNoise(psMM*.062+vec3(14.,61.,23.))-.5)*.60+(psNoise(psMM*.21+vec3(43.))-.5)*.40;
  psSrgb*=1.+bodyMottle*.085*fbVariation*fbBody;
  // A smooth exposure tendency, not a neck seam or an automatic tan line.
  psSrgb+=vec3(.008,.010,.009)*fbBody*fbVariation;
  psSrgb*=exp(-vec3(.085,.115,.120)*fbDry*fbJointTone);
  psSrgb=mix(psSrgb,min(psSrgb*vec3(1.07,1.10,1.085)+vec3(.005,.004,.003),vec3(.94)),fbGlabrous*(.38+.32*fbJointTone));
  psSrgb*=1.-psLipFeather*fbRegional*.035*smoothstep(.228,.240,psP.y);
 }
`;
const relief=`
 if(fbEnabled>.5){
  psH*=fbPoreGain;
  float y1=psP.y-(.112+.23*psP.x*psP.x+.0008*sin(psP.x*59.));
  float y2=psP.y-(.066+.35*psP.x*psP.x+.0010*sin(psP.x*43.+1.));
  float creases=exp(-y1*y1/.0000019)+.55*exp(-y2*y2/.0000028);
  psH-=.000028*fbNeckCreases*creases*fbNeck*(1.-smoothstep(.40,1.5,psFoot));
  // Fine palmar/plantar ridge tendency: no facial follicle holes on glabrous skin.
  float ridge=sin(psMM.y*11.+psNoise(psMM*.34)*4.2)*sin(psMM.x*2.4+psNoise(psMM*.23));
  psH+=ridge*.000006*fbGlabrous*fbPores*(1.-smoothstep(.06,.26,psFoot));
  psR=clamp(psR+fbBody*(.045+.060*fbDry)-fbGlabrous*.025,.27,.89);
 }
`;
const transport=`
 // Native R05 measured geometric path / confidence + R06 exit visibility.
 // Effective RGB attenuation is artist-calibrated, not full spectral volume transport.
 if(fbEnabled>.5&&psE>.001&&fbTransmission>.0){
  float fnl=dot(fbGeomN,light.direction);
  float pathMM=clamp(vETissue.x,.15,35.)/max(abs(fnl),.40);
  vec3 extinction=mix(vec3(.20,.49,.78),vec3(.18,.44,.70),fbEarLobe);
  vec3 transmitted=exp(-extinction*pathMM)*max(-fnl,0.);
  float confidence=clamp(vETissue.y,0.,1.)*fbDeepVisibility(light.direction);
  reflectedLight.directDiffuse+=light.color*BRDF_Lambert(material.diffuseColor)*transmitted*confidence*psE*min(1.10,fbTransmission*1.85);
 }
`;
const priorInstall=window.__installHeadCalibration;
window.__installHeadCalibration=(api,v)=>{
 priorInstall(api,v);
 const m=__IDENTITY_QA__.model(),controller=__IDENTITY_QA__.controller(),mat=api.material();
 const tr=m.canonical.headTransform.translation,offset=[tr[0],tr[2],-tr[1]];
 let state=validate(defaults),installCompiles=0,finalFragment='';
 const map={enabled:'fbEnabled',regionalColor:'fbRegional',lidWarmth:'fbLidWarmth',noseWarmth:'fbNoseWarmth',earBlood:'fbEarBlood',earTransmission:'fbTransmission',bodyVariation:'fbVariation',bodyPores:'fbPores',jointTone:'fbJointTone',neckCreases:'fbNeckCreases',beardShadow:'fbBeard',audit:'fbAudit'},U={fbRestOffset:{value:offset}};
 for(const[k,name]of Object.entries(map))U[name]={value:k==='enabled'?1:state[k]};
 const oldCompile=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey;
 mat.onBeforeCompile=s=>{
  oldCompile(s);Object.assign(s.uniforms,U);let f=s.fragmentShader;
  f=once(f,'vec3 psBase=vec3(0.);',declaration+'\nvec3 psBase=vec3(0.);');
  f=once(f,'vec3 psP=vFRest,psMM=psP*1000.;','vec3 psP=mix(vFRest,vCSRest-fbRestOffset,fbEnabled),psMM=psP*1000.;');
  f=once(f,'float psMacro=',regions+'\n float psMacro=');
  f=once(f,'psLowerEye*psThin*.44','psLowerEye*psThin*mix(.44,.19,fbEnabled)');
  f=once(f,'pcBlend=smoothstep(.190,.234,psP.y);',color+'\n pcBlend=mix(smoothstep(.190,.234,psP.y),1.,fbEnabled);');
  f=once(f,'psRadius*(1.+psT*.22-psThinMask*.32)','psRadius*(1.+psT*.22-psThinMask*.32)*mix(1.,.86,fbBody*fbEnabled)');
  f=once(f,'psSpacing*(1.-psT*.10)','psSpacing*(1.-psT*.10)*mix(1.,1.35,fbBody*fbEnabled)');
  f=once(f,'psBase*=clamp(1.+pcChroma,.9,1.08);','pcChroma*=mix(1.,.72*fbPoreGain,fbEnabled);psBase*=clamp(1.+pcChroma,.9,1.08);');
  f=once(f,'roughnessFactor=psR;',relief+'\n roughnessFactor=psR;');
  f=once(f,'vec3 psDx=dFdx(-vViewPosition)','fbGeomN=normal;vec3 psDx=dFdx(-vViewPosition)');
  f=once(f,'#undef RE_Direct',transport+'\n#undef RE_Direct');
  // Move transport inside psDirect; the anchor above follows its closing brace.
  f=once(f,'}\n\n // Native R05','\n // Native R05');
  f=once(f,'\n#undef RE_Direct','\n}\n#undef RE_Direct');
  f=once(f,'#include <opaque_fragment>',`
   if(fbEnabled>.5&&fbAudit>.5&&fbAudit<1.5)outgoingLight=vec3(fbBloodMask,fbGlabrous,fbNeck);
   if(fbEnabled>.5&&fbAudit>1.5&&fbAudit<2.5)outgoingLight=mix(vec3(.035),vec3(exp(-clamp(vETissue.x,.15,35.)*.30),clamp(vETissue.y,0.,1.),0.),psE);
   if(fbEnabled>.5&&fbAudit>2.5&&fbAudit<3.5)outgoingLight=vec3(.15,.60,.32);
   if(fbEnabled>.5&&fbAudit>3.5)outgoingLight=psBase;
   #include <opaque_fragment>`);
  s.fragmentShader=f;finalFragment=f;api.finalFragment=f;installCompiles++;
 };
 mat.customProgramCacheKey=()=>oldKey()+'/fullbody-r02-continuous-rest-and-tissue';mat.needsUpdate=true;
 const panel=document.querySelector('#ps-controls');
 const section=document.createElement('div');section.id='fb-controls';section.innerHTML=`<h3>全身与局部组织</h3><p>头、颈、躯干和四肢共享连续皮肤；手掌 / 足底单独分区。</p><div class="ps-buttons"><button data-fb-view="bust">头颈同框</button><button data-fb-view="profile">下颌侧面</button><button data-fb-view="full">全身</button><button data-fb-view="back">背面</button><button data-fb-view="torso">躯干近看</button><button data-fb-view="hand">手部近看</button><button data-fb-view="eye">眼周近看</button><button data-fb-view="ear">耳部近看</button><button data-fb-action="backlight">耳部逆光</button><button data-fb-action="defaults">恢复 R02</button></div><div class="ps-buttons"><button data-fb-action="legacy">对照 R01 头 / 身分界</button><button data-fb-action="save">保存 R02 完整人物</button></div><label>组织检查<select id="fb-audit"><option value="0">完整皮肤</option><option value="1">血色 / 掌跖 / 颈部</option><option value="2">耳厚度 / 路径可信度</option><option value="3">全身皮肤覆盖检查</option><option value="4">组织底色（排除阴影）</option></select></label><div class="ps-sliders">${Object.entries(labels).map(([k,l])=>`<label>${l}<output data-fb-value="${k}"></output><input data-fb="${k}" aria-label="${l}" type="range" min="0" max="1" step=".01"></label>`).join('')}</div><p id="fb-status" role="status"></p>`;
 panel.insertBefore(section,panel.querySelector('.ps-sliders'));panel.querySelector('h2').innerHTML='程序化全身皮肤 <small>R02 · 连续颈部与局部组织</small>';panel.querySelector('details p').textContent='保留同一个 R06 人物、眼球、耳唇造型、骨架与头型参数。全身皮肤使用统一参考坐标与片元函数，不复制参考贴图。耳透光使用已有几何厚度、路径可信度及光线遮挡；仍为实时 RGB 近似。身体轮廓精度仍受原人物网格限制；未新增毛发、动态颈褶或完整体积散射。';
 panel.querySelector('[data-ps-action="reset"]').textContent='恢复头部配方';document.querySelector('header strong').textContent='全身程序皮肤 · R02';
 const style=document.createElement('style');style.textContent='#fb-controls{margin:12px 0;padding-top:8px;border-top:1px solid #68706b}#fb-controls h3{margin:4px 0;font-size:16px}#fb-audit{width:100%;min-height:38px}#fb-controls input{accent-color:#cbb795}#fb-status{font-size:11px}';document.head.append(style);
 function sync(){window.__FB_ACTIVE__=state.enabled;for(const[k,n]of Object.entries(map))U[n].value=k==='enabled'?Number(state[k]):state[k];for(const el of section.querySelectorAll('[data-fb]')){el.value=state[el.dataset.fb];section.querySelector(`[data-fb-value="${el.dataset.fb}"]`).textContent=Number(el.value).toFixed(2);}section.querySelector('#fb-audit').value=state.audit;section.querySelector('[data-fb-action="legacy"]').textContent=state.enabled?'对照 R01 头 / 身分界':'返回 R02 连续全身';section.querySelector('#fb-status').textContent=state.enabled?'R02 全身连续皮肤 · 色差不是阴影 · 光照驱动耳部透光':'R01 原始头 / 身分组对照 · 未覆盖旧网页';}
 function set(part){state=validate({...state,...part});sync();v.render();return report();}
 function focus(kind){
  document.body.classList.remove('ear-focus','lips-focus');v.earInspection=false;if(v.earLight)v.earLight.intensity=0;api.inspection.set('neutral');
  if(kind==='ear'){v.viewEar(1,'oblique');v.setFoldLook();v.render();return;}
  const a=v.geometry.attributes,pos=a.position,rest=a.csRest,type=a.csType;
  const tests={bust:(x,y,z)=>y>.37&&Math.abs(x)<.31,profile:(x,y,z)=>y>.40&&Math.abs(x)<.16,full:()=>true,back:()=>true,torso:(x,y,z)=>y>-.08&&y<.52&&Math.abs(x)<.19,hand:(x,y,z)=>x>.46&&y>-.08&&y<.19,eye:(x,y,z)=>x>.004&&x<.071&&y>.717&&y<.780&&z>.082};
  const test=tests[kind];if(!test)throw Error('未知检查视角');const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];let count=0;
  for(let i=0;i<pos.count;i++){if(type.getX(i)>.5||!test(rest.getX(i),rest.getY(i),rest.getZ(i)))continue;count++;for(let k=0;k<3;k++){const x=pos.array[i*3+k];lo[k]=Math.min(lo[k],x);hi[k]=Math.max(hi[k],x);}}
  if(count<10)throw Error('检查视角未覆盖原人物');const center=lo.map((x,k)=>(x+hi[k])*.5),radius=Math.hypot(...hi.map((x,k)=>(x-lo[k])*.5));
  const dir=kind==='profile'?[1,.03,.12]:kind==='back'?[.05,.03,-1]:kind==='hand'?[.45,.20,1]:kind==='bust'?[.35,.025,1]:[0,.015,1];
  const norm=Math.hypot(...dir),halfY=v.camera.fov*Math.PI/360,halfX=Math.atan(Math.tan(halfY)*v.camera.aspect),distance=radius/Math.sin(Math.min(halfY,halfX))*(kind==='eye'?1.13:1.05);
  v.camera.zoom=1;v.orbit.target.set(...center);v.camera.position.set(...center.map((x,k)=>x+dir[k]/norm*distance));v.camera.updateProjectionMatrix();v.orbit.update();v.render();return{kind,count,center,distance};
 }
 function backlight(){focus('ear');v.earLighting='back';v.viewEar(1,'oblique');v.setFoldLook();v.render();}
 const inheritedArchive=controller.archive.bind(controller),inheritedRestore=controller.restore.bind(controller);
 function archive(){return{...inheritedArchive(),proceduralBodySurface:{schema:SCHEMA,version:VERSION,settings:{...state}}};}
 async function restore(a){const own=a?.proceduralBodySurface;if(own&&own.schema!==SCHEMA)throw Error('全身皮肤档案版本不支持');const next=validate(own?own.settings:{...defaults,enabled:false});const copy=structuredClone(a);delete copy.proceduralBodySurface;await inheritedRestore(copy);state=next;sync();v.render();return report();}
 function save(){const u=URL.createObjectURL(new Blob([JSON.stringify(archive(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='skin-fullbody-r02-person.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 function report(){return{version:VERSION,settings:{...state},shaderCompiles:installCompiles,source:window.__FULLBODY_SOURCE__||'local',restOffset:offset,coordinateMethod:'one continuous native csRest minus native head-frame translation; no zero body fRest',skinMaps:0,bodyGeometryChanged:false,canonicalTopologyChanged:false,thicknessSource:'native R05 geometry millimetres / path confidence',transmissionVisibility:'native R06 pinna-exit and head-occlusion field',fullVolumetricTransport:false,physicalPhone:false,userVisualAccepted:false};}
 controller.archive=archive;controller.restore=restore;window.fullCommonWorkbench.archive=archive;window.fullCommonWorkbench.restore=restore;api.archive=archive;api.restore=restore;
 const previousReport=api.report;api.report=()=>({...previousReport(),fullbody:report()});
 window.bodyProceduralSkin={version:VERSION,settings:()=>({...state}),set,validate,report,archive,restore,save,focus,backlight,reset:()=>set(defaults),fragment:()=>finalFragment};
 section.addEventListener('input',e=>{if(e.target.dataset.fb)set({[e.target.dataset.fb]:Number(e.target.value)});});section.querySelector('#fb-audit').onchange=e=>set({audit:Number(e.target.value)});
 section.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.fbView)focus(b.dataset.fbView);switch(b.dataset.fbAction){case'legacy':set({enabled:!state.enabled});break;case'backlight':backlight();break;case'defaults':api.set(api.referenceRecipe());set(defaults);focus('bust');break;case'save':save();break;}}catch(err){section.querySelector('#fb-status').textContent=String(err);console.error('FULLBODY_CONTROL',err);}});
 // Retained local button closures must also save/restore the extended full-person archive.
 panel.addEventListener('click',e=>{if(e.target.closest('[data-ps-action="save"]')){e.stopImmediatePropagation();save();}},true);
 panel.querySelector('#ps-file').onchange=async e=>{try{await restore(JSON.parse(await e.target.files[0].text()));}catch(err){section.querySelector('#fb-status').textContent=String(err);}finally{e.target.value='';}};
 sync();focus('bust');v.render();
};
})();
