import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x));
const lerp = (a,b,t) => a + (b-a)*t;
const rad = (deg) => THREE.MathUtils.degToRad(deg);

const VOICES = {
  C: { id:'C', name:'C · 三槽 / 40°', slots:3, angle:40, baseLength:1.55, decay:0.58 },
  L: { id:'L', name:'L · 三槽 / 20°', slots:3, angle:20, baseLength:1.62, decay:0.59 },
  R: { id:'R', name:'R · 四槽 / 25.7°', slots:4, angle:25.7, baseLength:1.68, decay:0.60 },
};

const P = {
  voice:'C', depth:7, space:1.25, light:0.90, lightAz:55,
  gravity:0.65, parent:1.15, threshold:0.56,
  obstacle:true, obsX:0.65, obsZ:0.35,
};
const seed = 123031;
let showBuds = true;
let autoRotate = false;
let rebuildTimer = 0;
let currentSignature = null;

const stage = $('stage');
const errorEl = $('error');
const infoEl = $('info');
const statusEl = $('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08100f);
scene.fog = new THREE.FogExp2(0x08100f, 0.033);

const camera = new THREE.PerspectiveCamera(40,1,0.03,60);
camera.position.set(6.2,4.2,7.0);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
stage.prepend(renderer.domElement);

const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.set(0,0.15,0);
controls.minDistance = 3.4;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI*0.93;

scene.add(new THREE.HemisphereLight(0xc1ddd4,0x281c1d,1.7));
const sun = new THREE.DirectionalLight(0xe4fff7,2.7);
sun.position.set(5,8,4); scene.add(sun);
const rim = new THREE.DirectionalLight(0xff7baa,1.25);
rim.position.set(-5,3,-4); scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(4.8,64),
  new THREE.MeshStandardMaterial({color:0x15221f,roughness:1,transparent:true,opacity:0.58,side:THREE.DoubleSide})
);
ground.rotation.x=-Math.PI/2;
ground.position.y=-2.02;
scene.add(ground);
const grid = new THREE.GridHelper(9,18,0x29403a,0x172723);
grid.position.y=-2.0;
scene.add(grid);

const branchMat = new THREE.MeshStandardMaterial({color:0x38d9c6,roughness:0.62,metalness:0});
const jointMat = new THREE.MeshStandardMaterial({color:0x2cae9e,roughness:0.72,metalness:0});
const activeBudMat = new THREE.MeshStandardMaterial({color:0xd34f88,emissive:0x420719,emissiveIntensity:0.35,roughness:0.45});
const dormantBudMat = new THREE.MeshStandardMaterial({color:0xd2b86d,emissive:0x281d05,emissiveIntensity:0.24,roughness:0.62});
const obstacleMat = new THREE.MeshStandardMaterial({color:0x7d8c87,roughness:0.9,transparent:true,opacity:0.26,depthWrite:false});

const branchGeo = new THREE.CylinderGeometry(1,1,1,8,1,false);
const jointGeo = new THREE.SphereGeometry(1,8,6);
const budGeo = new THREE.SphereGeometry(1,7,5);
const MAX_SEGMENTS=1800, MAX_BUDS=5200;
const branchMesh = new THREE.InstancedMesh(branchGeo,branchMat,MAX_SEGMENTS);
const jointMesh = new THREE.InstancedMesh(jointGeo,jointMat,MAX_SEGMENTS+1);
const activeBudMesh = new THREE.InstancedMesh(budGeo,activeBudMat,MAX_BUDS);
const dormantBudMesh = new THREE.InstancedMesh(budGeo,dormantBudMat,MAX_BUDS);
branchMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
jointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
activeBudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
dormantBudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(branchMesh,jointMesh,activeBudMesh,dormantBudMesh);

const obstacle = new THREE.Mesh(new THREE.SphereGeometry(0.82,24,16),obstacleMat);
scene.add(obstacle);

const lightArrow = new THREE.ArrowHelper(new THREE.Vector3(1,1,0).normalize(),new THREE.Vector3(-3.5,2.3,-3.5),1.6,0xe6df9e,0.22,0.12);
scene.add(lightArrow);

const up = new THREE.Vector3(0,1,0);
const tmp = new THREE.Object3D();
const q = new THREE.Quaternion();

