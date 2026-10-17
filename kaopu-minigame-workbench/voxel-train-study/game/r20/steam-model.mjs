// Original procedural study of the utilitarian WD Austerity 2-8-0 silhouette.
// All meshes below are generated from primitives. No third-party mesh, image or texture is used.
import * as THREE from '../../vendor/three.module.js';
import {CREW_SPEC,driverCrewPose} from './crew-state.mjs';
import {BODY_MOTION_SPEC,createBodyMotion} from './body-motion.mjs';
import {TRACK,WD_VERIFIED,WD_AXLES} from './metre-scale.mjs';
import {STEAM_AUTHORING,STEAM_CALIBRATION,STEAM_MAPS,STEAM_CHIMNEY_MAP,STEAM_SOCKETS,STEAM_CAB_FLOOR_Y,STEAM_CAB_REAR_X,STEAM_BOILER_CENTER_Y,steamFittingMap,steamBodyX,steamTenderX,steamCrewMap} from './steam-scale.mjs';

export const STEAM_SPEC=Object.freeze({wheelArrangement:'2-8-0',railHead:TRACK.railHead,driverRadius:WD_VERIFIED.driverDiameter/2,guideRadius:WD_VERIFIED.leadingDiameter/2,tenderRadius:STEAM_AUTHORING.tenderWheelRadius,driverAxles:WD_AXLES.drivers,guideAxles:WD_AXLES.guide,tenderAxles:Object.freeze([-7.12,-6.08,-4.77,-3.73].map(steamTenderX)),wheelAxisZ:TRACK.wheelAxisZ,crankRadius:STEAM_CALIBRATION.crankRadius,mainRodLength:STEAM_AUTHORING.mainRodLength,chimney:STEAM_SOCKETS.chimney,cylinders:{boreInches:19,strokeInches:28},original:true});
export const STEAM_BRAKE_SHOE_OFFSET=Object.freeze((()=>{const dx=.39,dy=.89-(STEAM_SPEC.railHead+STEAM_SPEC.driverRadius),l=Math.hypot(dx,dy);return[dx/l*STEAM_SPEC.driverRadius,dy/l*STEAM_SPEC.driverRadius];})());
const C={black:0x18201e,soot:0x242a27,green:0x283d32,edge:0x425248,steel:0x88918c,darkSteel:0x4b5752,rust:0x705445,brass:0xb29355,red:0x9b382d,coal:0x20251f};
const Y=new THREE.Vector3(0,1,0),unitBox=new THREE.BoxGeometry(1,1,1),unitCylinder=new THREE.CylinderGeometry(1,1,1,12);

