import {buildEarDomain} from './EarDomain.mjs';
import {attachEarMaterial} from './EarMaterial.mjs';
import {EAR_SCHEMA,EAR_RANGES,EAR_DEFAULT,EAR_VERSION,generatedPair,presetEar} from './EarParameters.mjs';
export {EAR_SCHEMA,EAR_RANGES,EAR_DEFAULT} from './EarParameters.mjs';
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
export function validateEar(input={}){
 if(!object(input))throw Error('耳部档案必须是对象');
 for(const k of Object.keys(input))if(!['schema','enabled','left','right','generation'].includes(k))throw Error('未知耳部字段 '+k);
 if(input.schema&&!['kaopu/ear-structure@1','kaopu/ear-structure@2',EAR_SCHEMA].includes(input.schema))throw Error('不支持的耳部档案版本');
 const s={schema:EAR_SCHEMA,enabled:input.enabled??true,left:{},right:{}};
 if(typeof s.enabled!=='boolean')throw Error('耳部开关必须为布尔值');
 for(const side of ['left','right']){
  if(input[side]!==undefined&&!object(input[side]))throw Error('单侧耳部档案无效');
  const fields=input[side]||{};
  for(const [k,v]of Object.entries(fields)){const r=EAR_RANGES[k];if(!Object.hasOwn(EAR_RANGES,k)||!r||!Number.isFinite(v)||v<r[0]||v>r[1])throw Error('耳部参数越界 '+side+'.'+k);}
  s[side]={...EAR_DEFAULT,...fields};
 }
 if(input.generation!==undefined){const g=input.generation;
  if(!object(g)||!Number.isInteger(g.seed)||g.seed<0||g.seed>0xffffffff||g.basis!=='authored-correlated-regional-growth-v1'||!Array.isArray(g.parents)||g.parents.length!==2||g.parents.some(x=>typeof x!=='string'||x.length>32)||Object.keys(g).some(k=>!['seed','basis','parents'].includes(k)))throw Error('生长种子记录无效');
  s.generation=structuredClone(g);
 }
 return s;
}
export function installEarStructure(model){
 if(model.earStructure)return model.earStructure;
 const archive=model.archive.bind(model),restore=model.restore.bind(model),attach=model.faceSurface.attachSkin;
 const api={version:EAR_VERSION,settings:validateEar(),skins:new Set(),revision:0,domain:buildEarDomain(model)};
 api.update=()=>{api.revision++;for(const skin of api.skins)skin.updateEars?.();};
 api.replace=next=>{api.settings=validateEar(next);api.update();return structuredClone(api.settings);};
 api.set=(patch={},side='both')=>{
  if(!object(patch)||!['both','left','right'].includes(side))throw Error('无效耳部修改');
  const next=structuredClone(api.settings);delete next.generation;
  for(const[k,v]of Object.entries(patch)){if(k==='enabled')next.enabled=v;else {if(!Object.hasOwn(EAR_RANGES,k))throw Error('未知耳部参数 '+k);for(const which of(side==='both'?['left','right']:[side]))next[which][k]=v;}}
  return api.replace(next);
 };
 api.preset=(id,side='both')=>api.set(presetEar(id),side);
 api.generate=seed=>api.replace({schema:EAR_SCHEMA,enabled:true,...generatedPair(seed)});
 model.archive=()=>({...archive(),earStructure:structuredClone(api.settings)});
 model.restore=o=>{const next=validateEar(o?.earStructure||{}),old=api.settings;try{api.settings=next;const result=restore(o);api.update();return result;}catch(e){api.settings=old;api.update();throw e;}};
 model.faceSurface.attachSkin=skin=>{attach(skin);attachEarMaterial(skin,api);};model.earStructure=api;return api;
}
