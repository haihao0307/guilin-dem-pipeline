import {createRailAudio} from './audio.mjs';
import {KCR_STATIONS,MILEAGE} from './timetable.mjs';
import * as THREE from '../vendor/three.module.js';
import {Session,replay} from './session.mjs';
import {createGameWorld} from './world.mjs';
import {createGameSmoke} from './smoke.mjs';
import {createViewControls} from './view-controls.mjs';
import {createRouteMap} from './route-map.mjs';
import {DEFAULT_VIEWS} from './view-profile-storage.mjs';
import {qualityBounds,nextRenderRatio,normalizeQuality} from './render-quality.mjs';
import {initSettingsUI} from './settings-ui.mjs';
import {verticalFov} from './anchored-zoom.mjs';
import {guardedVerticalFov} from './recommended-fit.mjs';
const $=id=>document.getElementById(id),canvas=$('gameScene'),wrap=$('sceneWrap'),params=new URLSearchParams(location.search),SAVE_KEY='kaopu.train-driver.save.v1';
// Gameplay labels and overlays must not summon selection/callout UI; editable form fields retain native behavior.
const editableUiTarget=target=>{const el=target instanceof Element?target:target?.parentElement;return !!el?.closest('input,textarea,select,option,[contenteditable]:not([contenteditable="false"])');};
for(const eventName of ['selectstart','contextmenu'])$('driverGame').addEventListener(eventName,event=>{if(!editableUiTarget(event.target))event.preventDefault();});
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(devicePixelRatio);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
const gl=renderer.getContext(),debugRenderer=gl.getExtension('WEBGL_debug_renderer_info'),rendererName=debugRenderer?gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x1b2425);
const camera=new THREE.PerspectiveCamera(32,1,.1,180),cameraTarget=new THREE.Vector3(-8.8,-.8,1),widePosition=new THREE.Vector3(...DEFAULT_VIEWS.landscape.position),wideTarget=new THREE.Vector3(...DEFAULT_VIEWS.landscape.target),portraitPosition=new THREE.Vector3(...DEFAULT_VIEWS.portrait.position),portraitTarget=new THREE.Vector3(...DEFAULT_VIEWS.portrait.target),closePosition=new THREE.Vector3(-2,13,20),closeTarget=new THREE.Vector3(-14.2,1.2,1.4);camera.position.copy(widePosition);camera.lookAt(cameraTarget);
scene.add(new THREE.HemisphereLight(0xd5e6ec,0x273d30,1.4));
const key=new THREE.DirectionalLight(0xffebc4,2.3);key.position.set(1,22,14);key.target.position.set(-8,0,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-34,right:21,top:20,bottom:-19,far:90});key.shadow.normalBias=.05;key.shadow.bias=-.00025;key.shadow.radius=3;scene.add(key,key.target);
const rim=new THREE.DirectionalLight(0xc3dce4,.7);rim.position.set(-14,8,-14);scene.add(rim);
for(const [x,power]of [[1.4,36],[-15,24]]){const fill=new THREE.PointLight(0xf4e5a2,power,24,1.6);fill.position.set(x,5.6,5);scene.add(fill);}
const railAudio=createRailAudio({wheelRadius:.61});const world=createGameWorld();scene.add(world.root);const smoke=createGameSmoke();scene.add(smoke.root);
world.train.root.updateWorldMatrix(true,true);const zoomBounds=new THREE.Box3().setFromObject(world.train.root),zoomPoints=[];for(const x of [zoomBounds.min.x,zoomBounds.max.x])for(const y of [zoomBounds.min.y,zoomBounds.max.y])for(const z of [zoomBounds.min.z,zoomBounds.max.z])zoomPoints.push(new THREE.Vector3(x,y,z));
const QUALITY_KEY='kaopu.train-driver.quality.v1';let qualityMode='clear';try{qualityMode=normalizeQuality(localStorage.getItem(QUALITY_KEY));}catch{}
let renderRatio=1,maxRenderRatio=1,minRenderRatio=1,frameMs=33,qualityFrames=0,previousQualityActive=false,qualityInfo=null;
let game=new Session({line:'kcr1',seed:params.get('seed')||'KCR-0620',durationMinutes:Number(params.get('duration')||10)}),last=performance.now(),lastHUD=0,lastEvent=0,lastSaveTick=0,noticeUntil=0,needsRender=true,manualCamera=null,summaryShown=false,frameCount=0,fps=0,contextLost=false,saved=null;
const heldBrake=new Set(),routeMap=createRouteMap($('routeMap'));
$('toggleHints').addEventListener('click',()=>{const expanded=$('driverGame').dataset.hints!=='true';$('driverGame').dataset.hints=String(expanded);$('toggleHints').setAttribute('aria-expanded',String(expanded));$('toggleHints').textContent=expanded?'收起说明':'说明';});
$('seed').value=game.config.seed;$('duration').value=String(game.config.durationMinutes);
function say(text,{warning=false,duration=4200}={}){$('notice').textContent=text;$('notice').classList.add('visible');$('notice').classList.toggle('warning',warning);noticeUntil=performance.now()+duration;}
function safeSave(){if(!game.started||game.phase==='summary')return;try{const packet=game.replayPacket();localStorage.setItem(SAVE_KEY,JSON.stringify({version:1,packet,signature:game.signature(),station:game.stationIndex}));lastSaveTick=game.tick;}catch{}}
function clearSaved(){try{localStorage.removeItem(SAVE_KEY);}catch{}saved=null;$('continueSaved').hidden=true;}
try{const raw=localStorage.getItem(SAVE_KEY);if(raw&&raw.length<1500000){const data=JSON.parse(raw);if(data.version===1&&data.packet?.version===1&&Array.isArray(data.packet.inputs)&&data.packet.inputs.length<50000&&data.packet.ticks<180000){saved=data;$('continueSaved').hidden=false;$('continueSaved').textContent='继续上次 · 第 '+(data.station+1)+' 站';}}}catch{}
let projectionKey='',lastCanvasSize=[0,0];
function syncProjection(input){const w=wrap.clientWidth,h=wrap.clientHeight,p=Array.isArray(input?.position)?input:viewControls?.automaticFrame()||DEFAULT_VIEWS[$('driverGame').dataset.layout==='portrait'?'portrait':'landscape'],key=JSON.stringify(p.projection||null)+':'+w+'x'+h;if(key===projectionKey)return;camera.aspect=w/h;camera.fov=verticalFov(camera.aspect,p.projection);camera.updateProjectionMatrix();if(p.projection?.kind==='horizontal'&&camera.aspect>2.6){const guard=guardedVerticalFov({camera,trainPoints:zoomPoints,width:w,height:h,projection:p.projection,hudTop:h<=650?112:200,hudBottom:h<=650?100:150});camera.fov=guard.fov;camera.updateProjectionMatrix();}projectionKey=key;needsRender=true;}
function resize(input){const w=wrap.clientWidth,h=wrap.clientHeight;qualityInfo=qualityBounds({mode:qualityMode,dpr:devicePixelRatio,width:w,height:h,maxBufferSize:gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)});maxRenderRatio=qualityInfo.max;minRenderRatio=qualityInfo.min;renderRatio=qualityInfo.initial;frameMs=33;qualityFrames=0;previousQualityActive=false;renderer.setPixelRatio(renderRatio);renderer.setSize(w,h,false);lastCanvasSize=[w,h];projectionKey='';syncProjection(input);needsRender=true;}
new ResizeObserver(resize).observe(wrap);
function command(type,value){const result=game.command(type,value);needsRender=true;if(!result.accepted&&type==='station-action')say('先停稳，让车门落在站台范围内。');return result;}
let viewControls;
function resetView(){if(viewControls?.manual())return;manualCamera=null;if(viewControls)viewControls.resetForSession();else{camera.position.copy(widePosition);cameraTarget.copy(wideTarget);camera.lookAt(cameraTarget);}needsRender=true;}
function start(config){game=new Session({line:'kcr1',...config,routeCount:6});world.resetEffects();heldBrake.clear();lastEvent=0;lastSaveTick=0;summaryShown=false;noticeUntil=0;$('notice').classList.remove('visible');$('startScreen').hidden=true;$('pauseScreen').hidden=true;$('summaryScreen').hidden=true;resetView();game.command('start');last=performance.now();needsRender=true;safeSave();canvas.focus();}
function setPaused(value){if(!game.started||game.phase==='summary')return;heldBrake.clear();game.command('brake',false);game.command('pause',value);$('pauseScreen').hidden=!game.paused;$('pause').textContent=game.paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',game.paused?'继续游戏':'暂停游戏');safeSave();last=performance.now();needsRender=true;if(!game.paused)canvas.focus();}
function stationAction(){const v=game.view();if(v.station.canRecover&&!v.station.canOpen)return command('recover');return command('station-action');}
function setBrake(source,pressed){if(pressed)heldBrake.add(source);else heldBrake.delete(source);command('brake',heldBrake.size>0);}
$('startGame').addEventListener('click',()=>{clearSaved();start({line:'kcr1',seed:$('seed').value.trim().slice(0,48)||'KCR-0620',durationMinutes:Number($('duration').value)});});
$('continueSaved').addEventListener('click',()=>{try{const restored=replay(saved.packet);if(restored.signature()!==saved.signature)throw new Error('version changed');game=restored;game.command('pause',false);heldBrake.clear();world.resetEffects();lastEvent=game.eventId;summaryShown=false;resetView();$('startScreen').hidden=true;$('pauseScreen').hidden=true;$('summaryScreen').hidden=true;last=performance.now();needsRender=true;canvas.focus();say('回来了，继续这一趟。');}catch{say('这份存档与当前规则不同，可用相同种子重新出发。',{warning:true});clearSaved();}});
$('accelerate').addEventListener('click',()=>command('throttle-up'));$('decelerate').addEventListener('click',()=>command('throttle-down'));
$('brake').addEventListener('pointerdown',e=>{e.preventDefault();$('brake').setPointerCapture(e.pointerId);setBrake('pointer',true);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('brake').addEventListener(name,()=>setBrake('pointer',false));
$('stationAction').addEventListener('click',stationAction);$('recover').addEventListener('click',()=>command('recover'));
$('pause').addEventListener('click',()=>setPaused(!game.paused));$('resume').addEventListener('click',()=>setPaused(false));
for(const id of ['restart','restartPaused','playAgain'])$(id).addEventListener('click',()=>start(game.config));
$('newRoute').addEventListener('click',()=>{const seed='线路-'+Math.floor(Math.random()*0xffffff).toString(36).toUpperCase();$('seed').value=seed;start({...game.config,seed});});
$('cameraView').addEventListener('click',()=>{if(viewControls.locked()){say('先解锁视角，再切换观察位置。');return;}const effective=manualCamera||'wide';manualCamera=effective==='carriage'?'wide':'carriage';camera.position.copy(manualCamera==='carriage'?closePosition:widePosition);cameraTarget.copy(manualCamera==='carriage'?closeTarget:wideTarget);camera.lookAt(cameraTarget);viewControls.markPreset();needsRender=true;});
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
  routeMap.update(v);$('limitValue').textContent=v.station.limit;$('speed').closest('.speed-display').style.setProperty('--speed-angle',(-100+Math.min(80,v.speedKmh)/80*200)+'deg');
  $('clock').textContent=v.timetable?v.timetable.clock:formatClock(v.remainingTime);$('clockLabel').textContent=v.timetable?'遊戲時鐘':'剩餘';$('timeMapping').textContent=v.timetable?'巡航壓縮 ×'+v.timetable.rate.toFixed(1)+' · 約10分鐘一趟':'';$('speedMph').textContent=(v.speedKmh/1.609344).toFixed(1);$('speed').textContent=v.speedKmh.toFixed(1);$('speed').parentElement.parentElement.classList.toggle('overspeed',v.speedKmh>v.station.limit+3);
  const locked=game.serviceLocked();$('notch').textContent=locked?'车门互锁':v.brake?'正在制动':v.reverse?'低速倒回':v.throttle>0?'牵引 '+v.throttle+' 档':v.throttle<0?'减速 '+(-v.throttle)+' 档':'惰行';for(const[i,node]of [...document.querySelectorAll('.power-dots i')].entries())node.classList.toggle('active',i<=v.throttle+2);
  $('brakingDistance').textContent=v.brakingDistance.toFixed(1)+' m';$('brake').setAttribute('aria-pressed',String(v.brake));$('accelerate').disabled=$('decelerate').disabled=locked||!v.started||v.paused||v.phase==='summary'||v.finishing;
  $('stationName').textContent=v.station.name;$('stationEnglish').textContent=v.station.english||'';$('stationSchedule').textContent=v.timetable?'計劃 '+v.timetable.arrival+(v.timetable.departure!==v.timetable.arrival?'–'+v.timetable.departure:'')+' · '+v.timetable.mile+' Mi / '+v.timetable.km+' Km'+(v.timetable.lateMinutes>=1?' · 遲 '+Math.floor(v.timetable.lateMinutes)+' 分':''):'';$('stationDistance').textContent=(v.station.remaining>=0?'':'越过 ')+Math.abs(v.station.remaining).toFixed(v.station.remaining<20?1:0)+' m';
  $('weather').textContent=(v.station.wet?'雨 · 制动更长':'晴')+' · 限速 '+v.station.limit;$('parkingNeedle').style.left=Math.max(0,Math.min(100,50-v.station.remaining/24*100))+'%';$('stopZone').style.left=(50-v.station.radius/24*100)+'%';$('stopZone').style.width=(v.station.radius/12*100)+'%';
  let hint='车头停在黄色标记旁',action='到站后开门接送',enabled=false;
  if(v.phase==='doors-opening'){hint='车门打开中';action='正在打开车门…';}
  else if(v.phase==='unloading'){hint='先下后上，请等乘客走到站台';action='乘客下车中…';}
  else if(v.phase==='boarding'){hint='乘客正在沿过道入座';action='乘客上车中…';}
  else if(v.phase==='ready-depart'){hint=v.station.index===v.routeCount-1?'本線接送完成，可以收車':'接送完成，可以发车';action=v.station.index===v.routeCount-1?'收车 · 完成行程':'关门发车';enabled=true;if(v.timetable?.dwellRemaining>0){hint='大埔墟停站 · 等候 '+Math.ceil(v.timetable.dwellRemaining)+' 秒';action='停站中 · '+v.timetable.departure+' 發車';enabled=false;}}
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
  if(v.phase==='summary'&&!summaryShown){summaryShown=true;clearSaved();$('summaryScreen').hidden=false;$('pauseScreen').hidden=true;$('finalScore').textContent=Math.round(v.stats.score);$('finalPicked').textContent=v.stats.pickedUp;$('finalDelivered').textContent=v.stats.delivered;$('finalCombo').textContent=v.stats.bestCombo;$('finalAccuracy').textContent=(v.stats.stops?Math.round(v.stats.accuracyTotal/v.stats.stops*100):0)+'%';$('finalMistakes').textContent=v.stats.missed+' / '+v.stats.recovered;$('finalSatisfaction').textContent=Math.round(v.stats.satisfaction);$('finalRoute').textContent='线路 '+v.seed+' · '+v.stats.stops+' 站'+(v.stats.lateDropOff?' · '+v.stats.lateDropOff+' 位错站补下':'');$('summaryTitle').textContent=v.stats.stops===0?'下一趟，慢慢找节奏':v.stats.bestCombo>=6?'这位老司机，稳！':v.stats.missed>v.stats.stops?'有点惊险，也接到了人':'这一趟，开得不错';}
}
function events(v){for(const e of v.events){if(e.id<=lastEvent)continue;
  if(e.type==='missed-station')say('漏站了！乘客追来了。先刹停，40 米内还能倒回补救。',{warning:true,duration:6500});
  if(e.type==='recovering')say('慢慢倒回，看到停车标记就按住制动。');
  if(e.type==='stop-complete')say((e.accuracy>.85?'停得漂亮！':'接送完成。')+' 上车 '+e.boarded+' 人，下车 '+e.alighted+' 人'+(e.left?'，还有 '+e.left+' 人等下一班':''));
  if(e.type==='station-left-behind')say('这一站错过了，继续把下一站开好。',{warning:true});
  if(e.type==='departed'){if(!viewControls?.manual())manualCamera=null;say('车门已关好，出发。');}
  if(e.type==='passenger-delivered'&&e.late)say('这位乘客错站补下，满意度稍有下降。',{warning:true,duration:2500});
  if(e.type==='stone-hit')say('咚！记住这次刹车距离。',{warning:true,duration:1300});
  lastEvent=e.id;
}}
const automaticPosition=new THREE.Vector3(),automaticTarget=new THREE.Vector3();
function draw(view,dt=1/60,snap=false){
  const close=(manualCamera||((game.serviceLocked()&&view.phase!=='doors-closing')?'carriage':'wide'))==='carriage',portrait=viewControls?.mode()==='portrait',savedFrame=viewControls?.automaticFrame()||DEFAULT_VIEWS[portrait?'portrait':'landscape'];
  const targetPosition=close&&!portrait?closePosition:automaticPosition.fromArray(savedFrame.position),targetLook=close&&!portrait?closeTarget:automaticTarget.fromArray(savedFrame.target);
  const alpha=snap?1:1-Math.exp(-dt*4);if(!viewControls?.manual()){camera.position.lerp(targetPosition,alpha);cameraTarget.lerp(targetLook,alpha);}camera.lookAt(cameraTarget);camera.updateMatrixWorld();
  world.update(view,game.route,{interior:close});smoke.update(view.elapsed,camera,{speed:view.velocity,braking:view.brake||view.throttle<0,view});renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=snap||frameCount%3===0;renderer.render(scene,camera);frameCount++;
  return !viewControls?.manual()&&(camera.position.distanceTo(targetPosition)>.015||cameraTarget.distanceTo(targetLook)>.015);
}
function animate(now){requestAnimationFrame(animate);const wallDt=Math.max(.001,(now-last)/1000),dt=Math.min(.25,wallDt);last=now;if(contextLost)return;const active=game.started&&!game.paused&&game.phase!=='summary';if(active)game.advance(wallDt);const view=game.view();railAudio.update(view);events(view);if(now-lastHUD>90||needsRender){updateHUD(view);lastHUD=now;}if(now>noticeUntil)$('notice').classList.remove('visible');if(active||needsRender){needsRender=draw(view,dt);const qualityActive=active&&!document.hidden;if(qualityActive&&previousQualityActive){frameMs=frameMs*.9+wallDt*1000*.1;qualityFrames++;}else{frameMs=33;qualityFrames=0;}previousQualityActive=qualityActive;fps=1000/frameMs;if(qualityActive&&qualityFrames>=20){qualityFrames=0;const next=nextRenderRatio({mode:qualityMode,ratio:renderRatio,max:maxRenderRatio,min:minRenderRatio,frameMs});if(Math.abs(next-renderRatio)>.015){renderRatio=next;renderer.setPixelRatio(renderRatio);renderer.setSize(wrap.clientWidth,wrap.clientHeight,false);}}}if(game.tick-lastSaveTick>180)safeSave();}
addEventListener('train-quality-change',event=>{qualityMode=normalizeQuality(event.detail?.mode);try{localStorage.setItem(QUALITY_KEY,qualityMode);}catch{}resize();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;setPaused(true);$('loading').hidden=false;$('loading').textContent='画面暂时中断，已暂停并保存这趟旅程';});
canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;$('loading').hidden=true;resize();needsRender=true;});
viewControls=createViewControls({camera,target:cameraTarget,canvas,root:$('driverGame'),getZoomPoints:()=>zoomPoints,onReset:()=>{manualCamera=null;},onChange:(profile,detail)=>{if(detail?.profileApplied)projectionKey='';needsRender=true;if(lastCanvasSize[0]!==wrap.clientWidth||lastCanvasSize[1]!==wrap.clientHeight)resize(profile);else syncProjection(profile);}});
resize();draw(game.view(),1,true);updateHUD(game.view());$('loading').hidden=true;requestAnimationFrame(animate);
window.__trainDriver={ready:true,version:'kcr-steam-r08',getState:()=>({...game.view(),actors:game.actors.map(a=>({...a,position:a.position.slice()})),proof:world.train.proof,audio:railAudio.getState(),steam:smoke.root.userData.effects,terrainProof:world.terrain.userData.proof,camera:camera.position.toArray(),viewSettings:viewControls.state(),cameraMode:manualCamera||((game.serviceLocked()&&game.phase!=='doors-closing')?'carriage':'wide'),smokeMode:smoke.mode,smokeParticles:smoke.particles,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frames:frameCount,fps,renderRatio,qualityMode,qualityInfo,canvasPixels:[canvas.width,canvas.height],canvasCss:[wrap.clientWidth,wrap.clientHeight],devicePixelRatio,antialias:gl.getContextAttributes()?.antialias,rendererName}),exportReplay:()=>game.replayPacket()};

