import * as THREE from 'three';
import {createNativeActorFactory, createNativeShoeFactory} from './actors/index.mjs';
import {createHairFactory} from './hair/index.mjs';
import {createClothActor} from './cloth/index.mjs';
import {buildStyle, STYLES, StyleMaterials, scanData} from '../build/actors-source.mjs';
import {installFacePassRouting} from './render/face-pass-routing.mjs';

const state = {ready:false, busy:true, playing:false, count:2, selected:'1', mode:'walk', tick:0,
  simulationSeconds:0, speed:1, hairPhysics:true, wind:false, phase:'正在准备完整人物',
  errors:[], samples:[], interventions:[], poseSynchronizations:[], renderFrozen:false,
  lastSubmittedFrame:null, version:'crowd-runtime-r01', start:performance.now()};
const actors = [];
let raw, viewer, stage, actorFactory, hairFactory, shoeFactory, faceRouting, pendingTick, pumpTimer, resizeObserver;
let lastRender=0, lastHUD=0, rendering=false, cameraDirty=false, benchmark=null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const $=id=>document.getElementById(id);
const finite=values=>Array.from(values).every(Number.isFinite);
const number=(value,digits=1)=>Number.isFinite(value)?value.toFixed(digits):'—';

function showStatus(message){state.phase=message; if($('runtime-status'))$('runtime-status').textContent=message; writeEvidence();}
function fail(error){
  state.playing=false; state.busy=false; state.renderFrozen=true;
  const item={message:error.message||String(error),stack:error.stack||'',clothFailure:error.clothFailure,
    frameTransaction:error.frameTransaction,audit:error.audit,tick:state.tick,
    canvasFrozenAt:state.lastSubmittedFrame,requiredRecovery:'complete actor/cloth/hair rebuild using Reset'};
  state.errors.push(item); console.error('Crowd runtime',error);
  showStatus('画面已冻结，请重置完整人物：'+item.message); updateHUD(true); writeEvidence();
}

