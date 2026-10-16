import * as THREE from '../vendor/three.module.js';
import {NativeMotion} from '../vendor/fiber/NativeMotion.mjs';
import {PlannedFiberView} from './PlannedFiberView.mjs';
import {PhotoDynamics} from './PhotoDynamics.mjs';

const state={ready:false,busy:true,errors:[],mode:'hair',color:'black',motion:'still',paused:false,physics:true,speed:1,frames:0,elapsed:0};
let viewer,model,api,fibers,motion,dynamics,last=0,manual=false,follow=null,followRest=null,view='reference',request=0;
const status=text=>{const el=document.querySelector('#integration-status');if(el)el.textContent=text;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function render(){motion?.prepareRender();viewer.renderer.shadowMap.needsUpdate=true;viewer.render();}
function frame(time){request=requestAnimationFrame(frame);if(!state.ready||state.busy||manual)return;const dt=last?Math.min(.1,(time-last)/1000):1/60;last=time;
 if(!state.paused&&(motion.playing||dynamics?.wind||dynamics?.dynamics.active)){
  if(dynamics&&state.physics)dynamics.update(dt);else if(motion.playing)motion.advance(dt*(dynamics?.speed||1));
  motion.updateAttachments();followCamera();render();state.frames++;state.elapsed+=dt;}
}
function followCamera(){if(view==='body'||!motion.active||!followRest)return;const M=viewer.mesh.matrixWorld,delta=M.clone().multiply(motion.skinMatrix('head')).multiply(M.clone().invert()),p=followRest.clone().applyMatrix4(delta);if(follow){const d=p.clone().sub(follow);viewer.orbit.target.add(d);viewer.camera.position.add(d);}follow=p;}
function setView(id){view=id;api.setView(id);followRest=viewer.orbit.target.clone();follow=followRest.clone();followCamera();render();}
async function setMotion(id){if(state.busy)return;state.busy=true;status('正在准备动作和头发…');try{
 if(id==='still'){motion.stop();dynamics?.reset();fibers.u.physicsOn.value=0;state.motion='still';state.paused=false;follow=null;setView(view);return;}
 if(state.mode==='volume')setMode('hair');
 // Initialize the copied solver at the neutral groom so its reference is the
 // same F12 shape, before the first captured pose is applied.
 if(!dynamics){await wait(30);dynamics=new PhotoDynamics(fibers,motion,viewer,model);dynamics.speed=state.speed;}
 motion.stop();dynamics.reset();await motion.select(id);state.motion=id;state.paused=false;dynamics.dynamics.active=true;last=0;follow=null;motion.prepareRender();setView(view);
 }catch(e){state.errors.push(String(e.stack||e));status(e.message);throw e;}finally{state.busy=false;sync();}}
function setMode(value){if(value==='volume'&&motion.active){motion.stop();state.motion='still';dynamics?.reset();}state.mode=value;fibers.mode(value);api.display({strands:false,volumes:value==='volume'});api.setGroups(value!=='hair','all');fibers.source.visible=false;sync();render();}
function sync(){document.querySelectorAll('[data-f13-motion]').forEach(b=>{b.classList.toggle('on',b.dataset.f13Motion===state.motion);b.disabled=state.busy;});document.querySelectorAll('[data-f13-mode]').forEach(b=>b.classList.toggle('on',b.dataset.f13Mode===state.mode));const p=document.querySelector('#f13-pause');if(p)p.textContent=state.paused?'继续播放':'暂停动作';if(!state.busy)status(state.motion==='still'?'静止造型 · 与 F12 同一套根区和完整路径':({walk:'行走',run:'跑步',jump:'跳跃'}[state.motion])+' · 可暂停、半速或切换角度');}
function report(){return{...state,version:'F13-photo-fiber-motion',fibers:fibers?.report(),motionReport:motion?.report(),physicsReport:dynamics?.report(),nativeMeshSame:viewer?.mesh===window.__F13_ORIGINAL_MESH__,mouseControlled:false};}
window.hairF13={report,verifyGPU:()=>fibers.verifyGPU(),setMotion,setMode,setColor:id=>{state.color=id;fibers.color(id);render();},setView,pause:value=>{state.paused=!!value;last=0;sync();},setSpeed:value=>{state.speed=value;if(dynamics)dynamics.speed=value;},setPhysics:value=>{state.physics=!!value;if(dynamics)dynamics.enabled=!!value;fibers.u.physicsOn.value=value?1:0;render();},setManual:value=>{manual=!!value;last=0;},step:async(dt=1/60)=>{if(!state.ready||state.busy)throw Error('Integration not ready');if(dynamics&&state.physics)dynamics.update(dt);else if(motion.playing)motion.advance(dt*state.speed);motion.updateAttachments();followCamera();render();state.frames++;return report();},reset:()=>setMotion('still')};

(async()=>{try{
 while(!window.hairF12?.diagnostics().ready||window.hairF12.diagnostics().busy)await wait(100);
 api=window.hairF12;viewer=window.__IDENTITY_QA__.viewer();model=window.__IDENTITY_QA__.model();window.__F13_ORIGINAL_MESH__=viewer.mesh;window.lifelikeIdle?.pause(true);
 const panel=document.querySelector('#hair-panel'),old=document.createElement('details');old.id='f13-source-editor';old.hidden=true;old.innerHTML='<summary>造型分束与局部定型</summary>';while(panel.firstChild)old.append(panel.firstChild);panel.append(old);
 const top=document.createElement('section');top.id='f13-controls';top.innerHTML=`<div class="eyebrow">PHOTO GROOM / F13</div><h2>发型 · 发丝与动作</h2><p class="sub">沿用这张参考图的 43 个发束，接入毛发工作台的发丝光照与人物动作。</p>
 <div class="control"><h3>查看效果</h3><div class="grid"><button data-f13-mode="hair" class="on">完整头发</button><button data-f13-mode="groups">分束着色</button><button data-f13-mode="volume">半透明发块</button></div><div class="f13-colors"><button data-f13-color="black">自然黑</button><button data-f13-color="brown">深棕</button><button data-f13-color="auburn">暖棕</button><button data-f13-color="blonde">浅金</button></div></div>
 <div class="control"><h3>人物动作</h3><div class="grid"><button data-f13-motion="still" class="on">静止</button><button data-f13-motion="walk">行走</button><button data-f13-motion="run">跑步</button><button data-f13-motion="jump">跳跃</button></div><div class="grid f13-row"><button id="f13-pause">暂停动作</button><select id="f13-speed"><option value="1">正常速度</option><option value=".5">半速检查</option><option value=".25">四分之一速度</option></select></div><label class="check"><input id="f13-physics" type="checkbox" checked>头发响应动作惯性</label><label class="check"><input id="f13-wind" type="checkbox">轻微环境风</label><p class="sub">先看静止轮廓，再切走跑跳；半速和暂停便于检查刘海、耳侧与肩部。</p></div>
 <div class="control"><h3>观察角度</h3><div class="grid"><button data-f13-view="body">全身动作</button><button data-f13-view="reference">参考角度</button><button data-f13-view="front">正面</button><button data-f13-view="side">侧面</button><button data-f13-view="back">后脑</button><button data-f13-view="top">头顶</button></div></div><p id="integration-status">正在接入真实发丝…</p>`;panel.prepend(top);
 for(const b of top.querySelectorAll('[data-f13-motion]'))b.onclick=()=>setMotion(b.dataset.f13Motion).catch(console.error);for(const b of top.querySelectorAll('[data-f13-mode]'))b.onclick=()=>setMode(b.dataset.f13Mode);for(const b of top.querySelectorAll('[data-f13-color]'))b.onclick=()=>{window.hairF13.setColor(b.dataset.f13Color);for(const c of top.querySelectorAll('[data-f13-color]'))c.classList.toggle('on',c===b);};for(const b of top.querySelectorAll('[data-f13-view]'))b.onclick=()=>window.hairF13.setView(b.dataset.f13View);
 top.querySelector('#f13-pause').onclick=()=>window.hairF13.pause(!state.paused);top.querySelector('#f13-speed').onchange=e=>window.hairF13.setSpeed(Number(e.target.value));top.querySelector('#f13-physics').onchange=e=>window.hairF13.setPhysics(e.target.checked);top.querySelector('#f13-wind').onchange=async e=>{if(!dynamics){await setMotion('walk');motion.stop();state.motion='still';}dynamics.wind=e.target.checked;dynamics.dynamics.active=true;sync();};
 fibers=new PlannedFiberView(api,viewer);motion=new NativeMotion(model,viewer,status);const oldRender=viewer.scene.onBeforeRender;viewer.scene.onBeforeRender=function(...args){oldRender.apply(this,args);fibers.source.visible=false;};
 document.title='参考发型 · 发丝与动作 / F13';document.querySelector('.p-header-center').textContent='参考发型 · 发丝表现与动作检查';document.querySelector('.p-stage-head p').textContent='清俊 P01 · 43 个连续发束 · 完整发丝 · 行走 / 跑步 / 跳跃';
 // Keep source edits available, then rebuild the material view if F12 authors
 // a new groom. This candidate is initially reviewed with its pinned recipe.
 old.addEventListener('change',()=>{dynamics?.updateStyling();});
 state.ready=true;state.busy=false;sync();window.hairF13.setView('reference');render();request=requestAnimationFrame(frame);
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);motion?.dispose();});
 }catch(e){state.errors.push(String(e.stack||e));state.busy=false;status('接入未完成：'+e.message);console.error(e);}})();
