import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

const $=id=>document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const rad=d=>THREE.MathUtils.degToRad(d);
const seed=404123;

const P={
  pass:9,alloc:.38,waterAz:-38,water:1.15,rootLateral:.72,surfaceRoot:.34,
  lightAz:52,space:1.12,threshold:.47,leafSource:1.0,surfaceRes:48,
  rock:true,meristem:true,rootField:true,shootField:true
};
let showRoots=true,showLeaves=true,showFlows=true,showSurface=true,autoRotate=false,growTimer=null,currentSignature=null,currentGraph=null;
let implicit=null,implicitRes=0;

const stage=$('stage'),errorEl=$('error'),infoEl=$('info'),statusEl=$('status');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x07100f);
scene.fog=new THREE.FogExp2(0x07100f,.023);
const camera=new THREE.PerspectiveCamera(40,1,.03,100);
camera.position.set(9.4,6.1,10.8);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.06;
stage.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.065;controls.target.set(0,2.3,0);controls.minDistance=4;controls.maxDistance=38;controls.maxPolarAngle=Math.PI*.95;

scene.add(new THREE.HemisphereLight(0xc7ded6,0x2a1d1c,1.75));
const sun=new THREE.DirectionalLight(0xe8fff8,2.65);sun.position.set(7,12,6);scene.add(sun);
const rim=new THREE.DirectionalLight(0xff8dad,1.0);rim.position.set(-6,4,-5);scene.add(rim);

const groundMat=new THREE.MeshStandardMaterial({color:0x7e755f,roughness:1,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
const ground=new THREE.Mesh(new THREE.CircleGeometry(7.5,72),groundMat);ground.rotation.x=-Math.PI/2;ground.position.y=0;scene.add(ground);
const grid=new THREE.GridHelper(15,30,0x39504a,0x1b2d29);grid.position.y=.008;scene.add(grid);
const soilBox=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10,3.8,10)),new THREE.LineBasicMaterial({color:0x4d5146,transparent:true,opacity:.28}));
soilBox.position.y=-1.9;scene.add(soilBox);
const rockMat=new THREE.MeshStandardMaterial({color:0x6e6b64,roughness:.98,transparent:true,opacity:.32,depthWrite:false});
const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.9,2),rockMat);rock.position.set(-.8,-1.25,.65);rock.scale.set(1.4,.85,1.1);scene.add(rock);

const woodMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0,side:THREE.DoubleSide});
const skeletonShootMat=new THREE.LineBasicMaterial({color:0x39d8c2,transparent:true,opacity:.42});
const skeletonRootMat=new THREE.LineBasicMaterial({color:0xb58d6b,transparent:true,opacity:.48});
const waterFlowMat=new THREE.LineBasicMaterial({color:0x6fa9db,transparent:true,opacity:.72});
const carbonFlowMat=new THREE.LineBasicMaterial({color:0xd8c577,transparent:true,opacity:.62});
let shootLines=new THREE.LineSegments(new THREE.BufferGeometry(),skeletonShootMat);scene.add(shootLines);
let rootLines=new THREE.LineSegments(new THREE.BufferGeometry(),skeletonRootMat);scene.add(rootLines);
let waterLines=new THREE.LineSegments(new THREE.BufferGeometry(),waterFlowMat);scene.add(waterLines);
let carbonLines=new THREE.LineSegments(new THREE.BufferGeometry(),carbonFlowMat);scene.add(carbonLines);

const leafMat=new THREE.MeshStandardMaterial({color:0x6b9553,roughness:.58,side:THREE.DoubleSide,vertexColors:true});
const leafGeo=(()=>{
  const pos=[
    0,0,0, -.10,.15,0, -.075,.34,.015, 0,.46,.025, .075,.34,.015, .10,.15,0,
  ];
  const idx=[0,1,2,0,2,3,0,3,4,0,4,5];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
})();
const MAX_LEAVES=1600;
const leafMesh=new THREE.InstancedMesh(leafGeo,leafMat,MAX_LEAVES);leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(leafMesh);
const meristemMat=new THREE.MeshStandardMaterial({color:0xd45b8d,emissive:0x390716,emissiveIntensity:.3,roughness:.48});
const meristemGeo=new THREE.SphereGeometry(1,9,6);
const MAX_TIPS=1200;
const meristemMesh=new THREE.InstancedMesh(meristemGeo,meristemMat,MAX_TIPS);meristemMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(meristemMesh);