function hash01(text){
  let h=2166136261>>>0;
  const s=String(text);
  for(let i=0;i<s.length;i+=1){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return h/4294967295;
}
function signedHash(text){return hash01(text)*2-1;}

function lightVector(){
  const a=rad(P.lightAz);
  return new THREE.Vector3(Math.cos(a)*0.72,0.68,Math.sin(a)*0.72).normalize();
}

function makeFrame(T,NHint=null){
  const t=T.clone().normalize();
  let n=NHint?.clone();
  if(!n || n.lengthSq()<1e-8){
    n=Math.abs(t.dot(up))>0.93?new THREE.Vector3(1,0,0):new THREE.Vector3().crossVectors(up,t);
  }
  n.addScaledVector(t,-n.dot(t));
  if(n.lengthSq()<1e-8)n.set(1,0,0).addScaledVector(t,-t.x);
  n.normalize();
  const b=new THREE.Vector3().crossVectors(t,n).normalize();
  return {T:t,N:n,B:b};
}
function transportFrame(frame,newT,roll=0){
  q.setFromUnitVectors(frame.T,newT);
  const n=frame.N.clone().applyQuaternion(q);
  const out=makeFrame(newT,n);
  if(Math.abs(roll)>1e-6){
    out.N.applyAxisAngle(out.T,roll).normalize();
    out.B.crossVectors(out.T,out.N).normalize();
  }
  return out;
}
function localDirection(frame,inclination,azimuth){
  return frame.T.clone().multiplyScalar(Math.cos(inclination))
    .addScaledVector(frame.N,Math.sin(inclination)*Math.cos(azimuth))
    .addScaledVector(frame.B,Math.sin(inclination)*Math.sin(azimuth))
    .normalize();
}

function obstacleCenter(){return new THREE.Vector3(P.obsX,0.45,P.obsZ);}

function spaceField(probe,occupancy){
  const repel=new THREE.Vector3();
  let minD=99;
  const radius=0.86;
  for(let i=Math.max(0,occupancy.length-1400);i<occupancy.length;i+=1){
    const p=occupancy[i];
    const dx=probe.x-p.x,dy=probe.y-p.y,dz=probe.z-p.z;
    const d2=dx*dx+dy*dy+dz*dz;
    if(d2<1e-8)continue;
    const d=Math.sqrt(d2); if(d<minD)minD=d;
    if(d<radius){
      const w=(radius-d)/radius;
      repel.x+=dx/d*w*w; repel.y+=dy/d*w*w; repel.z+=dz/d*w*w;
    }
  }
  let obstaclePenalty=0;
  if(P.obstacle){
    const c=obstacleCenter();
    const delta=probe.clone().sub(c);
    const d=delta.length();
    const safe=1.22;
    if(d<safe){
      const w=(safe-d)/safe;
      repel.addScaledVector(delta.normalize(),2.8*w*w);
      obstaclePenalty=clamp((0.96-d)/0.96,0,1);
      minD=Math.min(minD,Math.max(0,d-0.82));
    }
  }
  const free=clamp((minD-0.16)/0.92,0,1);
  if(repel.lengthSq()<1e-8)repel.set(0,0,0);
  else repel.normalize();
  return {repel,free,obstaclePenalty};
}

function evaluateBud({pos,frame,baseDir,length,depth,order,key,isLeader},occupancy){
  const lv=lightVector();
  const rawProbe=pos.clone().addScaledVector(baseDir,length*0.78);
  const sf0=spaceField(rawProbe,occupancy);
  const dir=baseDir.clone()
    .multiplyScalar(1.00)
    .addScaledVector(lv,P.light*0.30)
    .addScaledVector(sf0.repel,P.space*0.54)
    .addScaledVector(up,P.gravity*0.22)
    .addScaledVector(frame.T,P.parent*0.28)
    .normalize();
  const probe=pos.clone().addScaledVector(dir,length*0.82);
  const sf=spaceField(probe,occupancy);
  const lightFit=(dir.dot(lv)+1)*0.5;
  const continuity=(dir.dot(frame.T)+1)*0.5;
  const noise=hash01(key);
  let score=0.20 + 0.23*lightFit*P.light + 0.28*sf.free*P.space + 0.15*continuity*P.parent + 0.12*noise;
  score-=0.055*order + 0.020*depth + 0.38*sf.obstaclePenalty;
  if(isLeader)score+=0.18;
  return {dir,score,free:sf.free,obstaclePenalty:sf.obstaclePenalty,lightFit,continuity};
}

function buildNative3D(){
  const voice=VOICES[P.voice];
  const segments=[];
  const buds=[];
  const occupancy=[];
  const shootQueue=[];
  const rootPos=new THREE.Vector3(0,-2,0);
  const rootFrame=makeFrame(new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0));
  shootQueue.push({pos:rootPos,frame:rootFrame,depth:0,order:0,length:voice.baseLength,parentSegment:-1,key:'root'});
  occupancy.push(rootPos.clone());

  let cursor=0;
  while(cursor<shootQueue.length && segments.length<MAX_SEGMENTS){
    const shoot=shootQueue[cursor++];
    if(shoot.depth>P.depth)continue;
    const segLen=shoot.length;
    const wobble=new THREE.Vector3(
      signedHash(shoot.key+':x')*0.018,
      0,
      signedHash(shoot.key+':z')*0.018
    );
    const segDir=shoot.frame.T.clone().add(wobble).normalize();
    const end=shoot.pos.clone().addScaledVector(segDir,segLen);
    const segIndex=segments.length;
    segments.push({a:shoot.pos.clone(),b:end.clone(),depth:shoot.depth,order:shoot.order,parent:shoot.parentSegment,children:[],support:1,key:shoot.key});
    if(shoot.parentSegment>=0)segments[shoot.parentSegment].children.push(segIndex);
    occupancy.push(shoot.pos.clone().lerp(end,0.45),end.clone());

    if(shoot.depth>=P.depth)continue;
    const nextLength=Math.max(0.055,segLen*voice.decay*(1-0.055*Math.min(shoot.order,4)));
    const nodeFrame=transportFrame(shoot.frame,segDir,signedHash(shoot.key+':roll')*0.07);

    const candidates=[];
    const leaderBase=localDirection(nodeFrame,rad(4+7*hash01(shoot.key+':leaderIncl')),signedHash(shoot.key+':leaderAz')*0.12);
    const leaderEval=evaluateBud({
      pos:end,frame:nodeFrame,baseDir:leaderBase,length:nextLength,depth:shoot.depth+1,order:shoot.order,key:shoot.key+':leader',isLeader:true
    },occupancy);
    candidates.push({
      type:'leader',pos:end.clone(),frame:nodeFrame,dir:leaderEval.dir,score:leaderEval.score,free:leaderEval.free,
      depth:shoot.depth+1,order:shoot.order,key:shoot.key+'L',attachSegment:segIndex,length:nextLength
    });

    const phase=(hash01(shoot.key+':phase')*Math.PI*2);
    for(let slot=0;slot<voice.slots;slot+=1){
      const frac=clamp(0.40 + 0.46*((slot+0.45)/(voice.slots+0.3)) + signedHash(shoot.key+':frac:'+slot)*0.035,0.30,0.92);
      const pos=shoot.pos.clone().lerp(end,frac);
      const az=phase + slot*Math.PI*2/voice.slots + signedHash(shoot.key+':az:'+slot)*rad(9);
      const incl=rad(voice.angle*(0.80+0.24*hash01(shoot.key+':inc:'+slot)));
      const baseDir=localDirection(nodeFrame,incl,az);
      const order=shoot.order+1;
      const ev=evaluateBud({
        pos,frame:nodeFrame,baseDir,length:nextLength*(0.82+0.12*hash01(shoot.key+':len:'+slot)),
        depth:shoot.depth+1,order,key:shoot.key+':bud:'+slot,isLeader:false
      },occupancy);
      candidates.push({
        type:'lateral',slot,pos,frame:nodeFrame,dir:ev.dir,score:ev.score,free:ev.free,
        depth:shoot.depth+1,order,key:shoot.key+'B'+slot,attachSegment:segIndex,
        length:nextLength*(0.82+0.12*hash01(shoot.key+':len:'+slot))
      });
    }

    const laterals=candidates.filter(c=>c.type==='lateral').sort((a,b)=>b.score-a.score);
    const maxLaterals = shoot.depth<2 ? 2 : (shoot.depth<5 ? 2 : 1);
    let lateralAccepted=0;
    for(const c of candidates){
      let active=false;
      if(c.type==='leader'){
        active=c.score>P.threshold-0.14;
      }else if(c.score>P.threshold && lateralAccepted<maxLaterals && c.free>0.12){
        active=true; lateralAccepted+=1;
      }
      buds.push({pos:c.pos.clone(),state:active?'active':'dormant',score:c.score,type:c.type,dir:c.dir.clone(),key:c.key});
      if(active && segments.length+shootQueue.length<MAX_SEGMENTS*1.5){
        const frame=transportFrame(c.frame,c.dir,signedHash(c.key+':roll')*0.13);
        shootQueue.push({
          pos:c.pos.clone(),frame,depth:c.depth,order:c.order,length:c.length,parentSegment:c.attachSegment,key:c.key
        });
      }
    }

    if(!candidates.some(c=>c.type==='leader' && c.score>P.threshold-0.14) && shoot.depth<2){
      const best=laterals[0];
      if(best && !buds.some(b=>b.key===best.key && b.state==='active')){
        const b=buds.find(x=>x.key===best.key); if(b)b.state='active';
        const frame=transportFrame(best.frame,best.dir,signedHash(best.key+':roll')*0.13);
        shootQueue.push({pos:best.pos.clone(),frame,depth:best.depth,order:best.order,length:best.length,parentSegment:best.attachSegment,key:best.key});
      }
    }
  }

  for(let i=segments.length-1;i>=0;i-=1){
    const s=segments[i];
    let support=1;
    for(const child of s.children)support+=segments[child].support;
    s.support=support;
  }
  return {segments,buds,occupancy};
}

