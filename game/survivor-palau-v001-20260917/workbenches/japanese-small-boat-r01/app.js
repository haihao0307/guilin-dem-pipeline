import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMaterials, applyHullMaterial } from './materials.js';
import { buildBoatSystems } from './mechanics.js';
import { buildHistoricalFlag } from './flag.js';

const $=id=>document.getElementById(id);
const canvas=$('canvas'),viewport=$('viewport'),loading=$('loading'),loadFill=$('loadFill'),loadMessage=$('loadMessage'),errorBox=$('error'),status=$('status');
const HULL_CHUNKS=[...Array.from({length:6},(_,i)=>`assets/hull/hull_${String(i).padStart(2,'0')}.txt`),'assets/hull/hull_06a.txt','assets/hull/hull_06b.txt'];
const EXPECTED_SHA='9aca025c1a8d629661392d50aad962708e756fe8ae61164bd60b0f8d18b676bb';

function progress(value,message){loadFill.style.width=`${Math.round(value*100)}%`;if(message)loadMessage.textContent=message}
function fail(err){console.error(err);loading.style.display='none';errorBox.style.display='block';errorBox.textContent=`工作台启动失败：${err?.message||err}`;status.textContent='启动失败，错误已显示在左侧';}
function decodeBase64(text){const bin=atob(text),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
async function gunzip(bytes){if(!('DecompressionStream' in window))throw new Error('浏览器不支持 gzip 解压，请使用当前版 Chrome / Edge / Safari。');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));return new Uint8Array(await new Response(stream).arrayBuffer())}
async function sha256(bytes){const hash=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function loadSourceHull(){
  progress(.05,'读取原始船体数据…');
  const parts=[];
  for(let i=0;i<HULL_CHUNKS.length;i++){
    const r=await fetch(HULL_CHUNKS[i],{cache:'force-cache'});if(!r.ok)throw new Error(`船体数据 ${i+1}/${HULL_CHUNKS.length} 无法读取（HTTP ${r.status}）`);parts.push((await r.text()).trim());progress(.08+(i+1)/HULL_CHUNKS.length*.35,`读取原始船体 ${i+1} / ${HULL_CHUNKS.length}`);
  }
  progress(.48,'校验并还原原始 GLB…');const glb=await gunzip(decodeBase64(parts.join('')));
  const digest=await sha256(glb);if(digest!==EXPECTED_SHA)throw new Error('原始船体校验不一致，已停止加载以避免使用错误版本。');
  progress(.62,'建立原船体拓扑与材质…');const url=URL.createObjectURL(new Blob([glb],{type:'model/gltf-binary'}));
  try{return await new GLTFLoader().loadAsync(url)}finally{URL.revokeObjectURL(url)}
}

async function main(){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xcbd1d4);
  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(renderer),.035).texture;pmrem.dispose();
  const camera=new THREE.PerspectiveCamera(42,1,.015,100);camera.position.set(5.55,3.05,5.65);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=1.8;controls.maxDistance=18;controls.target.set(.28,.58,0);controls.maxPolarAngle=Math.PI*.94;
  scene.add(new THREE.HemisphereLight(0xffffff,0x4b5962,1.1));
  const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(4.8,7.8,5.2);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.bias=-.00012;scene.add(key);
  const fill=new THREE.DirectionalLight(0xaed6ee,1.05);fill.position.set(-5,3,-4);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffd4a4,.75);rim.position.set(-3,4,5);scene.add(rim);
  const groundMaterial=new THREE.MeshStandardMaterial({color:0xbfc6ca,roughness:.98,metalness:0});const ground=new THREE.Mesh(new THREE.CircleGeometry(12,128),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.055;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(20,40,0x6f7a80,0xaab2b6);grid.position.y=-.05;grid.material.opacity=.29;grid.material.transparent=true;scene.add(grid);

  const mats=createMaterials(renderer);const gltf=await loadSourceHull();
  const boatRoot=new THREE.Group();boatRoot.name='1944_small_boat_complete';scene.add(boatRoot);
  const sourceHull=gltf.scene;sourceHull.name='preserved_source_hull';applyHullMaterial(sourceHull,mats);boatRoot.add(sourceHull);
  const sourceBox=new THREE.Box3().setFromObject(sourceHull),sourceSize=sourceBox.getSize(new THREE.Vector3());
  if(sourceSize.x<4.0||sourceSize.x>5.2)throw new Error(`原始船体尺寸异常：${sourceSize.x.toFixed(2)} m`);
  progress(.73,'安装历史发动机、轴系与转向机构…');const systems=buildBoatSystems(boatRoot,mats);
  progress(.84,'建立船头 65×65 三维布料旗帜…');const flag=buildHistoricalFlag(boatRoot,mats,1.72);
  progress(.94,'执行结构检查与镜头配置…');

  const allMaterials=new Set();boatRoot.traverse(o=>{if(o.isMesh){for(const m of(Array.isArray(o.material)?o.material:[o.material]))allMaterials.add(m)}});
  const views={
    hero:{p:[5.55,3.05,5.65],t:[.28,.58,0]},
    top:{p:[.22,8.4,.01],t:[.22,.32,0],up:[0,0,-1]},
    bow:{p:[4.65,2.55,3.35],t:[2.22,1.30,-.15]},
    stern:{p:[-4.45,1.80,3.10],t:[-1.86,.45,.03]},
    engine:{p:[-2.85,1.68,2.25],t:[-1.03,.70,0]},
    side:{p:[.15,1.62,6.85],t:[.15,.48,0]}
  };
  function setView(name){const v=views[name]||views.hero;camera.up.fromArray(v.up||[0,1,0]);camera.position.fromArray(v.p);controls.target.fromArray(v.t);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name))}
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  setView('hero');
  let wind=.62,rudderAngle=0,autoRotate=false,engineRunning=true;
  $('autoRotate').onchange=e=>autoRotate=e.target.checked;
  $('showGround').onchange=e=>ground.visible=grid.visible=e.target.checked;
  $('wireframe').onchange=e=>{for(const m of allMaterials)m.wireframe=e.target.checked};
  $('showMechanics').onchange=e=>systems.systems.visible=e.target.checked;
  $('showFlag').onchange=e=>flag.setVisible(e.target.checked);
  $('engineRun').onchange=e=>engineRunning=e.target.checked;
  $('wind').oninput=e=>{wind=+e.target.value;$('windValue').textContent=wind.toFixed(2)};
  $('rudder').oninput=e=>{rudderAngle=THREE.MathUtils.degToRad(+e.target.value);systems.rudderPivot.rotation.y=rudderAngle;$('rudderValue').textContent=`${e.target.value}°`};
  $('poleHeight').oninput=e=>{const h=+e.target.value;flag.rebuild(h);$('poleValue').textContent=`${h.toFixed(2)} m`};
  function resize(){const w=Math.max(1,viewport.clientWidth),h=Math.max(1,viewport.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();
  progress(1,'原始船体校验通过，3A 工作台已就绪');await new Promise(r=>setTimeout(r,180));loading.style.display='none';
  status.textContent=`原始船体 SHA-256 校验通过 · ${sourceSize.x.toFixed(2)} m · 三维机械与布料已启动`;
  const clock=new THREE.Clock();let frames=0,stamp=performance.now();
  function animate(now){requestAnimationFrame(animate);const dt=Math.min(.04,clock.getDelta());if(autoRotate)boatRoot.rotation.y+=dt*.18;if(engineRunning){systems.flywheel.rotation.x-=dt*14.5;systems.propeller.rotation.x-=dt*19.5;systems.engine.position.y=Math.sin(now*.035)*.0009+.46}else systems.engine.position.y=.46;
    flag.update(now,wind);controls.update();renderer.render(scene,camera);frames++;if(now-stamp>1000){status.textContent=`3D 运行中 · ${Math.round(frames*1000/(now-stamp))} FPS · 原船体拓扑保留`;frames=0;stamp=now}}
  requestAnimationFrame(animate);
}
main().catch(fail);
