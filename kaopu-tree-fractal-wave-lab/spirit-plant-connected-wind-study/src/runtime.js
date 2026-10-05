import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeConnectedWind, RULE_VERSION } from 'connected-wind';

const $ = (id) => document.getElementById(id);
const clamp = (x,a=0,b=1) => Math.max(a,Math.min(b,x));
const lerp = (a,b,t) => a+(b-a)*t;
const rad = (d) => THREE.MathUtils.degToRad(d);

const VOICES={
  C:{id:'C',name:'C · 3 slots / 40°',slots:3,angle:40,baseLength:2.15,decay:0.705},
  L:{id:'L',name:'L · 3 slots / 20°',slots:3,angle:20,baseLength:2.20,decay:0.71},
  R:{id:'R',name:'R · 4 slots / 25.7°',slots:4,angle:25.7,baseLength:2.22,decay:0.715}
};

const P={
  voice:'C',pass:10,space:1.18,light:0.92,lightAz:48,lightEl:42,
  gravity:0.62,parent:1.08,threshold:0.46,perception:0.82,openness:1.08,
  obstacle:true,lightField:true,spaceField:true,upField:true,obsX:2.15,obsZ:1.35
};

let seed=123303;
let windRig=null;
const motion={strength:.65,azimuth:35,time:0,offsetX:0,offsetZ:0,playing:true,enabled:true,frames:false,field:false,rest:false};
let showBuds=true,showField=true,showProbe=true,autoRotate=false,growTimer=null,currentSignature=null;
let lastGraph=null,firstFit=true;

const stage=$('stage'),errorEl=$('error'),infoEl=$('info'),statusEl=$('status');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x07100f);
scene.fog=new THREE.FogExp2(0x07100f,0.025);

const camera=new THREE.PerspectiveCamera(40,1,0.03,80);
camera.position.set(8.2,5.1,9.1);
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){errorEl.hidden=false;errorEl.textContent='三维渲染未启动：当前浏览器未提供可用 WebGL。没有用旧画面或图片替代。\n'+String(error.message);throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
stage.prepend(renderer.domElement);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=0.065;
controls.target.set(0,0.55,0);controls.minDistance=4;controls.maxDistance=30;controls.maxPolarAngle=Math.PI*0.94;

scene.add(new THREE.HemisphereLight(0xc4ddd5,0x271b1c,1.75));
const sun=new THREE.DirectionalLight(0xe8fff9,2.8);sun.position.set(6,10,5);scene.add(sun);
const rim=new THREE.DirectionalLight(0xff7eab,1.05);rim.position.set(-6,4,-5);scene.add(rim);

const ground=new THREE.Mesh(new THREE.CircleGeometry(6.8,72),new THREE.MeshStandardMaterial({color:0x14231f,roughness:1,transparent:true,opacity:0.52,side:THREE.DoubleSide}));
ground.rotation.x=-Math.PI/2;ground.position.y=-3.02;scene.add(ground);
const grid=new THREE.GridHelper(13,26,0x2d4740,0x172823);grid.position.y=-3.0;scene.add(grid);
const axes=new THREE.AxesHelper(1.0);axes.position.set(-5.4,-2.96,-5.4);scene.add(axes);

const branchMat=new THREE.MeshStandardMaterial({color:0x35d7c2,roughness:0.66,metalness:0});
const jointMat=new THREE.MeshStandardMaterial({color:0x2da999,roughness:0.73});
const activeBudMat=new THREE.MeshStandardMaterial({color:0xd04b84,emissive:0x3b0717,emissiveIntensity:0.36,roughness:0.48});
const dormantBudMat=new THREE.MeshStandardMaterial({color:0xd4b86f,emissive:0x241a05,emissiveIntensity:0.2,roughness:0.64});
const obstacleMat=new THREE.MeshStandardMaterial({color:0x7a8884,roughness:0.92,transparent:true,opacity:0.24,depthWrite:false});
const branchGeo=new THREE.CylinderGeometry(1,1,1,8,1,false);
const jointGeo=new THREE.SphereGeometry(1,8,6);
const budGeo=new THREE.SphereGeometry(1,7,5);
const MAX_SEGMENTS=3200,MAX_BUDS=9000;

const branchMesh=new THREE.InstancedMesh(branchGeo,branchMat,MAX_SEGMENTS);
const jointMesh=new THREE.InstancedMesh(jointGeo,jointMat,MAX_SEGMENTS+1);
const activeBudMesh=new THREE.InstancedMesh(budGeo,activeBudMat,MAX_BUDS);
const dormantBudMesh=new THREE.InstancedMesh(budGeo,dormantBudMat,MAX_BUDS);
for(const m of [branchMesh,jointMesh,activeBudMesh,dormantBudMesh])m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(branchMesh,jointMesh,activeBudMesh,dormantBudMesh);

const obstacle=new THREE.Mesh(new THREE.SphereGeometry(1.0,28,18),obstacleMat);scene.add(obstacle);
const lightArrow=new THREE.ArrowHelper(new THREE.Vector3(1,1,0).normalize(),new THREE.Vector3(-5.0,3.1,-5.0),2.0,0xe8df9d,0.26,0.14);scene.add(lightArrow);

const occupancyMaterial=new THREE.PointsMaterial({color:0x79a9d2,size:0.025,transparent:true,opacity:0.34,sizeAttenuation:true});
let occupancyPoints=new THREE.Points(new THREE.BufferGeometry(),occupancyMaterial);scene.add(occupancyPoints);
const probeMaterial=new THREE.LineBasicMaterial({color:0x7fb5e4,transparent:true,opacity:0.72});
let probeLines=new THREE.LineSegments(new THREE.BufferGeometry(),probeMaterial);scene.add(probeLines);
const perceptionShellMat=new THREE.MeshBasicMaterial({color:0x6f9fc8,transparent:true,opacity:0.08,wireframe:true,depthWrite:false});
const perceptionShell=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),perceptionShellMat);perceptionShell.visible=false;scene.add(perceptionShell);

