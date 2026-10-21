import {THREE,createActors} from './ActorAdapter.mjs';
import {createCourtyard} from './Courtyard.mjs';
import {LifeSimulation,ACTION_LABELS} from './LifeSimulation.mjs';
import {NativeMotion} from './NativeMotion.mjs';
import {createNativeShoeSystem} from './NativeShoes.mjs';
import {createNativeWardrobe} from './NativeWardrobe.mjs';
import {createNativeHairSystem} from './NativeHair.mjs';
import {ItemWorld,ITEM_PHYSICS} from './ItemWorld.mjs';
import {EnvironmentWorld} from './EnvironmentWorld.mjs';
import {STREET_LAYOUT} from './WorldLayout.mjs';
import {manageRendering} from './RenderQueue.mjs';
import {createSceneCamera} from './SceneCamera.mjs';

const $=id=>document.getElementById(id),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const escape=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const icons={play:'▶',pause:'Ⅱ',sun:'☀',rain:'☂',reset:'↺',arrow:'↗'};
const app=document.createElement('main');app.id='life-app';
app.innerHTML=`
<aside class="journal">
  <header class="brand"><div class="eyebrow"><span class="brand-mark">K.</span> KAOPU · LIVING WORLD</div><h1>街角日常<span>Little lives, unfolding.</span></h1><p>给他们一个世界，<br>让日常自己发生。</p></header>
  <section class="people"><div class="section-head"><h2>街上的六位邻居</h2><span>06 RESIDENTS</span></div><div id="people-cards"></div><div id="selected-story"></div></section>
  <section class="world-controls"><div class="section-head"><h2>给生活一点变化</h2><span>WHAT IF</span></div><div class="control-grid"><button id="add-bottle" title="在所选人物附近放一只瓶子，由合适的可用居民认领" disabled><span class="control-icon">♧</span>放一只瓶子</button><button id="shop-toggle" disabled><span class="control-icon">▱</span>面包店打烊</button><button id="rain-toggle" disabled><span class="control-icon">☂</span>下点雨</button><button id="wind-toggle" disabled><span class="control-icon">≋</span>吹一阵风</button><button id="plant-dry" disabled><span class="control-icon">♧</span>花坛缺水了</button><button id="dusk-toggle" disabled><span class="control-icon">◒</span>换成黄昏</button><button id="interrupt" disabled><span class="control-icon">〰</span>打断当前活动</button><button id="look-selected" disabled><span class="control-icon">↗</span>走近所选人物</button></div><p class="hint">放下瓶子，看看谁先注意到它。点居民卡片可切换观察。</p></section>
  <section class="diary"><div class="section-head"><h2>刚刚发生</h2><span class="live-dot"></span></div><ol id="event-feed"><li>街道正在苏醒……</li></ol></section>
  <footer class="journal-footer"><span>R07 原生人物 · 日常实验 02</span><button id="data-toggle" aria-expanded="false">观察数据 ↗</button></footer>
</aside>
<section id="life-view" aria-label="六位居民自主生活的实时三维街区">
  <div class="scene-heading"><div class="scene-kicker">SIX NEIGHBOURS, ONE LITTLE STREET</div><div class="scene-title">街长了一点，生活也多了一点。</div><div class="scene-description">捡拾 · 休息 · 买面包 · 浇花 · 开窗 · 避雨</div><div id="world-summary" class="world-summary"></div></div>
  <div class="weather-pill"><span id="weather-icon">☀</span><span id="weather-name">晴日</span><i></i><span id="life-clock">09:00</span></div>
  <div class="camera-tools" aria-label="观察视角"><button data-camera="all" aria-pressed="true">全景</button><button data-camera="near" aria-pressed="false">走近一点</button><button data-camera="follow" aria-pressed="false">跟随所选</button></div>
  <div id="person-labels"></div>
  <div class="scene-bottom"><div class="scene-legend"><span class="live-dot"></span><b id="run-state">正在准备</b><small>拖动旋转 · 滚轮缩放</small></div><div class="playback"><button id="pause" aria-label="暂停生活" disabled>Ⅱ</button><button id="speed" disabled>1×</button><div class="playback-line"></div><button id="reset" aria-label="重新开始" disabled>↺</button></div></div>
  <div id="life-loader"><div class="loader-art"><span></span><span></span><span></span><span></span></div><div class="eyebrow">A LITTLE STREET IS WAKING UP</div><h2>六份不同的日常，即将开始</h2><p id="load-progress">准备完整人物与各自的衣服、鞋子和头发</p><div class="loading-line"><i></i></div><small>首次打开会准备完整人物和服饰资源</small></div>
  <section id="data-panel" hidden aria-label="实时观察数据"><div class="data-heading"><div><span class="eyebrow">LIVE OBSERVATION</span><h2>看见选择背后的原因</h2></div><button id="data-close" aria-label="关闭观察数据">×</button></div><p class="data-intro">新瓶子会先被一个人认领；正在执行的动作先安全完成。其余选择由需求、偏好、距离和天气共同决定。</p><div class="need-controls"><label>所选人物 · 饥饿程度<input id="need-hunger" aria-label="所选人物饥饿程度" type="range" min="0" max="100" value="50"></label><label>疲劳程度<input id="need-fatigue" aria-label="所选人物疲劳程度" type="range" min="0" max="100" value="50"></label></div><div id="choice-reasons"></div><details><summary>实时状态与检查记录</summary><pre id="life-diagnostics"></pre></details><p class="scope-note">基础实验：复用原人物、整衣、鞋型、头发与动作库，接触确认后才改变物品归属。服饰随骨骼与身体表面更新，尚未实现完整的布料、头发和全身受力模拟。</p></section>
</section>`;
document.body.classList.add('life-courtyard');document.body.append(app);
const stage=$('stage');if(stage)$('life-view').prepend(stage);
const errors=[];
addEventListener('error',e=>errors.push(String(e.message)));
addEventListener('unhandledrejection',e=>errors.push(String(e.reason?.message||e.reason)));