function installUI(){
  const style=document.createElement('style');
  style.textContent=`
  :root{--ink:#23372f;--muted:#67766e;--line:#d5ddd5;--green:#285b45;--paper:#f5f6ef}
  body{margin:0!important;display:block!important;min-height:0!important;background:var(--paper)!important;color:var(--ink)!important;font:14px/1.5 Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif!important;overflow:hidden!important}
  #crowd-app,#crowd-app *{box-sizing:border-box}#crowd-app{position:fixed;inset:0;z-index:2147480000;display:grid;grid-template-rows:72px 1fr;background:var(--paper)}
  #crowd-app button,#crowd-app select{font:inherit;line-height:1.4;cursor:pointer;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);padding:9px 13px;min-height:39px;box-shadow:none;letter-spacing:0;text-transform:none}
  #crowd-app button:hover{border-color:#6b8b74;background:#edf2e9}#crowd-app button:disabled{opacity:.4;cursor:wait}#crowd-app button.active,#crowd-app .primary{background:var(--green);color:#fff;border-color:var(--green)}
  .cr-header{padding:14px 25px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:18px}.cr-title{font-size:20px;font-weight:650;letter-spacing:.04em}.cr-tag{font-size:11px;letter-spacing:.12em;color:var(--muted);margin-top:2px}.cr-badge{border:1px solid #bdcbbd;border-radius:30px;padding:5px 11px;font-size:12px;background:#e9efe5;white-space:nowrap}
  .cr-workspace{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 306px}.cr-stage{position:relative;min-width:0;min-height:0;overflow:hidden;background:#e8ebe3}.cr-stage canvas{width:100%!important;height:100%!important;display:block!important;outline:none;position:absolute!important;inset:0!important}
  .cr-topline{position:absolute;z-index:2;top:19px;left:23px;right:23px;display:flex;justify-content:space-between;gap:12px;pointer-events:none}.cr-caption{font-size:12px;color:#344b40;background:#f5f6efdd;padding:8px 12px;border:1px solid #d9e0d6;border-radius:9px}.cr-caption strong{font-size:13px}.cr-hint{position:absolute;bottom:18px;left:23px;font-size:12px;color:#516558;background:#f5f6efdf;padding:7px 11px;border-radius:6px;pointer-events:none}
  .cr-sidebar{background:#fafbf6;border-left:1px solid var(--line);padding:20px;overflow:auto}.cr-section{padding-bottom:20px;margin-bottom:18px;border-bottom:1px solid var(--line)}.cr-section:last-child{border:0;margin:0}.cr-label{font-size:11px;letter-spacing:.13em;color:var(--muted);font-weight:650;margin-bottom:9px}.cr-row{display:flex;gap:7px;margin:8px 0;align-items:center}.cr-row>*{flex:1}.cr-row label{display:flex;align-items:center;gap:8px}.cr-row input[type=checkbox]{accent-color:var(--green);width:16px;height:16px}.cr-row select{width:100%}.cr-note{font-size:12px;line-height:1.65;color:var(--muted);margin:8px 0 0}.cr-stats{display:grid;grid-template-columns:1fr 1fr;gap:9px}.cr-stat{background:#edf1e8;border:1px solid #dce3d7;border-radius:9px;padding:10px}.cr-stat b{display:block;font-size:23px;font-weight:550;line-height:1.2;font-variant-numeric:tabular-nums}.cr-stat span{font-size:11px;color:var(--muted)}
  #runtime-status{font-size:12px;line-height:1.7;min-height:39px;color:#435c4c;overflow-wrap:anywhere}.cr-progress{height:3px;background:#dce5d6;border-radius:3px;margin:10px 0;overflow:hidden}.cr-progress>i{display:block;height:100%;background:#446b4e;transition:width .2s;width:0}
  .cr-keys{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.cr-keys button{font-size:12px!important;padding:6px!important}.cr-detail{margin-top:10px;font-size:12px;color:var(--muted)}#runtime-evidence{display:none}#benchmark-result{white-space:pre-wrap;font:11px/1.5 ui-monospace,monospace;color:#405645;max-height:220px;overflow:auto}
  @media(max-width:800px){#crowd-app{grid-template-rows:60px 1fr}.cr-header{padding:10px 14px}.cr-title{font-size:17px}.cr-workspace{grid-template-columns:minmax(0,1fr) 248px}.cr-sidebar{padding:14px}.cr-topline{left:10px;right:10px}.cr-caption{font-size:10px;padding:6px}.cr-hint{left:10px;font-size:10px}}
  @media(max-width:570px){body{overflow:auto!important}#crowd-app{position:relative;min-height:100dvh;grid-template-rows:60px 1fr}.cr-workspace{display:flex;flex-direction:column}.cr-stage{height:58dvh;min-height:370px}.cr-sidebar{border-left:0;display:grid;grid-template-columns:1fr 1fr;gap:16px;overflow:visible}.cr-section{margin:0}.cr-badge{display:none}.cr-caption:last-child{display:none}}
  `;
  document.head.append(style);
  const app=document.createElement('div'); app.id='crowd-app';
  app.innerHTML=`<header class="cr-header"><div><div class="cr-title">完整人物 · 多人运行台</div><div class="cr-tag">BODY / HAIR / CLOTHING / FOOTWEAR · R01</div></div><span class="cr-badge" id="ready-badge">原生模块接入中</span></header>
  <main class="cr-workspace"><section class="cr-stage" id="crowd-stage" aria-label="完整人物三维场景"><div class="cr-topline"><div class="cr-caption"><strong id="scene-caption">2 位完整人物</strong><br>独立动作与物理状态</div><div class="cr-caption">P01 身体 · F13 头发<br>T03 上衣 / P02 裤装 · R14 鞋</div></div><div class="cr-hint">拖动旋转视角 · 滚轮缩放 · 右键平移</div></section>
  <aside class="cr-sidebar"><section class="cr-section"><div class="cr-label">同场人数</div><div class="cr-row" id="count-controls"><button data-count="1">1 人</button><button data-count="2" class="active">2 人</button><button data-count="4">4 人</button></div><div id="runtime-status">正在准备完整人物</div><div class="cr-progress"><i id="load-progress"></i></div></section>
  <section class="cr-section"><div class="cr-label">动作与物理</div><div class="cr-row"><select id="motion-select" aria-label="全体动作"><option value="walk">行走</option><option value="run">跑步</option><option value="jump">跳跃</option><option value="still">静止</option></select><select id="speed-select" aria-label="模拟速度"><option value="1">正常速度</option><option value="0.5">半速检查</option><option value="0.25">四分之一速</option></select></div><div class="cr-row"><button id="play-button" class="primary">开始运行</button><button id="step-button">单步</button></div><div class="cr-row"><button id="reset-button">重置动作</button><button id="home-button">全景视角</button></div><div class="cr-row"><label><input type="checkbox" id="hair-physics" checked>头发惯性</label><label><input type="checkbox" id="wind">微风</label></div><p class="cr-note">衣物随每步动作进行求解。鞋跟随真实脚骨。暂停后可近看贴合。</p></section>
  <section class="cr-section"><div class="cr-label">观察与移动</div><div class="cr-row"><select id="actor-select" aria-label="选择人物"><option value="1">人物 01</option></select><button id="focus-button">近看</button></div><div class="cr-keys"><button data-move="turn-left">左转</button><button data-move="forward">前移</button><button data-move="turn-right">右转</button><button data-move="left">左移</button><button data-move="back">后移</button><button data-move="right">右移</button></div><p class="cr-note">选中人物也可用 W A S D 移动，Q / E 转向。</p></section>
  <section class="cr-section"><div class="cr-label">实际运行测量</div><div class="cr-stats"><div class="cr-stat"><b id="fps-stat">—</b><span>运行提交帧 / 秒</span></div><div class="cr-stat"><b id="step-stat">—</b><span>单步用时 / ms</span></div><div class="cr-stat"><b id="time-stat">0.00</b><span>模拟经过 / 秒</span></div><div class="cr-stat"><b id="draw-stat">—</b><span>每帧提交次数</span></div></div><p class="cr-note" id="timing-note">等人物准备完成后开始测量。</p><div class="cr-row"><button id="benchmark-button">测量 60 步</button></div><pre id="benchmark-result"></pre></section>
  <section class="cr-section"><div class="cr-label">本轮范围</div><p class="cr-note">共享身体、头发和鞋的静态资源；每人保留独立姿态与物理。头发使用已发布的 F13 完整发丝版本。本页用于整合试验，穿着效果仍需你验收。</p><details class="cr-detail"><summary>读取运行记录</summary><button id="copy-button">复制测量记录</button></details></section></aside></main><pre id="runtime-evidence" aria-hidden="true"></pre>`;
  document.body.append(app); document.title='完整人物 · 多人运行台 R01';
  stage=$('crowd-stage'); stage.prepend(viewer.canvas); viewer.container=stage;
  for(const child of [...document.body.children])if(child!==app&&child.tagName!=='SCRIPT')child.style.display='none';
  resizeObserver=new ResizeObserver(resize); resizeObserver.observe(stage);
  viewer.orbit.removeEventListener('change',viewer.onOrbit);
  viewer.orbit.addEventListener('change',()=>{cameraDirty=true;if(!state.busy&&!pendingTick)renderScene();});
  bindControls(); updateHUD(true);
}

