// Existing self-owned driver geometry and head animation, extracted without
// generating a locomotive. Original stature retained; rigid cab mount only.
import {CREW_SPEC,driverCrewPose} from './retained/crew-state.mjs';
import {STEAM_AUTHORING,steamCrewMap} from './retained/steam-scale.mjs';
export function createCrewMother(THREE,{anchor=[-7.33,.40,1.85],driverHeightM=STEAM_AUTHORING.driverHeightM}={}){
 const Y=new THREE.Vector3(0,1,0),unitBox=new THREE.BoxGeometry(1,1,1),unitCylinder=new THREE.CylinderGeometry(1,1,1,12);
class GeometryBatch{
  constructor(map=null,tag='detail'){this.p=[];this.n=[];this.c=[];this.parts=0;this.map=map;this.tag=tag;this.ranges=[];}
  add(source,color,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]){
    const geometry=source.index?source.toNonIndexed():source;
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),point=new THREE.Vector3(),normal=new THREE.Vector3(),col=new THREE.Color(color),p=geometry.attributes.position,n=geometry.attributes.normal;
    const start=this.p.length/3;
    for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();if(this.map){const original=point.toArray();normal.fromArray(this.map.normal(original,normal.toArray())).normalize();point.fromArray(this.map(original));}this.p.push(point.x,point.y,point.z);this.n.push(normal.x,normal.y,normal.z);this.c.push(col.r,col.g,col.b);}
    this.ranges.push({tag:this.tag,start,count:p.count,sourcePosition:position.slice(),sourceScale:scale.slice()});if(geometry!==source)geometry.dispose();this.parts++;
  }
  box(x,y,z,w,h,d,color,rotation=[0,0,0]){this.add(unitBox,color,[x,y,z],rotation,[w,h,d]);}
  cylinder(x,y,z,r,length,color,axis='y',segments=16,rTop=r){const g=new THREE.CylinderGeometry(rTop,r,length,segments);this.add(g,color,[x,y,z],axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0]);g.dispose();}
  torus(x,y,z,r,tube,color,axis='x',arc=Math.PI*2){const g=new THREE.TorusGeometry(r,tube,5,36,arc);this.add(g,color,[x,y,z],axis==='x'?[0,Math.PI/2,0]:axis==='y'?[Math.PI/2,0,0]:[0,0,0]);g.dispose();}
  sphere(x,y,z,r,color,scale=[1,1,1],detail=0){const g=new THREE.IcosahedronGeometry(r,detail);this.add(g,color,[x,y,z],[0,0,0],scale);g.dispose();}
  pipe(points,r,color){for(let i=1;i<points.length;i++){const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),delta=b.clone().sub(a),matrix=new THREE.Matrix4().compose(a.add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(Y,delta.clone().normalize()),new THREE.Vector3(r,delta.length(),r));const g=unitCylinder.clone().applyMatrix4(matrix);this.add(g,color);g.dispose();}}
  geometry(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.computeBoundingSphere();g.userData.partRanges=this.ranges;return g;}
  mesh(material,name){const m=new THREE.Mesh(this.geometry(),material);m.castShadow=m.receiveShadow=true;m.name=name;return m;}
}
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.73,metalness:.40}),driver=new GeometryBatch(steamCrewMap(driverHeightM),'driver-body');let b=driver;
  // Original placeholder driver in the open right-side cab window. No final character asset is implied.
  b.box(-1.74,2.20,.61,.29,.38,.28,0x263d48);b.box(-1.74,2.45,.67,.37,.39,.29,0x40545d);
  for(const x of [-1.84,-1.64]){b.box(x,1.85,.59,.12,.36,.13,0x2b363e);b.box(x,1.64,.65,.14,.09,.24,0x242b2b);}
  b.box(-1.74,2.67,.72,.14,.12,.15,0xc79572);const headBatch=new GeometryBatch(steamCrewMap(driverHeightM),'driver-head');headBatch.box(-1.74,2.82,.78,.28,.28,.26,0xd6ab83);
  headBatch.box(-1.74,2.91,.66,.29,.14,.09,0x5e554c);headBatch.box(-1.74,2.82,.93,.072,.06,.052,0xc79572);
  for(const x of [-1.81,-1.67]){headBatch.box(x,2.86,.916,.033,.033,.015,0x292c28);headBatch.box(x,2.89,.919,.055,.018,.015,0x70675b);}
  headBatch.box(-1.74,2.74,.921,.13,.018,.018,0x7e6450);
  headBatch.box(-1.74,2.985,.78,.39,.052,.36,0x172a34);headBatch.box(-1.74,3.035,.76,.33,.07,.30,0x314451);headBatch.box(-1.74,2.963,.93,.36,.035,.16,0x182832);headBatch.box(-1.74,3.005,.936,.047,.045,.014,0xc9b57a);
  for(const x of [-1.95,-1.53]){b.box(x,2.47,.75,.12,.31,.13,0x40545d);b.box(x,2.34,.91,.12,.1,.32,0x40545d);b.box(x,2.34,1.085,.12,.095,.12,0xd6ab83);}

 const root=new THREE.Group();root.name='88 rigid cab-attached preserved driver';root.position.set(...anchor);const oriented=new THREE.Group();oriented.rotation.x=Math.PI/2;root.add(oriented);
 const foot=steamCrewMap(driverHeightM)([-1.74,1.595,.65]);const body=driver.mesh(material,'Preserved adult driver body');body.geometry.translate(...foot.map(v=>-v));oriented.add(body);
 const calibratedHead=steamCrewMap(driverHeightM)(CREW_SPEC.driverHead),hg=headBatch.geometry();hg.translate(...calibratedHead.map(v=>-v));const head=new THREE.Mesh(hg,material);head.name='Preserved driver head and cap';head.position.fromArray(calibratedHead.map((v,i)=>v-foot[i]));oriented.add(head);
 const crew={driverHead:head,pose:driverCrewPose({velocity:0,station:{remaining:0}})};function update(view){Object.assign(crew.pose,driverCrewPose(view));head.rotation.y=crew.pose.yaw;return crew.pose;}
 root.userData={mother:'crew-cab-installation',retainedStatureM:driverHeightM,scaledToHideCollision:false,rigidAnchor:anchor.slice(),sourceGeometry:'Exact existing driver boxes and original uniform human-height calibration',cabParentRequired:true};root.updateMatrixWorld(true);return {root,parts:[body,head],body,head,crew,update,anchor:anchor.slice(),footSource:foot,coverageStatus:'rigid-crew-candidate-requires-swept-clearance'};
}
