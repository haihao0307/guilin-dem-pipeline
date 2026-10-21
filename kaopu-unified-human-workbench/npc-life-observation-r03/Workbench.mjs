import {THREE,createActors} from './ActorAdapter.mjs';
import {LifeWorld,DIM} from './LifeWorld.mjs';
import {WINDOW_DIM} from './WindowInteraction.mjs';
import {manageRendering} from './RenderQueue.mjs';
import {createObservationClock} from './ObservationClock.mjs';

const phaseNames={'close-grip':'接触 / 握住把手',swing:'沿铰链开合',withdraw:'松手撤离',rest:'回到自然姿态',idle:'待命',waiting:'等待物品使用权',approach:'伸手接近',close:'接触 / 闭指',lift:'抬离桌面',transfer:'移向收纳区',lower:'降低物品',verify:'松手 / 检查落稳',done:'任务结束',failed:'未完成',cancelled:'已中断'};
const html=`<header><div><div class="eyebrow">KAOPU / HUMAN × ENVIRONMENT</div><h1>生活动作观察台</h1></div><div class="top-meta">R07 完整人物 · R03 观察修复<br><span id="npc-ready">正在准备人物</span></div></header>
<aside><section class="section"><h2>01 / 选择工作位人物</h2><p>同一套原生骨骼与完整皮肤，三种实际体型。切换人物后，重新按其手臂尺寸求解接触。</p><div id="npc-choices"><button class="actor-select" data-person="0" disabled><b>A</b><span>高瘦<small>原生身体 / P01</small></span></button><button class="actor-select" data-person="1" disabled><b>B</b><span>矮壮<small>原生身体 / P02</small></span></button><button class="actor-select" data-person="2" disabled><b>C</b><span>结实<small>原生身体 / P05</small></span></button></div><div class="row"><button id="npc-pair" disabled>双人共同工作位</button><button id="npc-pick" disabled>选中人物拿放</button></div></section>
<section class="section window-section"><h2>02 / 真实开关窗</h2><div class="row"><button class="primary" id="npc-window-open" disabled>开窗 · 35°</button><button id="npc-window-close" disabled>关窗</button></div><div class="row"><button id="npc-window-block" disabled>加入实体挡块</button><button id="npc-window-contend" disabled>双人开窗演示</button></div><p>握住实际把手，以有限力推动铰链窗。切换工作位或开始双人演示会重置场景；同工作位连续开关保持实际窗扇状态。</p><div id="npc-window-status" role="status">正在准备窗扇与接触数据。</div></section>
<section class="section"><h2>03 / 拿放与任务协作</h2><button class="primary" id="npc-plan" disabled>按身份开始整理</button><div class="row"><button id="npc-contend" disabled>两人争用同一物品</button><button id="npc-cancel" disabled>中断当前持有者</button></div><div class="row"><button id="npc-pause" disabled>暂停</button><button id="npc-step" disabled>单步 1/120 秒</button><button id="npc-reset" disabled>重置场景</button></div><p id="npc-status" role="status">正在从当前人物总平台准备完整人物与独立动作绑定。</p><div id="npc-agents"></div><div id="npc-stats">准备物理世界…</div></section>
<section class="section"><h2>04 / 改变环境，观察结果</h2><div class="row"><button id="npc-target" disabled>移动收纳区</button><button id="npc-support" disabled>移开支撑面</button></div><p>拿起后可移开桌面：松手时物品会下落，任务应报告失败。物理世界的结果直接决定回执。</p><button id="npc-run-qa" disabled>运行 12 项数值验收</button><pre id="npc-qa">尚未运行本次验收。</pre></section>
<details><summary>实时数据与事件</summary><pre id="npc-events"></pre><button id="npc-export" disabled>导出本次数据 JSON</button><pre id="npc-data"></pre></details><p>本轮：固定工作位、刚体拿放、无锁扣的单扇铰链窗、真实挡块、动作中断与平滑回位。把手采用本轮已标定的较粗圆柱尺寸。保留完整原生人物；当前为有限力辅助握持，整房间导航、手指摩擦动力学和跨设备联机尚未接入。</p></aside>
<section id="npc-view" aria-label="生活人物与物品实时三维场景"><div class="view-tools"><button data-camera="all">全景</button><button data-camera="contact">拿放接触</button><button data-camera="window">窗边接触</button><button data-camera="side">侧面</button><button id="npc-debug">接触标记</button></div><div id="npc-playback" role="status">等待完整人物画面</div><div id="npc-caption">实时三维 · 拖动旋转 / 滚轮缩放<br>人物使用当前主线 R07 原生形态与完整程序皮肤</div><div id="npc-loader"><div class="load-box"><h2>准备三种完整人物</h2><div class="line"></div><p id="npc-progress">读取固定版本的原生形态与皮肤依赖。</p></div></div></section>`;
const app=document.createElement('div');app.id='npc-app';app.innerHTML=html;document.body.classList.add('npc-observe');document.body.append(app);const $=id=>document.getElementById(id);const sourceStage=$('stage');if(sourceStage)$('npc-view').prepend(sourceStage);
const errors=[];addEventListener('error',e=>{errors.push(String(e.message));});addEventListener('unhandledrejection',e=>{errors.push(String(e.reason?.message||e.reason));});
const fmt=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'—';

