import * as THREE from './vendor/three.module.js';
import {createGallery} from './scene.js';
import {ObservationCycle, approach, rotateToTarget} from './core.js';
import {loadApprovedPerson} from './integration/load-approved-person.mjs';

const $=id=>document.getElementById(id), canvas=$('view');
let renderer;
try {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
} catch(error) {
  $('notice').hidden=false;$('notice').textContent='此浏览器没有可用的 WebGL 2 图形环境，场景未能渲染。请换用支持 WebGL 的浏览器。';
  $('start').disabled=true;throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
// The room, lights and posed person are static between explicit state changes.
// Keep full shadow resolution, but do not redraw both maps for a stationary camera.
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
const gallery=createGallery(THREE), scene=gallery.scene;
const camera=new THREE.PerspectiveCamera(53,1,.06,60);
const cycle=new ObservationCycle(), keys=new Set(), velocity=new THREE.Vector2();
const player={x:1.3,z:1.8,yaw:0,pitch:0};
const target=new THREE.Vector3(), projected=new THREE.Vector3(), direction=new THREE.Vector3();
const ray=new THREE.Raycaster();
let started=false,paused=false,zoomToggle=false,drag=null,lastTime=0,elapsed=0,frames=0,visible=false,focused=false,rendered=false;
let gazeOccluded=false,debugOpen=false,distance=0;
let renderDirty=true,lastRenderPose='';
const collisionBoxes=(gallery.collisionBoxes||[{min:[-.72,0,-6.02],max:[.72,1.3,-4.58]}])
  .map(b=>new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max)).expandByScalar(.24));
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;

function focusPosition(){ gallery.focusTarget.getWorldPosition(target);return target; }
function resetPose(){Object.assign(player,{x:1.3,z:1.8});camera.position.set(player.x,1.65,player.z);Object.assign(player,rotateToTarget(camera.position,focusPosition()));velocity.set(0,0);}
resetPose();