function setCylinderMatrix(index,a,b,radius){
  const direction=b.clone().sub(a);
  const length=Math.max(1e-5,direction.length());
  tmp.position.copy(a).add(b).multiplyScalar(0.5);
  tmp.quaternion.setFromUnitVectors(up,direction.normalize());
  tmp.scale.set(radius,length,radius);
  tmp.updateMatrix();
  branchMesh.setMatrixAt(index,tmp.matrix);
}
function setSphereMatrix(mesh,index,pos,radius){
  tmp.position.copy(pos);tmp.quaternion.identity();tmp.scale.setScalar(radius);tmp.updateMatrix();mesh.setMatrixAt(index,tmp.matrix);
}

function computeSignature(graph){
  const box=new THREE.Box3();
  let sx=0,sy=0,sz=0;
  for(const s of graph.segments){box.expandByPoint(s.a);box.expandByPoint(s.b);sx+=s.b.x;sy+=s.b.y;sz+=s.b.z;}
  const n=Math.max(1,graph.segments.length);
  const active=graph.buds.filter(b=>b.state==='active').length;
  const dormant=graph.buds.length-active;
  return {
    segmentCount:graph.segments.length,budCount:graph.buds.length,activeBudCount:active,dormantBudCount:dormant,
    centroid:[sx/n,sy/n,sz/n].map(v=>Number(v.toFixed(4))),
    bounds:{
      min:[box.min.x,box.min.y,box.min.z].map(v=>Number(v.toFixed(4))),
      max:[box.max.x,box.max.y,box.max.z].map(v=>Number(v.toFixed(4)))
    },
    zSpan:Number((box.max.z-box.min.z).toFixed(4)),
    native3D:true,projectionLocked:false,cameraAffectsGeneration:false,appliesToSpecies:false,
    obstacleEnabled:P.obstacle,voice:P.voice
  };
}