function resize(){if(!stage||state.renderFrozen)return;const box=stage.getBoundingClientRect();if(box.width<1||box.height<1)return;viewer.renderer.setSize(box.width,box.height,false);viewer.camera.aspect=box.width/box.height;viewer.camera.updateProjectionMatrix();cameraDirty=true;if(state.ready&&!state.busy&&!pendingTick)renderScene();}

function cameraHome(focus=false){
  const actor=actors.find(a=>a.id===state.selected)||actors[0];
  const target=focus&&actor?actor.worldRoot.position.clone().add(new THREE.Vector3(0,1.15,0)):new THREE.Vector3(0,.97,0);
  const halfFOV=Math.tan(viewer.camera.fov*Math.PI/360);
  const fitDistance=Math.max(2.04/(2*halfFOV),(Math.max(1,actors.length)-1)*1.22/(2*halfFOV*Math.max(.1,viewer.camera.aspect))+1.05/(2*halfFOV*Math.max(.1,viewer.camera.aspect)))*1.08;
  const distance=focus?2.5:fitDistance;
  viewer.camera.position.copy(target).add(new THREE.Vector3(distance*.12,distance*.11,distance));
  viewer.orbit.target.copy(target);viewer.camera.zoom=1;viewer.camera.updateProjectionMatrix();viewer.orbit.update();cameraDirty=true;
  if(!pendingTick)renderScene();
}

