import * as THREE from '../vendor/three.module.js';
import {Blocks,buildTrain,bogie,letters,PALETTE} from './heritage.mjs';
import {COACHES} from './session.mjs';

export const WHEEL_RADIUS=.285,RAIL_HEAD=.3485;
const BOX_VERTICES=24,BOX_INDICES=36;
function rollingWheelGeometry(){
  // Axial section: the flange is on the rail's inner side; only the tread radius sets rolling height.
  const section=[[0,-.24],[.07,-.24],[.10,-.19],[.21,-.19],[.315,-.235],[.325,-.225],[.325,-.205],[.29,-.19],[WHEEL_RADIUS,-.175],[WHEEL_RADIUS,.075],[.26,.087],[.20,.08],[.17,.04],[.07,.07],[.065,.112],[0,.112]];
  const g=new THREE.LatheGeometry(section.map(([r,z])=>new THREE.Vector2(r,z)),24),colors=[];g.rotateX(Math.PI/2);
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const radius=Math.hypot(p.getX(i),p.getY(i)),z=p.getZ(i),color=new THREE.Color(radius>.3?0x646f6b:radius>.27&&z>-.2?0x9ba49d:radius<.1?0xaab0a3:0x43534f);colors.push(color.r,color.g,color.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}
function selectedGeometry(source,blocks,origin=[0,0,0]){
  const p=[],n=[],c=[],index=[],positions=source.attributes.position.array,normals=source.attributes.normal.array,colors=source.attributes.color.array,indices=source.index.array;
  for(const block of blocks){const start=block*BOX_VERTICES,base=p.length/3;for(let j=0;j<BOX_VERTICES;j++){const k=(start+j)*3;p.push(positions[k]-origin[0],positions[k+1]-origin[1],positions[k+2]-origin[2]);n.push(normals[k],normals[k+1],normals[k+2]);c.push(colors[k],colors[k+1],colors[k+2]);}for(let j=0;j<BOX_INDICES;j++)index.push(base+indices[block*BOX_INDICES+j]-start);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(index);g.computeBoundingBox();return g;
}
function centerOf(source,block){const values=source.attributes.position.array,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let j=0;j<24;j++)for(let k=0;k<3;k++){const v=values[(block*24+j)*3+k];min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);}return{center:min.map((v,i)=>(v+max[i])/2),size:min.map((v,i)=>max[i]-v)};}
function mesh(g,material){const m=new THREE.Mesh(g,material);m.castShadow=m.receiveShadow=true;return m;}
function simpleBox(w,h,d,color){return mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.66,metalness:.22}));}
function wheelCenters(bogies){return bogies.flatMap(x=>[-.55,.55].flatMap(dx=>[-.9,.9].map(z=>[x+dx,.48,z])));}
function drivetrain(builder,centers,{removeOldLamp=false}={}){
  const source=builder.geometry(),body=[],parts=centers.map(()=>[]),removed=[];
  for(let block=0;block<builder.count;block++){
    const {center:q,size}=centerOf(source,block);
    const wheel=centers.findIndex(w=>Math.abs(q[0]-w[0])<.43&&Math.abs(q[1]-w[1])<.43&&((Math.abs(q[2]-w[2])<.001&&Math.abs(size[2]-.15)<.001)||(Math.abs(q[2]-(w[2]+.09))<.001&&Math.abs(size[0]-.13)<.001&&Math.abs(size[1]-.13)<.001)));
    if(wheel>=0)parts[wheel].push(block);
    else if(removeOldLamp&&Math.abs(q[1]-2.69)<.001&&((Math.abs(q[0]-4.34)<.001&&Math.abs(size[0]-.23)<.001)||(Math.abs(q[0]-4.47)<.001&&Math.abs(size[0]-.026)<.001)))removed.push(block);
    else body.push(block);
  }
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.79,metalness:.14}),bodyMesh=mesh(selectedGeometry(source,body),material);root.add(bodyMesh);
  const wheels=centers.map((center,i)=>{const group=new THREE.Group();group.position.set(...center);const wheel=mesh(selectedGeometry(source,parts[i],center),material);group.add(wheel);const marker=simpleBox(.055,.21,.025,0xc3bb86);marker.position.set(0,.15,Math.sign(center[2])*.102);group.add(marker);root.add(group);return group;});
  const brakes=centers.map(center=>{const group=new THREE.Group();group.position.set(center[0]+.38,.61,center[2]);const pad=simpleBox(.13,.27,.18,0x613b29);group.add(pad);const arm=simpleBox(.065,.43,.075,0x78807a);arm.position.set(.09,.23,0);arm.rotation.z=-.4;group.add(arm);root.add(group);return{group,pad,x:center[0]+.38};});
  return{root,wheels,brakes,proof:{originalBlocks:builder.count,bodyBlocks:body.length,wheelBlocks:parts.map(p=>p.length),removedLampBlocks:removed.length},source};
}
function buildCoach(spec,index){
  const b=new Blocks(),p=PALETTE,c=spec.x,zWall=1.055;
  b.box(c,.94,0,6.35,.18,2.15,p.greenDark);b.box(c,1.015,0,6.1,.05,2.02,0x747457);
  const bogies=[c-1.94,c+1.94];for(const x of bogies)bogie(b,x,1.4);
  for(const z of [-zWall,zWall]){
    for(const [x,w]of [[c-3.00,.25],[c,3.94],[c+3.00,.25]]){b.box(x,1.48,z,w,.90,.11,p.green);b.box(x,2.85,z,w,.2,.11,p.greenLight);b.box(x,1.92,z,w,.065,.13,p.orange);}
    for(const dx of [-1.96,-.98,0,.98,1.96])b.box(c+dx,2.34,z,.072,.80,.11,p.greenLight);
    for(const door of [spec.frontDoor,spec.rearDoor]){for(const side of [-1,1])b.box(door+side*.43,2.0,z,.07,1.82,.13,p.greenLight);b.box(door,2.94,z,.9,.09,.14,p.greenLight);}
    letters(b,'P'+(index+1),c-.26,1.73,z+Math.sign(z)*.07,.067,0xe2e2c8);
  }
  for(const x of [c-3.14,c+3.14]){b.box(x,1.99,0,.12,1.92,2.1,p.green);b.box(x,2.47,0,.14,.68,.60,0x9bac9c);}
  for(const x of [-1.5,-.5,.5,1.5])for(const z of [-.62,.62]){b.box(c+x,1.24,z,.49,.14,.50,0x797f52);b.box(c+x-.24,1.50,z,.11,.45,.50,0x526052);b.box(c+x,1.15,z,.34,.20,.27,0x343d38);}
  for(const x of [spec.frontDoor,spec.rearDoor]){b.box(x,.86,1.28,.86,.12,.35,0x747b68);b.box(x,.75,1.60,.88,.12,.30,0x959781);b.box(x,.64,1.84,.91,.11,.22,0x727e6c);}
  const built=drivetrain(b,wheelCenters(bogies)),root=built.root;root.name='Passenger coach '+(index+1);
  const roofBlocks=new Blocks();for(let j=0;j<12;j++){const z=(j-5.5)*.19,height=3.02+.19*Math.sqrt(Math.max(0,1-(z/1.16)**2));roofBlocks.box(c,height,z,6.45,.11,.195,p.steel);}for(const x of [c-1.4,c+1.4])roofBlocks.box(x,3.28,0,.45,.09,.56,p.greenDark);
  const roofMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,metalness:.18,transparent:true}),roof=mesh(roofBlocks.geometry(),roofMaterial);root.add(roof);
  const glassMaterial=new THREE.MeshStandardMaterial({color:0x91b3ae,transparent:true,opacity:.22,roughness:.15,metalness:.12,depthWrite:false});
  for(const z of [-1.066,1.066])for(const dx of [-1.48,-.49,.49,1.48]){const pane=new THREE.Mesh(new THREE.BoxGeometry(.86,.70,.016),glassMaterial);pane.position.set(c+dx,2.35,z);root.add(pane);}
  const doors=[];
  for(const x of [spec.frontDoor,spec.rearDoor])for(const z of [-1.07,1.07]){
    const leaves=[];for(const side of [-1,1]){const block=new Blocks();block.box(0,1.46,0,.385,.84,.08,p.green);block.box(0,2.66,0,.385,.31,.08,p.green);block.box(side*.17,2.22,0,.044,.68,.09,p.greenLight);block.box(0,1.91,0,.385,.055,.1,p.orange);block.box(-side*.115,1.87,.058,.04,.15,.035,0xd6cc9d);const leaf=mesh(block.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:.12}));leaf.position.set(x+side*.205,0,z);const pane=new THREE.Mesh(new THREE.BoxGeometry(.31,.61,.013),glassMaterial);pane.position.set(0,2.27,0);leaf.add(pane);root.add(leaf);leaves.push({mesh:leaf,x:x+side*.205,side});}doors.push({x,z,leaves,active:z>0});}
  return{...built,roof,doors};
}
export function createGameTrain(){
  const root=new THREE.Group();root.name='Approved diesel and FUEL plus two passenger coaches';
  const inherited=drivetrain(buildTrain(),wheelCenters([-.62,3.35,-6.93,-2.83]),{removeOldLamp:true});root.add(inherited.root);
  const coaches=COACHES.map(buildCoach);for(const c of coaches)root.add(c.root);
  const couplers=new Blocks();for(const x of [-7.87,-14.55,-21.35])couplers.box(x,1.01,0,.65,.13,.21,0x353b37);root.add(mesh(couplers.geometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75})));
  const housing=new THREE.Group();housing.position.set(2.65,3.48,0);const pedestal=simpleBox(.24,.22,.31,0x253f3b);pedestal.position.y=-.16;housing.add(pedestal);housing.add(simpleBox(.36,.34,.56,PALETTE.greenDark));const lens=new THREE.Mesh(new THREE.BoxGeometry(.022,.23,.40),new THREE.MeshStandardMaterial({color:0xfff3c0,emissive:0xffdf86,emissiveIntensity:2.5,roughness:.22}));lens.position.x=.19;housing.add(lens);root.add(housing);
  const lamp=new THREE.SpotLight(0xffda88,190,34,Math.PI*.16,.78,1.3);lamp.position.set(2.88,3.5,0);lamp.target.position.set(24,.15,0);root.add(lamp,lamp.target);
  const wheels=[...inherited.wheels,...coaches.flatMap(c=>c.wheels)],brakes=[...inherited.brakes,...coaches.flatMap(c=>c.brakes)];
  for(const wheel of wheels)wheel.position.y=RAIL_HEAD+WHEEL_RADIUS;
  const wheelBatch=new THREE.InstancedMesh(rollingWheelGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.66,metalness:.35}),wheels.length),markerBatch=new THREE.InstancedMesh(wheels[0].children[1].geometry,wheels[0].children[1].material,wheels.length),padBatch=new THREE.InstancedMesh(brakes[0].pad.geometry,brakes[0].pad.material,brakes.length),armBatch=new THREE.InstancedMesh(brakes[0].group.children[1].geometry,brakes[0].group.children[1].material,brakes.length);for(const batch of [wheelBatch,markerBatch,padBatch,armBatch]){batch.castShadow=batch.receiveShadow=true;batch.frustumCulled=false;root.add(batch);}for(const wheel of wheels)wheel.parent.remove(wheel);for(const brake of brakes)brake.group.parent.remove(brake.group);const pose=new THREE.Object3D(),offset=new THREE.Matrix4(),combined=new THREE.Matrix4();
  function updateHardware(distance,pressure){const angle=-distance/WHEEL_RADIUS;for(let i=0;i<wheels.length;i++){const w=wheels[i];w.rotation.z=angle;pose.position.copy(w.position);pose.rotation.set(0,w.position.z<0?Math.PI:0,angle,'ZYX');pose.scale.set(1,1,1);pose.updateMatrix();wheelBatch.setMatrixAt(i,pose.matrix);offset.makeTranslation(0,.15,.119);combined.multiplyMatrices(pose.matrix,offset);markerBatch.setMatrixAt(i,combined);}for(let i=0;i<brakes.length;i++){const b=brakes[i];b.group.position.x=b.x-.055*pressure;pose.position.copy(b.group.position);pose.rotation.set(0,0,0);pose.updateMatrix();padBatch.setMatrixAt(i,pose.matrix);pose.position.x+=.09;pose.position.y+=.23;pose.rotation.z=-.4;pose.updateMatrix();armBatch.setMatrixAt(i,pose.matrix);}padBatch.material.emissive.setHex(pressure>.5?0x1b0800:0x000000);for(const batch of [wheelBatch,markerBatch,padBatch,armBatch])batch.instanceMatrix.needsUpdate=true;}
  updateHardware(0,0);
  return{root,coaches,wheels,brakes,proof:{existingVehicles:2,addedCoaches:2,wheels:wheels.length,wheelRadius:WHEEL_RADIUS,railHead:RAIL_HEAD,wheelProfile:'24-sided steel tread, inboard flange and metal hub',inherited:inherited.proof},update(view,{interior=false}={}){const pressure=view.brake?1:['doors-opening','unloading','boarding','ready-depart','doors-closing'].includes(view.phase)?.75:view.throttle<0?-.3*view.throttle:0;updateHardware(view.distance,pressure);for(const c of coaches){for(const door of c.doors)for(const leaf of door.leaves)leaf.mesh.position.x=leaf.x+leaf.side*(door.active?view.door*.44:0);c.roof.material.opacity=interior?.22:1;c.roof.material.depthWrite=!interior;c.roof.castShadow=!interior;}}};
}