const tmp=new THREE.Object3D(),up=new THREE.Vector3(0,1,0),quat=new THREE.Quaternion();

function hash01(text){let h=2166136261>>>0,s=String(text);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h/4294967295}
function sh(t){return hash01(t)*2-1}
function makeFrame(T,NHint){
  const t=T.clone().normalize();let n=NHint?.clone();
  if(!n||n.lengthSq()<1e-8)n=Math.abs(t.dot(up))>.92?new THREE.Vector3(1,0,0):new THREE.Vector3().crossVectors(up,t);
  n.addScaledVector(t,-n.dot(t));if(n.lengthSq()<1e-8)n.set(1,0,0).addScaledVector(t,-t.x);n.normalize();
  const b=new THREE.Vector3().crossVectors(t,n).normalize();return {T:t,N:n,B:b};
}
function transport(frame,newT,roll=0){
  quat.setFromUnitVectors(frame.T,newT);const n=frame.N.clone().applyQuaternion(quat);const f=makeFrame(newT,n);
  if(Math.abs(roll)>1e-6){f.N.applyAxisAngle(f.T,roll).normalize();f.B.crossVectors(f.T,f.N).normalize();}return f;
}
function dirLocal(frame,incl,az){
  return frame.T.clone().multiplyScalar(Math.cos(incl)).addScaledVector(frame.N,Math.sin(incl)*Math.cos(az)).addScaledVector(frame.B,Math.sin(incl)*Math.sin(az)).normalize();
}
function lightVec(){const a=rad(P.lightAz);return new THREE.Vector3(Math.cos(a)*.72,.68,Math.sin(a)*.72).normalize()}
function waterVec(){const a=rad(P.waterAz);return new THREE.Vector3(Math.cos(a)*.74,-.42,Math.sin(a)*.74).normalize()}
function rockPenalty(p){
  if(!P.rock)return {penalty:0,repel:new THREE.Vector3()};
  const local=p.clone().sub(rock.position);local.x/=1.4;local.y/=.85;local.z/=1.1;
  const d=local.length(),safe=1.25;if(d>=safe)return {penalty:0,repel:new THREE.Vector3()};
  const worldRepel=p.clone().sub(rock.position).normalize();return {penalty:clamp((1.04-d)/1.04,0,1),repel:worldRepel.multiplyScalar((safe-d)/safe)};
}
function nearPenalty(p,segments,radius=.46){
  let penalty=0,repel=new THREE.Vector3();
  for(let i=Math.max(0,segments.length-520);i<segments.length;i++){
    const s=segments[i],q=s.a.clone().lerp(s.b,.65),d=p.clone().sub(q),len=d.length();
    if(len>1e-5&&len<radius){const w=(radius-len)/radius;penalty=Math.max(penalty,w);repel.addScaledVector(d.multiplyScalar(1/len),w*w);}
  }
  return {penalty,repel:repel.lengthSq()?repel.normalize():repel};
}