function renderScene(commit=false){
  if(rendering||!viewer||!actors.length||state.renderFrozen||(state.busy&&!commit))return;
  rendering=true;const started=performance.now();
  try{
    viewer.renderer.info.reset();
    for(const actor of actors){actor.prepareRender();actor.cloth?.renderUpdate(viewer.camera);}
    viewer.renderer.shadowMap.needsUpdate=true;
    viewer.render();
    lastRender=performance.now(); cameraDirty=false;
    state.lastSubmittedFrame={tick:state.tick,mode:state.mode,
      actorFrames:actors.map(actor=>({id:actor.id,body:actor.frameSequence,cloth:actor.cloth?.frame?.frameSequence})),
      renderSubmissionCompletedAt:lastRender};
  }finally{rendering=false;}
  return performance.now()-started;
}

async function addActor(index){
  showStatus('人物 '+(index+1)+'：准备原生身体与动作');
  const actor=await actorFactory.create({id:String(index+1),mode:'still',position:[(index-(state.count-1)/2)*1.22,0,0]});
  try{
    shoeFactory.bind(actor); actor.worldRoot.visible=false;
    actor.cloth=await createClothActor({THREE,renderer:viewer.renderer,actorPacket:actor.actorPacket,model:actor.model,
      parent:actor.worldRoot,actorID:actor.id,...window.__CROWD_CLOTH_OPTIONS__,
      onProgress:info=>{showStatus('人物 '+(index+1)+'：'+(info.phase||info.message||'正在适配'));if($('load-progress'))$('load-progress').style.width=(100*(index+(info.fraction||0))/state.count)+'%';},
      requestRender:()=>{cameraDirty=true;}});
    actor.cloth.group.matrixAutoUpdate=false;actor.cloth.group.matrix.copy(actor.baseMeshMatrix);
    actor.cloth.group.updateWorldMatrix(true,true);
    showStatus('人物 '+(index+1)+'：接入完整发丝和导向物理');await sleep(10);
    actor.hair=hairFactory.create(actor,{physics:state.hairPhysics,wind:state.wind});
    actor.hair.setColor(index%2?'brown':'black');
    actors.push(actor);actor.worldRoot.visible=true;
    return actor;
  }catch(error){actor.hair?.dispose();actor.cloth?.dispose();actor.dispose();throw error;}
}

function placements(){
  actors.forEach((actor,index)=>{actor.worldRoot.position.x=(index-(actors.length-1)/2)*1.22;actor.worldRoot.position.z=0;actor.worldRoot.rotation.y=0;actor.worldRoot.updateWorldMatrix(true,true);actor.shoes.update();actor.hair?.reset();});
}

async function changeCount(count,{rebuild=false}={}){
  if(state.busy||(state.renderFrozen&&!rebuild))return;
  // Acquire the UI transition lock before waiting for an in-flight frame.
  state.playing=false;state.busy=true;updateHUD(true);
  if(pendingTick)await pendingTick.catch(()=>{});
  if(state.renderFrozen&&!rebuild){state.busy=false;updateHUD(true);return;}
  state.busy=true;state.count=count;state.ready=false;updateHUD(true);
  try{
    if(rebuild)while(actors.length){const actor=actors.pop();actor.hair.dispose();actor.cloth.dispose();actor.dispose();}
    while(actors.length>count){const actor=actors.pop();actor.hair.dispose();actor.cloth.dispose();actor.dispose();}
    while(actors.length<count)await addActor(actors.length);
    placements();await setAction(state.mode,true);
    state.selected=actors.some(a=>a.id===state.selected)?state.selected:'1';
    $('actor-select').innerHTML=actors.map(a=>`<option value="${a.id}">人物 ${a.id.padStart(2,'0')}</option>`).join('');
    $('actor-select').value=state.selected;
    state.ready=true;state.busy=false;state.renderFrozen=false;state.samples=[];state.simulationSeconds=0;
    showStatus(count+' 位完整人物已就绪');$('load-progress').style.width='100%';cameraHome();updateHUD(true);writeEvidence();
  }catch(error){fail(error);}
}