class RoomAudio {
  constructor(){this.context=null;this.enabled=true;this.position=[-1.75,1.3,-5.6];this.chimes=0;}
  async start(){
    if(!this.context){
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx)return false;
      const c=this.context=new AudioCtx(),master=this.master=c.createGain();master.gain.value=.28;master.connect(c.destination);
      const p=this.panner=c.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=1.5;p.maxDistance=20;p.rolloffFactor=.9;
      p.connect(master);this.setPhase(0);
      const hum=this.hum=c.createOscillator(),humGain=c.createGain(),filter=c.createBiquadFilter();
      hum.type='sine';hum.frequency.value=82.4;humGain.gain.value=.034;filter.type='lowpass';filter.frequency.value=190;
      hum.connect(humGain).connect(filter).connect(p);hum.start();
      const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate), data=buffer.getChannelData(0);let seed=901,prev=0;
      for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;prev=.985*prev+.015*(seed/2147483648-1);data[i]=prev*.2;}
      const noise=this.noise=c.createBufferSource(),gain=c.createGain();noise.buffer=buffer;noise.loop=true;gain.gain.value=.6;
      noise.connect(gain).connect(p);noise.start();
      const impulse=c.createBuffer(2,Math.floor(c.sampleRate*.55),c.sampleRate);
      for(let ch=0;ch<2;ch++){const d=impulse.getChannelData(ch);for(let i=0;i<d.length;i++){seed=(1664525*seed+1013904223)>>>0;d[i]=(seed/2147483648-1)*Math.pow(1-i/d.length,3)*.18;}}
      this.reverb=c.createConvolver();this.reverb.buffer=impulse;const wet=c.createGain();wet.gain.value=.16;this.reverb.connect(wet).connect(master);
    }
    if(this.context.state==='suspended')await this.context.resume();this.applyGain();return true;
  }
  applyGain(){if(this.context)this.master.gain.setTargetAtTime(this.enabled?.28:0,this.context.currentTime,.08);}
  setEnabled(v){this.enabled=v;this.applyGain();}
  setPhase(n){this.position=n===1?[1.7,1.3,-5.5]:n===2?[.2,1.5,-7.4]:[-1.75,1.3,-5.6];if(this.panner){this.panner.positionX.value=this.position[0];this.panner.positionY.value=this.position[1];this.panner.positionZ.value=this.position[2];}}
  ping(){if(!this.context||this.context.state!=='running')return;this.chimes++;const c=this.context,t=c.currentTime;
    for(const [f,a] of [[466.16,.055],[938,.02],[1373,.006]]){const o=c.createOscillator(),g=c.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.013);g.gain.exponentialRampToValueAtTime(.0001,t+.95);o.connect(g);g.connect(this.panner);g.connect(this.reverb);o.start(t);o.stop(t+1);}
  }
  update(){if(!this.context)return;camera.getWorldDirection(direction);const l=this.context.listener,p=camera.position;
    if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;l.forwardX.value=direction.x;l.forwardY.value=direction.y;l.forwardZ.value=direction.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
    else{l.setPosition(p.x,p.y,p.z);l.setOrientation(direction.x,direction.y,direction.z,0,1,0);}
  }
  snapshot(){return {created:!!this.context,state:this.context?.state||'not-started',enabled:this.enabled,position:[...this.position],chimes:this.chimes,masterGain:this.master?.gain.value||0};}
}
const audio=new RoomAudio();
let human=null,humanAbort=null,humanTicket=0,humanState={status:'not-loaded',progress:0,verifiedVisual:false};
$('humanButton').addEventListener('click',async()=>{
  if(humanAbort){humanTicket++;humanAbort.abort();humanAbort=null;humanState={status:'cancelled',progress:0,verifiedVisual:false};$('humanButton').textContent='载入现有人物';$('humanStatus').textContent='已取消，未放入替代模型';return;}
  if(human){human.adapter.dispose();human=null;renderDirty=true;renderer.shadowMap.needsUpdate=true;humanState={status:'not-loaded',progress:0,verifiedVisual:false};$('humanButton').textContent='载入现有人物';$('humanStatus').textContent='已释放人物；原工作台与参数未改';return;}
  const ticket=++humanTicket,aborter=humanAbort=new AbortController();humanState={status:'loading',progress:0,verifiedVisual:false};$('humanButton').textContent='取消人物载入';$('humanStatus').textContent='读取原人物运行时与已锁定资产…';
  try{
    const loaded=await loadApprovedPerson({THREE,scene,signal:aborter.signal,requestRender:()=>{renderDirty=true;renderer.shadowMap.needsUpdate=true;},onProgress:p=>{if(ticket===humanTicket){humanState.progress=p.fraction;$('humanStatus').textContent='载入并校验原资产 '+Math.round(p.fraction*100)+'%';}}});
    if(ticket!==humanTicket){loaded.adapter.dispose();return;}
    human=loaded;humanState={status:'loaded',progress:1,verifiedVisual:false,vertices:loaded.metadata.vertices,triangles:loaded.metadata.triangles,sourceCommit:loaded.source.sourceCommit};$('humanButton').textContent='释放人物';$('humanStatus').textContent='原网格与原皮肤已接入 · 场景光照仍待验收';
  }catch(e){if(ticket===humanTicket){humanState={status:e.name==='AbortError'?'cancelled':'error',progress:0,verifiedVisual:false,error:e.message};$('humanButton').textContent='重新载入人物';$('humanStatus').textContent=e.name==='AbortError'?'已取消':('载入未完成：'+e.message);}}
  finally{if(ticket===humanTicket)humanAbort=null;}
});

function clearInput(){keys.clear();velocity.set(0,0);drag=null;}
function setPause(value){paused=value;clearInput();document.body.classList.toggle('paused',paused);$('pause').textContent=paused?'继续':'暂停';$('pause').setAttribute('aria-pressed',String(paused));
  if(audio.context){if(paused)audio.context.suspend();else if(started)audio.context.resume();}updateHud();}