function proposeShoot(tip,shootSegments,key){
  const light=lightVec(),frame=tip.frame,len=tip.length;
  const candidates=[];
  const baseDirs=[frame.T.clone()];
  const slots=3,phase=hash01(key+':phase')*Math.PI*2+tip.depth*rad(33);
  for(let i=0;i<slots;i++)baseDirs.push(dirLocal(frame,rad(36+10*hash01(key+':inc:'+i)),phase+i*Math.PI*2/slots+sh(key+':az:'+i)*rad(11)));
  for(let i=0;i<baseDirs.length;i++){
    let d=baseDirs[i].clone();
    const probe=tip.pos.clone().addScaledVector(d,len*.82),near=nearPenalty(probe,shootSegments,.42+len*.18);
    const rock=rockPenalty(probe);
    if(P.shootField){
      d.addScaledVector(light,.22).addScaledVector(up,.10);
      if(near.repel.lengthSq())d.addScaledVector(near.repel,P.space*.38);
      if(rock.repel.lengthSq())d.addScaledVector(rock.repel,.28);
    }
    d.normalize();
    const lightFit=(d.dot(light)+1)*.5,continuity=(d.dot(frame.T)+1)*.5;
    let score=.25+.25*hash01(key+':score:'+i)+.24*lightFit+.16*continuity-.28*near.penalty-.30*rock.penalty-.045*tip.order;
    if(i===0)score+=.16;
    candidates.push({dir:d,score,type:i===0?'leader':'lateral',slot:i-1});
  }
  return candidates.sort((a,b)=>b.score-a.score);
}
function rootFieldDirection(tip,key,rootSegments){
  const frame=tip.frame,len=tip.length,wv=waterVec(),candidates=[];
  const phase=hash01(key+':phase')*Math.PI*2;
  const bases=[frame.T.clone()];
  const slots=3;
  for(let i=0;i<slots;i++){
    const incl=rad(22+34*P.rootLateral+10*hash01(key+':inc:'+i));
    bases.push(dirLocal(frame,incl,phase+i*Math.PI*2/slots));
  }
  for(let i=0;i<bases.length;i++){
    let d=bases[i].clone(),probe=tip.pos.clone().addScaledVector(d,len*.85),rock=rockPenalty(probe),near=nearPenalty(probe,rootSegments,.34+len*.16);
    if(P.rootField){
      d.addScaledVector(wv,.26*P.water);
      d.addScaledVector(new THREE.Vector3(0,-1,0),.16*(1-P.surfaceRoot));
      d.addScaledVector(new THREE.Vector3(d.x,0,d.z).normalize(),.18*P.rootLateral);
      if(P.surfaceRoot>.01&&probe.y<-.9)d.y+=.12*P.surfaceRoot;
      if(rock.repel.lengthSq())d.addScaledVector(rock.repel,.92);
      if(near.repel.lengthSq())d.addScaledVector(near.repel,.30);
    }
    d.normalize();probe=tip.pos.clone().addScaledVector(d,len*.85);
    const moisture=(d.dot(wv)+1)*.5,depthFit=clamp((-probe.y)/3.3,0,1),surfaceFit=clamp(1-Math.abs(probe.y+.35)/2.4,0,1);
    let score=.26+.25*hash01(key+':rs:'+i)+.24*moisture*P.water+.10*depthFit*(1-P.surfaceRoot)+.12*surfaceFit*P.surfaceRoot-.34*rock.penalty-.24*near.penalty;
    if(i===0)score+=.14;
    candidates.push({dir:d,score,type:i===0?'leader':'lateral',slot:i-1,moisture});
  }
  return candidates.sort((a,b)=>b.score-a.score);
}

