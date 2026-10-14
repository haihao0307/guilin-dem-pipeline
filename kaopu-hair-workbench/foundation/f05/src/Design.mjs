import {DEFAULT,validate as recipe,SCALP_LOCK} from './GuideKernel.mjs';
export const TARGET=Object.freeze({topology:DEFAULT.topology,scalpLock:SCALP_LOCK,rootBank:DEFAULT.rootBank,headSHA256:'e42e9b74765fd1aad2a640760554bd388778db656ef667affc52e55202f9110a',indexSHA256:'57180eb82732096039c76b16a5c3d60c2f5c1e454e8cf10c1ca90ac8cf3cc334'});
export const PRESETS=Object.freeze([
 {id:'short',title:'短发基础',note:'短长度分区，先检查完整范围',patch:{lengths:[45,35,35,65,50,25],family:'natural'}},
 {id:'medium',title:'中长基础',note:'保留 F04 默认，检查耳后与后颈',patch:{}},
 {id:'long',title:'长发基础',note:'延长到肩部附近，检查数据接续',patch:{lengths:[190,170,170,240,220,140]}}
]);
const clone=x=>structuredClone(x),plain=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=(x,max,name)=>{if(typeof x!=='string'||x.length>max||x.includes('\u0000'))throw Error(name+'无效');return x;};
const keys=(x,allowed)=>{if(!plain(x)||Object.keys(x).some(k=>!allowed.includes(k)))throw Error('方案含不支持的字段');};
export function createDesign(preset='medium',id='design-default'){
 const p=PRESETS.find(p=>p.id===preset);if(!p)throw Error('未知基础方案');
 return {schema:'kaopu/hair-design@1',id,title:p.title,revision:0,preset:p.id,target:clone(TARGET),recipe:recipe({...DEFAULT,...p.patch}),references:[],fitStatus:'not-fitted',notes:''};
}
export function validateDesign(raw){
 keys(raw,['schema','id','title','revision','preset','target','recipe','references','fitStatus','notes']);
 if(raw.schema!=='kaopu/hair-design@1'||!Number.isSafeInteger(raw.revision)||raw.revision<0||raw.revision>1e9)throw Error('方案版本无效');
 keys(raw.target,Object.keys(TARGET));if(Object.entries(TARGET).some(([k,v])=>raw.target[k]!==v))throw Error('方案目标必须是当前原生头部与已通过根域');
 if(!['short','medium','long','custom'].includes(raw.preset)||raw.fitStatus!=='not-fitted')throw Error('尚不支持自动参考图拟合结果');
 if(!Array.isArray(raw.references)||raw.references.length>12)throw Error('最多关联12张参考图');
 const refs=raw.references.map(r=>{
  keys(r,['id','sha256','fileName','mime','width','height','view','source','observation','hiddenAreas']);
  if(!/^[a-f0-9]{64}$/.test(r.sha256)||r.id!==r.sha256||!['image/png','image/jpeg','image/webp'].includes(r.mime))throw Error('参考图哈希或类型无效');
  if(!Number.isSafeInteger(r.width)||!Number.isSafeInteger(r.height)||r.width<1||r.height<1||r.width>20000||r.height>20000||r.width*r.height>80000000)throw Error('参考图尺寸无效');
  if(!['unknown','front','left','right','back','top'].includes(r.view)||r.source!=='user-local'||r.observation!=='unanalysed'||r.hiddenAreas!=='unobserved')throw Error('参考图证据状态无效');
  return {...r,fileName:text(r.fileName,200,'图片名')};
 });
 if(new Set(refs.map(r=>r.id)).size!==refs.length)throw Error('参考图重复');
 const id=text(raw.id,100,'方案编号');if(!/^[a-zA-Z0-9_.-]+$/.test(id))throw Error('方案编号无效');
 const title=text(raw.title,80,'方案名称').trim();if(!title)throw Error('方案名称不能为空');
 return {...clone(raw),id,title,recipe:recipe(raw.recipe),references:refs,notes:text(raw.notes,2000,'说明')};
}
export function revise(doc,patch){return validateDesign({...doc,...patch,revision:doc.revision+1});}
export function usePreset(doc,id){const next=createDesign(id,doc.id);return revise(doc,{title:next.title,preset:id,recipe:next.recipe,fitStatus:'not-fitted'});}
export function importDesign(raw,id='imported-design'){
 if(raw?.schema==='kaopu/hair-design@1')return validateDesign(raw);
 const r=recipe(raw);return revise(createDesign('medium',id),{title:'导入的基础方案',preset:'custom',recipe:r});
}
export class DesignHistory{
 constructor(doc){this.present=validateDesign(doc);this.past=[];this.future=[];}
 commit(doc){const next=validateDesign(doc);if(JSON.stringify(next)===JSON.stringify(this.present))return false;this.past.push(clone(this.present));if(this.past.length>40)this.past.shift();this.present=next;this.future=[];return true;}
 undo(){if(!this.past.length)return null;this.future.push(clone(this.present));this.present=this.past.pop();return clone(this.present);}
 redo(){if(!this.future.length)return null;this.past.push(clone(this.present));this.present=this.future.pop();return clone(this.present);}
 snapshot(){return clone(this.present);}
}