const bboxHelper=new THREE.Box3Helper(new THREE.Box3(),0x3d5c55);scene.add(bboxHelper);

const tmp=new THREE.Object3D();
const up=new THREE.Vector3(0,1,0);
const quat=new THREE.Quaternion();

function hash01(text){
  let h=2166136261>>>0;const s=seed===123303?String(text):String(seed)+':'+String(text);
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
  return h/4294967295;
}
function sh(text){return hash01(text)*2-1;}

class SpatialHash{
  constructor(cell){this.cell=Math.max(0.12,cell);this.map=new Map();this.samples=[];}
  keyOf(v){return `${Math.floor(v.x/this.cell)}|${Math.floor(v.y/this.cell)}|${Math.floor(v.z/this.cell)}`;}
  add(v){
    const p=v.clone();this.samples.push(p);const k=this.keyOf(p);
    let a=this.map.get(k);if(!a){a=[];this.map.set(k,a);}a.push(p);
  }
  nearby(v,r){
    const c=this.cell,n=Math.ceil(r/c),ix=Math.floor(v.x/c),iy=Math.floor(v.y/c),iz=Math.floor(v.z/c),out=[];
    for(let x=ix-n;x<=ix+n;x++)for(let y=iy-n;y<=iy+n;y++)for(let z=iz-n;z<=iz+n;z++){
      const a=this.map.get(`${x}|${y}|${z}`);if(a)out.push(...a);
    }
    return out;
  }
}

function makeFrame(T,NHint){
  const t=T.clone().normalize();
  let n=NHint?.clone();
  if(!n||n.lengthSq()<1e-8)n=Math.abs(t.dot(up))>0.92?new THREE.Vector3(1,0,0):new THREE.Vector3().crossVectors(up,t);
  n.addScaledVector(t,-n.dot(t));
  if(n.lengthSq()<1e-8)n.set(1,0,0).addScaledVector(t,-t.x);
  n.normalize();
  const b=new THREE.Vector3().crossVectors(t,n).normalize();
  return {T:t,N:n,B:b};
}
function transport(frame,newT,roll=0){
  quat.setFromUnitVectors(frame.T,newT);
  const n=frame.N.clone().applyQuaternion(quat);
  const f=makeFrame(newT,n);
  if(Math.abs(roll)>1e-6){f.N.applyAxisAngle(f.T,roll).normalize();f.B.crossVectors(f.T,f.N).normalize();}
  return f;
}
function dirLocal(frame,incl,az){
  return frame.T.clone().multiplyScalar(Math.cos(incl))
    .addScaledVector(frame.N,Math.sin(incl)*Math.cos(az))
    .addScaledVector(frame.B,Math.sin(incl)*Math.sin(az)).normalize();
}
function lightVec(){
  const a=rad(P.lightAz),e=rad(P.lightEl),c=Math.cos(e);
  return new THREE.Vector3(Math.cos(a)*c,Math.sin(e),Math.sin(a)*c).normalize();
}
function obstacleCenter(){return new THREE.Vector3(P.obsX,0.45,P.obsZ);}