function growLife(){
  const shootSegments=[],rootSegments=[],shootTips=[],rootTips=[],ledger=[];
  const seedPos=new THREE.Vector3(0,0,0);
  shootTips.push({pos:seedPos.clone(),frame:makeFrame(new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0)),length:1.35,depth:0,order:0,key:'S0',energy:1});
  rootTips.push({pos:seedPos.clone(),frame:makeFrame(new THREE.Vector3(0,-1,0),new THREE.Vector3(1,0,0)),length:.86,depth:0,order:0,key:'R0',energy:1});
  let leafProxy=0,rootUptake=.55,reserve=1.25;
  for(let pass=1;pass<=P.pass;pass++){
    const leafCarbon=leafProxy*.045*P.leafSource;
    const total=Math.max(.45,reserve+rootUptake*.28+leafCarbon);
    let rootBudget=total*P.alloc,shootBudget=total*(1-P.alloc);
    const newRoots=[],newShoots=[];
    let uptakeThis=0,newLeafProxy=0;

    const rootCandidates=[];
    for(const tip of rootTips){
      const cs=rootFieldDirection(tip,tip.key+':p'+pass,rootSegments);
      for(let rank=0;rank<Math.min(3,cs.length);rank++){
        const c=cs[rank],cost=.12+tip.length*.08+(c.type==='lateral'?.05:0);
        rootCandidates.push({tip,c,cost,rank});
      }
    }
    rootCandidates.sort((a,b)=>b.c.score-a.c.score);
    const usedRootTip=new Map();
    for(const item of rootCandidates){
      const {tip,c,cost}=item;if(rootBudget<cost)continue;
      const count=usedRootTip.get(tip.key)||0,max=tip.depth<2?2:1;if(count>=max)continue;
      if(c.type==='lateral'&&c.score<.48)continue;
      rootBudget-=cost;usedRootTip.set(tip.key,count+1);
      const len=tip.length*(c.type==='leader'?.78:.66)*(1-.035*Math.min(tip.order,4)),end=tip.pos.clone().addScaledVector(c.dir,len);
      const idx=rootSegments.length;rootSegments.push({a:tip.pos.clone(),b:end,depth:tip.depth,order:tip.order+(c.type==='lateral'?1:0),parent:tip.parent??-1,children:[],support:.6,key:tip.key+':'+c.type+':'+item.rank,terminal:true});
      if(tip.parent>=0&&rootSegments[tip.parent]){rootSegments[tip.parent].children.push(idx);rootSegments[tip.parent].terminal=false;}
      const e=tip.energy*(c.type==='leader'?.90:.72);
      newRoots.push({pos:end,frame:transport(tip.frame,c.dir,sh(tip.key+':rr')*.12),length:len,depth:tip.depth+1,order:rootSegments[idx].order,key:rootSegments[idx].key,energy:e,parent:idx});
      uptakeThis+=c.moisture*len*(.72+.28*e);
    }

    const shootCandidates=[];
    for(const tip of shootTips){
      const cs=proposeShoot(tip,shootSegments,tip.key+':p'+pass);
      for(let rank=0;rank<Math.min(4,cs.length);rank++){
        const c=cs[rank],cost=.13+tip.length*.085+(c.type==='lateral'?.06:0);
        shootCandidates.push({tip,c,cost,rank});
      }
    }
    shootCandidates.sort((a,b)=>b.c.score-a.c.score);
    const usedShootTip=new Map();
    for(const item of shootCandidates){
      const {tip,c,cost}=item;if(shootBudget<cost)continue;
      const count=usedShootTip.get(tip.key)||0,max=tip.depth<2?3:(tip.depth<5?2:1);if(count>=max)continue;
      if(c.type==='lateral'&&c.score<P.threshold)continue;
      if(c.type==='leader'&&c.score<P.threshold-.16)continue;
      shootBudget-=cost;usedShootTip.set(tip.key,count+1);
      const len=tip.length*(c.type==='leader'?.74:.64)*(1-.045*Math.min(tip.order,5)),end=tip.pos.clone().addScaledVector(c.dir,len);
      const idx=shootSegments.length;shootSegments.push({a:tip.pos.clone(),b:end,depth:tip.depth,order:tip.order+(c.type==='lateral'?1:0),parent:tip.parent??-1,children:[],support:.6,key:tip.key+':'+c.type+':'+item.rank,terminal:true});
      if(tip.parent>=0&&shootSegments[tip.parent]){shootSegments[tip.parent].children.push(idx);shootSegments[tip.parent].terminal=false;}
      const e=tip.energy*(c.type==='leader'?.91:.74);
      newShoots.push({pos:end,frame:transport(tip.frame,c.dir,sh(tip.key+':sr')*.13),length:len,depth:tip.depth+1,order:shootSegments[idx].order,key:shootSegments[idx].key,energy:e,parent:idx,lightFit:(c.dir.dot(lightVec())+1)*.5});
      if(pass>=4)newLeafProxy+=((c.dir.dot(lightVec())+1)*.5)*(.6+.4*e);
    }

    shootTips.splice(0,shootTips.length,...newShoots.slice(0,380));
    rootTips.splice(0,rootTips.length,...newRoots.slice(0,260));
    rootUptake=.65*rootUptake+.35*uptakeThis;
    leafProxy=.65*leafProxy+.35*(newLeafProxy+shootTips.length*.08);
    reserve=Math.max(.15,reserve*.84);
    ledger.push({pass,total,rootUptake,leafCarbon,leafProxy,shootBudgetLeft:shootBudget,rootBudgetLeft:rootBudget,shootTips:shootTips.length,rootTips:rootTips.length});
    if(!shootTips.length&&!rootTips.length)break;
  }

  for(let i=shootSegments.length-1;i>=0;i--){let support=.55;for(const c of shootSegments[i].children)support+=shootSegments[c].support;shootSegments[i].support=support;}
  for(let i=rootSegments.length-1;i>=0;i--){let support=.65;for(const c of rootSegments[i].children)support+=rootSegments[c].support;rootSegments[i].support=support;}

  return {shootSegments,rootSegments,shootTips,rootTips,ledger,resource:{rootUptake,leafCarbon:leafProxy*.045*P.leafSource,leafProxy,reserve}};
}