async function setAction(mode,initial=false){
  state.mode=mode;
  for(let index=0;index<actors.length;index++){
    const actor=actors[index];
    await actor.setMotion(mode,{phaseSeconds:index*.23});
    actor.timeSeconds=0;
    // Keep the original fitted state; reset its time and mutable dynamics before
    // asking the original solver to accept the exact new selected pose.
    await actor.cloth.reset();
  }
  const tick=++state.tick,dt=1/60;
  await settleCloth(actors.map(actor=>actor.cloth.update({dt,skinMatrices:actor.finalSkinMatrices,
    frameSequence:tick,timeSeconds:actor.timeSeconds})),{kind:'selected-pose-initialization',tick,dt,mode});
  for(const actor of actors){actor.publishPose(tick);actor.hair?.reset();actor.hair?.update(0,tick);actor.cloth.pause();}
  state.poseSynchronizations.push({tick,mode,dt,actors:actors.length,bodyAdvanceCalls:0,
    clothStepsPerActor:1,hairDynamicSteps:0,allFinalPosesAccepted:true,countsAsMeasuredStep:false});
  state.simulationSeconds=0;
}

async function settleCloth(promises,context,earlyError=null){
  // A rejected worker must not leave other actors' jobs running into Reset.
  const results=await Promise.allSettled(promises),bad=results.find(row=>row.status==='rejected');
  if(earlyError||bad){
    const error=earlyError||bad.reason;
    error.frameTransaction={...context,allWorkerResponsesSettled:true,
      actors:results.map((row,i)=>({id:actors[i]?.id,status:row.status,
        message:row.status==='rejected'?row.reason?.message:undefined})),
      published:false,recovery:'freeze rendering/movement until complete rebuild'};
    throw error;
  }
  return results;
}

async function step(){
  if(!state.ready||state.busy||pendingTick||state.renderFrozen)return;
  const task=(async()=>{
    const started=performance.now(),dt=state.speed/60,tick=++state.tick;
    let bodyMS=0,hairMS=0;
    for(const actor of actors){let t=performance.now();actor.advance(dt,tick);bodyMS+=performance.now()-t;}
    const clothStarted=performance.now();
    const clothPromises=actors.map(actor=>actor.cloth.update({dt,skinMatrices:actor.finalSkinMatrices,frameSequence:tick,timeSeconds:actor.timeSeconds}));
    let hairError=null;
    try{for(const actor of actors){let t=performance.now();actor.hair.update(dt,tick);hairMS+=performance.now()-t;}}
    catch(error){hairError=error;}
    await settleCloth(clothPromises,{kind:'simulation-step',tick,dt},hairError);
    const clothWaitMS=performance.now()-clothStarted;
    state.simulationSeconds+=dt;const renderMS=renderScene(true);
    const end=performance.now();
    const sample={tick,actors:actors.length,dt,bodyMS,hairMS,clothWaitMS,renderSubmitMS:renderMS,stepWallMS:end-started,
      submissionCompletedAt:end,drawCalls:viewer.renderer.info.render.calls,triangles:viewer.renderer.info.render.triangles,
      fullHair:state.hairPhysics,speed:state.speed};
    state.samples.push(sample);if(state.samples.length>1200)state.samples.shift();
    if(benchmark){benchmark.samples.push(sample);if(benchmark.samples.length>=benchmark.steps)finishBenchmark();}
    updateHUD();
    if(state.tick%10===0)writeEvidence();
  })();
  pendingTick=task;
  try{await task;}finally{pendingTick=null;}
}

