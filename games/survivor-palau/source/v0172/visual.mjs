// V0172 visual-readability instrumentation. This does not alter the fishing result or add aim assist.
let pilotLensObserver=null;
function pilotSyncObservationLens(){
 const lens=document.getElementById('pilotLensOverlay');
 if(!lens)return false;
 const active=!!SURVIVAL?.observation?.active;
 if(lens.hidden===active)lens.hidden=!active;
 lens.style.setProperty('display','block','important');
 lens.style.opacity=active?'1':'0';
 lens.style.visibility=active?'visible':'hidden';
 lens.setAttribute('aria-hidden',active?'false':'true');
 return active;
}
function pilotSetReelHeld(active,source='fallback'){
 const f=window.PalauExperience?.fishing;
 if(!f)return false;
 const next=!!active&&f.phase==='reel'&&!config.paused;
 if(f.held!==next){
  f.holdInputTransitions=(f.holdInputTransitions||0)+1;
  f.lastHoldInput=source;
 }
 f.held=next;
 f.holdPointerActive=next;
 const button=document.getElementById('actionFish');
 if(button)button.dataset.held=next?'true':'false';
 if(typeof SURVIVAL!=='undefined'){
  SURVIVAL.telemetry.reelHeld=next;
  SURVIVAL.telemetry.reelHoldInput=source;
  SURVIVAL.telemetry.reelHoldTransitions=f.holdInputTransitions||0;
 }
 return next;
}
function pilotEventInsideButton(event,button){
 const r=button.getBoundingClientRect(),x=Number(event.clientX),y=Number(event.clientY);
 return Number.isFinite(x)&&Number.isFinite(y)&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
}
function installPilotReelInputGuard(){
 const button=document.getElementById('actionFish');
 if(!button||button.dataset.reelInputGuard==='v0172')return false;
 button.dataset.reelInputGuard='v0172';
 const press=(event,source)=>{
  const f=window.PalauExperience?.fishing;
  if(!f||f.phase!=='reel'||config.paused||!pilotEventInsideButton(event,button))return;
  if(typeof event.button==='number'&&event.button!==0)return;
  if(pilotSetReelHeld(true,source)&&event.cancelable)event.preventDefault();
 };
 const release=source=>{
  const f=window.PalauExperience?.fishing;
  if(!f||!f.holdPointerActive)return;
  const consumed=f.holdPointerActive;
  pilotSetReelHeld(false,source);
  if(consumed)f.suppressClick=true;
 };
 // Capture at window level so the hold still works when browser automation, a child label,
 // or an overlaid HUD element becomes the event target. This remains a real press/release action.
 addEventListener('pointerdown',event=>press(event,`pointer:${event.pointerType||'unknown'}`),true);
 addEventListener('pointerup',()=>release('pointerup'),true);
 addEventListener('pointercancel',()=>release('pointercancel'),true);
 addEventListener('mousedown',event=>press(event,'mouse-fallback'),true);
 addEventListener('mouseup',()=>release('mouseup-fallback'),true);
 button.addEventListener('touchstart',event=>{
  const touch=event.changedTouches?.[0];
  if(touch)press(touch,'touch-fallback');
  if(window.PalauExperience?.fishing?.held&&event.cancelable)event.preventDefault();
 },{passive:false});
 for(const type of ['touchend','touchcancel'])button.addEventListener(type,()=>release(type),{passive:true});
 button.addEventListener('keydown',event=>{
  if((event.code==='Space'||event.code==='Enter')&&pilotSetReelHeld(true,'keyboard'))event.preventDefault();
 });
 button.addEventListener('keyup',event=>{
  if(event.code==='Space'||event.code==='Enter'){
   const f=window.PalauExperience?.fishing,consumed=!!f?.holdPointerActive;
   pilotSetReelHeld(false,'keyboard-release');
   if(consumed)f.suppressClick=true;
   event.preventDefault();
  }
 });
 addEventListener('blur',()=>pilotSetReelHeld(false,'window-blur'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pilotSetReelHeld(false,'page-hidden')});
 SURVIVAL.telemetry.reelInputGuard='pointer+mouse+touch+keyboard';
 window.PalauExperience.setFishingHeld=pilotSetReelHeld;
 return true;
}
function pilotObservationVisualMetrics(){
 pilotSyncObservationLens();
 const o=SURVIVAL.observation,eye=[o.anchorX,o.bobY-.055,o.anchorZ],focalPx=Math.max(1,innerHeight)/(2*Math.tan(camera.fov*.5));
 const focusWater=waveAt(o.focusX,o.focusZ,physicalTime,config).eta,focus=[o.focusX,focusWater-.72,o.focusZ];
 const targetRangeM=Math.hypot(focus[0]-eye[0],focus[1]-eye[1],focus[2]-eye[2]);
 const cameraFocusXZErrorM=Math.hypot(camera.target[0]-focus[0],camera.target[2]-focus[2]);
 const n=SURVIVAL.fish.length,candidate=n?SURVIVAL.fish[((SURVIVAL.fishing.candidate%n)+n)%n]:null;
 let candidateFishLengthPx=0;
 if(candidate){const d=Math.max(.15,Math.hypot(candidate.x-eye[0],candidate.y-eye[1],candidate.z-eye[2]));candidateFishLengthPx=.68*candidate.size/d*focalPx}
 let baitDiameterPx=0,baitRangeM=0;
 if(FISH.target){const b=pilotBaitPoint();baitRangeM=Math.max(.15,Math.hypot(b[0]-eye[0],b[1]-eye[1],b[2]-eye[2]));baitDiameterPx=.18/baitRangeM*focalPx}
 return{targetRangeM,cameraFocusXZErrorM,candidateFishLengthPx,baitDiameterPx,baitRangeM,solidLensCount:0,lensFrame:'thin-screen-space',visibleFishCount:SURVIVAL.telemetry.visibleFishCount,reelInputGuard:SURVIVAL.telemetry.reelInputGuard};
}
function installPilotObservationVisual(){
 SURVIVAL.telemetry.surfaceGearSolidLensCount=0;
 SURVIVAL.telemetry.lensFrame='thin-screen-space';
 SURVIVAL.telemetry.observationVisualCandidate=true;
 const lens=document.getElementById('pilotLensOverlay');
 if(lens){
  pilotLensObserver?.disconnect();
  pilotLensObserver=new MutationObserver(()=>pilotSyncObservationLens());
  pilotLensObserver.observe(lens,{attributes:true,attributeFilter:['hidden']});
  pilotSyncObservationLens();
 }
 installPilotReelInputGuard();
 window.PalauExperience.observationVisualMetrics=pilotObservationVisualMetrics;
 window.PalauExperience.syncObservationLens=pilotSyncObservationLens;
 qa.observationVisualV0172=true;
 qa.reelInputGuardV0172=true;
}
