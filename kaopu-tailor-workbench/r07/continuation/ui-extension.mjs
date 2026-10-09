// Appended into the inherited UI's module scope. Existing viewer, state and worker are reused.
import {fromNativeAnalytic as editableFromNative} from '../learning/patterngsl-r01/pattern-edit-kernel.mjs';
let continuationUIBase=null,continuationUIInfo=null,continuationUIHash=null;
function mountContinuationUI(){
 const host=document.getElementById('tab-parameters');if(!host||document.getElementById('continuation-editor'))return;
 const section=document.createElement('details');section.id='continuation-editor';section.innerHTML=`<summary>裁片编辑 · 原内核接续</summary><p>先选明确裁片，再修改真实材料。完成后重新剖分网格，旧成衣作废；此区是助理/技术检查工具，不要求你逐项调参。</p><label>裁片身份<select id="continuation-panels" multiple size="5" aria-label="明确选择要编辑的裁片"></select></label><label>曲线边<select id="continuation-edge"></select></label><div class="continuation-actions"><button id="continuation-scale">所选裁片放大2%</button><button id="continuation-curve">第一控制点上移1mm</button><button id="continuation-place">摆片X向平移5mm</button><button id="continuation-remove">移除所选裁片及其接缝</button><button id="continuation-undo">撤销裁片编辑</button><button id="continuation-reset">恢复原制版纸样</button></div><p id="continuation-edit-state" role="status">未编辑。</p><p>移除操作会明确删除关联接缝，不补造袖子或隐藏缺片。放大裁片不是缩放人体；移动摆片不是改变围度。</p>`;
 host.prepend(section);
 const note=document.createElement('p');note.id='continuation-whole-seam';note.setAttribute('role','status');document.getElementById('workflow-controls').append(note);
 const links=document.createElement('p');links.innerHTML='<a href="presets/r01/" target="_blank" rel="noopener">打开60套设计预设库</a> · 本页新增编辑闭环；成衣物理尚未全部验收。';section.append(links);
 $('continuation-panels').onchange=continuationCurveOptions;
 $('continuation-scale').onclick=()=>sendContinuationOperation({type:'scalePanels',panelIds:continuationSelected(),factor:1.02,anchorMm:[0,0]});
 $('continuation-place').onclick=()=>sendContinuationOperation({type:'translatePlacement',panelIds:continuationSelected(),deltaMm:[5,0,0]});
 $('continuation-remove').onclick=()=>{const ids=continuationSelected();if(!ids.length)return status('先明确选择裁片',true);sendContinuationOperation({type:'removePanels',panelIds:ids,removeIncidentStitches:true});};
 $('continuation-curve').onclick=()=>{try{const ids=continuationSelected();if(ids.length!==1)throw Error('曲线修改要求恰好选一块裁片');const identity=continuationUIInfo?.panelIdentities.find(p=>p.id===ids[0]),p=state.analytic.panels.find(p=>p.id===identity?.sourcePanelId),e=p?.edges.find(e=>e.index===Number($('continuation-edge').value));if(!e||!['quadratic','cubic'].includes(e.kind))throw Error('请选择二次或三次贝塞尔边');sendContinuationOperation({type:'curveControl',panelIds:ids,edgeId:e.index,controlIndex:0,positionMm:[e.controlPointsMm[0][0],e.controlPointsMm[0][1]+1]});}catch(e){status(e.message,true);}};
 $('continuation-undo').onclick=()=>sendContinuationOperation(null,'undo-edit');$('continuation-reset').onclick=()=>sendContinuationOperation(null,'reset-edits');
}
function continuationSelected(){return Array.from($('continuation-panels')?.selectedOptions||[],o=>o.value);}
function continuationCurveOptions(){
 const ids=continuationSelected(),p=continuationUIInfo?.panelIdentities?.find(p=>p.id===ids[0]);
 $('continuation-edge').innerHTML=(p?.edges||[]).filter(e=>['quadratic','cubic'].includes(e.kind)).map(e=>`<option value="${e.id}">边 ${e.id} · ${e.kind}</option>`).join('');
}
function continuationPaperArrived(data){
 if(!data.analytic)return;
 if(data.editInfo)continuationUIInfo=data.editInfo;
 else{continuationUIBase=structuredClone(data.analytic);const doc=editableFromNative(data.analytic);continuationUIInfo={revision:0,operationCount:0,operations:[],panelIdentities:doc.panels.map(p=>({id:p.id,sourcePanelId:p.sourcePanelId,edges:p.edges.map(e=>({id:e.id,kind:e.kind,controlPointsMm:e.controlPointsMm||[]}))}))};}
 continuationUIHash=null;
}
function updateContinuationUI(){
 const picker=$('continuation-panels');if(!picker)return;
 const hash=state.analytic?.geometryHash;
 if(hash!==continuationUIHash){
  continuationUIHash=hash;const selected=new Set(continuationSelected());
  picker.innerHTML=(state.analytic?continuationUIInfo?.panelIdentities||[]:[]).map(p=>`<option value="${p.id}" ${selected.has(p.id)?'selected':''}>${p.id} · ${esc(p.sourcePanelId)}</option>`).join('');
  if(!picker.selectedOptions.length&&picker.options.length)picker.options[0].selected=true;
  continuationCurveOptions();
 }
 const busy=state.running||state.generating||state.phase==='paused',available=current?.kind==='analytic'&&state.analytic&&solverMode==='fast';
 for(const id of ['continuation-scale','continuation-curve','continuation-place','continuation-remove'])$(id).disabled=busy||!available;
 $('continuation-undo').disabled=$('continuation-reset').disabled=busy||!available||!continuationUIInfo?.operationCount;
 $('continuation-edit-state').textContent=state.generating?'正在重新计算曲线、长度与网格…':`裁片版本 ${continuationUIInfo?.revision||0}；${continuationUIInfo?.operationCount||0}项编辑。${state.analytic?.source.continuationEdits?'本轮为编辑后材料；点击缝合重新试算。':'当前为原制版纸样。'}`;
 const span=state.staticGate?.wholeSeamAudit;
 $('continuation-whole-seam').textContent=span?.error?'整段接缝检查失败：'+span.error:span?`整段裸边分离：${format(span.maxSpanLowerBoundMm,3)}—${format(span.maxSpanUpperBoundMm,3)} mm；需复核：${span.separatedSeamIds?.join('、')||'无'}。针位重合不再单独作为通过依据。`:'新增整段布边检查；未完成新一轮求解前，不能认定接缝已闭合。';
}
function continuationRestore(){return{base:structuredClone(continuationUIBase||state.analytic),operations:structuredClone(continuationUIInfo?.operations||[]),revision:continuationUIInfo?.revision||0,config:{kind:'analytic',recipe:{bodyCm:structuredClone(bodyCm),design:{style:current.id,...structuredClone(design)}}}};}
function sendContinuationOperation(operation,type='edit'){
 try{
  if(!state.analytic||state.running||state.generating||state.phase==='paused')throw Error('先生成纸样并停止本轮计算');
  if(solverMode!=='fast')throw Error('裁片编辑闭环使用本页接续线程；原参考线程保持不变');
  const restore=continuationRestore();requestId++;state.generating=true;state.phase='editing';state.runAfterGeneration=false;state.record=state.metrics=state.intersections=state.staticGate=null;
  bootWorker();worker.postMessage({type,requestId,operation,restore});status('正在执行不可变裁片事务并重新生成真实材料网格…');updateButtons();
 }catch(e){status(e.message,true);}
}
function continuationSewCurrent(){
 if(state.running||state.generating||state.phase==='paused')return;
 if(!state.analytic||!state.analytic.source.continuationEdits){generate(true);return;}
 if(state.fitPreflight?.blocking){status(state.fitPreflight.message,true);return;}
 state.record=state.metrics=state.intersections=state.staticGate=null;show('cloth');
 if(worker){state.running=true;state.phase='loading-solver';worker.postMessage({type:'run',requestId});status('以当前编辑后的材料重新缝合；没有重新取原配方覆盖编辑。');updateButtons();}
 else{const restore=continuationRestore();requestId++;state.generating=true;state.phase='editing';state.runAfterGeneration=true;bootWorker();worker.postMessage({type:'replay-edits',requestId,restore});updateButtons();}
}
