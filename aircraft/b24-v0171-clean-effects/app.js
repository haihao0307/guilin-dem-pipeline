import * as T from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {NativeAircraft,SOURCE} from './native-aircraft.js?boot=20260905-loader-r1';
import {Airfield} from './world.js';
import {Mission,PHASES,DUR} from './mission.js';
import {Effects} from './effects.js';
import {FlightAudio} from './audio.js';
const $=id=>document.getElementById(id),clamp=T.MathUtils.clamp;
const progress=(v,text)=>{$('loadBar').style.width=v*100+'%';$('loadText').textContent=text;};
function format(sec){const n=Math.floor(sec);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
const api={build:'B24_METAL_GRASS_MISSION_R1',ready:false,source:SOURCE,visualAcceptance:false,productionReady:false,errors:[],frameCount:0};window.__B24_WORKBENCH__=api;
if(innerWidth<650)document.body.classList.add('panelClosed');
function fail(error){console.error(error);api.errors.push(String(error.stack||error));$('fatal').hidden=false;$('fatal').textContent='工作台载入失败，已停止运行。\n'+String(error.message||error);$('loading').classList.add('hidden');$('status').textContent='载入失败';}
async function main(){
 const renderer=new T.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(42,1,.1,48000);camera.position.set(-34,15,40);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=8;controls.maxDistance=2600;controls.maxPolarAngle=Math.PI*.485;
 const audio=new FlightAudio(),fx=new Effects(scene,audio),plane=await NativeAircraft.load(progress);scene.add(plane.group);
 progress(.73,'建立同坐标草地跑道、物理金属受光与柔和阴影');
 const field=new Airfield(scene,renderer),mission=new Mission(plane,audio,fx);
 let cameraMode='orbit',manualCamera=false,cameraOffset=new T.Vector3(-34,12,39),lookSmooth=mission.position.clone(),lastPlanePosition=mission.position.clone(),lastTime=performance.now(),lastUI=0,fpsFrames=0,fpsTime=lastTime,fps=0,contextLost=false;
 camera.position.copy(mission.position).add(cameraOffset);controls.target.copy(mission.position);controls.update();
 function resize(){const r=$('stage').getBoundingClientRect();if(r.width<1||r.height<1)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe($('stage'));resize();
 function setCamera(mode,manual=true){if(mode==='orbit'&&cameraMode!=='orbit'){controls.target.copy(lookSmooth);controls.update();}cameraMode=mode;manualCamera=manual;controls.enabled=mode==='orbit';$('cameraBadge').textContent={cinema:'自动分镜',follow:'追随',port:'左侧',front:'迎面',runway:'跑道',orbit:'自由查看'}[mode];document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===mode));}
 function cameraStep(dt){
  const p=mission.position,yaw=plane.group.rotation.y,delta=p.clone().sub(lastPlanePosition);lastPlanePosition.copy(p);
  if(cameraMode==='orbit'){controls.target.add(delta);camera.position.add(delta);controls.update();$('shotLabel').textContent='整机环视';return;}
  let mode=cameraMode,offset=new T.Vector3(-36,15,-45),target=p.clone(),label='追随机位';const t=mission.time;
  if(mode==='cinema'){
   if(t<36){offset.set(-35,12,40);label='暖机与入场';}
   else if(t<62){offset.set(-36,10,-47);label='草地滑跑与离地';}
   else if(t<112){offset.set(-44,15,-29);label='爬升与巡航';}
   else if(t<126){offset.set(-33,-9,27);label='弹舱与投放';}
   else if(t-fx.lastImpact>=0&&t-fx.lastImpact<6&&fx.target){mode='target';target=fx.target.clone().add(new T.Vector3(0,8,0));offset.set(48,23,60);label='落点与爆炸';}
   else if(t<181){offset.set(-44,13,30);label='返航伴飞';}
   else if(t<210){offset.set(-28,11,40);label='对正进近与拉平';}
   else{offset.set(-34,10,38);label='接地与滑回';}
  }else if(mode==='port'){offset.set(49,12,7);label='左侧伴飞';}else if(mode==='front'){offset.set(-18,10,49);label='迎面跟随';}else if(mode==='runway'){label='跑道地面机位';}
  if(mode==='runway'){const eye=new T.Vector3(-60,11,-220);camera.position.lerp(eye,1-Math.exp(-dt*2));lookSmooth.lerp(p,1-Math.exp(-dt*4));camera.lookAt(lookSmooth);}
  else{if(mode!=='target')offset.applyAxisAngle(new T.Vector3(0,1,0),yaw);cameraOffset.lerp(offset,1-Math.exp(-dt*2.5));lookSmooth.lerp(target,1-Math.exp(-dt*5.5));camera.position.copy(lookSmooth).add(cameraOffset);camera.position.y=Math.max(1.2,camera.position.y);camera.lookAt(lookSmooth);}
  $('shotLabel').textContent=label;$('sceneNote').textContent=cameraMode==='cinema'?'自动分镜 · 可随时切换为手动镜头':'镜头选择已保持 · 流程继续播放';
 }
 function syncUI(){const st=mission.state();$('phaseName').textContent=mission.phase.label;$('phaseNumber').textContent=String(mission.phase.index+1).padStart(2,'0')+' / 18';$('clock').textContent=format(st.time)+' / '+format(DUR);$('timeline').value=st.time;$('altitude').innerHTML=Math.round(st.altitude)+' <em>m</em>';$('speed').innerHTML=Math.round(st.speed*3.6)+' <em>km/h</em>';$('gearState').textContent=st.gear>.99?'已放下':st.gear<.01?'已收起':'收放中';$('bayState').textContent=st.bay<.01?'关闭':st.bay>.99?'打开':'开合中';$('dropState').textContent=st.released+' / 4';$('impactState').textContent=st.impacts+' / 4';$('play').textContent=mission.running?'暂停流程':st.time===0?'开始完整流程':st.time>=DUR?'重新开始':'继续流程';$('playState').textContent=mission.running?'连续运行':st.time===0?'待命':st.time>=DUR?'完成':'已暂停';$('status').textContent=mission.running?'B24 · '+mission.phase.label:'B24 · 整机就绪';$('sound').textContent=audio.muted?'声音关闭':'声音开启';document.querySelectorAll('[data-phase-index]').forEach(b=>b.classList.toggle('active',Number(b.dataset.phaseIndex)===mission.phase.index));}
 $('phaseList').innerHTML=PHASES.map(p=>`<button data-phase-index="${p.index}">${String(p.index+1).padStart(2,'0')}　${p.label}</button>`).join('');
 async function play(){await audio.unlock().catch(e=>{api.errors.push('audio: '+e.message);});if(mission.time>=DUR){mission.reset();lookSmooth.copy(mission.position);lastPlanePosition.copy(mission.position);}mission.running=!mission.running;if(mission.running&&!manualCamera)setCamera('cinema',false);syncUI();}
 $('play').onclick=play;$('reset').onclick=()=>{mission.reset();lookSmooth.copy(mission.position);lastPlanePosition.copy(mission.position);cameraOffset.set(-34,12,39);camera.position.copy(mission.position).add(cameraOffset);controls.target.copy(mission.position);audio.events=[];syncUI();};
 $('timeline').oninput=e=>api.seek(Number(e.target.value));
 document.querySelectorAll('[data-phase-index]').forEach(b=>b.onclick=()=>api.seek(PHASES[Number(b.dataset.phaseIndex)].start+.1));
 document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>setCamera(b.dataset.camera));
 document.querySelectorAll('[data-rate]').forEach(b=>b.onclick=()=>{mission.rate=Number(b.dataset.rate);$('rateValue').textContent=mission.rate+'×';document.querySelectorAll('[data-rate]').forEach(e=>e.classList.toggle('active',e===b));});
 $('loop').onchange=e=>mission.loop=e.target.checked;$('exposure').oninput=e=>{renderer.toneMappingExposure=Number(e.target.value);$('exposureValue').textContent=renderer.toneMappingExposure.toFixed(2);};$('volume').oninput=e=>{audio.volume=Number(e.target.value);$('volumeValue').textContent=Math.round(audio.volume*100)+'%';};$('sound').onclick=async()=>{audio.muted=!audio.muted;if(!audio.muted)await audio.unlock().catch(()=>{});syncUI();};$('quality').onchange=e=>{const high=e.target.value==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.5:1));field.sun.shadow.mapSize.set(high?2048:1024,high?2048:1024);field.sun.shadow.map?.dispose();field.sun.shadow.map=null;resize();};$('panelToggle').onclick=()=>{document.body.classList.toggle('panelClosed');setTimeout(resize,10);};
 document.addEventListener('keydown',e=>{if(/INPUT|SELECT|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();play();}if(e.code==='KeyR')$('reset').click();if(e.code==='KeyF')setCamera('follow');});
 $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;mission.running=false;fail(new Error('显卡上下文中断，请刷新页面。当前任务已经停止。'));});
 Object.assign(api,{ready:true,scene,renderer,camera,plane,field,mission,effects:fx,audio,setCamera,getState:()=>({...mission.state(),cameraMode,fps,frameCount:api.frameCount,audioState:audio.ctx?.state||'not-started',audioRms:audio.rms(),audioEvents:[...audio.events],sourcePayloadSha256:plane.digest,rendererCount:document.querySelectorAll('canvas#scene').length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),seek:t=>{mission.seek(t);lookSmooth.copy(mission.position);lastPlanePosition.copy(mission.position);if(cameraMode==='orbit'){camera.position.copy(mission.position).add(cameraOffset);controls.target.copy(mission.position);}syncUI();},start:()=>{mission.running=true;},pause:()=>{mission.running=false;},reset:()=>$('reset').click(),captureState:()=>plane.stats});
 progress(.92,'建立完整起降任务、投放爆炸、声音与镜头控制');
 field.update(0,plane.group,camera);renderer.render(scene,camera);progress(1,'整机工作台就绪');syncUI();
 function frame(now){if(contextLost)return;requestAnimationFrame(frame);const elapsed=clamp((now-lastTime)/1000,0,4);lastTime=now;try{mission.tick(elapsed);fx.update(mission.time);cameraStep(Math.min(elapsed,.25));field.update(mission.time,plane.group,camera);audio.update(mission.rpm,mission.velocity.length(),mission.grounded,!mission.running);renderer.render(scene,camera);api.frameCount++;fpsFrames++;if(now-fpsTime>1000){fps=fpsFrames*1000/(now-fpsTime);fpsFrames=0;fpsTime=now;}if(now-lastUI>120){syncUI();lastUI=now;}}catch(e){mission.running=false;fail(e);contextLost=true;}}
 lastTime=performance.now();requestAnimationFrame(frame);
}
export {main};
