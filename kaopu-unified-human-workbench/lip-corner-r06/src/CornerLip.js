/* R06 native comparison controls and complete-person archive integration. */
(function(){
'use strict';
const VERSION='LIP-CORNER-R06',SCHEMA='kaopu/lip-corner@1';
const status=window.__LIP_CORNER__={version:VERSION,ready:false,errors:[],source:window.__LIP_CORNER_SOURCE__||null};
function boot(){
 const prior=window.motionLip,solver=window.__LIP_CORNER_SOLVER__,v=window.__IDENTITY_QA__?.viewer?.(),model=window.__IDENTITY_QA__?.model?.(),controller=window.__IDENTITY_QA__?.controller?.();
 if(!prior?.ready||!solver||!v?.startupFinalFrame)return false;
 if(prior.version!=='LIP-MOTION-R05')throw Error('嘴唇 R06 需要固定的 R05 人物');
 const shell=document.querySelector('#control-shell'),oldPanel=document.querySelector('#lm-controls');
 if(!shell||!oldPanel)throw Error('原人物工作台界面缺失');
 let comparison='r06',lastView='oblique';
 const nativeCompare=prior.compare.bind(prior),nativePose=prior.pose.bind(prior),nativeView=prior.view.bind(prior);
 function batch(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render;let calls=0;try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){calls++;}});return fn();}finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;if(v.render!==old)throw Error('原人物渲染方法未恢复');status.lastBatch={label,suppressedCalls:calls,renderRestored:true};}}
 async function batchAsync(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render;let calls=0;Object.defineProperty(v,'render',{configurable:true,writable:true,value(){calls++;}});try{return await fn();}finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;if(v.render!==old)throw Error('原人物渲染方法未恢复');status.lastBatch={label,suppressedCalls:calls,renderRestored:true};}}
 function heldView(fn){
  const camera={position:v.camera.position.clone(),quaternion:v.camera.quaternion.clone(),target:v.orbit.target.clone()},center=v.cineRig.center.clone(),exposure=v.renderer.toneMappingExposure,lights=[];
  v.scene.traverse(o=>{if(o.isLight)lights.push({o,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),color:o.color.clone(),intensity:o.intensity,visible:o.visible,ground:o.groundColor?.clone(),target:o.target?{position:o.target.position.clone(),quaternion:o.target.quaternion.clone(),scale:o.target.scale.clone()}:null});});
  try{return fn();}finally{v.camera.position.copy(camera.position);v.camera.quaternion.copy(camera.quaternion);v.orbit.target.copy(camera.target);v.camera.updateMatrixWorld(true);v.cineRig.center.copy(center);v.renderer.toneMappingExposure=exposure;
   for(const s of lights){const o=s.o;o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.color.copy(s.color);o.intensity=s.intensity;o.visible=s.visible;if(s.ground)o.groundColor.copy(s.ground);if(s.target){o.target.position.copy(s.target.position);o.target.quaternion.copy(s.target.quaternion);o.target.scale.copy(s.target.scale);o.target.updateMatrixWorld(true);}}v.scene.updateMatrixWorld(true);}
 }
 function isR05(){const r=prior.report();return r.comparison==='r05'&&r.solver.valid&&r.solver.enabled&&window.innerLip.report().comparison==='r04'&&window.innerLip.report().diagnostic===0;}
 function detach(){if(solver.report().installed)solver.uninstall();}
 function ensure(){
  if(!solver.report().installed||!solver.report().valid||!isR05()){
   detach();nativeCompare('r05');solver.install(v,model);
  }
 }
 const panel=document.createElement('section');panel.id='lc-controls';
 panel.innerHTML='<h2>嘴唇口角 <small>R06 · 同一人物</small></h2>'+
  '<p>对照口角与邻接皮肤的过渡。两版使用同一人物、动作、镜头和灯光。</p>'+
  '<div class="lc-row"><button data-lc-compare="r06">本次修复 R06</button><button data-lc-compare="r05">修复前 R05</button></div>'+
  '<label class="lc-caption">动作</label><div class="lc-row"><button data-lc-pose="neutral">自然闭口</button><button data-lc-pose="jaw">张口检查</button><button data-lc-pose="speak">说话姿态</button><button data-lc-pose="pucker">噘嘴</button></div>'+
  '<label class="lc-progress">动作进度 <output id="lc-progress-label">100%</output><input id="lc-progress" type="range" min="0" max="100" step="1" value="100"></label>'+
  '<label class="lc-caption">视角</label><div class="lc-row"><button data-lc-view="macro">嘴部正面</button><button data-lc-view="oblique">嘴部斜侧</button><button data-lc-view="front">整脸正面</button><button data-lc-view="bust">头颈同框</button></div>'+
  '<div class="lc-row"><button data-lc-action="save">保存完整人物</button><button data-lc-action="load">载入人物档案</button><input id="lc-file" type="file" accept="application/json,.json" hidden></div>'+
  '<p id="lc-status" role="status"></p><details><summary>本次修改的范围</summary><p>本轮针对噘嘴口角的动作衔接。保留 R05 的说话内缘修复。薄唇缘、外唇材质和口腔细节仍需后续审核。</p></details>';
 shell.prepend(panel);oldPanel.hidden=true;
 const style=document.createElement('style');style.textContent='#lc-controls{padding:18px;color:#eee9df;background:#16262b;font:13px/1.55 system-ui;flex-shrink:0}#lc-controls h2{font-size:21px;line-height:1.2;margin:0 0 10px}#lc-controls h2 small{display:inline-block;font-size:12px;font-weight:400;color:#bbd4ce}#lc-controls p{font-size:12px;color:#c0cdcc;margin:8px 0 12px}.lc-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:7px 0 12px}.lc-row button{min-height:36px;font-size:12px}.lc-row button[aria-pressed="true"]{border-color:#d6c293;background:#354943;color:#fff2d7}.lc-caption{display:block;font-size:11px;color:#b7c8c8;margin-top:12px}.lc-progress{display:block;font-size:12px;margin:12px 0}.lc-progress output{float:right;font-variant-numeric:tabular-nums}.lc-progress input{display:block;width:100%;margin:10px 0}#lc-status{border-top:1px solid #466064;padding-top:10px}#lc-controls details{font-size:12px}#lm-controls[hidden]{display:none!important}@media(max-width:900px){#lc-controls{padding:13px}#lc-controls h2{font-size:18px}}';document.head.append(style);
 function sync(){
  const r=prior.report(),matched=isR05(),s=solver.report();
  // report() may invalidate the solver before sync sees it; the previous
  // comparison still identifies an evaluated R06 field that needs clearing.
  if((comparison==='r06'&&(!s.enabled||!s.valid||!matched))||(s.enabled&&!matched)){
   batch('disable corner correction outside matched R05 state',()=>{solver.setEnabled(false);v.update();});
   comparison=matched?'r05':'inherited';v.render();
  }
  if(comparison==='r06'&&(!s.enabled||!s.valid||!isR05()))comparison=isR05()?'r05':'inherited';
  if(comparison==='r05'&&!isR05())comparison='inherited';
  for(const b of panel.querySelectorAll('[data-lc-compare]'))b.setAttribute('aria-pressed',String(b.dataset.lcCompare===comparison));
  for(const b of panel.querySelectorAll('[data-lc-pose]'))b.setAttribute('aria-pressed',String(b.dataset.lcPose===r.poseName));
  for(const b of panel.querySelectorAll('[data-lc-view]'))b.setAttribute('aria-pressed',String(b.dataset.lcView===lastView));
  const custom=r.poseName==='custom';panel.querySelector('#lc-progress').disabled=custom;panel.querySelector('#lc-progress').value=Math.round(r.progress*100);panel.querySelector('#lc-progress-label').textContent=custom?'自定义':Math.round(r.progress*100)+'%';
  const name={neutral:'自然闭口',jaw:'张口检查',speak:'说话姿态',pucker:'噘嘴',custom:'自定义动作'}[r.poseName];
  panel.querySelector('#lc-status').textContent=({r06:'本次修复 R06',r05:'修复前 R05',inherited:'载入的历史人物／自定义参数'})[comparison]+' · '+name+(custom?'':' · '+Math.round(r.progress*100)+'%');
 }
 function report(){const r=prior.report();return{version:VERSION,schema:SCHEMA,ready:status.ready,source:status.source,comparison,view:lastView,poseName:r.poseName,progress:r.progress,pose:window.lipWorkbench.pose(),implementation:solver.version,solver:solver.report(),motionComparison:r.comparison,motionSolver:r.solver,innerComparison:r.innerComparison,canonicalGeometryChanged:false,nativeEvaluatedGeometryChanged:comparison==='r06',newMeshes:0,newImageMaps:0,lightingChangedByModule:false,visualAcceptance:false,productionReady:false};}
 function render(){sync();v.render();return report();}
 function compare(mode){if(!['r06','r05'].includes(mode))throw Error('无效嘴唇对照版本');batch('matched R06/R05 version switch',()=>heldView(()=>{ensure();solver.setEnabled(mode==='r06');comparison=mode;v.update();}));return render();}
 function pose(name,amount=1){nativePose(name,amount);sync();return report();}
 function view(kind){nativeView(kind);lastView=kind;sync();return report();}
 const priorArchive=controller.archive.bind(controller),priorRestore=controller.restore.bind(controller);
 function archive(){sync();if(comparison==='r06'&&!isR05())throw Error('先回到 R06 对照后再保存本次修复');return{...priorArchive(),lipCorner:{schema:SCHEMA,version:VERSION,implementation:solver.version,comparison}};}
 async function restore(a){
  if(!a||typeof a!=='object'||Array.isArray(a))throw Error('人物档案格式无效');
  const has=Object.prototype.hasOwnProperty.call(a,'lipCorner'),own=has?a.lipCorner:undefined;
  if(has&&(!own||typeof own!=='object'||Array.isArray(own)||own.schema!==SCHEMA||own.version!==VERSION||own.implementation!==solver.version||!['r06','r05','inherited'].includes(own.comparison)))throw Error('此口角档案不属于当前实现，人物尚未更改');
  if(own&&own.comparison!=='inherited'&&(a.lipMotion?.schema!=='kaopu/lip-motion@1'||a.lipMotion?.version!=='LIP-MOTION-R05'||a.lipMotion?.comparison!=='r05'||a.innerLip?.schema!=='kaopu/lip-inner@1'||a.innerLip?.comparison!=='r04'||a.lipRealism?.colourReview?.comparison!=='r02'))throw Error('R06 对照档案需要配套的 R05 人物状态，人物尚未更改');
  const copy=structuredClone(a);delete copy.lipCorner;
  await batchAsync('restore complete native person and rebuild corner binding',async()=>{
   const wasEnabled=solver.report().enabled;detach();
   try{await priorRestore(copy);}catch(err){if(isR05()){solver.install(v,model);solver.setEnabled(wasEnabled);}throw err;}
   if(isR05()){solver.install(v,model);comparison=own?own.comparison:'r05';solver.setEnabled(comparison==='r06');}
   else comparison='inherited';
   v.update();
  });
  return render();
 }
 controller.archive=archive;controller.restore=restore;
 const currentArchive=()=>controller.archive(),currentRestore=a=>controller.restore(a);
 for(const api of [window.fullCommonWorkbench,window.headProceduralSkin,window.bodyProceduralSkin,window.lipRealism,window.innerLip,prior]){api.archive=currentArchive;api.restore=currentRestore;}
 function save(){const url=URL.createObjectURL(new Blob([JSON.stringify(currentArchive(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='lip-corner-r06-person.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 window.bodyProceduralSkin.save=save;prior.save=save;
 function error(err){const message=String(err);panel.querySelector('#lc-status').textContent=message;status.errors.push(message);}
 async function loadFile(input){const file=input?.files?.[0];if(!file)return;try{await currentRestore(JSON.parse(await file.text()));}catch(err){error(err);}finally{input.value='';}}
 for(const selector of ['#lc-file','#lm-file','#li-file','#lr-file','#ps-file']){const input=document.querySelector(selector);if(input)input.onchange=e=>loadFile(e.target);}
 // Window capture precedes the inherited document-level save handlers.
 window.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;const saving=b.matches('#lm-controls [data-lm-action="save"],#li-controls [data-li-action="save"],#lr-controls [data-lr-action="save"],#ps-controls [data-ps-action="save"],#ps-controls [data-fb-action="save"]'),loading=b.matches('#lm-controls [data-lm-action="load"],#li-controls [data-li-action="load"],#lr-controls [data-lr-action="load"],#ps-controls [data-ps-action="load"]');if(!saving&&!loading)return;e.preventDefault();e.stopImmediatePropagation();try{if(saving)save();else panel.querySelector('#lc-file').click();}catch(err){error(err);}},true);
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.lcCompare)compare(b.dataset.lcCompare);if(b.dataset.lcPose)pose(b.dataset.lcPose);if(b.dataset.lcView)view(b.dataset.lcView);if(b.dataset.lcAction==='save')save();if(b.dataset.lcAction==='load')panel.querySelector('#lc-file').click();}catch(err){error(err);}});
 panel.querySelector('#lc-progress').oninput=e=>{try{const r=prior.report();if(r.poseName==='custom'){sync();return;}pose(r.poseName,Number(e.target.value)/100);}catch(err){error(err);}};
 shell.addEventListener('change',e=>{if(!panel.contains(e.target))queueMicrotask(sync);});
 shell.addEventListener('click',e=>{if(!panel.contains(e.target))queueMicrotask(sync);});
 window.cornerLip={version:VERSION,get ready(){return status.ready;},compare,pose,view,report,archive:currentArchive,restore:currentRestore,save};
 document.title='KAOPU · 嘴唇口角 R06';document.querySelector('header strong').textContent='人物总台 · 嘴唇 R06';document.documentElement.dataset.lipCorner=VERSION;document.documentElement.dataset.lipCornerSource=status.source?.sourceCommit||'local';
 batch('R06 native binding and startup',()=>{window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();nativeCompare('r05');solver.install(v,model);solver.setEnabled(true);pose('pucker');view('oblique');});
 render();status.ready=true;return true;
}
const start=performance.now(),timer=setInterval(()=>{try{if(boot()){clearInterval(timer);return;}if(performance.now()-start>300000){clearInterval(timer);status.errors.push('原人物尚未就绪，R06 未启用');}}catch(err){clearInterval(timer);status.errors.push(String(err));console.error('LIP_CORNER_INIT',err);}},120);
addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