function freeSpaceScore(probe,hash,radius=P.perception){
  const r=clamp(radius,0.24,P.perception),near=hash.nearby(probe,r),repel=new THREE.Vector3(),safe=Math.min(0.12,r*0.22);
  let minD=r*2;
  for(const p of near){
    const d=probe.clone().sub(p),len=d.length();
    if(len<1e-6)continue;
    minD=Math.min(minD,len);
    if(len<r){
      const w=(r-len)/r;
      repel.addScaledVector(d.multiplyScalar(1/len),w*w);
    }
  }
  let obstaclePenalty=0;
  if(P.obstacle){
    const d=probe.clone().sub(obstacleCenter()),len=d.length(),safeR=1.42;
    if(len<safeR){
      obstaclePenalty=clamp((1.18-len)/1.18,0,1);
      if(len>1e-6)repel.addScaledVector(d.multiplyScalar(1/len),2.9*Math.pow((safeR-len)/safeR,2));
      minD=Math.min(minD,Math.max(0,len-1.0));
    }
  }
  return {free:clamp((minD-safe)/(r-safe),0,1),repel:repel.lengthSq()?repel.normalize():repel,obstaclePenalty,nearCount:near.length};
}

function scoreDirection(pos,frame,baseDir,length,depth,order,key,hash){
  const lv=lightVec(),candidates=[];
  const baseFrame=makeFrame(baseDir,frame.N);
  const spread=rad(10+6*clamp(P.openness,0.5,1.5));
  const offsets=[[0,0],[.7,0],[-.7,0],[0,.7],[0,-.7],[.55,.55],[-.55,.55],[.55,-.55],[-.55,-.55]];
  for(let i=0;i<offsets.length;i++){
    const [a,b]=offsets[i];
    const d=baseDir.clone()
      .addScaledVector(baseFrame.N,Math.tan(spread*a))
      .addScaledVector(baseFrame.B,Math.tan(spread*b))
      .normalize();
    let probe=pos.clone().addScaledVector(d,length*0.82);
    const localPerception=clamp(Math.max(length*0.92,0.28),0.28,P.perception);
    const sf=freeSpaceScore(probe,hash,localPerception);
    if(P.spaceField&&sf.repel.lengthSq())d.addScaledVector(sf.repel,P.space*0.48).normalize();
    if(P.lightField)d.addScaledVector(lv,P.light*0.20).normalize();
    if(P.upField)d.addScaledVector(up,P.gravity*0.14).normalize();
    d.addScaledVector(frame.T,P.parent*0.18).normalize();
    probe=pos.clone().addScaledVector(d,length*0.82);
    const sf2=freeSpaceScore(probe,hash,localPerception);
    const lightFit=(d.dot(lv)+1)*0.5,continuity=(d.dot(frame.T)+1)*0.5,upFit=(d.y+1)*0.5;
    let score=0.18+0.24*hash01(key+':'+i);
    if(P.spaceField)score+=0.33*sf2.free*P.space;
    if(P.lightField)score+=0.22*lightFit*P.light;
    if(P.upField)score+=0.09*upFit*P.gravity;
    score+=0.16*continuity*P.parent;
    score-=0.055*order+0.018*depth+0.38*sf2.obstaclePenalty;
    candidates.push({dir:d,score,free:sf2.free,probe,obstaclePenalty:sf2.obstaclePenalty});
  }
  candidates.sort((x,y)=>y.score-x.score);
  return {best:candidates[0],candidates};
}

function addSegmentSamples(hash,a,b){
  hash.add(a);hash.add(a.clone().lerp(b,.28));hash.add(a.clone().lerp(b,.56));hash.add(a.clone().lerp(b,.82));hash.add(b);
}