async function pump(){
  if(state.playing&&!state.busy){
    const started=performance.now();
    try{await step();}catch(error){fail(error);}
    pumpTimer=setTimeout(pump,Math.max(0,1000/60-(performance.now()-started)));
  }else pumpTimer=setTimeout(pump,50);
}

function metric(samples){
  if(!samples.length)return null;
  const mean=key=>samples.reduce((sum,s)=>sum+s[key],0)/samples.length;
  const elapsed=samples.length>1?samples.at(-1).submissionCompletedAt-samples[0].submissionCompletedAt:NaN;
  const sorted=samples.map(s=>s.stepWallMS).sort((a,b)=>a-b);
  return{sampleCount:samples.length,actors:samples.at(-1).actors,stepMeanMS:mean('stepWallMS'),stepP95MS:sorted[Math.floor((sorted.length-1)*.95)],
    bodyMeanMS:mean('bodyMS'),hairMeanMS:mean('hairMS'),clothWallMeanMS:mean('clothWaitMS'),renderSubmitMeanMS:mean('renderSubmitMS'),
    submittedFrameFPS:(samples.length-1)*1000/elapsed,simulationPerWallSecond:(samples.length-1)*samples.at(-1).dt*1000/elapsed,
    frameRateBasis:'JS unified update and render-submission completion intervals; not measured GPU completion or display presentation',
    drawCalls:mean('drawCalls'),triangles:mean('triangles')};
}

function updateHUD(force=false){
  const now=performance.now();if(!force&&now-lastHUD<500)return;lastHUD=now;
  if(!$('fps-stat'))return;
  const m=metric(state.samples.slice(-60));
  $('fps-stat').textContent=state.playing&&m?number(m.submittedFrameFPS):m?number(m.submittedFrameFPS)+'*':'—';
  $('step-stat').textContent=m?number(m.stepMeanMS):'—';$('time-stat').textContent=number(state.simulationSeconds,2);
  $('draw-stat').textContent=m?String(Math.round(m.drawCalls)):'—';
  $('timing-note').textContent=m?'模拟 / 实际时间：'+number(m.simulationPerWallSecond,2)+'×。包含原生多遍提交；此为运行提交速率，不是GPU完成或屏幕呈现测量。':'准备完成后可逐步或连续运行。';
  $('scene-caption').textContent=state.count+' 位完整人物';
  $('ready-badge').textContent=state.renderFrozen?'冻结 · 需要重置':state.busy?'原生模块接入中':state.playing?'正在运行':'可交互 · 已暂停';
  $('play-button').textContent=state.playing?'暂停运行':'开始运行';
  for(const node of document.querySelectorAll('#crowd-app button,#crowd-app select,#crowd-app input')){
    node.disabled=state.busy||!state.ready||state.renderFrozen;
  }
  if(state.renderFrozen&&!state.busy&&actorFactory&&hairFactory&&shoeFactory)$('reset-button').disabled=false;
  if(!state.busy)$('copy-button').disabled=false;
  for(const node of document.querySelectorAll('[data-count]'))node.classList.toggle('active',Number(node.dataset.count)===state.count);
}

function writeEvidence(){
  if(!$('runtime-evidence'))return;
  let gl=null;try{gl=viewer.renderer.getContext();}catch{}
  const debug=gl?.getExtension('WEBGL_debug_renderer_info');
  const report={version:state.version,ready:state.ready,busy:state.busy,playing:state.playing,phase:state.phase,tick:state.tick,count:actors.length,
    simulationSeconds:state.simulationSeconds,mode:state.mode,hairPhysics:state.hairPhysics,errors:state.errors,interventions:state.interventions,
    renderFrozen:state.renderFrozen,lastSubmittedFrame:state.lastSubmittedFrame,poseSynchronizations:state.poseSynchronizations,
    gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,viewport:viewer?[viewer.canvas.width,viewer.canvas.height]:null,
    latestMetrics:metric(state.samples.slice(-60)),latestSamples:state.samples.slice(-70),benchmark:state.lastBenchmark||null,
    body:actors.map(actor=>actor.report()),hair:hairFactory?.report(),shoes:shoeFactory?.report(),faceRouting:faceRouting?.audit(),
    cloth:actors.map(actor=>({id:actor.id,...actor.cloth.audit()})),
    finitePose:actors.every(actor=>finite(actor.finalSkinMatrixData)),
    oneVisibleCanvas:document.querySelectorAll('#crowd-stage canvas').length===1,
    sourceStatus:{visualAcceptance:'pending user review',hair:'F13 older published dense candidate',footwearForceSolver:false,crossNPCPhysicalCollision:false},
  };
  $('runtime-evidence').textContent=JSON.stringify(report);return report;
}

