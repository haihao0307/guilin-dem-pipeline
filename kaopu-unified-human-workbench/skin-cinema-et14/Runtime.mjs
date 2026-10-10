import {attachSkinSampling} from '../skin-quality-r01/SkinSampling.mjs';
import {buildFoldField} from './FoldField.mjs';
import {patchCinemaShader} from './Shader.mjs';
import {VERSION,SCHEMA,DEFAULTS,FIELDS,PRESETS,LIMITS,validate} from './Schema.mjs';
export function installCinema(model){
 if(model.cinemaSkin)return model.cinemaSkin;
 if(!model.identityLab||!model.faceSurface?.attachSkin)throw Error('ET14 requires unchanged ET13 native identity');
 const api={settings:{...DEFAULTS},skins:new Set(),folds:null,signature:'',errors:[],version:VERSION,disposed:false,listeners:new Set()};
 function fields(){
  const key=JSON.stringify([model.identityLab.traits,api.settings.foldSpread,api.settings.compression]);if(api.signature===key)return;
  const next=buildFoldField(model.identityLab,api.settings),old=api.folds;api.folds=next;api.signature=key;
  for(const skin of api.skins)skin.cinemaExtension.sync(false);old?.dispose();
 }
 const nativeArchive=model.archive.bind(model),nativeRestore=model.restore.bind(model),attach=model.faceSurface.attachSkin;
 model.archive=()=>({...nativeArchive(),cinemaSkin:{schema:SCHEMA,topology:model.canonical.topologySha256,settings:{...api.settings}}});
 model.restore=record=>{
  const extra=record?.cinemaSkin;if(extra&&(extra.schema!==SCHEMA||extra.topology!==model.canonical.topologySha256))throw Error('Incompatible close-up skin archive');
  const next=validate(extra?.settings||{...DEFAULTS,enabled:false}),old=api.settings;
  try{api.settings=next;const out=nativeRestore(record);fields();api.sync();return out;}catch(e){api.settings=old;throw e;}
 };
 api.sync=()=>{fields();for(const skin of api.skins)skin.cinemaExtension.sync(false);for(const f of api.listeners)f();};
 api.set=patch=>{const next=validate({...api.settings,...patch}),old=api.settings;try{api.settings=next;api.sync();for(const skin of api.skins)skin.viewer.render();return api.report();}catch(e){api.settings=old;throw e;}};
 api.report=()=>({version:VERSION,settings:{...api.settings},fields:api.folds?.report,materials:[...api.skins].map(s=>({compiles:s.cinemaExtension.compiles,sampling:s.samplingExtension?.report()})),errors:[...api.errors],limits:LIMITS});
 api.dispose=()=>{if(api.disposed)return;api.disposed=true;api.folds?.dispose();api.listeners.clear();api.skins.clear();};
 model.faceSurface.attachSkin=skin=>{attach(skin);skin.cinemaReady=(async()=>{
  await attachSkinSampling(skin);if(skin.disposed||api.disposed)return;
  fields();const material=skin.material,before=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
  const U={uCFolds:{value:api.folds.texture},uCBaseHeight:{value:api.folds.baseHeight},uCEnabled:{value:1},uCSeed:{value:1729}};
  for(const[k]of FIELDS)if(!['foldSpread','compression'].includes(k))U['uC'+k[0].toUpperCase()+k.slice(1)]={value:api.settings[k]};
  const ext={compiles:0,sync(refresh=true){if(refresh)fields();U.uCFolds.value=api.folds.texture;U.uCBaseHeight.value=api.folds.baseHeight;U.uCEnabled.value=api.settings.enabled?1:0;U.uCSeed.value=model.identityLab.traits.seed%997;for(const[k]of FIELDS){const u=U['uC'+k[0].toUpperCase()+k.slice(1)];if(u)u.value=api.settings[k];}}};
  skin.cinemaExtension=ext;api.skins.add(skin);
  material.customProgramCacheKey=()=>cache()+'/'+VERSION;
  material.onBeforeCompile=shader=>{before(shader);Object.assign(shader.uniforms,U);shader.fragmentShader=patchCinemaShader(shader.fragmentShader);ext.compiles++;};
  const update=skin.updateIdentity?.bind(skin),dispose=skin.dispose.bind(skin);
  skin.updateIdentity=()=>{update?.();ext.sync();};
  skin.dispose=()=>{api.skins.delete(skin);dispose();};
  ext.sync();material.needsUpdate=true;skin.viewer.render();return ext;
 })().catch(e=>{api.errors.push(e.message);throw e;});};
 model.cinemaSkin=api;return api;
}
export function mountCinema({model,viewer,controller}){
 document.getElementById('cinemaPanel')?.remove();const api=model.cinemaSkin,shell=document.getElementById('control-shell');
 const panel=document.createElement('section');panel.id='cinemaPanel';
 panel.innerHTML=`<style>
 #control-shell{overflow-y:auto!important;display:block!important}#cinemaPanel{padding:18px;background:#17272f;color:#eef2f3;border-bottom:1px solid #526571;font:13px/1.55 system-ui}#cinemaPanel h2{margin:3px 0 9px;font-size:22px}#cinemaPanel p{color:#b5c2c8;margin:7px 0}#cinemaPanel .ctools{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}#cinemaPanel button{padding:7px 9px;background:#2a414a;color:#f4f4e9;border:1px solid #69818a;border-radius:5px;font:inherit;cursor:pointer}#cinemaPanel button:focus-visible{outline:2px solid #e1eaa5}#cinemaPanel details{border-top:1px solid #425862;margin-top:10px;padding-top:7px}#cinemaPanel summary{cursor:pointer;font-weight:600;color:#dce6bb}#cinemaPanel label{display:grid;grid-template-columns:1fr 115px 45px;gap:8px;align-items:center;margin:10px 0}#cinemaPanel input[type=range]{width:100%}#cinemaPanel output{text-align:right}#cinemaStatus{display:block;min-height:36px;color:#bcd3ca;font-size:11px}#identityPanel{height:420px!important;min-height:420px!important}body.cinema-focus .workbench-entries{display:none!important}body.cinema-focus main{height:calc(100dvh - 56px)!important}body.cinema-focus .model-stage{height:calc(100dvh - 180px)!important}
 </style><small>ET14-S1 · CLOSE-UP SURFACE STUDY</small><h2>皮肤近景精修</h2><p>同一原生人物。分区微表面、反射与折纹剖面可独立对照。研究候选，尚未达到影视成品验收。</p>
 <div class="ctools"><button data-cview="face">整脸</button><button data-cview="nose">鼻颊微距</button><button data-cview="mouth">唇部微距</button><button data-cview="oblique">斜视</button><button id="cinemaFocus">显示／隐藏原动作入口</button></div>
 <div class="ctools">${Object.entries(PRESETS).map(([id,p])=>`<button data-cpreset="${id}">${p.label}</button>`).join('')}</div>
 <div class="ctools"><button id="cinemaAB">按住对照：仅采样基线</button><button id="cinemaEnable">开启精修</button><button id="cinemaSave">保存完整人物</button></div>
 <div class="ctools"><button data-clayer="beauty">合成</button><button data-clayer="color">肤色</button><button data-clayer="normal">法线</button><button data-clayer="roughness">粗糙度</button></div>
 ${[...new Set(FIELDS.map(f=>f[6]))].map(group=>`<details ${group==='微表面'?'open':''}><summary>${group}</summary>${FIELDS.filter(f=>f[6]===group).map(([k,label,lo,hi,step,unit])=>`<label>${label}<input data-cfield="${k}" type="range" min="${lo}" max="${hi}" step="${step}"><output data-cout="${k}"></output></label>`).join('')}</details>`).join('')}
 <p>折纹“压缩／拉伸”是手动剖面试验，不是表情应力求解；细节仍为法线起伏，不改变实体轮廓。肤色、雀斑、痘印、疤痕等原参数在下方保留。</p><output id="cinemaStatus">准备原生材质与分区采样…</output>`;
 shell.prepend(panel);document.body.classList.add('cinema-focus');
 const status=text=>panel.querySelector('#cinemaStatus').textContent=text;
 const sync=()=>{for(const[k]of FIELDS){panel.querySelector(`[data-cfield="${k}"]`).value=api.settings[k];panel.querySelector(`[data-cout="${k}"]`).textContent=api.settings[k].toFixed(2);}panel.querySelector('#cinemaEnable').textContent=api.settings.enabled?'精修已开启（点击关闭）':'精修关闭（点击开启）';status(api.errors.length?api.errors.join('; '):`17个表面控制 · 原89五官／37身份控制保留 · ${api.folds?.report.paths||0}条折纹 · ${api.settings.enabled?'精修':'对照'}模式`);};
 const safe=f=>{try{f();sync();}catch(e){status('未应用：'+e.message);}};
 for(const el of panel.querySelectorAll('[data-cfield]')){el.oninput=()=>panel.querySelector(`[data-cout="${el.dataset.cfield}"]`).textContent=(+el.value).toFixed(2);el.onchange=()=>safe(()=>api.set({[el.dataset.cfield]:+el.value}));}
 const recipe=id=>{const p=PRESETS[id];if(!p)throw Error('Unknown close-up preset');if(p.identityRecipe)window.identityWorkbench.skinRecipe(p.identityRecipe);model.eyeSurface.set({gray:false,grid:false});model.faceSurface.set({enabled:true,layer:'beauty'});api.set({...DEFAULTS,...p.values,enabled:true});controller.changed();};
 for(const el of panel.querySelectorAll('[data-cpreset]'))el.onclick=()=>safe(()=>recipe(el.dataset.cpreset));
 for(const el of panel.querySelectorAll('[data-cview]'))el.onclick=()=>safe(()=>el.dataset.cview==='face'?viewer.view('face'):model.faceSurface.featureView(el.dataset.cview));
 for(const el of panel.querySelectorAll('[data-clayer]'))el.onclick=()=>safe(()=>{model.faceSurface.set({layer:el.dataset.clayer});controller.changed();});
 panel.querySelector('#cinemaFocus').onclick=()=>{document.body.classList.toggle('cinema-focus');window.dispatchEvent(new Event('resize'));};
 panel.querySelector('#cinemaEnable').onclick=()=>safe(()=>api.set({enabled:!api.settings.enabled}));
 let held=null;const compare=on=>{if(on&&held===null){held=api.settings.enabled;api.set({enabled:false});}else if(!on&&held!==null){const value=held;held=null;api.set({enabled:value});}};
 const ab=panel.querySelector('#cinemaAB');ab.onpointerdown=e=>{e.preventDefault();ab.setPointerCapture(e.pointerId);safe(()=>compare(true));};for(const type of ['pointerup','pointercancel','lostpointercapture'])ab.addEventListener(type,()=>safe(()=>compare(false)));ab.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();safe(()=>compare(true));}};ab.onkeyup=()=>safe(()=>compare(false));const blur=()=>compare(false);window.addEventListener('blur',blur);
 panel.querySelector('#cinemaSave').onclick=()=>{const data=controller.archive(),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='native-human-et14-surface.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 api.listeners.add(sync);controller.addEventListener('change',sync);
 api.disposeUI=()=>{window.removeEventListener('blur',blur);controller.removeEventListener('change',sync);api.listeners.delete(sync);panel.remove();};
 window.cinemaWorkbench={version:VERSION,ready:()=>viewer.skin.cinemaReady,report:api.report,set:api.set,preset:recipe,fields:FIELDS,compare,render:()=>viewer.render(),view:which=>which==='face'?viewer.view('face'):model.faceSurface.featureView(which)};
 viewer.skin.cinemaReady.then(()=>{sync();viewer.view('face');window.dispatchEvent(new Event('resize'));}).catch(e=>status('材质准备失败：'+e.message));sync();
}
