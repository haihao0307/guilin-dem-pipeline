import * as THREE from '../vendor/three.module.js';
import {curve,seeded,clamp,sweep,branchMesh,mergeGeometryBatch} from './geometry.js';
import {createBarkBundle,createBarkMaterial} from './bark.js';
const UP=new THREE.Vector3(0,1,0);
// Parent-tangent departure and cubic control placement preserve the original
// VegetationGenerator TreeDevelopmentGenerator createBranch construction.
function lateralPath(parent,u,dir,length,{droop=.35,wiggle=.12,seed=1}={}){
 const start=parent.getPointAt(u),tangent=parent.getTangentAt(u),departure=tangent.clone().multiplyScalar(.38).addScaledVector(dir,.62).normalize(),end=start.clone().addScaledVector(dir,length);end.y-=droop;const a=start.clone().addScaledVector(departure,length*.24),b=end.clone().addScaledVector(dir,-length*.2),c=new THREE.CubicBezierCurve3(start,a,b,end);const points=[];for(let i=0;i<=18;i++){const t=i/18,p=c.getPoint(t);p.x+=Math.sin(t*11+seed)*wiggle*Math.sin(Math.PI*t);p.z+=Math.sin(t*9+seed*1.7)*wiggle*Math.sin(Math.PI*t);p.y+=Math.sin(t*14+seed)*wiggle*.7*Math.sin(Math.PI*t);points.push(p);}return curve(points);
}
function humanScale(){const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:0x899081,roughness:.82});const head=new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),m);head.position.y=1.58;g.add(head);for(const [a,b,r] of [[[0,.87,0],[0,1.4,0],.10],[[-.055,.87,0],[-.12,.06,.025],.052],[[.055,.87,0],[.13,.06,-.025],.052],[[-.10,1.32,0],[-.26,.89,0],.039],[[.10,1.32,0],[.24,.91,0],.039]])g.add(branchMesh(curve([a,b]),r,m,{segments:5,sides:8,tip:.9,lobes:0}));g.position.set(-2,0,0);return g;}
function needleGeometry(){const g=new THREE.BufferGeometry(),p=[-.009,0,0,.009,0,0,0,.14,.011,0,0,-.007,0,0,.007,0,.14,.011],indices=[0,1,2,3,4,5];g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;}
export function createAncientTree({dead=false,bark=false,seed=dead?505:303}={}){
 const root=new THREE.Group(),wood=new THREE.Group(),shells=new THREE.Group();root.add(wood,shells);const rand=seeded(seed),height=dead?6.1:18.0,axes=[],byId=new Map();
 function registerAxis(id,path,geometry,parentId=null,attachment=0){const parent=parentId?byId.get(parentId):null,growthOffset=parent?parent.growthOffset+parent.path.getLength()*attachment:0;geometry.setAttribute('growthV',new THREE.Float32BufferAttribute(Array.from(geometry.attributes.uv.array).filter((_,i)=>i%2===1).map(v=>v+growthOffset),1));const a={id,path,geometry,parentId,attachment,growthOffset};axes.push(a);byId.set(id,a);return a;}
 const clay=new THREE.MeshStandardMaterial({color:0x969180,roughness:.83});
 const trunk=curve(dead?[[0,0,0],[.12,.9,.10],[-.15,1.7,.08],[.28,2.4,.10],[.02,3.05,.15],[-.28,3.7,.16]]:[[0,0,0],[-.15,2.6,.10],[.64,5.0,.35],[-.36,7.9,.18],[.40,10.8,.1],[-.68,14.0,-.22],[-1.02,16.5,-.15],[-1.48,18.0,.08]]);
 const trunkGeo=sweep(trunk,dead?.69:1.17,{segments:180,sides:56,tip:dead?.3:.13,twist:dead?1.6:4.9,lobes:dead?.17:.18,hollow:true,holes:dead?[{u:.72,t:.18,w:.15,h:.18},{u:.23,t:.52,w:.12,h:.17}]:[{u:.74,t:.22,w:.14,h:.13},{u:.20,t:.73,w:.17,h:.19}],broken:true});trunkGeo.attributes.junction.array.fill(0);
 registerAxis('trunk',trunk,trunkGeo);let bundle=null;
 const trunkMesh=new THREE.Mesh(trunkGeo,clay);trunkMesh.castShadow=trunkMesh.receiveShadow=true;wood.add(trunkMesh);
 if(bark){bundle=createBarkBundle(THREE,trunkGeo,{seed,circumference:dead?3.7:6.4,plateWidth:.105,plateLength:.31,thickness:.026,maxShells:2800});trunkMesh.material=bundle.material;const skin=new THREE.Mesh(bundle.shellGeometry,bundle.shellMaterial);skin.castShadow=skin.receiveShadow=true;shells.add(skin);}
 const branchMaterial=clay,exposed=new THREE.MeshStandardMaterial({color:dead?0xb2a690:0xa5a08c,roughness:.86});
 const tips=[],primary=[];
 for(let i=0;i<(dead?7:10);i++){
  const u=dead?[.62,.59,.41,.32,.78,.53,.88][i]:[.22,.31,.35,.43,.49,.56,.60,.68,.73,.82][i];
  const az=dead?[3.02,.15,3.5,.4,2.4,5.5,.0][i]:i*2.399963+.38;
  const length=dead?[3.9,3.7,2.5,2.3,2.4,2.1,1.3][i]:(3.7*(1-u)+1.15)*(.8+rand()*.35);
  const dir=new THREE.Vector3(Math.cos(az),dead?[1.6,.65,.26,.15,1.1,.48,.8][i]:-.08+rand()*.12,Math.sin(az)).normalize(),path=lateralPath(trunk,u,dir,length,{droop:dead?-.25:.7,wiggle:dead?.18:.11,seed:i+3});const radius=dead?[.28,.27,.17,.15,.15,.15,.10][i]:.24*(1-u)*1.4;
  const m=branchMesh(path,radius,branchMaterial,{segments:70,sides:20,tip:dead&&i===0?.12:.03,twist:1.7,lobes:.14,broken:true});wood.add(m);registerAxis(`primary-${i}`,path,m.geometry,'trunk',u);primary.push({path,radius});
  for(let j=0;j<(dead?5:6);j++){
   const at=.32+j*.11,angle=az+(j%2?-.65:.65)+(rand()-.5)*.3,dir2=new THREE.Vector3(Math.cos(angle),dead?.28+rand()*.4:.16,Math.sin(angle)).normalize(),len2=length*(dead?.3:.35)*(1-at*.35),p2=lateralPath(path,at,dir2,len2,{droop:dead?-.10:.1,wiggle:dead?.09:.045,seed:i*9+j});const m2=branchMesh(p2,radius*.38*(1-at*.45),branchMaterial,{segments:26,sides:9,tip:.015,twist:.5,lobes:.12});wood.add(m2);registerAxis(`secondary-${i}-${j}`,p2,m2.geometry,`primary-${i}`,at);
   for(let k=0;k<(dead?3:4);k++){
    const a=.40+k*.17,ang=angle+(k%2?-.65:.65),dir3=new THREE.Vector3(Math.cos(ang),dead?.38:.35,Math.sin(ang)).normalize(),len3=len2*(.30+rand()*.16),p3=lateralPath(p2,a,dir3,len3,{droop:-.04,wiggle:.025,seed:k+j*11});const m3=branchMesh(p3,radius*.13*(1-at*.5),branchMaterial,{segments:13,sides:6,tip:.01,lobes:.06});wood.add(m3);registerAxis(`terminal-${i}-${j}-${k}`,p3,m3.geometry,`secondary-${i}-${j}`,a);tips.push({path:p3,i:i*50+j*5+k});
   }
   if(dead&&j%2===0)tips.push({path:p2,i});
  }
 }
 // Exposed longitudinal wood ribs: connected to the supporting trunk curve,
 // producing real torn relief and negative spaces rather than a painted hole.
 const frames=trunk.computeFrenetFrames(100,false);for(let k=0;k<(dead?8:5);k++){const pts=[];for(let i=0;i<=64;i++){const start=(k%3)*.09,end=.54+(k%4)*.10,t=start+i/64*(end-start),a=k*Math.PI*2/(dead?8:5)+t*(dead?1.8:3.1),c=trunk.getPointAt(t),fr=frames.normals[Math.round(t*100)],bi=frames.binormals[Math.round(t*100)],r=(dead?.65:1.10)*Math.pow(1-t,.8);pts.push(c.addScaledVector(fr,Math.cos(a)*r).addScaledVector(bi,Math.sin(a)*r));}wood.add(branchMesh(curve(pts),(dead?.054:.039),exposed,{segments:72,sides:8,tip:.3,lobes:.16,twist:2}));}
 for(let i=0;i<8;i++){const a=i*Math.PI/4+.1,r=1.1+rand()*.5;const rp=curve([trunk.getPointAt(.006),[Math.cos(a)*.72,.08,Math.sin(a)*.72],[Math.cos(a)*r,-.005,Math.sin(a)*r],[Math.cos(a)*(r+.35),-.01,Math.sin(a)*(r+.35)]]);const mr=branchMesh(rp,.20,branchMaterial,{segments:28,sides:12,tip:.02,twist:1.5,lobes:.16});wood.add(mr);registerAxis(`root-${i}`,rp,mr.geometry,'trunk',.006);}
 let needles;
 if(!dead){const count=tips.length*165;needles=new THREE.InstancedMesh(needleGeometry(),new THREE.MeshStandardMaterial({color:0x738b34,roughness:.74,side:THREE.DoubleSide}),count);const dummy=new THREE.Object3D();let cursor=0;for(const tip of tips){for(let n=0;n<165;n++){const at=.2+rand()*.78,p=tip.path.getPointAt(at),axis=tip.path.getTangentAt(at),az=rand()*Math.PI*2,rad=new THREE.Vector3(Math.cos(az),.55+rand()*.4,Math.sin(az)).normalize(),direction=axis.clone().multiplyScalar(.5).addScaledVector(rad,.7).normalize();dummy.position.copy(p);dummy.quaternion.setFromUnitVectors(UP,direction);const s=.7+rand()*.65;dummy.scale.set(s,s,s);dummy.updateMatrix();needles.setMatrixAt(cursor,dummy.matrix);needles.setColorAt(cursor,new THREE.Color().setHSL(.20+rand()*.065,.28+rand()*.2,.15+rand()*.13));cursor++;}}needles.instanceMatrix.needsUpdate=true;needles.castShadow=needles.receiveShadow=true;root.add(needles);}
 // Batch the diagnostic woody geometry; retain per-axis buffers and growth UV
 // records for later junction-aware bark integration, without applying rejected skin.
 const batch=wood.children.filter(o=>o!==trunkMesh&&o.material===clay);if(batch.length){const mesh=new THREE.Mesh(mergeGeometryBatch(batch.map(o=>o.geometry)),clay);mesh.castShadow=mesh.receiveShadow=true;for(const m of batch)wood.remove(m);wood.add(mesh);}
 root.add(humanScale());shells.visible=bark;return {root,wood,shells,trunkMesh,bundle,axes,byId,setNeedles(v){if(needles)needles.visible=v;},evidence(){return {axes:axes.length,connected:axes.every(a=>!a.parentId||a.path.getPointAt(0).distanceTo(byId.get(a.parentId).path.getPointAt(a.attachment))<1e-6),growthVContinuous:axes.every(a=>!a.parentId||Math.abs(a.geometry.attributes.growthV.getX(0)-byId.get(a.parentId).growthOffset-byId.get(a.parentId).path.getLength()*a.attachment)<1e-5),holes:trunkGeo.userData.holes,barkApplied:!!bundle};},info:{geometry:dead?'hollow split trunk + connected dead branch hierarchy':'hollow twisted trunk + branch hierarchy + individual instanced needles',branches:primary.length,terminalAxes:tips.length,needles:needles?.count??0,axisGraphCount:axes.length,barkShells:bundle?.stats??null,barkAcceptance:false,barkMapping:{uv:'u=turns, v=local arc metres',growthV:'root-to-axis arc distance',junction:'branch collar blend weight; main trunk zero'},originalAuthorProjectAvailable:false},setBark(v){shells.visible=v;},update(t){if(needles)needles.rotation.y=Math.sin(t*.25)*.003;}};
}
export function createBarkStudy({params={}}={}){
 const root=new THREE.Group(),path=curve([[0,0,0],[.08,.7,.04],[-.08,1.6,.16],[.10,2.5,.22]]),geo=sweep(path,.40,{segments:100,sides:56,tip:.88,twist:.34,lobes:.07});geo.attributes.junction.array.fill(0);let bundle,base,shell;
 const api={root,info:{geometry:'single curved trunk + separate closed bark plates'},update(){},setBark(v){shell.visible=v;},rebuild(options={}){if(base){root.remove(base,shell);bundle.dispose();}bundle=createBarkBundle(THREE,geo,{seed:9,circumference:2.35,plateWidth:.085,plateLength:.40,thickness:.017,peel:.25,moss:.05,...options});base=new THREE.Mesh(geo,bundle.material);shell=new THREE.Mesh(bundle.shellGeometry,bundle.shellMaterial);base.castShadow=base.receiveShadow=shell.castShadow=shell.receiveShadow=true;root.add(base,shell);api.info.stats=bundle.stats;api.bundle=bundle;}};api.rebuild(params);return api;
}