function rebuild(){
  const graph=buildNative3D();
  const segCount=Math.min(graph.segments.length,MAX_SEGMENTS);
  for(let i=0;i<segCount;i+=1){
    const s=graph.segments[i];
    const radius=clamp(0.012+0.0058*Math.pow(s.support,0.42),0.014,0.125)*(1-0.06*Math.min(s.order,4));
    setCylinderMatrix(i,s.a,s.b,radius);
    setSphereMatrix(jointMesh,i,s.a,radius*1.07);
  }
  if(segCount>0){
    const last=graph.segments[segCount-1];
    setSphereMatrix(jointMesh,segCount,last.b,0.018);
  }
  branchMesh.count=segCount;jointMesh.count=Math.min(segCount+1,MAX_SEGMENTS+1);
  branchMesh.instanceMatrix.needsUpdate=true;jointMesh.instanceMatrix.needsUpdate=true;

  let ai=0,di=0;
  for(const b of graph.buds){
    if(b.state==='active' && ai<MAX_BUDS){setSphereMatrix(activeBudMesh,ai++,b.pos, b.type==='leader'?0.038:0.031);}
    if(b.state==='dormant' && di<MAX_BUDS){setSphereMatrix(dormantBudMesh,di++,b.pos,0.021);}
  }
  activeBudMesh.count=ai;dormantBudMesh.count=di;
  activeBudMesh.instanceMatrix.needsUpdate=true;dormantBudMesh.instanceMatrix.needsUpdate=true;
  activeBudMesh.visible=showBuds;dormantBudMesh.visible=showBuds;

  obstacle.visible=P.obstacle;
  obstacle.position.copy(obstacleCenter());
  const lv=lightVector();
  lightArrow.setDirection(lv);
  lightArrow.position.set(-3.4,2.15,-3.4);

  currentSignature=computeSignature(graph);
  infoEl.textContent=`Native 3D · Shoot ${currentSignature.segmentCount} · Bud ${currentSignature.activeBudCount} active / ${currentSignature.dormantBudCount} dormant · Z span ${currentSignature.zSpan.toFixed(2)} m`;
  statusEl.textContent=`这棵结构不是从二维投影抬高得到。候选芽先在父枝三维局部框架中产生，再由 Light / Space / Gravity / Parent / Obstacle 共同决定方向与释放。当前 KuKo ${VOICES[P.voice].slots} 槽只作为候选语法。`;
  updateOutputs();
  window.__native3dR02Signature=currentSignature;
}

