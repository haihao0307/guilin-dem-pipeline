import * as THREE from '../../vendor/three.module.js';
import {Blocks,PALETTE,letters} from './heritage.mjs';
import {createBodyMotion} from './body-motion.mjs';
import {TRACK,COACH_DIMENSIONS as D,COACH_FLOOR,PLATFORM_LAYOUT} from './metre-scale.mjs';

// New runtime-authored fictional green coaches, dimensioned from the separate
// BR116 body, underframe, buffer, roof and bogie references. No old shell stretch.
export const COACH_SEAT_ROWS=Object.freeze([-5.1,-1.7,1.7,5.1]);
export const COACH_SEAT_Z=.82;
export const COACH_BODY_MOTION_SPEC=Object.freeze({amplitude:Object.freeze({heave:.0012,lateral:.0002,rollDegrees:.018,pitchDegrees:.010}),pivotHeight:COACH_FLOOR,localHalfLength:D.bodyLength/2+.15});
export const COACH_STEPS=Object.freeze({landingZ:D.bodyAndStepsWidth/2-.62,middleZ:D.bodyAndStepsWidth/2-.48,outerZ:D.bodyAndStepsWidth/2-.17,middleDepth:.28,outerDepth:.34,middleTop:PLATFORM_LAYOUT.top+(COACH_FLOOR-PLATFORM_LAYOUT.top)*2/3,outerTop:PLATFORM_LAYOUT.top+(COACH_FLOOR-PLATFORM_LAYOUT.top)/3});
const material=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.77,metalness:.18});
function mesh(geometry,mat,name){const object=new THREE.Mesh(geometry,mat);object.name=name;object.castShadow=object.receiveShadow=true;return object;}
function objectsBoundsHint(length,width){return{length,width,units:'metres',measurementRequired:true};}

export function coachWheelGeometry(){
  const r=D.wheelRadius;
  // Positive wheel reference is +.7825. Its tread starts on the +.7175 inner
  // railhead face, while the flange is entirely inboard. Negative side mirrors.
  const section=[[0,-.115],[.15,-.115],[r-.065,-.105],[r+.026,-.100],[r+.026,-.078],[r,-.065],[r,.075],[r-.045,.090],[.18,.11],[.10,.12],[0,.12]];
  const g=new THREE.LatheGeometry(section.map(([r,z])=>new THREE.Vector2(r,z)),48);g.rotateX(Math.PI/2);
  const colors=[],p=g.attributes.position;for(let i=0;i<p.count;i++){const rr=Math.hypot(p.getX(i),p.getY(i)),col=new THREE.Color(rr>r-.015?0x9ba49d:rr<.16?0xaab0a3:0x43534f);colors.push(col.r,col.g,col.b);}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}

function barrelRoof(length,width,eaveY,crownY){
  const p=[],index=[],segments=20,half=width/2,thickness=.07;
  for(const x of [-length/2,length/2])for(const inner of [0,1])for(let j=0;j<=segments;j++){const z=-half+width*j/segments,y=eaveY+(crownY-eaveY)*Math.sqrt(Math.max(0,1-(z/half)**2))-inner*thickness;p.push(x,y,z);}
  const stride=segments+1,quad=(a,b,c,d)=>index.push(a,b,d,b,c,d);
  for(let j=0;j<segments;j++){quad(j,j+1,2*stride+j+1,2*stride+j);quad(stride+j,3*stride+j,3*stride+j+1,stride+j+1);quad(j,stride+j,stride+j+1,j+1);quad(2*stride+j,2*stride+j+1,3*stride+j+1,3*stride+j);}
  quad(0,2*stride,3*stride,stride);quad(segments,stride+segments,3*stride+segments,2*stride+segments);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();const c=new THREE.Color(PALETTE.steel),colors=[];for(let i=0;i<p.length/3;i++)colors.push(c.r,c.g,c.b);g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return g;
}

