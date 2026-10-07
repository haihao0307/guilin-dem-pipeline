import * as THREE from '../vendor/three.module.js';
import {Session,replay} from './session.mjs';
import {createGameWorld} from './world.mjs';
import {createGameSmoke} from './smoke.mjs';
const $=id=>document.getElementById(id),canvas=$('gameScene'),wrap=$('sceneWrap'),params=new URLSearchParams(location.search),SAVE_KEY='kaopu.train-driver.save.v1';
const renderer=new THREE.WebGLRenderer({canvas,antialias:!(params.has('qa')&&params.get('antialias')==='0'),powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
const gl=renderer.getContext(),debugRenderer=gl.getExtension('WEBGL_debug_renderer_info'),rendererName=debugRenderer?gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1b2425);
const camera=new THREE.PerspectiveCamera(32,1,.1,180),cameraTarget=new THREE.Vector3(-8.8,-.8,1),widePosition=new THREE.Vector3(19,24,38),wideTarget=new THREE.Vector3(-8.8,-.8,1),closePosition=new THREE.Vector3(-2,13,20),closeTarget=new THREE.Vector3(-14.2,1.2,1.4);camera.position.copy(widePosition);camera.lookAt(cameraTarget);
scene.add(new THREE.HemisphereLight(0xd5e6ec,0x273d30,1.4));
const key=new THREE.DirectionalLight(0xffebc4,2.3);key.position.set(1,22,14);key.target.position.set(-8,0,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-34,right:21,top:20,bottom:-19,far:90});key.shadow.normalBias=.05;key.shadow.bias=-.00025;key.shadow.radius=3;scene.add(key,key.target);
const rim=new THREE.DirectionalLight(0xc3dce4,.7);rim.position.set(-14,8,-14);scene.add(rim);
for(const [x,power]of [[1.4,36],[-15,24]]){const fill=new THREE.PointLight(0xf4e5a2,power,24,1.6);fill.position.set(x,5.6,5);scene.add(fill);}
const world=createGameWorld();scene.add(world.root);const smoke=createGameSmoke({legacy:params.get('smoke')==='legacy'});scene.add(smoke.root);
let renderRatio=1,maxRenderRatio=1,frameMs=33,qualityFrames=0,qaRenderAlways=false,qaRenderMode='normal';
let game=new Session({seed:params.get('seed')||'松溪-001',durationMinutes:Number(params.get('duration')||10)}),last=performance.now(),lastHUD=0,lastEvent=0,lastSaveTick=0,noticeUntil=0,needsRender=true,manualCamera=null,summaryShown=false,frameCount=0,fps=0,contextLost=false,saved=null;
const heldBrake=new Set();
$('seed').value=game.config.seed;$('duration').value=String(game.config.durationMinutes);
function say(text,{warning=false,duration=4200}={}){$('notice').textContent=text;$('notice').classList.add('visible');$('notice').classList.toggle('warning',warning);noticeUntil=performance.now()+duration;}
function safeSave(){if(!game.started||game.phase==='summary')return;try{const packet=game.replayPacket();localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,packet,signature:game.signature(),station:game.stationIndex}));lastSaveTick=game.tick;}catch{}}
function clearSaved(){try{localStorage.removeItem(SAVE_KEY);}catch{}saved=null;$('continueSaved').hidden=true;}
try{const raw=localStorage.getItem(SAVE_KEY);if(raw&&raw.length<1500000){const data=JSON.parse(raw);if(data.version===1&&data.packet?.version===1&&Array.isArray(data.packet.inputs)&&data.packet.inputs.length<50000&&data.packet.ticks<38000){saved=data;$('continueSaved').hidden=false;$('continueSaved').textContent='继续上次 · 第 '+(data.station+1)+' 站';}}}catch{}
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;maxRenderRatio=Math.min(devicePixelRatio,1.4,1100/w);renderRatio=maxRenderRatio;frameMs=33;qualityFrames=0;renderer.setPixelRatio(renderRatio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=camera.aspect>=1?32:THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(32)/2)/camera.aspect));camera.updateProjectionMatrix();needsRender=true;}
new ResizeObserver(resize).observe(wrap);
function command(type,value){const result=game.command(type,value);needsRender=true;if(!result.accepted&&type==='station-action')say('先停稳，让车门落在站台范围内。');return result;}
function resetView(){manualCamera=null;camera.position.copy(widePosition);cameraTarget.copy(wideTarget);camera.lookAt(cameraTarget);needsRender=true;}
function start(config){game=new Session(config);world.resetEffects();heldBrake.clear();lastEvent=0;lastSaveTick=0;summaryShown=false;noticeUntil=0;$('notice').classList.remove('visible');$('startScreen').hidden=true;$('pauseScreen').hidden=true;$('summaryScreen').hidden=true;resetView();game.command('start');last=performance.now();needsRender=true;safeSave();canvas.focus();}
function setPaused(value){if(!game.started||game.phase==='summary')return;heldBrake.clear();game.command('brake',false);game.command('pause',value);$('pauseScreen').hidden=!game.paused;$('pause').textContent=game.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',game.paused?'继续游戏':'暂停游戏');safeSave();last=performance.now();needsRender=true;if(!game.paused)canvas.focus();}
function stationAction(){const v=game.view();if(v.station.canRecover&&!v.station.canOpen)return command('recover');return command('station-action');}
function setBrake(source,pressed){if(pressed)heldBrake.add(source);else heldBrake.delete(source);command('brake',heldBrake.size>0);}
$('startGame').addEventListener('click',()=>{clearSaved();start({seed:$('seed').value.trim().slice(0,48)||'松溪-001',durationMinutes:Number($('duration').value)});});
$('continueSaved').addEventListener('click',()=>{try{const restored=replay(saved.packet);if(restored.signature()!==saved.signature)throw new Error('version changed');game=restored;game.command('pause',false);heldBrake.clear();world.resetEffects();lastEvent=game.eventId;summaryShown=false;resetView();$('startScreen').hidden=true;$('pauseScreen').hidden=true;$('summaryScreen').hidden=true;last=performance.now();needsRender=true;canvas.focus();say('回来了，继续这一趟。');}catch{say('这份存档与当前规则不同，可用相同种子重新出发。',{warning:true});clearSaved();}});
$('accelerate').addEventListener('click',()=>command('throttle-up'));$('decelerate').addEventListener('click',()=>command('throttle-down'));
$('brake').addEventListener('pointerdown',e=>{e.preventDefault();$('brake').setPointerCapture(e.pointerId);setBrake('pointer',true);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('brake').addEventListener(name,()=>setBrake('pointer',false));
$('stationAction').addEventListener('click',stationAction);$('recover').addEventListener('click',()=>command('recover'));
$('pause').addEventListener('click',()=>setPaused(!game.paused));$('resume').addEventListener('click',()=>setPaused(false));
for(const id of ['restart','restartPaused','playAgain'])$(id).addEventListener('click',()=>start(game.config));
$('newRoute').addEventListener('click',()=>{const seed='线路-'+Math.floor(Math.random()*0xffffff).toString(36).toUpperCase();$('seed').value=seed;start({...game.config,seed});});
$('cameraView').addEventListener('click',()=>{const effective=manualCamera||((game.serviceLocked()&&game.phase!=='doors-closing')?'carriage':'wide');manualCamera=effective==='carriage'?'wide':'carriage';needsRender=true;});
$('fullScreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('driverGame').requestFullscreen)await $('driverGame').requestFullscreen();else say('当前浏览器未提供全屏，驾驶画面已适应窗口。');}catch{say('可以继续使用当前沉浸窗口。');}});
document.addEventListener('fullscreenchange',()=>{$('fullScreen').setAttribute('aria-label',document.fullscreenElement?'退出全屏':'进入全屏');resize();});
$('saveReplay').addEventListener('click',()=>{const data=JSON.stringify({...game.replayPacket(),signature:game.signature()},null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='火车老司机-本局回放.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
document.addEventListener('keydown',e=>{
  if(/^(INPUT|SELECT|TEXTAREA|A)$/.test(e.target.tagName))return;
  if(e.code==='KeyP'&&game.started&&game.phase!=='summary'){e.preventDefault();if(!e.repeat)setPaused(!game.paused);return;}
  if(!game.started||game.paused||game.phase==='summary'||e.target.closest('.screen'))return;
  if(['ArrowUp','KeyW','ArrowDown','KeyS','Space','KeyE'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='ArrowUp'||e.code==='KeyW')command('throttle-up');if(e.code==='ArrowDown'||e.code==='KeyS')command('throttle-down');if(e.code==='Space')setBrake('keyboard',true);if(e.code==='KeyE')stationAction();
});
document.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();setBrake('keyboard',false);}});
window.addEventListener('blur',()=>{heldBrake.clear();if(game.started&&!game.paused&&game.phase!=='summary')setPaused(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.started&&!game.paused&&game.phase!=='summary')setPaused(true);last=performance.now();});
window.addEventListener('pagehide',safeSave);
function formatClock(seconds){const n=Math.max(0,Math.ceil(seconds));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
function updateHUD(v){
  $('clock').textContent=formatClock(v.remainingTime);$('speed').textContent=v.speedKmh.toFixed(1);$('speed').parentElement.parentElement.classList.toggle('overspeed',v.speedKmh>v.station.limit+3);
  const locked=game.serviceLocked();$('notch').textContent=locked?'车门互锁':v.brake?'正在制动':v.reverse?'低速倒回':v.throttle>0?'牵引 '+v.throttle+' 档':v.throttle<0?'减速 '+(-v.throttle)+' 档':'惰行';for(const[i,node]of [...document.querySelectorAll('.power-dots i')].entries())node.classList.toggle('active',i<=v.throttle+2);
  $('brakingDistance').textContent=v.brakingDistance.toFixed(1)+' m';$('brake').setAttribute('aria-pressed',String(v.brake));$('accelerate').disabled=$('decelerate').disabled=locked||!v.started||v.paused||v.phase==='summary'||v.finishing;
  $('stationName').textContent=v.station.name;$('stationDistance').textContent=(v.station.remaining>=0?'':'越过 ')+Math.abs(v.station.remaining).toFixed(v.station.remaining<20?1:0)+' m';
  $('weather').textContent=(v.station.wet?'雨 · 制动更长':'晴')+' · 限速 '+v.station.limit;$('parkingNeedle').style.left=Math.max(0,Math.min(100,50-v.station.remaining/24*100))+'%';$('stopZone').style.left=(50-v.station.radius/24*100)+'%';$('stopZone').style.width=(v.station.radius/12*100)+'%';
  let hint='车头停在黄色标记旁',action='到站后开门接送',enabled=false;
  if(v.phase==='doors-opening'){hint='车门打开中';action='正在打开车门…';}
  else if(v.phase==='unloading'){hint='先下后上，请等乘客走到站台';action='乘客下车中…';}
  else if(v.phase==='boarding'){hint='乘客正在沿过道入座';action='乘客上车中…';}
  else if(v.phase==='ready-depart'){hint='接送完成，可以发车';action='关门发车';enabled=true;}
  else if(v.phase==='doors-closing'){hint='车门关闭后才会启动';action='正在关门…';}
  else if(v.station.canOpen){hint=v.station.standard?'停得很准，开门接送':'停偏了一点，乘客可以多走几步';action=v.station.standard?'开门接送':'招呼乘客步行上车';enabled=true;}
  else if(v.station.canRecover){hint='还有机会，低速倒回停车区';action='倒回补停';enabled=true;}
  else if(v.reverse){hint='低速倒回，靠近标记时按住制动';action='回到标记后停稳';}
  else if(v.station.missed){hint='漏站了！停稳可在 40 m 内补救';action='先刹停再补救';}
  else if(v.speedKmh<1.3&&(v.station.remaining>7||(!v.station.platformCoverage&&v.station.remaining>0))){hint='停早了，慢慢向前补停';action='继续慢挪到站';}
  else if(v.speedKmh<1.3&&Math.abs(v.station.remaining)<=7){hint='稳住刹车，等列车停稳';action='正在确认停稳…';}
  else if(v.station.remaining<v.brakingDistance+12&&v.station.remaining>0){hint='该提前刹车了';action='停稳后开门';}
  $('stationHint').textContent=hint;$('stationAction').textContent=action;$('stationAction').disabled=!enabled||v.paused||!v.started;$('recover').disabled=!v.station.canRecover||v.paused;
  $('controlNote').innerHTML=v.station.wet?'雨天制动距离更长<br>别等最后一刻才刹车':'提前刹车，停稳后再开门<br>错过了也别慌，还能挽回';
  for(const key of ['pickedUp','delivered','combo','stops','missed'])$(key).textContent=v.stats[key];$('score').textContent=Math.round(v.stats.score)+' 分';$('satisfaction').textContent=Math.round(v.stats.satisfaction);
  const showTutorial=v.started&&!v.paused&&v.elapsed<30&&v.phase!=='summary';$('tutorial').hidden=!showTutorial;if(showTutorial)$('tutorialText').textContent=locked?'乘客会走进真实车门、沿过道入座，等接送完成再发车。':v.station.canOpen?'停稳了。点“开门接送”，或按 E。':v.station.remaining<v.brakingDistance+15?'提前按住制动。停早一点没关系，可以慢慢挪到标记。':'点 ＋ 或按 W 加档。速度是慢慢加起来的，刹车也需要距离。';
  const close=(manualCamera||((locked&&v.phase!=='doors-closing')?'carriage':'wide'))==='carriage';$('cameraView').textContent=close?'全车视角':'车厢观察';$('cameraView').setAttribute('aria-pressed',String(close));
  if(v.phase==='summary'&&!summaryShown){summaryShown=true;clearSaved();$('summaryScreen').hidden=false;$('pauseScreen').hidden=true;$('finalScore').textContent=Math.round(v.stats.score);$('finalPicked').textContent=v.stats.pickedUp;$('finalDelivered').textContent=v.stats.delivered;$('finalCombo').textContent=v.stats.bestCombo;$('finalAccuracy').textContent=(v.stats.stops?Math.round(v.stats.accuracyTotal/v.stats.stops*100):0)+'%';$('finalMistakes').textContent=v.stats.missed+' / '+v.stats.recovered;$('finalSatisfaction').textContent=Math.round(v.stats.satisfaction);$('finalRoute').textContent='线路 '+v.seed+' · '+v.stats.stops+' 站'+(v.stats.lateDropOff?' · '+v.stats.lateDropOff+' 位错站补下':'');$('summaryTitle').textContent=v.stats.stops===0?'下一趟，慢慢找节奏':v.stats.bestCombo>=8?'这位老司机，稳！':v.stats.missed>v.stats.stops?'有点惊险，也接到了人':'这一趟，开得不错';}
}
function events(v){for(const e of v.events){if(e.id<=lastEvent)continue;
  if(e.type==='missed-station')say('漏站了！乘客追来了。先刹停，40 米内还能倒回补救。',{warning:true,duration:6500});
  if(e.type==='recovering')say('慢慢倒回，看到停车标记就按住制动。');
  if(e.type==='stop-complete')say((e.accuracy>.85?'停得漂亮！':'接送完成。')+' 上车 '+e.boarded+' 人，下车 '+e.alighted+' 人'+(e.left?'，还有 '+e.left+' 人等下一班':''));
  if(e.type==='station-left-behind')say('这一站错过了，继续把下一站开好。',{warning:true});
  if(e.type==='departed'){manualCamera=null;say('车门已关好，出发。');}
  if(e.type==='passenger-delivered'&&e.late)say('这位乘客错站补下，满意度稍有下降。',{warning:true,duration:2500});
  if(e.type==='stone-hit')say('咚！记住这次刹车距离。',{warning:true,duration:1300});
  lastEvent=e.id;
}}
function draw(view,dt=1/60,snap=false){
  const close=(manualCamera||((game.serviceLocked()&&view.phase!=='doors-closing')?'carriage':'wide'))==='carriage',targetPosition=close?closePosition:widePosition,targetLook=close?closeTarget:wideTarget;
  const alpha=snap?1:1-Math.exp(-dt*4);camera.position.lerp(targetPosition,alpha);cameraTarget.lerp(targetLook,alpha);camera.lookAt(cameraTarget);camera.updateMatrixWorld();
  world.update(view,game.route,{interior:close});smoke.update(view.elapsed,camera,{speed:view.velocity,braking:view.brake||view.throttle<0,comparison:params.has('smokeComparison')});renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=snap||frameCount%3===0;renderer.render(scene,camera);frameCount++;
  return camera.position.distanceTo(targetPosition)>.015||cameraTarget.distanceTo(targetLook)>.015;
}
function animate(now){requestAnimationFrame(animate);const wallDt=Math.max(.001,(now-last)/1000),dt=Math.min(.25,wallDt);last=now;if(contextLost||qaRenderMode==='idle')return;if(qaRenderMode==='clear-only'){renderer.clear(true,true,true);frameCount++;return;}const active=game.started&&!game.paused&&game.phase!=='summary';if(active)game.advance(dt);const view=game.view();events(view);if(now-lastHUD>90||needsRender){updateHUD(view);lastHUD=now;}if(now>noticeUntil)$('notice').classList.remove('visible');if(active||needsRender||qaRenderAlways){needsRender=draw(view,dt);frameMs=frameMs*.9+wallDt*1000*.1;fps=1000/frameMs;if(active&&++qualityFrames>=20){qualityFrames=0;const next=frameMs>48?Math.max(.65,renderRatio*.82):frameMs<25?Math.min(maxRenderRatio,renderRatio+.04):renderRatio;if(Math.abs(next-renderRatio)>.015){renderRatio=next;renderer.setPixelRatio(renderRatio);renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);}}}if(game.tick-lastSaveTick>180)safeSave();}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;setPaused(true);$('loading').hidden=false;$('loading').textContent='画面暂时中断，已暂停并保存这趟旅程';});
canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;$('loading').hidden=true;resize();needsRender=true;});
resize();draw(game.view(),1,true);updateHUD(game.view());$('loading').hidden=true;requestAnimationFrame(animate);
window.__trainDriver={ready:true,version:'driver-r01-local',getState:()=>({...game.view(),actors:game.actors.map(a=>({...a,position:a.position.slice()})),proof:world.train.proof,camera:camera.position.toArray(),cameraMode:manualCamera||((game.serviceLocked()&&game.phase!=='doors-closing')?'carriage':'wide'),smokeMode:smoke.mode,smokeParticles:smoke.particles,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frames:frameCount,fps,renderRatio,rendererName}),exportReplay:()=>game.replayPacket()};
if(params.has('qa'))window.__trainDriver.test={start,command:(type,value)=>command(type,value),stepTicks:n=>{game.stepTicks(n);const v=game.view();events(v);draw(v,1,true);updateHUD(v);return v;},pause:value=>setPaused(value),render:()=>draw(game.view(),1,true),session:()=>game,measureFrames:({durationMs=5000,ratio=.8,mode='full'}={})=>new Promise(resolve=>{
  const oldPause=game.paused,oldRatio=renderRatio,oldCamera=manualCamera,oldShadow=renderer.shadowMap.enabled;
  game.paused=true;manualCamera='wide';qaRenderAlways=mode!=='idle';qaRenderMode=mode;
  smoke.root.visible=mode!=='no-smoke';world.terrain.visible=mode!=='no-terrain';renderer.shadowMap.enabled=mode!=='no-shadows';renderer.setPixelRatio(ratio);renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);
  if(mode==='clear-only')renderer.clear(true,true,true);else if(mode!=='idle')draw(game.view(),1,true);
  const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
  const times=[],start=performance.now(),firstFrame=frameCount,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');let previous=start;
  const sample=()=>{const now=performance.now();times.push(now-previous);previous=now;if(now-start<durationMs){requestAnimationFrame(sample);return;}
    const sorted=times.slice(1).sort((a,b)=>a-b),frames=times.length,wallMs=now-start,result={mode,wallMs,frames,renderedFrames:frameCount-firstFrame,fps:frames/(wallMs/1000),rafMedianMs:sorted[Math.floor(sorted.length*.5)],rafP95Ms:sorted[Math.floor(sorted.length*.95)],intervals:times,ratio,drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],visibility:document.visibilityState,hasFocus:document.hasFocus(),hardwareConcurrency:navigator.hardwareConcurrency,gpuTimerSupported:!!ext};
    qaRenderAlways=false;qaRenderMode='normal';game.paused=oldPause;manualCamera=oldCamera;smoke.root.visible=true;world.terrain.visible=true;renderer.shadowMap.enabled=oldShadow;renderer.setPixelRatio(oldRatio);renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);draw(game.view(),1,true);resolve(result);
  };requestAnimationFrame(sample);
}),profile:()=>{const wasPaused=game.paused,oldRatio=renderRatio,oldShadow=renderer.shadowMap.enabled,oldCamera=manualCamera;game.paused=true;manualCamera='wide';renderer.setPixelRatio(.8);renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);const result={renderer:rendererName,antialias:gl.getContextAttributes().antialias,ratio:.8,shadowCadence:3,completion:'one-pixel readback after every measured draw',modes:{}};for(const mode of ['full','no-smoke','no-shadows','no-terrain']){smoke.root.visible=mode!=='no-smoke';world.terrain.visible=mode!=='no-terrain';renderer.shadowMap.enabled=mode!=='no-shadows';draw(game.view(),1,true);gl.finish();const readback=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readback);const start=performance.now();for(let i=0;i<6;i++){draw(game.view(),1,false);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,readback);}result.modes[mode]={ms:(performance.now()-start)/6,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls};}smoke.root.visible=true;world.terrain.visible=true;renderer.shadowMap.enabled=oldShadow;renderer.setPixelRatio(oldRatio);renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);manualCamera=oldCamera;game.paused=wasPaused;draw(game.view(),1,true);return result;}};
if(params.get('autostart')==='1'){start(game.config);if(params.has('paused'))setPaused(true);}
