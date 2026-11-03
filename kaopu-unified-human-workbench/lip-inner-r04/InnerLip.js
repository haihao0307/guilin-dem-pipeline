/* Inner-lip responsibility and matched native R02 comparison. No geometry patch. */
(function(){
'use strict';
const VERSION='LIP-INNER-R04',SCHEMA='kaopu/lip-inner@1';
const status=window.__LIP_INNER__={version:VERSION,ready:false,errors:[],source:window.__LIP_INNER_SOURCE__||null};
function boot(){
 const base=window.lipRealism,skin=window.headProceduralSkin,body=window.bodyProceduralSkin;
 const v=window.__IDENTITY_QA__?.viewer?.(),model=window.__IDENTITY_QA__?.model?.(),controller=window.__IDENTITY_QA__?.controller?.();
 if(!base?.ready||!v?.startupFinalFrame||!window.__LIP_INNER_SHADER__)return false;
 if(base.version!=='LIP-REALISM-R02')throw Error('内唇 R04 需要固定的 R02 人物');
 const shell=document.querySelector('#control-shell'),basePanel=document.querySelector('#lr-controls');
 if(!shell||!basePanel)throw Error('原人物工作台界面缺失');
 const mat=skin.material(),oldCompile=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey.bind(mat);
 let comparison='r04',diagnostic=0,lastView='macro',compiles=0,fragment='',originalFragment='',nativeUniformIdentity=[];
 const uniforms={liEnabled:{value:1},liDiagnostic:{value:0}};
 mat.onBeforeCompile=function(shader,...args){
  oldCompile.call(this,shader,...args);originalFragment=shader.fragmentShader;
  const names=window.__LIP_INNER_SHADER__.nativeUniformNames;if(!Array.isArray(names)||!names.length)throw Error('内唇材质缺少原生参数职责清单');
  const before=Object.fromEntries(names.map(name=>[name,shader.uniforms[name]]));
  fragment=window.__LIP_INNER_SHADER__.apply(shader,uniforms);
  nativeUniformIdentity=names.map(name=>({name,present:!!before[name],sameObject:before[name]===shader.uniforms[name]}));
  if(nativeUniformIdentity.some(x=>!x.present||!x.sameObject))throw Error('内唇材质替换了原生参数对象');compiles++;
 };
 mat.customProgramCacheKey=()=>oldKey()+'/'+VERSION+'/'+window.__LIP_INNER_SHADER__.version;mat.needsUpdate=true;
 const panel=document.createElement('section');panel.id='li-controls';
 panel.innerHTML='<h2>内唇材质恢复 <small>R04 · 同一人物</small></h2>'+
  '<p class="li-intro">检查张口时的内侧表面。切换前后保持人物、动作、镜头和灯光一致。</p>'+
  '<div class="li-row"><button data-li-compare="r04" aria-pressed="true">本次修复 R04</button><button data-li-compare="r02" aria-pressed="false">修复前 R02</button></div>'+
  '<label class="li-caption">动作</label><div class="li-row li-poses"><button data-li-pose="neutral">自然闭口</button><button data-li-pose="jaw">张口检查</button><button data-li-pose="speak">说话姿态</button><button data-li-pose="pucker">噘嘴</button></div>'+
  '<label class="li-caption">视角</label><div class="li-row"><button data-li-view="macro">嘴部正面</button><button data-li-view="oblique">嘴部斜侧</button><button data-li-view="front">整脸正面</button><button data-li-view="bust">头颈同框</button></div>'+
  '<label class="li-channel">观察通道<select id="li-channel"><option value="0">完整材质</option><option value="1">内唇表面范围</option></select></label>'+
  '<div class="li-row"><button data-li-action="save">保存完整人物</button><button data-li-action="load">载入人物档案</button><input id="li-file" type="file" accept="application/json,.json" hidden></div>'+
  '<p id="li-status" role="status"></p><details><summary>这次修复解决什么</summary><p id="li-findings">恢复系统已标记的内唇表面，让它有自己的材质响应。外唇颜色、原生形状和口角动作沿用 R02。当前是待审核候选。</p></details>';
 shell.prepend(panel);
 const fold=document.createElement('details');fold.id='li-inherited';const summary=document.createElement('summary');summary.textContent='展开外唇与口周参数（R02）';fold.append(summary);basePanel.before(fold);fold.append(basePanel);
 // The R04 comparison owns the version switch; inherited R02 sliders stay live.
 const oldComparison=basePanel.querySelector('[data-lr-comparison]')?.parentElement;if(oldComparison)oldComparison.hidden=true;
 const oldViews=basePanel.querySelector('.lr-views');if(oldViews)oldViews.hidden=true;
 const oldChannel=basePanel.querySelector('#lr-diagnostic')?.closest('label');if(oldChannel)oldChannel.hidden=true;
 basePanel.querySelector('h2').textContent='外唇与口周参数';
 basePanel.querySelector('.lr-intro').textContent='沿用 R02 的外唇合成和纹理。参数对前后两版共同生效。';
 basePanel.querySelector('.lr-note').textContent='回到上方切换 R04 / R02，并检查同一个动作。';
 const style=document.createElement('style');style.textContent='#li-controls{padding:18px;color:#ece8df;background:#17252b;font:13px/1.55 system-ui;flex-shrink:0}#li-controls h2{font-size:21px;line-height:1.2;margin:0 0 10px}#li-controls h2 small{display:inline-block;font-size:12px;font-weight:400;color:#b7cfcd}#li-controls p{font-size:12px;color:#bdcccd;margin:8px 0 12px}.li-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:7px 0 12px}.li-row button{min-height:36px;font-size:12px}.li-row button[aria-pressed="true"]{border-color:#d6c293;background:#354943;color:#fff2d7}.li-caption{display:block;font-size:11px;color:#b7c8c8;margin-top:12px}.li-channel{display:block;margin:12px 0}.li-channel select{display:block;width:100%;min-height:34px;margin-top:5px;font-size:12px}#li-status{border-top:1px solid #466064;padding-top:10px}#li-inherited{border-top:1px solid #526663}#li-inherited>summary{padding:14px 18px;font:13px system-ui;cursor:pointer}#lr-controls [hidden]{display:none!important}#li-controls details{font-size:12px}#control-shell{overflow-y:auto!important}@media(max-width:900px){#li-controls{padding:13px}#li-controls h2{font-size:18px}.li-poses{grid-template-columns:repeat(4,1fr)}}';document.head.append(style);
 const poseTemplate=structuredClone(window.lipWorkbench.pose());
 function desiredPose(name){
  const result={...poseTemplate};for(const key of Object.keys(result))if(key!=='schema')result[key]=0;
  if(name==='jaw')result.jawOpen=.36;
  else if(name==='speak')Object.assign(result,{jawOpen:.36,upperRaise:.2,lowerDepress:.12});
  else if(name==='pucker')Object.assign(result,{jawOpen:.06,pucker:.82,seal:.24});
  else if(name!=='neutral')throw Error('无效内唇观察动作');return result;
 }
 function poseName(){const current=window.lipWorkbench.pose();return ['neutral','jaw','speak','pucker'].find(name=>Object.entries(desiredPose(name)).every(([k,x])=>current[k]===x))||'custom';}
 function gpu(){const gl=v.renderer.getContext(),p=v.renderer.properties.get(mat),program=p.currentProgram||(p.programs&&[...p.programs.values()].at(-1));return{linked:!!program?.program&&!!gl.getProgramParameter(program.program,gl.LINK_STATUS),programId:program?.id??null};}
 function report(){const g=gpu();return{version:VERSION,schema:SCHEMA,initialization:status.initialization?{...status.initialization}:null,ready:compiles>0&&g.linked,linked:g.linked,programId:g.programId,shaderCompiles:compiles,comparison,diagnostic,view:lastView,poseName:poseName(),pose:window.lipWorkbench.pose(),source:status.source,shaderVersion:window.__LIP_INNER_SHADER__.version,baseComparison:base.report().comparison,semanticDomain:'clamp(l19State.x,0,1) * skin coverage * native lip enable; continuous interpolation',nativeShapeAlgorithmChanged:false,comparisonChangesGeometry:base.report().comparison==='r02'?false:null,comparisonGeometryCondition:'matched r04/r02 switches while already using R02 base; returning from legacy R07 first restores inherited R02 relief',canonicalGeometryChanged:false,newMeshes:0,newImageMaps:0,lightingChangedByModule:false,measuredOptics:false,fullVolumeScattering:false,visualAcceptance:false,productionReady:false};}
 function sync(){
  uniforms.liEnabled.value=comparison==='r04'?1:0;uniforms.liDiagnostic.value=diagnostic;
  for(const b of panel.querySelectorAll('[data-li-compare]'))b.setAttribute('aria-pressed',String(b.dataset.liCompare===comparison));
  for(const b of panel.querySelectorAll('[data-li-pose]'))b.setAttribute('aria-pressed',String(b.dataset.liPose===poseName()));
  for(const b of panel.querySelectorAll('[data-li-view]'))b.setAttribute('aria-pressed',String(b.dataset.liView===lastView));
  panel.querySelector('#li-channel').value=diagnostic;
  const activeBase=base.report().comparison;
  const name={neutral:'自然闭口',jaw:'张口检查',speak:'说话姿态',pucker:'噘嘴',custom:'当前自定义动作'}[poseName()];
  panel.querySelector('#li-status').textContent=(comparison==='r04'?'本次修复 R04':activeBase==='r02'?'修复前 R02':'原平台 '+activeBase.toUpperCase()+' · 内唇修复未启用')+' · '+name+' · '+(diagnostic?'紫色标出内唇表面范围':'待视觉审核');
 }
 function render(){sync();v.render();status.ready=report().ready;return report();}
 const priorCompare=base.compare.bind(base);
 function compare(mode){if(!['r04','r02'].includes(mode))throw Error('无效内唇对照版本');if(base.report().comparison!=='r02')priorCompare('r02');comparison=mode;return render();}
 function inspect(value){if(![0,1].includes(value))throw Error('无效内唇观察通道');diagnostic=value;if(base.settings().diagnostic!==0)base.set({diagnostic:0});return render();}
 function pose(name){window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();window.lipWorkbench.setPose(desiredPose(name));sync();return report();}
 function view(kind){base.view(kind);lastView=kind;sync();return report();}
 // Capture the complete R02 archive implementation before installing current aliases.
 const priorArchive=controller.archive.bind(controller),priorRestore=controller.restore.bind(controller);
 function archive(){if(comparison==='r04'&&base.report().comparison!=='r02')throw Error('先回到 R04 / R02 对照后再保存当前修复');return{...priorArchive(),innerLip:{schema:SCHEMA,version:VERSION,implementation:window.__LIP_INNER_SHADER__.version,comparison,diagnostic}};}
 async function restore(a){
  if(!a||typeof a!=='object'||Array.isArray(a))throw Error('人物档案格式无效');
  const hasOwn=Object.prototype.hasOwnProperty.call(a,'innerLip'),own=hasOwn?a.innerLip:undefined;
  if(hasOwn&&(!own||typeof own!=='object'||Array.isArray(own)))throw Error('内唇档案字段无效，人物尚未更改');
  if(hasOwn&&(own.schema!==SCHEMA||own.version!==VERSION||own.implementation!==window.__LIP_INNER_SHADER__.version||!['r04','r02'].includes(own.comparison)||![0,1].includes(own.diagnostic)))throw Error('此内唇档案不属于当前实现，人物尚未更改');
  if(a.lipRealism&&!['LIP-REALISM-R01','LIP-REALISM-R02'].includes(a.lipRealism.version))throw Error('此嘴唇档案来自另一版本，请在对应工作台恢复；人物尚未更改');
  if(own&&own.comparison==='r04'&&a.lipRealism?.colourReview?.comparison!=='r02')throw Error('R04 档案需要 R02 外唇合成，人物尚未更改');
  const copy=structuredClone(a);delete copy.innerLip;await priorRestore(copy);
  comparison=own?own.comparison:'r02';diagnostic=own?own.diagnostic:0;return render();
 }
 controller.archive=archive;controller.restore=restore;
 const currentArchive=()=>controller.archive(),currentRestore=a=>controller.restore(a);
 for(const api of [window.fullCommonWorkbench,skin,body,base]){api.archive=currentArchive;api.restore=currentRestore;}
 function save(){const url=URL.createObjectURL(new Blob([JSON.stringify(currentArchive(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='lip-inner-r04-person.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 body.save=save;
 function error(err){const message=String(err);panel.querySelector('#li-status').textContent=message;status.errors.push(message);}
 async function loadFile(input){const file=input?.files?.[0];if(!file)return;try{await currentRestore(JSON.parse(await file.text()));}catch(err){error(err);}finally{input.value='';}}
 for(const selector of ['#li-file','#lr-file','#ps-file']){const input=document.querySelector(selector);if(input)input.onchange=e=>loadFile(e.target);}
 // Port the narrow, reviewed ancestor-capture routing used by PR305. Native mesh exports stay native.
 shell.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const saving=b.matches('#lr-controls [data-lr-action="save"],#ps-controls [data-ps-action="save"],#ps-controls [data-fb-action="save"]');
  const loading=b.matches('#lr-controls [data-lr-action="load"],#ps-controls [data-ps-action="load"]');
  if(!saving&&!loading)return;e.preventDefault();e.stopImmediatePropagation();try{if(saving)save();else panel.querySelector('#li-file').click();}catch(err){error(err);}
 },true);
 base.compare=function(mode){if(!['r01','r02','r07'].includes(mode))throw Error('无效嘴唇对照版本');comparison='r02';sync();const result=priorCompare(mode);sync();return result;};
 basePanel.addEventListener('click',e=>{if(e.target.closest('[data-lr-action="reset"]')){comparison='r02';sync();}},true);
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{if(b.dataset.liCompare)compare(b.dataset.liCompare);if(b.dataset.liPose)pose(b.dataset.liPose);if(b.dataset.liView)view(b.dataset.liView);if(b.dataset.liAction==='save')save();if(b.dataset.liAction==='load')panel.querySelector('#li-file').click();}catch(err){error(err);}});
 panel.querySelector('#li-channel').onchange=e=>inspect(Number(e.target.value));
 window.innerLip={version:VERSION,get ready(){return report().ready;},compare,inspect,pose,view,report,archive:currentArchive,restore:currentRestore,save,fragment:()=>fragment,shaderEvidence:()=>({originalR02Fragment:originalFragment,finalFragment:fragment,nativeUniformIdentity:structuredClone(nativeUniformIdentity)})};
 document.title='KAOPU · 内唇材质恢复 R04';document.querySelector('header strong').textContent='人物总台 · 内唇 R04';
 document.documentElement.dataset.lipInner=VERSION;document.documentElement.dataset.lipInnerSource=status.source?.sourceCommit||'local';
 // These native setup APIs each request a render. Commit their synchronous
 // state changes together, then render the final state once; do not queue
 // whole-size intermediate frames while the inherited startup GPU is busy.
 const renderDescriptor=Object.getOwnPropertyDescriptor(v,'render'),originalRender=v.render;
 const initialization=status.initialization={batched:true,suppressedRenderCalls:0,originalRenderRestored:false};
 try{
  Object.defineProperty(v,'render',{configurable:true,writable:true,value(){initialization.suppressedRenderCalls++;}});
  window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();
  if(base.report().comparison!=='r02')priorCompare('r02');
  pose('jaw');view('macro');
 }finally{
  if(renderDescriptor)Object.defineProperty(v,'render',renderDescriptor);else delete v.render;
  initialization.originalRenderRestored=v.render===originalRender;
 }
 if(!initialization.originalRenderRestored)throw Error('原人物渲染方法未能恢复');
 render();return true;
}
const start=performance.now(),timer=setInterval(()=>{try{if(boot()){clearInterval(timer);return;}if(performance.now()-start>300000){clearInterval(timer);status.errors.push('原人物尚未就绪，内唇修复未启用');}}catch(err){clearInterval(timer);status.errors.push(String(err));console.error('LIP_INNER_INIT',err);}},120);
addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