export function createFullSizeCoach(spec,index,{bodyMotion:motionOptions={}}={}){
  const root=new THREE.Group();root.name='Full-size fictional green passenger coach '+(index+1);
  const c=spec.x,halfBody=D.bodyLength/2,halfWidth=D.bodyAndStepsWidth/2,wallZ=halfWidth-.045,floor=COACH_FLOOR,seatTop=floor+D.seatHeight,roofCrown=TRACK.railHead+D.roofAboveRail,roofTop=TRACK.railHead+D.overallAboveRail,eaveY=floor+D.interiorHeight+.07;
  const shell=new Blocks(),deck=new Blocks(),fixed=new Blocks(),seats=new Blocks(),steps=new Blocks(),mat=material();
  const body=new THREE.Group(),contents=new THREE.Group(),pivot=new THREE.Vector3(c,floor,0),point=new THREE.Vector3();body.name='Passenger coach '+(index+1)+' subtle upper body';contents.name='Full-size floor doors glazing seats and roof';body.position.copy(pivot);contents.position.copy(pivot).multiplyScalar(-1);body.add(contents);root.add(body);
  const bodyMotion=createBodyMotion({...COACH_BODY_MOTION_SPEC.amplitude,enabled:motionOptions.enabled!==false,distanceOffset:c});
  function applyBodyPose(){const s=bodyMotion.state;body.position.set(pivot.x,pivot.y+s.heave,s.lateral);body.rotation.set(s.roll,0,s.pitch,'XYZ');body.updateMatrix();return s;}
  const updateBodyMotion=(view,dt=0)=>{bodyMotion.update(view,dt);return applyBodyPose();},resetBodyMotion=(view={})=>{bodyMotion.reset(view);return applyBodyPose();};
  const transformBodyPoint=(source,out=[])=>point.fromArray(source).sub(pivot).applyQuaternion(body.quaternion).add(body.position).toArray(out);

  const doorCenters=[spec.rearDoor,spec.frontDoor],doorHalf=D.doorWidth/2;
  const sideIntervals=[[c-halfBody,doorCenters[0]-doorHalf],[doorCenters[0]+doorHalf,doorCenters[1]-doorHalf],[doorCenters[1]+doorHalf,c+halfBody]];
  // True side stair wells: the main floor stops inboard of the top step at a
  // door, rather than hiding solid floor through the stairs.
  deck.box(c,floor-.035,0,D.bodyLength,.07,COACH_STEPS.landingZ*2,0x77745e);
  const stripWidth=halfWidth-COACH_STEPS.landingZ;
  for(const [a,b]of sideIntervals)for(const sign of [-1,1])deck.box((a+b)/2,floor-.035,sign*(COACH_STEPS.landingZ+stripWidth/2),b-a,.07,stripWidth,0x77745e);
  const windowBottom=floor+.84,windowTop=floor+1.73,windowCenters=[];
  for(let section=0;section<sideIntervals.length;section++){
    const [a,b]=sideIntervals[section],bays=section===1?8:1,pitch=(b-a)/bays;
    for(const sign of [-1,1]){
      shell.box((a+b)/2,(floor+windowBottom)/2,sign*wallZ,b-a,windowBottom-floor,.09,PALETTE.green);
      shell.box((a+b)/2,(windowTop+eaveY-.07)/2,sign*wallZ,b-a,eaveY-.07-windowTop,.09,PALETTE.greenLight);
      shell.box((a+b)/2,floor+.76,sign*(halfWidth-.012),b-a,.055,.024,PALETTE.orange);
      for(let j=0;j<=bays;j++){const x=a+j*pitch+(j===0?.0525:j===bays?-.0525:0);shell.box(x,(windowBottom+windowTop)/2,sign*wallZ,.105,windowTop-windowBottom,.09,PALETTE.greenLight);}
    }
    for(let j=0;j<bays;j++)windowCenters.push({x:a+(j+.5)*pitch,width:pitch-.105});
  }
  for(const x of doorCenters)for(const sign of [-1,1]){
    for(const side of [-1,1])shell.box(x+side*(doorHalf+.04),floor+D.doorHeight/2,sign*wallZ,.08,D.doorHeight,.09,PALETTE.greenLight);
    shell.box(x,floor+D.doorHeight+(eaveY-.07-floor-D.doorHeight)/2,sign*wallZ,D.doorWidth,eaveY-.07-floor-D.doorHeight,.09,PALETTE.greenLight);
    // These small handrails, not the roof or stepboards, define overall width.
    for(const side of [-1,1])shell.box(x+side*(doorHalf+.11),floor+1.05,sign*(D.width/2-.018),.035,.75,.036,0xb9b4a0);
    steps.box(x,COACH_STEPS.outerTop-.025,sign*COACH_STEPS.outerZ,D.doorWidth,.05,COACH_STEPS.outerDepth,0x888e7f);
    steps.box(x,COACH_STEPS.middleTop-.025,sign*COACH_STEPS.middleZ,D.doorWidth,.05,COACH_STEPS.middleDepth,0x727e6c);
  }
  // End walls are body-length geometry; underframe ends and buffers are separate.
  for(const sign of [-1,1]){
    const x=c+sign*(halfBody-.045);shell.box(x,floor+(eaveY-.07-floor)/2,0,.09,eaveY-.07-floor,D.bodyAndStepsWidth,PALETTE.green);
    shell.box(x+sign*.002,floor+1.4,0,.018,.55,.54,0x8fa49c);
  }
  letters(shell,'P'+(index+1),c-.22,floor+.60,halfWidth-.02,.065,0xe2e2c8);
  // Eight actual game seats, rebuilt at adult seat height with useful row gaps.
  const seatAnchors=[];
  for(const dx of COACH_SEAT_ROWS)for(const z of [-COACH_SEAT_Z,COACH_SEAT_Z]){
    const x=c+dx;seats.box(x,seatTop-.055,z,.62,.11,.66,0x797f52);seats.box(x-.325,seatTop+.39,z,.085,.78,.66,0x526052);seats.box(x,floor+.20,z,.37,.40,.34,0x343d38);seatAnchors.push([x,floor,z]);
  }
  const bodyMesh=mesh(shell.geometry(),mat,'Full-size coach shell, doorway jambs and handrails'),floorMesh=mesh(deck.geometry(),mat,'Coach floor with open side stair wells'),seatMesh=mesh(seats.geometry(),mat,'Eight adult-height interaction seats'),stepMesh=mesh(steps.geometry(),mat,'Inset boarding steps within body-and-stepboards width');contents.add(bodyMesh,floorMesh,seatMesh,stepMesh);
  const roofMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.19,transparent:true});
  const roofGeometry=barrelRoof(D.bodyLength,D.gutterWidth,eaveY,roofCrown);roofGeometry.translate(c,0,0);const roof=mesh(roofGeometry,roofMaterial,'Continuous dimensioned barrel roof');contents.add(roof);
  const vents=new Blocks();for(const dx of [-6,-2,2,6])vents.box(c+dx,(roofCrown+roofTop)/2,0,.36,roofTop-roofCrown,.42,PALETTE.greenDark);const ventMesh=mesh(vents.geometry(),roofMaterial,'Roof ventilators at verified overall height');contents.add(ventMesh);

  // New bogies: 14.1732 m pivot spacing and separately specified axle base.
  const wheelY=TRACK.railHead+D.wheelRadius,bogies=[c-D.bogieCenters/2,c+D.bogieCenters/2],axles=bogies.flatMap(x=>[x-D.bogieWheelbase/2,x+D.bogieWheelbase/2]);
  for(const z of [-.72,.72])fixed.box(c,floor-.19,z,D.underframeLength,.20,.16,PALETTE.greenDark);
  for(let x=c-D.underframeLength/2+.35;x<c+D.underframeLength/2;x+=1.5)fixed.box(x,floor-.30,0,.12,.10,2.44,0x35433c);
  for(const sign of [-1,1])fixed.box(c+sign*(D.underframeLength/2-.075),floor-.18,0,.15,.23,2.45,PALETTE.greenDark);
  for(const x of bogies){for(const sign of [-1,1]){fixed.box(x,wheelY+.10,sign*1.02,D.bogieWheelbase+.67,.28,.16,0x28332e);for(const dx of [-D.bogieWheelbase/2,D.bogieWheelbase/2]){fixed.box(x+dx,wheelY,sign*1.04,.34,.30,.22,0x25302c);for(let j=0;j<4;j++)fixed.box(x+dx,wheelY+.23+j*.045,sign*1.01,.70-j*.10,.035,.20,0x535c50);}}fixed.box(x,wheelY+.20,0,.50,.24,2.12,0x25352e);}
  const fixedMesh=mesh(fixed.geometry(),mat,'Dimensioned underframe and two BR1-size bogies');root.add(fixedMesh);
  const bufferGeometry=new THREE.CylinderGeometry(.185,.185,.085,24);bufferGeometry.rotateZ(Math.PI/2);const bufferHeads=new THREE.InstancedMesh(bufferGeometry,new THREE.MeshStandardMaterial({color:0x353b37,roughness:.63,metalness:.5}),4);bufferHeads.name='Four buffers defining over-buffer length';bufferHeads.castShadow=bufferHeads.receiveShadow=true;
  const shafts=new Blocks(),pose=new THREE.Object3D();let bi=0;for(const sign of [-1,1])for(const z of [-.55,.55]){pose.position.set(c+sign*(D.overBuffers/2-.0425),TRACK.railHead+1.05,z);pose.rotation.set(0,0,0);pose.scale.set(1,1,1);pose.updateMatrix();bufferHeads.setMatrixAt(bi++,pose.matrix);const min=D.underframeLength/2-.04,max=D.overBuffers/2-.085;shafts.box(c+sign*(min+max)/2,TRACK.railHead+1.05,z,max-min,.12,.12,0x555e55);}root.add(bufferHeads,mesh(shafts.geometry(),mat,'Buffer stems'));
  const wheels=axles.flatMap(x=>[-1,1].map(sign=>{const group=new THREE.Group();group.name='Full-size coach wheel';group.position.set(x,wheelY,sign*TRACK.wheelAxisZ);group.userData={radius:D.wheelRadius,sign};return group;}));
  const wheelBatch=new THREE.InstancedMesh(coachWheelGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.64,metalness:.40}),8);wheelBatch.name='Eight dimensioned coach wheels';wheelBatch.castShadow=wheelBatch.receiveShadow=true;wheelBatch.frustumCulled=false;root.add(wheelBatch);
  const markers=new THREE.InstancedMesh(new THREE.BoxGeometry(.048,D.wheelRadius*.38,.025),new THREE.MeshStandardMaterial({color:0xb5ad83,roughness:.7}),8);markers.name='Distance-driven wheel witness marks';root.add(markers);
  const padGeometry=new THREE.BoxGeometry(.13,.30,.14),brakeMaterial=new THREE.MeshStandardMaterial({color:0x614634,roughness:.8}),pads=new THREE.InstancedMesh(padGeometry,brakeMaterial,8);pads.name='Coach brake shoes';root.add(pads);
  const brakes=wheels.map(w=>({x:w.position.x+D.wheelRadius+.075,group:new THREE.Group(),pad:{geometry:padGeometry,material:brakeMaterial}})),offset=new THREE.Matrix4(),combined=new THREE.Matrix4();
  function updateHardware(distance=0,pressure=0){const angle=-distance/D.wheelRadius;for(let i=0;i<wheels.length;i++){const w=wheels[i];w.rotation.z=angle;pose.position.copy(w.position);pose.rotation.set(0,w.position.z<0?Math.PI:0,angle,'ZYX');pose.scale.set(1,1,1);pose.updateMatrix();wheelBatch.setMatrixAt(i,pose.matrix);offset.makeTranslation(0,D.wheelRadius*.5,.13);combined.multiplyMatrices(pose.matrix,offset);markers.setMatrixAt(i,combined);pose.rotation.set(0,0,0);pose.position.set(brakes[i].x-.045*pressure,wheelY,w.position.z);pose.updateMatrix();brakes[i].group.position.copy(pose.position);pads.setMatrixAt(i,pose.matrix);}for(const b of [wheelBatch,markers,pads])b.instanceMatrix.needsUpdate=true;}updateHardware();

  const glassMaterial=new THREE.MeshStandardMaterial({color:0x91b3ae,transparent:true,opacity:.22,roughness:.15,metalness:.12,depthWrite:false});
  const glazing=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,.013),glassMaterial,windowCenters.length*2);glazing.name='Twenty independently spaced window bays';let wi=0;
  for(const sign of [-1,1])for(const bay of windowCenters){pose.position.set(bay.x,(windowBottom+windowTop)/2,sign*(halfWidth-.045));pose.rotation.set(0,0,0);pose.scale.set(bay.width,windowTop-windowBottom,1);pose.updateMatrix();glazing.setMatrixAt(wi++,pose.matrix);}contents.add(glazing);
  const doors=[],glassLeaves=[],leafWidth=(D.doorWidth-.012)/2,leafCenter=(D.doorWidth+.012)/4,slideTravel=doorHalf+.06,doorMaterial=material();
  for(const x of [spec.frontDoor,spec.rearDoor])for(const sign of [-1,1]){const z=sign*(halfWidth-.042),leaves=[];for(const side of [-1,1]){
    const b=new Blocks();b.box(0,floor+.45,0,leafWidth,.90,.06,PALETTE.green);b.box(0,floor+D.doorHeight-.11,0,leafWidth,.22,.06,PALETTE.green);for(const edge of [-1,1])b.box(edge*(leafWidth/2-.021),floor+D.doorHeight/2,0,.042,D.doorHeight,.06,PALETTE.greenLight);b.box(-side*.13,floor+.94,sign*.039,.032,.16,.018,0xd6cc9d);
    const leaf=mesh(b.geometry(),doorMaterial,'Full-height sliding door leaf');leaf.position.set(x+side*leafCenter,0,z);contents.add(leaf);leaves.push({mesh:leaf,x:leaf.position.x,side});glassLeaves.push(leaf);
  }doors.push({x,z,leaves,active:sign>0,clearWidth:D.doorWidth,clearHeight:D.doorHeight,slideTravel});}
  const doorGlass=new THREE.InstancedMesh(new THREE.BoxGeometry(leafWidth-.084,.84,.012),glassMaterial,glassLeaves.length);doorGlass.name='Batched sliding-door glass';contents.add(doorGlass);
  function updateGlass(){for(let i=0;i<glassLeaves.length;i++){const leaf=glassLeaves[i];pose.position.set(leaf.position.x,floor+1.41,leaf.position.z);pose.rotation.set(0,0,0);pose.scale.set(1,1,1);pose.updateMatrix();doorGlass.setMatrixAt(i,pose.matrix);}doorGlass.instanceMatrix.needsUpdate=true;}updateGlass();
  function updateDoors(open=0){for(const d of doors)for(const leaf of d.leaves)leaf.mesh.position.x=leaf.x+leaf.side*(d.active?open*d.slideTravel:0);updateGlass();}
  const proof={original:true,fictional:true,prototypeClaim:'Original green coach using separate BR116 dimensional benchmarks; not a KCR replica',geometryMethod:'New procedural window bays, stair wells, roof, bogies and seat layout, no old-shell XYZ stretch',dimensions:D,dimensionStatus:D.status,body:objectsBoundsHint(D.bodyLength,D.bodyAndStepsWidth),underframeLength:D.underframeLength,overBuffers:D.overBuffers,windowsPerSide:windowCenters.length,seatCount:seatAnchors.length,seatSurfaceY:seatTop,floorY:floor,ceilingY:eaveY-.07,roofCrownY:roofCrown,highestAttachmentY:roofTop,doorClearance:[D.doorWidth,D.doorHeight],stepSurfaces:{...COACH_STEPS,outermostZ:halfWidth,platformEdgeZ:PLATFORM_LAYOUT.minZ,lateralGapToPlatform:PLATFORM_LAYOUT.minZ-halfWidth},bogies,axles,wheelRadius:D.wheelRadius,wheelAxisZ:TRACK.wheelAxisZ,railGauge:TRACK.gauge};
  root.userData.coachDimensions=proof;
  return{root,wheels,brakes,bodyMesh,fixedMesh,floorMesh,seatMesh,stepMesh,roof,ventMesh,bufferHeads,wheelBatch,glazing,doors,updateDoors,updateGlass,updateHardware,body,bodyMotion,updateBodyMotion,resetBodyMotion,transformBodyPoint,proof,seatAnchors};
}