function visibleWindow(scene,controller){
  const root=new THREE.Group();root.name='NPC Window Assembly';scene.add(root);
  const leaf=new THREE.Group();leaf.name='NPC Window Leaf';root.add(leaf);
  const materials={
    frame:new THREE.MeshStandardMaterial({color:'#b3c7c3',roughness:.64,metalness:.15}),
    'fixed-frame':new THREE.MeshStandardMaterial({color:'#526e70',roughness:.72,metalness:.12}),
    glass:new THREE.MeshStandardMaterial({color:'#b6d4da',roughness:.16,metalness:0,transparent:true,opacity:.15,depthWrite:false}),
    handle:new THREE.MeshStandardMaterial({color:'#d5b675',roughness:.42,metalness:.48}),
    stop:new THREE.MeshStandardMaterial({color:'#708083',roughness:.75}),
    blocker:new THREE.MeshStandardMaterial({color:'#df9361',roughness:.66})
  };
  const partMesh=(part,parent)=>{
    const geometry=part.kind==='cylinder'?
      new THREE.CylinderGeometry(part.radius,part.radius,part.height,part.segments):
      new THREE.BoxGeometry(...(part.halfExtents||part.half).map(x=>x*2));
    const mesh=new THREE.Mesh(geometry,materials[part.material||part.appearance]);
    mesh.name=part.id==='handle'?'NPC Window Handle':'NPC Window '+part.id;
    mesh.position.set(...part.position);mesh.quaternion.set(...part.quaternion);parent.add(mesh);return mesh;
  };
  const leafParts=WINDOW_DIM.leafParts.map(part=>({part,mesh:partMesh(part,leaf)}));
  const staticParts=WINDOW_DIM.staticParts.map((part,i)=>({part,mesh:partMesh(part,root),body:controller.staticBodies[i]}));
  const blocker=partMesh(WINDOW_DIM.blocker,root);
  const handle=leafParts.find(p=>p.part.id==='handle').mesh;
  const anchor=new THREE.Mesh(new THREE.SphereGeometry(.009,12,8),new THREE.MeshBasicMaterial({color:'#ecc990',depthTest:false}));
  anchor.name='NPC Window Contact Marker';root.add(anchor);anchor.visible=false;
  const point=mesh=>mesh.getWorldPosition(new THREE.Vector3()).toArray();
  const rotation=mesh=>mesh.getWorldQuaternion(new THREE.Quaternion()).toArray();
  function sync(debug=false){
    leaf.position.copy(controller.leaf.position);leaf.quaternion.copy(controller.leaf.quaternion);
    for(const {mesh,body} of staticParts){mesh.position.copy(body.position);mesh.quaternion.copy(body.quaternion);}
    blocker.position.copy(controller.blocker.position);blocker.quaternion.copy(controller.blocker.quaternion);
    blocker.visible=controller.blocked;anchor.position.set(...controller.handleAnchor());anchor.visible=debug;
    root.updateMatrixWorld(true);
  }
  function solidBoxes(){
    root.updateMatrixWorld(true);
    return [...leafParts.filter(p=>p.part.kind==='box'),...staticParts,
      ...(controller.blocked?[{part:WINDOW_DIM.blocker,mesh:blocker}]:[])].map(({part,mesh})=>({
        id:part.id,position:point(mesh),quaternion:rotation(mesh),halfExtents:(part.halfExtents||part.half).slice()
      }));
  }
  function diagnostics(){
    root.updateMatrixWorld(true);
    return {leafName:leaf.name,handleName:handle.name,visible:root.visible&&leaf.visible,
      leafWorldPosition:point(leaf),leafWorldQuaternion:rotation(leaf),
      handleWorldPosition:point(handle),handleWorldQuaternion:rotation(handle),
      blockerVisible:blocker.visible,blockerWorldPosition:point(blocker),
      physicalLeaf:controller.pose(),physicalHandleCentre:controller.handleCenter(),
      collisionGeometryShared:true,leafParts:leafParts.length,staticParts:staticParts.length};
  }
  sync();return {root,leaf,handle,blocker,sync,solidBoxes,diagnostics};
}

