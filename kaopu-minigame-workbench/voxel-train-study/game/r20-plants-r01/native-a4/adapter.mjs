import {batchStaticDisplay} from './display-batching.mjs';
/* FH88 original metric adapter. No teacher buffers; frozen generator is called once. */
import * as T from './frozen/learned-shape/vendor/three.module.mjs';
import {generate} from './frozen/learned-shape/derived/train-shape-only.mjs';
import {contract,evaluate,nominalRollingContact} from './running-gear/kinematics.mjs';
import {createForgedRod,placeForgedRod,createCrosshead} from './running-gear/forged-rods.mjs';
import {createTreadBrake,createLaminatedSpring} from './running-gear/brakes.mjs';
import {createCorrectedNativeWheel} from './running-gear/cast-wheels.mjs';
const V=a=>new T.Vector3(...a);
const Y=new T.Vector3(0,1,0);
const distanceSegment2=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],n=dx*dx+dz*dz,t=n?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/n)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
function clipY(poly,level,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=sign*(a[1]-level),db=sign*(b[1]-level);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;}
function radialDistance(poly,x,z){if(!poly.length)return Infinity;const ps=poly.map(a=>[a[0],a[2]]),p=[x,z];let pos=false,neg=false,area=0,d=Infinity;for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],c=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);pos||=c>1e-12;neg||=c<-1e-12;area+=a[0]*b[1]-a[1]*b[0];d=Math.min(d,distanceSegment2(p,a,b));}return Math.abs(area)>1e-16&&!(pos&&neg)?0:d;}
function trianglesOf(root){const out=[],p=new T.Vector3(),im=new T.Matrix4(),wm=new T.Matrix4();root.updateMatrixWorld(true);root.traverse(n=>{if(!n.isMesh)return;const g=n.geometry,a=g.getAttribute('position'),idx=g.index,N=idx?idx.count:a.count;for(let inst=0;inst<(n.isInstancedMesh?n.count:1);inst++){wm.copy(n.matrixWorld);if(n.isInstancedMesh){n.getMatrixAt(inst,im);wm.multiply(im);}for(let i=0;i<N;i+=3){const tri=[];for(let j=0;j<3;j++){p.fromBufferAttribute(a,idx?idx.getX(i+j):i+j).applyMatrix4(wm);tri.push(p.toArray());}out.push({points:tri,part:n.parent?.name||n.name});}}});return out;}
/** Conservative swept-wheel envelope, radially and axially expanded by margin.
 * Triangle intersection, not a watertight-volume or whole-train collision certificate. */
export function wheelBodyIntersections(triangles,wheels,margin=0,lift=0){let count=0;const examples=[];for(const tri of triangles){for(const w of wheels){const rr=w.radiusM+margin,hh=w.halfWidthM+margin,ps=tri.points;if(ps.every(p=>p[0]<w.xM-rr)||ps.every(p=>p[0]>w.xM+rr)||ps.every(p=>p[2]+lift<w.radiusM-rr)||ps.every(p=>p[2]+lift>w.radiusM+rr)||ps.every(p=>p[1]<w.yM-hh)||ps.every(p=>p[1]>w.yM+hh))continue;let q=clipY(ps,w.yM-hh,1);q=clipY(q,w.yM+hh,-1);if(radialDistance(q,w.xM,w.radiusM-lift)<=rr+1e-12){count++;if(examples.length<8)examples.push({wheel:w.id,bodyPart:tri.part});}}}return {count,examples};}
function material(color,metalness=.65){return new T.MeshStandardMaterial({color,metalness,roughness:.35});}
const geometryCache=new Map();const cached=(key,make)=>{if(!geometryCache.has(key))geometryCache.set(key,make());return geometryCache.get(key);};
function box(parent,size,at,mat,name){const o=new T.Mesh(cached('box:'+size,()=>new T.BoxGeometry(...size)),mat);o.name=name;o.position.set(...at);parent.add(o);return o;}
function cylinder(parent,r,h,at,mat,name){const o=new T.Mesh(cached(`cylinder:${r},${h}`,()=>new T.CylinderGeometry(r,r,h,24)),mat);o.name=name;o.position.set(...at);parent.add(o);return o;}
function bar(parent,r,a,b,mat,name){const o=cylinder(parent,r,V(a).distanceTo(V(b)),[0,0,0],mat,name);setBar(o,a,b);return o;}
function setBar(o,a,b){const A=V(a),B=V(b);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(Y,B.sub(A).normalize());o.userData.endpoints=[a.slice(),b.slice()];}

