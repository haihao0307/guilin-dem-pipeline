import {batchStaticDisplay} from './display-batching.mjs';
/* FH88 original metric adapter. No teacher buffers; frozen generator is called once. */
import * as T from './frozen/learned-shape/vendor/three.module.mjs';
import {generate} from './frozen/learned-shape/derived/train-shape-only.mjs';
import {contract,evaluate,nominalRollingContact} from './frozen/three-cylinder/three-cylinder.mjs';
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
// Reuse the already learned wheel hierarchy, rim, hub and all spokes. No substitute wheel generator.
function reuseLearnedWheel(parent, sourceWheel, sourceRadius, radiusM, halfWidthM){
 const wheel=sourceWheel.clone(true);wheel.position.set(0,0,0);wheel.rotation.set(0,0,0);
 const b=new T.Box3().setFromObject(wheel),sourceHalf=Math.max(Math.abs(b.min.x),Math.abs(b.max.x));
 wheel.scale.set(halfWidthM/sourceHalf,radiusM/sourceRadius,radiusM/sourceRadius);
 const orient=new T.Group();orient.quaternion.setFromRotationMatrix(new T.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1));orient.add(wheel);
 const g=new T.Group();g.add(orient);parent.add(g);g.userData.nativeWheel=true;g.userData.sourceName=sourceWheel.name;return g;
}

