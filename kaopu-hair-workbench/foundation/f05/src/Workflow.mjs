import {createDesign,validateDesign,revise,usePreset,importDesign,DesignHistory} from './Design.mjs';
import {referenceStore,inspectReference} from './ReferenceStore.mjs';
export function installWorkflow(api){
 const $=id=>document.getElementById(id),history=new DesignHistory(createDesign('medium',crypto.randomUUID())),assets=referenceStore(),storageKey='kaopu.hair.F05.design';
 let pending=null,applying=false,refSignature='',refEpoch=0,refJob=0,urls=[];
 const current=()=>structuredClone(pending?.doc||history.present),status=t=>$('status').textContent=t;
 function commit(){if(!pending)return;const{doc,mode}=pending;if(mode==='undo')history.undo();else if(mode==='redo')history.redo();else history.commit(doc);pending=null;sync();}
 function activate(doc,mode='edit'){
  const good=validateDesign(doc);pending={doc:good,mode};refJob++;
  if(api.diagnostics().ready&&!api.diagnostics().busy&&JSON.stringify(api.snapshot())===JSON.stringify(good.recipe)){commit();return;}
  applying=true;try{api.restore(good.recipe);}catch(e){pending=null;throw e;}finally{applying=false;}sync();
 }
 function stageRecipe(r){if(applying)return;pending={doc:revise(current(),{recipe:r,preset:'custom'}),mode:'edit'};}
 function built(r){if(pending&&JSON.stringify(pending.doc.recipe)===JSON.stringify(r))commit();else sync();}
 async function showReferences(doc){
  const fingerprint=JSON.stringify(doc.references);if(fingerprint===refSignature)return;refSignature=fingerprint;const epoch=++refEpoch;for(const u of urls)URL.revokeObjectURL(u);urls=[];$('references').replaceChildren();
  if(!doc.references.length){const p=document.createElement('p');p.className='sub';p.textContent='还没有参考图。基础方案可以直接使用。';$('references').append(p);return;}
  for(const ref of doc.references){
   const row=document.createElement('div');row.className='reference';const thumb=document.createElement('img');thumb.alt=ref.fileName;const detail=document.createElement('div'),name=document.createElement('div');name.className='ref-name';name.textContent=ref.fileName;detail.append(name);const view=document.createElement('select');view.className='ref-view';view.setAttribute('aria-label','参考图视角');for(const [v,label]of[['unknown','未指定视角'],['front','正面'],['left','左侧'],['right','右侧'],['back','背面'],['top','顶部']])view.add(new Option(label,v));view.value=ref.view;view.disabled=api.diagnostics().busy;view.onchange=()=>safe(()=>activate(revise(current(),{references:current().references.map(r=>r.id===ref.id?{...r,view:view.value}:r)})));detail.append(view);const state=document.createElement('small');state.textContent='原图仅在本机 · 尚未分析';detail.append(state);const remove=document.createElement('button');remove.textContent='移除';remove.className='remove-ref';remove.setAttribute('aria-label','移除 '+ref.fileName);remove.onclick=()=>safe(()=>activate(revise(current(),{references:current().references.filter(r=>r.id!==ref.id)})));row.append(thumb,detail,remove);$('references').append(row);
   const blob=await assets.get(ref.id);if(epoch!==refEpoch)return;if(blob){const u=URL.createObjectURL(blob);urls.push(u);thumb.src=u;}else{thumb.hidden=true;state.textContent='未找到本机原图，请重新关联同一文件';}
  }
 }
 function sync(){
  const doc=current(),busy=api.diagnostics().busy,ready=api.diagnostics().ready;if(document.activeElement!==$('designTitle'))$('designTitle').value=doc.title;$('designName').textContent=doc.title;$('workflowState').textContent=busy?'正在更新基础导向…':`方案版本 ${doc.revision} · 参考图未拟合`;
  document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.toggle('on',b.dataset.preset===doc.preset);b.disabled=!ready;});
  for(const id of['save','load','export','import','groomExport','refAdd','designTitle'])$(id).disabled=!ready||busy;
  $('undo').disabled=busy||!history.past.length;$('redo').disabled=busy||!history.future.length;
  document.querySelectorAll('.ref-view,.remove-ref').forEach(el=>el.disabled=busy);showReferences(doc).catch(e=>status('本机图片读取失败：'+e.message));
 }
 function safe(fn){try{const result=fn();if(result?.catch)result.catch(e=>{status(e.message);sync();});}catch(e){status(e.message);sync();}}
 function download(value,name){const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 function save(){if(api.diagnostics().busy)throw Error('等待导向更新完成');localStorage.setItem(storageKey,JSON.stringify(history.snapshot()));status('基础方案已保存在本机；参考原图不上传。');}
 function load(){const raw=localStorage.getItem(storageKey);if(!raw)throw Error('本机还没有保存的 F05 方案');activate(importDesign(JSON.parse(raw)));}
 function undo(){if(!history.past.length||api.diagnostics().busy)return;activate(history.past.at(-1),'undo');}
 function redo(){if(!history.future.length||api.diagnostics().busy)return;activate(history.future.at(-1),'redo');}
 document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>safe(()=>activate(usePreset(current(),b.dataset.preset))));
 $('undo').onclick=()=>safe(undo);$('redo').onclick=()=>safe(redo);$('designTitle').onchange=()=>safe(()=>activate(revise(current(),{title:$('designTitle').value})));
 $('save').onclick=()=>safe(save);$('load').onclick=()=>safe(load);$('export').onclick=()=>safe(()=>download(history.snapshot(),'KAOPU_HairDesign_F05.json'));
 $('import').onclick=()=>$('file').click();$('file').onchange=e=>safe(async()=>{try{const f=e.target.files[0];if(!f)return;if(f.size>200000)throw Error('方案文件超过200KB；请使用方案JSON，而非绑定包');const doc=importDesign(JSON.parse(await f.text()),crypto.randomUUID());activate(doc);}finally{e.target.value='';}});
 $('reset').onclick=()=>safe(()=>activate(usePreset(current(),'medium')));
 $('refAdd').onclick=()=>$('refFiles').click();$('refFiles').onchange=e=>safe(async()=>{const files=[...e.target.files],token=++refJob;try{for(const file of files){if(current().references.length>=12)throw Error('最多关联12张参考图');const{blob,evidence}=await inspectReference(file);if(token!==refJob)throw Error('方案已切换，请重新关联参考图');const stored=await assets.put(evidence.id,blob);if(current().references.some(r=>r.id===evidence.id)){refSignature='';sync();status('已重新关联本机原图。');continue;}activate(revise(current(),{references:[...current().references,evidence]}));refJob=token;status(stored?'参考图已关联，仅保存在本机；还未进行造型拟合。':'参考图可用于本次会话，关闭后需要重新关联。');}}finally{e.target.value='';}});
 $('groomExport').onclick=()=>safe(async()=>{if(api.diagnostics().busy)throw Error('等待当前导向完成');$('groomExport').disabled=true;status('正在整理原生绑定与导向覆盖…');try{const requested=history.snapshot(),pack=await api.exportGroom(requested);if(api.diagnostics().busy||JSON.stringify(history.snapshot())!==JSON.stringify(requested))throw Error('方案已变化，请重新导出绑定包');download(pack,'KAOPU_GuideGroom_F05.json');$('coverageText').textContent=`${pack.coverage.rootCount} 个激活根点已覆盖 · ${pack.guides.length} 条导向 · 可交给表现工作台接入`;status('绑定包已导出，静态造型与物理状态分别保存。');}finally{sync();}});
 const shortcut=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();safe(e.shiftKey?redo:undo);}};document.addEventListener('keydown',shortcut);
 sync();return{sync,stageRecipe,built,failed(){pending=null;sync();},document:()=>history.snapshot(),preset:id=>activate(usePreset(current(),id)),undo,redo,save,load,importDocument:raw=>activate(importDesign(raw)),history:()=>({past:history.past.length,future:history.future.length}),dispose(){urls.forEach(URL.revokeObjectURL);document.removeEventListener('keydown',shortcut);}};
}
