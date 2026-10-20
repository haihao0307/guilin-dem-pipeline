import {THREE,createActors} from './ActorAdapter.mjs';
import {createCourtyard} from './Courtyard.mjs';
import {LifeSimulation} from './LifeSimulation.mjs';
import {NativeMotion} from './NativeMotion.mjs';
import {dressActor} from './NativeGarments.mjs';
import {ItemWorld} from './ItemWorld.mjs';
import {manageRendering} from './RenderQueue.mjs';

const $=id=>document.getElementById(id),clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const escape=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const icons={play:'▶',pause:'Ⅱ',sun:'☀',rain:'☂',reset:'↺',arrow:'↗'};
const app=document.createElement('main');app.id='life-app';
app.innerHTML=`
<aside class="journal">
  <header class="brand"><div class="eyebrow"><span class="brand-mark">K.</span> KAOPU · LIVING WORLD</div><h1>街角日常<span>Little lives, unfolding.</span></h1><p>给他们一个世界，<br>让日常自己发生。</p></header>
  <section class="people"><div class="section-head"><h2>院子里的两个人</h2><span>02 RESIDENTS</span></div><div id="people-cards"></div></section>
  <section class="world-controls"><div class="section-head"><h2>轻轻改变一下</h2><span>WHAT IF</span></div><div class="control-grid"><button id="add-bottle" disabled><span class="control-icon">♧</span>放一只瓶子</button><button id="shop-toggle" disabled><span class="control-icon">▱</span>面包店打烊</button><button id="rain-toggle" disabled><span class="control-icon">☂</span>下点雨</button><button id="interrupt" disabled><span class="control-icon">〰</span>打断当前活动</button></div><p class="hint">改变环境，看看他们如何重新选择。</p></section>
  <section class="diary"><div class="section-head"><h2>刚刚发生</h2><span class="live-dot"></span></div><ol id="event-feed"><li>小院正在苏醒……</li></ol></section>
  <footer class="journal-footer"><span>R07 原生人物 · 日常实验 01</span><button id="data-toggle" aria-expanded="false">观察数据 ↗</button></footer>
</aside>
<section id="life-view" aria-label="双人物自主生活实时三维小院">
  <div class="scene-heading"><div class="scene-kicker">THE EVERYDAY COURTYARD</div><div class="scene-title">一方小院，各自生活。</div><div class="scene-description">休息 · 收集 · 换钱 · 买面包 · 进食</div></div>
  <div class="weather-pill"><span id="weather-icon">☀</span><span id="weather-name">晴日</span><i></i><span id="life-clock">09:00</span></div>
  <div class="camera-tools" aria-label="观察视角"><button data-camera="all" aria-pressed="true">全景</button><button data-camera="near" aria-pressed="false">走近一点</button><button data-camera="follow" aria-pressed="false">跟随所选</button></div>
  <div id="person-labels"></div>
  <div class="scene-bottom"><div class="scene-legend"><span class="live-dot"></span><b id="run-state">正在准备</b><small>拖动旋转 · 滚轮缩放</small></div><div class="playback"><button id="pause" aria-label="暂停生活" disabled>Ⅱ</button><button id="speed" disabled>1×</button><div class="playback-line"></div><button id="reset" aria-label="重新开始" disabled>↺</button></div></div>
  <div id="life-loader"><div class="loader-art"><span></span><span></span><span></span><span></span></div><div class="eyebrow">A LITTLE WORLD IS WAKING UP</div><h2>准备两份不同的日常</h2><p id="load-progress">读取最新版人物的完整形态和皮肤</p><div class="loading-line"><i></i></div><small>首次打开需要加载完整人物资源</small></div>
  <section id="data-panel" hidden aria-label="实时观察数据"><div class="data-heading"><div><span class="eyebrow">LIVE OBSERVATION</span><h2>看见选择背后的原因</h2></div><button id="data-close" aria-label="关闭观察数据">×</button></div><p class="data-intro">每个选择由需求、偏好、距离和眼前条件共同决定。轻微随机只发生在合理候选之间。</p><div class="need-controls"><label>所选人物 · 饥饿程度<input id="need-hunger" aria-label="所选人物饥饿程度" type="range" min="0" max="100" value="50"></label><label>疲劳程度<input id="need-fatigue" aria-label="所选人物疲劳程度" type="range" min="0" max="100" value="50"></label></div><div id="choice-reasons"></div><details><summary>实时状态与检查记录</summary><pre id="life-diagnostics"></pre></details><p class="scope-note">基础版：程序骨骼动作、有限力辅助抓取与刚体物件。衣服是随人物变形的外观层；尚未模拟布料、全身接触和手指摩擦。</p></section>
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
  const n=230,vertices=new Float32Array(n*6),seed=[];
  for(let i=0;i<n;i++)seed.push([(Math.sin(i*73.3)*.5+.5)*12-6,(Math.cos(i*19.13)*.5+.5)*4.5,(Math.sin(i*37.7)*.5+.5)*8-3.4]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
  const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x8caaa4,transparent:true,opacity:.38,depthWrite:false}));lines.visible=false;lines.frustumCulled=false;scene.add(lines);
  return {update(time,active){lines.visible=active;if(!active)return;seed.forEach((p,i)=>{const y=(p[1]-time*3.2)%4.5;const h=y<0?y+4.5:y;vertices.set([p[0],h,p[2],p[0]-.035,h+.20,p[2]-.015],i*6);});geometry.attributes.position.needsUpdate=true;}};
}

async function main(){
  const {actors,viewer}=await createActors({onProgress:p=>{$('load-progress').textContent=typeof p==='string'?p:JSON.stringify(p);}});
  if(actors.length!==2)throw Error('这一版必须使用两个完整原生人物');
  for(const actor of actors){$('load-progress').textContent=`按 ${actor.id} 的真实手形校准抓取`;const fit=actor.configureGrasp({radius:.032,height:.14,gripHeight:0});if(!fit.admissible)throw Error(actor.id+' 原生手形未通过抓取标定');}
  const keep=new Set(actors.map(a=>a.root));for(const child of [...viewer.scene.children])if(!keep.has(child))viewer.scene.remove(child);
  const courtyard=createCourtyard(THREE);viewer.scene.add(courtyard.group);
  viewer.scene.background=new THREE.Color('#e8e1d3');
  const hemi=new THREE.HemisphereLight(0xf8f4e7,0x8b8b76,2.2);viewer.scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffefd6,3.4);sun.position.set(-4,9,7);sun.target.position.set(0,0,-.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-9,right:9,top:8,bottom:-8,near:.5,far:25});sun.shadow.bias=-.0005;sun.shadow.normalBias=.018;viewer.scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0xdce9ef,.65);fill.position.set(5,4,-2);viewer.scene.add(fill);
  viewer.renderer.shadowMap.enabled=true;viewer.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
  viewer.camera.near=.05;viewer.camera.far=65;viewer.camera.fov=38;viewer.camera.zoom=1;viewer.camera.updateProjectionMatrix();
  viewer.orbit.minDistance=2;viewer.orbit.maxDistance=26;viewer.orbit.maxPolarAngle=Math.PI*.46;viewer.orbit.enablePan=true;
  const renderQueue=manageRendering(viewer);
  const sim=new LifeSimulation({seed:20261020,colliders:courtyard.colliders,spots:courtyard.spots});
  // The visible self-service shelf holds six portions, matching available stock.
  sim.shop.stock=6;
  const motion=new Map(),dresses=[],shadows=new Map();
  for(const actor of actors){
    actor.mesh.castShadow=false; // Native skin requires a different depth shader; soft ground contact is used here.
    const dress=dressActor(actor,THREE,{shirtColor:actor.id==='A'?'#d3c4a4':'#a45e46',trouserColor:actor.id==='A'?'#3d5148':'#494039'});dresses.push(dress);
    motion.set(actor.id,new NativeMotion(actor));const shadow=softShadow();viewer.scene.add(shadow);shadows.set(actor.id,shadow);
  }
  const items=new ItemWorld({THREE,scene:viewer.scene,sim,courtyard,actors});
  const rain=makeRain(viewer.scene);let selected='A',cameraMode='all',paused=false,speed=1,ready=false,last=performance.now(),lastUI=0,lastRender=0,frameCount=0;
  const reports={},audit={interactions:[],motionFailures:[],minActorDistance:Infinity,maxBoneLengthErrorM:0,maxFootPenetrationM:0,frames:0};
  const labelElements=new Map();
  for(const a of sim.actors){const el=document.createElement('button');el.className='person-label '+a.id.toLowerCase();el.innerHTML=`<i></i>${a.name}<span>…</span>`;el.setAttribute('aria-label','观察'+a.name);el.onclick=()=>select(a.id,true);$('person-labels').append(el);labelElements.set(a.id,el);}

  function select(id,follow=false){selected=id;if(follow)camera('follow');updateUI();}
  function camera(mode){
    cameraMode=mode;const actor=sim.actor(selected);let target,p;
    if(mode==='all'){target=[-.4,.7,.0];p=[9.2,9.3,14.2];}
    else if(mode==='near'){target=[-.55,.78,.30];p=[5.8,5.6,9.7];}
    else{target=[actor.x,1.05,actor.z];p=[actor.x+2.8,2.65,actor.z+4.5];}
    viewer.orbit.target.set(...target);viewer.camera.position.set(...p);viewer.camera.zoom=1;viewer.orbit.update();viewer.camera.updateProjectionMatrix();
    for(const b of app.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',String(b.dataset.camera===mode));viewer.render();
  }
  function resize(){const r=stage.getBoundingClientRect();if(r.width<1||r.height<1)return;viewer.renderer.setSize(r.width,r.height,false);viewer.camera.aspect=r.width/r.height;viewer.camera.updateProjectionMatrix();viewer.render();}
  new ResizeObserver(resize).observe(stage);addEventListener('resize',resize);
  function labels(){const r=stage.getBoundingClientRect();for(const actor of actors){const el=labelElements.get(actor.id),mouth=reports[actor.id]?.mouth;const p=(mouth?new THREE.Vector3(mouth[0],mouth[1]+.34,mouth[2]):new THREE.Vector3(actor.root.position.x,actor.measurements.heightM+.19,actor.root.position.z)).project(viewer.camera);el.style.transform=`translate(-50%,-100%) translate(${(p.x*.5+.5)*r.width}px,${(-p.y*.5+.5)*r.height}px)`;el.hidden=p.z>1||p.z< -1;el.classList.toggle('selected',actor.id===selected);}}
  const showData=value=>{$('data-panel').hidden=!value;$('data-toggle').setAttribute('aria-expanded',String(value));updateUI();};
  $('data-toggle').onclick=()=>showData($('data-panel').hidden);$('data-close').onclick=()=>showData(false);
  for(const b of app.querySelectorAll('[data-camera]'))b.onclick=()=>camera(b.dataset.camera);
  $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?icons.play:icons.pause;$('pause').setAttribute('aria-label',paused?'继续生活':'暂停生活');updateUI();};
  $('speed').onclick=()=>{speed=speed===1?2:1;$('speed').textContent=speed+'×';updateUI();};
  $('reset').onclick=()=>{sim.reset();sim.shop.stock=6;items.reset();audit.interactions=[];audit.motionFailures=[];audit.minActorDistance=Infinity;paused=false;$('pause').textContent=icons.pause;$('pause').setAttribute('aria-label','暂停生活');updateUI();};
  $('add-bottle').onclick=()=>sim.spawnBottle();$('shop-toggle').onclick=()=>sim.setShopOpen(!sim.shop.open);$('rain-toggle').onclick=()=>sim.toggleRain();$('interrupt').onclick=()=>sim.interrupt(selected);
  $('need-hunger').oninput=e=>sim.setActorNeed(selected,'hunger',+e.target.value/100);$('need-fatigue').oninput=e=>sim.setActorNeed(selected,'fatigue',+e.target.value/100);

  function currentReport(){return {version:window.__NPC_BUILD__,ready,paused,speed,time:sim.time,selected,cameraMode,
    source:{canonicalVersion:'HUMAN-INTEGRATED-R07',canonicalSHA256:window.__NPC_BUILD__.canonicalSHA256,identities:actors.map(a=>({id:a.id,identity:a.identity,measurements:a.measurements,binding:a.binding.report}))},
    simulation:sim.snapshot(),motions:reports,items:items.snapshot(),audit,render:renderQueue.status(),garments:dresses.map(d=>d?.report||null),scene:courtyard.metrics,
    assets:{mode:window.__NPC_ASSETS__?.mode,servedCount:window.__NPC_ASSETS__?.served?.length,served:window.__NPC_ASSETS__?.served||[],missing:window.__NPC_ASSETS__?.missing||[]},errors,visualAcceptance:false,productionReady:false};}
  function updateUI(){
    const a=sim.actor(selected),minutes=Math.floor(sim.time/3),clock=9*60+minutes;
    $('life-clock').textContent=`${String(Math.floor(clock/60)%24).padStart(2,'0')}:${String(clock%60).padStart(2,'0')}`;
    $('weather-name').textContent=sim.raining?'微雨':'晴日';$('weather-icon').textContent=sim.raining?icons.rain:icons.sun;
    $('run-state').textContent=ready?(paused?'日常已暂停':'他们正在生活'):'正在准备';
    $('shop-toggle').innerHTML=`<span class="control-icon">▱</span>${sim.shop.open?'面包店打烊':'面包店开门'}`;
    $('rain-toggle').innerHTML=`<span class="control-icon">☂</span>${sim.raining?'让雨停下':'下点雨'}`;
    $('people-cards').innerHTML=sim.actors.map(s=>`<button class="person-card ${s.id.toLowerCase()} ${s.id===selected?'selected':''}" data-person="${s.id}" aria-pressed="${s.id===selected}"><div class="person-top"><span class="person-initial">${s.id==='A'?'林':'周'}</span><span><strong>${s.name}</strong><small>${s.id==='A'?'高瘦 · 勤快，好奇':'矮壮 · 慢性子，爱歇脚'}</small></span><span class="person-arrow">↗</span></div><div class="action-line"><span class="status-pip"></span>${s.task?.label||'稍候，看看周围'}<em>${s.task?.phase==='approach'?'前往':s.task?.phase==='rest'?'停留':''}</em></div><div class="needs"><span>饥饿<i><b style="width:${Math.round(s.needs.hunger*100)}%"></b></i></span><span>疲劳<i><b style="width:${Math.round(s.needs.fatigue*100)}%"></b></i></span></div><p class="person-reason">${escape(s.reason)}</p><div class="pocket"><span>零钱 ¥${s.money}</span><span>瓶子 ${s.inventory.bottles.length}</span><span>面包 ${s.inventory.bread}</span></div></button>`).join('');
    for(const b of $('people-cards').querySelectorAll('[data-person]'))b.onclick=()=>select(b.dataset.person);
    $('event-feed').innerHTML=sim.events.filter(e=>!['reset'].includes(e.type)).slice(-4).reverse().map(e=>`<li><span class="event-time">${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(Math.floor(e.time%60)).padStart(2,'0')}</span><p>${escape(e.message)}</p></li>`).join('')||'<li><p>他们正在留意眼前的事情。</p></li>';
    for(const s of sim.actors){const el=labelElements.get(s.id);el.querySelector('span').textContent=s.task?.label||'看看周围';}
    if(!$('data-panel').hidden){
      if(document.activeElement!==$('need-hunger'))$('need-hunger').value=Math.round(a.needs.hunger*100);
      if(document.activeElement!==$('need-fatigue'))$('need-fatigue').value=Math.round(a.needs.fatigue*100);
      const candidates=sim.getCandidates(selected).slice(0,4),max=Math.max(...candidates.map(c=>c.score),1);
      $('choice-reasons').innerHTML=`<h3>${a.name} · 此刻的选择</h3><p>${escape(a.reason)}</p><div class="candidate-list">${candidates.map(c=>`<div><span>${escape(({rest:'坐下歇脚',collect:'收集瓶子',recycle:'换成零钱',buy:'买份面包',eat:'吃面包',wander:'随处走走',shelter:'避雨'})[c.kind])}</span><i><b style="width:${c.score/max*100}%"></b></i><small>${Math.round(c.score)}</small></div>`).join('')}</div><small class="candidate-note">分数随世界变化；已开始的动作会先完成或安全中断。</small>`;
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
      const input=items.motionInput?.(state)||{};
      const r=motion.get(actor.id).update({dt,time:sim.time,x,z,yaw:state.yaw,mode,progress,target,seatY,seatApproachOffset:.65,grip:1,speed:state.speed,distance:state.distanceTravelled,kind:t?.kind,...input});
      reports[actor.id]=r;
      if(r&&!r.finite)throw Error(actor.id+' 动作产生无效骨骼数据');
      audit.maxBoneLengthErrorM=Math.max(audit.maxBoneLengthErrorM,r?.boneLengthErrorM||0);
      const shadow=shadows.get(actor.id);shadow.position.x=actor.root.position.x;shadow.position.z=actor.root.position.z;
      if(t?.kind==='rest'&&t.waitForAcknowledgement&&t.progress>=.999){
        // Native executor reports actual immutable-bone pose and seat/foot geometry.
        const safe=r?.finite&&r.boneLengthErrorM<.0001&&(r.completed||r.complete||r.ready||r.poseComplete);
        if(safe){const ack=sim.acknowledgeInteraction(actor.id,true,{token:t.token,evidence:{executor:'native-104-bone-seat',...r}});audit.interactions.push({id:actor.id,kind:t.kind,phase:t.phase,time:sim.time,ack});}
      }
    }
    courtyard.update(sim,dt);
    const receipts=items.update(dt,reports)||[];
    for(const receipt of receipts){const ack=sim.acknowledgeInteraction(receipt.id,receipt.success,{token:receipt.token,evidence:receipt.evidence,reason:receipt.reason});audit.interactions.push({...receipt,time:sim.time,ack});}
    if(audit.interactions.length>60)audit.interactions.splice(0,audit.interactions.length-60);
    audit.minActorDistance=Math.min(audit.minActorDistance,Math.hypot(sim.actors[0].x-sim.actors[1].x,sim.actors[0].z-sim.actors[1].z));audit.frames++;rain.update(sim.time,sim.raining);
    sun.intensity=sim.raining?1.5:3.4;hemi.intensity=sim.raining?1.9:2.2;
  }
  window.__LIVING_COURTYARD__={snapshot:currentReport,ready:false,awaitFrame:o=>renderQueue.awaitFrame(o)};
  function frame(now){
    const elapsed=Math.max(0,(now-last)/1000);last=now;
    try{
      if(ready&&!paused){let dt=Math.min(elapsed,.12)*speed;while(dt>.00001){const step=Math.min(dt,1/30);execute(step);dt-=step;}}
      if(cameraMode==='follow'&&ready){const a=sim.actor(selected),target=new THREE.Vector3(a.x,1.05,a.z),delta=target.clone().sub(viewer.orbit.target);viewer.orbit.target.add(delta);viewer.camera.position.add(delta);viewer.orbit.update();}
      if(ready&&!paused&&now-lastRender>32){viewer.render();lastRender=now;}
      renderQueue.pump();labels();
      if(now-lastUI>320){updateUI();lastUI=now;}
      frameCount++;
    }catch(error){paused=true;errors.push(error.message);$('run-state').textContent='检查发现问题，已暂停';document.documentElement.dataset.npcReady='failed';console.error(error);}
    requestAnimationFrame(frame);
  }
  execute(0);camera('all');resize();viewer.render();requestAnimationFrame(frame);
  $('load-progress').textContent='两个人物已就绪，正在绘制小院的第一帧';
  await renderQueue.awaitFrame({fresh:true});ready=true;window.__LIVING_COURTYARD__.ready=true;last=performance.now();
  for(const b of app.querySelectorAll('button'))b.disabled=false;$('life-loader').hidden=true;document.documentElement.dataset.npcReady='true';updateUI();
}
main().catch(error=>{errors.push(error.message);$('load-progress').textContent='本次检查未通过：'+error.message;document.documentElement.dataset.npcReady='failed';console.error(error);});
