/* Shared controls for the bounded R13 warm/cool rig; original references stay isolated. */
(function(){'use strict';
const S=StudioLighting,$=id=>document.getElementById(id);
const names=['warmPower','coolPower'];
function state(object){return object==='rabbit'?S.validateState(candidate.lighting||S.DEFAULTS):anemone.lighting;}
function set(object,patch){const next=S.validatePatch(patch,state(object));if(object==='rabbit'){candidate.lighting=next;post('candidate','apply',{values:{lighting:next}});updateUI();}else anemone.setLighting(next);sync();return next;}
function panel(object,parent){const box=document.createElement('section');box.className='section studio-lighting-controls';box.innerHTML='<div class="section-title">冷暖双侧光 <span>R13 灯架</span></div><div class="control"><label>灯光模式 <select id="'+object+'LightingMode" aria-label="'+(object==='rabbit'?'兔子':'海葵')+'灯光模式"><option value="side">冷暖双侧光</option><option value="legacy">原始单灯参考</option></select></label></div>'+names.map((key,i)=>'<div class="control"><label for="'+object+'-'+key+'">'+(i?'冷侧光':'暖侧光')+'<output id="'+object+'-'+key+'Value"></output></label><input id="'+object+'-'+key+'" type="range" min="0" max="2" step=".05" aria-label="'+(object==='rabbit'?'兔子':'海葵')+(i?'冷侧光强度':'暖侧光强度')+'"></div>').join('')+'<p class="control-note">源自材质工作台岩石 01 / 02 的同一灯位与冷暖 RGB 比例；针对本对象调节显示增益。灯光固定在场景中。</p>';
parent.append(box);$(object+'LightingMode').onchange=e=>set(object,{mode:e.target.value});for(const key of names)$(object+'-'+key).oninput=e=>set(object,{[key]:Number(e.target.value)});}
panel('rabbit',$('inspector'));panel('anemone',document.querySelector('#controlsDrawer .drawer-content'));
function sync(){for(const object of ['rabbit','anemone']){const s=state(object),reference=object==='anemone'&&anemone.material.mode==='baseline';$(object+'LightingMode').value=s.mode;$(object+'LightingMode').disabled=reference;$(object+'LightingMode').title=reference?'原始材质参考保留原灯光；切回当前材质后可调双灯':'';if(object==='rabbit')for(const key of ['lightX','lightY','lightZ'])for(const prefix of ['range-','number-']){$(prefix+key).disabled=s.mode==='side';$(prefix+key).title=s.mode==='side'?'仅适用于原灯光参考；双侧光使用固定灯架':'';}for(const key of names){$(object+'-'+key).value=s[key];$(object+'-'+key).disabled=reference||s.mode!=='side';$(object+'-'+key+'Value').textContent=s[key].toFixed(2)+'×';}}}
const previousValidate=validateImport;
validateImport=function(data){const copy=structuredClone(data);if(copy?.version===3){const lighting=S.validateState(copy.lighting);if(copy.state&&Object.hasOwn(copy.state,'lighting'))throw Error('灯光必须使用单独的 lighting 字段');copy.version=2;delete copy.lighting;return {...previousValidate(copy),lighting};}if(![1,2].includes(copy?.version))throw Error('不支持的兔子参数版本');return {...previousValidate(copy),lighting:{...S.LEGACY}};};
const previousExport=exportState;exportState=function(){const value=previousExport();value.version=3;value.lighting=state('rabbit');delete value.state.lighting;return value;};workbench.exportState=exportState;
const previousReset=resetAll;resetAll=function(...args){const result=previousReset(...args);set('rabbit',S.DEFAULTS);return result;};workbench.resetAll=resetAll;
const previousMesh=loadMesh;loadMesh=function(...args){const lighting=state('rabbit'),result=previousMesh(...args);candidate.lighting=lighting;post('candidate','apply',{values:{lighting}});sync();return result;};workbench.loadMesh=loadMesh;
const previousUI=updateUI;updateUI=function(...args){const result=previousUI(...args);sync();return result;};
$('sourceReset').addEventListener('click',()=>set('rabbit',S.LEGACY));
window.addEventListener('anemonematerial',sync);window.addEventListener('anemonestate',sync);window.addEventListener('anemonelighting',sync);
window.objectLighting=Object.freeze({get:state,set});candidate.lighting={...S.DEFAULTS};sync();
})();
