'use strict';
(()=>{
if(window.parent===window||new URLSearchParams(location.search).get('embedded')!=='1')return;
const host=window.parent,send=(action,extra={})=>host.postMessage({type:'kaopu-viewer',action,...extra},location.origin);
const style=document.createElement('style');style.textContent='header,body>main>nav{display:none!important}main{padding:0 1px}#viewport{height:var(--embedded-stage,500px);min-height:310px}body.controlsHidden #viewport{height:var(--embedded-stage,500px)}#cameraRecoveryNotice{border:1px solid #766340;border-radius:6px;color:#d5bd8a;padding:8px 10px;font-size:11px}';document.head.append(style);
function sizeStage(){document.documentElement.style.setProperty('--embedded-stage',Math.max(310,Math.round(host.innerHeight*(host.innerWidth<=600?.56:.65)))+'px');}
sizeStage();host.addEventListener('resize',sizeStage);
let ready=false,oldRig='',oldHeight=0;
function api(){return window.KAOPU_STUDIO||window.KAOPU_STUDIES;}
window.addEventListener('message',e=>{if(e.source!==host||e.origin!==location.origin||e.data?.type!=='kaopu-host')return;if(e.data.action==='rig'&&api()?.ready){api().setRig(e.data.rig);oldRig=JSON.stringify(api().getState().rig);api().flushSave?.();}});
const timer=setInterval(()=>{const a=api();if(a?.ready){const rig=a.getState().rig,key=JSON.stringify(rig);if(!ready){ready=true;oldRig=key;send('ready',{rig});}else if(key!==oldRig){oldRig=key;send('rig',{rig});}const main=document.querySelector('main'),height=Math.ceil(main.getBoundingClientRect().height+16);if(height!==oldHeight){oldHeight=height;send('height',{height});}}else{const e=document.querySelector('#error');if(e&&!e.hidden)send('error',{message:e.textContent});}},300);
window.addEventListener('pagehide',()=>{clearInterval(timer);host.removeEventListener('resize',sizeStage);api()?.flushSave?.();});
document.querySelectorAll('.legacyLink').forEach(a=>a.onclick=e=>{e.preventDefault();send('overview');});
})();
