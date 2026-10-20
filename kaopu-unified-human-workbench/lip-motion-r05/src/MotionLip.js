/* Native R05 workbench controls, matched version switches and full-person archives. */
(function(){
'use strict';
const VERSION='LIP-MOTION-R05',SCHEMA='kaopu/lip-motion@1';
const status=window.__LIP_MOTION__={version:VERSION,ready:false,errors:[],source:window.__LIP_MOTION_SOURCE__||null};
function boot(){
 const inner=window.innerLip,base=window.lipRealism,skin=window.headProceduralSkin,body=window.bodyProceduralSkin;
 const v=window.__IDENTITY_QA__?.viewer?.(),model=window.__IDENTITY_QA__?.model?.(),controller=window.__IDENTITY_QA__?.controller?.(),solver=window.__LIP_MOTION_SOLVER__;
 if(!inner?.ready||!v?.startupFinalFrame||!solver)return false;
 if(inner.version!=='LIP-INNER-R04')throw Error('嘴唇 R05 需要固定的 R04 人物');
 const shell=document.querySelector('#control-shell'),oldPanel=document.querySelector('#li-controls');
 if(!shell||!oldPanel)throw Error('原人物工作台界面缺失');
 const poseTemplate=structuredClone(window.lipWorkbench.pose());
 let comparison='r05',selectedPose='speak',progress=1,lastView='macro';
 function desired(name,amount=1){
  if(!Number.isFinite(amount)||amount<0||amount>1)throw Error('动作进度需在 0 到 1 之间');
  const p={...poseTemplate};for(const k of Object.keys(p))if(k!=='schema')p[k]=0;
  if(name==='jaw')p.jawOpen=.36;
  else if(name==='speak')Object.assign(p,{jawOpen:.36,upperRaise:.2,lowerDepress:.12});
  else if(name==='pucker')Object.assign(p,{jawOpen:.06,pucker:.82,seal:.24});
  else if(name!=='neutral')throw Error('无效嘴唇动作');
  for(const k of Object.keys(p))if(k!=='schema')p[k]*=amount;
  return p;
 }
 function poseName(){const p=window.lipWorkbench.pose();return Object.entries(desired(selectedPose,progress)).every(([k,x])=>p[k]===x)?selectedPose:'custom';}
 function batch(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render;let calls=0;try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){calls++;}});return fn();}finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;if(v.render!==old)throw Error('原人物渲染方法未恢复');status.lastBatch={label,suppressedCalls:calls,renderRestored:true};}}
 function batchAsync(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render;let calls=0;Object.defineProperty(v,'render',{configurable:true,writable:true,value(){calls++;}});return Promise.resolve().then(fn).finally(()=>{if(d)Object.defineProperty(v,'render',d);else delete v.render;if(v.render!==old)throw Error('原人物渲染方法未恢复');status.lastBatch={label,suppressedCalls:calls,renderRestored:true};});}
 function heldView(fn){
  const camera={position:v.camera.position.clone(),quaternion:v.camera.quaternion.clone(),target:v.orbit.target.clone()},center=v.cineRig.center.clone(),exposure=v.renderer.toneMappingExposure,lights=[];
  v.scene.traverse(o=>{if(o.isLight)lights.push({o,position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),color:o.color.clone(),intensity:o.intensity,visible:o.visible,ground:o.groundColor?.clone(),target:o.target?{position:o.target.position.clone(),quaternion:o.target.quaternion.clone(),scale:o.target.scale.clone()}:null});});
  try{return fn();}finally{
   v.camera.position.copy(camera.position);v.camera.quaternion.copy(camera.quaternion);v.orbit.target.copy(camera.target);v.camera.updateMatrixWorld(true);v.cineRig.center.copy(center);v.renderer.toneMappingExposure=exposure;
   for(const s of lights){const o=s.o;o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.color.copy(s.color);o.intensity=s.intensity;o.visible=s.visible;if(s.ground)o.groundColor.copy(s.ground);if(s.target){o.target.position.copy(s.target.position);o.target.quaternion.copy(s.target.quaternion);o.target.scale.copy(s.target.scale);o.target.updateMatrixWorld(true);}}
   v.scene.updateMatrixWorld(true);
  }
 }
 const panel=document.createElement('section');panel.id='lm-controls';
 panel.innerHTML='<h2>嘴唇动作修复 <small>R05 · 同一人物</small></h2>'+
  '<p>先看说话时的上唇内缘，再切换前后版本。动作、镜头和灯光保持一致。</p>'+
  '<div class="lm-row"><button data-lm-compare="r05">本次修复 R05</button><button data-lm-compare="r04">修复前 R04</button></div>'+
  '<label class="lm-caption">动作</label><div class="lm-row"><button data-lm-pose="neutral">自然闭口</button><button data-lm-pose="jaw">张口检查</button><button data-lm-pose="speak">说话姿态</button><button data-lm-pose="pucker">噘嘴</button></div>'+
  '<label class="lm-progress">动作进度 <output id="lm-progress-label">100%</output><input id="lm-progress" type="range" min="0" max="100" step="1" value="100"></label>'+
  '<label class="lm-caption">视角</label><div class="lm-row"><button data-lm-view="macro">嘴部正面</button><button data-lm-view="oblique">嘴部斜侧</button><button data-lm-view="front">整脸正面</button><button data-lm-view="bust">头颈同框</button></div>'+
  '<div class="lm-row"><button data-lm-action="save">保存完整人物</button><button data-lm-action="load">载入人物档案</button><input id="lm-file" type="file" accept="application/json,.json" hidden></div>'+
  '<p id="lm-status" role="status"></p><details><summary>本次修改的范围</summary><p>修正上唇内侧相连表面跟随错误方向的问题，保留原有抬唇和下压动作。用进度滑块检查中间形态。外唇材质与口腔细节仍需后续审核。</p></details>';
 shell.prepend(panel);
 const fold=document.createElement('details');fold.id='lm-inherited';const summary=document.createElement('summary');summary.textContent='展开材质与人物参数';fold.append(summary);oldPanel.before(fold);fold.append(oldPanel);const oldFold=document.querySelector('#li-inherited');if(oldFold)fold.append(oldFold);
 const style=document.createElement('style');style.textContent='#lm-controls{padding:18px;color:#eee9df;background:#16262b;font:13px/1.55 system-ui;flex-shrink:0}#lm-controls h2{font-size:21px;line-height:1.2;margin:0 0 10px}#lm-controls h2 small{display:inline-block;font-size:12px;font-weight:400;color:#bbd4ce}#lm-controls p{font-size:12px;color:#c0cdcc;margin:8px 0 12px}.lm-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:7px 0 12px}.lm-row button{min-height:36px;font-size:12px}.lm-row button[aria-pressed="true"]{border-color:#d6c293;background:#354943;color:#fff2d7}.lm-caption{display:block;font-size:11px;color:#b7c8c8;margin-top:12px}.lm-progress{display:block;font-size:12px;margin:12px 0}.lm-progress output{float:right;font-variant-numeric:tabular-nums}.lm-progress input{display:block;width:100%;margin:10px 0}#lm-status{border-top:1px solid #466064;padding-top:10px}#lm-inherited>summary{padding:14px 18px;font:13px system-ui;cursor:pointer;border-top:1px solid #526663}#lm-controls details{font-size:12px}@media(max-width:900px){#lm-controls{padding:13px}#lm-controls h2{font-size:18px}}';document.head.append(style);
 function report(){return{version:VERSION,schema:SCHEMA,ready:status.ready,source:status.source,comparison,view:lastView,poseName:poseName(),progress,pose:window.lipWorkbench.pose(),implementation:solver.version,solver:solver.report(),innerComparison:inner.report().comparison,canonicalGeometryChanged:false,nativeEvaluatedGeometryChanged:comparison==='r05',newMeshes:0,newImageMaps:0,lightingChangedByModule:false,visualAcceptance:false,productionReady:false};}
 function sync(){
  const motionState=solver.report();if(comparison==='r05'&&motionState.installed&&!motionState.enabled)comparison='r04';
  for(const b of panel.querySelectorAll('[data-lm-compare]'))b.setAttribute('aria-pressed',String(b.dataset.lmCompare===comparison));
  for(const b of panel.querySelectorAll('[data-lm-pose]'))b.setAttribute('aria-pressed',String(b.dataset.lmPose===poseName()));
  for(const b of panel.querySelectorAll('[data-lm-view]'))b.setAttribute('aria-pressed',String(b.dataset.lmView===lastView));
  const custom=poseName()==='custom';panel.querySelector('#lm-progress').disabled=custom;panel.querySelector('#lm-progress').value=Math.round(progress*100);panel.querySelector('#lm-progress-label').textContent=custom?'自定义':Math.round(progress*100)+'%';
  const name={neutral:'自然闭口',jaw:'张口检查',speak:'说话姿态',pucker:'噘嘴',custom:'自定义动作'}[poseName()];
  panel.querySelector('#lm-status').textContent=(comparison==='r05'?'本次修复 R05':'修复前 R04')+' · '+name+(custom?'':' · '+Math.round(progress*100)+'%');
 }
 function render(){sync();v.render();return report();}
 function compare(mode){
  if(!['r05','r04'].includes(mode))throw Error('无效嘴唇对照版本');
  batch('matched version switch',()=>heldView(()=>{if(inner.report().comparison!=='r04')inner.compare('r04');if(inner.report().diagnostic!==0)inner.inspect(0);if(mode==='r05'&&!solver.report().valid){const savedPose=window.lipWorkbench.pose();solver.setEnabled(false);inner.pose('jaw');solver.install(v,model);window.lipWorkbench.setPose(savedPose);}comparison=mode;solver.setEnabled(mode==='r05');v.update();}));
  return render();
 }
 function pose(name,amount=1){const p=desired(name,amount);window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();selectedPose=name;progress=amount;window.lipWorkbench.setPose(p);sync();return report();}
 function view(kind){if(!['macro','oblique','front','bust'].includes(kind))throw Error('无效观察视角');inner.view(kind);lastView=kind;sync();return report();}
 const priorArchive=controller.archive.bind(controller),priorRestore=controller.restore.bind(controller);
 function archive(){if(comparison==='r05'&&inner.report().comparison!=='r04')throw Error('先回到 R05 对照后再保存本次修复');return{...priorArchive(),lipMotion:{schema:SCHEMA,version:VERSION,implementation:solver.version,comparison,controlPose:poseName()==='custom'?null:selectedPose,progress:poseName()==='custom'?null:progress}};}
 async function restore(a){
  if(!a||typeof a!=='object'||Array.isArray(a))throw Error('人物档案格式无效');
  const has=Object.prototype.hasOwnProperty.call(a,'lipMotion'),own=has?a.lipMotion:undefined;
  if(has&&(!own||typeof own!=='object'||Array.isArray(own)||own.schema!==SCHEMA||own.version!==VERSION||own.implementation!==solver.version||!['r05','r04'].includes(own.comparison)))throw Error('此嘴唇动作档案不属于当前实现，人物尚未更改');
  if(own&&((own.controlPose!==undefined||own.progress!==undefined)&&!((own.controlPose===null&&own.progress===null)||(['neutral','jaw','speak','pucker'].includes(own.controlPose)&&Number.isFinite(own.progress)&&own.progress>=0&&own.progress<=1))))throw Error('动作进度档案无效，人物尚未更改');
  if(own&&own.comparison==='r05'&&(a.innerLip?.schema!=='kaopu/lip-inner@1'||a.innerLip?.comparison!=='r04'||a.lipRealism?.colourReview?.comparison!=='r02'))throw Error('R05 档案需要配套的 R04 内唇状态，人物尚未更改');
  const copy=structuredClone(a);delete copy.lipMotion;
  await batchAsync('restore native person and rebuild tissue ownership',async()=>{
   const wasEnabled=solver.report().enabled;solver.setEnabled(false);
   try{await priorRestore(copy);}catch(err){try{solver.setEnabled(wasEnabled);}catch(restoreError){status.errors.push(String(restoreError));}throw err;}
   const savedPose=window.lipWorkbench.pose();inner.pose('jaw');solver.install(v,model);window.lipWorkbench.setPose(savedPose);
   comparison=own?own.comparison:'r04';solver.setEnabled(comparison==='r05');v.update();
  });
  const p=window.lipWorkbench.pose(),matches=(name,amount)=>Object.entries(desired(name,amount)).every(([k,x])=>p[k]===x);
  let recovered=own&&own.controlPose&&matches(own.controlPose,own.progress)?{name:own.controlPose,amount:own.progress}:null;
  if(!recovered)for(const name of ['neutral','jaw','speak','pucker']){const full=desired(name),key=Object.keys(full).find(k=>k!=='schema'&&full[k]!==0),amount=key?p[key]/full[key]:1;if(Number.isFinite(amount)&&amount>=0&&amount<=1&&matches(name,amount)){recovered={name,amount};break;}}
  selectedPose=recovered?.name||'speak';progress=recovered?.amount??1;
  return render();
 }
 controller.archive=archive;controller.restore=restore;
 const currentArchive=()=>controller.archive(),currentRestore=a=>controller.restore(a);
 for(const api of [window.fullCommonWorkbench,skin,body,base,inner]){api.archive=currentArchive;api.restore=currentRestore;}
 function save(){const url=URL.createObjectURL(new Blob([JSON.stringify(currentArchive(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='lip-motion-r05-person.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 body.save=save;
 function error(err){const message=String(err);panel.querySelector('#lm-status').textContent=message;status.errors.push(message);}
 async function loadFile(input){const file=input?.files?.[0];if(!file)return;try{await currentRestore(JSON.parse(await file.text()));}catch(err){error(err);}finally{input.value='';}}
 for(const selector of ['#lm-file','#li-file','#lr-file','#ps-file']){const input=document.querySelector(selector);if(input)input.onchange=e=>loadFile(e.target);}
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const saving=b.matches('#li-controls [data-li-action="save"],#lr-controls [data-lr-action="save"],#ps-controls [data-ps-action="save"],#ps-controls [data-fb-action="save"]'),loading=b.matches('#li-controls [data-li-action="load"],#lr-controls [data-lr-action="load"],#ps-controls [data-ps-action="load"]');if(!saving&&!loading)return;e.preventDefault();e.stopImmediatePropagation();try{if(saving)save();else panel.querySelector('#lm-file').click();}catch(err){error(err);}},true);
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.lmCompare)compare(b.dataset.lmCompare);if(b.dataset.lmPose)pose(b.dataset.lmPose);if(b.dataset.lmView)view(b.dataset.lmView);if(b.dataset.lmAction==='save')save();if(b.dataset.lmAction==='load')panel.querySelector('#lm-file').click();}catch(err){error(err);}});
 panel.querySelector('#lm-progress').oninput=e=>{try{if(poseName()==='custom'){sync();return;}pose(selectedPose,Number(e.target.value)/100);}catch(err){error(err);}};
 shell.addEventListener('change',e=>{if(!panel.contains(e.target))queueMicrotask(sync);});
 shell.addEventListener('click',e=>{if(!panel.contains(e.target))queueMicrotask(sync);});
 window.motionLip={version:VERSION,get ready(){return status.ready;},compare,pose,view,report,archive:currentArchive,restore:currentRestore,save};
 document.title='KAOPU · 嘴唇动作修复 R05';document.querySelector('header strong').textContent='人物总台 · 嘴唇 R05';document.documentElement.dataset.lipMotion=VERSION;document.documentElement.dataset.lipMotionSource=status.source?.sourceCommit||'local';
 batch('deterministic native calibration and startup',()=>{window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();inner.compare('r04');inner.inspect(0);inner.pose('jaw');solver.install(v,model);solver.setEnabled(true);pose('speak');view('macro');});
 render();status.ready=true;return true;
}
const start=performance.now(),timer=setInterval(()=>{try{if(boot()){clearInterval(timer);return;}if(performance.now()-start>300000){clearInterval(timer);status.errors.push('原人物尚未就绪，R05 未启用');}}catch(err){clearInterval(timer);status.errors.push(String(err));console.error('LIP_MOTION_INIT',err);}},120);
addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