export function buildPreview(recipe,design,dimensions){
 const datum=contract(design),R=datum.wheelRadiusM,source=structuredClone(recipe),sourceDriverR=source.parameters.driverRadius,scale=R/sourceDriverR;
 if(datum.railTopZM!==0)throw Error('PREVIEW_R03_REQUIRES_RAIL_TOP_ZERO');
 source.identity={id:'fh88/native-game-a4',name:'88 / existing A4 function train'};source.parameters.number=88;source.parameters.boilerY=2.9;source.parameters.spokes=20;
 const old=generate(source);old.parts.find(g=>g.name==='函数蒸汽')?.removeFromParent();old.root.updateMatrixWorld(true);
 const sourceBounds=new T.Box3().setFromObject(old.root),sourceSize=sourceBounds.getSize(new T.Vector3());
 const lengthScale=dimensions.overBuffersM/sourceSize.z,widthScale=dimensions.widthM/sourceSize.x,heightScale=dimensions.heightM/(sourceBounds.max.y-.08);
 const cabPart=old.parts.find(g=>g.name==='驾驶室 / 窗框 / 炉门'),cabTop=new T.Box3().setFromObject(cabPart).max.y,cabHeightFactor=(dimensions.heightM+.08*heightScale)/(cabTop*heightScale);cabPart.scale.y=cabHeightFactor;
 for(const g of old.parts.filter(g=>g.name==='函数编号 88'))g.removeFromParent();
 // Retain and refit the existing smokebox components inside the A4 tapered shell.
 const boilerPart=old.parts.find(g=>g.name==='锅炉、烟箱与主承载走台');
 for(const mesh of boilerPart.children){const gp=mesh.geometry?.parameters;if(mesh.geometry?.type==='LatheGeometry'&&Math.abs(gp.points.at(-2).y-gp.points[0].y-1.5)<1e-8){mesh.geometry=mesh.geometry.clone().scale(.50,1,.50);}}
 const door=old.parts.find(g=>g.name==='烟箱门、铰链与锁紧');door.scale.setScalar(.46);door.position.z=5.11;
 const chimney=old.parts.find(g=>g.name==='烟囱与蒸汽出口');chimney.scale.y=.60;
 const lensMaterial=new T.MeshStandardMaterial({color:0xffdc98,emissive:0xffbb55,emissiveIntensity:1.4,roughness:.2,metalness:.15});
 const lens=new T.Mesh(new T.CircleGeometry(.29,48),lensMaterial);lens.name='88 integral front headlamp';lens.position.set(0,source.parameters.boilerY,5.17);old.root.add(lens);
 old.materials.paint.metalness=.48;old.materials.paint.roughness=.27;
 const wheelSources=new Map();
 const sourceAxles=old.parts.filter(g=>g.name==='动轮轴总成'||g.name==='承载轮轴总成').map(g=>{const p=g.getWorldPosition(new T.Vector3());const w=g.children.find(n=>n.name==='轮圈 / 轮毂 / 辐条');if(!w)throw Error('NATIVE_WHEEL_MISSING');wheelSources.set(g,w);return {g,driver:g.name==='动轮轴总成',z:p.z,r:p.y-.08};});
 const first=sourceAxles.find(a=>a.driver).z;
 const tenderFloorSourceY=(2*.635+.06)/heightScale+.08,tenderTopSourceY=2.775;
 old.root.traverse(o=>{const p=o.geometry?.parameters;if(o.parent?.name!=='煤水车 / 水箱 / 悬挂')return;if(p?.width===2.2&&p?.height===.24)o.position.y=tenderFloorSourceY+.12;if(p?.width===2.2&&p?.height===1.75){const h=tenderTopSourceY-tenderFloorSourceY;o.geometry=o.geometry.clone().scale(1,h/1.75,1);o.position.y=(tenderTopSourceY+tenderFloorSourceY)/2;}});
 // Gauge conversion moves only longitudinal frame rails inward and running boards outward, leaving exterior functions intact.
 old.root.traverse(o=>{const p=o.geometry?.parameters;if(!p||o.parent?.name!=='锅炉、烟箱与主承载走台')return;if(p.width===.13&&p.height===.28)o.position.x=Math.sign(o.position.x)*.54;if(p.width===.38&&p.height===.07)o.position.x=Math.sign(o.position.x)*1.075;});
 for(const g of old.parts.filter(g=>g.name==='函数编号 88'&&g.parent?.name==='煤水车 / 水箱 / 悬挂'))g.removeFromParent();
 const strip=old.parts.filter(g=>g.name==='轮轴、联动、制动与轴箱'||g.name==='承载轮轴总成'||g.name==='函数蒸汽');for(const g of strip)g.removeFromParent();
 const tenderPart=old.parts.find(g=>g.name==='煤水车 / 水箱 / 悬挂'),jointPart=old.parts.find(g=>g.name==='车钩固定连接');
 old.root.updateMatrixWorld(true);const tenderSourceBounds=new T.Box3().setFromObject(tenderPart),cabRearSourceZ=new T.Box3().setFromObject(cabPart).min.z,sourceFrontZ=sourceBounds.max.z;
 const divisionGameX=-8.41755,targetSourceDivision=sourceFrontZ+(divisionGameX-5)/lengthScale;
 const locoLongitudinalFactor=(sourceFrontZ-targetSourceDivision)/(sourceFrontZ-cabRearSourceZ),tenderLongitudinalFactor=((divisionGameX-(5-dimensions.overBuffersM))/lengthScale)/(tenderSourceBounds.max.z-tenderSourceBounds.min.z);
 const locoMap=z=>sourceFrontZ+(z-sourceFrontZ)*locoLongitudinalFactor,tenderMap=z=>sourceBounds.min.z+(z-tenderSourceBounds.min.z)*tenderLongitudinalFactor;
 const locoRemount=new T.Group();locoRemount.name='locomotive envelope to 1935 rear boundary';for(const child of [...old.root.children])if(child!==tenderPart&&child!==jointPart)locoRemount.add(child);old.root.add(locoRemount);locoRemount.scale.z=locoLongitudinalFactor;locoRemount.position.z=sourceFrontZ*(1-locoLongitudinalFactor);
 tenderPart.position.z=tenderMap(tenderPart.position.z);tenderPart.scale.z=tenderLongitudinalFactor;if(jointPart)jointPart.removeFromParent();
 const mapSourcePoint=point=>[point[0],point[1],point[2]<cabRearSourceZ?tenderMap(point[2]):locoMap(point[2])];
 const train=new T.Group();train.name='FH88 metric moving frame';const body=old.root;body.name='frozen learned exterior, rigidly remounted';
 body.quaternion.setFromRotationMatrix(new T.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1));body.scale.set(widthScale,heightScale,lengthScale);body.position.set(-first*lengthScale,0,-.08*heightScale);train.add(body);
 body.updateMatrixWorld(true);const firstDrivingDatumXM=new T.Box3().setFromObject(body).max.x-4.826;design={...design,drivingAxleXM:firstDrivingDatumXM-2.2098};
 const wheelSpecs=[],axles=sourceAxles.map((a,i)=>({id:'axle-'+i,driver:a.driver,xM:(a.z-first)*lengthScale,radiusM:a.r*scale,sourceWheel:wheelSources.get(a.g),sourceRadius:a.r}));
 // A4 axial stations from the LNER-supplied 1935 drawing. Body and wheel circles retain separate metric mappings.
 const knownStations=[0,-2.2098,-4.4196,1.6764,3.5814,-7.3152];
 axles.slice(0,6).forEach((a,i)=>a.xM=firstDrivingDatumXM+knownStations[i]);
 axles[3].radiusM=axles[4].radiusM=.4826;axles[5].radiusM=.5588;
 const tenderAxles=axles.slice(6),tenderFrontXM=firstDrivingDatumXM-7.3152-2.784475;
 tenderAxles.forEach((a,i)=>{a.xM=tenderFrontXM+[-4.8768,-3.2766,-1.6002,0][i];a.radiusM=.635;});
 for(const a of axles)for(const y of datum.nominalRollingCircleYM)wheelSpecs.push({id:a.id+(y<0?'-right':'-left'),axle:a.id,driver:a.driver,xM:a.xM,yM:y,radiusM:a.radiusM,halfWidthM:design.wheel.envelopeHalfWidthM});
 let bodyTriangles=trianglesOf(body);const initialIntersection=wheelBodyIntersections(bodyTriangles,wheelSpecs,0,0),margin=.02;
 // The retained A4 skin closes underneath the boiler. Author wheel apertures in that same procedural skin, rather than lifting the entire locomotive or replacing its wheels.
 let apertureTriangles=0;body.traverse(n=>{if(!n.isMesh||n.parent?.name!=='函数流线罩壳'||n.geometry.type!=='ParametricGeometry')return;
 const g=n.geometry.clone(),a=g.attributes.position,idx=g.index,indices=[];
 for(let i=0;i<idx.count;i+=3){const ids=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)],points=ids.map(j=>new T.Vector3().fromBufferAttribute(a,j).applyMatrix4(n.matrixWorld).toArray());
 if(wheelBodyIntersections([{points,part:'A4 skin'}],wheelSpecs,margin).count)apertureTriangles++;else indices.push(...ids);}
 g.setIndex(indices);g.computeVertexNormals();n.geometry=g;});bodyTriangles=trianglesOf(body);
 // Body stays on its calibrated height; gauge-aware frame placement and skin apertures supply clearance.
 let lift=0;
 body.updateMatrixWorld(true);const bodyBounds=new T.Box3().setFromObject(body);
 const clearance={apertureTriangles,method:'triangle surfaces against axisymmetric wheel envelope inflated radially and axially by 20 mm',initialIntersection,bodyRigidLiftM:lift,marginM:margin,finalIntersection:wheelBodyIntersections(bodyTriangles,wheelSpecs,margin,lift),retainedBodyHighestPointM:bodyBounds.max.z,centreOfMassM:null,centreOfMassAndSuspensionConsequencesUnresolved:true,solidContainmentOrWholeTrainCollisionCertified:false};
 const gear=new T.Group();gear.name='new SI running gear';train.add(gear);const steel=material('#aab7c2'),iron=material('#202c36'),crankMat=material('#c6a66a');
 const wheels=wheelSpecs.map(w=>{const axle=axles.find(a=>a.id===w.axle),g=createCorrectedNativeWheel(T,{sourceWheel:axle.sourceWheel,sourceRadius:axle.sourceRadius,radiusM:w.radiusM,side:Math.sign(w.yM),driver:w.driver,spokes:w.driver?20:10,steel,cast:iron});gear.add(g);g.name=w.id;g.position.set(w.xM,w.yM,w.radiusM);return {...w,object:g};});
 for(const a of axles){if(a.id!=='axle-1')cylinder(gear,.08,1.49,[a.xM,0,a.radiusM],steel,a.id+' axle');else for(const side of[-1,1])cylinder(gear,.08,.50,[a.xM,side*.49,a.radiusM],steel,'middle driving axle stub');
  for(const side of[-1,1]){const y=side*.57;box(gear,[.24,.20,.26],[a.xM,y,a.radiusM],iron,a.id+' axlebox');const leaves=a.driver?16:8,maxLength=a.driver?1.2192:.72;
   for(let j=0;j<leaves;j++){const leaf=createLaminatedSpring(T,{lengthM:maxLength-j*.035,widthM:.127,thicknessM:.009525,steel:iron});leaf.position.set(a.xM,y,a.radiusM+.20+j*.009525);gear.add(leaf);}
   for(const dx of[-maxLength*.43,maxLength*.43])box(gear,[.035,.035,.30],[a.xM+dx,y,a.radiusM+.25],steel,a.id+' spring hanger');
  }
 }
 const brakeAssemblies=[];for(const a of axles.filter(a=>a.driver||Number(a.id.split('-')[1])>=6)){for(const side of[-1,1]){const brake=createTreadBrake(T,{radiusM:a.radiusM,steel,iron});brake.position.set(a.xM,side*design.wheel.referenceHalfSpacingM,a.radiusM);gear.add(brake);brakeAssemblies.push(brake);}cylinder(gear,.030,1.50,[a.xM+a.radiusM+.079,0,a.radiusM*.55],steel,a.id+' brake transverse shaft');}
 const rearBufferX=firstDrivingDatumXM+4.826-dimensions.overBuffersM;box(gear,[.18,2.16,.22],[rearBufferX+.14,0,1.05],iron,'tender rear buffer beam at coupling datum');for(const y of[-.52,.52])box(gear,[.16,.11,.34],[rearBufferX+.14,y,1.23],steel,'rear beam to underframe hanger');box(gear,[.30,.25,.24],[rearBufferX+.10,0,1.03],steel,'tender drawhook mounting bracket');
 const mechanismMaterial=material('#aeb9bc'),bronze=material('#8e794c'),motions=[],couplers=[],pins=[],driveX=design.drivingAxleXM,guideX=driveX+design.rodPinCentresM;
 for(const c of design.cylinders){
  const main=createForgedRod(T,{lengthM:design.rodPinCentresM,bigBoreM:.06985+.0002,smallBoreM:.055+.0002,steel:mechanismMaterial,bush:bronze,name:c.id+' wide fluted connecting rod'});gear.add(main);
  const crossAssembly=createCrosshead(T,{steel:mechanismMaterial,bush:bronze,axisYM:c.axisYM,slideZM:R,guideCentreXM:guideX,strokeM:design.strokeM,name:c.id+' crosshead and twin slidebars'});gear.add(crossAssembly.root);const cross=crossAssembly.moving;
  const pin=cylinder(gear,.06985,.1524,[driveX,c.axisYM,R],steel,c.id+' outside main crank journal 5.5in x 6in');
  const casing=cylinder(gear,.280,.84,[guideX+1.02,c.axisYM,R],iron,c.id+' cylinder casing');casing.rotation.z=Math.PI/2;
  for(const x of[guideX+.59,guideX+1.45]){const cap=cylinder(gear,.287,.034,[x,c.axisYM,R],steel,c.id+' cylinder end cover');cap.rotation.z=Math.PI/2;}
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

 // Batch the preserved wheel meshes by their actual shared geometry/material. Source objects remain the motion authority.
 const batchGroups=new Map(),wheelBatches=[];
 gear.traverse(o=>{if(!o.isMesh)return;const key=o.geometry.uuid+':'+o.material.uuid;if(!batchGroups.has(key))batchGroups.set(key,[]);batchGroups.get(key).push(o);});
 for(const sources of batchGroups.values()){const mesh=new T.InstancedMesh(sources[0].geometry,sources[0].material,sources.length);mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;gear.add(mesh);for(const o of sources)o.visible=false;wheelBatches.push({mesh,sources});}
 const inverseGear=new T.Matrix4(),batchMatrix=new T.Matrix4();
 const syncWheels=()=>{inverseGear.copy(gear.matrixWorld).invert();for(const b of wheelBatches){b.sources.forEach((o,i)=>b.mesh.setMatrixAt(i,batchMatrix.copy(inverseGear).multiply(o.matrixWorld)));b.mesh.instanceMatrix.needsUpdate=true;}};
 const bodyDisplay=batchStaticDisplay(body,{domain:true});
 let current=null,currentTime=0,currentState=null,currentPhaseOrigin=.25;const omega=-1.3,theta0=.25;
 const stateAt=t=>{if(!Number.isFinite(t))throw Error('FINITE_TIME_REQUIRED');return {worldTimeS:t,commonThetaRad:theta0+omega*t,omegaRadS:omega,alphaRadS2:0};};
 function applyState(st,travel,phaseOrigin=theta0){const next=evaluate(design,st,[0,0,0],[0,0,0]);currentTime=st.worldTimeS;currentState={...st};currentPhaseOrigin=phaseOrigin;current=next;train.position.x=travel;for(const w of wheels){const phase=w.driver?design.cylinders.find(c=>c.id===(w.yM<0?'right':'left')).crankPhaseRad:0;w.object.rotation.y=-(w.driver?st.commonThetaRad+phase:(st.commonThetaRad-phaseOrigin)*R/w.radiusM);}
  for(const m of motions){const c=current.cylinders.find(c=>c.id===m.id),A=c.crankPinWorldM,B=c.crossheadPinWorldM;placeForgedRod(T,m.main,A,B);m.cross.position.set(...B);m.pin.position.set(...A);setBar(m.pistonRod,B,[B[0]+1,B[1],B[2]]);}
  const crank=(a,c,y)=>[a.xM+design.strokeM/2*Math.cos(st.commonThetaRad+c.crankPhaseRad),y,R+design.strokeM/2*Math.sin(st.commonThetaRad+c.crankPhaseRad)];for(const p of pins)p.object.position.set(...crank(p.axle,p.cylinder,p.yM));for(const p of couplers)placeForgedRod(T,p.object,crank(p.a,p.cylinder,p.yM),crank(p.b,p.cylinder,p.yM));insideCrank.rotation.y=-(st.commonThetaRad+design.cylinders.find(c=>c.id==='inside').crankPhaseRad);train.updateMatrixWorld(true);syncWheels();return snapshot();
 }
 function setTime(t){const st=stateAt(t);return applyState(st,-R*(st.commonThetaRad-theta0));}
 function setPhysicsState(s){for(const key of ['timeS','positionM','speedMps','wheelAngleRad','wheelAngularSpeedRadS','wheelAngularAccelerationRadS2'])if(typeof s[key]!=='number'||!Number.isFinite(s[key]))throw Error('FINITE_PHYSICS_STATE_REQUIRED:'+key);const phaseOrigin=s.initialMechanicalThetaRad??theta0;if(typeof phaseOrigin!=='number'||!Number.isFinite(phaseOrigin))throw Error('FINITE_MECHANICAL_PHASE_ORIGIN_REQUIRED');if(s.wheelRadiusM!==undefined&&(typeof s.wheelRadiusM!=='number'||!Number.isFinite(s.wheelRadiusM)||Math.abs(s.wheelRadiusM-R)>1e-12))throw Error('PHYSICS_WHEEL_RADIUS_MISMATCH');const origin=s.rollingOriginPositionM??0;if(typeof origin!=='number'||!Number.isFinite(origin))throw Error('FINITE_ROLLING_ORIGIN_REQUIRED');if(Math.abs((s.positionM-origin)-R*s.wheelAngleRad)>1e-7||Math.abs(s.speedMps-R*s.wheelAngularSpeedRadS)>1e-7)throw Error('IDEAL_ROLLING_PHYSICS_STATE_INCONSISTENT');return applyState({worldTimeS:s.timeS,commonThetaRad:phaseOrigin-s.wheelAngleRad,omegaRadS:-s.wheelAngularSpeedRadS,alphaRadS2:-s.wheelAngularAccelerationRadS2},s.positionM,phaseOrigin);}
 const ends=o=>{const L=o.userData.pinCentresM;return [new T.Vector3(0,0,0).applyMatrix4(o.matrixWorld).toArray(),new T.Vector3(L,0,0).applyMatrix4(o.matrixWorld).toArray()];};
 function snapshot(){return {scope:'original metric mechanism adaptation; shaft state drives every part; no joint-load or full-train dynamics certification',timeS:currentTime,state:{...currentState},mechanicalConfiguration:{wheelRadiusM:R,initialMechanicalThetaRad:currentPhaseOrigin},bodyTravelM:train.position.x,oldUpdateCalls:0,dimensionCalibration:{lengthScale,widthScale,heightScale,wheelScale:scale,targets:dimensions,method:'Separate body envelope and native circular wheel calibration; not a surveyed full A4 reconstruction'},bodyMountLiftM:lift,wheels:wheels.map(w=>({id:w.id,driver:w.driver,radiusM:w.radiusM,halfWidthM:w.halfWidthM,centreM:w.object.getWorldPosition(new T.Vector3()).toArray(),rotationY:w.object.rotation.y})),mainRods:motions.map(m=>({id:m.id,lengthM:m.main.userData.pinCentresM,endpointsM:ends(m.main),crossheadM:m.cross.getWorldPosition(new T.Vector3()).toArray(),crankPinM:m.pin.getWorldPosition(new T.Vector3()).toArray()})),couplingRods:couplers.map(p=>({lengthM:p.object.userData.pinCentresM,endpointsM:ends(p.object)})),nominalContact:nominalRollingContact(design,{bodySpeedMS:-R*currentState.omegaRadS,omegaRadS:currentState.omegaRadS,bodyXM:train.position.x}),unbuilt:['historical inclined inside crank and conjugated valve gear','full rigid body dynamics','dynamic wheel/rail contact loads','whole-train interference and structural certification']};}
 const physicsContract=Object.freeze({wheelDiameterM:2*R,cylinderCount:design.cylinders.length,strokeM:design.strokeM,initialMechanicalThetaRad:'explicit finite input, default 0.25'});
 function validatePhysicsConfiguration(input){const c=input?.train?{wheelDiameterM:input.train.wheelDiameterM,cylinderCount:input.engine?.cylinderCount,strokeM:input.engine?.strokeM,initialMechanicalThetaRad:input.train.initialMechanicalThetaRad}:input;for(const key of ['wheelDiameterM','cylinderCount','strokeM'])if(typeof c?.[key]!=='number'||!Number.isFinite(c[key])||Math.abs(c[key]-physicsContract[key])>1e-12)throw Error('PHYSICS_MECHANISM_CONFIG_MISMATCH:'+key);if(typeof c.initialMechanicalThetaRad!=='number'||!Number.isFinite(c.initialMechanicalThetaRad))throw Error('FINITE_MECHANICAL_PHASE_ORIGIN_REQUIRED');return true;}
 setTime(0);return {sourceFirstAxleZ:first,mapSourcePoint,longitudinalMapping:{sourceFrontZ,cabRearSourceZ,locoLongitudinalFactor,tenderLongitudinalFactor},firstDrivingDatumXM,brakeAssemblies,bodyDisplay,wheelBatches,nativeSource:old,dimensions,sourceBounds,bodyScales:{lengthScale,widthScale,heightScale,cabHeightFactor},physicsContract,validatePhysicsConfiguration,train,body,gear,wheels,axles,motions,couplers,clearance,sourceAxleCount:sourceAxles.length,scale,stateAt,setTime,setPhysicsState,snapshot,bodyTriangles};
}