function growGraph(){
  const voice=VOICES[P.voice],segments=[],buds=[],hash=new SpatialHash(P.perception*0.64),queue=[],probeRecords=[];
  const rootPos=new THREE.Vector3(0,-3,0),rootFrame=makeFrame(new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0));
  queue.push({pos:rootPos,frame:rootFrame,depth:0,order:0,length:voice.baseLength,parent:-1,key:'root',energy:1});
  hash.add(rootPos);
  let cursor=0;
  while(cursor<queue.length&&segments.length<MAX_SEGMENTS){
    const shoot=queue[cursor++];if(shoot.depth>=P.pass)continue;
    const noise=new THREE.Vector3(sh(shoot.key+':x')*.018,0,sh(shoot.key+':z')*.018);
    const segDir=shoot.frame.T.clone().add(noise).normalize();
    const end=shoot.pos.clone().addScaledVector(segDir,shoot.length);
    const idx=segments.length;
    segments.push({a:shoot.pos.clone(),b:end.clone(),depth:shoot.depth,order:shoot.order,parent:shoot.parent,children:[],support:1,key:shoot.key,energy:shoot.energy});
    if(shoot.parent>=0)segments[shoot.parent].children.push(idx);
    addSegmentSamples(hash,shoot.pos,end);
    if(shoot.depth>=P.pass-1)continue;

    const nodeFrame=transport(shoot.frame,segDir,sh(shoot.key+':roll')*.09);
    const nextLen=Math.max(.07,shoot.length*voice.decay*(.94+.11*hash01(shoot.key+':decay'))*(1-.045*Math.min(shoot.order,5)));
    const candidateBuds=[];
    const leaderBase=dirLocal(nodeFrame,rad(3+6*hash01(shoot.key+':li')),sh(shoot.key+':la')*.14);
    const leaderEval=scoreDirection(end,nodeFrame,leaderBase,nextLen,shoot.depth+1,shoot.order,shoot.key+':leader',hash);
    candidateBuds.push({type:'leader',pos:end.clone(),frame:nodeFrame,eval:leaderEval,depth:shoot.depth+1,order:shoot.order,key:shoot.key+'L',length:nextLen,energy:shoot.energy*.91,parent:idx});

    const phase=hash01(shoot.key+':phase')*Math.PI*2+shoot.depth*rad(31.5);
    for(let slot=0;slot<voice.slots;slot++){
      const frac=clamp(.34+.54*((slot+.45)/(voice.slots+.25))+sh(shoot.key+':f:'+slot)*.045,.27,.94);
      const pos=shoot.pos.clone().lerp(end,frac);
      const az=phase+slot*Math.PI*2/voice.slots+sh(shoot.key+':az:'+slot)*rad(12);
      const incl=rad(voice.angle*P.openness*(.76+.34*hash01(shoot.key+':inc:'+slot)));
      const base=dirLocal(nodeFrame,incl,az);
      const len=nextLen*(.78+.18*hash01(shoot.key+':len:'+slot));
      const ev=scoreDirection(pos,nodeFrame,base,len,shoot.depth+1,shoot.order+1,shoot.key+':bud:'+slot,hash);
      candidateBuds.push({type:'lateral',slot,pos,frame:nodeFrame,eval:ev,depth:shoot.depth+1,order:shoot.order+1,key:shoot.key+'B'+slot,length:len,energy:shoot.energy*.74,parent:idx});
    }

    const laterals=candidateBuds.filter(b=>b.type==='lateral').sort((a,b)=>b.eval.best.score-a.eval.best.score);
    const maxLat=shoot.depth<2?3:(shoot.depth<5?2:(shoot.depth<8?2:1));
    const allowed=new Set(laterals.slice(0,maxLat).map(b=>b.key));
    for(const b of candidateBuds){
      const best=b.eval.best;
      let active=false;
      if(b.type==='leader')active=best.score>P.threshold-.22&&b.energy>.055;
      else {
        const earlyRelease=b.depth<=4 && allowed.has(b.key) && best.score>P.threshold-.16 && best.free>.08;
        const normalRelease=allowed.has(b.key)&&best.score>P.threshold&&best.free>.10;
        active=(earlyRelease||normalRelease)&&b.energy>.035;
      }
      buds.push({pos:b.pos.clone(),state:active?'active':'dormant',score:best.score,type:b.type,key:b.key,dir:best.dir.clone(),depth:b.depth});
      if(showProbe && probeRecords.length<1 && b.type==='lateral' && b.depth>=3 && b.depth<=5){
        probeRecords.push({pos:b.pos.clone(),candidates:b.eval.candidates.slice(0,9)});
      }
      if(active){
        queue.push({pos:b.pos.clone(),frame:transport(b.frame,best.dir,sh(b.key+':roll')*.14),depth:b.depth,order:b.order,length:b.length,parent:b.parent,key:b.key,energy:b.energy});
      }
    }
  }

  for(let i=segments.length-1;i>=0;i--){
    let support=.65+.35*segments[i].energy;
    for(const c of segments[i].children)support+=segments[c].support;
    segments[i].support=support;
  }
  return {segments,buds,hash,probeRecords};
}