function visibleWorld(scene){
  const root=new THREE.Group();root.name='NPC life shared world';scene.add(root);
  const mat=(color,roughness=.72)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0});
  const wood=mat('#655347'),edge=mat('#423e39'),floorMat=mat('#334047',.91),ceramic=mat('#bdc9b5',.42),cap=mat('#46594f',.48),targetMat=new THREE.MeshBasicMaterial({color:'#bad8b1',transparent:true,opacity:.2,depthWrite:false});
  const box=(size,pos,material,parent=root)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);parent.add(m);return m};
  box([7,.08,5],[.4,-.04,.4],floorMat);
  const table=new THREE.Group();root.add(table);box(DIM.tableHalf.map(v=>v*2),DIM.tableCentre,wood,table);for(const x of[-.51,.51])for(const z of[.32,.70])box([.045,DIM.tableTop-.07,.045],[x,(DIM.tableTop-.07)/2,z],edge,table);
  const bottle=new THREE.Group();root.add(bottle);const body=new THREE.Mesh(new THREE.CylinderGeometry(DIM.radius,DIM.radius,DIM.height,32),ceramic);bottle.add(body);const lid=new THREE.Mesh(new THREE.CylinderGeometry(DIM.radius*.9,DIM.radius*.9,.009,32),cap);lid.position.y=DIM.height/2-.006;bottle.add(lid);
  const zone=box([.16,.002,.15],[DIM.target[0],DIM.tableTop+.001,DIM.target[2]],targetMat);
  const markMaterial=new THREE.MeshBasicMaterial({color:'#eaca8a',depthTest:false});const targetMark=new THREE.Mesh(new THREE.SphereGeometry(.009,12,8),markMaterial);root.add(targetMark);targetMark.visible=false;
  const hands=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.006,12,8),new THREE.MeshBasicMaterial({color:i===0?'#72e9d1':i===1?'#83baff':'#d8beee',depthTest:false}));root.add(m);m.visible=false;hands.push(m);}
  return{root,table,bottle,zone,targetMark,hands,sync(w,debug){this.window?.sync(debug);bottle.position.copy(w.bottle.position);bottle.quaternion.copy(w.bottle.quaternion);table.visible=w.supportEnabled;zone.position.set(w.target[0],DIM.tableTop+.001,w.target[2]);targetMark.position.set(...w.contactAnchor());targetMark.visible=debug;w.actors.forEach((a,i)=>{const p=a.handAnchor();hands[i].position.set(...(Array.isArray(p)?p:[p.x,p.y,p.z]));hands[i].visible=debug;});}};
}