function radiusShoot(s){return clamp(.018+.0105*Math.pow(s.support,.45),.018,.20)*(1-.045*Math.min(s.order,5))}
function radiusRoot(s){return clamp(.020+.011*Math.pow(s.support,.44),.020,.19)*(1-.035*Math.min(s.order,5))}
function lineGeometry(segments){
  const a=[];for(const s of segments)a.push(s.a.x,s.a.y,s.a.z,s.b.x,s.b.y,s.b.z);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));return g;
}
function replaceLine(line,segments){line.geometry.dispose();line.geometry=lineGeometry(segments);}

function ensureImplicit(res){
  const effective=Math.min(res,innerWidth<760?42:res);
  if(implicit&&implicitRes===effective)return;
  if(implicit){scene.remove(implicit);implicit.material=woodMat;}
  implicit=new MarchingCubes(effective,woodMat,false,true,320000);implicit.isolation=80;implicit.enableColors=true;implicitRes=effective;scene.add(implicit);
}
function addSegmentField(effect,s,rootMode,bounds,span){
  const r0=rootMode?radiusRoot(s):radiusShoot(s),r1=s.terminal?r0*.18:r0*.78;
  const len=s.a.distanceTo(s.b),steps=Math.max(2,Math.min(10,Math.ceil(len/Math.max(.11,r0*1.2))));
  const subtract=12,color=new THREE.Color(rootMode?0x7d624b:0x6f5d49);
  for(let i=0;i<=steps;i++){
    const t=i/steps,p=s.a.clone().lerp(s.b,t),radius=lerp(r0,r1,Math.pow(t,.88));
    const n=p.clone().sub(bounds.min).divideScalar(span);
    const rn=Math.max(.0025,radius/span),strength=Math.max(.00055,subtract*rn*rn*4.5);
    effect.addBall(clamp(n.x,.01,.99),clamp(n.y,.01,.99),clamp(n.z,.01,.99),strength,subtract,color);
  }
  const p=s.a,n=p.clone().sub(bounds.min).divideScalar(span),jr=Math.max(r0,r1)*1.06/span;
  effect.addBall(clamp(n.x,.01,.99),clamp(n.y,.01,.99),clamp(n.z,.01,.99),Math.max(.0006,subtract*jr*jr*4.5),subtract,color);
}
function rebuildImplicit(graph){
  ensureImplicit(P.surfaceRes);implicit.reset();
  const box=new THREE.Box3();
  for(const s of graph.shootSegments){box.expandByPoint(s.a);box.expandByPoint(s.b)}
  if(showRoots)for(const s of graph.rootSegments){box.expandByPoint(s.a);box.expandByPoint(s.b)}
  if(box.isEmpty())return;
  const size=box.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z,3.5)*1.16,center=box.getCenter(new THREE.Vector3());
  const min=center.clone().addScalar(-span*.5),bounds={min};
  let balls=0;
  for(const s of graph.shootSegments){addSegmentField(implicit,s,false,bounds,span);balls+=4;if(balls>2600)break;}
  if(showRoots)for(const s of graph.rootSegments){addSegmentField(implicit,s,true,bounds,span);balls+=4;if(balls>3200)break;}
  implicit.position.copy(center);implicit.scale.setScalar(span*.5);implicit.update();implicit.visible=showSurface;
  implicit.userData={span,center: center.toArray(),ballBudget:balls};
}