initSettingsUI();
let soundMuted=false,crowdEnabled=false;$('crowdToggle').addEventListener('click',()=>{crowdEnabled=!crowdEnabled;railAudio.setCrowdEnabled(crowdEnabled);$('crowdToggle').textContent=crowdEnabled?'人群底聲：開':'人群底聲：關';$('crowdToggle').setAttribute('aria-pressed',String(crowdEnabled));});for(const id of ['startGame','continueSaved','resume'])$(id).addEventListener('click',()=>railAudio.unlock());
function whistle(){railAudio.unlock();command('whistle');railAudio.whistle();} $('whistle').addEventListener('click',whistle);$('testWhistle').addEventListener('click',()=>{railAudio.unlock();railAudio.whistle();});
$('soundToggle').addEventListener('click',()=>{soundMuted=!soundMuted;railAudio.setMuted(soundMuted);$('soundToggle').textContent=soundMuted?'聲音：關':'聲音：開';$('soundToggle').setAttribute('aria-pressed',String(soundMuted));if(!soundMuted)railAudio.unlock();});
$('volume').addEventListener('input',()=>railAudio.setVolume(Number($('volume').value)/100));railAudio.setVolume(.65);
$('finishTrip').addEventListener('click',()=>{const wasPaused=game.paused;game.command('pause',false);const result=command('finish');if(!result.accepted){game.command('pause',wasPaused);say('先讓乘客完成上下車，再收車。');return;}$('closeSettings').click();needsRender=true;});
document.addEventListener('keydown',e=>{if(e.code==='KeyH'&&!e.repeat&&!editableUiTarget(e.target)&&game.started&&!game.paused){e.preventDefault();whistle();}});
$('timetableList').replaceChildren(...KCR_STATIONS.map((s,i)=>{const row=document.createElement('p');row.textContent=s.name+' '+s.english+' · '+s.arrival+(s.arrival!==s.departure?'–'+s.departure:'')+' · '+MILEAGE[i][0]+' Mi / '+MILEAGE[i][1]+' Km';return row;}));