async function main(){
  const boot=window.__NPC_BOOT__;if(!boot)throw Error('启动监控未安装');boot.check();
  const result=await createActors({onProgress:p=>{const text=typeof p==='string'?p:JSON.stringify(p);$('npc-progress').textContent=text;boot.progress(text);}});
  const {actors,viewer}=result;if(actors.length!==3)throw Error('Observation requires three complete native actors');
  for(const [i,a] of actors.entries()){a.id=a.id||['A','B','C'][i];const text='正在按 '+a.id+' 的真实手部表面标定抓握';boot.stage('grasp-'+a.id,text);$('npc-progress').textContent=text;const g=a.configureGrasp({radius:DIM.radius,height:DIM.height,gripHeight:DIM.gripHeight});if(!g.admissible)throw Error(a.id+' 的手部几何未找到合格抓握');boot.check();await new Promise(requestAnimationFrame);}
  const canvas=viewer.renderer.domElement;if(!sourceStage.contains(canvas))sourceStage.append(canvas);
  viewer.renderer.setPixelRatio(1);viewer.camera.near=.02;viewer.camera.far=30;viewer.camera.updateProjectionMatrix();
  let runtimeFailure=null,sceneEpoch=0;
  let selected=0,pair=false,interactionMode='table',paused=false,debug=false,currentView='all',acc=0,last=performance.now(),lastUI=0,frameMS=[],probe=null,lastVisual='',lastActive=false,ready=false;
  const observation=createObservationClock();
  const renderQueue=manageRendering(viewer,{onFailure:failRuntime,onSubmitMetadata:frameState});
  renderQueue.onComplete(frame=>observation.complete(frame));
  const props=visibleWorld(viewer.scene);
  const world=new LifeWorld(actors,{onEvent:()=>{}});
  props.window=visibleWindow(viewer.scene,world.window);
  function phaseKey(){return [sceneEpoch,interactionMode,world.heldBy||'',world.reservedBy||'',world.window.heldBy||'',world.window.reservedBy||'',...[...world.agents.values()].map(a=>`${a.id}:${a.phase}:${a.retraction?.stage||''}`),...[...world.window.agents.values()].map(a=>`${a.id}:${a.phase}:${a.recovery?.phase||''}:${a.task?.token??a.result?.taskToken??''}`)].join('|');}
  function frameState(){return {sceneEpoch,phaseKey:phaseKey(),simulationTime:world.time,camera:currentView,mode:probe&&!probe.report.completed?'accelerated-numerical-verification':'observation',paused,
    agents:[...world.agents.values()].map(a=>({id:a.id,phase:a.phase,recovery:a.retraction?.stage||null,taskStarted:a.started??null})),
    windowAgents:[...world.window.agents.values()].map(a=>({id:a.id,phase:a.phase,recovery:a.recovery?.phase||null,taskStarted:a.started??null,taskToken:a.task?.token??a.result?.taskToken??null})),
    bottle:{position:world.bottle.position.toArray(),heldBy:world.heldBy},window:{angleDeg:world.window.snapshot().object.angleDeg,heldBy:world.window.heldBy}};}
  function failRuntime(error){if(runtimeFailure)return;runtimeFailure=error instanceof Error?error:Error(String(error));paused=true;ready=false;if(window.__NPC_OBSERVATION__)window.__NPC_OBSERVATION__.ready=false;errors.push(runtimeFailure.message);boot.fail(runtimeFailure,{code:'RUNTIME_STOPPED'});for(const b of app.querySelectorAll('button'))b.disabled=true;$('npc-ready').textContent='运行已停止';$('npc-status').textContent='运行已停止：'+runtimeFailure.message;document.documentElement.dataset.npcReady='failed';}
  function resumeTask(){paused=false;acc=0;observation.reset();$('npc-pause').textContent='暂停';}

  function station(mode){
    sceneEpoch++;observation.reset();world.reset();pair=mode==='pair'||mode==='window-pair';interactionMode=mode.startsWith('window')?'window':'table';if(pair)selected=0;$('npc-pick').textContent=(pair?'工作位 A':actors[selected].id)+' 拿放';
    actors.forEach((a,i)=>{const base=a.floorOffset??a.binding?.floorOffset??0;const p=pair?(interactionMode==='window'?[[-.12,base,.10],[.60,base,.05],[1.50,base,-.13]]:[[ -.31,base,.08],[.38,base,.05],[1.48,base,-.10]])[i]:(i===selected?[-.12,base,[.10,.05,.08][i]]:[[...actors.keys()].filter(n=>n!==selected).indexOf(i)===0?-1.02:1.02,base,-.13]);a.root.position.set(...p);a.root.rotation.set(0,0,0);a.setSide?.(pair?(i===0?'L':'R'):'L');a.rest();a.root.updateMatrixWorld(true);});
    for(const [i,b] of [...document.querySelectorAll('[data-person]')].entries())b.setAttribute('aria-pressed',String(!pair&&i===selected));$('npc-pair').setAttribute('aria-pressed',String(pair));camera('all');
  }
  function enterMode(mode,{paired=false}={}){if(interactionMode!==mode||pair!==paired)station(mode==='window'?(paired?'window-pair':'window-single'):(paired?'pair':'single'));}
  // Observe bottle contact from the open left side of the actual window frame.
  // Raising the view resolves the support surface without hiding scene objects.
  function camera(mode){currentView=mode;let p,target;if(mode==='window'){p=[.84,1.51,1.63];target=[.29,1.25,.38];}else if(mode==='contact'){p=[-1.05,1.60,.90];target=[.045,1.12,.40];}else if(mode==='side'){p=[3.2,1.55,1.3];target=[.25,1,.1];}else{const xs=actors.map(a=>a.root.position.x),cx=(Math.min(...xs)+Math.max(...xs))/2,width=Math.max(...xs)-Math.min(...xs)+.8,height=Math.max(...actors.map(a=>a.measurements.heightM)),tan=Math.tan(viewer.camera.fov*Math.PI/360),d=Math.max(3.7,width/(2*tan*Math.max(.25,viewer.camera.aspect))*1.15,height/(2*tan)*1.12);target=[cx,.94,.12];p=[cx+d*.18,.94+d*.16,.12+d];}viewer.camera.position.set(...p);viewer.orbit.target.set(...target);viewer.camera.zoom=1;viewer.orbit.update();viewer.camera.updateProjectionMatrix();viewer.render();}
  function resize(){const r=sourceStage.getBoundingClientRect();if(r.width<1||r.height<1)return;viewer.renderer.setSize(r.width,r.height,false);viewer.camera.aspect=r.width/r.height;viewer.camera.updateProjectionMatrix();if(currentView==='all')camera('all');else viewer.render();}
  const ro=new ResizeObserver(resize);ro.observe(sourceStage);addEventListener('resize',resize);
  $('npc-pair').onclick=()=>station('pair');for(const b of document.querySelectorAll('[data-person]'))b.onclick=()=>{selected=+b.dataset.person;station(interactionMode==='window'?'window-single':'single');};
  $('npc-pick').onclick=()=>{enterMode('table',{paired:pair});camera('contact');world.request(actors[selected].id);};
  $('npc-plan').onclick=()=>{enterMode('table',{paired:true});camera('contact');world.startIdentityPlan();};
  $('npc-contend').onclick=()=>{enterMode('table',{paired:true});camera('contact');world.request(actors[0].id,'contention-test');world.request(actors[1].id,'contention-test');};
  $('npc-window-open').onclick=()=>{enterMode('window',{paired:interactionMode==='window'?pair:false});camera('window');world.window.request(actors[selected].id,'open','manual');};
  $('npc-window-close').onclick=()=>{enterMode('window',{paired:interactionMode==='window'?pair:false});camera('window');world.window.request(actors[selected].id,'close','manual');};
  $('npc-window-block').onclick=()=>{enterMode('window',{paired:interactionMode==='window'?pair:false});world.window.setBlocked(!world.window.snapshot().object.blocked);};
  $('npc-window-contend').onclick=()=>{station('window-pair');camera('window');world.window.request('A','open','shared-window-test');world.window.request('B','open','shared-window-test');};
  $('npc-cancel').onclick=()=>{const id=interactionMode==='window'?(world.window.heldBy||world.window.reservedBy||actors[selected].id):(world.heldBy||world.reservedBy||actors[selected].id);world.cancel(id);};
  $('npc-pause').onclick=()=>{paused=!paused;acc=0;observation.reset();$('npc-pause').textContent=paused?'继续':'暂停';};$('npc-step').onclick=()=>{paused=true;observation.reset();$('npc-pause').textContent='继续';world.tick(1/120);props.sync(world,debug);viewer.render();updateUI();};
  $('npc-reset').onclick=()=>{sceneEpoch++;observation.reset();world.reset();probe=null;$('npc-run-qa').disabled=false;};$('npc-target').onclick=()=>world.moveTarget();$('npc-support').onclick=()=>{world.setSupport(!world.supportEnabled);$('npc-support').textContent=world.supportEnabled?'移开支撑面':'恢复支撑面';};
  for(const b of document.querySelectorAll('[data-camera]'))b.onclick=()=>camera(b.dataset.camera);
  $('npc-debug').onclick=()=>{debug=!debug;props.sync(world,debug);};
  function download(){const data={...world.snapshot(),version:'NPC-LIFE-OBSERVATION-R03',errors,performance:perf(),build:window.__NPC_BUILD__,verification:probe?.report||null,observation:observation.snapshot(),boot:boot.snapshot()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='npc-life-observation-r03-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('npc-export').onclick=download;
  const perf=()=>{const q=renderQueue.status(),s=q.gpuFrameDurationsMS.slice().sort((a,b)=>a-b),r=frameMS.slice().sort((a,b)=>a-b);return{samples:s.length,medianFrameMS:s.length?s[Math.floor(s.length*.5)]:null,p95FrameMS:s.length?s[Math.floor(s.length*.95)]:null,maxFrameMS:s.at(-1)??null,frameMeasurement:q.measurement,medianRAFIntervalMS:r.length?r[Math.floor(r.length*.5)]:null,p95RAFIntervalMS:r.length?r[Math.floor(r.length*.95)]:null,maxRAFIntervalMS:r.at(-1)??null,renderQueue:q,renderer:viewer.renderer.getContext().getParameter(viewer.renderer.getContext().RENDERER),pixelRatio:viewer.renderer.getPixelRatio(),visibleActors:actors.filter(a=>a.root.visible).length};};
  function updateUI(){if(runtimeFailure)return;const shown=observation.summary(),numerical=probe&&!probe.report.completed;const s=world.snapshot(),obj=s.object,win=s.window.object;$('npc-ready').textContent=`${actors.length} 个完整人物 · ${paused?'已暂停':numerical?'数值验收':shown.slowMode?'慢速观察':'连续观察'}`;$('npc-playback').textContent=numerical?'数值验收加速运行 · 不作为连续动作画面证明':paused?'已暂停 · 点击动作会自动继续':shown.slowMode?'慢速观察 · 等待完整画面后继续动作':`连续观察 · 已呈现物理时间 ${fmt(shown.lastCompleted?.metadata?.simulationTime||0,2)} s`;$('npc-support').textContent=world.supportEnabled?'移开支撑面':'恢复支撑面';
    $('npc-window-block').textContent=win.blocked?'移除实体挡块':'加入实体挡块';
    $('npc-window-status').textContent=`实际开角 ${fmt(Math.abs(win.angleDeg),1)}° · ${win.heldBy?win.heldBy+' 握持':win.reservedBy?win.reservedBy+' 已预约':'已松手'} · ${win.blocked?'挡块已加入':'通道无挡块'}`;
    $('npc-status').textContent=interactionMode==='window'?(s.window.agents.find(a=>a.id===(win.heldBy||win.reservedBy||actors[selected].id))?.result?.detail||'窗扇的实际角度、速度和释放状态决定任务结果。'):world.heldBy?`${world.heldBy} 正在握持；物品受有限力约束。`:world.reservedBy?`${world.reservedBy} 已取得物品使用权。`:world.goal()?'物品已经释放并在收纳区稳定。':'物品处于共享物理世界，等待任务。';
    $('npc-agents').innerHTML=s.agents.map(a=>{const wa=s.window.agents.find(w=>w.id===a.id);const state=interactionMode==='window'&&wa?wa:a;return `<div class="agent-line"><b>${a.id} / ${a.role}</b> · ${phaseNames[state.phase]||state.phase}${state.recovery?' · 正在回位':''}${state.result?`<br>${state.result.detail||''}`:''}</div>`;}).join('')+(world.autonomous?`<div class="agent-line">C / ${world.review.phase}<br>${world.review.reason}</div>`:'');
    const current=s.agents.find(a=>a.id===world.heldBy);$('npc-stats').innerHTML=interactionMode==='window'?`<div><span class="label">窗扇实际角度</span><b>${fmt(win.angleDeg,1)}°</b></div><div><span class="label">实际角速度</span>${fmt(win.angularVelocityRadS)} rad/s</div><div><span class="label">永久铰链</span>${win.hingeConstraintCount}</div><div><span class="label">临时握持</span>${win.gripConstraintCount}</div><div><span class="label">当前使用者</span>${win.heldBy||win.reservedBy||'无'}</div><div><span class="label">物理时间</span>${fmt(world.time,1)} s</div>`:`<div><span class="label">物品持有者</span><b>${obj.heldBy||'无'}</b></div><div><span class="label">实际约束数</span>${obj.constraintCount}</div><div><span class="label">接触误差</span>${current?fmt(current.contactErrorM*1000,1)+' mm':'—'}</div><div><span class="label">物品高度</span>${fmt(obj.position[1])} m</div><div><span class="label">实际支撑</span>${obj.supported?'桌面接触':'无桌面接触'}</div><div><span class="label">速度</span>${fmt(Math.hypot(...obj.velocity))} m/s</div><div><span class="label">物理时间</span>${fmt(world.time,1)} s</div><div><span class="label">完整帧完成</span>${fmt(perf().medianFrameMS,0)} ms</div>`;
    $('npc-events').textContent=s.events.slice(-10).map(e=>`${fmt(e.t,2)}  ${e.actor||'世界'}  ${e.type}${e.phase?' / '+phaseNames[e.phase]:''}`).join('\n');
    if($('npc-data').parentElement.open)$('npc-data').textContent=JSON.stringify({...s,performance:perf(),errors},null,2);
    $('npc-caption').innerHTML=`实时三维 · 拖动旋转 / 滚轮缩放<br>${interactionMode==='window'?(pair?'A / B 排队使用同一扇窗':'当前窗边工作位 '+actors[selected].id)+' · 实际开角 '+fmt(Math.abs(win.angleDeg),1)+'°':pair?'A 与 B 共享一件物品，C 读取结果':'当前工作位 '+actors[selected].id+'；其余人物保留在同一场景'}`;
  }
  // QA is explicit and observable. It drives the same task methods and measures the same world.
  class ProbeSuite {
    constructor(){
      this.index=0;this.started=false;
      this.report={startedAt:new Date().toISOString(),completed:false,tests:[],errors};
      this.tests=[
        ...actors.map((_,i)=>({name:`${actors[i].id} 原生体型拿放`,kind:'pick',actor:i})),
        {name:'双人同时申请与等待',kind:'contention'},
        {name:'持有途中中断与重新申请',kind:'cancel'},
        {name:'移走支撑后不得报告放置成功',kind:'support'},
        ...actors.map((_,i)=>({name:`${actors[i].id} 实际开关窗与回位`,kind:'window-cycle',actor:i})),
        {name:'实体挡块阻止开窗完成',kind:'window-block'},
        {name:'半开途中取消与自然回位',kind:'window-cancel'},
        {name:'两人排队使用同一扇窗',kind:'window-contention'}
      ];
    }
    restErrors(){return Object.fromEntries(actors.map(a=>[a.id,a.diagnostics().restPoseErrorRad]));}
    windowSnapshot(){return structuredClone(world.window.snapshot());}
    terminal(a){return a&&['done','failed','cancelled'].includes(a.phase)&&!a.recovery&&!world.window.ownsActor(a.id);}
    begin(test){
      selected=test.actor||0;
      const isWindow=test.kind.startsWith('window-');
      station(isWindow?(test.kind==='window-contention'?'window-pair':'window-single'):
        ['contention','cancel'].includes(test.kind)?'pair':'single');
      camera(isWindow?'window':'contact');
      this.start=world.time;this.stage='run';this.started=true;this.action=false;
      this.opened=null;this.cancelState=null;this.contactStart=world.audit.contacts.length;
      if(isWindow){
        if(test.kind==='window-block')world.window.setBlocked(true);
        world.window.request(actors[selected].id,'open','built-in:'+test.kind);
        if(test.kind==='window-contention')world.window.request('B','open','built-in:window-contention');
      }else if(['contention','cancel'].includes(test.kind)){
        world.request('A');world.request('B');
      }else world.request(actors[selected].id);
    }
    finish(test,pass,detail){
      if(detail)detail.actor=actors[test.actor||0].id;
      this.report.tests.push({name:test.name,kind:test.kind,pass,detail});
      this.index++;this.started=false;
      if(this.index<this.tests.length)return;
      this.report.completed=true;this.report.passed=this.report.tests.every(t=>t.pass)&&errors.length===0;
      this.report.performance=perf();this.report.finishedAt=new Date().toISOString();
      $('npc-qa').textContent=`验收完成 · ${this.report.tests.filter(t=>t.pass).length}/${this.report.tests.length} 通过\n`+
        this.report.tests.map(t=>`${t.pass?'通过':'失败'} · ${t.name}`).join('\n');
      $('npc-run-qa').disabled=false;
      document.documentElement.dataset.npcQa=this.report.passed?'passed':'failed';
      $('npc-data').textContent=JSON.stringify({verification:this.report,snapshot:world.snapshot(),errors},null,2);
    }
    update(){
      const test=this.tests[this.index];if(!test)return;
      if(!this.started)this.begin(test);
      const a=world.agents.get(actors[test.actor||0].id),b=world.agents.get('B');
      let done=false,pass=false,detail;
      if(test.kind.startsWith('window-')){
        const w=world.window.snapshot(),wa=w.agents.find(x=>x.id===a.id),wb=w.agents.find(x=>x.id==='B');
        if(test.kind==='window-cycle'&&this.terminal(wa)){
          if(this.stage==='run'&&wa.result?.result==='completed'&&w.object.goalOpen){
            this.opened=this.windowSnapshot();this.openRest=this.restErrors();this.stage='closing';
            world.window.request(a.id,'close','built-in:window-cycle');
          }else{
            done=true;const final=this.windowSnapshot(),restErrors=this.restErrors();
            pass=this.stage==='closing'&&wa.result?.result==='completed'&&w.object.goalClosed&&
              w.object.gripConstraintCount===0&&w.object.hingeConstraintCount===1&&
              Object.values(restErrors).every(v=>v<1e-5)&&Object.values(this.openRest||{}).every(v=>v<1e-5);
            detail={kind:test.kind,window:final,opened:this.opened,closed:this.stage==='closing'?final:null,
              restErrors,openRestErrors:this.openRest};
          }
        }else if(test.kind==='window-block'&&this.terminal(wa)){
          done=true;const restErrors=this.restErrors();
          pass=wa.result?.result==='blocked'&&!w.object.goalOpen&&w.object.blocked&&
            w.object.gripConstraintCount===0&&w.object.hingeConstraintCount===1&&Object.values(restErrors).every(v=>v<1e-5);
          detail={kind:test.kind,window:this.windowSnapshot(),restErrors};
        }else if(test.kind==='window-cancel'){
          if(!this.action&&w.object.heldBy===a.id&&w.object.angleDeg< -8&&w.object.angleDeg> -30){
            this.cancelState={before:this.windowSnapshot(),actualAngleDeg:w.object.angleDeg};
            world.window.cancel(a.id);this.cancelState.after=this.windowSnapshot();this.action=true;
          }
          if(this.action&&this.terminal(wa)){
            done=true;const restErrors=this.restErrors();
            pass=wa.result?.result==='cancelled'&&this.cancelState.after.object.gripConstraintCount===0&&
              this.cancelState.after.object.heldBy===null&&this.cancelState.after.object.reservedBy===null&&
              w.object.hingeConstraintCount===1&&w.object.gripConstraintCount===0&&Object.values(restErrors).every(v=>v<1e-5);
            detail={kind:test.kind,window:this.windowSnapshot(),cancel:this.cancelState,restErrors};
          }
        }else if(test.kind==='window-contention'&&this.terminal(wa)&&this.terminal(wb)){
          done=true;const restErrors=this.restErrors();
          pass=wa.result?.result==='completed'&&wb.result?.result==='already-at-target'&&w.object.goalOpen&&
            w.audit.maxGripConstraints<=1&&w.audit.maxOwners<=1&&Object.values(restErrors).every(v=>v<1e-5);
          detail={kind:test.kind,window:this.windowSnapshot(),restErrors};
        }
      }else{
        if(test.kind==='support'&&a.phase==='transfer'&&!this.action){world.setSupport(false);this.action=true;}
        if(test.kind==='cancel'&&a.phase==='lift'&&world.heldBy===a.id&&world.bottle.position.y>DIM.source[1]+.05&&!this.action){
          const before={heightM:world.bottle.position.y,liftM:world.bottle.position.y-DIM.source[1],
            velocityY:world.bottle.velocity.y,constraints:world.gripConstraintCount()};
          world.cancel(a.id);this.action=true;
          this.cancelState={before,constraints:world.gripConstraintCount(),heldBy:world.heldBy,reservedBy:world.reservedBy};
        }
        if(test.kind==='pick'&&['done','failed'].includes(a.phase)&&!a.retraction){
          done=true;pass=a.result?.result==='completed'&&a.firstContactError<=.012&&a.maxContactError<.025&&a.actor.diagnostics().restPoseErrorRad<1e-5;
          detail={result:a.result,goal:world.goal(),measurements:a.actor.measurements,restErrors:this.restErrors()};
        }
        if(test.kind==='contention'&&['done','failed'].includes(a.phase)&&['done','failed'].includes(b.phase)&&!a.retraction&&!b.retraction){
          done=true;pass=a.result?.result==='completed'&&b.result?.result==='already-sorted'&&world.audit.maxGripConstraints<=1;
          detail={a:a.result,b:b.result,maxConstraints:world.audit.maxGripConstraints,restErrors:this.restErrors()};
        }
        if(test.kind==='cancel'&&this.action&&['done','failed'].includes(b.phase)&&!a.retraction&&!b.retraction){
          done=true;pass=this.cancelState.constraints===0&&this.cancelState.heldBy===null&&this.cancelState.reservedBy===null&&
            b.result?.result==='completed'&&a.actor.diagnostics().restPoseErrorRad<1e-5;
          detail={cancel:this.cancelState,b:b.result,restErrors:this.restErrors()};
        }
        if(test.kind==='support'&&a.phase==='failed'&&!a.retraction){
          done=true;pass=this.action&&a.result?.result==='world-result-failed'&&world.bottle.position.y<.2&&!world.heldBy&&!world.grip;
          detail={result:a.result,bodyY:world.bottle.position.y,restErrors:this.restErrors()};
        }
      }
      if(world.time-this.start>(test.kind==='window-cycle'?50:35)){
        done=true;pass=false;detail={kind:test.kind,timeout:true,phase:a.phase,b:b.phase,result:a.result,
          window:test.kind.startsWith('window-')?this.windowSnapshot():null};
      }
      $('npc-qa').textContent=`验收 ${this.index+1}/${this.tests.length} · ${test.name}\n`+
        this.report.tests.map(t=>`${t.pass?'通过':'失败'} · ${t.name}`).join('\n');
      if(done)this.finish(test,pass,detail);
    }
  }
  $('npc-run-qa').onclick=()=>{probe=new ProbeSuite();$('npc-run-qa').disabled=true;paused=false;$('npc-pause').textContent='暂停';};
  window.__NPC_OBSERVATION__={version:'NPC-LIFE-OBSERVATION-R03',ready:false,windowRenderDiagnostics:()=>props.window.diagnostics(),awaitFrame:options=>renderQueue.awaitFrame(options),onRender:callback=>renderQueue.onRender(callback),renderStatus:()=>renderQueue.status(),onComplete:callback=>renderQueue.onComplete(callback),observation:()=>observation.snapshot(),boot:()=>boot.snapshot(),snapshot:()=>({...world.snapshot(),version:'NPC-LIFE-OBSERVATION-R03',interactionMode}),verification:()=>probe?.report,performance:perf,errors,actorDiagnostics:()=>actors.map(a=>({id:a.id,identity:a.identity,measurements:a.measurements,diagnostics:a.diagnostics({tableTopY:DIM.tableTop,tableBounds:{minX:DIM.tableCentre[0]-DIM.tableHalf[0],maxX:DIM.tableCentre[0]+DIM.tableHalf[0],minZ:DIM.tableCentre[2]-DIM.tableHalf[2],maxZ:DIM.tableCentre[2]+DIM.tableHalf[2]},bottle:{position:world.bottle.position,quaternion:world.bottle.quaternion,radius:DIM.radius,height:DIM.height},solidBoxes:world.window.solidBoxes(),solidCylinders:[world.window.handleCylinder()]}),windowDiagnostics:{objectId:'window-handle-01',...a.diagnostics({tableTopY:DIM.tableTop,tableBounds:{minX:DIM.tableCentre[0]-DIM.tableHalf[0],maxX:DIM.tableCentre[0]+DIM.tableHalf[0],minZ:DIM.tableCentre[2]-DIM.tableHalf[2],maxZ:DIM.tableCentre[2]+DIM.tableHalf[2]},bottle:{position:world.window.handleCenter(),quaternion:world.window.leaf.quaternion,radius:WINDOW_DIM.handleRadius,height:WINDOW_DIM.handleHeight},solidBoxes:world.window.solidBoxes(),solidCylinders:world.window.otherCylinders()})},binding:a.binding.report,rig:a.binding.rig,materialReport:a.materialReport,contactReport:a.contactReport,graspReport:a.graspReport}))};
  const taskButtons=new Set(['npc-pick','npc-plan','npc-contend','npc-window-open','npc-window-close','npc-window-contend']);
  for(const b of app.querySelectorAll('button'))b.addEventListener('click',()=>{if(runtimeFailure)return;if(taskButtons.has(b.id))resumeTask();props.sync(world,debug);viewer.render();updateUI();});
  station('single');resize();props.sync(world,debug);viewer.render();$('npc-progress').textContent='三种人物已生成，正在完成首次完整绘制。';$('npc-ready').textContent='等待首次完整画面';
  function frame(now){
    const elapsed=(now-last)/1000;last=now;
    if(elapsed>0){frameMS.push(elapsed*1000);if(frameMS.length>180)frameMS.shift();}
    if(runtimeFailure)return;
    try{
      if(boot.snapshot().status==='failed'){failRuntime(Error(boot.snapshot().failure?.message||'启动已停止'));return;}
      // A completed GPU frame and its snapshot must be read together before the
      // CPU can move the world into the next state.
      if(renderQueue.pump()?.readers){requestAnimationFrame(frame);return;}
      let steps=0;
      if(ready&&!paused&&probe&&!probe.report.completed){
        observation.reset();acc+=Math.min(elapsed,.5);
        while(acc>=1/120&&steps<60){probe.update();if(probe.report.completed)break;world.tick(1/120);acc-=1/120;steps++;}
      }else{
        acc=0;const q=renderQueue.status(),shown=observation.summary().lastCompleted?.metadata;
        steps=observation.advance({canAdvance:ready&&!q.pending&&q.startupDrain.completed&&shown?.phaseKey===phaseKey(),paused:!ready||paused,phaseKey,tick:dt=>world.tick(dt)});
      }
      props.sync(world,debug);
      const active=world.window.busy()||[...world.agents.values()].some(a=>a.retraction||a.actor.hasRecovery?.()||!['idle','done','failed','cancelled'].includes(a.phase));
      const visual=[...world.bottle.position.toArray(),...world.bottle.quaternion.toArray(),...world.window.leaf.position.toArray(),...world.window.leaf.quaternion.toArray(),world.window.snapshot().object.blocked,...world.target,world.supportEnabled].map(v=>typeof v==='number'?v.toFixed(5):v).join(',');
      if((steps>0&&(active||lastActive))||visual!==lastVisual){viewer.render();lastVisual=visual;}
      lastActive=active;renderQueue.pump();if(ready&&now-lastUI>240){updateUI();lastUI=now;}
    }catch(error){failRuntime(error);console.error(error);return;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // A loaded mesh is not yet an observable scene. Keep actions and simulation
  // gated until all three complete native people have actually finished drawing.
  boot.stage('first-complete-frame','正在完成三个完整人物与物理场景的首帧');
  await boot.wait(renderQueue.awaitFrame({fresh:true}),'完整场景首帧',45000);boot.check();
  ready=true;window.__NPC_OBSERVATION__.ready=true;last=performance.now();
  for(const b of app.querySelectorAll('button'))b.disabled=false;
  $('npc-loader').hidden=true;document.documentElement.dataset.npcReady='true';boot.ready();observation.reset();updateUI();
}
main().catch(error=>{window.__NPC_BOOT__?.fail(error,{code:'NATIVE_STARTUP_FAILED'});errors.push(error.message);$('npc-progress').textContent='当前构建未就绪：'+error.message;$('npc-status').textContent='人物或交互绑定未通过，尚未进入观察。';document.documentElement.dataset.npcReady='failed';console.error(error);});