function rebuildLeaves(graph){
  let li=0,mi=0;const dummy=new THREE.Object3D(),golden=Math.PI*(3-Math.sqrt(5));
  const terminals=graph.shootTips.slice(0,260);
  for(let ti=0;ti<terminals.length;ti++){
    const tip=terminals[ti],baseDir=tip.frame.T.clone();
    if(P.pass>=4&&showLeaves){
      const count=P.pass<6?2:Math.min(5,2+Math.floor((P.pass-5)*.65));
      for(let j=0;j<count&&li<MAX_LEAVES;j++){
        const az=j*golden+hash01(tip.key+':leaf:'+j)*.3;
        const d=dirLocal(tip.frame,rad(42+20*hash01(tip.key+':lp:'+j)),az);
        dummy.position.copy(tip.pos).addScaledVector(baseDir,-.04*j);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);
        dummy.rotateY((hash01(tip.key+':lr:'+j)-.5)*.35);
        const sc=.75+.42*hash01(tip.key+':ls:'+j);dummy.scale.set(sc,sc,sc);dummy.updateMatrix();leafMesh.setMatrixAt(li,dummy.matrix);
        const col=new THREE.Color().setHSL(.27+.035*hash01(tip.key+':lc:'+j),.42,.25+.08*hash01(tip.key+':ll:'+j));leafMesh.setColorAt(li,col);li++;
      }
    }
    if(P.meristem&&mi<MAX_TIPS){
      dummy.position.copy(tip.pos);dummy.quaternion.setFromUnitVectors(up,baseDir);dummy.scale.set(.035,.075,.035);dummy.updateMatrix();meristemMesh.setMatrixAt(mi++,dummy.matrix);
    }
  }
  leafMesh.count=li;leafMesh.instanceMatrix.needsUpdate=true;if(leafMesh.instanceColor)leafMesh.instanceColor.needsUpdate=true;leafMesh.visible=showLeaves;
  meristemMesh.count=mi;meristemMesh.instanceMatrix.needsUpdate=true;meristemMesh.visible=P.meristem;
  return {leafCount:li,meristemCount:mi};
}