function finishBenchmark(){
  const run=benchmark;benchmark=null;state.playing=false;
  state.lastBenchmark={startedAt:run.startedAt,finishedAt:new Date().toISOString(),metrics:metric(run.samples),samples:run.samples};
  const m=state.lastBenchmark.metrics;
  $('benchmark-result').textContent=`${m.actors} 人 / ${m.sampleCount} 步\n运行提交 ${number(m.submittedFrameFPS)} 帧/秒\n单步平均 ${number(m.stepMeanMS)} ms\n单步 P95 ${number(m.stepP95MS)} ms\n模拟 / 实际 ${number(m.simulationPerWallSecond,2)}×`;
  showStatus('60 步测量完成，已暂停');updateHUD(true);writeEvidence();
}

function moveActor(direction){
  if(state.busy||pendingTick||state.renderFrozen)return;
  const actor=actors.find(a=>a.id===state.selected);if(!actor)return;
  if(direction==='turn-left'||direction==='turn-right')actor.worldRoot.rotation.y+=(direction==='turn-left'?1:-1)*Math.PI/18;
  else {const deltas={forward:[0,0,-.1],back:[0,0,.1],left:[-.1,0,0],right:[.1,0,0]};actor.worldRoot.position.add(new THREE.Vector3(...deltas[direction]));}
  actor.worldRoot.updateWorldMatrix(true,true);actor.shoes.update();actor.hair.reset();
  state.interventions.push({tick:state.tick,actor:actor.id,direction});renderScene();writeEvidence();
}

function bindControls(){
  document.querySelectorAll('[data-count]').forEach(button=>button.onclick=()=>changeCount(Number(button.dataset.count)));
  $('play-button').onclick=()=>{if(state.renderFrozen||state.busy)return;state.playing=!state.playing;if(!state.playing)for(const actor of actors)actor.cloth.pause();updateHUD(true);writeEvidence();};
  $('step-button').onclick=()=>{state.playing=false;step().catch(fail);updateHUD(true);};
  $('reset-button').onclick=async()=>{if(state.busy)return;if(state.renderFrozen){await changeCount(state.count,{rebuild:true});return;}state.playing=false;state.busy=true;updateHUD(true);if(pendingTick)await pendingTick.catch(()=>{});if(state.renderFrozen){state.busy=false;await changeCount(state.count,{rebuild:true});return;}state.busy=true;try{await setAction(state.mode);state.simulationSeconds=0;state.samples=[];state.busy=false;renderScene();showStatus('完整动作与衣物已同步重置');updateHUD(true);writeEvidence();}catch(error){fail(error);}};
  $('motion-select').onchange=async event=>{if(state.busy||state.renderFrozen)return;const mode=event.target.value;state.playing=false;state.busy=true;updateHUD(true);if(pendingTick)await pendingTick.catch(()=>{});if(state.renderFrozen){state.busy=false;updateHUD(true);return;}state.busy=true;try{await setAction(mode);state.samples=[];state.busy=false;renderScene();showStatus('身体与衣物已同步切换，点击开始运行');updateHUD(true);writeEvidence();}catch(error){fail(error);}};
  $('speed-select').onchange=event=>{state.speed=Number(event.target.value);state.samples=[];writeEvidence();};
  $('hair-physics').onchange=event=>{state.hairPhysics=event.target.checked;actors.forEach(actor=>actor.hair.setPhysics(state.hairPhysics));renderScene();writeEvidence();};
  $('wind').onchange=event=>{state.wind=event.target.checked;actors.forEach(actor=>actor.hair.setWind(state.wind));writeEvidence();};
  $('actor-select').onchange=event=>{state.selected=event.target.value;};
  $('home-button').onclick=()=>cameraHome();$('focus-button').onclick=()=>cameraHome(true);
  document.querySelectorAll('[data-move]').forEach(button=>button.onclick=()=>moveActor(button.dataset.move));
  window.addEventListener('keydown',event=>{if(event.target?.matches('input,select,textarea'))return;const direction={w:'forward',s:'back',a:'left',d:'right',q:'turn-left',e:'turn-right'}[event.key.toLowerCase()];if(direction){event.preventDefault();moveActor(direction);}});
  $('benchmark-button').onclick=()=>{if(state.renderFrozen||state.busy)return;benchmark={steps:60,samples:[],startedAt:new Date().toISOString()};state.samples=[];state.playing=true;$('benchmark-result').textContent='正在记录 60 个实际步骤…';showStatus('正在测量全部原生模块');updateHUD(true);};
  $('copy-button').onclick=async()=>{const report=writeEvidence();try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));showStatus('运行记录已复制');}catch{showStatus('复制未成功，可展开浏览器中的运行记录。');}};
}

