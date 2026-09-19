(function(){
'use strict';
const TAG='SMI_HANDLINE_R01_RUNTIME';
const SAVE_KEY='smi.handline.r01.candidate';
const held={reel:0,give:0,lift:0,angleLeft:0,angleRight:0};
let controller=null,hook=null,game=null,last=0,fishId=null,statusEl=null,lineEl=null,ui=null;
function setHeld(k,v){held[k]=v?1:0;if(controller)controller.setControl(k,held[k]);}
function button(label,key){const b=document.createElement('button');b.textContent=label;b.dataset.handline=key;b.style.cssText='min-width:62px;min-height:42px;border:1px solid #ffffff99;border-radius:999px;background:#e9fbffd9;color:#183b47;font:600 11px system-ui;touch-action:none';const down=e=>{e.preventDefault();setHeld(key,true);},up=e=>{e.preventDefault();setHeld(key,false);};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up);return b;}
function buildUi(){
 ui=document.createElement('div');ui.id='smiHandlineR01';ui.style.cssText='position:fixed;left:50%;bottom:max(126px,calc(env(safe-area-inset-bottom) + 106px));transform:translateX(-50%);z-index:46;display:flex;gap:5px;align-items:center;padding:6px;border:1px solid #ffffff99;border-radius:18px;background:#dff5f3b8;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:11px system-ui;color:#153d48';
 ui.append(button('收线 R','reel'),button('放线 F','give'),button('左摆 Z','angleLeft'),button('右摆 X','angleRight'),button('提线 Space','lift'));
 const save=document.createElement('button');save.textContent='存';save.style.cssText='min-height:42px;border:1px solid #ffffff99;border-radius:999px;background:#ffffffbb';save.onclick=()=>{if(controller)localStorage.setItem(SAVE_KEY,JSON.stringify(controller.snapshot()));};ui.append(save);
 const restart=document.createElement('button');restart.textContent='重置线';restart.style.cssText=save.style.cssText;restart.onclick=()=>{if(controller){controller.restart();localStorage.removeItem(SAVE_KEY);}};ui.append(restart);
 statusEl=document.createElement('span');statusEl.style.cssText='min-width:190px;font-variant-numeric:tabular-nums';ui.append(statusEl);document.body.append(ui);
 lineEl=document.createElementNS('http://www.w3.org/2000/svg','svg');lineEl.setAttribute('id','smiHandlineLine');lineEl.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:44;pointer-events:none';const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('stroke','rgba(242,238,214,.85)');line.setAttribute('stroke-width','1.4');line.setAttribute('stroke-linecap','round');line.dataset.role='line';lineEl.append(line);document.body.append(lineEl);
}
function renderLine(anchor,fish){if(!lineEl||!hook)return;const a=hook.projectWorld(anchor),b=hook.projectWorld(fish),line=lineEl.querySelector('[data-role=line]');if(!a?.visible||!b?.visible){line.style.display='none';return;}line.style.display='';line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);}
function environment(){return {surfaceAt:(x,z,t)=>hook.surfaceAt(x,z,t),currentAt:()=>[0,0,0],snagAt:()=>({contact:false,abrasionRate:0})};}
function updateStatus(){if(!controller||!statusEl)return;const s=controller.status();statusEl.textContent=`鱼 ${s.fishId} · 张力 ${s.tension.toFixed(1)} · 线 ${s.restLength.toFixed(1)}m · ${s.outcome||s.phase}`;}
function init(){
 game=window.StoneMoneySurvival;hook=game?.handlineCandidate;
 if(!game||!hook||!window.SMIHandlineR01)return false;
 const existing=hook.existingFish();if(!existing.length)return false;
 const f=existing[0];fishId=f.fishId;const pose=hook.playerPose();
 controller=window.SMIHandlineR01.createController({fish:{fishId:f.fishId,position:f.position,velocity:[0.2,0,0.1]},playerPose:pose,lineStrength:80,restLength:Math.max(1.4,Math.hypot(f.position[0]-pose.position[0],f.position[1]-pose.position[1],f.position[2]-pose.position[2])+.25),seed:0x534d4901});
 try{const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(saved?.fishId===fishId)controller.restore(saved);}catch(_){localStorage.removeItem(SAVE_KEY);}
 buildUi();window.__SMI_HANDLINE_R01__={tag:TAG,getState:()=>controller.snapshot(),fishId};return true;
}
function frame(now){
 if(!controller&&!init()){requestAnimationFrame(frame);return;}
 const dt=Math.min(.033,Math.max(1/240,last?(now-last)/1000:1/60));last=now;
 const playing=game.getMode()==='playing';controller.setPaused(!playing);
 if(playing&&!controller.state.session.outcome){controller.setPlayerPose(hook.playerPose());for(const [k,v] of Object.entries(held))controller.setControl(k,v);const sub=Math.max(1,Math.ceil(dt/(1/120))),step=dt/sub;for(let i=0;i<sub;i++)controller.tick(step,environment());const st=controller.status(),v=controller.state.session.fish.velocity,yaw=Math.atan2(v[0],v[2]);hook.setFishPose(st.fishId,st.fishPosition,yaw);renderLine(st.anchor,st.fishPosition);if((controller.state.telemetry.ticks%60)===0)localStorage.setItem(SAVE_KEY,JSON.stringify(controller.snapshot()));}
 updateStatus();requestAnimationFrame(frame);
}
const keyMap={KeyR:'reel',KeyF:'give',KeyZ:'angleLeft',KeyX:'angleRight',Space:'lift'};
addEventListener('keydown',e=>{const k=keyMap[e.code];if(!k||e.repeat)return;if(game?.getMode()==='playing'){e.preventDefault();setHeld(k,true);}});addEventListener('keyup',e=>{const k=keyMap[e.code];if(k){e.preventDefault();setHeld(k,false);}});addEventListener('blur',()=>Object.keys(held).forEach(k=>setHeld(k,false)));document.addEventListener('visibilitychange',()=>{if(document.hidden&&controller){localStorage.setItem(SAVE_KEY,JSON.stringify(controller.snapshot()));controller.setPaused(true);}});
requestAnimationFrame(frame);
})();