function setCylinder(index,a,b,r){
  const d=b.clone().sub(a),len=Math.max(1e-5,d.length());
  tmp.position.copy(a).add(b).multiplyScalar(.5);
  tmp.quaternion.setFromUnitVectors(up,d.normalize());
  tmp.scale.set(r,len,r);tmp.updateMatrix();branchMesh.setMatrixAt(index,tmp.matrix);
}
function setSphere(mesh,index,p,r){
  tmp.position.copy(p);tmp.quaternion.identity();tmp.scale.setScalar(r);tmp.updateMatrix();mesh.setMatrixAt(index,tmp.matrix);
}

function updateFieldVisuals(graph){
  const samples=graph.hash.samples;
  const step=Math.max(1,Math.ceil(samples.length/1800)),arr=[];
  for(let i=0;i<samples.length;i+=step){const p=samples[i];arr.push(p.x,p.y,p.z);}
  occupancyPoints.geometry.dispose();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));occupancyPoints.geometry=g;
  occupancyPoints.visible=showField;

  const ray=[];
  if(graph.probeRecords.length){
    const rec=graph.probeRecords[0];
    perceptionShell.position.copy(rec.pos);perceptionShell.scale.setScalar(P.perception);perceptionShell.visible=showProbe;
    for(const c of rec.candidates){
      ray.push(rec.pos.x,rec.pos.y,rec.pos.z,c.probe.x,c.probe.y,c.probe.z);
    }
  }else perceptionShell.visible=false;
  probeLines.geometry.dispose();
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(ray,3));probeLines.geometry=rg;probeLines.visible=showProbe;
}

function signature(graph){
  const box=new THREE.Box3();let sx=0,sy=0,sz=0;
  for(const s of graph.segments){box.expandByPoint(s.a);box.expandByPoint(s.b);sx+=s.b.x;sy+=s.b.y;sz+=s.b.z;}
  const n=Math.max(1,graph.segments.length),active=graph.buds.filter(b=>b.state==='active').length;
  return {
    segmentCount:graph.segments.length,budCount:graph.buds.length,activeBudCount:active,dormantBudCount:graph.buds.length-active,
    occupancySamples:graph.hash.samples.length,probeCandidates:graph.probeRecords[0]?.candidates.length||0,
    centroid:[sx/n,sy/n,sz/n].map(v=>Number(v.toFixed(4))),
    bounds:{min:[box.min.x,box.min.y,box.min.z].map(v=>Number(v.toFixed(4))),max:[box.max.x,box.max.y,box.max.z].map(v=>Number(v.toFixed(4)))},
    zSpan:Number((box.max.z-box.min.z).toFixed(4)),native3D:true,projectionLocked:false,cameraAffectsGeneration:false,
    appliesToSpecies:false,spatialHash:true,perceptionVolume:true,supportBackprop:true,pass:P.pass,voice:P.voice,obstacleEnabled:P.obstacle
  };
}

function rebuild(){
  const graph=growGraph();lastGraph=graph;windRig=makeConnectedWind(THREE,graph,seed);
  const n=Math.min(graph.segments.length,MAX_SEGMENTS);
  for(let i=0;i<n;i++){
    const s=graph.segments[i],r=clamp(.012+.0058*Math.pow(s.support,.43),.014,.145)*(1-.055*Math.min(s.order,5));
    setCylinder(i,s.a,s.b,r);setSphere(jointMesh,i,s.a,r*1.06);
  }
  if(n){const s=graph.segments[n-1];setSphere(jointMesh,n,s.b,.018);}
  branchMesh.count=n;jointMesh.count=Math.min(n+1,MAX_SEGMENTS+1);branchMesh.instanceMatrix.needsUpdate=true;jointMesh.instanceMatrix.needsUpdate=true;

  let ai=0,di=0;for(const b of graph.buds){
    if(b.state==='active'&&ai<MAX_BUDS)setSphere(activeBudMesh,ai++,b.pos,b.type==='leader'?.038:.030);
    else if(b.state==='dormant'&&di<MAX_BUDS)setSphere(dormantBudMesh,di++,b.pos,.019);
  }
  activeBudMesh.count=ai;dormantBudMesh.count=di;activeBudMesh.instanceMatrix.needsUpdate=true;dormantBudMesh.instanceMatrix.needsUpdate=true;
  activeBudMesh.visible=showBuds;dormantBudMesh.visible=showBuds;

  obstacle.visible=P.obstacle;obstacle.position.copy(obstacleCenter());
  const lv=lightVec();lightArrow.setDirection(lv);lightArrow.visible=P.lightField;

  updateFieldVisuals(graph);
  currentSignature=signature(graph);
  const b=currentSignature.bounds;bboxHelper.box.set(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max));
  infoEl.textContent=`Native R03 · Shoot ${currentSignature.segmentCount} · Bud ${currentSignature.activeBudCount} active / ${currentSignature.dormantBudCount} dormant · Occupancy ${currentSignature.occupancySamples}`;
  $('segBadge').textContent='Shoot '+currentSignature.segmentCount;$('budBadge').textContent='Bud '+currentSignature.budCount;$('volBadge').textContent='Z '+currentSignature.zSpan.toFixed(2);
  statusEl.textContent=`R03 已直接在三维空间生长。当前 ${VOICES[P.voice].name} 只提供候选槽；Space / Light / Obstacle 会在枝条出生以前改变 Bud 的选择。分枝粗细来自下游 support 反传，不再只按递归层级缩放。`;
  updateOutputs();window.__native3dR03Signature=currentSignature;
  initStudyGraph();
  if(firstFit){firstFit=false;requestAnimationFrame(fitToGraph);}
}