// One vertex-colour material; upper locomotive and fixed chassis/tender are separate batches.
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
function makeWheelGeometry(radius,spoked){
  const b=new GeometryBatch();
  const section=[[radius-.065,-.105],[radius+.028,-.105],[radius+.028,-.090],[radius,-.065],[radius,.085],[radius-.035,.10],[radius-.065,.085],[radius-.065,-.105]];
  const tire=new THREE.LatheGeometry(section.map(([r,z])=>new THREE.Vector2(r,z)),64);tire.rotateX(Math.PI/2);b.add(tire,C.steel);tire.dispose();
  if(spoked){
    for(let j=0;j<14;j++){const a=j*Math.PI*2/14;b.box(Math.cos(a)*radius*.47,Math.sin(a)*radius*.47,0,radius*.76,.057,.115,j%3?C.green:C.edge,[0,0,a]);}
    b.torus(0,0,0,radius-.076,.034,C.green,'z');
    // Cast counterweight opposite the crank pin. It rotates with the same wheel geometry.
    for(let j=0;j<7;j++){const a=Math.PI*.73+j*.09;b.box(Math.cos(a)*radius*.65,Math.sin(a)*radius*.65,.06,.18,.14,.13,C.black,[0,0,a]);}
  }else{b.cylinder(0,0,0,radius-.065,.105,C.darkSteel,'z',24);for(let j=0;j<8;j++){const a=j*Math.PI/4;b.box(Math.cos(a)*radius*.48,Math.sin(a)*radius*.48,.07,.045,.12,.02,C.steel,[0,0,a-Math.PI/2]);}}
  b.cylinder(0,0,0,radius*.19,.18,C.darkSteel,'z');b.cylinder(0,0,.109,radius*.105,.045,C.brass,'z');
  if(spoked){b.cylinder(STEAM_SPEC.crankRadius,0,.15,.068,.13,C.steel,'z');b.cylinder(STEAM_SPEC.crankRadius,0,.223,.034,.022,C.brass,'z');}
  return b.geometry();
}
function makeWheelBatch(radius,count,spoked,material){const batch=new THREE.InstancedMesh(makeWheelGeometry(radius,spoked),material,count);batch.name=spoked?'Eight large spoked driving wheels':'Small steel railway wheels';batch.castShadow=batch.receiveShadow=true;batch.frustumCulled=false;return batch;}
function makeLabel(b,text,x,y,z,pixel=.065){
  const font={'W':['10101','10101','10101','10101','10101','10101','01010'],'D':['11110','10001','10001','10001','10001','10001','11110'],'2':['11110','00001','00001','01110','10000','10000','11111'],'8':['01110','10001','10001','01110','10001','10001','01110'],'0':['01110','10001','10011','10101','11001','10001','01110'],'1':['010','110','010','010','010','010','111']};
  let at=x;for(const char of text){const rows=font[char];if(!rows){at+=pixel*3;continue;}for(let row=0;row<rows.length;row++)for(let col=0;col<rows[row].length;col++)if(rows[row][col]==='1')b.box(at+col*pixel,y-row*pixel,z,pixel*.80,pixel*.80,.015,C.brass);at+=(rows[0].length+1)*pixel;}
}
export function createSteamLocomotive({bodyMotion:bodyMotionOptions={},driverHeightM=STEAM_AUTHORING.driverHeightM}={}){
  const root=new THREE.Group();root.name='Original WD-inspired 2-8-0 steam locomotive and coal-water tender';
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.73,metalness:.40}),fixed=new GeometryBatch(STEAM_MAPS.chassis,'chassis'),upper=new GeometryBatch(STEAM_MAPS.boiler,'boiler-shell'),glass=new GeometryBatch(STEAM_MAPS.cab,'cab-glass'),warm=new GeometryBatch(STEAM_MAPS.cab,'cab-warm'),driver=new GeometryBatch(steamCrewMap(driverHeightM),'driver-body');
  let b=fixed;
  const bodyMotion=createBodyMotion(bodyMotionOptions),body=new THREE.Group(),bodyContents=new THREE.Group(),pivot=STEAM_MAPS.accessories(BODY_MOTION_SPEC.pivot);
  body.name='Subtle locomotive upper-body motion';bodyContents.name='Boiler cab crew glazing and headlamp';
  body.position.fromArray(pivot);bodyContents.position.set(-pivot[0],-pivot[1],-pivot[2]);body.add(bodyContents);root.add(body);
  // Deep twin plate frames, front pilot deck, running boards and red buffer beams.
  for(const z of [-.67,.67]){b.box(1.02,1.00,z,6.30,.25,.13,C.black);b.box(.74,1.55,Math.sign(z)*.96,5.72,.095,.40,C.darkSteel);for(const x of [-1.32,-.04,1.24,2.52]){b.box(x,1.13,z,.46,.25,.18,C.green);for(let j=0;j<4;j++)b.box(x,1.29+j*.034,z,.65-j*.07,.029,.20,C.darkSteel);}}
  b.box(4.08,1.15,0,1.14,.16,1.94,C.green);b.box(4.67,1.11,0,.16,.37,2.14,C.red);b.box(-2.13,1.17,0,.15,.30,2.08,C.red);
  for(const x of [4.87,-2.24])for(const z of [-.73,.73]){b.cylinder(x,1.15,z,.092,.26,C.darkSteel,'x');b.cylinder(x+(x>0?.11:-.11),1.15,z,.18,.07,C.black,'x',20);}
  b.box(4.88,.90,0,.28,.10,.15,C.steel);b.torus(4.96,.76,0,.11,.027,C.black,'z');
  b.pipe([[4.70,1.06,.28],[4.72,.67,.31],[4.56,.59,.31]],.043,C.black);b.pipe([[4.67,1.05,-.29],[4.69,.60,-.29]],.031,C.rust);
  for(const z of [-.83,.83]){b.pipe([[4.29,.63,z],[4.07,.97,z],[3.78,1.12,z]],.037,C.darkSteel);b.box(4.35,.58,z,.19,.07,.16,C.darkSteel);}
  // Riveted tapered boiler, separate smokebox, circular door and authentic central latch.
  b=upper;
  b.cylinder(1.00,2.26,0,.705,3.50,C.green,'x',48,.705);upper.tag='smokebox';b.cylinder(3.06,2.26,0,.69,.76,C.soot,'x',48);
  b.cylinder(3.47,2.26,0,.686,.085,C.black,'x',48);b.cylinder(3.53,2.26,0,.602,.050,C.soot,'x',48);b.torus(3.555,2.26,0,.61,.021,C.darkSteel,'x');
  for(let i=0;i<20;i++){const a=i*Math.PI/10;b.cylinder(3.565,2.26+Math.cos(a)*.626,Math.sin(a)*.626,.016,.021,C.steel,'x',8);}
  b.box(3.598,2.26,0,.045,.050,.56,C.darkSteel);b.box(3.604,2.26,0,.060,.32,.038,C.steel,[Math.PI/5,0,0]);b.cylinder(3.641,2.26,0,.071,.065,C.brass,'x',12);
  for(const y of [1.97,2.55]){b.box(3.57,y,-.48,.072,.07,.24,C.darkSteel);b.cylinder(3.62,y,-.56,.039,.16,C.steel,'y');}
  for(const x of [-.61,.18,1.00,1.80,2.64]){b.torus(x,2.26,0,.708,.018,C.darkSteel,'x');b.box(x,1.59,0,.065,.17,.17,C.brass);}
  // Authored saddles bridge the enlarged boiler to the independently placed deck.
  upper.map=null;upper.tag='boiler-saddles';for(const x of [-.61,1.00,2.64])upper.box(steamBodyX(x),2.04,0,.23,.40,1.04,C.black);
  upper.map=STEAM_CHIMNEY_MAP;upper.tag='chimney';
  // Black chimney with flared cap, recessed open mouth, domes, whistle and safety valves.
  b.cylinder(3.03,3.00,0,.24,.20,C.black,'y',24,.19);b.cylinder(3.03,3.34,0,.155,.55,C.soot,'y',24,.205);b.cylinder(3.03,3.635,0,.23,.08,C.darkSteel,'y',24);b.cylinder(3.03,3.681,0,.175,.018,0x0d1110,'y',24);b.torus(3.03,3.68,0,.21,.023,C.black,'y');
  upper.map=steamFittingMap(.78,2.90,3.335,STEAM_BOILER_CENTER_Y+.875,4.36);upper.tag='dome';
  b.cylinder(.78,2.98,0,.29,.16,C.darkSteel,'y',24);b.cylinder(.78,3.12,0,.235,.21,C.green,'y',24);b.sphere(.78,3.22,0,.239,C.green,[1,.48,1],2);
  upper.map=STEAM_MAPS.accessories;upper.tag='boiler-accessories';
  b.cylinder(-.31,2.995,0,.22,.14,C.darkSteel,'y',20);for(const z of [-.10,.10]){b.cylinder(-.31,3.17,z,.054,.25,C.brass,'y',12);b.cylinder(-.31,3.29,z,.073,.04,C.brass,'y',12);}
  b.cylinder(-.60,3.30,-.36,.043,.36,C.brass,'y',12);b.cylinder(-.60,3.50,-.36,.067,.055,C.brass,'y',12);
  // Outside 19 x 28 inch cylinders, slide valves, long steam pipes and fine handrails.
  for(const sign of [-1,1]){
    const z=sign*STEAM_AUTHORING.cylinderSideZ,cx=STEAM_AUTHORING.cylinderX,cy=STEAM_SPEC.railHead+STEAM_AUTHORING.cylinderAxisAboveRail;
    fixed.map=null;fixed.tag='cylinder';fixed.cylinder(cx,cy,z,.2413,.7112,C.black,'x',24);for(const x of [cx-.37,cx+.37]){fixed.cylinder(x,cy,z,.251,.055,C.darkSteel,'x',24);for(let j=0;j<8;j++){const a=j*Math.PI/4;fixed.cylinder(x+(x>cx?.031:-.031),cy+Math.cos(a)*.197,z+Math.sin(a)*.197,.018,.025,C.steel,'x',8);}}
    fixed.box(cx,cy+.28,z,.55,.17,.32,C.green);fixed.map=STEAM_MAPS.chassis;fixed.tag='chassis';
    const pipeStart=STEAM_MAPS.accessories([2.98,2.04,sign*.59]);upper.map=null;b.pipe([pipeStart,[cx-.25,cy+.70,sign*.92],[cx,cy+.35,z]],.070,C.darkSteel);upper.map=STEAM_MAPS.accessories;
    b.pipe([[-.86,2.39,sign*.744],[2.83,2.39,sign*.744],[3.20,2.35,sign*.61]],.021,C.brass);for(const x of [-.70,.2,1.15,2.05,2.80]){b.pipe([[x,2.25,sign*.68],[x,2.39,sign*.746]],.022,C.darkSteel);}
    b.pipe([[-.53,1.73,sign*.84],[2.75,1.73,sign*.84],[3.25,1.57,z]],.025,C.rust);b.box(2.22,1.55,sign*1.01,.60,.055,.30,C.steel);
    fixed.map=null;fixed.tag='brake-shoe';for(const x of STEAM_SPEC.driverAxles){const [dx,dy]=STEAM_BRAKE_SHOE_OFFSET,sy=STEAM_SPEC.railHead+STEAM_SPEC.driverRadius+dy,z=sign*(TRACK.wheelAxisZ+.065);fixed.box(x+dx,sy,z,.075,.27,.07,C.darkSteel,[0,0,Math.atan2(dy,dx)]);fixed.pipe([[x+dx,sy+.34,z],[x+dx,sy,z]],.032,C.black);}fixed.map=STEAM_MAPS.chassis;fixed.tag='chassis';
  }
  upper.map=STEAM_MAPS.cab;upper.tag='cab';
  // Broad firebox and open-backed cab. Distinct window openings are real gaps in the metal.
  b.box(-.78,1.94,0,.98,1.05,1.39,C.soot);b.box(-1.34,1.51,0,1.65,.13,1.93,C.green);b.box(-1.36,1.39,0,1.60,.11,1.74,C.black);
  for(const sign of [-1,1]){
    const z=sign*.984;b.box(-1.37,1.99,z,1.48,.84,.095,C.green);b.box(-1.37,3.06,z,1.49,.16,.10,C.green);for(const x of [-2.0875,-1.36,-.67])b.box(x,2.69,z,.085,.72,.105,C.edge);
    b.box(-1.37,2.33,z,1.48,.055,.135,C.brass);b.box(-1.37,3.14,z,1.50,.045,.13,C.black);
    for(const x of [-1.72,-1.02]){if(!(sign>0&&x===-1.72))glass.box(x,2.70,z,.55,.58,.014,0x91ada8);b.box(x,3.015,z+sign*.014,.57,.035,.045,C.brass);}
    b.pipe([[-2.12,1.60,sign*1.02],[-2.12,2.62,sign*1.02]],.028,C.brass);
    for(let j=0;j<3;j++)b.box(-1.80,.70+j*.28,sign*1.00,.59,.065,.22,C.darkSteel);
    for(const x of [-2.03,-1.51])b.pipe([[x,.69,sign*1.06],[x,1.37,sign*.94]],.032,C.black);
    b.box(-1.38,1.98,z+sign*.052,.72,.29,.032,C.black);makeLabel(b,'280',-1.61,2.08,z+sign*.075,.044);
    for(const x of [-2.0,-.73])for(let y=1.65;y<2.28;y+=.16)b.sphere(x,y,z+sign*.06,.016,C.steel);
  }
  b.box(-.64,2.03,0,.10,.78,1.92,C.green);b.box(-.64,3.05,0,.10,.18,1.92,C.green);for(const z of [-.91,0,.91])b.box(-.64,2.67,z,.11,.68,.10,C.edge);
  for(const z of [-.47,.47])glass.box(-.637,2.69,z,.019,.60,.75,0x91ada8);
  upper.map=STEAM_MAPS.cabRoof;upper.tag='cab-roof';
  for(let i=0;i<22;i++){const z=(i-10.5)*.106,y=3.21+.245*Math.sqrt(Math.max(0,1-(z/1.20)**2));b.box(-1.40,y,z,1.90,.082,.11,i%5===0?C.darkSteel:C.soot);}
  b.box(-1.39,3.45,0,.52,.055,.51,C.black);b.box(-1.42,3.49,0,.56,.041,.51,C.darkSteel);
  upper.map=STEAM_MAPS.cab;upper.tag='cab';
  // Visible backhead with firedoor, copper plumbing, two gauges, regulator and small crew stools.
  b.cylinder(-1.20,2.03,0,.53,.12,C.black,'x',24);b.cylinder(-1.28,1.89,0,.23,.055,C.darkSteel,'x',20);warm.box(-1.315,1.89,0,.012,.21,.32,0xe79035);
  for(const z of [-.29,.29]){b.cylinder(-1.30,2.43,z,.092,.035,C.brass,'x',16);b.cylinder(-1.323,2.43,z,.074,.018,0xe5dcc5,'x',16);b.box(-1.34,2.44,z,.013,.061,.010,C.black,[.3,0,0]);}
  b.pipe([[-1.33,1.68,-.39],[-1.33,2.26,-.39],[-1.33,2.32,.34]],.025,C.brass);b.pipe([[-1.37,2.25,0],[-1.60,2.50,.12]],.027,C.red);for(const z of [-.62,.62]){b.box(-1.81,1.92,z,.30,.09,.28,0x66503b);b.cylinder(-1.81,1.69,z,.042,.40,C.darkSteel);}
  b=driver;
  // Original placeholder driver in the open right-side cab window. No final character asset is implied.
  b.box(-1.74,2.20,.61,.29,.38,.28,0x263d48);b.box(-1.74,2.45,.67,.37,.39,.29,0x40545d);
  for(const x of [-1.84,-1.64]){b.box(x,1.85,.59,.12,.36,.13,0x2b363e);b.box(x,1.64,.65,.14,.09,.24,0x242b2b);}
  b.box(-1.74,2.67,.72,.14,.12,.15,0xc79572);const headBatch=new GeometryBatch(steamCrewMap(driverHeightM),'driver-head');headBatch.box(-1.74,2.82,.78,.28,.28,.26,0xd6ab83);
  headBatch.box(-1.74,2.91,.66,.29,.14,.09,0x5e554c);headBatch.box(-1.74,2.82,.93,.072,.06,.052,0xc79572);
  for(const x of [-1.81,-1.67]){headBatch.box(x,2.86,.916,.033,.033,.015,0x292c28);headBatch.box(x,2.89,.919,.055,.018,.015,0x70675b);}
  headBatch.box(-1.74,2.74,.921,.13,.018,.018,0x7e6450);
  headBatch.box(-1.74,2.985,.78,.39,.052,.36,0x172a34);headBatch.box(-1.74,3.035,.76,.33,.07,.30,0x314451);headBatch.box(-1.74,2.963,.93,.36,.035,.16,0x182832);headBatch.box(-1.74,3.005,.936,.047,.045,.014,0xc9b57a);
  for(const x of [-1.95,-1.53]){b.box(x,2.47,.75,.12,.31,.13,0x40545d);b.box(x,2.34,.91,.12,.1,.32,0x40545d);b.box(x,2.34,1.085,.12,.095,.12,0xd6ab83);}
  // Original eight-wheel tender: two four-wheel bogies, leaf springs, water tank and open coal bunker.
  b=fixed;fixed.map=STEAM_MAPS.tender;fixed.tag='tender';
  for(const x of [-6.60,-4.25])for(const z of [-.52,.52]){b.box(x,.86,z,1.52,.19,.13,C.black);b.box(x,.99,z,1.40,.065,.17,C.darkSteel);}
  b.box(-5.28,1.10,0,4.75,.20,2.03,C.black);b.box(-5.28,1.26,0,4.64,.13,2.04,C.darkSteel);b.box(-7.66,1.11,0,.15,.33,2.15,C.red);b.box(-2.91,1.13,0,.12,.27,2.05,C.red);
  b.box(-5.95,1.94,0,3.38,1.28,1.96,C.green);b.box(-5.91,2.61,0,3.50,.10,2.03,C.edge);b.box(-3.72,1.76,0,1.18,.91,1.95,C.green);
  for(const sign of [-1,1]){
    const z=sign*1.02;b.box(-4.77,2.29,z,2.03,.90,.09,C.green);b.box(-4.15,2.76,z,2.05,.10,.14,C.edge);
    b.box(-5.93,1.40,z,3.39,.08,.08,C.darkSteel);b.box(-5.93,2.46,z,3.40,.045,.08,C.darkSteel);
    for(let x=-7.50;x<-3.0;x+=.24){b.sphere(x,1.41,z+sign*.01,.017,C.steel);if(x<-4.4)b.sphere(x,2.46,z+sign*.01,.017,C.darkSteel);}
    for(const x of [-7.50,-6.43,-5.32,-4.45]){b.box(x,1.91,z,.044,1.05,.028,C.darkSteel);for(let y=1.58;y<2.45;y+=.23)b.sphere(x,y,z+sign*.020,.016,C.steel);}
    fixed.map=null;fixed.tag='tender-axleboxes';for(const x of STEAM_SPEC.tenderAxles){const y=TRACK.railHead+STEAM_SPEC.tenderRadius,z=sign*(TRACK.wheelAxisZ+.075);b.box(x,y,z,.37,.34,.18,C.black);b.cylinder(x,y,z+sign*.105,.091,.05,C.brass,'z',12);for(let j=0;j<4;j++)b.box(x,y+.21+j*.033,z,.73-j*.10,.027,.19,C.darkSteel);}fixed.map=STEAM_MAPS.tender;fixed.tag='tender';
    b.pipe([[-3.16,1.40,sign*1.0],[-3.16,2.65,sign*1.0]],.026,C.brass);for(let j=0;j<3;j++)b.box(-3.19,.65+j*.24,sign*1.00,.37,.060,.22,C.darkSteel);
    b.box(-6.08,2.01,z+sign*.035,1.27,.43,.023,C.black);makeLabel(b,'WD 280',-6.59,2.13,z+sign*.055,.046);
  }
  b.box(-3.10,2.36,0,.08,.86,1.99,C.green);b.box(-3.10,2.80,0,.13,.08,2.06,C.edge);
  b.cylinder(-6.66,2.71,0,.34,.12,C.black,'y',24);b.cylinder(-6.66,2.79,0,.29,.055,C.darkSteel,'y',24);b.pipe([[-6.80,2.83,0],[-6.80,2.91,0],[-6.53,2.91,0],[-6.53,2.83,0]],.020,C.brass);
  // Deterministic angular coal pieces, with a raised mound rather than a painted rectangle.
  let seed=280;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<112;i++){const x=-5.20+rand()*1.96,z=(rand()-.5)*1.68,height=2.63+.26*Math.max(0,1-((x+4.16)/1.10)**2-(z/.94)**2);b.sphere(x,height+(rand()-.5)*.12,z,.13+rand()*.10,[0x1b201b,0x2c3028,0x3d4035,0x232823][i%4],[1,.65+rand()*.45,.85]);}
  // Tender rear ladder, lamp sockets, buffers, drawbar and articulated-looking hoses.
  for(const z of [-.76,.76]){b.cylinder(-7.84,1.13,z,.095,.25,C.darkSteel,'x');b.cylinder(-7.98,1.13,z,.17,.06,C.black,'x',20);}
  for(const z of [-.36,.36])b.pipe([[-7.72,1.34,z],[-7.72,2.72,z]],.027,C.darkSteel);for(let y=1.42;y<2.73;y+=.25)b.pipe([[-7.76,y,-.36],[-7.76,y,.36]],.024,C.steel);
  fixed.map=STEAM_MAPS.coupling;fixed.tag='coupling';
  b.box(-2.55,1.08,0,.77,.10,.21,C.darkSteel);b.pipe([[-2.12,1.43,.46],[-2.51,1.19,.46],[-2.97,1.38,.46]],.031,C.black);b.box(-2.53,1.51,0,.78,.054,1.20,C.darkSteel);
  fixed.map=STEAM_MAPS.tender;fixed.tag='tender-grime';upper.map=STEAM_MAPS.accessories;upper.tag='boiler-grime';
  // Deliberate grime/streak plates stay on the metal, not pasted-on external textures.
  for(const sign of [-1,1]){for(const x of [-7.20,-6.31,-5.58])b.box(x,1.60,sign*1.009,.11,.43,.009,C.soot);for(const x of [-.5,.4,1.4,2.3])upper.box(x,1.59,sign*.80,.13,.045,.14,C.rust);}
  // Lamp on front running plate. Warm lens is separate to share one emissive material with firebox.
  b=upper;upper.map=STEAM_MAPS.lamp;upper.tag='lamp';warm.map=STEAM_MAPS.lamp;warm.tag='lamp-warm';
  b.box(4.20,1.64,0,.25,.34,.25,C.black);b.cylinder(4.24,1.94,0,.184,.25,C.black,'x',24);b.torus(4.382,1.94,0,.162,.018,C.brass,'x');warm.cylinder(4.392,1.94,0,.146,.023,0xffe0a0,'x',24);b.pipe([[4.19,2.09,-.12],[4.19,2.18,-.12],[4.19,2.18,.12],[4.19,2.09,.12]],.020,C.darkSteel);
  const calibratedHead=steamCrewMap(driverHeightM)(CREW_SPEC.driverHead);
  const headGeometry=headBatch.geometry();headGeometry.translate(...calibratedHead.map(v=>-v));
  const driverHead=new THREE.Mesh(headGeometry,material);driverHead.name='Original placeholder driver head and peaked cap';
  driverHead.position.fromArray(calibratedHead);driverHead.castShadow=driverHead.receiveShadow=true;bodyContents.add(driverHead);
  const crew={driverHead,pose:driverCrewPose({velocity:0,station:{remaining:0}})};
  function updateCrew(view){Object.assign(crew.pose,driverCrewPose(view));driverHead.rotation.y=crew.pose.yaw;return crew.pose;}
  root.add(fixed.mesh(material,'Fixed chassis cylinders and coal-water tender'));
  bodyContents.add(upper.mesh(material,'Batched riveted locomotive upper body'));
  const driverBody=driver.mesh(material,'Adult-scaled original driver body');bodyContents.add(driverBody);
  bodyContents.add(glass.mesh(new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.31,metalness:.22,roughness:.15,depthWrite:false,side:THREE.DoubleSide}),'Cab glazing'));
  bodyContents.add(warm.mesh(new THREE.MeshStandardMaterial({vertexColors:true,emissive:0xffa533,emissiveIntensity:1.15,roughness:.3}),'Amber headlamp and firebox glow'));
  const lamp=new THREE.SpotLight(0xffda88,150,34,Math.PI*.16,.78,1.3);lamp.position.fromArray(STEAM_MAPS.lamp([4.40,1.94,0]));lamp.target.position.set(24,.25,0);bodyContents.add(lamp,lamp.target);
  const driverBatch=makeWheelBatch(STEAM_SPEC.driverRadius,8,true,material),guideBatch=makeWheelBatch(STEAM_SPEC.guideRadius,2,false,material),tenderBatch=makeWheelBatch(STEAM_SPEC.tenderRadius,8,false,material);root.add(driverBatch,guideBatch,tenderBatch);
  const wheels=[];for(const [kind,axles,radius,batch] of [['driver',STEAM_SPEC.driverAxles,STEAM_SPEC.driverRadius,driverBatch],['guide',STEAM_SPEC.guideAxles,STEAM_SPEC.guideRadius,guideBatch],['tender',STEAM_SPEC.tenderAxles,STEAM_SPEC.tenderRadius,tenderBatch]]){let instance=0;for(const x of axles)for(const sign of [-1,1]){const group=new THREE.Group();group.name=kind+' wheel';group.position.set(x,STEAM_SPEC.railHead+radius,sign*TRACK.wheelAxisZ);group.userData={kind,radius,sign,batch,instance:instance++};wheels.push(group);}}
  const rods=new THREE.InstancedMesh(unitBox,new THREE.MeshStandardMaterial({color:0xb2b7ad,metalness:.72,roughness:.34}),18);rods.name='Distance-driven coupled rods and piston slides';rods.castShadow=rods.receiveShadow=true;rods.frustumCulled=false;root.add(rods);
  const pinGeometry=new THREE.CylinderGeometry(.058,.058,.045,12);pinGeometry.rotateX(Math.PI/2);const pins=new THREE.InstancedMesh(pinGeometry,new THREE.MeshStandardMaterial({color:0xb09759,metalness:.65,roughness:.4}),12);pins.name='Animated crank and crosshead pin caps';pins.castShadow=true;pins.frustumCulled=false;root.add(pins);
  const pose=new THREE.Object3D(),crank=STEAM_SPEC.crankRadius,driverY=STEAM_SPEC.railHead+STEAM_SPEC.driverRadius,rodLength=STEAM_SPEC.mainRodLength;
  const motion={angle:0,crankPins:[],crossheads:[],distance:0};
  function update(distance=0){
    const d=Number.isFinite(distance)?distance:0;motion.angle=-d/STEAM_SPEC.driverRadius;motion.distance=d;motion.crankPins=[];motion.crossheads=[];
    for(const wheel of wheels){const{kind,radius,sign,batch,instance}=wheel.userData,angle=-d/radius+(kind==='driver'&&sign<0?Math.PI/2:0);wheel.rotation.z=angle;pose.position.copy(wheel.position);pose.rotation.set(0,sign<0?Math.PI:0,angle+(sign<0?Math.PI:0),'ZYX');pose.scale.set(1,1,1);pose.updateMatrix();batch.setMatrixAt(instance,pose.matrix);}
    let rodIndex=0,pinIndex=0;
    const bar=(a,b,width=.078,depth=.060)=>{pose.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);pose.rotation.set(0,0,Math.atan2(b[1]-a[1],b[0]-a[0]));pose.scale.set(Math.hypot(b[0]-a[0],b[1]-a[1]),width,depth);pose.updateMatrix();rods.setMatrixAt(rodIndex++,pose.matrix);};
    const pin=(x,y,z)=>{pose.position.set(x,y,z);pose.rotation.set(0,0,0);pose.scale.set(1,1,1);pose.updateMatrix();pins.setMatrixAt(pinIndex++,pose.matrix);};
    for(const sign of [-1,1]){
      const angle=motion.angle+(sign<0?Math.PI/2:0),dx=Math.cos(angle)*crank,dy=Math.sin(angle)*crank,z=sign*1.055,points=STEAM_SPEC.driverAxles.map(x=>[x+dx,driverY+dy,z]);motion.crankPins.push(points.map(p=>p.slice()));
      for(let i=0;i<3;i++)bar(points[i],points[i+1]);for(const p of points)pin(p[0],p[1],z+sign*.05);
      // A real slider-crank solution keeps the main rod's length invariant throughout a turn.
      const drive=points[1],slideY=driverY,slideX=drive[0]+Math.sqrt(rodLength*rodLength-(slideY-drive[1])**2),slide=[slideX,slideY,z+sign*.095];motion.crossheads.push(slide.slice());
      bar([drive[0],drive[1],slide[2]],slide,.093,.066);bar([slideX-.17,slideY,slide[2]],[slideX+.17,slideY,slide[2]],.18,.13);bar([slideX,slideY,slide[2]],[STEAM_AUTHORING.cylinderX,slideY,slide[2]],.052,.052);
      bar([1.56,slideY+.16,slide[2]],[2.81,slideY+.16,slide[2]],.044,.065);bar([1.56,slideY-.16,slide[2]],[2.81,slideY-.16,slide[2]],.044,.065);
      bar([points[2][0],points[2][1]+.10,sign*1.23],[STEAM_AUTHORING.cylinderX-.19,slideY+.34,sign*1.23],.036,.033);pin(drive[0],drive[1],slide[2]+sign*.050);pin(slideX,slideY,slide[2]+sign*.081);
    }
    for(const batch of [driverBatch,guideBatch,tenderBatch,rods,pins])batch.instanceMatrix.needsUpdate=true;
  }
  const bodyPoint=new THREE.Vector3(),bodyPivot=new THREE.Vector3(...pivot);
  function applyBodyPose(){
    const s=bodyMotion.state;body.position.set(pivot[0],pivot[1]+s.heave,pivot[2]+s.lateral);body.rotation.set(s.roll,0,s.pitch,'XYZ');body.updateMatrix();return s;
  }
  function updateBodyMotion(view,dt=0){bodyMotion.update(view,dt);return applyBodyPose();}
  function resetBodyMotion(view={}){bodyMotion.reset(view);return applyBodyPose();}
  // Only transform points attached to the upper locomotive. Cylinders stay in the fixed frame.
  // The output remains train-local: callers apply train.root.matrixWorld once, at emission time.
  function transformBodyPoint(point,out=[]){return bodyPoint.fromArray(point).sub(bodyPivot).applyQuaternion(body.quaternion).add(body.position).toArray(out);}
  function fillSteamEmitters(output={}){for(const name of ['chimney','cylinderLeft','cylinderRight']){const target=output[name]||(output[name]=[]);if(name==='chimney')transformBodyPoint(STEAM_SOCKETS[name],target);else for(let i=0;i<3;i++)target[i]=STEAM_SOCKETS[name][i];}return output;}
  const calibration={...STEAM_CALIBRATION,boilerCenter:[steamBodyX(1),STEAM_BOILER_CENTER_Y,0],cabRearDatumX:STEAM_CAB_REAR_X,cabFloorY:STEAM_CAB_FLOOR_Y,emitters:STEAM_SOCKETS,emitterSpace:'Calibrated train-local metres; chimney/whistle follow upper body, cylinders fixed. World must apply train matrix once.',wheelContact:{axisZ:TRACK.wheelAxisZ,innerGauge:TRACK.gauge,railHead:TRACK.railHead,treadRadius:STEAM_SPEC.driverRadius,flangeAdditionalRadius:.028,geometryRadialSegments:64}};
  update(0);
  return{root,wheels,brakes:[],motion,update,updateCrew,crew,body,bodyMotion,updateBodyMotion,resetBodyMotion,transformBodyPoint,fillSteamEmitters,emitters:STEAM_SOCKETS,driverBody,proof:{original:true,calibration,emitters:STEAM_SOCKETS,brakeShoeOffset:STEAM_BRAKE_SHOE_OFFSET,bodyMotion:Object.assign(bodyMotion.proof,{moving:'Locomotive boiler, cab, driver, glazing, warm lens and headlamp with its target',fixed:'Frames, wheel axes, cylinders, mechanical rods, tender and all coaches',batches:{fixedParts:fixed.parts,upperParts:upper.parts},extraDrawCalls:2}),placeholderDriver:{visible:true,heightM:driverHeightM,heightDefinition:'sole to hair top; hat additional',withCapHeightM:driverHeightM*STEAM_AUTHORING.driverOriginalWithCap/STEAM_AUTHORING.driverOriginalStature,floorY:STEAM_CAB_FLOOR_Y,position:calibratedHead,cap:'peaked',side:'right-platform',openWindow:true,animatedPart:'original head and cap',movingFacing:'+X',platformFacing:'+Z',pose:crew.pose},source:'Original procedural geometry; no copied mesh or image assets',wheelArrangement:'2-8-0',leadingWheels:2,drivingWheels:8,trailingWheels:0,tenderWheels:8,locomotiveAxles:5,tenderAxles:4,count:18,wheels:18,driverRadius:STEAM_SPEC.driverRadius,guideRadius:STEAM_SPEC.guideRadius,tenderRadius:STEAM_SPEC.tenderRadius,cylinderDimensions:'19 x 28 in',chimney:STEAM_SPEC.chimney.slice(),coalPieces:112,staticParts:fixed.parts+upper.parts+driver.parts,staticTriangles:(fixed.p.length+upper.p.length+driver.p.length)/9,rodInstances:18,drawCalls:11,rodMotion:'Distance-driven quartered wheels and constant-length slider crank',livery:'Weathered soot black and dark green, red buffer beams, brass details'}};
}
