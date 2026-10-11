import {EYE_RANGES} from './NaturalEyeState.mjs';
const extra=[['limbusWidth','虹膜外缘宽度'],['limbusSoftness','虹膜—眼白过渡柔和度'],['pupilFeather','瞳孔边缘柔和度'],['vesselSoftness','血丝皮下柔化'],['contactShadow','眼睑接触阴影'],['tearWetness','睑缘湿润过渡']];
export function mountIterationUI({model,viewer,controller}){
 const panel=document.getElementById('identityPanel'),api=window.naturalEyeWorkbench;
 if(!panel||!api)throw Error('ET16 requires the existing natural-eye controls');
 const lamps=viewer.scene.children.filter(o=>o.isDirectionalLight),lampBase=lamps.map(o=>({position:o.position.clone(),intensity:o.intensity,color:o.color.clone()}));let expressionBase=null,disposed=false;
 function light(mode='original'){
  if(!['original','left','right','off'].includes(mode))throw Error('Unknown lighting inspection mode');
  lamps.forEach((o,i)=>{o.position.copy(lampBase[i].position);o.intensity=mode==='off'?0:lampBase[i].intensity;o.color.copy(lampBase[i].color);});
  if(mode==='left'||mode==='right')lamps[0]?.position.set(mode==='left'?-2:2,2.2,4);
  viewer.render();return lamps.map(o=>({position:o.position.toArray(),intensity:o.intensity}));
 }
 function blink(value){
  if(![0,.5,1].includes(value))throw Error('Blink inspection accepts 0, 0.5 or 1');
  const s=controller.state();if(!expressionBase)expressionBase={owner:s.owners.expression,actions:structuredClone(s.anny.facialActions)};
  if(value===0){s.owners.expression=expressionBase.owner;s.anny.facialActions=structuredClone(expressionBase.actions);}
  else{s.owners.expression='anny';s.anny.facialActions.eyeBlinkLeft=value;s.anny.facialActions.eyeBlinkRight=value;}
  controller.commit(s);return viewer.eyeContact?.report;
 }
 function mount(){
  if(disposed)return;const fields=panel.querySelector('#naturalEyeControls');if(!fields||fields.querySelector('#et16ContactControls'))return;
  const section=document.createElement('details');section.id='et16ContactControls';section.open=true;
  const side=panel.querySelector('#naturalEyeSide')?.value||'both',e=api.settings()[side==='both'?'right':side];
  section.innerHTML='<summary>ET16 · 自然过渡与接触</summary><small>左右以人物自身为准。接触依据当前三维眼睑与眼球计算，不是额外叠一圈白线。</small>'+extra.map(([k,label])=>{const[a,b]=EYE_RANGES[k];return `<label><span>${label}</span><input type="range" data-et16-key="${k}" min="${a}" max="${b}" step=".001" value="${e[k]}"><output>${e[k].toFixed(3)}</output></label>`;}).join('')+'<div class="identity-tools"><button data-et16-light="left">左侧光</button><button data-et16-light="right">右侧光</button><button data-et16-light="original">恢复灯光</button></div><div class="identity-tools" style="margin-top:6px"><button data-et16-blink="0">原表情</button><button data-et16-blink="0.5">半闭检查</button><button data-et16-blink="1">闭眼检查</button></div><small>眨眼仍使用原有表情通路；接触着色不是眼睑解剖重建或完整泪液物理。</small>';
  const insert=fields.querySelector('details');if(insert)insert.before(section);else fields.append(section);
 }
 const input=event=>{const e=event.target,k=e.dataset.et16Key;if(!k)return;try{const side=panel.querySelector('#naturalEyeSide')?.value||'both';api.set({[k]:Number(e.value)},side);const out=e.parentElement.querySelector('output');if(out)out.textContent=Number(e.value).toFixed(3);}catch(error){document.getElementById('identityStatus').textContent=error.message;}};
 const click=event=>{const e=event.target.closest('button');if(!e)return;if(e.dataset.et16Light)light(e.dataset.et16Light);else if(e.dataset.et16Blink!==undefined)blink(Number(e.dataset.et16Blink));};
 const observer=new MutationObserver(mount);observer.observe(panel.querySelector('#identityFields'),{childList:true});panel.addEventListener('input',input);panel.addEventListener('click',click);
 const oldDispose=model.naturalEyes.disposeUI;model.naturalEyes.disposeUI=()=>{disposed=true;observer.disconnect();panel.removeEventListener('input',input);panel.removeEventListener('click',click);oldDispose?.();};
 api.version='ET16-E1';api.light=light;api.blink=blink;api.contactReport=()=>viewer.eyeContact?.report;
 panel.querySelector('.identity-count').textContent='ET16 / NATURAL EYES · CONTACT & LIGHT';document.title='共同人物 · ET16 自然眼球';mount();
}
