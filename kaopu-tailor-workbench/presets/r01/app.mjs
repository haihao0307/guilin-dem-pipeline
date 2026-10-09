import {paperSVG} from './vendor/paper-preview.mjs';
import {parameterLabel,parameterState,valueAt} from './vendor/catalogue-controls.mjs';
import {makeRequest,validateBodyProfile,packetMatchesBody} from './bridge.mjs';
const $=id=>document.getElementById(id),root=new URL('../../',import.meta.url);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=v=>v===null?'无':typeof v==='boolean'?(v?'是':'否'):typeof v==='number'?Number(v.toFixed(4)):v;
let library,schema,atlas,selected,pattern,currentBody,paperBody,category='全部',query='',epoch=0,zoom=1,worker=null,timer=null,workerStarts=0,running=false,dirty=false,cachedPaper=true,ready=false,started=0;
const cache=new Map();
async function json(url){const r=await fetch(url);if(!r.ok)throw Error('资源读取失败：'+r.status+' '+url);return r.json();}
async function readPaper(row){
 if(cache.has(row.id))return cache.get(row.id);
 const r=await fetch(new URL(row.paperAsset,import.meta.url));if(!r.ok)throw Error('纸样读取失败：'+row.id);
 let bytes=await r.arrayBuffer();if(new Uint8Array(bytes)[0]===31&&new Uint8Array(bytes)[1]===139)bytes=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 const value=JSON.parse(new TextDecoder().decode(bytes));if(value.recipeHash!==row.recipeHash||value.validation?.analytic2DPass!==true)throw Error('纸样配方或验证记录不匹配');
 cache.set(row.id,value);while(cache.size>4)cache.delete(cache.keys().next().value);return value;
}
function status(text,error=false){$('runtime-status').textContent=text;$('runtime-status').classList.toggle('error',error);}
function stop(show=true){if(worker){worker.terminate();worker=null;}if(timer){clearTimeout(timer);timer=null;}running=false;buttons();if(show)status('本轮制版已取消；旧纸样保留，不冒充新结果。');}
function buttons(){for(const id of ['regenerate','export-preset','export-paper'])$(id).disabled=!pattern||running;$('cancel').hidden=!running;}
function renderCards(){
 const rows=library.presets.filter(r=>(category==='全部'||r.category===category)&&(!query||[r.name,r.id,r.intent,r.style].join(' ').toLowerCase().includes(query)));
 $('cards').innerHTML=rows.map(r=>`<button class="card" data-preset="${esc(r.id)}" aria-pressed="${r.id===selected?.id}" aria-label="选择 ${esc(r.name)}"><span class="card-image"><img src="${esc(r.thumbnail)}" alt="${esc(r.name)}的真实裁片布局" loading="lazy"><span class="card-code">${esc(r.id)}</span></span><span class="card-text"><strong>${esc(r.name)}</strong><small>${esc(r.category)} · ${r.panelCount} 片 · ${r.seamCount} 组缝边</small></span></button>`).join('');
 $('visible-count').textContent=`${rows.length} / ${library.presets.length} 个预设`;$('empty').hidden=rows.length!==0;
 for(const b of $('cards').querySelectorAll('button'))b.onclick=()=>select(b.dataset.preset,true);
}
function renderCategories(){const cats=['全部',...new Set(library.presets.map(r=>r.category))];$('categories').innerHTML=cats.map(c=>`<button aria-pressed="${c===category}" data-category="${c}">${c}</button>`).join('');for(const b of $('categories').querySelectorAll('button'))b.onclick=()=>{category=b.dataset.category;renderCategories();renderCards();};}
function paper(){if(!pattern)return;$('paper-host').innerHTML=paperSVG(pattern,{selectedSeamId:$('seam-select').value||null});$('paper-host').style.width=zoom*100+'%';}
function parameterRows(){
 if(!pattern)return;const filter=$('parameter-filter').value;
 $('parameter-list').innerHTML=schema.parameters.map(p=>{const s=parameterState(p.path,pattern.design);return{...p,...s};}).filter(p=>filter==='all'||(filter==='active')===p.enabled).map(p=>{
  const e=atlas.parameters.find(a=>a.path===p.path),proof=e?.evidence;
  const detail=proof?`单字段实测：${esc(proof.context)}，${esc(val(proof.from))} → ${esc(val(proof.to))}；${proof.changedPanels.length} 片发生几何或摆位变化。`:'本轮没有有效几何效应证据，不能说已经精准掌握。';
  return `<div class="parameter-row"><strong>${esc(parameterLabel(p.path))}：${esc(val(valueAt(pattern.design,p.path)))}</strong><br><code>${esc(p.path)}</code><p>${p.enabled?'本款启用':'本款休眠'} · ${esc(p.reason)}</p><p class="${proof?'observed':''}">${detail}</p></div>`;
 }).join('');
}
function renderDetails(){
 $('selected-category').textContent=selected.category+' / '+selected.id;$('selected-title').textContent=selected.name;$('intent').textContent=selected.intent;
 $('facts').innerHTML=[`${pattern.panels.length} 个裁片`,`${pattern.seams.length} 组缝边`,`${pattern.darts.length} 个省道`,'原材料坐标保留'].map(x=>`<span>${x}</span>`).join('');
 $('seam-select').innerHTML='<option value="">查看全部裁片</option>'+pattern.seams.map(s=>`<option value="${esc(s.id)}">${esc(s.id)} · ${esc(s.a.panelId)} ↔ ${esc(s.b.panelId)}</option>`).join('');
 $('seam-detail').textContent='高亮显示源配方中明确相接的两条边。领口、裤脚和开衩等自由边不是自动漏缝。';
 $('authored-controls').innerHTML=selected.authoredControls.length?selected.authoredControls.map(p=>`<span>${esc(p.label)}：${esc(val(p.value))}${p.enabled?'':'（本款休眠）'}</span>`).join(''):'<span>完整保留该原制版入口的基准配方</span>';
 const active=schema.parameters.filter(p=>parameterState(p.path,pattern.design).enabled).length;
 $('control-summary').textContent=`完整保存 ${schema.parameters.length} 项；本款按源依赖规则启用 ${active} 项，其余为休眠参数。不同款式不能把每项滑块都当作有效控制。`;
 const ref=paperBody.kind==='reference-body';$('paper-status').textContent=(ref?'基准人台参考纸样':'所选人物新纸样')+' · 未缝合 · 无现实缝份'+(dirty?' · 当前人体已变化，需重新制版':'');
 $('body-title').textContent='当前尺寸来源：'+(currentBody.kind==='reference-body'?'基准 Anny 人台':currentBody.id);
 $('body-note').textContent=currentBody.kind==='reference-body'?'人物台实时接入尚未启用。下方操作重新运行原制版程序；首次需要加载计算环境，不调用缝制求解。':`人物版本 ${currentBody.revision}。已接收完整量体；${dirty?'当前显示仍是旧尺寸，点击重新制版。':'新纸样对应此版本；尚未进行穿体检验。'}`;
 parameterRows();paper();buttons();
}
async function select(id,scroll=false){
 const row=library.presets.find(r=>r.id===id);if(!row)throw Error('未知预设：'+id);
 stop(false);const token=++epoch;selected=row;pattern=null;buttons();renderCards();$('selected-title').textContent=row.name;$('paper-status').textContent='读取已有纸样；不启动缝制求解…';
 try{
  const p=await readPaper(row);if(token!==epoch)return;pattern=structuredClone(p);paperBody=structuredClone(library.referenceBody);dirty=currentBody.id!==paperBody.id||currentBody.revision!==paperBody.revision||currentBody.sourceSHA256!==paperBody.sourceSHA256;cachedPaper=true;zoom=1;renderDetails();
  status('已载入该预设的参考纸样；没有重新缝制服装。');const u=new URL(location.href);u.searchParams.set('preset',id);history.replaceState(null,'',u);
  try{localStorage.setItem('kaopu.tailor.presets.P01.selected',id);}catch{}
  if(scroll&&innerWidth<761)document.querySelector('.inspector').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 }catch(e){if(token===epoch){$('paper-status').textContent='纸样载入失败';status(e.message,true);}}
}
function regenerate(){
 if(!pattern||running)return;stop(false);const token=++epoch,packet=makeRequest(selected,pattern.design,currentBody,schema);started=performance.now();running=true;workerStarts++;worker=new Worker(new URL('worker.mjs',import.meta.url),{type:'module'});buttons();status('正在加载并校验原制版环境；不运行缝合。');
 const finishError=message=>{if(token!==epoch)return;stop(false);status(message,true);};
 timer=setTimeout(()=>finishError('制版等待超过5分钟，已停止计算；当前纸样未替换，可重试。'),300000);
 worker.onerror=e=>finishError('制版线程出错：'+e.message);
 worker.onmessage=({data})=>{
  if(data.id!==token||token!==epoch)return;
  if(data.type==='progress'){const p=data.progress;status(p.type==='ready'?'原制版环境已就绪，正在按当前人台生成裁片…':p.message||'正在校验并加载制版依赖…');}
  if(data.type==='error')finishError(data.message);
  if(data.type==='result'){
   if(!packetMatchesBody(packet,currentBody)){finishError('人物版本已变化，本轮结果没有覆盖当前纸样。');return;}
   pattern=data.pattern;paperBody=structuredClone(currentBody);dirty=false;cachedPaper=false;stop(false);renderDetails();status(`已按当前量体重新生成纸样，用时 ${((performance.now()-started)/1000).toFixed(2)} 秒；未缝合、未做动态穿模验收。`);
  }
 };
 worker.postMessage({type:'generate',id:token,request:packet.generatorRequest});
}
function download(name,bytes,mime){const blob=new Blob([bytes],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function applyBodyProfile(profile){const body=validateBodyProfile(profile,schema);stop(false);epoch++;currentBody=body;dirty=true;if(pattern)renderDetails();status('新人物量体已接收。预设设计保持不变；须重新制版，不能沿用旧尺寸纸样。');return{accepted:true,bodyId:body.id,bodyRevision:body.revision,paperMustRegenerate:true};}
function state(){return{version:'P01',ready,presetCount:library?.presets.length||0,parameterCount:schema?.parameters.length||0,selectedId:selected?.id||null,visibleCards:$('cards').querySelectorAll('.card').length,paperReady:!!pattern,running,workerStarts,activeWorkers:worker?1:0,cachedPaper,dirty,selectedBodyId:currentBody?.id,patternBodyId:paperBody?.id,patternRecipeHash:pattern?.recipeHash||null,clothSolverStarted:false,physicalFitAccepted:false,dynamicWearCertified:false};}
async function boot(){
 try{
  [library,schema,atlas]=await Promise.all([json('./library.json'),json('./parameter-schema.json'),json('./parameter-atlas.json')]);currentBody=validateBodyProfile(library.referenceBody,schema);
  $('count').textContent=library.presets.length;$('version').textContent=`P01 · 设计来源 ${library.sourceCommit.slice(0,12)} · 纸样库 / 非成衣验收`;
  $('sewing-link').href=new URL('r07/stability/r072.html?case=MetaGarmentDress',root).href;$('overview-link').href=new URL('../kaopu-human-overview/#clothing',root).href;
  $('atlas-summary').textContent=`本轮 ${atlas.observedParameterEffects??0} / ${schema.parameters.length} 个字段取得单字段修改后的有效纸样变化证据。其余逐项保留未验证或无效结果，没有声称全参数域已掌握。`;
  $('search').oninput=()=>{query=$('search').value.trim().toLowerCase();renderCards();};$('parameter-filter').onchange=parameterRows;
  $('seam-select').onchange=()=>{const s=pattern?.seams.find(s=>s.id===$('seam-select').value);paper();$('seam-detail').textContent=s?`${s.id}：${s.a.panelId}/e${s.a.edge} ↔ ${s.b.panelId}/e${s.b.edge}；方向 ${s.direction}；材料边长 ${s.lengthAMm.toFixed(2)} / ${s.lengthBMm.toFixed(2)} mm。${s.gathering?'抽褶系数 '+s.gathering.ruffleCoefficientA.toFixed(3)+' / '+s.gathering.ruffleCoefficientB.toFixed(3)+'；不等长不自动判为漏缝。':''}`:'查看全部裁片；自由边未自动封闭。';};
  $('zoom-in').onclick=()=>{zoom=Math.min(4,zoom+.5);paper();};$('zoom-out').onclick=()=>{zoom=Math.max(1,zoom-.5);paper();};$('zoom-fit').onclick=()=>{zoom=1;paper();};
  $('regenerate').onclick=regenerate;$('cancel').onclick=()=>{epoch++;stop(true);};
  $('export-preset').onclick=()=>download(selected.id+'-design-preset.json',JSON.stringify({schema:'kaopu-tailor-design-preset@1',id:selected.id,revision:'P01',name:selected.name,category:selected.category,generatorCommit:library.generatorCommit,design:pattern.design,bodyBinding:null,includesSolvedClothes:false},null,2),'application/json');
  $('export-paper').onclick=()=>download(selected.id+'-paper-mm.svg',paperSVG(pattern),'image/svg+xml');
  renderCategories();let remembered;try{remembered=localStorage.getItem('kaopu.tailor.presets.P01.selected');}catch{}
  const requested=new URL(location.href).searchParams.get('preset')||remembered||'T05';await select(library.presets.some(r=>r.id===requested)?requested:'T05');ready=true;
  window.KAOPUTailorPresets={applyBodyProfile,select,createRequest:()=>makeRequest(selected,pattern.design,currentBody,schema)};
  window.__TAILOR_PRESETS_QA__={getState:state,select,getPattern:()=>structuredClone(pattern),getReferenceBody:()=>structuredClone(library.referenceBody),getRows:()=>structuredClone(library.presets),applyBodyProfile,regenerate,cancel:()=>{epoch++;stop(true);}};
 }catch(e){status('预设库启动失败：'+e.message,true);$('visible-count').textContent='载入失败，请检查网络后刷新。';}
}
addEventListener('pagehide',()=>{epoch++;stop(false);cache.clear();});
boot();