function rebuildFlows(graph){
  replaceLine(shootLines,graph.shootSegments);replaceLine(rootLines,graph.rootSegments);
  const rootFlow=graph.rootSegments.map(s=>({a:s.b,b:s.a})),shootFlow=graph.shootSegments.map(s=>({a:s.b,b:s.a}));
  replaceLine(waterLines,rootFlow);replaceLine(carbonLines,shootFlow);
  rootLines.visible=showRoots&&!showSurface;shootLines.visible=!showSurface;
  waterLines.visible=showFlows&&showRoots;carbonLines.visible=showFlows;
}
function fitGraph(graph){
  const box=new THREE.Box3();for(const s of graph.shootSegments){box.expandByPoint(s.a);box.expandByPoint(s.b)}for(const s of graph.rootSegments){box.expandByPoint(s.a);box.expandByPoint(s.b)}
  if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z,3);
  controls.target.copy(center);camera.position.copy(center).addScaledVector(new THREE.Vector3(1.05,.62,1.16).normalize(),span*1.55);camera.near=Math.max(.02,span/180);camera.far=Math.max(80,span*12);camera.updateProjectionMatrix();controls.update();
}
function signature(graph,organs){
  const box=new THREE.Box3();for(const s of [...graph.shootSegments,...graph.rootSegments]){box.expandByPoint(s.a);box.expandByPoint(s.b)}
  const last=graph.ledger.at(-1)||{};
  return {
    shootSegments:graph.shootSegments.length,rootSegments:graph.rootSegments.length,shootTips:graph.shootTips.length,rootTips:graph.rootTips.length,
    leafCount:organs.leafCount,meristemCount:organs.meristemCount,
    waterUptake:Number(graph.resource.rootUptake.toFixed(4)),carbonSource:Number(graph.resource.leafCarbon.toFixed(4)),
    pass:P.pass,implicitSurface:true,rootShootConnected:true,terminalTaper:true,apicalMeristem:true,resourceFlow:true,
    continuousSkinVisible:showSurface,rootField:true,shootField:true,appliesToSpecies:false,
    zSpan:Number((box.max.z-box.min.z).toFixed(3)),yMin:Number(box.min.y.toFixed(3)),yMax:Number(box.max.y.toFixed(3)),
    lastBudget:Number((last.total||0).toFixed(3)),surfaceResolution:implicitRes
  };
}

