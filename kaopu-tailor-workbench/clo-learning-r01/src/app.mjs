import {createStudyStage} from './stage.mjs';
import {PACKED_DATA, WORKER_CODE} from '../generated/resources.mjs';

const $ = id => document.getElementById(id);
const names = {skirt_front:'前片', skirt_back:'后片 · 含开衩', wb_front:'前腰头', wb_back:'后腰头'};
const colors = {skirt_front:'#aab7a0', skirt_back:'#bac3af', wb_front:'#d0c1a2', wb_back:'#c6baa4'};
const stages = {darts:'缝合省道',waist:'连接腰头',sides:'缝合侧边',shell:'合拢裙身','seam-relax':'放松接缝','seam-finish':'整理接缝',release:'释放临时约束',refine:'校正布面',joint:'校正完整缝口'};
const NS = 'http://www.w3.org/2000/svg';
const state = {ready:false,busy:false,phase:'loading',selectedPanel:null,display:'fabric',currentDelta:60,requestedDelta:60,requestId:0,revision:0,liveSolveCount:0,lastError:null,render:null};
let data, stage, currentResult, currentPaper, job = null;
const cm = mm => (mm/10).toFixed(1)+' cm';
const changeLabel = mm => mm===0?'原款':(mm>0?'加长 ':'缩短 ')+cm(Math.abs(mm));
const finite = v => typeof v === 'number' && Number.isFinite(v);
function message(title,detail,phase) { $('phaseStatus').textContent=title; $('statusDetail').textContent=detail; state.phase=phase; document.body.dataset.phase=phase; }
function errorBanner(error) { state.lastError=error?String(error.message||error):null; $('errorBanner').hidden=!error; $('errorBanner').textContent=state.lastError||''; }
function syncButtons() {
  $('lengthInput').disabled=!state.ready||state.busy;
  $('applyButton').disabled=!state.ready||state.busy||state.requestedDelta===state.currentDelta;
  $('resetButton').disabled=!state.ready;
  $('cancelButton').hidden=!state.busy;
  $('solveProgress').hidden=!state.busy;
}
function syncLength() {
  const value=data.baseMeasurements.frontLengthMm+state.requestedDelta;
  $('lengthValue').textContent=cm(value);
  $('lengthInput').setAttribute('aria-valuetext',cm(value)+'，'+changeLabel(state.requestedDelta));
}
function selectPanel(id) {
  state.selectedPanel=id;
  stage?.selectPanel(id);
  for(const el of $('patternSvg').querySelectorAll('[data-panel-id]')) {
    const chosen=el.dataset.panelId===id;
    el.setAttribute('aria-pressed',String(chosen));
    el.querySelector('.current-outline')?.setAttribute('stroke-width',chosen?'2.2':'1.1');
    el.setAttribute('opacity',id&&!chosen?'.58':'1');
  }
  for(const button of $('patternLegend').querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.panelId===id));
}
function svgElement(tag,attrs={}) {const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el;}
function drawPaper(paper,pending=false) {
  const svg=$('patternSvg');svg.replaceChildren();svg.setAttribute('viewBox','0 0 1000 360');
  const layouts={skirt_front:[90,32],skirt_back:[350,32],wb_front:[650,70],wb_back:[650,175]};
  const scale=.36;
  for(const id of ['skirt_front','skirt_back','wb_front','wb_back']) {
    const original=data.paper.panels.find(p=>p.id===id),edited=paper.panels.find(p=>p.id===id);
    const minX=Math.min(...original.verticesMm.map(p=>p[0])),top=Math.max(...original.verticesMm.map(p=>p[1]));
    const [x,y]=layouts[id];
    function outline(panel) {const points=panel.edges.flatMap(e=>e.sampledPointsMm||[]);return points.map((p,i)=>(i?'L':'M')+(x+(p[0]-minX)*scale).toFixed(4)+','+(y+(top-p[1])*scale).toFixed(4)).join(' ')+' Z';}
    const group=svgElement('g',{'data-panel-id':id,tabindex:0,role:'button','aria-label':'选择'+names[id],'aria-pressed':'false'});
    const current=svgElement('path',{d:outline(edited),class:'current-outline',fill:colors[id],'fill-opacity':'.48',stroke:'#536b58','stroke-width':'1.1'});
    group.append(current,svgElement('path',{d:outline(original),fill:'none',stroke:'#8b8f85','stroke-width':'.85','stroke-dasharray':'4 3','pointer-events':'none'}));
    const width=(Math.max(...original.verticesMm.map(p=>p[0]))-minX)*scale;
    const label=svgElement('text',{x:x+width/2,y:y-12,'text-anchor':'middle',fill:'#5d665b','font-size':'12'});label.textContent=names[id];group.append(label);
    group.addEventListener('click',()=>selectPanel(state.selectedPanel===id?null:id));
    group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPanel(state.selectedPanel===id?null:id);}});
    svg.append(group);
  }
  const note=svgElement('text',{x:650,y:295,fill:'#72776d','font-size':11});note.textContent=pending?'新纸样 · 试穿计算中':'实线：显示款纸样';svg.append(note);
  const note2=svgElement('text',{x:650,y:315,fill:'#72776d','font-size':11});note2.textContent='虚线：原款 · 各片保持同一比例';svg.append(note2);
  if(!$('patternLegend').children.length) for(const id of Object.keys(names)) {
    const button=document.createElement('button');button.type='button';button.dataset.panelId=id;button.setAttribute('aria-pressed','false');
    const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=colors[id];button.append(swatch,document.createTextNode(names[id]));button.addEventListener('click',()=>selectPanel(state.selectedPanel===id?null:id));$('patternLegend').append(button);
  }
  selectPanel(state.selectedPanel);
}
function metrics(result) {
  const gate=result.record.staticGate;
  $('seamValue').textContent=gate.wholeSeamAudit.maxSpanUpperBoundMm.toFixed(3)+' mm';
  $('strainValue').textContent=(100*result.record.metrics.maxPrincipalStrain).toFixed(2)+'%';
  $('penetrationValue').textContent=gate.minimumBodyVertexDistanceMm.toFixed(2)+' mm';
  $('seamValue').title='20 条完整接缝的最大分离上界；检查阈值 0.25 mm';
  $('strainValue').title='最大主拉伸应变；压缩最大 '+gate.maximumCompressionPercent.toFixed(2)+'%；这是几何变形，不是应力或压力。';
  $('penetrationValue').title='布面顶点对原身体 SDF 的最小有符号距离；正数表示顶点在体外。不能据此证明运动中无穿透。';
}
function evidence(result) {
  const box=$('evidenceContent');box.replaceChildren();
  const paragraph=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
  paragraph('学习重点：把改版变成可核对的纸样操作；重新网格化并试穿；让检查结果绑定本次纸样。此页的输入是明确的裙长参数，尚未接入自然语言 AI。');
  paragraph('本轮使用你现有的 S03 后开衩铅笔裙、对应冻结人物及原皮肤。人物有 25,417 个顶点，比例与姿态保持原始数据。腰头、省道、臀线、下摆宽和 8.61 cm 开衩深度均保持。');
  paragraph('显示款：'+changeLabel(state.currentDelta)+'；'+result.record.positionsMm.length.toLocaleString('zh-CN')+' 个材料顶点，'+result.spec.panels.reduce((n,p)=>n+p.triangles.length,0).toLocaleString('zh-CN')+' 个三角形，4 个裁片、20 条接缝。裙长指前片垂直纸样长度，不含腰头。');
  paragraph('沿用原 digital-muslin 数字胚布：200 g/m²，尚未做真实面料标定。静态检查阈值为拉伸/压缩 ≤15%、完整接缝分离 ≤0.25 mm、最小身体顶点距离 ≥−0.05 mm。数值通过不等于真实面料合体或可生产。');
  const is=result.intersections;
  paragraph('本次最大压缩 '+result.record.staticGate.maximumCompressionPercent.toFixed(2)+'%。'+(is?'最终姿态的身体相交面数 '+is.bodyIntersectingFaceCount+'，布面严格三角相交对数 '+is.selfStrictTriangleIntersectionCount+'。':'原档案未附独立三角相交报告。')+'动态、自接触响应和连续碰撞尚未认证。');
  paragraph('应变色谱按每个真实三角形的 2D→3D 形变计算：蓝色压缩、红色拉伸，±15% 为色彩饱和值。颜色不是压力，也不是实测面料应力。');
  paragraph(result===data.original?'当前右侧为来源项目保存的 S03 原款档案，用来对照与还原。':result===data.candidate?'初始右侧为本次构建实际计算的 +6 cm 试样；调整参数后会在浏览器中重新计算。构建环境约 50 秒的记录不代表你的设备速度。':'当前结果在本页重新计算完成。计算时间随设备变化，浏览时可旋转或取消。');
  const links=document.createElement('p');
  for(const [label,url]of [['原项目与冻结来源','https://github.com/haihao0307/guilin-dem-pipeline/tree/'+data.provenance.upstreamCommit+'/kaopu-tailor-workbench'],['学习帖 1','https://x.com/irinatoxi/status/2112109267788423379'],['学习帖 2','https://x.com/irinatoxi/status/2112265445193486494'],['CLO 官方流程接口','https://developer.clo3d.com/scenario.html']]){
    const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a,document.createTextNode(' · '));
  }
  box.append(links);paragraph('两条展示帖未公开完整后端实现。本页借鉴其可观察的纸样—试穿工作流，未宣称复现作者的私有系统。');
  const identity=document.createElement('p');identity.id='buildIdentity';identity.textContent='独立实验版本 '+data.provenance.buildId+' · 源码 '+data.provenance.sourceCommit.slice(0,12);box.append(identity);
  const legal=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='原始组件许可';pre.textContent=data.thirdPartyNotices;pre.style.cssText='white-space:pre-wrap;font-size:9px;max-height:220px;overflow:auto';legal.append(summary,pre);box.append(legal);
}
function showResult(result,paper,delta,{initial=false,restored=false}={}) {
  stage.setCandidate(result);currentResult=result;currentPaper=paper;state.currentDelta=delta;state.requestedDelta=delta;
  $('lengthInput').value=String(delta);syncLength();drawPaper(paper);metrics(result);
  $('candidateLength').textContent=cm(data.baseMeasurements.frontLengthMm+delta);
  const passed=result.record.staticGate.passed;
  $('candidateState').textContent=restored?'原款已还原':changeLabel(delta)+' · '+(passed?'静态检查通过':'需检查');
  message(restored?'已还原原款':passed?'静态检查通过':'本次检查未通过',restored?'右侧与原款一致，可再次调整。':initial?'已载入本次构建计算的 +6 cm 试样。调整后可在这里重新试穿。':passed?'纸样、网格和检查结果已一起更新。可查看背面开衩，或切换应变。':'本次真实计算结果已显示，请查看检查原因：'+result.record.staticGate.failures.join('；'),restored?'restored':passed?'complete':'review');
  evidence(result);syncButtons();
}
function closeJob() {
  if(job){job.worker.terminate();URL.revokeObjectURL(job.url);job=null;}
  state.busy=false;
}
function cancel() {
  if(!job)return;
  state.requestId++;closeJob();drawPaper(currentPaper);$('candidateState').textContent=changeLabel(state.currentDelta)+' · 保留已完成结果';
  message('本次计算已取消','纸样和三维已恢复为上次完成的结果。滑块保留你想修改的长度，可再次试穿。','cancelled');syncButtons();
}
function fail(error) {
  state.requestId++;closeJob();errorBanner(error);if(currentPaper)drawPaper(currentPaper);
  $('candidateState').textContent=changeLabel(state.currentDelta)+' · 保留已完成结果';
  message('本次未完成','已保留上一份完整结果。可调整长度后重试，或还原原款。','error');syncButtons();
}
function verifyResult(d,active) {
  const b=d.binding,op=b?.operation;
  if(op?.requestId!==active.id||op?.deltaMm!==active.delta||op?.expectedRevision!==active.revision)throw Error('试样版本与本次修改不符。');
  if(b.operationSHA256!==active.binding?.operationSHA256||b.materialSHA256!==active.binding?.materialSHA256)throw Error('试样来源与新纸样不符。');
  for(const [k,v] of Object.entries(data.identity.person)) if(b.person?.[k]!==v)throw Error('试样人物标识不符。');
  if(d.record.nativeBinding?.operationSHA256!==b.operationSHA256||d.spec.source.nativeBinding?.materialSHA256!==b.materialSHA256)throw Error('成衣记录没有绑定当前纸样。');
  const n=d.spec.panels.reduce((sum,p)=>sum+p.uvMm.length,0);
  if(d.record.positionsMm?.length!==n||!d.record.positionsMm.every(p=>p.length===3&&p.every(finite)))throw Error('试样几何不完整。');
  const gate=d.record.staticGate;
  if(typeof gate?.passed!=='boolean'||!finite(gate.wholeSeamAudit?.maxSpanUpperBoundMm)||!finite(d.record.metrics?.maxPrincipalStrain)||!finite(gate.minimumBodyVertexDistanceMm))throw Error('本次检查结果不完整。');
}
function apply() {
  if(state.busy||!state.ready||state.requestedDelta===state.currentDelta)return;
  const delta=state.requestedDelta;
  if(!finite(delta)||delta<data.limits.minDeltaMm||delta>data.limits.maxDeltaMm) return fail(Error('裙长超出本轮验证范围。'));
  errorBanner(null);state.busy=true;state.requestId++;$('solveProgress').value=0;
  const id=state.requestId,revision=state.revision;
  const url=URL.createObjectURL(new Blob([WORKER_CODE],{type:'text/javascript'}));
  let worker;try {worker=new Worker(url);}catch(error){URL.revokeObjectURL(url);return fail(error);}
  const active={id,revision,delta,url,worker,binding:null,analytic:null,measurements:null,start:performance.now()};job=active;
  $('candidateState').textContent='显示上次结果 · '+changeLabel(delta)+'计算中';
  message('准备新纸样','正在载入原人物碰撞数据。计算在后台进行，可继续查看或取消。','preparing');syncButtons();
  worker.onerror=e=>{if(job===active)fail(Error(e.message||'后台求解异常。'));};
  worker.onmessage=event=>{
    if(job!==active||id!==state.requestId)return;
    const d=event.data;
    try {
      if(d.type==='error')throw Error(d.message||'求解未完成。');
      if(d.type==='ready') {worker.postMessage({type:'load-length-variant',requestId:id,expectedRevision:revision,presetId:'S03',paperText:data.paperText,deltaMm:delta,person:data.identity.person});return;}
      if(d.requestId!==id)return;
      if(d.type==='paper') {
        if(!d.canSew||!d.protectedGeometryPassed)throw Error('纸样预检查未通过。');
        active.binding=d.binding;active.analytic=d.analytic;active.measurements=d.measurements;
        drawPaper(d.analytic,true);message('纸样已更新','新裁片已重新网格化，开始缝合与试穿。三维区域保留上次完成的结果。','solving');
        worker.postMessage({type:'run',requestId:id,person:data.identity.person});
      } else if(['started','progress','stage','auditing'].includes(d.type)) {
        if(finite(d.progress))$('solveProgress').value=Math.min(1,Math.max(0,d.progress));
        const seconds=Math.round((performance.now()-active.start)/1000);
        message(d.type==='auditing'?'检查最终试样':'正在'+(stages[d.stage]||'缝合试穿'),'已计算 '+seconds+' 秒 · '+(d.type==='auditing'?'复核完整接缝、布面变形与身体距离。':'三维仍显示上次完整结果，可继续查看或取消。'),d.type==='auditing'?'auditing':'solving');
      } else if(d.type==='paused'&&d.budgetCheckpoint) {
        message('继续本次计算','已到一个计算分段，正从现有状态继续。可随时取消。','solving');worker.postMessage({type:'resume',requestId:id});
      } else if(d.type==='done') {
        verifyResult(d,active);
        const result={...d,deltaMm:delta,measurements:active.measurements,measuredWallSeconds:(performance.now()-active.start)/1000};
        closeJob();state.revision++;state.liveSolveCount++;
        showResult(result,active.analytic,delta);
      }
    } catch(error) {fail(error);}
  };
  worker.postMessage({type:'init-study',assets:data.workerAssets});
}