function updateOutputs(){
  $('voiceO').textContent=VOICES[P.voice].name;$('passO').textContent=String(P.pass);$('spaceO').textContent=P.space.toFixed(2);$('lightO').textContent=P.light.toFixed(2);
  $('lightAzO').textContent=P.lightAz.toFixed(0)+'°';$('lightElO').textContent=P.lightEl.toFixed(0)+'°';$('gravityO').textContent=P.gravity.toFixed(2);$('parentO').textContent=P.parent.toFixed(2);
  $('thresholdO').textContent=P.threshold.toFixed(2);$('perceptionO').textContent=P.perception.toFixed(2);$('opennessO').textContent=P.openness.toFixed(2);$('obsXO').textContent=P.obsX.toFixed(2);$('obsZO').textContent=P.obsZ.toFixed(2);
}
let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(rebuild,80);}
function range(id,key,parse=Number){$(id).addEventListener('input',e=>{P[key]=parse(e.target.value);schedule();});}
$('voice').addEventListener('change',e=>{P.voice=e.target.value;rebuild();});
range('pass','pass',v=>parseInt(v,10));range('space','space');range('light','light');range('lightAz','lightAz');range('lightEl','lightEl');range('gravity','gravity');range('parent','parent');range('threshold','threshold');range('perception','perception');range('openness','openness');range('obsX','obsX');range('obsZ','obsZ');
for(const [id,key] of [['obstacle','obstacle'],['lightField','lightField'],['spaceField','spaceField'],['upField','upField']])$(id).addEventListener('change',e=>{P[key]=e.target.checked;rebuild();});
$('rebuild').addEventListener('click',rebuild);
$('buds').addEventListener('click',()=>{showBuds=!showBuds;$('buds').classList.toggle('on',showBuds);activeBudMesh.visible=showBuds;dormantBudMesh.visible=showBuds;});
$('field').addEventListener('click',()=>{showField=!showField;$('field').classList.toggle('on',showField);occupancyPoints.visible=showField;});
$('probe').addEventListener('click',()=>{showProbe=!showProbe;$('probe').classList.toggle('on',showProbe);probeLines.visible=showProbe;perceptionShell.visible=showProbe&&Boolean(lastGraph?.probeRecords.length);rebuild();});
$('auto').addEventListener('click',()=>{autoRotate=!autoRotate;controls.autoRotate=autoRotate;controls.autoRotateSpeed=.6;$('auto').classList.toggle('on',autoRotate);});
$('grow').addEventListener('click',()=>{
  if(growTimer){clearInterval(growTimer);growTimer=null;$('grow').classList.remove('on');$('grow').textContent='播放生长';return;}
  P.pass=1;$('pass').value='1';rebuild();$('grow').classList.add('on');$('grow').textContent='停止生长';
  growTimer=setInterval(()=>{P.pass+=1;if(P.pass>11){clearInterval(growTimer);growTimer=null;P.pass=11;$('grow').classList.remove('on');$('grow').textContent='播放生长';} $('pass').value=String(P.pass);rebuild();},650);
});

