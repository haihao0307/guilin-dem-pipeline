import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function roundedBox(size,mat,r=.035,segments=4){const g=new RoundedBoxGeometry(size.x,size.y,size.z,segments,r);const m=new THREE.Mesh(g,mat);m.castShadow=m.receiveShadow=true;return m}
function cylinder(radius,length,mat,axis='y',radial=32){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,radial,2,false),mat);if(axis==='x')m.rotation.z=Math.PI/2;if(axis==='z')m.rotation.x=Math.PI/2;m.castShadow=m.receiveShadow=true;return m}
function tube(points,radius,mat,segments=48,radial=10){const curve=new THREE.CatmullRomCurve3(points);const m=new THREE.Mesh(new THREE.TubeGeometry(curve,segments,radius,radial,false),mat);m.castShadow=m.receiveShadow=true;return m}
function torus(major,minor,mat,axis='z',radial=16,tubular=72){const m=new THREE.Mesh(new THREE.TorusGeometry(major,minor,radial,tubular),mat);if(axis==='x')m.rotation.y=Math.PI/2;if(axis==='y')m.rotation.x=Math.PI/2;m.castShadow=m.receiveShadow=true;return m}
function bolt(parent,x,y,z,mat,scale=1){const stem=cylinder(.012*scale,.035*scale,mat,'y',12);stem.position.set(x,y,z);parent.add(stem);const head=cylinder(.022*scale,.012*scale,mat,'y',8);head.position.set(x,y+.022*scale,z);parent.add(head)}
function createBilgeLiner(material){
  const pts=[[-1.39,-.42],[-.92,-.57],[-.20,-.62],[.62,-.59],[1.33,-.46],[1.92,-.25],[2.20,0],[1.92,.25],[1.33,.46],[.62,.59],[-.20,.62],[-.92,.57],[-1.39,.42]];
  const shape=new THREE.Shape();shape.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)shape.lineTo(pts[i][0],pts[i][1]);shape.closePath();
  const geo=new THREE.ShapeGeometry(shape,24);geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,material);mesh.position.y=.115;mesh.receiveShadow=true;return mesh;
}
function createPropeller(material){
  const group=new THREE.Group();group.add(cylinder(.065,.18,material,'x',32));
  const shape=new THREE.Shape();shape.moveTo(.055,.015);shape.bezierCurveTo(.10,.035,.19,.14,.225,.25);shape.bezierCurveTo(.175,.285,.092,.27,.038,.185);shape.bezierCurveTo(.005,.13,.01,.055,.055,.015);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:true,bevelSize:.009,bevelThickness:.008,bevelSegments:2,curveSegments:14});geo.translate(0,0,-.009);geo.rotateY(Math.PI/2);
  for(let i=0;i<3;i++){const blade=new THREE.Mesh(geo,material);blade.rotation.x=i*Math.PI*2/3+.16;blade.castShadow=true;group.add(blade)}
  return group;
}
function createRudder(material,wood,brass){
  const pivot=new THREE.Group();
  const stock=cylinder(.027,.80,material,'y',24);stock.position.y=.04;pivot.add(stock);
  const shape=new THREE.Shape();shape.moveTo(-.035,.25);shape.bezierCurveTo(-.13,.22,-.34,.13,-.40,.04);shape.lineTo(-.34,-.36);shape.bezierCurveTo(-.21,-.40,-.08,-.38,.015,-.32);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.052,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,curveSegments:18});geo.rotateY(Math.PI/2);geo.translate(0,-.18,-.026);const blade=new THREE.Mesh(geo,material);blade.castShadow=true;pivot.add(blade);
  const collar=cylinder(.050,.07,brass,'y',24);collar.position.y=.405;pivot.add(collar);
  const tiller=tube([new THREE.Vector3(0,.43,0),new THREE.Vector3(.35,.45,.025),new THREE.Vector3(.73,.43,.07)],.027,wood,36,12);pivot.add(tiller);
  const grip=cylinder(.035,.20,wood,'x',20);grip.position.set(.75,.43,.075);pivot.add(grip);
  return pivot;
}
function createFlywheel(material,brass){
  const g=new THREE.Group();g.add(torus(.235,.036,material,'x',18,84));const hub=cylinder(.072,.16,brass,'x',28);g.add(hub);
  for(let i=0;i<8;i++){const spoke=roundedBox(new THREE.Vector3(.31,.022,.022),material,.007,2);spoke.position.x=0;spoke.rotation.x=i*Math.PI/4;spoke.rotation.z=Math.PI/2;g.add(spoke)}
  return g;
}
function addEngineFasteners(group,mats){
  const xs=[-.25,.25],zs=[-.18,.18];for(const x of xs)for(const z of zs)bolt(group,x,-.19,z,mats.brass,.8);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,stud=cylinder(.008,.035,mats.steel,'x',10);stud.position.set(.205,.18*Math.cos(a),.18*Math.sin(a));group.add(stud);const nut=cylinder(.018,.018,mats.brass,'x',6);nut.position.set(.225,.18*Math.cos(a),.18*Math.sin(a));group.add(nut)}
}
function buildEngine(mats){
  const engine=new THREE.Group();engine.name='1933_style_marine_engine';engine.position.set(-1.03,.46,0);
  const bedL=roundedBox(new THREE.Vector3(.94,.075,.075),mats.blackIron,.018,3);bedL.position.set(0,-.22,-.22);engine.add(bedL);const bedR=bedL.clone();bedR.position.z=.22;engine.add(bedR);
  const crank=roundedBox(new THREE.Vector3(.58,.34,.48),mats.castIronGreen,.07,6);crank.position.set(0,-.02,0);engine.add(crank);
  const lower=roundedBox(new THREE.Vector3(.64,.14,.52),mats.blackIron,.045,5);lower.position.set(-.02,-.19,0);engine.add(lower);
  const gearbox=roundedBox(new THREE.Vector3(.27,.30,.37),mats.oiledSteel,.055,5);gearbox.position.set(-.36,-.04,0);engine.add(gearbox);
  const barrel=cylinder(.178,.48,mats.blackIron,'x',42);barrel.position.set(.41,.08,0);engine.add(barrel);
  for(let i=0;i<13;i++){const fin=cylinder(.218,.018,mats.castIronGreen,'x',48);fin.position.set(.20+i*.034,.08,0);engine.add(fin)}
  const head=roundedBox(new THREE.Vector3(.18,.43,.42),mats.castIronGreen,.045,5);head.position.set(.76,.08,0);engine.add(head);
  const headBand=cylinder(.205,.035,mats.blackIron,'x',40);headBand.position.set(.675,.08,0);engine.add(headBand);
  const hopper=roundedBox(new THREE.Vector3(.40,.38,.42),mats.castIronGreen,.055,6);hopper.position.set(.35,.35,0);engine.add(hopper);
  const lip=roundedBox(new THREE.Vector3(.44,.055,.46),mats.blackIron,.026,4);lip.position.set(.35,.565,0);engine.add(lip);
  const neck=cylinder(.055,.075,mats.brass,'y',24);neck.position.set(.34,.615,.02);engine.add(neck);const cap=cylinder(.075,.026,mats.brass,'y',30);cap.position.set(.34,.666,.02);engine.add(cap);
  const fly=createFlywheel(mats.blackIron,mats.brass);fly.position.set(-.42,.08,-.31);engine.add(fly);
  const flyAxle=cylinder(.038,.22,mats.steel,'z',24);flyAxle.position.set(-.42,.08,-.27);engine.add(flyAxle);
  const tank=roundedBox(new THREE.Vector3(.43,.18,.30),mats.fadedRed,.065,6);tank.position.set(.56,.62,.02);engine.add(tank);
  for(const x of[.42,.70]){const strap=roundedBox(new THREE.Vector3(.032,.205,.325),mats.brass,.01,2);strap.position.set(x,.62,.02);engine.add(strap)}
  const fuelCap=cylinder(.052,.030,mats.brass,'y',22);fuelCap.position.set(.56,.735,.02);engine.add(fuelCap);
  const pump=roundedBox(new THREE.Vector3(.12,.16,.14),mats.oiledSteel,.026,4);pump.position.set(.58,.18,-.245);engine.add(pump);
  const pumpKnob=cylinder(.028,.065,mats.brass,'y',18);pumpKnob.position.set(.58,.31,-.245);engine.add(pumpKnob);
  engine.add(tube([new THREE.Vector3(.58,.72,.02),new THREE.Vector3(.58,.46,-.13),new THREE.Vector3(.58,.27,-.245)],.012,mats.copper,40,10));
  engine.add(tube([new THREE.Vector3(.62,.25,-.245),new THREE.Vector3(.72,.28,-.18),new THREE.Vector3(.78,.20,-.07)],.008,mats.copper,38,8));
  const sight=cylinder(.021,.075,mats.glass,'y',18);sight.position.set(.70,.34,-.22);engine.add(sight);
  engine.add(tube([new THREE.Vector3(.81,.22,.16),new THREE.Vector3(.93,.32,.20),new THREE.Vector3(.92,.49,.22)],.043,mats.rust,36,14));
  const silencer=cylinder(.070,.32,mats.blackIron,'y',30);silencer.position.set(.92,.65,.22);engine.add(silencer);const tip=cylinder(.038,.18,mats.rust,'y',20);tip.position.set(.92,.90,.22);engine.add(tip);
  const oilNeck=cylinder(.038,.065,mats.brass,'y',18);oilNeck.position.set(-.10,.24,.12);engine.add(oilNeck);const oilCap=cylinder(.055,.022,mats.brass,'y',20);oilCap.position.set(-.10,.286,.12);engine.add(oilCap);
  const plate=roundedBox(new THREE.Vector3(.22,.105,.012),mats.brass,.008,2);plate.position.set(.02,.01,-.251);engine.add(plate);
  const starter=cylinder(.052,.075,mats.blackIron,'z',24);starter.position.set(-.43,.00,.245);engine.add(starter);const starterHole=cylinder(.023,.080,mats.rubber,'z',20);starterHole.position.set(-.43,.00,.252);engine.add(starterHole);
  const clutchPivot=cylinder(.040,.10,mats.brass,'z',20);clutchPivot.position.set(-.18,.12,.28);engine.add(clutchPivot);
  const clutch=tube([new THREE.Vector3(-.18,.13,.30),new THREE.Vector3(-.05,.35,.34),new THREE.Vector3(.06,.46,.36)],.018,mats.steel,30,10);engine.add(clutch);const clutchGrip=cylinder(.032,.14,mats.darkWood,'x',18);clutchGrip.position.set(.10,.48,.36);engine.add(clutchGrip);
  const throttle=tube([new THREE.Vector3(.49,.18,.27),new THREE.Vector3(.55,.34,.31),new THREE.Vector3(.60,.42,.33)],.010,mats.brass,24,8);engine.add(throttle);const throttleKnob=new THREE.Mesh(new THREE.SphereGeometry(.027,18,12),mats.darkWood);throttleKnob.position.set(.60,.42,.33);engine.add(throttleKnob);
  addEngineFasteners(engine,mats);
  return{engine,flywheel:fly};
}
export function buildBoatSystems(boatRoot,mats){
  const systems=new THREE.Group();systems.name='historical_mechanical_systems';boatRoot.add(systems);
  const liner=createBilgeLiner(mats.darkWood);systems.add(liner);
  const sternBacking=roundedBox(new THREE.Vector3(.12,.63,1.18),mats.innerWood,.025,3);sternBacking.position.set(-1.54,.43,0);systems.add(sternBacking);
  const portPatch=roundedBox(new THREE.Vector3(.78,.32,.018),mats.repairWood,.012,2);portPatch.position.set(-.10,.48,-.704);portPatch.rotation.z=-.07;systems.add(portPatch);
  const starPatch=roundedBox(new THREE.Vector3(.56,.27,.018),mats.repairWood,.012,2);starPatch.position.set(.76,.53,.696);starPatch.rotation.z=.05;systems.add(starPatch);
  for(const patch of[portPatch,starPatch])for(const x of[-.22,0,.22])for(const y of[-.08,.08])bolt(patch,x,y,.014,mats.brass,.55);
  for(const x of[-1.40,-.99,-.62]){const beam=roundedBox(new THREE.Vector3(.13,.08,.78),mats.darkWood,.018,3);beam.position.set(x,.23,0);systems.add(beam)}
  const engineData=buildEngine(mats);systems.add(engineData.engine);
  const drive=new THREE.Group();drive.name='complete_drivetrain';systems.add(drive);
  const coupling=cylinder(.078,.13,mats.oiledSteel,'x',32);coupling.position.set(-1.42,.22,0);drive.add(coupling);
  for(const x of[-1.385,-1.455]){const flange=cylinder(.105,.024,mats.steel,'x',32);flange.position.set(x,.22,0);drive.add(flange)}
  const gland=cylinder(.068,.16,mats.brass,'x',30);gland.position.set(-1.53,.22,0);drive.add(gland);
  const sternTube=cylinder(.052,.36,mats.blackIron,'x',30);sternTube.position.set(-1.68,.22,0);drive.add(sternTube);
  const shaft=cylinder(.025,.74,mats.steel,'x',24);shaft.position.set(-1.79,.22,0);drive.add(shaft);
  const strut=tube([new THREE.Vector3(-1.82,.22,0),new THREE.Vector3(-1.76,.06,0),new THREE.Vector3(-1.72,-.02,0)],.026,mats.brass,28,10);drive.add(strut);
  const cutless=cylinder(.046,.13,mats.brass,'x',26);cutless.position.set(-1.86,.22,0);drive.add(cutless);
  const propeller=createPropeller(mats.brass);propeller.position.set(-2.02,.22,0);drive.add(propeller);
  const rudderPivot=createRudder(mats.oiledSteel,mats.darkWood,mats.brass);rudderPivot.position.set(-2.19,.43,0);systems.add(rudderPivot);
  const grease=cylinder(.025,.080,mats.brass,'y',18);grease.position.set(-1.72,.33,.07);drive.add(grease);const greaseCap=cylinder(.036,.018,mats.brass,'y',18);greaseCap.position.set(-1.72,.378,.07);drive.add(greaseCap);
  return{systems,engine:engineData.engine,flywheel:engineData.flywheel,propeller,rudderPivot,drive,liner};
}
