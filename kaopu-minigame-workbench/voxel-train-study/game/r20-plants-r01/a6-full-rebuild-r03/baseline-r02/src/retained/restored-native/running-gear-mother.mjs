import {applyWheelServiceDomain,applyRodServiceDomain} from './mechanism-appearance.mjs';
// New native assembly of the preserved, explicitly designed FH88 mechanism.
// No generic steam_train generator or teacher runtime assets are required.
import {createBrakeMother} from './brake-mother.mjs';
import {createBrakeRiggingMother} from './brake-rigging-mother.mjs';
import declaredDesign from './retained/native-a4/design.mjs';
import {A4_DIMENSIONS} from './retained/native-a4/dimensions.mjs';
import {contract,evaluate,nominalRollingContact} from './retained/native-a4/running-gear/kinematics.mjs';
import {createForgedRod,placeForgedRod,createCrosshead} from './retained/native-a4/running-gear/forged-rods.mjs';
import {createTreadBrake,createLaminatedSpring} from './retained/native-a4/running-gear/brakes.mjs';
import {createCorrectedNativeWheel} from './retained/native-a4/running-gear/cast-wheels.mjs';
export function createRunningGearMother(T,overrides={}){
 const design=structuredClone(declaredDesign),dimensions=A4_DIMENSIONS,datum=contract(design),R=datum.wheelRadiusM,firstDrivingDatumXM=0,train=new T.Group();train.name='88 dedicated designed running gear';
 const V=a=>new T.Vector3(...a),Y=new T.Vector3(0,1,0);
function material(color,metalness=.65){return new T.MeshStandardMaterial({color,metalness,roughness:.35});}
const geometryCache=new Map();const cached=(key,make)=>{if(!geometryCache.has(key))geometryCache.set(key,make());return geometryCache.get(key);};
function box(parent,size,at,mat,name){const o=new T.Mesh(cached('box:'+size,()=>new T.BoxGeometry(...size)),mat);o.name=name;o.position.set(...at);parent.add(o);return o;}
function cylinder(parent,r,h,at,mat,name){const o=new T.Mesh(cached(`cylinder:${r},${h}`,()=>new T.CylinderGeometry(r,r,h,24)),mat);o.name=name;o.position.set(...at);parent.add(o);return o;}
function bar(parent,r,a,b,mat,name){const o=cylinder(parent,r,V(a).distanceTo(V(b)),[0,0,0],mat,name);setBar(o,a,b);return o;}
function setBar(o,a,b){const A=V(a),B=V(b);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(Y,B.sub(A).normalize());o.userData.endpoints=[a.slice(),b.slice()];}

 function hubTemplate(radius){const root=new T.Group();root.name='self-owned scalar native hub';root.add(new T.Group(),new T.Group());const a=new T.Mesh(new T.CylinderGeometry(radius*.145,radius*.145,.23,32));a.rotation.z=Math.PI/2;root.add(a);const b=new T.Mesh(new T.CylinderGeometry(radius*.085,radius*.085,.036,32));b.rotation.z=Math.PI/2;b.position.x=.133;root.add(b);return root;}
 const specs=[[0,1.016,true],[-2.2098,1.016,true],[-4.4196,1.016,true],[1.6764,.4826,false],[3.5814,.4826,false],[-7.3152,.5588,false],[-14.976475,.635,false],[-13.376275,.635,false],[-11.699875,.635,false],[-10.099675,.635,false]];
 const axles=specs.map(([xM,radiusM,driver],i)=>({id:'axle-'+i,xM,radiusM,driver,sourceRadius:radiusM,sourceWheel:hubTemplate(radiusM)}));
 const wheelSpecs=axles.flatMap(a=>datum.nominalRollingCircleYM.map(yM=>({id:a.id+(yM<0?'-right':'-left'),axle:a.id,driver:a.driver,xM:a.xM,yM,radiusM:a.radiusM,halfWidthM:design.wheel.envelopeHalfWidthM})));
 const gear=new T.Group();gear.name='new SI running gear';train.add(gear);const steel=material('#aab7c2'),iron=material('#202c36'),crankMat=material('#c6a66a');
 const wheels=wheelSpecs.map(w=>{const axle=axles.find(a=>a.id===w.axle),g=createCorrectedNativeWheel(T,{sourceWheel:axle.sourceWheel,sourceRadius:axle.sourceRadius,radiusM:w.radiusM,side:Math.sign(w.yM),driver:w.driver,closedDisc:Number(w.axle.split('-')[1])>=6,spokes:w.driver?20:10,steel,cast:iron});gear.add(g);g.name=w.id;g.position.set(w.xM,w.yM,w.radiusM);return {...w,object:g};});
 for(const a of axles){if(a.id!=='axle-1')cylinder(gear,.08,Number(a.id.split('-')[1])>=6?2.28:1.49,[a.xM,0,a.radiusM],steel,a.id+' axle');else for(const side of[-1,1])cylinder(gear,.08,.50,[a.xM,side*.49,a.radiusM],steel,'middle driving axle stub');
  for(const side of[-1,1]){const isTender=Number(a.id.split('-')[1])>=6,y=side*(isTender?1.04:.57);box(gear,[.24,.20,.26],[a.xM,y,a.radiusM],iron,a.id+' axlebox');const isBogie=['axle-3','axle-4'].includes(a.id),isTrailing=a.id==='axle-5',leaves=isBogie?0:a.driver?16:isTrailing?11:8,maxLength=a.driver?1.2192:isTrailing?1.3716:.72,leafThickness=isTrailing?.0079375:.009525;
   if(isBogie){const points=Array.from({length:97},(_,i)=>{const t=i/96;return new T.Vector3(.0508*Math.cos(t*Math.PI*12),.0508*Math.sin(t*Math.PI*12),t*.254);});const spring=new T.Mesh(cached('bogie-helical-spring',()=>new T.TubeGeometry(new T.CatmullRomCurve3(points),96,.0127,8,false)),iron);spring.name='bogie helical spring 10in free, 5in outside';spring.position.set(a.xM,y,a.radiusM+.14);gear.add(spring);}
   for(let j=0;j<leaves;j++){const leaf=createLaminatedSpring(T,{lengthM:maxLength-j*.035,widthM:.127,thicknessM:leafThickness,steel:iron});leaf.position.set(a.xM,y,a.radiusM+.20+j*leafThickness);gear.add(leaf);}
   for(const dx of[-maxLength*.43,maxLength*.43])box(gear,[.035,.035,isTender?.35:.30],[a.xM+dx,y,a.radiusM+(isTender?.27:.25)],steel,a.id+' spring hanger');
  }
 }
 const brakeAssemblies=[];for(const a of axles.filter(a=>a.driver||Number(a.id.split('-')[1])>=6)){for(const side of[-1,1]){const brake=createBrakeMother(T,{radiusM:a.radiusM});brake.root.position.set(a.xM,side*design.wheel.referenceHalfSpacingM,a.radiusM);brake.root.userData.restXM=a.xM;gear.add(brake.root);brake.axleId=a.id;brake.side=side;brakeAssemblies.push(brake);}}
 const brakeRigging=createBrakeRiggingMother(T,{axles,brakes:brakeAssemblies});gear.add(brakeRigging.root);
 const mechanismMaterial=material('#aeb9bc'),bronze=material('#8e794c'),motions=[],couplers=[],pins=[],driveX=design.drivingAxleXM,guideX=driveX+design.rodPinCentresM;
 for(const c of design.cylinders){
  const main=createForgedRod(T,{lengthM:design.rodPinCentresM,bigBoreM:.06985+.0002,smallBoreM:.055+.0002,steel:mechanismMaterial,bush:bronze,name:c.id+' wide fluted connecting rod'});gear.add(main);
  const crossAssembly=createCrosshead(T,{steel:mechanismMaterial,bush:bronze,axisYM:c.axisYM,slideZM:R,guideCentreXM:guideX,strokeM:design.strokeM,name:c.id+' crosshead and twin slidebars'});gear.add(crossAssembly.root);const cross=crossAssembly.moving;
  const pin=cylinder(gear,.06985,.1524,[driveX,c.axisYM,R],steel,c.id+' outside main crank journal 5.5in x 6in');
  const outsideSign=Math.sign(c.axisYM)||1;const washer=cylinder(pin,.089,.016,[0,outsideSign*.084,0],steel,'main crankpin retaining washer');const nut=new T.Mesh(cached('main-crank-hexnut',()=>new T.CylinderGeometry(.042,.042,.035,6)),steel);nut.position.y=outsideSign*.11;nut.name='crankpin retaining nut';pin.add(nut);
  const casing=cylinder(gear,.254,.84,[guideX+1.02,c.axisYM,R],iron,c.id+' cylinder casing');casing.rotation.z=Math.PI/2;
  for(const x of[guideX+.59,guideX+1.45]){const cap=cylinder(gear,.260,.034,[x,c.axisYM,R],steel,c.id+' cylinder end cover');cap.rotation.z=Math.PI/2;}
  const pistonRod=bar(gear,.035,[guideX,c.axisYM,R],[guideX+1,c.axisYM,R],steel,c.id+' piston rod');motions.push({id:c.id,main,cross,pin,pistonRod,crossAssembly});
  if(c.id!=='inside'){const side=Math.sign(c.axisYM),couplingY=side*.951,da=axles.filter(a=>a.driver);
   for(const [i,a]of da.entries()){const radius=i===1?.0762:.0508,pinObject=cylinder(gear,radius,.17,[a.xM,couplingY,R],steel,c.id+' coupling journal '+a.id);pins.push({object:pinObject,axle:a,cylinder:c,yM:couplingY});}
   for(let j=1;j<da.length;j++){const A=da[j],B=da[j-1],isBigA=j===1;const rod=createForgedRod(T,{lengthM:B.xM-A.xM,bigRadiusM:isBigA?.165:.125,smallRadiusM:isBigA?.125:.165,bigBoreM:(isBigA?.0762:.0508)+.0002,smallBoreM:(isBigA?.0508:.0762)+.0002,shankBigM:.135,shankSmallM:.135,thicknessM:.064,webM:.022,steel:mechanismMaterial,bush:bronze,name:c.id+' articulated coupling rod '+j});gear.add(rod);couplers.push({object:rod,a:A,b:B,cylinder:c,yM:couplingY+side*(j===1?.04:-.04)});}
  }
 }
 // The centre crank is an explicit 88 horizontal-cylinder assembly. Historical
 // A4 inclined inside gear remains a separate unresolved engineering requirement.
 const insideCrank=new T.Group();insideCrank.name='88 centre crank webs on middle driven axle';insideCrank.position.set(driveX,0,R);gear.add(insideCrank);
 for(const y of[-.19,.19])box(insideCrank,[design.strokeM/2+.18,.065,.18],[design.strokeM/4,y,0],iron,'centre crank web');cylinder(insideCrank,.08,.38,[design.strokeM/2,0,0],steel,'centre crank journal');


 const syncWheels=()=>{};
 let currentBrakePressure=0;function setBrakePressure(value){const p=Math.max(0,Math.min(1,Number(value)||0));if(p===currentBrakePressure)return;currentBrakePressure=p;for(const b of brakeAssemblies)b.setApplication(p);brakeRigging.update();train.updateMatrixWorld(true);}
 let current=null,currentTime=0,currentState=null,currentPhaseOrigin=.25;const omega=-1.3,theta0=.25;
 const stateAt=t=>{if(!Number.isFinite(t))throw Error('FINITE_TIME_REQUIRED');return {worldTimeS:t,commonThetaRad:theta0+omega*t,omegaRadS:omega,alphaRadS2:0};};
 function applyState(st,travel,phaseOrigin=theta0){const next=evaluate(design,st,[0,0,0],[0,0,0]);currentTime=st.worldTimeS;currentState={...st};currentPhaseOrigin=phaseOrigin;current=next;train.position.x=travel;for(const w of wheels){const phase=w.driver?design.cylinders.find(c=>c.id===(w.yM<0?'right':'left')).crankPhaseRad:0;w.object.rotation.y=-(w.driver?st.commonThetaRad+phase:(st.commonThetaRad-phaseOrigin)*R/w.radiusM);}
  for(const m of motions){const c=current.cylinders.find(c=>c.id===m.id),A=c.crankPinWorldM,B=c.crossheadPinWorldM;placeForgedRod(T,m.main,A,B);m.cross.position.set(...B);m.pin.position.set(...A);setBar(m.pistonRod,B,[B[0]+1,B[1],B[2]]);}
  const crank=(a,c,y)=>[a.xM+design.strokeM/2*Math.cos(st.commonThetaRad+c.crankPhaseRad),y,R+design.strokeM/2*Math.sin(st.commonThetaRad+c.crankPhaseRad)];for(const p of pins)p.object.position.set(...crank(p.axle,p.cylinder,p.yM));for(const p of couplers)placeForgedRod(T,p.object,crank(p.a,p.cylinder,p.yM),crank(p.b,p.cylinder,p.yM));insideCrank.rotation.y=-(st.commonThetaRad+design.cylinders.find(c=>c.id==='inside').crankPhaseRad);train.updateMatrixWorld(true);syncWheels();return snapshot();
 }
 function setTime(t){const st=stateAt(t);return applyState(st,-R*(st.commonThetaRad-theta0));}
 function setPhysicsState(s){for(const key of ['timeS','positionM','speedMps','wheelAngleRad','wheelAngularSpeedRadS','wheelAngularAccelerationRadS2'])if(typeof s[key]!=='number'||!Number.isFinite(s[key]))throw Error('FINITE_PHYSICS_STATE_REQUIRED:'+key);const phaseOrigin=s.initialMechanicalThetaRad??theta0;if(typeof phaseOrigin!=='number'||!Number.isFinite(phaseOrigin))throw Error('FINITE_MECHANICAL_PHASE_ORIGIN_REQUIRED');if(s.wheelRadiusM!==undefined&&(typeof s.wheelRadiusM!=='number'||!Number.isFinite(s.wheelRadiusM)||Math.abs(s.wheelRadiusM-R)>1e-12))throw Error('PHYSICS_WHEEL_RADIUS_MISMATCH');const origin=s.rollingOriginPositionM??0;if(typeof origin!=='number'||!Number.isFinite(origin))throw Error('FINITE_ROLLING_ORIGIN_REQUIRED');if(Math.abs((s.positionM-origin)-R*s.wheelAngleRad)>1e-7||Math.abs(s.speedMps-R*s.wheelAngularSpeedRadS)>1e-7)throw Error('IDEAL_ROLLING_PHYSICS_STATE_INCONSISTENT');return applyState({worldTimeS:s.timeS,commonThetaRad:phaseOrigin-s.wheelAngleRad,omegaRadS:-s.wheelAngularSpeedRadS,alphaRadS2:-s.wheelAngularAccelerationRadS2},s.positionM,phaseOrigin);}
 const ends=o=>{const L=o.userData.pinCentresM;return [new T.Vector3(0,0,0).applyMatrix4(o.matrixWorld).toArray(),new T.Vector3(L,0,0).applyMatrix4(o.matrixWorld).toArray()];};
 function snapshot(){return {timeS:currentTime,state:{...currentState},bodyTravelM:train.position.x,wheels:wheels.map(w=>({id:w.id,radiusM:w.radiusM,rotationY:w.object.rotation.y,centreM:w.object.getWorldPosition(new T.Vector3()).toArray()})),mainRods:motions.map(m=>({id:m.id,lengthM:m.main.userData.pinCentresM,endpointsM:ends(m.main)})),nominalContact:nominalRollingContact(design,{bodySpeedMS:-R*currentState.omegaRadS,omegaRadS:currentState.omegaRadS,bodyXM:train.position.x}),sourceGeneratorCalled:false,forceOrContactDynamicsCertified:false};}

 for(const w of wheels)applyWheelServiceDomain(T,w.object,{radiusM:w.radiusM,side:Math.sign(w.yM)});for(const item of [...motions.map(m=>m.main),...couplers.map(c=>c.object)])applyRodServiceDomain(T,item,{lengthM:item.userData.pinCentresM,bigBoreM:item.userData.section.bigBoreM,smallBoreM:item.userData.section.smallBoreM});
 setTime(0);const parts=[];gear.traverse(o=>{if(o.isMesh)parts.push(o)});train.userData={mother:'new88-running-gear',sourceGeneratorCalled:false,sourceBuffersUsed:false,preservedDesignIdentity:design.identity,mechanismPhaseAuthority:'existing explicit three-cylinder solver and rolling invariants',tenderCoveredDiscRetainedPendingReview:true};
 return{root:train,train,gear,parts,wheels,axles,motions,couplers,brakeAssemblies,brakeRigging,parameters:design,dimensions,setTime,setPhysicsState,snapshot,setBrakePressure,ports:{frameAxes:axles.map(a=>({id:a.id,centre:[a.xM,0,a.radiusM]})),cylinderExhaustSockets:design.cylinders.map(c=>({id:c.id,position:[design.drivingAxleXM+design.rodPinCentresM+1.02,c.axisYM,R-.28],functionUnverified:true}))},coverageStatus:'preserved-new88-design-reassembled-no-body-generator-not-approved'};
}
