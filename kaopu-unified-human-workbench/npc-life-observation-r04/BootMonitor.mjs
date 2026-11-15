import{createBootLifecycle}from'./BootLifecycle.mjs';
const el=id=>document.getElementById(id);
function paint(s){
  document.documentElement.dataset.npcBoot=s.status;
  if(s.status==='failed')document.documentElement.dataset.npcReady='failed';
  const shell=el('npc-boot-shell');if(shell)shell.hidden=s.status==='ready';
  if(el('npc-boot-title'))el('npc-boot-title').textContent=s.status==='failed'?'场景加载已停止':s.status==='ready'?'完整场景已就绪':'正在打开生活动作观察台';
  if(el('npc-boot-progress'))el('npc-boot-progress').textContent=s.failure?.message||s.label;
  if(el('npc-boot-elapsed'))el('npc-boot-elapsed').textContent='已用 '+Math.floor(s.elapsedMS/1000)+' 秒 · R04 · 完整原生人物';
  if(el('npc-boot-detail'))el('npc-boot-detail').textContent=s.failure?'错误 '+s.failure.code+'。可重新加载，或复制诊断以定位原因。':'正在生成三个完整人物并准备皮肤与眼睛。每个阶段都有等待上限。';
  if(el('npc-boot-track'))el('npc-boot-track').textContent=s.steps.map(x=>(x.endedMS===null?'进行中':'已完成')+' · '+x.label+' · '+((x.endedMS??s.elapsedMS)-x.startedMS).toFixed(0)+' ms').join('\n');
  if(el('npc-boot-actions'))el('npc-boot-actions').hidden=s.status!=='failed';
  if(s.status==='failed'){if(el('npc-status'))el('npc-status').textContent='场景已停止，请重新加载。';if(el('npc-ready'))el('npc-ready').textContent='加载失败';}
}
const boot=createBootLifecycle({onChange:paint});window.__NPC_BOOT__=boot;
function diagnostics(){return{version:'NPC-LIFE-OBSERVATION-R04',url:location.href,boot:boot.snapshot(),assets:window.__NPC_ASSETS__?{mode:window.__NPC_ASSETS__.mode,served:window.__NPC_ASSETS__.served?.length,missing:window.__NPC_ASSETS__.missing}:null,native:window.__NPC_NATIVE_BOOT__?.status?.(),renderer:window.__NPC_OBSERVATION__?.renderStatus?.()};}
function bind(){
  paint(boot.snapshot());
  const retry=el('npc-boot-retry');if(retry&&!retry.dataset.bound){retry.dataset.bound='true';retry.onclick=()=>location.reload();}
  const copy=el('npc-boot-copy');if(copy&&!copy.dataset.bound){copy.dataset.bound='true';copy.onclick=async()=>{const value=JSON.stringify(diagnostics(),null,2);try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(value);copy.textContent='诊断已复制';}catch{const area=el('npc-boot-diagnostic');if(area){area.hidden=false;area.value=value;area.focus();area.select();copy.textContent='请复制下方诊断';}}};}
}
document.addEventListener('DOMContentLoaded',bind,{once:true});
const timer=setInterval(()=>{bind();if(boot.snapshot().status!=='loading')clearInterval(timer);},500);
window.addEventListener('error',event=>{
  if(event.target?.tagName==='IMG'){if(event.target.dataset.npcRequired==='true')boot.fail(Error('完整人物所需图片读取失败。'),{code:'REQUIRED_IMAGE_FAILED'});return;}
  boot.fail(event.error||Error(event.message||'页面脚本执行失败。'),{code:'SCRIPT_ERROR'});
},true);
window.addEventListener('unhandledrejection',event=>boot.fail(event.reason instanceof Error?event.reason:Error(String(event.reason)),{code:'UNHANDLED_NATIVE_ERROR'}));
document.addEventListener('webglcontextlost',event=>{event.preventDefault();boot.fail(Error('三维渲染上下文丢失，请重新加载。'),{code:'WEBGL_CONTEXT_LOST'});},true);
if(!('WebGL2RenderingContext'in window))boot.fail(Error('当前浏览器不支持完整场景所需的 WebGL2。'),{code:'WEBGL2_UNAVAILABLE'});