async function start(){if(started)return;started=true;paused=false;$('welcome').hidden=true;$('hud').hidden=false;document.body.classList.add('entered');await audio.start();canvas.focus();}
function reset(){cycle.reset();gallery.applyPhase(0);renderDirty=true;renderer.shadowMap.needsUpdate=true;audio.setPhase(0);audio.chimes=0;zoomToggle=false;$('zoom').setAttribute('aria-pressed','false');clearInput();resetPose();camera.fov=53;camera.updateProjectionMatrix();setPause(false);updateHud();}
$('start').addEventListener('click',start);
$('pause').addEventListener('click',()=>{if(started)setPause(!paused);});
$('reset').addEventListener('click',reset);
$('zoom').addEventListener('click',()=>{zoomToggle=!zoomToggle;$('zoom').setAttribute('aria-pressed',String(zoomToggle));});
$('sound').addEventListener('click',()=>{audio.setEnabled(!audio.enabled);$('sound').textContent=audio.enabled?'声音 开':'声音 关';$('sound').setAttribute('aria-pressed',String(audio.enabled));});
$('debugButton').addEventListener('click',()=>{debugOpen=!debugOpen;$('debug').hidden=!debugOpen;$('debugButton').setAttribute('aria-pressed',String(debugOpen));});
window.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.code==='Escape'){if(started)setPause(!paused);return;}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();if(started&&!paused)keys.add(e.code);}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{if(started)setPause(true);else clearInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started)setPause(true);});
canvas.addEventListener('pointerdown',e=>{if(!started||paused)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus();});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||paused)return;const scale=e.pointerType==='touch'?.004:.0032;player.yaw-=(e.clientX-drag.x)*scale;player.pitch=Math.max(-.9,Math.min(.9,player.pitch-(e.clientY-drag.y)*scale));drag.x=e.clientX;drag.y=e.clientY;});
function endDrag(e){if(drag?.id===e.pointerId)drag=null;}
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.querySelectorAll('[data-key]').forEach(button=>{const key=button.dataset.key;button.addEventListener('pointerdown',e=>{e.preventDefault();if(!started||paused)return;button.setPointerCapture(e.pointerId);keys.add(key);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>keys.delete(key));});
function isFree(x,z){return !collisionBoxes.some(b=>x>b.min.x&&x<b.max.x&&z>b.min.z&&z<b.max.z);}
function movePlayer(dx,dz){const count=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06));for(let i=0;i<count;i++){
  const nx=Math.max(-3.27,Math.min(3.27,player.x+dx/count));if(isFree(nx,player.z))player.x=nx;
  const nz=Math.max(-8.65,Math.min(2.42,player.z+dz/count));if(isFree(player.x,nz))player.z=nz;
}}
function controls(dt){
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const norm=Math.hypot(forward,right)||1,speed=(keys.has('Space')||zoomToggle)?1.05:1.65;
  const tx=(-Math.sin(player.yaw)*forward+Math.cos(player.yaw)*right)/norm*speed;
  const tz=(-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*right)/norm*speed;
  velocity.x=approach(velocity.x,tx,12,dt);velocity.y=approach(velocity.y,tz,12,dt);movePlayer(velocity.x*dt,velocity.y*dt);
}
function visibility(){
  focusPosition();distance=camera.position.distanceTo(target);projected.copy(target).project(camera);
  const inFrame=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<.33&&Math.abs(projected.y)<.3&&distance<6.2;
  gazeOccluded=false;if(inFrame){direction.copy(target).sub(camera.position).normalize();ray.set(camera.position,direction);ray.far=distance-.08;gazeOccluded=ray.intersectObjects(gallery.occluders||[],true).some(h=>h.object.visible);}
  focused=inFrame&&!gazeOccluded;visible=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<.93&&Math.abs(projected.y)<.9;
  return focused;
}
function updateHud(){
  $('phase').textContent=`${String(cycle.phase+1).padStart(2,'0')} / 03`;
  $('gazeMeter').style.width=`${Math.min(1,cycle.gazeSeconds/.85)*100}%`;
  $('hint').textContent=paused?'已暂停，继续后再观察':cycle.stage==='complete'?'三次观察完成。你记住了哪些变化？':cycle.stage==='observed'?'已经记住了。移开视线，再回来。':distance>6.2?'靠近展台，观察白色标本':focused?'让目光停留一会':'观察展台上的白色标本';
  $('reticle').classList.toggle('seen',focused&&started&&!paused);
  if(debugOpen)$('debug').textContent=JSON.stringify({phase:cycle.phase,stage:cycle.stage,gaze:+cycle.gazeSeconds.toFixed(2),visible,focused,occluded:gazeOccluded,distance:+distance.toFixed(2),position:[+player.x.toFixed(2),+player.z.toFixed(2)],audio:audio.snapshot(),lastEvents:cycle.events.slice(-4)},null,2);
}
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderDirty=true;}
addEventListener('resize',resize);resize();
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true);$('notice').hidden=false;$('notice').textContent='图形上下文已中断。场景暂停，请重新载入后再观察。';});
function animate(time){requestAnimationFrame(animate);const dt=Math.min(.05,lastTime?(time-lastTime)/1000:1/60);lastTime=time;
  if(started&&!paused){elapsed+=dt;controls(dt);}
  camera.position.set(player.x,1.65,player.z);camera.rotation.set(player.pitch,player.yaw,0,'YXZ');
  const desired=(keys.has('Space')||zoomToggle)?34:53;camera.fov=reducedMotion?desired:approach(camera.fov,desired,9,dt);if(Math.abs(camera.fov-desired)<.001)camera.fov=desired;camera.updateProjectionMatrix();camera.updateMatrixWorld();scene.updateMatrixWorld();
  visibility();
  // Confirmation uses focused gaze; looking away requires leaving the wider frame.
  const seenForCycle=cycle.stage==='observed'?visible:focused;
  const event=cycle.update(dt,seenForCycle,started&&!paused);
  if(event==='change'||event==='complete'){gallery.applyPhase(cycle.phase);renderDirty=true;renderer.shadowMap.needsUpdate=true;audio.setPhase(cycle.phase);audio.ping();}
  gallery.animate?.(started&&!paused?dt:0,elapsed);audio.update();updateHud();
  const pose=[player.x,player.z,player.yaw,player.pitch,camera.fov,camera.aspect].map(v=>v.toFixed(6)).join('|');
  if(renderDirty||pose!==lastRenderPose){renderer.render(scene,camera);frames++;rendered=true;renderDirty=false;lastRenderPose=pose;}
}
requestAnimationFrame(animate);
window.__study={
  getState:()=>({...cycle.snapshot(),started,paused,rendered,frames,renderPending:renderDirty,focused,visible,occluded:gazeOccluded,distance,position:[player.x,1.65,player.z],yaw:player.yaw,pitch:player.pitch,fov:camera.fov,keys:[...keys],audio:audio.snapshot(),human:{...humanState},threeRevision:THREE.REVISION,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,collisionBoxes:collisionBoxes.map(b=>({min:b.min.toArray(),max:b.max.toArray()}))}),
  setPose:({x=player.x,z=player.z,yaw=player.yaw,pitch=player.pitch})=>{Object.assign(player,{x:Math.max(-3.27,Math.min(3.27,x)),z:Math.max(-8.65,Math.min(2.42,z)),yaw,pitch:Math.max(-.9,Math.min(.9,pitch))});velocity.set(0,0);},
  lookAtTarget:()=>{camera.position.set(player.x,1.65,player.z);Object.assign(player,rotateToTarget(camera.position,focusPosition()));},
  move:movePlayer,reset,pause:setPause,focusPosition:()=>focusPosition().toArray()
  ,humanReport:()=>human?.adapter.report()||null
};
