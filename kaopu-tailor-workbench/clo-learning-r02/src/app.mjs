import {createStudyStage} from './stage.mjs';
import {PACKED_DATA, WORKER_CODE} from '../generated/resources.mjs';

const $ = id => document.getElementById(id);
const names = {skirt_front:'前片', skirt_back:'后片 · 含开衩', wb_front:'前腰头', wb_back:'后腰头'};
const colors = {skirt_front:'#aab7a0', skirt_back:'#bac3af', wb_front:'#d0c1a2', wb_back:'#c6baa4'};
const stages = {darts:'缝合省道',waist:'连接腰头',sides:'缝合侧边',shell:'合拢裙身','seam-relax':'放松接缝','seam-finish':'整理接缝',release:'释放临时约束',refine:'校正布面',joint:'校正完整缝口'};
const failureNames = {
  'cloth-intersections':'布面相交需复核',
  'body-intersections':'衣物与身体相交需复核',
  'tension':'布面拉伸超过检查阈值',
  'compression':'布面压缩超过检查阈值',
  'whole-seam-separation':'完整接缝分离超过检查阈值',
  'needle-gap':'接缝针点间隙超过检查阈值',
  'body-penetration':'布面顶点进入身体',
  'invalid-body-samples':'身体距离采样不完整'
};
const NS = 'http://www.w3.org/2000/svg';
const state = {ready:false,busy:false,phase:'loading',selectedPanel:null,display:'fabric',currentDelta:0,requestedDelta:0,currentSlitDelta:0,requestedSlitDelta:0,requestId:0,revision:0,liveSolveCount:0,lastError:null,render:null};
let data, stage, currentResult, currentPaper, job = null;
const cm = mm => (mm/10).toFixed(1)+' cm';
const finite = v => typeof v === 'number' && Number.isFinite(v);
const changeLabel = mm => mm===0?'原款裙长':(mm>0?'裙长加长 ':'裙长缩短 ')+cm(Math.abs(mm));
const slitChangeLabel = mm => mm===0?'原款开衩':(mm>0?'开衩加深 ':'开衩变浅 ')+cm(Math.abs(mm));
const dirty = () => state.requestedDelta!==state.currentDelta || state.requestedSlitDelta!==state.currentSlitDelta;
const designSummary = (delta,slitDelta) => '裙长 '+cm(data.baseMeasurements.frontLengthMm+delta)+' · 开衩深度 '+cm(data.baseMeasurements.slitDepthMm+slitDelta);
const outcome = () => currentResult?.record.staticGate.passed?'静态检查通过':'本次检查未通过';
function message(title,detail,phase) {
  $('phaseStatus').textContent=title; $('statusDetail').textContent=detail;
  state.phase=phase; document.body.dataset.phase=phase;
}
function errorBanner(error) {
  state.lastError=error?String(error.message||error):null;
  $('errorBanner').hidden=!error; $('errorBanner').textContent=state.lastError||'';
}
function syncButtons() {
  for(const id of ['lengthInput','slitInput','resetButton']) $(id).disabled=!state.ready||state.busy;
  $('applyButton').disabled=!state.ready||state.busy||!dirty();
  $('cancelButton').hidden=!state.busy;
  $('solveProgress').hidden=!state.busy;
}
function syncInputs() {
  const length=data.baseMeasurements.frontLengthMm+state.requestedDelta;
  const depth=data.baseMeasurements.slitDepthMm+state.requestedSlitDelta;
  $('lengthValue').textContent=cm(length); $('slitValue').textContent=cm(depth);
  $('lengthInput').setAttribute('aria-valuetext',cm(length)+'，'+changeLabel(state.requestedDelta));
  $('slitInput').setAttribute('aria-valuetext',cm(depth)+'，'+slitChangeLabel(state.requestedSlitDelta)+'，纸样垂直深度');
}
function selectPanel(id) {
  state.selectedPanel=id; stage?.selectPanel(id);
  for(const el of $('patternSvg').querySelectorAll('[data-panel-id]')) {
    const chosen=el.dataset.panelId===id;
    el.setAttribute('aria-pressed',String(chosen));
    el.querySelector('.current-outline')?.setAttribute('stroke-width',chosen?'2.2':'1.1');
    el.setAttribute('opacity',id&&!chosen?'.58':'1');
  }
  for(const button of $('patternLegend').querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.panelId===id));
}
function svgElement(tag,attrs={}) {
  const el=document.createElementNS(NS,tag);
  for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));
  return el;
}
function paperSlit(paper) {
  const vertices=paper.panels.find(p=>p.id==='skirt_back')?.verticesMm;
  if(!vertices || ![18,19,20].every(i=>vertices[i]?.length===2 && vertices[i].every(finite))) throw Error('后片开衩纸样坐标不完整。');
  return {mouthRight:vertices[18],apex:vertices[19],mouthLeft:vertices[20],depth:vertices[19][1]-vertices[18][1],width:Math.abs(vertices[18][0]-vertices[20][0])};
}
function drawPaper(paper,mode='complete') {
  const pending=mode==='pending',svg=$('patternSvg'),slit=paperSlit(paper);
  svg.replaceChildren(); svg.setAttribute('viewBox','0 0 1000 360');
  svg.setAttribute('aria-label',(pending?'本次待试穿纸样':'当前三维结果对应纸样')+'；开衩深度 '+cm(slit.depth)+'，口宽 '+cm(slit.width)+'；可选择裁片');
  const layouts={skirt_front:[90,32],skirt_back:[350,32],wb_front:[680,70],wb_back:[680,175]},scale=.36;
  for(const id of ['skirt_front','skirt_back','wb_front','wb_back']) {
    const original=data.paper.panels.find(p=>p.id===id),edited=paper.panels.find(p=>p.id===id);
    const minX=Math.min(...original.verticesMm.map(p=>p[0])),top=Math.max(...original.verticesMm.map(p=>p[1]));
    const [x,y]=layouts[id],px=p=>x+(p[0]-minX)*scale,py=p=>y+(top-p[1])*scale;
    function outline(panel) {
      const points=panel.edges.flatMap(e=>e.sampledPointsMm||[]);
      return points.map((p,i)=>(i?'L':'M')+px(p).toFixed(4)+','+py(p).toFixed(4)).join(' ')+' Z';
    }
    const group=svgElement('g',{'data-panel-id':id,tabindex:0,role:'button','aria-label':'选择'+names[id],'aria-pressed':'false'});
    group.append(svgElement('path',{d:outline(edited),class:'current-outline',fill:colors[id],'fill-opacity':'.48',stroke:'#536b58','stroke-width':'1.1'}));
    group.append(svgElement('path',{d:outline(original),fill:'none',stroke:'#8b8f85','stroke-width':'.85','stroke-dasharray':'4 3','pointer-events':'none'}));
    const width=(Math.max(...original.verticesMm.map(p=>p[0]))-minX)*scale;
    const label=svgElement('text',{x:x+width/2,y:y-12,'text-anchor':'middle',fill:'#5d665b','font-size':'12'});
    label.textContent=names[id];group.append(label);
    if(id==='skirt_back') {
      const marks=svgElement('g',{class:'slit-dimensions','pointer-events':'none','aria-hidden':'true'});
      const dimensionX=x+width+20,apexY=py(slit.apex),hemY=py(slit.mouthRight),mouthY=hemY+23;
      const dimensionLine=(x1,y1,x2,y2,extra={})=>marks.append(svgElement('line',{x1,y1,x2,y2,stroke:'#637661','stroke-width':'.8',...extra}));
      dimensionLine(px(slit.apex),apexY,dimensionX+4,apexY,{'stroke-dasharray':'2 3',opacity:'.55'});
      dimensionLine(px(slit.mouthRight),hemY,dimensionX+4,hemY,{'stroke-dasharray':'2 3',opacity:'.55'});
      dimensionLine(dimensionX,apexY,dimensionX,hemY);
      for(const v of [apexY,hemY])dimensionLine(dimensionX-3,v-2,dimensionX+3,v+2);
      marks.append(svgElement('circle',{cx:px(slit.apex),cy:apexY,r:2,fill:'#536b58'}));
      const depthLabel=svgElement('text',{x:dimensionX+8,y:(apexY+hemY)/2-1,fill:'#405844','font-size':'12'});
      depthLabel.textContent=cm(slit.depth);marks.append(depthLabel);
      const meaning=svgElement('text',{x:dimensionX+8,y:(apexY+hemY)/2+14,fill:'#72776d','font-size':'10'});
      meaning.textContent='纸样深度';marks.append(meaning);
      for(const point of [slit.mouthLeft,slit.mouthRight])dimensionLine(px(point),hemY+3,px(point),mouthY+3,{opacity:'.55'});
      dimensionLine(px(slit.mouthLeft),mouthY,px(slit.mouthRight),mouthY);
      const mouthLabel=svgElement('text',{x:px(slit.mouthRight)+9,y:mouthY+4,fill:'#72776d','font-size':'10'});
      mouthLabel.textContent='口宽 '+cm(slit.width)+' · 固定';marks.append(mouthLabel);
      group.append(marks);
    }
    group.addEventListener('click',()=>selectPanel(state.selectedPanel===id?null:id));
    group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectPanel(state.selectedPanel===id?null:id);}});
    svg.append(group);
  }
  const note=svgElement('text',{x:680,y:295,fill:'#72776d','font-size':11});
  note.textContent=pending?'实线：本次待试穿纸样':'实线：当前三维对应纸样';svg.append(note);
  const note2=svgElement('text',{x:680,y:315,fill:'#72776d','font-size':11});
  note2.textContent='虚线：原款 · 各片保持同一比例';svg.append(note2);
  const paperStates={
    complete:'与当前三维结果一致',
    dirty:'新参数待计算 · 此处保留已完成纸样',
    preparing:'正在准备新纸样 · 此处保留已完成版',
    pending:'本次新纸样 · 三维仍是上次结果'
  };
  $('patternState').textContent=paperStates[mode]||paperStates.complete;
  $('patternState').dataset.mode=mode;
  $('paperSlitDepth').textContent=cm(slit.depth);$('paperSlitMouthWidth').textContent=cm(slit.width);
  if(!$('patternLegend').children.length) for(const id of Object.keys(names)) {
    const button=document.createElement('button');button.type='button';button.dataset.panelId=id;button.setAttribute('aria-pressed','false');
    const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=colors[id];
    button.append(swatch,document.createTextNode(names[id]));
    button.addEventListener('click',()=>selectPanel(state.selectedPanel===id?null:id));$('patternLegend').append(button);
  }
  selectPanel(state.selectedPanel);
}
function metrics(result) {
  const gate=result.record.staticGate;
  $('seamValue').textContent=gate.wholeSeamAudit.maxSpanUpperBoundMm.toFixed(3)+' mm';
  $('strainValue').textContent=(100*result.record.metrics.maxPrincipalStrain).toFixed(2)+'%';
  $('penetrationValue').textContent=gate.minimumBodyVertexDistanceMm.toFixed(2)+' mm';
  $('seamValue').title='20 条完整接缝的最大分离上界；检查阈值 0.25 mm。后片开口的两条自由边不属于接缝。';
  $('strainValue').title='最大主拉伸应变；压缩最大 '+gate.maximumCompressionPercent.toFixed(2)+'%；这是几何变形，不是应力或压力。';
  $('penetrationValue').title='布面顶点对原身体 SDF 的最小有符号距离；正数表示顶点在体外。此值不能替代独立三角相交检查。';
}
function review(result) {
  const gate=result.record.staticGate,failed=!gate.passed,list=$('reviewReasons');
  $('reviewBanner').hidden=!failed;list.replaceChildren();document.body.dataset.review=failed?'failed':'passed';
  for(const reason of gate.failures||[]) {
    const row=document.createElement('li');row.textContent=failureNames[reason]||'需复核：'+reason;row.dataset.failure=reason;list.append(row);
  }
  if(failed&&!list.children.length) {
    const row=document.createElement('li');row.textContent='检查未通过，请查看本次真实结果。';list.append(row);
  }
  const hits=result.intersections;
  $('reviewDetail').textContent='右侧保留这次真实计算结果，便于观察问题。'+(hits?'布面相交 '+hits.selfStrictTriangleIntersectionCount+' 对，身体相交 '+hits.bodyIntersectingFaceCount+' 面。':'')+'它不作为合格试样。';
}
function evidence(result) {
  const box=$('evidenceContent');box.replaceChildren();
  const paragraph=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
  paragraph('学习重点：把改版变成可核对的纸样操作；重新网格化并试穿；让检查结果绑定本次纸样。此页分别调整裙长与既有三角后开口深度，尚未接入自然语言 AI。');
  paragraph('本轮使用现有 S03 后开衩铅笔裙、对应冻结人物及原皮肤。人物有 25,417 个顶点，比例与姿态保持原始数据。腰头、省道、臀线与横向宽度受保护。后开口口宽保持 '+cm(data.baseMeasurements.slitMouthWidthMm)+'，不新增后中缝。');
  paragraph('当前三维：'+designSummary(state.currentDelta,state.currentSlitDelta)+'。'+result.record.positionsMm.length.toLocaleString('zh-CN')+' 个材料顶点，'+result.spec.panels.reduce((n,p)=>n+p.triangles.length,0).toLocaleString('zh-CN')+' 个三角形，4 个裁片、20 条接缝。');
  paragraph('裙长是前片垂直纸样长度，不含腰头；开衩深度是从纸样下摆到三角顶点的垂直长度，不是缝口长度或成衣实测。本轮沿用原三角开口，不包含搭门、缝份、折边或真实开衩工艺。');
  paragraph('滑块范围只限定本轮允许的操作，不代表所有参数组合都通过试穿。每次使用同一检查阈值；失败候选保留显示并明确标记，不晋级为合格结果。');
  paragraph('沿用原 digital-muslin 数字胚布：200 g/m²，尚未做真实面料标定。静态检查阈值为拉伸/压缩 ≤15%、完整接缝分离 ≤0.25 mm、最小身体顶点距离 ≥−0.05 mm。数值通过不等于真实面料合体或可生产。');
  const is=result.intersections;
  paragraph('本次最大压缩 '+result.record.staticGate.maximumCompressionPercent.toFixed(2)+'%。'+(is?'最终姿态的身体相交面数 '+is.bodyIntersectingFaceCount+'，布面严格三角相交对数 '+is.selfStrictTriangleIntersectionCount+'。':'原档案未附独立三角相交报告。')+'动态、自接触响应和连续碰撞尚未认证。');
  if(!result.record.staticGate.passed)paragraph('本次检查未通过：'+(result.record.staticGate.failures||[]).map(code=>(failureNames[code]||code)+' ['+code+']').join('；')+'。');
  paragraph('应变色谱按每个真实三角形的 2D→3D 形变计算：蓝色压缩、红色拉伸，±15% 为色彩饱和值。颜色不是压力，也不是实测面料应力。');
  paragraph(result===data.original?'当前右侧为来源项目保存的 S03 原款档案，用来对照与还原。':result===data.candidate?'首屏试样由本次构建实际求解：'+changeLabel(data.defaults.deltaMm)+'，'+slitChangeLabel(data.defaults.slitDeltaMm)+'。改变任一参数后，会在浏览器后台重新计算；耗时随设备与参数变化。':'当前结果在本页重新计算完成。计算时间随设备变化，浏览时可旋转或取消。');
  const links=document.createElement('p');
  for(const [label,url]of [['原项目与冻结来源','https://github.com/haihao0307/guilin-dem-pipeline/tree/'+data.provenance.upstreamCommit+'/kaopu-tailor-workbench'],['学习帖 1','https://x.com/irinatoxi/status/2112109267788423379'],['学习帖 2','https://x.com/irinatoxi/status/2112265445193486494'],['CLO 官方流程接口','https://developer.clo3d.com/scenario.html']]) {
    const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a,document.createTextNode(' · '));
  }
  box.append(links);paragraph('两条展示帖未公开完整后端实现。本页借鉴其可观察的纸样—试穿工作流，未宣称复现作者的私有系统。');
  const identity=document.createElement('p');identity.id='buildIdentity';identity.textContent='独立实验版本 '+data.provenance.buildId+' · 源码 '+data.provenance.sourceCommit.slice(0,12);box.append(identity);
  const legal=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');
  summary.textContent='原始组件许可';pre.textContent=data.thirdPartyNotices;pre.style.cssText='white-space:pre-wrap;font-size:9px;max-height:220px;overflow:auto';legal.append(summary,pre);box.append(legal);
}
function showResult(result,paper,delta,slitDelta,{initial=false,restored=false}={}) {
  const slit=paperSlit(paper);
  stage.setCandidate(result);currentResult=result;currentPaper=paper;
  state.currentDelta=delta;state.requestedDelta=delta;state.currentSlitDelta=slitDelta;state.requestedSlitDelta=slitDelta;
  $('lengthInput').value=String(delta);$('slitInput').value=String(slitDelta);
  syncInputs();drawPaper(paper);metrics(result);review(result);
  $('candidateLength').textContent=cm(data.baseMeasurements.frontLengthMm+delta);
  $('candidateSlitDepth').textContent=cm(slit.depth);
  const passed=result.record.staticGate.passed;
  $('candidateState').textContent=restored?'原款档案 · 已还原':passed?'本次试样 · 静态检查通过':'本次检查未通过 · 保留真实候选';
  const reasons=(result.record.staticGate.failures||[]).map(code=>failureNames[code]||code).join('；');
  message(restored?'已还原原款':passed?'静态检查通过':'本次检查未通过',
    restored?'裙长与开衩深度均已还原，右侧与原款一致。':
    !passed?reasons+'。真实候选可继续观察，但不能作为合格试样。':
    initial?'已载入本次构建真实求解的试样：'+designSummary(delta,slitDelta)+'。可分别修改后重新试穿。':
    '纸样、网格和检查结果已一起更新。'+designSummary(delta,slitDelta)+'。',
    restored?'restored':passed?'complete':'review');
  evidence(result);syncButtons();
}
function closeJob() {
  if(job){job.worker.terminate();URL.revokeObjectURL(job.url);job=null;}
  state.busy=false;
}
function cancel() {
  if(!job)return;
  state.requestId++;closeJob();drawPaper(currentPaper,dirty()?'dirty':'complete');
  $('candidateState').textContent='保留上次结果 · '+outcome();
  message('本次计算已取消','纸样和三维已恢复为上次完成的结果。两个滑块保留本次请求，可调整后再次试穿。','cancelled');syncButtons();
}
function fail(error) {
  state.requestId++;closeJob();errorBanner(error);if(currentPaper)drawPaper(currentPaper,dirty()?'dirty':'complete');
  $('candidateState').textContent='保留上次结果 · '+outcome();
  message('本次未完成','已保留上一份完整结果。可调整裙长或开衩深度后重试，或还原原款。','error');syncButtons();
}
function verifyBinding(binding,active) {
  const op=binding?.operation;
  if(op?.requestId!==active.id||op?.deltaMm!==active.delta||op?.slitDeltaMm!==active.slitDelta||op?.expectedRevision!==active.revision)throw Error('试样版本或两个参数与本次修改不符。');
  for(const [k,v] of Object.entries(data.identity.person))if(binding.person?.[k]!==v)throw Error('试样人物标识不符。');
}
function verifyResult(d,active) {
  const b=d.binding;verifyBinding(b,active);
  if(b.operationSHA256!==active.binding?.operationSHA256||b.materialSHA256!==active.binding?.materialSHA256)throw Error('试样来源与新纸样不符。');
  if(d.record.nativeBinding?.operationSHA256!==b.operationSHA256||d.spec.source.nativeBinding?.materialSHA256!==b.materialSHA256)throw Error('成衣记录没有绑定当前纸样。');
  const n=d.spec.panels.reduce((sum,p)=>sum+p.uvMm.length,0);
  if(d.record.positionsMm?.length!==n||!d.record.positionsMm.every(p=>p.length===3&&p.every(finite)))throw Error('试样几何不完整。');
  const gate=d.record.staticGate;
  if(typeof gate?.passed!=='boolean'||!finite(gate.wholeSeamAudit?.maxSpanUpperBoundMm)||!finite(d.record.metrics?.maxPrincipalStrain)||!finite(gate.minimumBodyVertexDistanceMm))throw Error('本次检查结果不完整。');
}
function validDelta(value,min,max,step) {
  return finite(value)&&finite(min)&&finite(max)&&finite(step)&&step>0&&value>=min&&value<=max&&Math.abs((value-min)/step-Math.round((value-min)/step))<1e-9;
}
function apply() {
  if(state.busy||!state.ready||!dirty())return;
  const delta=state.requestedDelta,slitDelta=state.requestedSlitDelta,limits=data.limits;
  if(!validDelta(delta,limits.minDeltaMm,limits.maxDeltaMm,limits.stepMm))return fail(Error('裙长超出本轮操作范围或步长。'));
  if(!validDelta(slitDelta,limits.minSlitDeltaMm,limits.maxSlitDeltaMm,limits.slitStepMm))return fail(Error('开衩深度超出本轮操作范围或步长。'));
  errorBanner(null);state.busy=true;state.requestId++;$('solveProgress').value=0;
  const id=state.requestId,revision=state.revision,url=URL.createObjectURL(new Blob([WORKER_CODE],{type:'text/javascript'}));
  let worker;try{worker=new Worker(url);}catch(error){URL.revokeObjectURL(url);return fail(error);}
  const active={id,revision,delta,slitDelta,url,worker,binding:null,analytic:null,measurements:null,start:performance.now()};job=active;
  drawPaper(currentPaper,'preparing');$('candidateState').textContent='显示上次结果 · 两个参数重新计算中';
  message('准备新纸样',designSummary(delta,slitDelta)+'。计算在后台进行，可继续查看或取消。','preparing');syncButtons();
  worker.onerror=e=>{if(job===active)fail(Error(e.message||'后台求解异常。'));};
  worker.onmessage=event=>{
    if(job!==active||id!==state.requestId)return;
    const d=event.data;
    try {
      if(d.type==='error')throw Error(d.message||'求解未完成。');
      if(d.type==='ready') {
        worker.postMessage({type:'load-design-variant',requestId:id,expectedRevision:revision,presetId:'S03',paperText:data.paperText,deltaMm:delta,slitDeltaMm:slitDelta,person:data.identity.person});return;
      }
      if(d.requestId!==id)return;
      if(d.type==='paper') {
        if(!d.canSew||!d.protectedGeometryPassed)throw Error('纸样预检查未通过。');
        verifyBinding(d.binding,active);
        active.binding=d.binding;active.analytic=d.analytic;active.measurements=d.measurements;
        const measured=paperSlit(d.analytic);
        if(Math.abs(measured.depth-(data.baseMeasurements.slitDepthMm+slitDelta))>1e-7||Math.abs(measured.width-data.baseMeasurements.slitMouthWidthMm)>1e-7)throw Error('开衩纸样尺寸与本次请求不符。');
        drawPaper(d.analytic,'pending');message('纸样已更新','下方显示本次新纸样，正在缝合与试穿。三维与诊断仍保留上次完成的结果。','solving');
        worker.postMessage({type:'run',requestId:id,person:data.identity.person});
      }else if(['started','progress','stage','auditing'].includes(d.type)) {
        if(finite(d.progress))$('solveProgress').value=Math.min(1,Math.max(0,d.progress));
        const seconds=Math.round((performance.now()-active.start)/1000);
        message(d.type==='auditing'?'检查最终试样':'正在'+(stages[d.stage]||'缝合试穿'),'已计算 '+seconds+' 秒 · '+(d.type==='auditing'?'复核完整接缝、布面相交、变形与身体距离。':'三维仍显示上次完整结果，可继续查看或取消。'),d.type==='auditing'?'auditing':'solving');
      }else if(d.type==='paused'&&d.budgetCheckpoint) {
        message('继续本次计算','已到一个计算分段，正从现有状态继续。可随时取消。','solving');worker.postMessage({type:'resume',requestId:id});
      }else if(d.type==='done') {
        verifyResult(d,active);
        const result={...d,deltaMm:delta,slitDeltaMm:slitDelta,measurements:active.measurements,measuredWallSeconds:(performance.now()-active.start)/1000};
        closeJob();state.revision++;state.liveSolveCount++;
        showResult(result,active.analytic,delta,slitDelta);
      }
    }catch(error){fail(error);}
  };
  try{worker.postMessage({type:'init-study',assets:data.workerAssets});}catch(error){fail(error);}
}
function inputChanged() {
  if(!state.ready||state.busy)return;
  state.requestedDelta=Number($('lengthInput').value);state.requestedSlitDelta=Number($('slitInput').value);
  syncInputs();errorBanner(null);drawPaper(currentPaper,dirty()?'dirty':'complete');
  if(dirty()) {
    message('修改待试穿',designSummary(state.requestedDelta,state.requestedSlitDelta)+'。点击重新裁剪与试穿；三维、纸样与诊断现在仍是上次结果。','dirty');
    $('candidateState').textContent=outcome()+' · 新参数尚未计算';
  }else {
    message(outcome(),'两个滑块与当前显示纸样一致。',currentResult.record.staticGate.passed?'complete':'review');
    $('candidateState').textContent='本次试样 · '+outcome();
  }
  syncButtons();
}
async function start() {
  const bytes=Uint8Array.from(atob(PACKED_DATA),c=>c.charCodeAt(0));
  data=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  data.paper=JSON.parse(data.paperText);
  if(!finite(data.defaults?.deltaMm)||!finite(data.defaults?.slitDeltaMm)||!finite(data.baseMeasurements?.slitDepthMm)||!finite(data.baseMeasurements?.slitMouthWidthMm))throw Error('双参数构建数据不完整。');
  document.documentElement.dataset.buildId=data.provenance.buildId;document.documentElement.dataset.sourceCommit=data.provenance.sourceCommit;
  stage=createStudyStage($('stageCanvas'),data.person,data.original,{onSelectPanel:selectPanel,onRender:s=>{state.render=s;if(s.contextLost)errorBanner(Error('三维图形上下文已丢失，请重新载入页面。'));}});
  for(const [id,min,max,step]of [['lengthInput','minDeltaMm','maxDeltaMm','stepMm'],['slitInput','minSlitDeltaMm','maxSlitDeltaMm','slitStepMm']]) {
    $(id).min=String(data.limits[min]);$(id).max=String(data.limits[max]);$(id).step=String(data.limits[step]);
  }
  $('baselineLength').textContent=cm(data.baseMeasurements.frontLengthMm);
  $('baselineSlitDepth').textContent=cm(data.baseMeasurements.slitDepthMm);
  state.ready=true;showResult(data.candidate,data.candidate.analytic,data.defaults.deltaMm,data.defaults.slitDeltaMm,{initial:true});
  $('lengthInput').addEventListener('input',inputChanged);$('slitInput').addEventListener('input',inputChanged);
  $('applyButton').addEventListener('click',apply);$('cancelButton').addEventListener('click',cancel);
  $('resetButton').addEventListener('click',()=>{
    if(state.busy)return;
    state.requestId++;closeJob();state.revision++;errorBanner(null);showResult(data.original,data.paper,0,0,{restored:true});
  });
  for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{
    stage.view(button.dataset.view);
    for(const b of document.querySelectorAll('[data-view]')){const on=b===button;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));}
  });
  for(const button of document.querySelectorAll('[data-display]'))button.addEventListener('click',()=>{
    state.display=button.dataset.display;stage.setDisplay(state.display);$('strainLegend').hidden=state.display!=='strain';
    for(const b of document.querySelectorAll('[data-display]')){const on=b===button;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));}
  });
  $('seamsToggle').addEventListener('change',()=>stage.setSeams($('seamsToggle').checked));
  window.addEventListener('pagehide',()=>{closeJob();stage.dispose();},{once:true});
  Object.defineProperty(window,'__CLO_STUDY__',{value:Object.freeze({snapshot:()=>({
    schema:'clo-study-ui-evidence/1',studyVersion:'R02',...structuredClone(state),source:data.provenance,geometry:stage.snapshot(),
    binding:currentResult.binding,staticGate:currentResult.record.staticGate,intersections:currentResult.intersections||null,
    measurements:{committed:{frontLengthMm:data.baseMeasurements.frontLengthMm+state.currentDelta,slitDepthMm:paperSlit(currentPaper).depth,slitMouthWidthMm:paperSlit(currentPaper).width},requested:{frontLengthMm:data.baseMeasurements.frontLengthMm+state.requestedDelta,slitDepthMm:data.baseMeasurements.slitDepthMm+state.requestedSlitDelta}}
  })}),writable:false});
}
start().catch(error=>{state.ready=false;closeJob();syncButtons();errorBanner(error);message('无法载入研究','请使用支持 WebGL 2 和 gzip 解压的现代浏览器，或刷新重试。','error');});
