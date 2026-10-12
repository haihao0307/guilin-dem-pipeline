import{a6TenderMap,a6TenderHalfWidth,A6_TENDER_GLSL}from'./a6-tender-domain.mjs';
import {createTenderFrontMother} from './tender-front-mother.mjs';
// Dedicated native tender structure. Self-owned analytical plates, folded
// boundaries, apertures and functional joints; no reference mesh is imported.
export const TENDER_DESIGN=Object.freeze({lengthM:7.30,widthM:2.60,floorZM:1.42,shoulderZM:3.63,rimZM:3.82,wallM:.026,deckM:.045,rearDoorWidthM:.92,rearDoorHeightM:2.15,rearDoorBottomZM:1.54,portholeRadiusM:.148,coalLengthM:5.28,coalWidthM:2.19,coalFill:.68,coalPieces:320,sourceStatus:'Dedicated structural reconstruction from observed tank/bunker/corridor-access details; internal water and corridor layout remain unverified, new88 engineering datums retained.'});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=n=>{let v=Math.imul(n^0x9e3779b9,0x85ebca6b);v^=v>>>13;v=Math.imul(v,0xc2b2ae35);return((v^(v>>>16))>>>0)/4294967296};
export function tenderDomain(p,x,y,z){
 const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
 const gaps=[Math.abs(Math.abs(y)-a6TenderHalfWidth(x,z)),Math.abs(Math.abs(x)-p.lengthM/2),Math.abs(z-p.shoulderZM)].sort((a,b)=>a-b),edge=gaps[1];
 const runoff=Math.exp(-Math.abs(Math.abs(y)-a6TenderHalfWidth(x,z))/.04)*clamp((p.shoulderZM-z)/2.2,0,1);
 const coalContact=smooth(-p.lengthM/2+1.42,-p.lengthM/2+1.58,x)*(1-smooth(p.coalWidthM/2-.03,p.coalWidthM/2+.08,Math.abs(y)))*smooth(p.shoulderZM-.18,p.shoulderZM+.12,z);
 return{plateEdgeDistanceM:edge,rainRunoff:runoff,coalContact,coatingWear:Math.exp(-edge/.020)*.085*(1-coalContact*.8),handledRearHardware:x<-p.lengthM/2+.18?1:0};
}
// Independent smooth value noise, never baked into sparse mesh vertices.
const MICROFINISH_GLSL=`
float finishHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float finishNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(finishHash(i),finishHash(i+vec3(1,0,0)),f.x),mix(finishHash(i+vec3(0,1,0)),finishHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(finishHash(i+vec3(0,0,1)),finishHash(i+vec3(1,0,1)),f.x),mix(finishHash(i+vec3(0,1,1)),finishHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float filteredFinish(vec3 nativeM){vec3 q=nativeM*165.;float footprint=max(length(dFdx(q)),length(dFdy(q)));return(finishNoise(q)-.5)*(1.-smoothstep(.35,1.2,footprint));}
`;
function nativeMaterial(T,p,role){
 const styles={paint:{c:[.036,.082,.058],metal:0,rough:.37},steel:{c:[.23,.27,.28],metal:.88,rough:.34},brass:{c:[.53,.36,.11],metal:.91,rough:.29},rubber:{c:[.018,.022,.022],metal:0,rough:.87},coal:{c:[.010,.013,.014],metal:0,rough:.88},glass:{c:[.30,.40,.36],metal:0,rough:.12}},style=styles[role];
 const m=new T.MeshPhysicalMaterial({color:new T.Color(...style.c),metalness:style.metal,roughness:style.rough,clearcoat:role==='paint'?.45:0,clearcoatRoughness:.25,side:T.DoubleSide});m.name='tender mother / '+role+' / coating-joint-service-domain';
 if(role==='glass'){m.transparent=true;m.opacity=.38;m.depthWrite=false;}
 m.userData={mother:'tender-tank-bunker',role,shapeAndMaterialShareDomain:true,weatherIsAuthoredFieldNotMeasuredHistory:true,appearanceRevision:'native-coating-r04',coatingIsDielectric:role==='paint',baseLinearReflectance:style.c,parameterStatus:'Authored candidates; not calibrated measurements',fineFinish:'fragment footprint filtered; no vertex micrograin'};
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTender;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTender=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vTender;\n'+MICROFINISH_GLSL+A6_TENDER_GLSL);
  // Wear occurs along a meeting of plate boundaries, not across the entire side.
  const code=`vec3 tp=vTender;float sideDistance=abs(abs(tp.y)-a6TenderWidth(tp.x,tp.z));float endDistance=abs(abs(tp.x)-${p.lengthM/2});float shoulderDistance=abs(tp.z-${p.shoulderZM});float edge=max(min(sideDistance,endDistance),min(max(sideDistance,endDistance),shoulderDistance));float runoff=exp(-sideDistance/.04)*clamp((${p.shoulderZM}-tp.z)/2.2,0.,1.);float broad=.40+.60*exp(-pow((tp.x+.65)/1.3,2.));float coalContact=smoothstep(${-p.lengthM/2+1.42},${-p.lengthM/2+1.58},tp.x)*(1.-smoothstep(${p.coalWidthM/2-.03},${p.coalWidthM/2+.08},abs(tp.y)))*smoothstep(${p.shoulderZM-.18},${p.shoulderZM+.12},tp.z);float edgePolish=exp(-edge/.020);float exposed=edgePolish*.085*(1.-coalContact*.8);float grain=filteredFinish(tp);`;
  const color=role==='paint'?'diffuseColor.rgb*=1.-runoff*(.04+.055*broad);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.27,.29,.28),exposed);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.010,.012,.012),coalContact*.70);':role==='coal'?'diffuseColor.rgb*=.91+.18*finishNoise(tp*4.);':role==='steel'||role==='brass'?'diffuseColor.rgb*=1.-runoff*.05;':'';
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+code+color);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor'+(role==='glass'?'':'+runoff*.10+coalContact*.15-edgePolish*.035+grain*.026')+',.1,.98);');
  s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor='+(role==='paint'?'mix(metalnessFactor,.88,exposed)':'metalnessFactor')+'*(1.-coalContact*.90);');
 };
 m.customProgramCacheKey=()=>JSON.stringify(['a6-native-tender-coating-r01',role,p]);return m;
}
export function validateTender(p){for(const[k,v]of Object.entries(p))if(typeof v==='number'&&!Number.isFinite(v))throw Error('NONFINITE_TENDER:'+k);if(p.lengthM<6||p.widthM<2||p.floorZM<1.30||p.floorZM>=p.shoulderZM||p.shoulderZM>=p.rimZM||p.wallM<=0||p.coalWidthM>=p.widthM-2*p.wallM||p.coalLengthM>=p.lengthM-.5||p.rearDoorWidthM>=p.widthM*.55||p.rearDoorBottomZM+p.rearDoorHeightM>p.rimZM||p.coalFill<0||p.coalFill>1||!Number.isInteger(p.coalPieces)||p.coalPieces<32||p.coalPieces>1200)throw Error('INVALID_TENDER_STRUCTURE');return true}
export function createTenderMother(T,overrides={}){
 const p={...TENDER_DESIGN,...overrides};validateTender(p);const root=new T.Group();root.name='88 煤水车专用母函数：水箱 / 煤斗 / 后通道';const parts=[],M=Object.fromEntries(['paint','steel','brass','rubber','coal','glass'].map(k=>[k,nativeMaterial(T,p,k)])),front=p.lengthM/2,rear=-front;
 function add(g,mat,name,role){const mesh=new T.Mesh(g,M[mat]);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData={mother:'tender-tank-bunker',functionRole:role,shapeMaterialDomain:'tender native XYZ'};root.add(mesh);parts.push(mesh);return mesh}
 function box(at,size,mat,name,role){const g=new T.BoxGeometry(...size,Math.max(1,Math.ceil(size[0]*7)),Math.max(1,Math.ceil(size[1]*7)),Math.max(1,Math.ceil(size[2]*10)));g.translate(...at);return add(g,mat,name,role)}
 function cylinder(a,b,r,mat,name,role,segments=24){const A=new T.Vector3(...a),B=new T.Vector3(...b),v=B.clone().sub(A),g=new T.CylinderGeometry(r,r,v.length(),segments);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...A.add(B).multiplyScalar(.5).toArray());return add(g,mat,name,role)}
 function pipe(points,r,mat,name,role){return add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v))),Math.max(16,points.length*8),r,10,false),mat,name,role)}
 function arch(width,height,bottom=0){const r=width/2,s=new T.Shape();s.moveTo(-r,bottom);s.lineTo(r,bottom);s.lineTo(r,bottom+height-r);s.absarc(0,bottom+height-r,r,0,Math.PI,false);s.lineTo(-r,bottom);s.closePath();return s}
 function yzPlate(shape,depth,x,mat,name,role){const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:32});const pos=g.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getX(i),z=pos.getY(i),xx=pos.getZ(i);pos.setXYZ(i,x+xx,y,z)}g.computeVertexNormals();return add(g,mat,name,role)}
 // Continuous floor/side plates, top rolled shoulders and formed bunker edges.
 box([0,0,p.floorZM],[p.lengthM,p.widthM,p.deckM],'steel','tender continuous floor and load path','underframe mounting plane');
 for(const side of[-1,1]){
  box([0,side*(p.widthM/2-p.wallM/2),(p.floorZM+p.shoulderZM)/2],[p.lengthM,p.wallM,p.shoulderZM-p.floorZM],'paint','tank side plate '+side,'continuous tank shell');
  const xs=[rear+.05,front-.05],upper=xs.map(x=>[x,side*(p.widthM/2-.065),p.shoulderZM+.03]);pipe(upper,.065,'paint','rolled tank shoulder '+side,'formed rounded upper edge');
  for(const z of[p.floorZM+.14,p.shoulderZM-.14])pipe([[rear+.12,side*(p.widthM/2+.006),z],[front-.12,side*(p.widthM/2+.006),z]],.007,'brass','fine side lining boundary '+side+'/'+z,'physical narrow beading boundary');
  for(let i=0;i<34;i++){const x=rear+.12+i*(p.lengthM-.24)/33;for(const z of[p.floorZM+.065,p.shoulderZM-.065])cylinder([x,side*(p.widthM/2-.005),z],[x,side*(p.widthM/2+.009),z],.012,'steel','side plate rivet '+side+'/'+i+'/'+z,'plate fastening',12)}
 }
 const rearDeckEnd=rear+1.72;box([(rear+rearDeckEnd)/2,0,p.shoulderZM],[1.72,p.widthM-.09,p.deckM],'paint','rear water-service deck','water tank access surface');
 const coalFront=front-.23,coalRear=coalFront-p.coalLengthM,binWidth=p.coalWidthM;
 if(coalRear>rearDeckEnd)box([(rearDeckEnd+coalRear)/2,0,p.shoulderZM],[coalRear-rearDeckEnd+.02,p.widthM-.09,p.deckM],'paint','deck closure between filler deck and bunker','continuous tank service boundary');
 for(const side of[-1,1])box([(coalFront+coalRear)/2,side*(binWidth/2+p.wallM/2),(p.shoulderZM+p.rimZM)/2],[p.coalLengthM,p.wallM,p.rimZM-p.shoulderZM],'paint','coal bunker side coaming '+side,'keeps coal load within tank envelope');
 for(const x of[coalFront,coalRear])box([x,0,(p.shoulderZM+p.rimZM)/2],[p.wallM,binWidth+2*p.wallM,p.rimZM-p.shoulderZM],'paint','coal bunker end coaming '+x,'load retaining end');
 box([(coalFront+coalRear)/2,0,p.shoulderZM-.22],[p.coalLengthM,binWidth,p.deckM],'steel','coal bunker floor','separate load boundary above tank');
 // Rear tank panel has true apertures for the arched access and both portholes.
 const rearShape=new T.Shape();rearShape.moveTo(-p.widthM/2,p.floorZM);rearShape.lineTo(p.widthM/2,p.floorZM);rearShape.lineTo(p.widthM/2,p.shoulderZM);rearShape.quadraticCurveTo(p.widthM/2,p.rimZM,0,p.rimZM);rearShape.quadraticCurveTo(-p.widthM/2,p.rimZM,-p.widthM/2,p.shoulderZM);rearShape.closePath();
 const door=arch(p.rearDoorWidthM,p.rearDoorHeightM,p.rearDoorBottomZM);rearShape.holes.push(door);
 for(const y of[-.95,.95]){const h=new T.Path();h.absarc(y,p.shoulderZM-.23,p.portholeRadiusM,0,Math.PI*2,true);rearShape.holes.push(h)}yzPlate(rearShape,p.wallM,rear,'paint','rear bulkhead with arched passage and portholes','three real structural apertures');
 // Hollow arched frame and inset door retain a reveal; route behind it is not invented.
 const frame=arch(p.rearDoorWidthM+.10,p.rearDoorHeightM+.06),inner=arch(p.rearDoorWidthM,p.rearDoorHeightM,.03);frame.holes.push(inner);const fg=new T.ExtrudeGeometry(frame,{depth:.10,bevelEnabled:false,curveSegments:32});const fpos=fg.attributes.position;for(let i=0;i<fpos.count;i++){const y=fpos.getX(i),z=fpos.getY(i),x=fpos.getZ(i);fpos.setXYZ(i,rear-.075+x,y,z+p.rearDoorBottomZM)}fg.computeVertexNormals();add(fg,'steel','arched rear passage frame with thickness','rigid rear access frame');
 const dg=arch(p.rearDoorWidthM-.035,p.rearDoorHeightM-.04);const dm=yzPlate(dg,.022,rear+.06,'paint','inset hinged rear access door','closed service/access leaf');dm.geometry.translate(0,0,p.rearDoorBottomZM+.01);
 for(const z of[p.rearDoorBottomZM+.35,p.rearDoorBottomZM+1.25]){box([rear-.018,-p.rearDoorWidthM/2-.027,z],[.045,.07,.18],'steel','rear door hinge leaf '+z,'door to frame joint');cylinder([rear-.047,-p.rearDoorWidthM/2-.03,z-.09],[rear-.047,-p.rearDoorWidthM/2-.03,z+.09],.017,'steel','rear door hinge pin '+z,'hinge axis')}
 box([rear-.025,p.rearDoorWidthM*.30,p.rearDoorBottomZM+.94],[.05,.16,.04],'steel','rear door latch and keep','door closure');
 for(const y of[-.95,.95]){
  const z=p.shoulderZM-.23,ring=new T.LatheGeometry([[p.portholeRadiusM,-.018],[p.portholeRadiusM+.026,-.018],[p.portholeRadiusM+.026,.025],[p.portholeRadiusM,.025],[p.portholeRadiusM,-.018]].map(v=>new T.Vector2(...v)),48);ring.rotateZ(Math.PI/2);ring.translate(rear-.016,y,z);add(ring,'brass','rear porthole retaining ring '+y,'window frame around actual aperture');
  const glass=new T.CircleGeometry(p.portholeRadiusM-.008,48);glass.rotateY(Math.PI/2);glass.translate(rear+.012,y,z);add(glass,'glass','rear porthole glazing '+y,'glazed rear aperture');
  for(let i=0;i<6;i++){const zz=p.rearDoorBottomZM+.15+i*.31;box([rear-.105,y,zz],[.22,.24,.025],'steel','rear access tread '+y+'/'+i,'foot tread');for(const yy of[y-.075,y+.075])box([rear-.045,yy,zz-.03],[.10,.025,.075],'steel','rear tread support '+y+'/'+i+'/'+yy,'tread anchored to bulkhead')}
  pipe([[rear-.12,y*1.10,p.rearDoorBottomZM+.12],[rear-.12,y*1.10,p.shoulderZM-.15]],.019,'steel','rear vertical handrail '+y,'continuous handhold');for(const zz of[p.rearDoorBottomZM+.22,p.shoulderZM-.25])cylinder([rear,y*1.10,zz],[rear-.12,y*1.10,zz],.016,'steel','handrail standoff '+y+'/'+zz,'rail-to-bulkhead mounting');
 }
 // Raised service filler has an open neck, cap and hinge, with a connected deck.
 const fillerX=rear+.81,neckProfile=[[.145,0],[.181,0],[.181,.11],[.145,.11],[.145,0]],neck=new T.LatheGeometry(neckProfile.map(v=>new T.Vector2(...v)),48);neck.rotateX(Math.PI/2);neck.translate(fillerX,0,p.shoulderZM+.11);add(neck,'steel','water filler open neck and flange','water service connection');
 cylinder([fillerX,0,p.shoulderZM+.12],[fillerX,0,p.shoulderZM+.15],.205,'brass','hinged water filler lid','closed filler service cap',48);box([fillerX-.16,0,p.shoulderZM+.145],[.07,.25,.04],'steel','filler lid hinge bracket','cap-to-neck joint');
 // Curved front shelter, not a flat cuboid, and its two attached support cheeks.
 const pp=[],ii=[],N=48;for(let k=0;k<=N;k++){const a=Math.PI*k/N,y=Math.cos(a)*1.02,z=p.rimZM-.11+Math.sin(a)*.18;for(const x of[coalFront-.72,coalFront+.06])pp.push(x,y,z)}for(let k=0;k<N;k++){const a=k*2;ii.push(a,a+1,a+3,a,a+3,a+2)}const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute(pp,3));cg.setIndex(ii);cg.computeVertexNormals();add(cg,'paint','formed front bunker shelter canopy','curved sheet over front access');for(const side of[-1,1])box([coalFront-.30,side*1.02,p.rimZM-.18],[.72,p.wallM,.14],'steel','canopy side mounting cheek '+side,'shelter supported by bunker');
 // A closed native bulk volume supports fragments; no floating scatter over an
 // empty box. Fill and appearance derive from this same bounded height field.
 const coalHeight=(x,y)=>p.shoulderZM-.22+p.deckM/2+p.coalFill*(.25*(1-.52*(2*y/binWidth)**2)+.035*Math.sin(x*7.1+y*3.7)*Math.sin(x*3.3-y*11.));
 if(p.coalFill>0){const nx=72,ny=32,pos=[],idx=[];for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){const x=coalRear+(coalFront-coalRear)*i/nx,y=-binWidth/2+binWidth*j/ny;pos.push(x,y,coalHeight(x,y))}for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const k=i*(ny+1)+j;idx.push(k,k+ny+1,k+ny+2,k,k+ny+2,k+1)}const edge=[];for(let i=0;i<=nx;i++)edge.push(i*(ny+1));for(let j=1;j<=ny;j++)edge.push(nx*(ny+1)+j);for(let i=nx-1;i>=0;i--)edge.push(i*(ny+1)+ny);for(let j=ny-1;j>0;j--)edge.push(j);const bottom=pos.length/3;for(const k of edge)pos.push(pos[k*3],pos[k*3+1],p.shoulderZM-.22+p.deckM/2);for(let i=0;i<edge.length;i++){const j=(i+1)%edge.length;idx.push(edge[i],bottom+i,bottom+j,edge[i],bottom+j,edge[j])}const centre=pos.length/3;pos.push((coalFront+coalRear)/2,0,p.shoulderZM-.22+p.deckM/2);for(let i=0;i<edge.length;i++)idx.push(centre,bottom+(i+1)%edge.length,bottom+i);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();add(g,'coal','continuous coal bulk and bounded fill surface','native fuel-load volume with supported surface fragments');}
 // Deterministic native coal fragments share fill/height/grain fields.
 const coalRoot=new T.Group();coalRoot.name='native coal load from fill-domain';root.add(coalRoot);for(let i=0;i<(p.coalFill>0?p.coalPieces:0);i++){const u=hash(i*13+7),v=hash(i*17+9),x=coalRear+.12+u*(p.coalLengthM-.24),y=(v-.5)*(binWidth-.22),edge=1-Math.pow(2*(v-.5),2),r=.055+.060*hash(i*31),z=coalHeight(x,y)+r*.18,g=new T.IcosahedronGeometry(r,0);const a=g.attributes.position;for(let j=0;j<a.count;j++){const vx=a.getX(j),vy=a.getY(j),vz=a.getZ(j),vkey=Math.round(vx*1e6)*73856093^Math.round(vy*1e6)*19349663^Math.round(vz*1e6)*83492791;const f=.78+.44*hash(i*997+vkey);a.setXYZ(j,vx*f+x,vy*f*(.65+.4*hash(i+8))+y,vz*f*(.5+.5*hash(i+4))+z)}g.computeVertexNormals();const m=new T.Mesh(g,M.coal);m.name='coal fragment '+i;m.castShadow=m.receiveShadow=true;m.userData={mother:'coal-load',fill:p.coalFill,shapeMaterialDomain:'native fill and fragment domain'};coalRoot.add(m);parts.push(m)}
 const frontAssembly=createTenderFrontMother(T,p);root.add(frontAssembly.root);parts.push(...frontAssembly.parts);
 for(const mesh of parts){const g=mesh.geometry,a=g.attributes.position;for(let i=0;i<a.count;i++)a.setXYZ(i,...a6TenderMap(a.getX(i),a.getY(i),a.getZ(i)));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();mesh.userData.a6UpperShoulderBinding=true;}
 root.userData={mother:'tender-tank-bunker',parameters:p,sourceBuffersUsed:false,meshIsTransientRenderOutput:true,internalWaterRoutingVerified:false,corridorInternalRouteVerified:false};
 const ports={frontCoupling:[front,0,1.05],rearCoupling:[rear,0,1.05],crewFrontAccess:[front,0,p.floorZM],rearDoor:[rear,0,p.rearDoorBottomZM],waterFill:[fillerX,0,p.shoulderZM+.15],frameMounts:[-2.45,-.82,.82,2.45].flatMap(x=>[-.55,.55].map(y=>[x,y,p.floorZM-p.deckM/2]))};
 return {root,parts,frontAssembly,ports,parameters:p,domain:(x,y,z)=>tenderDomain(p,x,y,z),coverageStatus:'dedicated-native-structure-candidate-not-approved'};
}