export function buildPreview(recipe,design,dimensions){
 const datum=contract(design),R=datum.wheelRadiusM,source=structuredClone(recipe),sourceDriverR=source.parameters.driverRadius,scale=R/sourceDriverR;
 if(datum.railTopZM!==0)throw Error('PREVIEW_R03_REQUIRES_RAIL_TOP_ZERO');
 source.identity={id:'fh88/native-game-a4',name:'88 / existing A4 function train'};source.parameters.number=88;source.parameters.boilerY=2.9;
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
 old.root.traverse(o=>{const p=o.geometry?.parameters;if(o.parent?.name==='煤水车 / 水箱 / 悬挂'&&p?.width===2.2&&p?.height===.24)o.position.y=1.02;});
 // Gauge conversion moves only longitudinal frame rails inward and running boards outward, leaving exterior functions intact.
 old.root.traverse(o=>{const p=o.geometry?.parameters;if(!p||o.parent?.name!=='锅炉、烟箱与主承载走台')return;if(p.width===.13&&p.height===.28)o.position.x=Math.sign(o.position.x)*.54;if(p.width===.38&&p.height===.07)o.position.x=Math.sign(o.position.x)*1.075;});
 for(const g of old.parts.filter(g=>g.name==='函数编号 88'&&g.parent?.name==='煤水车 / 水箱 / 悬挂'))g.removeFromParent();
 const strip=old.parts.filter(g=>g.name==='轮轴、联动、制动与轴箱'||g.name==='承载轮轴总成'||g.name==='函数蒸汽');for(const g of strip)g.removeFromParent();
 const train=new T.Group();train.name='FH88 metric moving frame';const body=old.root;body.name='frozen learned exterior, rigidly remounted';
 body.quaternion.setFromRotationMatrix(new T.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1));body.scale.set(widthScale,heightScale,lengthScale);body.position.set(-first*lengthScale,0,-.08*heightScale);train.add(body);
 const wheelSpecs=[],axles=sourceAxles.map((a,i)=>({id:'axle-'+i,driver:a.driver,xM:(a.z-first)*lengthScale,radiusM:a.r*scale,sourceWheel:wheelSources.get(a.g),sourceRadius:a.r}));
 // A4 axial stations from the LNER-supplied 1935 drawing. Body and wheel circles retain separate metric mappings.
 const knownStations=[0,-2.2098,-4.4196,1.6764,3.5814,-7.3152];
 axles.slice(0,6).forEach((a,i)=>a.xM=knownStations[i]);
 const tenderAxles=axles.slice(6),tenderCenter=tenderAxles.reduce((n,a)=>n+a.xM,0)/tenderAxles.length;
 tenderAxles.forEach((a,i)=>a.xM=tenderCenter+(i-1.5)*(4.8768/3));
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
 const wheels=wheelSpecs.map(w=>{const axle=axles.find(a=>a.id===w.axle),g=reuseLearnedWheel(gear,axle.sourceWheel,axle.sourceRadius,w.radiusM,w.halfWidthM);g.name=w.id;g.position.set(w.xM,w.yM,w.radiusM);return {...w,object:g};});
 for(const a of axles){cylinder(gear,.065,2*(datum.nominalRollingCircleYM[1]+design.wheel.envelopeHalfWidthM*.3),[a.xM,0,a.radiusM],steel,a.id+' straight axle proxy');for(const side of [-1,1]){const y=side*(datum.nominalRollingCircleYM[1]-design.wheel.envelopeHalfWidthM-.09);box(gear,[.20,.16,.18],[a.xM,y,a.radiusM],iron,a.id+' bearing proxy');}}
 // Inside crank construction is unresolved: remove the straight main axle centre so it cannot falsely cross the rod.
 const frontAxle=gear.children.find(o=>o.name==='axle-0 straight axle proxy');frontAxle.removeFromParent();
 for(const side of [-1,1])cylinder(gear,.065,.58,[0,side*.49,R],steel,'main axle stub: crank webs omitted');
 const mechanismMaterial=material('#aeb9bc'),cylinderColours=['#aeb9bc','#aeb9bc','#aeb9bc'],motions=[],couplers=[],pins=[];
 for(let i=0;i<3;i++){const c=design.cylinders[i],mat=mechanismMaterial,main=bar(gear,.03,[0,c.axisYM,R],[design.rodPinCentresM,c.axisYM,R],mat,c.id+' 3.2m main rod');const cross=box(gear,[.20,.10,.10],[3.2,c.axisYM,R],steel,c.id+' crosshead');const pin=cylinder(gear,.065,.08,[0,c.axisYM,R],crankMat,c.id+' crank pin');for(const dz of [-.10,.10])box(gear,[design.strokeM+.25,.035,.035],[design.rodPinCentresM,c.axisYM,R+dz],steel,c.id+' guide proxy');const casing=cylinder(gear,.285,.92,[4.2,c.axisYM,R],iron,c.id+' cylinder casing');casing.rotation.z=Math.PI/2;const pistonRod=bar(gear,.038,[3.2,c.axisYM,R],[4.2,c.axisYM,R],steel,c.id+' 1m piston rod');motions.push({id:c.id,main,cross,pin,pistonRod});
  if(c.id!=='inside'){for(const a of axles.filter(a=>a.driver)){const p=cylinder(gear,.055,.08,[a.xM,c.axisYM,R],crankMat,c.id+' coupling pin '+a.id);pins.push({object:p,axle:a,cylinder:c});}const da=axles.filter(a=>a.driver);for(let j=1;j<da.length;j++){const o=bar(gear,.024,[da[j-1].xM,c.axisYM,R],[da[j].xM,c.axisYM,R],steel,c.id+' coupling rod '+j);couplers.push({object:o,a:da[j-1],b:da[j],cylinder:c});}}
 }
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
  for(const m of motions){const c=current.cylinders.find(c=>c.id===m.id),A=c.crankPinWorldM,B=c.crossheadPinWorldM;setBar(m.main,A,B);m.cross.position.set(...B);m.pin.position.set(...A);setBar(m.pistonRod,B,[B[0]+1,B[1],B[2]]);}
  const crank=(a,c)=>[a.xM+design.strokeM/2*Math.cos(st.commonThetaRad+c.crankPhaseRad),c.axisYM,R+design.strokeM/2*Math.sin(st.commonThetaRad+c.crankPhaseRad)];for(const p of pins)p.object.position.set(...crank(p.axle,p.cylinder));for(const p of couplers)setBar(p.object,crank(p.a,p.cylinder),crank(p.b,p.cylinder));train.updateMatrixWorld(true);syncWheels();return snapshot();
 }
 function setTime(t){const st=stateAt(t);return applyState(st,-R*(st.commonThetaRad-theta0));}
 function setPhysicsState(s){for(const key of ['timeS','positionM','speedMps','wheelAngleRad','wheelAngularSpeedRadS','wheelAngularAccelerationRadS2'])if(typeof s[key]!=='number'||!Number.isFinite(s[key]))throw Error('FINITE_PHYSICS_STATE_REQUIRED:'+key);const phaseOrigin=s.initialMechanicalThetaRad??theta0;if(typeof phaseOrigin!=='number'||!Number.isFinite(phaseOrigin))throw Error('FINITE_MECHANICAL_PHASE_ORIGIN_REQUIRED');if(s.wheelRadiusM!==undefined&&(typeof s.wheelRadiusM!=='number'||!Number.isFinite(s.wheelRadiusM)||Math.abs(s.wheelRadiusM-R)>1e-12))throw Error('PHYSICS_WHEEL_RADIUS_MISMATCH');const origin=s.rollingOriginPositionM??0;if(typeof origin!=='number'||!Number.isFinite(origin))throw Error('FINITE_ROLLING_ORIGIN_REQUIRED');if(Math.abs((s.positionM-origin)-R*s.wheelAngleRad)>1e-7||Math.abs(s.speedMps-R*s.wheelAngularSpeedRadS)>1e-7)throw Error('IDEAL_ROLLING_PHYSICS_STATE_INCONSISTENT');return applyState({worldTimeS:s.timeS,commonThetaRad:phaseOrigin-s.wheelAngleRad,omegaRadS:-s.wheelAngularSpeedRadS,alphaRadS2:-s.wheelAngularAccelerationRadS2},s.positionM,phaseOrigin);}
 const ends=o=>{const h=o.geometry.parameters.height/2;return [new T.Vector3(0,-h,0).applyMatrix4(o.matrixWorld).toArray(),new T.Vector3(0,h,0).applyMatrix4(o.matrixWorld).toArray()];};
 function snapshot(){return {scope:'original metric mechanism adaptation; shaft state drives every part; no joint-load or full-train dynamics certification',timeS:currentTime,state:{...currentState},mechanicalConfiguration:{wheelRadiusM:R,initialMechanicalThetaRad:currentPhaseOrigin},bodyTravelM:train.position.x,oldUpdateCalls:0,dimensionCalibration:{lengthScale,widthScale,heightScale,wheelScale:scale,targets:dimensions,method:'Separate body envelope and native circular wheel calibration; not a surveyed full A4 reconstruction'},bodyMountLiftM:lift,wheels:wheels.map(w=>({id:w.id,driver:w.driver,radiusM:w.radiusM,halfWidthM:w.halfWidthM,centreM:w.object.getWorldPosition(new T.Vector3()).toArray(),rotationY:w.object.rotation.y})),mainRods:motions.map(m=>({id:m.id,lengthM:m.main.geometry.parameters.height,endpointsM:ends(m.main),crossheadM:m.cross.getWorldPosition(new T.Vector3()).toArray(),crankPinM:m.pin.getWorldPosition(new T.Vector3()).toArray()})),couplingRods:couplers.map(p=>({lengthM:p.object.geometry.parameters.height,endpointsM:ends(p.object)})),nominalContact:nominalRollingContact(design,{bodySpeedMS:-R*currentState.omegaRadS,omegaRadS:currentState.omegaRadS,bodyXM:train.position.x}),unbuilt:['inner crank webs and bearings','physical cylinders/steam and valve gear','full rigid body dynamics','tread/flange contact','whole-train interference and structural certification']};}
 const physicsContract=Object.freeze({wheelDiameterM:2*R,cylinderCount:design.cylinders.length,strokeM:design.strokeM,initialMechanicalThetaRad:'explicit finite input, default 0.25'});
 function validatePhysicsConfiguration(input){const c=input?.train?{wheelDiameterM:input.train.wheelDiameterM,cylinderCount:input.engine?.cylinderCount,strokeM:input.engine?.strokeM,initialMechanicalThetaRad:input.train.initialMechanicalThetaRad}:input;for(const key of ['wheelDiameterM','cylinderCount','strokeM'])if(typeof c?.[key]!=='number'||!Number.isFinite(c[key])||Math.abs(c[key]-physicsContract[key])>1e-12)throw Error('PHYSICS_MECHANISM_CONFIG_MISMATCH:'+key);if(typeof c.initialMechanicalThetaRad!=='number'||!Number.isFinite(c.initialMechanicalThetaRad))throw Error('FINITE_MECHANICAL_PHASE_ORIGIN_REQUIRED');return true;}
 setTime(0);return {bodyDisplay,wheelBatches,nativeSource:old,dimensions,sourceBounds,bodyScales:{lengthScale,widthScale,heightScale,cabHeightFactor},physicsContract,validatePhysicsConfiguration,train,body,gear,wheels,axles,motions,couplers,clearance,sourceAxleCount:sourceAxles.length,scale,stateAt,setTime,setPhysicsState,snapshot,bodyTriangles};
}
