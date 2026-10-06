// KAOPU camera/interaction adapter. Manta anatomy, material and original textures stay in the verified original module.
(() => {
  'use strict';
  const original = SHADERS.mantaOriginal09;
  const startText = '    vec3 pos = (sin(time*0.14)*2.+4.5)*vec3(sin(time*.5), 0.0, cos(time*.5));';
  const endText = 'dir = Rotate_Y(dir, rot);';
  const start = original.fs.indexOf(startText), end = original.fs.indexOf(endText, start) + endText.length;
  if (start < 0 || end < start || original.fs.indexOf(startText, start + 1) >= 0) throw Error('Manta原相机段不匹配；观察模式未建立');
  const camera = `    // KAOPU observation camera only; original Scene/Trace/GetColour are unchanged.
    vec3 target = vec3(0.0, uMantaCamera.w, -time);
    float yaw = uMantaCamera.x, pitch = uMantaCamera.y, radius = uMantaCamera.z;
    vec3 pos = target + radius * vec3(sin(yaw)*cos(pitch), sin(pitch), cos(yaw)*cos(pitch));
    vec3 forward = normalize(target-pos);
    vec3 right = normalize(cross(forward, vec3(0.0,1.0,0.0)));
    vec3 up = cross(right,forward);
    dir = normalize(uv.x*right + uv.y*up + forward);
    // Align the original background projection with the pitched world ray.
    uv.y = dir.y;`;
  const adapted = original.fs.slice(0,start) + camera + original.fs.slice(end);
  SHADERS.mantaObserve09 = {dim:3, vs:original.vs, fs:adapted.replace('uniform vec3 iResolution;', 'uniform vec4 uMantaCamera;uniform vec3 iResolution;')};
  const state = {mode:'original',yaw:0,pitch:0,radius:5,targetY:0};
  let api = null, pointers = new Map(), pinch = null;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function seed(time) {
    const t = time + 32.2;
    state.yaw = t*.5; state.pitch = 0; state.radius = Math.sin(t*.14)*2+4.5; state.targetY = .7*Math.sin(t*.2);
  }
  function show() {
    if (!api) return;
    document.getElementById('mantaControls').hidden = !api.isActive();
    for (const [id,mode] of [['mantaOriginalMode','original'],['mantaObserveMode','observe']]) {
      const b=document.getElementById(id); b.classList.toggle('on',state.mode===mode);b.setAttribute('aria-pressed',String(state.mode===mode));
    }
    document.getElementById('mantaModeNote').textContent = state.mode==='original' ? '原作游览 · 拖动画面即可进入三维观察' : '三维观察 · 单指拖动旋转，滚轮或双指缩放；暂停后仍可观察';
  }
  function constrain() {const vertical=Math.abs(Math.sin(state.pitch));if(vertical>.001)state.radius=Math.min(state.radius,(9-Math.abs(state.targetY))/vertical);}
  function change() { constrain();show(); if(api&&api.isActive()) api.changed(); }
  function observe() { if(state.mode!=='observe'){seed(api.clock());state.mode='observe';change();} }
  function setMode(mode) { if(mode==='observe') observe();else{state.mode='original';change();} }
  function deactivate() {
    if(!api)return;const ids=[...pointers.keys()];pointers.clear();pinch=null;
    for(const id of ids)if(api.canvas.hasPointerCapture(id))api.canvas.releasePointerCapture(id);
  }
  function twoPoints() {const [a,b]=[...pointers.values()];return {distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  function rotate(dx,dy) {const r=api.canvas.getBoundingClientRect();state.yaw-=dx/Math.max(1,r.width)*Math.PI*2;state.pitch=clamp(state.pitch+dy/Math.max(1,r.height)*Math.PI,-1.4,1.4);}
  function attach(options) {
    api=options;const cv=api.canvas;
    document.getElementById('mantaOriginalMode').onclick=()=>setMode('original');
    document.getElementById('mantaObserveMode').onclick=()=>setMode('observe');
    document.getElementById('mantaResetView').onclick=()=>{seed(api.clock());state.mode='observe';change();};
    cv.addEventListener('pointerdown',e=>{
      if(!api.isActive()||e.button>0)return;e.preventDefault();observe();cv.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=pointers.size===2?twoPoints():null;
    });
    cv.addEventListener('pointermove',e=>{
      if(!api.isActive()||!pointers.has(e.pointerId))return;
      const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){const next=twoPoints();if(pinch){rotate(next.x-pinch.x,next.y-pinch.y);if(next.distance>0)state.radius=clamp(state.radius*pinch.distance/next.distance,1.2,28);}pinch=next;}
      else if(pointers.size===1)rotate(e.clientX-old.x,e.clientY-old.y);
      change();
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])cv.addEventListener(event,e=>{
      if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);pinch=null;if(event!=='lostpointercapture'&&cv.hasPointerCapture(e.pointerId))cv.releasePointerCapture(e.pointerId);
    });
    cv.addEventListener('wheel',e=>{if(!api.isActive())return;e.preventDefault();observe();state.radius=clamp(state.radius*Math.exp(e.deltaY*.001),1.2,28);change();},{passive:false});
    show();
  }
  function sampleWidth(canvas) {const css=canvas.getBoundingClientRect().width||960,dpr=Math.min(window.devicePixelRatio||1,2);return Math.min(1920,Math.max(720,Math.ceil(css*dpr/8)*8));}
  window.KaopuMantaObserver=Object.freeze({attach,deactivate,show,sampleWidth,get mode(){return state.mode;},get camera(){return [state.yaw,state.pitch,state.radius,state.targetY];},get status(){return {mode:state.mode,camera:[...this.camera],cameraAdapterOnly:true,originalProgramUntouched:true,sourceSha256:'679e35942e1285cd4c5c2543896050fa6ab2326f73495d1e44be203435118c78',pointerCount:pointers.size};}});
})();
