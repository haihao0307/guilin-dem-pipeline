(function(){
'use strict';
const state={failures:[],runId:0,stage:'加载整车脚本',events:[],errors:[],started:Date.now()};
function paint(){const p=document.getElementById('startup-state');if(p){p.textContent=state.stage+(state.errors.length?'\n'+state.errors.join('\n')+(state.failures.length?'\n故障前状态：'+JSON.stringify(state.failures.at(-1)):'' ):'');p.dataset.state=state.errors.length?'error':'loading';p.dataset.runId=String(state.runId);}}
function invalidateFrame(message){
 if(window.QA){QA.done=false;QA.frameValid=false;QA.invalidatedBy=message;QA.runId=state.runId;}
 const r=document.getElementById('rendered');if(r)r.textContent='当前帧已失效；此前画面如仍可见也不是已确认的新帧。';
 const p=document.getElementById('status');if(p)p.textContent=message;
 if(window.RESEARCH_UI){RESEARCH_UI.playing=false;RESEARCH_UI.dirty=false;const play=document.getElementById('play');if(play)play.textContent='逐帧播放';}
}
function beginRun(stage='开始新的完整初始化…'){
 state.runId++;state.started=Date.now();state.errors=[];state.stage=stage;state.events.push({runId:state.runId,stage,ms:0,newRun:true});
 if(window.QA)QA.errors=[];
 if(window.RESEARCH_UI){RESEARCH_UI.requestGeneration=(RESEARCH_UI.requestGeneration||0)+1;RESEARCH_UI.ready=false;RESEARCH_UI.busy=false;}
 invalidateFrame(stage+'；旧帧无效，等待完整初始化。');paint();return state.runId;
}
function assertActive(runId=state.runId){if(runId!==state.runId||state.errors.length){const e=Error('初始化代际已过期或失败，禁止提交整车帧。');e.name='A4ObsoleteFrameError';throw e;}return true;}
function step(stage,runId=state.runId){const stale=runId!==state.runId,blockedByFailure=!stale&&state.errors.length>0;state.events.push({runId,stage,ms:Date.now()-state.started,stale,blockedByFailure});if(stale||blockedByFailure)return false;state.stage=stage;paint();return true;}
function fail(message,runId=state.runId){if(runId!==state.runId)return false;if(!state.errors.length){state.failures.push({runId,stage:state.stage,ms:Date.now()-state.started,progress:window.QA?.progress,device:window.QA?.device,lastValid:window.QA?.done===true});state.failures=state.failures.slice(-4);}const s=String(message);if(!state.errors.includes(s))state.errors.push(s);state.stage='整车加载未完成';invalidateFrame('当前帧已失效。\n'+state.errors.join('\n'));paint();return true;}
window.A4_STARTUP={state,beginRun,assertActive,step,fail};
window.addEventListener('error',function(e){if(e.target&&e.target!==window&&e.target.src)fail('资源加载失败：'+e.target.src.split('/').pop());else fail((e.message||'脚本异常')+(e.filename?' ['+e.filename.split('/').pop()+':'+e.lineno+']':''));},true);
window.addEventListener('unhandledrejection',e=>fail('异步初始化失败：'+String(e.reason)));
window.addEventListener('DOMContentLoaded',paint);
const c=document.getElementById('c');
if(c){c.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('WebGL 渲染上下文已中断，当前整车帧未完成。此状态不代表机械测试失败。');});c.addEventListener('webglcontextrestored',()=>fail('渲染上下文已恢复；正在安排一次完整资源重建，不会反复刷新。'));}
beginRun('正在加载解析场与机械适配脚本…');
})();