function softShadow(){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(64,64,5,64,64,63);g.addColorStop(0,'rgba(58,45,26,.30)');g.addColorStop(.5,'rgba(58,45,26,.12)');g.addColorStop(1,'rgba(58,45,26,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c),m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.86,.62),m);mesh.rotation.x=-Math.PI/2;mesh.position.y=.008;mesh.renderOrder=1;return mesh;
}

function makeRain(scene){
  const n=600,vertices=new Float32Array(n*6),seed=[];
  for(let i=0;i<n;i++)seed.push([(Math.sin(i*73.3)*.5+.5)*26-13,(Math.cos(i*19.13)*.5+.5)*5,(Math.sin(i*37.7)*.5+.5)*14-5]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x8caaa4,transparent:true,opacity:.38,depthWrite:false}));lines.visible=false;lines.frustumCulled=false;scene.add(lines);
  return {update(time,active,wind=0){lines.visible=active;if(!active)return;seed.forEach((p,i)=>{const y=(p[1]-time*3.2)%5;let h=y<0?y+5:y;const underCanopy=STREET_LAYOUT.canopies.some(c=>p[0]>c.left&&p[0]<c.right&&p[2]>c.backZ&&p[2]<c.frontZ);if(underCanopy&&h<2.7)h+=2.7;vertices.set([p[0],h,p[2],p[0]-.035-wind*.12,h+.20,p[2]-.015],i*6);});geometry.attributes.position.needsUpdate=true;}};
}

