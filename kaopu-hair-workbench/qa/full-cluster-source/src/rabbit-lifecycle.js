/* Lazy startup with visible stages, causal errors and an in-page retry. */
(function(){'use strict';
let pending=null,teacherPending=null,started=false,status='idle',lastError=null;window.rabbitTeacherStarted=false;
const P=window.rabbitLoadProgress;
function showProgress(d){
 if(status==='error')return;
 const loading=$('candidateLoading');if(workbench.ready.candidate&&d.stage!=='noise')return;
 loading.hidden=false;loading.replaceChildren();const spin=document.createElement('div');spin.className='spinner';const text=document.createElement('span');
 const percent=d.total?Math.min(100,Math.round(d.loaded/d.total*100)):null;
 const detail=d.stage==='download'?' '+(d.loaded/1048576).toFixed(1)+' / '+(d.total/1048576).toFixed(1)+' MB':percent===null?'':' '+percent+'%';
 text.textContent=(d.message||'正在准备兔子')+detail;loading.append(spin,text);$('candidateStats').textContent='载入阶段 · '+(d.stage||'准备');$('globalStatus').textContent=text.textContent;
}
function showError(error){
 if(!lastError)lastError=error;status='error';const loading=$('candidateLoading');loading.hidden=false;loading.replaceChildren();const message=document.createElement('span');message.textContent='兔子未能启动：'+lastError.message;const retry=document.createElement('button');retry.type='button';retry.id='rabbitRetryLoad';retry.textContent='重试载入';retry.onclick=()=>workbench.retryStartup();loading.append(message,retry);$('candidateStats').textContent='载入失败 · 可以重试';$('globalStatus').textContent=message.textContent;window.catalogUI?.sync();
}
window.addEventListener('rabbitloadprogress',e=>showProgress(e.detail));
window.addEventListener('message',e=>{const d=e.data;if(!d?.kaopu||d.epoch!==window.FRAME_EPOCHS?.[d.role]||!['candidate','teacher'].includes(d.role)||e.source!==$(d.role+'Frame').contentWindow)return;
 if(d.type==='load-progress'&&d.role==='candidate')showProgress(d);
 if(d.type==='frame'&&d.role==='candidate'&&workbench.ready.candidate&&status!=='error'){$('candidateLoading').hidden=true;}
 if(d.type==='error'||d.type==='gl-error'){const error=Error(d.message||'WebGL错误 '+d.code);for(const w of meshWaiters.splice(0)){clearTimeout(w.timer);w.reject(error);}if(d.role==='candidate')showError(error);}
});
workbench.ensureStarted=function(){
 if(pending)return pending;
 pending=(async()=>{status='loading';lastError=null;P.emit({stage:'download',message:'下载原始兔子必要资源',loaded:0,total:0,startedAt:performance.now(),error:null});window.catalogUI?.sync();performance.mark('rabbit-requested');
  await window.ensureRabbitBundle();performance.mark('rabbit-assets-ready');
  if(platform.module!=='rabbit'&&!started)throw new DOMException('Rabbit selection was cancelled','AbortError');
  if(!started){started=true;P.emit({stage:'initialize',message:'初始化3D与原始毛发',loaded:0,total:1});createFrame('candidate');}
  await waitForMesh(candidate.mesh);status='ready';window.catalogUI?.sync();performance.mark('rabbit-ready');return workbench;
 })();
 pending.catch(error=>{if(!started)pending=null;if(error.name==='AbortError'){status='idle';window.catalogUI?.sync();return;}showError(error);});return pending;
};
workbench.retryStartup=function(){
 if(status!=='error')return workbench.ensureStarted();
 for(const w of meshWaiters.splice(0)){clearTimeout(w.timer);w.reject(Error('重新载入兔子'));}
 $('candidateFrame').srcdoc='';ready.candidate=false;loadedMesh.candidate=null;delete frameStats.candidate;
 for(let i=errors.length-1;i>=0;i--)if(errors[i].role==='candidate')errors.splice(i,1);
 started=false;pending=null;lastError=null;status='idle';$('errorBanner').hidden=true;$('errorBanner').textContent='';return workbench.ensureStarted();
};
workbench.ensureTeacher=function(options={}){if(teacherPending)return teacherPending;teacherPending=(async()=>{await workbench.ensureStarted();if(options.interactive&&(!document.getElementById('rabbitTeacherDrawer').open||platform.module!=='rabbit'))throw new DOMException('Teacher selection was cancelled','AbortError');if(!window.rabbitTeacherStarted){window.rabbitTeacherStarted=true;createFrame('teacher');}await waitForMesh(candidate.mesh);return workbench;})();teacherPending.catch(()=>{teacherPending=null;});return teacherPending;};
Object.defineProperty(workbench,'teacherStarted',{get:()=>window.rabbitTeacherStarted});Object.defineProperty(workbench,'started',{get:()=>started});Object.defineProperty(workbench,'startupStatus',{get:()=>status});
})();