function updateOutputs(){
  $('voiceO').textContent=VOICES[P.voice].name;
  $('depthO').textContent=String(P.depth);
  $('spaceO').textContent=P.space.toFixed(2);
  $('lightO').textContent=P.light.toFixed(2);
  $('lightAzO').textContent=P.lightAz.toFixed(0)+'°';
  $('gravityO').textContent=P.gravity.toFixed(2);
  $('parentO').textContent=P.parent.toFixed(2);
  $('thresholdO').textContent=P.threshold.toFixed(2);
  $('obsXO').textContent=P.obsX.toFixed(2);
  $('obsZO').textContent=P.obsZ.toFixed(2);
}
function scheduleRebuild(){
  clearTimeout(rebuildTimer);
  rebuildTimer=setTimeout(rebuild,70);
}
function bindRange(id,key,parse=Number){
  $(id).addEventListener('input',e=>{P[key]=parse(e.target.value);scheduleRebuild();});
}
$('voice').addEventListener('change',e=>{P.voice=e.target.value;rebuild();});
bindRange('depth','depth',v=>parseInt(v,10));
bindRange('space','space');bindRange('light','light');bindRange('lightAz','lightAz');
bindRange('gravity','gravity');bindRange('parent','parent');bindRange('threshold','threshold');
bindRange('obsX','obsX');bindRange('obsZ','obsZ');
$('obstacle').addEventListener('change',e=>{P.obstacle=e.target.checked;rebuild();});
$('rebuild').addEventListener('click',rebuild);
$('buds').addEventListener('click',()=>{showBuds=!showBuds;$('buds').classList.toggle('on',showBuds);activeBudMesh.visible=showBuds;dormantBudMesh.visible=showBuds;});
$('auto').addEventListener('click',()=>{autoRotate=!autoRotate;controls.autoRotate=autoRotate;controls.autoRotateSpeed=0.65;$('auto').classList.toggle('on',autoRotate);});

function setView(position,target=new THREE.Vector3(0,0.1,0)){
  camera.position.copy(position);controls.target.copy(target);controls.update();
}
$('orbit').addEventListener('click',()=>setView(new THREE.Vector3(6.2,4.2,7.0)));
$('front').addEventListener('click',()=>setView(new THREE.Vector3(0,0.25,9.5)));
$('side').addEventListener('click',()=>setView(new THREE.Vector3(9.5,0.25,0)));
$('top').addEventListener('click',()=>setView(new THREE.Vector3(0,9.6,0.01),new THREE.Vector3(0,0,0)));

function resize(){
  const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);resize();

try{
  rebuild();
  window.__native3dR02Ready=true;
  window.Native3DFractalR02={
    rebuild,
    setObstacle(enabled){P.obstacle=Boolean(enabled);$('obstacle').checked=P.obstacle;rebuild();},
    setLightAz(deg){P.lightAz=clamp(Number(deg)||0,-180,180);$('lightAz').value=String(P.lightAz);rebuild();},
    setSpace(value){P.space=clamp(Number(value)||0,0,2.2);$('space').value=String(P.space);rebuild();},
    setVoice(id){if(!VOICES[id])return;P.voice=id;$('voice').value=id;rebuild();},
    getState(){return {params:{...P},signature:currentSignature,showBuds,autoRotate};}
  };
  document.documentElement.dataset.ready='true';
  (function animate(){
    controls.update();
    renderer.render(scene,camera);
    requestAnimationFrame(animate);
  })();
}catch(error){
  errorEl.hidden=false;errorEl.textContent=String(error?.stack||error);throw error;
}
