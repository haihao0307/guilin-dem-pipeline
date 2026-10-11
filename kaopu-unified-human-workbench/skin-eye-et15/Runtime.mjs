import {OPTIC_SCHEMA,OPTIC_DEFAULTS,OPTIC_FIELDS,validateOptics,attachOptics} from './EyeSurface.mjs';
import {VERSION,PROFILE_INDEX,STAGES,createLibrary} from './ProfileLibrary.mjs';
import {FACE_DEFAULTS} from '../face-transfer/FaceSurface.mjs';
import {EYE_DEFAULTS} from '../eye-transfer/NativeEyeLayer.mjs';
import {PRESETS as TREATMENTS,DEFAULTS as CINEMA} from '../skin-cinema-et14/Schema.mjs';
export function installET15(model){
 if(model.et15)return model.et15;
 const api={version:VERSION,settings:{...OPTIC_DEFAULTS},cast:null,skins:new Set(),errors:[],listeners:new Set(),disposed:false};
 const archive=model.archive.bind(model),restore=model.restore.bind(model),attach=model.faceSurface.attachSkin;
 model.archive=()=>({...archive(),et15:{schema:OPTIC_SCHEMA,topology:model.canonical.topologySha256,optics:{...api.settings},cast:api.cast?structuredClone(api.cast):null}});
 model.restore=record=>{
  const extra=record?.et15;if(extra&&(extra.schema!==OPTIC_SCHEMA||extra.topology!==model.canonical.topologySha256))throw Error('Incompatible native ET15 appearance archive');
  const next=validateOptics(extra?.optics||{...OPTIC_DEFAULTS,enabled:false});
  if(extra?.cast&&(!PROFILE_INDEX.some(p=>p.id===extra.cast.id)||!Number.isInteger(extra.cast.seed)))throw Error('Invalid cast reference');
  const prior=api.settings,cast=api.cast;
  try{api.settings=next;api.cast=extra?.cast?structuredClone(extra.cast):null;const out=restore(record);api.sync();return out;}catch(e){api.settings=prior;api.cast=cast;api.sync();throw e;}
 };
 api.sync=()=>{for(const s of api.skins)s.et15Optics?.sync();for(const f of api.listeners)f();};
 api.set=patch=>{api.settings=validateOptics({...api.settings,...patch});api.sync();for(const s of api.skins)s.viewer.render();return api.report();};
 api.report=()=>({version:VERSION,optics:{...api.settings},cast:api.cast,skins:[...api.skins].map(s=>s.et15Optics.report()),errors:[...api.errors],geometryReplaced:false,filmQualityAccepted:false,liveStressSolver:false});
 model.faceSurface.attachSkin=skin=>{attach(skin);skin.et15Ready=(async()=>{await skin.cinemaReady;if(skin.disposed||api.disposed)return;return attachOptics(skin,api);})().catch(e=>{api.errors.push(e.message);throw e;});};
 api.dispose=()=>{api.disposed=true;api.listeners.clear();api.skins.clear();};model.et15=api;return api;
}
export function mountET15({model,viewer,controller}){
 const api=model.et15,library=createLibrary(controller.defaults),byId=new Map(library.map(p=>[p.id,p]));let expressionBefore=null,comparison=null,disposed=false;
 const nativePreset=controller.applyPreset.bind(controller);
 function archiveFor(id){
  const p=byId.get(id);if(!p)throw Error('Unknown cast identity');const a=controller.archive();delete a.preset;
  a.state=structuredClone(p.state);a.eyeSurface.settings={...EYE_DEFAULTS};a.faceSurface.settings={...FACE_DEFAULTS};
  a.faceIdentity.traits={...p.traits};a.faceIdentity.shape={...p.shape};a.cinemaSkin.settings={...p.cinema};
  a.surface={schema:'kaopu-common-surface/1',settings:{...p.skin}};
  a.et15={schema:OPTIC_SCHEMA,topology:model.canonical.topologySha256,optics:{...p.optics},cast:{id:p.id,seed:p.seed,version:VERSION,history:p.history,artDirected:true,measured:false}};return a;
 }
 function apply(id){expressionBefore=null;comparison=null;controller.restore(archiveFor(id));sync();return api.report();}
 controller.applyPreset=id=>byId.has(id)?apply(id):nativePreset(id);
 function restoreExpression(){if(!expressionBefore)return;const old=expressionBefore;expressionBefore=null;controller.commit(old);sync();}
 function blink(amount){if(!Number.isFinite(amount)||amount<0||amount>1)throw Error('Invalid blink fraction');if(!expressionBefore)expressionBefore=controller.state();const s=structuredClone(expressionBefore);s.owners.expression='anny';s.anny.facialActions.eyeBlinkLeft=amount;s.anny.facialActions.eyeBlinkRight=amount;controller.commit(s);sync();}
 function view(which){if(which==='eyes'){window.eyeTransferredHuman.viewEyes();}else if(which==='face')viewer.view('face');else model.faceSurface.featureView(which);viewer.render();}
 async function settled(){await viewer.skin.et15Ready;for(let i=0;i<2;i++){await new Promise(resolve=>requestAnimationFrame(resolve));viewer.render();viewer.renderer.getContext().finish();}return true;}
 function treatment(id){const p=TREATMENTS[id];if(!p)throw Error('Unknown skin treatment');model.cinemaSkin.set({...CINEMA,...p.values,enabled:true});sync();}
 function compare(on){if(on&&comparison===null){comparison={eye:api.settings.enabled,skin:model.cinemaSkin.settings.enabled};api.set({enabled:false});model.cinemaSkin.set({enabled:false});}else if(!on&&comparison){const previous=comparison;comparison=null;api.set({enabled:previous.eye});model.cinemaSkin.set({enabled:previous.skin});}viewer.render();sync();}
 const panel=document.createElement('section');panel.id='et15Panel';panel.innerHTML=`<style>
 #et15Panel{font:13px/1.55 system-ui;color:#e4ecef;background:#16252e;padding:20px 18px;border-bottom:1px solid #45616b}#et15Panel h2{font-size:25px;margin:3px 0 7px;letter-spacing:.02em}#et15Panel p{color:#b4c5cc;margin:8px 0}#et15Panel .eyebrow{color:#92b8bf;font-size:11px;letter-spacing:.17em}#et15Panel .tools{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}#et15Panel button,#et15Panel select{font:inherit;cursor:pointer;color:#e7eeee;border:1px solid #52717b;background:#253c46;border-radius:5px;padding:7px 9px}#et15Panel button:hover,#et15Panel button[aria-pressed=true]{background:#38606a;border-color:#9cc5ca}#et15Panel button:focus-visible{outline:2px solid #cfdbc3}#et15Panel select{width:100%;margin:7px 0}#et15Panel .castgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}#et15Panel .castgrid button{text-align:left;min-height:58px;font-size:12px}#et15Panel details{border-top:1px solid #354d59;padding-top:8px;margin-top:11px}#et15Panel summary{cursor:pointer;color:#d0dec1;font-weight:600}#et15Panel label{display:grid;grid-template-columns:1fr 112px 36px;gap:8px;align-items:center;margin:10px 0}#et15Panel input[type=range]{width:100%}#et15Panel output{font-size:11px;text-align:right}#et15Current{font-size:16px;font-weight:600;color:#f2ebd9;margin:10px 0 2px}#et15Status{display:block;min-height:36px;text-align:left!important;color:#a9c8c0}#control-shell{overflow-y:auto!important;display:block!important}#et15Original{padding:12px;color:#b8cbd0;background:#152128}#et15Original>summary{cursor:pointer;padding:8px}#et15Original #identityPanel{height:650px!important;min-height:650px!important}body.cinema-focus main{height:calc(100dvh - 56px)!important}body.cinema-focus .model-stage{height:calc(100dvh - 160px)!important}
 </style><div class="eyebrow">NATIVE HUMAN / ET15-R1</div><h2>人物 · 眼睛与肤质</h2><p>36 个原生体格，各自固定五官与表皮档案。切换即用，不需要先调参数。</p>
 <div class="tools"><button data-eview="face">整脸</button><button data-eview="eyes">双眼近景</button><button data-eview="nose">鼻颊微距</button><button data-eview="oblique">斜面检查</button></div>
 <div id="et15Current">载入人物…</div><select id="et15Stage" aria-label="人物阶段">${STAGES.map(s=>`<option value="${s}">${PROFILE_INDEX.find(p=>p.stage===s).stageLabel} · 6 人</option>`).join('')}</select><div class="castgrid" id="et15Cast"></div>
 <div class="tools"><button id="et15Compare">按住：同人原表面对照</button><button id="et15Reset">恢复此人物预设</button></div>
 <details open><summary>同一人物 · 四种肤质对照</summary><div class="tools"><button data-treatment="fine">细腻哑光</button><button data-treatment="dry">干燥细纹</button><button data-treatment="oily">润泽 T 区</button><button data-treatment="weathered">粗肤微表面</button></div><p>只改变表面质感，不换脸、不改变雀斑或伤痕的位置。</p></details>
 <details><summary>眼睛参数与闭眼检查</summary><label>虹膜颜色<input id="et15Iris" type="color"><output></output></label>${OPTIC_FIELDS.map(([k,label,min,max,step])=>`<label>${label}<input data-optic="${k}" type="range" min="${min}" max="${max}" step="${step}"><output data-opticout="${k}"></output></label>`).join('')}<div class="tools"><button data-blink="0">睁眼</button><button data-blink="0.5">半闭</button><button data-blink="1">闭眼</button><button id="et15Expression">恢复原表情</button></div><p>原生眼睑动作检验；不表示极端组合已经无穿插。眼表反射与贴合遮蔽已接入，实体角膜折射和泪液几何尚未重建。</p></details>
 <details><summary>完整档案与导入</summary><div class="tools"><button id="et15Save">保存当前人物</button><button id="et15Import">导入人物</button><button id="et15SaveAll">导出 36 人档案</button></div><input id="et15File" type="file" accept="application/json,.json" hidden></details>
 <p>皱纹采用谷部与两侧隆起的表面剖面，去掉旧的黑色刻线叠加；尚不是组织应力模拟，也未通过影视成品验收。</p><output id="et15Status">等待原生皮肤材质…</output>`;
 const shell=document.getElementById('control-shell'),original=document.createElement('details');original.id='et15Original';original.innerHTML='<summary>原工作台全部控制：五官、皮肤、眼睑、动作与身体</summary>';for(const child of [...shell.children])original.append(child);shell.append(panel,original);
 function grid(){const stage=panel.querySelector('#et15Stage').value,host=panel.querySelector('#et15Cast');host.replaceChildren();for(const p of library.filter(p=>p.stage===stage)){const b=document.createElement('button');b.dataset.cast=p.id;b.innerHTML=p.label+'<br><small>'+p.history+'</small>';b.onclick=()=>safe(async()=>{await window.fullCommonWorkbench.applyPreset(p.id);view('face');});host.append(b);}}
 function sync(){if(disposed)return;const p=byId.get(api.cast?.id);panel.querySelector('#et15Current').textContent=p?p.label+' · '+p.history:'自定义原生人物';if(p&&panel.querySelector('#et15Stage').value!==p.stage){panel.querySelector('#et15Stage').value=p.stage;grid();}for(const b of panel.querySelectorAll('[data-cast]'))b.setAttribute('aria-pressed',String(b.dataset.cast===p?.id));for(const[k]of OPTIC_FIELDS){panel.querySelector(`[data-optic="${k}"]`).value=api.settings[k];panel.querySelector(`[data-opticout="${k}"]`).textContent=api.settings[k].toFixed(2);}panel.querySelector('#et15Iris').value=api.settings.irisColor;panel.querySelector('#et15Status').textContent=api.errors.length?api.errors.join('; '):`${VERSION} · 同一原生网格 · ${api.skins.size} 个材质实例 · ${comparison?'原表面对照':'精修表面'} · 桌面检查版`;}
 async function safe(fn){try{panel.querySelector('#et15Status').textContent='正在更新同一人物…';await new Promise(r=>requestAnimationFrame(r));await fn();await settled();sync();}catch(e){panel.querySelector('#et15Status').textContent='未应用：'+e.message;console.error(e);}}
 panel.querySelector('#et15Stage').value='adult';panel.querySelector('#et15Stage').onchange=grid;grid();
 for(const el of panel.querySelectorAll('[data-eview]'))el.onclick=()=>safe(()=>view(el.dataset.eview));
 for(const el of panel.querySelectorAll('[data-treatment]'))el.onclick=()=>safe(()=>treatment(el.dataset.treatment));
 for(const el of panel.querySelectorAll('[data-optic]')){el.oninput=()=>panel.querySelector(`[data-opticout="${el.dataset.optic}"]`).textContent=(+el.value).toFixed(2);el.onchange=()=>safe(()=>api.set({[el.dataset.optic]:+el.value}));}
 panel.querySelector('#et15Iris').onchange=e=>safe(()=>api.set({irisColor:e.target.value}));
 for(const el of panel.querySelectorAll('[data-blink]'))el.onclick=()=>safe(()=>blink(+el.dataset.blink));
 panel.querySelector('#et15Expression').onclick=()=>safe(restoreExpression);panel.querySelector('#et15Reset').onclick=()=>safe(()=>apply(api.cast?.id||'r02-adult-male-sturdy'));
 const ab=panel.querySelector('#et15Compare');ab.onpointerdown=e=>{e.preventDefault();ab.setPointerCapture(e.pointerId);compare(true);};for(const name of ['pointerup','pointercancel','lostpointercapture'])ab.addEventListener(name,()=>compare(false));ab.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();compare(true);}};ab.onkeyup=()=>compare(false);const blur=()=>compare(false);window.addEventListener('blur',blur);
 function save(value,name){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 panel.querySelector('#et15Save').onclick=()=>save(controller.archive(),'native-human-et15.json');panel.querySelector('#et15SaveAll').onclick=()=>save({schema:'kaopu/cast-library@1',version:VERSION,items:library.map(p=>({id:p.id,label:p.label,archive:archiveFor(p.id)}))},'native-cast-36-et15.json');
 const input=panel.querySelector('#et15File');panel.querySelector('#et15Import').onclick=()=>input.click();input.onchange=()=>safe(async()=>{const file=input.files[0];if(!file)return;if(file.size>8*1024*1024)throw Error('人物档案超过 8 MiB');controller.restore(JSON.parse(await file.text()));input.value='';view('face');});
 api.listeners.add(sync);controller.addEventListener('change',sync);
 api.disposeUI=()=>{disposed=true;window.removeEventListener('blur',blur);api.listeners.delete(sync);controller.removeEventListener('change',sync);controller.applyPreset=nativePreset;for(const child of [...original.children].slice(1))shell.append(child);original.remove();panel.remove();};
 window.identityET15={version:VERSION,ready:()=>viewer.skin.et15Ready,settled,report:api.report,profiles:()=>library,apply,archiveFor,set:api.set,treatment,view,blink,restoreExpression,compare,fields:OPTIC_FIELDS};
 viewer.skin.et15Ready.then(()=>{sync();viewer.view('face');window.dispatchEvent(new Event('resize'));}).catch(e=>panel.querySelector('#et15Status').textContent=e.message);sync();
}