async function boot(){
  while(!window.hairF13?.report().ready){if(window.hairF13?.report().errors?.length)throw Error(window.hairF13.report().errors.join('\n'));await sleep(100);}
  window.hairF13.setManual(true);window.hairF13.pause(true);window.lifelikeIdle?.pause(true);
  raw=window.hairF13._raw();viewer=raw.viewer;
  if(THREE.Mesh!==raw.THREE.Mesh)throw Error('Shared Three module identity mismatch');
  const nativeViewerRender=viewer.render.bind(viewer);
  viewer.render=(...args)=>{
    // Includes direct renders requested by old model/skin/resize handlers.
    // They cannot expose a partially accepted scene or resume a failed frame.
    if(state.renderFrozen||(!rendering&&(state.busy||pendingTick||!state.ready)))return;
    return nativeViewerRender(...args);
  };
  viewer.renderer.info.autoReset=false;
  installUI();resize();
  actorFactory=await createNativeActorFactory({THREE,raw,onProgress:info=>showStatus('人物 '+info.id+'：'+info.message)});
  hairFactory=createHairFactory({THREE,template:raw.fibers,PhotoDynamics:raw.PhotoDynamics,renderViewer:viewer});
  faceRouting=installFacePassRouting(viewer,{getMeshes:()=>actors.map(actor=>actor.mesh)});
  shoeFactory=await createNativeShoeFactory({THREE,renderer:viewer.renderer,buildStyle,StyleMaterials,scanData,styles:STYLES,onProgress:showStatus});
  // Remove the old editor's donor objects from the scene, preserving the source
  // mesh's visibility flag and the original skin optical render pipeline.
  actorFactory.detachSource();
  raw.fibers.source.visible=false;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(20,16),new THREE.MeshStandardMaterial({color:'#dde3d6',roughness:.96}));
  ground.name='crowd-stage-ground';ground.rotation.x=-Math.PI/2;ground.position.y=-.003;ground.receiveShadow=true;viewer.scene.add(ground);
  viewer.renderer.setClearColor('#e8ece4');
  state.busy=false;await changeCount(2);pump();
  window.addEventListener('pagehide',()=>{clearTimeout(pumpTimer);resizeObserver?.disconnect();faceRouting?.dispose();for(const actor of actors){actor.hair.dispose();actor.cloth.dispose();}shoeFactory.dispose();actorFactory.dispose();hairFactory.dispose();});
}

boot().catch(error=>{
  fail(error);
  if(!$('runtime-status')){const el=document.createElement('pre');el.style.cssText='position:fixed;inset:16px;z-index:2147483000;background:#fff;padding:20px;overflow:auto;color:#713d34';el.textContent='完整人物接入未完成：'+(error.stack||error);document.body.append(el);}
});