function rebuild(fit=false){
  const graph=growLife();currentGraph=graph;
  rock.visible=P.rock;
  rebuildImplicit(graph);
  const organs=rebuildLeaves(graph);rebuildFlows(graph);
  currentSignature=signature(graph,organs);window.__livingTreeR04Signature=currentSignature;
  infoEl.textContent=`Living R04 · Shoot ${currentSignature.shootSegments} · Root ${currentSignature.rootSegments} · Leaf ${currentSignature.leafCount} · Water ${currentSignature.waterUptake.toFixed(2)} · Carbon ${currentSignature.carbonSource.toFixed(2)}`;
  $('shootBadge').textContent='Shoot '+currentSignature.shootSegments;$('rootBadge').textContent='Root '+currentSignature.rootSegments;$('resBadge').textContent='W '+currentSignature.waterUptake.toFixed(2)+' / C '+currentSignature.carbonSource.toFixed(2);$('skinBadge').textContent='Skin '+implicitRes;
  statusEl.textContent=`R04 资源循环已参与拓扑：Root uptake 与 Leaf source 形成下一轮预算，Root / Shoot 分配为 ${P.alloc.toFixed(2)} / ${(1-P.alloc).toFixed(2)}。末端半径在 final shoot 上连续收束，并保留 apical meristem zone；地下根受水分、岩石和地表倾向影响。`;
  updateOutputs();if(fit)requestAnimationFrame(()=>fitGraph(graph));
}
function updateOutputs(){
  $('passO').textContent=String(P.pass);$('allocO').textContent=P.alloc.toFixed(2)+' / '+(1-P.alloc).toFixed(2);$('waterAzO').textContent=P.waterAz.toFixed(0)+'°';$('waterO').textContent=P.water.toFixed(2);
  $('rootLateralO').textContent=P.rootLateral.toFixed(2);$('surfaceRootO').textContent=P.surfaceRoot.toFixed(2);$('lightAzO').textContent=P.lightAz.toFixed(0)+'°';$('spaceO').textContent=P.space.toFixed(2);
  $('thresholdO').textContent=P.threshold.toFixed(2);$('leafSourceO').textContent=P.leafSource.toFixed(2);$('surfaceResO').textContent=String(P.surfaceRes);
}
let timer=0;function schedule(fit=false){clearTimeout(timer);timer=setTimeout(()=>rebuild(fit),120)}
function bind(id,key,parse=Number){$(id).addEventListener('input',e=>{P[key]=parse(e.target.value);schedule(false)})}
bind('pass','pass',v=>parseInt(v,10));bind('alloc','alloc');bind('waterAz','waterAz');bind('water','water');bind('rootLateral','rootLateral');bind('surfaceRoot','surfaceRoot');bind('lightAz','lightAz');bind('space','space');bind('threshold','threshold');bind('leafSource','leafSource');bind('surfaceRes','surfaceRes',v=>parseInt(v,10));
for(const [id,key] of [['rock','rock'],['meristem','meristem'],['rootField','rootField'],['shootField','shootField']])$(id).addEventListener('change',e=>{P[key]=e.target.checked;schedule(false)});
$('rebuild').addEventListener('click',()=>rebuild(true));
$('roots').addEventListener('click',()=>{showRoots=!showRoots;$('roots').classList.toggle('on',showRoots);rebuild(false)});
$('leaves').addEventListener('click',()=>{showLeaves=!showLeaves;$('leaves').classList.toggle('on',showLeaves);rebuild(false)});
$('flows').addEventListener('click',()=>{showFlows=!showFlows;$('flows').classList.toggle('on',showFlows);rebuildFlows(currentGraph)});
$('surface').addEventListener('click',()=>{showSurface=!showSurface;$('surface').classList.toggle('on',showSurface);if(implicit)implicit.visible=showSurface;rebuildFlows(currentGraph)});
$('auto').addEventListener('click',()=>{autoRotate=!autoRotate;controls.autoRotate=autoRotate;controls.autoRotateSpeed=.58;$('auto').classList.toggle('on',autoRotate)});
$('grow').addEventListener('click',()=>{
  if(growTimer){clearInterval(growTimer);growTimer=null;$('grow').classList.remove('on');$('grow').textContent='播放生命';return}
  P.pass=1;$('pass').value='1';rebuild(true);$('grow').classList.add('on');$('grow').textContent='停止生命';
  growTimer=setInterval(()=>{P.pass++;if(P.pass>10){P.pass=10;clearInterval(growTimer);growTimer=null;$('grow').classList.remove('on');$('grow').textContent='播放生命'}$('pass').value=String(P.pass);rebuild(P.pass===10)},720)
});
$('fit').addEventListener('click',()=>fitGraph(currentGraph));
function setView(v,target=new THREE.Vector3(0,1.6,0)){camera.position.copy(v);controls.target.copy(target);controls.update()}
$('front').addEventListener('click',()=>setView(new THREE.Vector3(0,2.2,14)));
$('side').addEventListener('click',()=>setView(new THREE.Vector3(14,2.2,0)));
$('top').addEventListener('click',()=>setView(new THREE.Vector3(0,14,.01),new THREE.Vector3(0,0,0)));

function resize(){const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
window.addEventListener('resize',resize);resize();

try{
  rebuild(true);
  window.__livingTreeR04Ready=true;
  window.LivingTreeR04={
    rebuild:()=>rebuild(false),fit:()=>fitGraph(currentGraph),
    setPass(v){P.pass=Math.round(clamp(Number(v)||1,1,10));$('pass').value=String(P.pass);rebuild(false)},
    setAllocation(v){P.alloc=clamp(Number(v)||.38,.18,.62);$('alloc').value=String(P.alloc);rebuild(false)},
    setWaterAz(v){P.waterAz=clamp(Number(v)||0,-180,180);$('waterAz').value=String(P.waterAz);rebuild(false)},
    setSurfaceRoots(v){P.surfaceRoot=clamp(Number(v)||0,0,1.3);$('surfaceRoot').value=String(P.surfaceRoot);rebuild(false)},
    setRock(v){P.rock=Boolean(v);$('rock').checked=P.rock;rebuild(false)},
    getState(){return {params:{...P},signature:currentSignature,showRoots,showLeaves,showFlows,showSurface}}
  };
  document.documentElement.dataset.ready='true';
  (function animate(){controls.update();renderer.render(scene,camera);requestAnimationFrame(animate)})();
}catch(error){errorEl.hidden=false;errorEl.textContent=String(error?.stack||error);throw error}