async function main(){
  const {actors,viewer}=await createActors({onProgress:p=>{$('load-progress').textContent=typeof p==='string'?p:JSON.stringify(p);}});
  if(actors.length!==6)throw Error('这一版必须使用六个完整原生人物');
  // Preserve actual complete-head/body dimensions before appearance startup.
  // The donor garment grading needs the complete native height, not the
  // shorter body-only diagnostic fixture or a nominal stature parameter.
  if(window.__NPC_STARTUP__)window.__NPC_STARTUP__.actorMeasurements=actors.map(actor=>{
    const P=actor.nativeSource.positions,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<P.length;i+=3)for(let d=0;d<3;d++){min[d]=Math.min(min[d],P[i+d]);max[d]=Math.max(max[d],P[i+d]);}
    return {id:actor.id,presetId:actor.identity.presetId,nativeVertices:P.length/3,bodyVertices:actor.nativeSource.bodyCount,
      completeNativeBounds:{min,max,heightM:max[2]-min[2]},bindingHeightM:actor.binding.height,
      source:'actual frozen complete R07 native positions including the current GNM portrait'};
  });
  const graspStartup=[];
  for(const actor of actors){
    $('load-progress').textContent=`按 ${actor.id} 的真实手形校准抓取`;
    const fit=actor.configureGrasp({radius:ITEM_PHYSICS.bottleRadiusM,height:ITEM_PHYSICS.bottleHeightM,gripHeight:0});
    graspStartup.push({actor:actor.id,bottle:fit});
    if(!fit.admissible){
      $('life-diagnostics').textContent=JSON.stringify({phase:'native-grasp-calibration',sourceHead:window.__NPC_BUILD__.sourceHead,graspStartup,failedHandFixture:actor.graspFailureFixture},null,2);
      console.error('Native grasp calibration details',JSON.stringify(graspStartup));
      throw Error(actor.id+' 原生手形未通过抓取标定');
    }
    const bread=actor.configureGrasp({profile:'bread',halfExtentsM:ITEM_PHYSICS.breadHalfExtentsM});
    graspStartup[graspStartup.length-1].bread=bread;
    actor.selectGrasp('bottle');
  }
  if(window.__NPC_STARTUP__)window.__NPC_STARTUP__.graspCalibration=graspStartup;
  const keep=new Set(actors.map(a=>a.root));for(const child of [...viewer.scene.children])if(!keep.has(child))viewer.scene.remove(child);
  const courtyard=createCourtyard(THREE);viewer.scene.add(courtyard.group);
  viewer.scene.background=new THREE.Color('#e8e1d3');
  // R07's setFoldLook() disables only direct scene-child lights on each draw.
  // Its own rigs use Groups; our environment follows that same ownership
  // boundary while retaining the native renderer and all material hooks.
  const lighting=new THREE.Group();lighting.name='courtyard/environment-lighting';viewer.scene.add(lighting);
  const hemi=new THREE.HemisphereLight(0xf8f4e7,0x8b8b76,2.2);hemi.name='courtyard/sky';
  const sun=new THREE.DirectionalLight(0xffefd6,3.4);sun.name='courtyard/sun';sun.position.set(-6,13,10);sun.target.position.set(0,0,1.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:12,bottom:-12,near:.5,far:40});sun.shadow.bias=-.0005;sun.shadow.normalBias=.018;
  const fill=new THREE.DirectionalLight(0xdce9ef,.65);fill.name='courtyard/fill';fill.position.set(5,4,-2);
  lighting.add(hemi,sun,sun.target,fill,fill.target);
  const lightingReport=()=>({owner:lighting.name,visible:lighting.visible,lights:[hemi,sun,fill].map(light=>{
    let effectiveVisible=true;for(let node=light;node;node=node.parent)if(!node.visible)effectiveVisible=false;
    return {name:light.name,type:light.type,parent:light.parent?.name,visible:light.visible,effectiveVisible,
      enabled:effectiveVisible&&light.intensity>0,intensity:light.intensity,color:light.color.getHexString(),position:light.position.toArray()};
  }),streetLampMaterials:[...lampMaterials].map(m=>({name:m.name,emissiveIntensity:m.emissiveIntensity})),scope:'the same three authored environment lights under one scene Group; native render/material hooks retained'});
  viewer.renderer.shadowMap.enabled=true;viewer.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
  viewer.camera.near=.05;viewer.camera.far=100;viewer.camera.fov=38;viewer.camera.zoom=1;viewer.camera.updateProjectionMatrix();
  viewer.orbit.minDistance=2;viewer.orbit.maxDistance=60;viewer.orbit.maxPolarAngle=Math.PI*.46;viewer.orbit.enablePan=true;
  const sceneBounds=new THREE.Box3().setFromObject(courtyard.group),sceneCorners=[];
  for(const x of [sceneBounds.min.x,sceneBounds.max.x])for(const y of [sceneBounds.min.y,sceneBounds.max.y])for(const z of [sceneBounds.min.z,sceneBounds.max.z])sceneCorners.push(new THREE.Vector3(x,y,z));
  const renderQueue=manageRendering(viewer);
  const sim=new LifeSimulation({seed:20261020,colliders:courtyard.colliders,spots:courtyard.spots});
  // The visible self-service shelf holds six portions, matching available stock.
  sim.shop.stock=6;
  const progress=p=>{$('load-progress').textContent=typeof p==='string'?p:`${actors.find(a=>a.id===p.actor)?.profile?.name||p.actor||''} · ${p.style?({short:'短发',buzz:'寸头',medium:'中长发',long:'长发'}[p.style]):p.role==='top'?'上衣':p.role==='bottom'?'裤装':'服饰'}${Number.isFinite(p.fraction)?' '+Math.round(p.fraction*100)+'%':''}`;};
  const shoes=await createNativeShoeSystem({renderer:viewer.renderer,onProgress:progress});
  const wardrobe=await createNativeWardrobe({renderer:viewer.renderer,onProgress:progress,requestRender:()=>viewer.render()});
  const hair=createNativeHairSystem({renderer:viewer.renderer,onProgress:progress});
  const motion=new Map(),shadows=new Map();
  for(const actor of actors){
    actor.mesh.castShadow=false; // Native skin requires a different depth shader; soft ground contact is used here.
    shoes.attach(actor);await wardrobe.attach(actor);await hair.attach(actor);
    $('load-progress').textContent=`${actor.profile.name} · 检查穿鞋后的落脚与把手可达范围`;
    const executor=new NativeMotion(actor);executor.assessCapabilities({spots:courtyard.spots,getInteractionTarget:courtyard.getInteractionTarget});
    actor.motionCapabilities.bread=actor.graspProfiles.bread?.admissible===true;
    const pickupStance=executor.assessPickupStance();actor.motionCapabilities.pickup=pickupStance.passed;
    if(window.__NPC_STARTUP__)(window.__NPC_STARTUP__.pickupStances??=[]).push(pickupStance);
    if(!pickupStance.passed)throw Error(actor.profile.name+' 的实际鞋底、手掌与拾取站位尚未通过检查');
    executor.reset();
    sim.actor(actor.id).capabilities={...actor.motionCapabilities};motion.set(actor.id,executor);
    const shadow=softShadow();viewer.scene.add(shadow);shadows.set(actor.id,shadow);
  }
  const items=new ItemWorld({THREE,scene:viewer.scene,sim,courtyard,actors});
  const environment=new EnvironmentWorld({sim,courtyard});
  const rain=makeRain(viewer.scene);let selected='A',cameraMode='all',paused=false,speed=1,ready=false,last=performance.now(),lastUI=0,lastRender=0,frameCount=0;
  const reports={},audit={interactions:[],motionFailures:[],minActorDistance:Infinity,minPairClearanceM:Infinity,maxRootXZErrorM:0,maxBoneLengthErrorM:0,maxFootPenetrationM:0,frames:0,appearanceUpdateMS:0};
  const labelElements=new Map();
  const sceneCamera=createSceneCamera({THREE,viewer,street:courtyard.group,actors});
  for(const a of sim.actors){const el=document.createElement('button');el.className='person-label '+a.id.toLowerCase();el.innerHTML=`<i></i>${a.name}<span>…</span>`;el.setAttribute('aria-label','观察'+a.name);el.onclick=()=>select(a.id,true);$('person-labels').append(el);labelElements.set(a.id,el);}

  function select(id,follow=false){selected=id;if(follow)camera('follow');updateUI();}
  function fitOverview(){
    const target=sceneBounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(9.6,8.6,14.2).normalize();
    const right=new THREE.Vector3().crossVectors(viewer.camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
    const tanY=Math.tan(THREE.MathUtils.degToRad(viewer.camera.fov*.5)),tanX=tanY*viewer.camera.aspect;
    let distance=1;
    for(const corner of sceneCorners){const delta=corner.clone().sub(target),depth=delta.dot(direction);
      distance=Math.max(distance,depth+Math.abs(delta.dot(right))/(tanX*.89),depth+Math.abs(delta.dot(up))/(tanY*.76));}
    viewer.orbit.target.copy(target);viewer.camera.position.copy(target).addScaledVector(direction,distance);
  }
  function camera(mode){
    cameraMode=mode;const actor=sim.actor(selected);
    if(mode==='all'){sceneCamera.reset();fitOverview();}
    else sceneCamera.place(actor,{mode,force:true});
    viewer.camera.zoom=1;viewer.orbit.update();viewer.camera.updateProjectionMatrix();
    for(const b of app.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',String(b.dataset.camera===mode));viewer.render();
  }
  function resize(){const r=stage.getBoundingClientRect();if(r.width<1||r.height<1)return;viewer.renderer.setSize(r.width,r.height,false);viewer.camera.aspect=r.width/r.height;if(cameraMode==='all'){fitOverview();viewer.orbit.update();}viewer.camera.updateProjectionMatrix();viewer.render();}
  new ResizeObserver(resize).observe(stage);addEventListener('resize',resize);
  function labels(){const r=stage.getBoundingClientRect();for(const actor of actors){const el=labelElements.get(actor.id),mouth=reports[actor.id]?.mouth;const p=(mouth?new THREE.Vector3(mouth[0],mouth[1]+.34,mouth[2]):new THREE.Vector3(actor.root.position.x,actor.measurements.heightM+.19,actor.root.position.z)).project(viewer.camera);el.style.transform=`translate(-50%,-100%) translate(${(p.x*.5+.5)*r.width}px,${(-p.y*.5+.5)*r.height}px)`;el.hidden=p.z>1||p.z< -1;el.classList.toggle('selected',actor.id===selected);}}
  const showData=value=>{$('data-panel').hidden=!value;$('data-toggle').setAttribute('aria-expanded',String(value));updateUI();};
  $('data-toggle').onclick=()=>showData($('data-panel').hidden);$('data-close').onclick=()=>showData(false);
  for(const b of app.querySelectorAll('[data-camera]'))b.onclick=()=>camera(b.dataset.camera);
  $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?icons.play:icons.pause;$('pause').setAttribute('aria-label',paused?'继续生活':'暂停生活');viewer.render();updateUI();};
  $('speed').onclick=()=>{speed=speed===1?2:1;$('speed').textContent=speed+'×';updateUI();};
  $('reset').onclick=()=>{sim.reset();for(const actor of actors){motion.get(actor.id).reset();sim.actor(actor.id).capabilities={...actor.motionCapabilities};}items.reset();environment.reset();audit.interactions=[];audit.motionFailures=[];audit.minActorDistance=Infinity;audit.minPairClearanceM=Infinity;audit.maxBoneLengthErrorM=0;audit.maxFootPenetrationM=0;paused=false;$('pause').textContent=icons.pause;$('pause').setAttribute('aria-label','暂停生活');execute(0);viewer.render();updateUI();};
  const reflectEnvironment=()=>{courtyard.update(sim,0);rain.update(sim.time,sim.raining,sim.environment.windStrength);updateLighting();viewer.render();updateUI();};
  $('add-bottle').onclick=()=>{sim.spawnBottleNear(selected);updateUI();};$('shop-toggle').onclick=()=>{sim.setShopOpen(!sim.shop.open);reflectEnvironment();};$('rain-toggle').onclick=()=>{sim.toggleRain();reflectEnvironment();};$('interrupt').onclick=()=>{sim.interrupt(selected);updateUI();};
  $('wind-toggle').onclick=()=>{sim.toggleWind();reflectEnvironment();};$('plant-dry').onclick=()=>{sim.dryPlanter();reflectEnvironment();};$('dusk-toggle').onclick=()=>{sim.toggleDusk();reflectEnvironment();};$('look-selected').onclick=()=>camera('follow');
  $('need-hunger').oninput=e=>sim.setActorNeed(selected,'hunger',+e.target.value/100);$('need-fatigue').oninput=e=>sim.setActorNeed(selected,'fatigue',+e.target.value/100);

  function currentReport(){return {version:window.__NPC_BUILD__,ready,paused,speed,time:sim.time,selected,cameraMode,
    startup:window.__NPC_STARTUP__||null,
    source:{canonicalVersion:'HUMAN-INTEGRATED-R07',canonicalSHA256:window.__NPC_BUILD__.canonicalSHA256,identities:actors.map(a=>({id:a.id,identity:a.identity,profile:a.profile,measurements:a.measurements,binding:a.binding.report,capabilities:a.motionCapabilityReport,pickupStance:a.pickupStance,graspProfiles:a.graspProfiles,mouthSupport:a.poseTools.mouthSupport}))},
    camera:sceneCamera.report(),
    simulation:sim.snapshot(),motions:reports,items:items.snapshot(),environment:environment.snapshot(),audit,render:renderQueue.status(),garments:wardrobe.report(),footwear:shoes.report(),hair:hair.report(),scene:courtyard.metrics,lighting:lightingReport(),
    assets:{mode:window.__NPC_ASSETS__?.mode,servedCount:window.__NPC_ASSETS__?.served?.length,served:window.__NPC_ASSETS__?.served||[],missing:window.__NPC_ASSETS__?.missing||[],
      completed:window.__NPC_ASSETS__?.completed||[],failed:window.__NPC_ASSETS__?.failed||[],nativeTransport:window.__R05_STREAM__?.report?.()?.transport||null},errors,visualAcceptance:false,productionReady:false};}
  function updateUI(){
    const a=sim.actor(selected),minutes=Math.floor(sim.time/3),clock=9*60+minutes;
    $('life-clock').textContent=`${String(Math.floor(clock/60)%24).padStart(2,'0')}:${String(clock%60).padStart(2,'0')}`;
    $('weather-name').textContent=(sim.environment.dusk?'黄昏 · ':'')+(sim.raining?'微雨':sim.environment.windStrength>.4?'有风':'晴日');$('weather-icon').textContent=sim.raining?icons.rain:sim.environment.dusk?'◒':icons.sun;
    $('run-state').textContent=ready?(paused?'日常已暂停':'他们正在生活'):'正在准备';
    $('shop-toggle').innerHTML=`<span class="control-icon">▱</span>${sim.shop.open?'面包店打烊':'面包店开门'}`;
    $('rain-toggle').innerHTML=`<span class="control-icon">☂</span>${sim.raining?'让雨停下':'下点雨'}`;
    $('wind-toggle').innerHTML=`<span class="control-icon">≋</span>${sim.environment.windStrength>.4?'让风停下':'吹一阵风'}`;
    $('dusk-toggle').innerHTML=`<span class="control-icon">◒</span>${sim.environment.dusk?'回到白天':'换成黄昏'}`;
    const ground=sim.bottles.filter(b=>b.state==='ground'),claimed=ground.filter(b=>b.reservedBy).length;
    $('world-summary').textContent=`地上 ${ground.length} 只瓶子${claimed?' · '+claimed+' 只已被认领':''} · 窗户${sim.environment.windowProgress>.95?'敞开':sim.environment.windowProgress<.05?'关好':'正在转动'} · 花坛${sim.environment.plantMoisture<.4?'需要水':'湿润'}`;
    $('people-cards').innerHTML=sim.actors.map(s=>`<button class="person-card ${s.id.toLowerCase()} ${s.id===selected?'selected':''}" data-person="${s.id}" aria-pressed="${s.id===selected}"><div class="person-top"><span class="person-initial">${s.name.slice(0,1)}</span><span><strong>${s.name}</strong><small>${escape(s.description||'街坊邻居')}</small></span><span class="person-arrow">↗</span></div><div class="action-line"><span class="status-pip"></span><span>${s.task?.label||'看看周围'}</span><em>${s.pendingBottle?'已发现瓶子':s.task?.phase==='approach'?'前往':s.task?.phase==='rest'?'停留':''}</em></div><div class="needs"><span>饥饿<i><b style="width:${Math.round(s.needs.hunger*100)}%"></b></i></span><span>疲劳<i><b style="width:${Math.round(s.needs.fatigue*100)}%"></b></i></span></div></button>`).join('');
    for(const b of $('people-cards').querySelectorAll('[data-person]'))b.onclick=()=>select(b.dataset.person);
    $('selected-story').innerHTML=`<p><strong>${a.name}</strong> ${escape(a.reason)}</p><div class="pocket"><span>零钱 ¥${a.money}</span><span>瓶子 ${a.inventory.bottles.length}</span><span>面包 ${a.inventory.bread}</span></div>`;
    $('event-feed').innerHTML=sim.events.filter(e=>!['reset'].includes(e.type)).slice(-4).reverse().map(e=>`<li><span class="event-time">${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(Math.floor(e.time%60)).padStart(2,'0')}</span><p>${escape(e.message)}</p></li>`).join('')||'<li><p>他们正在留意眼前的事情。</p></li>';
    for(const s of sim.actors){const el=labelElements.get(s.id);el.querySelector('span').textContent=s.task?.label||'看看周围';}
    if(!$('data-panel').hidden){
      if(document.activeElement!==$('need-hunger'))$('need-hunger').value=Math.round(a.needs.hunger*100);
      if(document.activeElement!==$('need-fatigue'))$('need-fatigue').value=Math.round(a.needs.fatigue*100);
      const candidates=sim.getCandidates(selected).slice(0,4),max=Math.max(...candidates.map(c=>c.score),1);
      $('choice-reasons').innerHTML=`<h3>${a.name} · 此刻的选择</h3><p>${escape(a.reason)}</p><div class="candidate-list">${candidates.map(c=>`<div><span>${escape(ACTION_LABELS[c.kind])}</span><i><b style="width:${clamp(c.score/max)*100}%"></b></i><small>${Math.round(c.score)}</small></div>`).join('')}</div><small class="candidate-note">瓶子由一人认领；其余分数随世界变化。已开始的动作先完成或安全中断。</small>`;
      $('life-diagnostics').textContent=JSON.stringify(currentReport(),(k,v)=>typeof v==='number'&&!Number.isFinite(v)?null:v,2);
    }
    document.documentElement.dataset.npcTime=sim.time.toFixed(1);document.documentElement.dataset.npcErrors=String(errors.length);
  }
  function execute(dt){
    sim.update(dt);
    for(const actor of actors){
      const state=sim.actor(actor.id),t=state.task;let mode=state.moving?'walk':'idle',x=state.x,z=state.z,progress=t?.progress||0,seatY=.46;
      if(t?.kind==='rest'&&t.phase!=='approach'){
        const loc=sim.locations[t.targetId];x=loc.seat.x;z=loc.seat.z;seatY=loc.height;mode=t.phase==='interact'?'sit':t.phase==='depart'?'stand':'sitting';
      }else if(t?.phase==='interact')mode=t.kind==='collect'?'pickup':t.kind==='eat'?'eat':'trade';
      const target=items.contactTarget(state)||t?.contact;
      const input={...(items.motionInput?.(state)||{}),...environment.motionInput(state)};
      const r=motion.get(actor.id).update({dt,time:sim.time,x,z,yaw:state.yaw,mode,progress,target,seatY,seatApproachOffset:.65,standStartFactor:t?.kind==='rest'&&t.phase==='depart'?t.standStartFactor??1:null,grip:1,speed:state.speed,distance:state.distanceTravelled,kind:t?.kind,...input});
      reports[actor.id]=r;
      if(r&&!r.finite)throw Error(actor.id+' 动作产生无效骨骼数据');
      const rootError=Math.hypot(r.rootWorld[0]-state.x,r.rootWorld[2]-state.z);audit.maxRootXZErrorM=Math.max(audit.maxRootXZErrorM,rootError);
      if(rootError>.001)throw Error(actor.id+' 实际动作与避让位置不一致');
      audit.maxBoneLengthErrorM=Math.max(audit.maxBoneLengthErrorM,r?.boneLengthErrorM||0);
      const shadow=shadows.get(actor.id);shadow.position.x=actor.root.position.x;shadow.position.z=actor.root.position.z;
      audit.maxFootPenetrationM=Math.max(audit.maxFootPenetrationM,...Object.values(r?.feet||{}).map(f=>Math.max(0,-(f.soleMinimumWorldYM||0))));
      if(!t?.executionBlocked&&t?.kind==='rest'&&t.waitForAcknowledgement&&t.progress>=.999){
        // Native executor reports actual immutable-bone pose and seat/foot geometry.
        const safe=r?.finite&&r.poseValid&&r.boneLengthErrorM<.00001&&r.completed;
        if(safe){const ack=sim.acknowledgeInteraction(actor.id,true,{token:t.token,evidence:{executor:'native-104-bone-seat',...r}});audit.interactions.push({id:actor.id,kind:t.kind,phase:t.phase,time:sim.time,ack});}
      }
    }
    const receipts=[...(items.update(dt,reports)||[]),...environment.update(dt,reports)];
    for(const receipt of receipts){const ack=sim.acknowledgeInteraction(receipt.id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});audit.interactions.push({...receipt,time:sim.time,ack});}
    if(audit.interactions.length>60)audit.interactions.splice(0,audit.interactions.length-60);
    for(let i=0;i<sim.actors.length;i++)for(let j=i+1;j<sim.actors.length;j++){const a=sim.actors[i],b=sim.actors[j],distance=Math.hypot(a.x-b.x,a.z-b.z);audit.minActorDistance=Math.min(audit.minActorDistance,distance);audit.minPairClearanceM=Math.min(audit.minPairClearanceM,distance-a.radius-b.radius);}
    courtyard.update(sim,dt);audit.frames++;rain.update(sim.time,sim.raining,sim.environment.windStrength);updateLighting();
  }
  const lampMaterials=new Set();courtyard.group.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.emissive&&/lantern/i.test(m.name))lampMaterials.add(m);});
  function updateLighting(){const dusk=sim.environment.dusk;sun.intensity=dusk?1.15:sim.raining?1.5:3.4;sun.color.set(dusk?0xffb579:0xffefd6);hemi.intensity=dusk?1.35:sim.raining?1.9:2.2;fill.intensity=dusk?.85:.65;viewer.scene.background.set(dusk?'#d6c3b0':sim.raining?'#ced8d1':'#e8e1d3');for(const m of lampMaterials)m.emissiveIntensity=dusk?1.7:.55;}
  let appearanceCamera='';
  function updateAppearance(){const started=performance.now();shoes.update();wardrobe.update(viewer.camera);hair.update();appearanceCamera=viewer.camera.matrixWorld.elements.join(',')+'|'+viewer.camera.projectionMatrix.elements.join(',');audit.appearanceUpdateMS=performance.now()-started;}
  // The original textile atlas and seam preparation submit real GPU draws.
  // Run them together with the native beauty draw, after the prior fence.
  // The callback also runs for the initial frame before ready becomes true.
  renderQueue.onBeforeRender(updateAppearance);
  window.__LIVING_STREET__=window.__LIVING_COURTYARD__={snapshot:currentReport,ready:false,awaitFrame:o=>renderQueue.awaitFrame(o),
    probeInteractionGeometry:id=>items.probeInteractionGeometry(id)};
  function frame(now){
    const elapsed=Math.max(0,(now-last)/1000);last=now;
    try{
      if(ready&&!paused){let dt=Math.min(elapsed,.12)*speed;while(dt>.00001){const step=Math.min(dt,1/30);execute(step);dt-=step;}}
      if(cameraMode==='follow'&&ready)sceneCamera.place(sim.actor(selected));
      if(ready&&appearanceCamera!==viewer.camera.matrixWorld.elements.join(',')+'|'+viewer.camera.projectionMatrix.elements.join(','))viewer.render();
      if(ready&&!paused&&now-lastRender>32){viewer.render();lastRender=now;}
      renderQueue.pump();labels();
      if(now-lastUI>320){updateUI();lastUI=now;}
      frameCount++;
    }catch(error){paused=true;errors.push(error.message);$('run-state').textContent='检查发现问题，已暂停';document.documentElement.dataset.npcReady='failed';console.error(error);}
    requestAnimationFrame(frame);
  }
  execute(0);camera('all');resize();viewer.render();requestAnimationFrame(frame);
  $('load-progress').textContent='六位居民已就绪，正在绘制街道的第一帧';
  await renderQueue.awaitFrame({fresh:true});ready=true;window.__LIVING_COURTYARD__.ready=true;last=performance.now();
  for(const b of app.querySelectorAll('button'))b.disabled=false;$('life-loader').hidden=true;document.documentElement.dataset.npcReady='true';updateUI();
}
main().catch(error=>{errors.push(error.message);$('load-progress').textContent='本次检查未通过：'+error.message;document.documentElement.dataset.npcReady='failed';console.error(error);});
