'use strict';
(()=>{
if(window.parent===window||new URLSearchParams(location.search).get('embedded')!=='1')return;
const host=window.parent,send=(action,extra={})=>host.postMessage({type:'kaopu-viewer',action,...extra},location.origin);
const style=document.createElement('style');style.textContent='header,body>main>nav{display:none!important}main{padding:0 1px}#viewport{height:var(--embedded-stage,500px);min-height:310px}body.controlsHidden #viewport{height:var(--embedded-stage,500px)}#cameraRecoveryNotice{border:1px solid #766340;border-radius:6px;color:#d5bd8a;padding:8px 10px;font-size:11px}';document.head.append(style);
let disposed=false,timer=0,ready=false,oldRig='',oldHeight=0;
function sizeStage(){if(!disposed)document.documentElement.style.setProperty('--embedded-stage',Math.max(310,Math.round(host.innerHeight*(host.innerWidth<=600?.56:.65)))+'px');}
function api(){return window.KAOPU_STUDIO||window.KAOPU_STUDIES;}
function announce(recovered=false){const a=api();if(!a?.ready)return;ready=true;oldRig=JSON.stringify(a.getState().rig);send('ready',{rig:a.getState().rig,recovered});}
function message(e){if(disposed||e.source!==host||e.origin!==location.origin||e.data?.type!=='kaopu-host')return;if(e.data.action==='rig'&&api()?.ready){api().setRig(e.data.rig);oldRig=JSON.stringify(api().getState().rig);api().flushSave?.();}}
function rendererState(e){if(disposed)return;if(e.detail.phase==='lost'){ready=false;send('recovering');}else if(e.detail.phase==='restored')announce(true);}
function poll(){if(disposed)return;const a=api();if(a?.ready){const rig=a.getState().rig,key=JSON.stringify(rig);if(!ready)announce();else if(key!==oldRig){oldRig=key;send('rig',{rig});}}else{ready=false;const e=document.querySelector('#error');if(e&&!e.hidden)send('error',{message:e.firstChild?.textContent||e.textContent});}const main=document.querySelector('main');if(main){const height=Math.ceil(main.getBoundingClientRect().height+16);if(height!==oldHeight){oldHeight=height;send('height',{height});}}}
function start(){if(disposed||timer)return;sizeStage();host.addEventListener('resize',sizeStage);timer=setInterval(poll,300);poll();}
function pause(){if(timer)clearInterval(timer);timer=0;host.removeEventListener('resize',sizeStage);}
function pagehide(e){if(e.persisted)pause();else dispose();}
function pageshow(e){if(e.persisted)start();}
function dispose(){if(disposed)return;disposed=true;pause();window.removeEventListener('message',message);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);document.querySelector('#canvas')?.removeEventListener('kaopu-renderer-state',rendererState);api()?.flushSave?.();}
window.addEventListener('message',message);window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);document.querySelector('#canvas')?.addEventListener('kaopu-renderer-state',rendererState);
window.KAOPU_VIEWER_BRIDGE={dispose,diagnostics:()=>({disposed,timerRunning:!!timer,ready})};
document.querySelectorAll('.legacyLink').forEach(a=>a.onclick=e=>{e.preventDefault();send('overview');});start();
})();