async function start() {
  const bytes=Uint8Array.from(atob(PACKED_DATA),c=>c.charCodeAt(0));
  data=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  data.paper=JSON.parse(data.paperText);
  document.documentElement.dataset.buildId=data.provenance.buildId;document.documentElement.dataset.sourceCommit=data.provenance.sourceCommit;
  stage=createStudyStage($('stageCanvas'),data.person,data.original,{onSelectPanel:selectPanel,onRender:s=>{state.render=s;if(s.contextLost){errorBanner(Error('三维图形上下文已丢失，请重新载入页面。'));}}});
  $('lengthInput').min=String(data.limits.minDeltaMm);$('lengthInput').max=String(data.limits.maxDeltaMm);$('lengthInput').step=String(data.limits.stepMm);
  $('baselineLength').textContent=cm(data.baseMeasurements.frontLengthMm);
  state.ready=true;showResult(data.candidate,data.candidate.analytic,60,{initial:true});
  $('lengthInput').addEventListener('input',()=>{
    state.requestedDelta=Number($('lengthInput').value);syncLength();errorBanner(null);
    if(state.requestedDelta!==state.currentDelta){message('修改待试穿',changeLabel(state.requestedDelta)+'。点击重新裁剪与试穿，画面现在仍是上次完整结果。','dirty');$('candidateState').textContent=changeLabel(state.currentDelta)+' · 新长度尚未计算';}
    else {message(currentResult.record.staticGate.passed?'当前结果已完成':'本次检查未通过','滑块与当前显示的纸样一致。','complete');$('candidateState').textContent=changeLabel(state.currentDelta)+' · 已完成';}
    syncButtons();
  });
  $('applyButton').addEventListener('click',apply);$('cancelButton').addEventListener('click',cancel);
  $('resetButton').addEventListener('click',()=>{state.requestId++;closeJob();state.revision++;errorBanner(null);showResult(data.original,data.paper,0,{restored:true});});
  for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{stage.view(button.dataset.view);for(const b of document.querySelectorAll('[data-view]')){const on=b===button;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));}});
  for(const button of document.querySelectorAll('[data-display]'))button.addEventListener('click',()=>{state.display=button.dataset.display;stage.setDisplay(state.display);$('strainLegend').hidden=state.display!=='strain';for(const b of document.querySelectorAll('[data-display]')){const on=b===button;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));}});
  $('seamsToggle').addEventListener('change',()=>stage.setSeams($('seamsToggle').checked));
  window.addEventListener('pagehide',()=>{closeJob();stage.dispose();},{once:true});
  Object.defineProperty(window,'__CLO_STUDY__',{value:Object.freeze({snapshot:()=>({schema:'clo-study-ui-evidence/1',...structuredClone(state),source:data.provenance,geometry:stage.snapshot(),binding:currentResult.binding,staticGate:currentResult.record.staticGate,intersections:currentResult.intersections||null})}),writable:false});
}
start().catch(error=>{errorBanner(error);message('无法载入研究','请使用支持 WebGL 2 和 gzip 解压的现代浏览器，或刷新重试。','error');});