function setView(p,target=new THREE.Vector3(0,.55,0)){camera.position.copy(p);controls.target.copy(target);controls.update();}
function fitToGraph(){
  if(!currentSignature)return;
  const b=currentSignature.bounds;
  const min=new THREE.Vector3(...b.min),max=new THREE.Vector3(...b.max),center=min.clone().add(max).multiplyScalar(.5);
  const size=max.clone().sub(min),span=Math.max(size.x,size.y,size.z,2);
  const direction=new THREE.Vector3(1.05,.62,1.18).normalize();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction,span*1.55);
  camera.near=Math.max(.02,span/180);camera.far=Math.max(60,span*12);camera.updateProjectionMatrix();controls.update();
}
$('fit').addEventListener('click',fitToGraph);
$('orbit').addEventListener('click',()=>setView(new THREE.Vector3(8.2,5.1,9.1)));
$('front').addEventListener('click',()=>setView(new THREE.Vector3(0,.6,13)));
$('side').addEventListener('click',()=>setView(new THREE.Vector3(13,.6,0)));
$('top').addEventListener('click',()=>setView(new THREE.Vector3(0,13,.01),new THREE.Vector3(0,.3,0)));

function resize(){const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();

// Additive pose layer: shared geometry/instance buffers and immutable R03 graph.
const restLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xc1c8c4,transparent:true,opacity:.23,depthWrite:false}));scene.add(restLines);
const frameLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.8,depthWrite:false}));scene.add(frameLines);
const windLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x779db5,transparent:true,opacity:.48,depthWrite:false}));scene.add(windLines);
const windOrigins=[];for(let y=-3;y<=5;y+=1)for(let x=-4;x<=4;x+=1)windOrigins.push(new THREE.Vector3(x,y,-1.8));
windLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(windOrigins.length*6),3));
let frameIndices=[],lastMetricTick=-1;
const frameTemp=new THREE.Vector3(),windTemp=new THREE.Vector3(),sampleTemp=new THREE.Vector3();
function initStudyGraph(){
  const rest=[];for(const n of windRig.nodes)rest.push(...n.restA.toArray(),...n.restB.toArray());
  restLines.geometry.dispose();restLines.geometry=new THREE.BufferGeometry();restLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(rest,3));
  const step=Math.max(1,Math.ceil(windRig.nodes.length/48));frameIndices=windRig.nodes.map((_,i)=>i).filter(i=>i%step===0);
  const colors=[];for(const i of frameIndices)colors.push(1,.25,.25,1,.25,.25,.25,1,.3,.25,1,.3,.3,.5,1,.3,.5,1);
  frameLines.geometry.dispose();frameLines.geometry=new THREE.BufferGeometry();frameLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(frameIndices.length*18),3));frameLines.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  $('studyIdentity').textContent=`ID ${windRig.identity.seed} / ${windRig.identity.topologyHash} · 枝段 ${windRig.nodes.length} · 芽 ${windRig.buds.length}`;
  lastMetricTick=-1;updateStudyPose();
}
function updateStudyPose(){
  if(!windRig)return;
  windRig.pose(motion.time,{...motion,strength:motion.enabled?motion.strength:0});
  for(let i=0;i<windRig.nodes.length;i++){
    const n=windRig.nodes[i],r=clamp(.012+.0058*Math.pow(n.support,.43),.014,.145)*(1-.055*Math.min(n.order,5));
    setCylinder(i,n.a,n.b,r);setSphere(jointMesh,i,n.a,r*1.06);
  }
  const end=windRig.nodes.at(-1);if(end)setSphere(jointMesh,windRig.nodes.length,end.b,.018);
  let ai=0,di=0;for(const b of windRig.buds){if(b.state==='active'&&ai<MAX_BUDS)setSphere(activeBudMesh,ai++,b.pos,b.type==='leader'?.038:.030);else if(b.state==='dormant'&&di<MAX_BUDS)setSphere(dormantBudMesh,di++,b.pos,.019);}
  for(const m of [branchMesh,jointMesh,activeBudMesh,dormantBudMesh]){m.instanceMatrix.needsUpdate=true;m.frustumCulled=false;}
  restLines.visible=motion.rest;frameLines.visible=motion.frames;windLines.visible=motion.field;
  if(motion.frames){let k=0;const arr=frameLines.geometry.attributes.position.array;for(const i of frameIndices){const n=windRig.nodes[i];for(const axis of [n.T,n.N,n.B]){frameTemp.copy(axis).applyQuaternion(n.rotation).multiplyScalar(Math.min(.22,n.length*.6)).add(n.a);for(const v of [n.a,frameTemp]){arr[k++]=v.x;arr[k++]=v.y;arr[k++]=v.z;}}}frameLines.geometry.attributes.position.needsUpdate=true;frameLines.frustumCulled=false;}
  if(motion.field){let k=0;const arr=windLines.geometry.attributes.position.array;for(const p of windOrigins){sampleTemp.copy(p);sampleTemp.x+=motion.offsetX;sampleTemp.z+=motion.offsetZ;windRig.field(sampleTemp,motion.time,motion.enabled?motion.strength:0,motion.azimuth,windTemp);windTemp.multiplyScalar(.7).add(p);for(const v of [p,windTemp]){arr[k++]=v.x;arr[k++]=v.y;arr[k++]=v.z;}}windLines.geometry.attributes.position.needsUpdate=true;windLines.frustumCulled=false;}
  const tick=Math.floor(motion.time*4);if(tick!==lastMetricTick||!motion.playing){lastMetricTick=tick;const m=windRig.metrics();$('studyMetrics').textContent=`连接误差 ${m.connectionError.toExponential(1)} / 枝长误差 ${m.lengthError.toExponential(1)} / 根端 ${m.rootError.toExponential(1)}`;}
  $('windTimeO').textContent=motion.time.toFixed(2)+' s';$('windTime').value=String(motion.time%30);
}
for(const [id,key] of [['windStrength','strength'],['windAz','azimuth'],['worldOffset','offsetX']])$(id).addEventListener('input',e=>{motion[key]=Number(e.target.value);$('windStrengthO').textContent=motion.strength.toFixed(2);$('windAzO').textContent=motion.azimuth+'°';$('worldOffsetO').textContent=motion.offsetX.toFixed(1);lastMetricTick=-1;updateStudyPose();});
$('windTime').addEventListener('input',e=>{motion.playing=false;motion.time=Number(e.target.value);$('windPlay').textContent='播放风';$('windPlay').classList.remove('on');updateStudyPose();});
$('windOn').addEventListener('click',()=>{motion.enabled=!motion.enabled;$('windOn').textContent='风响应：'+(motion.enabled?'开':'关');$('windOn').classList.toggle('on',motion.enabled);lastMetricTick=-1;updateStudyPose();});
$('windPlay').addEventListener('click',()=>{motion.playing=!motion.playing;$('windPlay').textContent=motion.playing?'暂停风':'播放风';$('windPlay').classList.toggle('on',motion.playing);});
$('windReset').addEventListener('click',()=>{motion.time=0;lastMetricTick=-1;updateStudyPose();});
for(const [id,key] of [['restOverlay','rest'],['localFrames','frames'],['windField','field']])$(id).addEventListener('click',()=>{motion[key]=!motion[key];$(id).classList.toggle('on',motion[key]);updateStudyPose();});
$('applySeed').addEventListener('click',()=>{const v=Number($('plantSeed').value);if(!Number.isSafeInteger(v)||v<0||v>2147483647)return;seed=v;rebuild();});
$('originalSeed').addEventListener('click',()=>{seed=123303;$('plantSeed').value=String(seed);rebuild();});
$('saveIdentity').addEventListener('click',()=>{const record={...windRig.identity,baseline:'95ac11fe07b7940818321fc6be8b56778c3389de',growth:{...P},motion:{...motion}};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));a.download=`R03-individual-${seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
window.SpiritR03Study={getState:()=>({identity:windRig?.identity,motion:{...motion},growth:{...P},metrics:windRig?.metrics(),geometryCount:renderer.info.memory.geometries}),rule:RULE_VERSION};

try{
  rebuild();
  window.__native3dR03Ready=true;
  window.Native3DFractalR03={
    rebuild,
    setObstacle(v){P.obstacle=Boolean(v);$('obstacle').checked=P.obstacle;rebuild();},
    setLightAz(v){P.lightAz=clamp(Number(v)||0,-180,180);$('lightAz').value=String(P.lightAz);rebuild();},
    setSpace(v){P.space=clamp(Number(v)||0,0,2.4);$('space').value=String(P.space);rebuild();},
    setPass(v){P.pass=Math.round(clamp(Number(v)||1,1,11));$('pass').value=String(P.pass);rebuild();},
    setVoice(id){if(!VOICES[id])return;P.voice=id;$('voice').value=id;rebuild();},
    front(){setView(new THREE.Vector3(0,.6,13));},
    side(){setView(new THREE.Vector3(13,.6,0));},
    fit:fitToGraph,
    getState(){return {params:{...P},signature:currentSignature,showBuds,showField,showProbe,autoRotate};}
  };
  document.documentElement.dataset.ready='true';
  let previous=performance.now();
  (function animate(now=performance.now()){const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;if(motion.playing&&motion.enabled)motion.time+=dt;updateStudyPose();controls.update();renderer.render(scene,camera);requestAnimationFrame(animate);})();
}catch(error){errorEl.hidden=false;errorEl.textContent=String(error?.stack||error);throw error;}

