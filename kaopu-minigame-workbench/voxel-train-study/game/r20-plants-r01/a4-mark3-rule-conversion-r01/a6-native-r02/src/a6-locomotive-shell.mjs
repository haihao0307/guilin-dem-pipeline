/**
 * A6-88 native forward-cab design R01.
 * Every point is generated from authored metre-domain functions. There is no
 * teacher geometry, source-fit transform, source residual or source loader.
 * The six-axle mechanical mother is supplied unchanged by the caller.
 */
import {A4_DIMENSIONS} from '../../student-native-r01/src/dimensions.mjs';
import {SurfaceBuilder,monotoneCurve,linspace,unit,cross} from '../../student-native-r01/src/surface-builder.mjs';
import {makePart,box,rod,ellipsoid,tube,ring,thickenSurface,add,mul,sub} from './a6-geometry.mjs';
export const A6_LOCOMOTIVE_DEFAULTS=Object.freeze({width:2.743,topHeight:4.03,cabShift:0});
export const A6_LOCOMOTIVE_LIMITS=Object.freeze({width:[2.66,2.84],topHeight:[3.98,4.15],cabShift:[-.15,.15]});
const NOSE=-1.10,END=12.10,FLOOR=2.30,GLASS_ANGLE=1.38,GLASS_THICKNESS=.014;
const DRIVER_AXES=Object.freeze([3.5814,5.7912,8.001]);
function parameters(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Expected A6 shell parameter object');
 for(const k of Object.keys(input))if(!(k in A6_LOCOMOTIVE_DEFAULTS))throw Error('Unknown A6 shell parameter '+k);
 const p={...A6_LOCOMOTIVE_DEFAULTS,...input};for(const[k,[lo,hi]]of Object.entries(A6_LOCOMOTIVE_LIMITS))if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('A6 '+k+' outside guarded design range');return p;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
export function createA6ShellSampler(input={}){
 const p=parameters(input),zs=[NOSE,-.70,0,.85,1.65,2.40,3.35,5.3,8.8,11.6,END];
 const width=monotoneCurve(zs,[.94,.99,1,1,1,1,1,1,1,1,.985].map(v=>v*p.width/2));
 const crown=monotoneCurve(zs,[1.85,2.06,2.47,2.66,3.35,3.89,4.03,4.03,4.03,4.03,4.00].map(v=>v*p.topHeight/4.03));
 const shoulder=monotoneCurve(zs,[1.70,1.78,2.08,2.16,2.28,2.34,2.35,2.35,2.35,2.35,2.35]);
 function sectionAt(z){z=clamp(z,NOSE,END);const[w,dw]=width(z),[top,dtop]=crown(z),[s,ds]=shoulder(z);return{z,halfWidth:w,crown:top,shoulder:s,dw,dtop,ds};}
 function upper(z,theta){const a=sectionAt(z),si=Math.sin(theta),co=Math.cos(theta),h=a.crown-a.shoulder;return{p:[a.halfWidth*si,a.shoulder+h*co,z],du:[a.dw*si,a.ds+(a.dtop-a.ds)*co,1],dv:[a.halfWidth*co,-h*si,0],uv:[(z-NOSE)/(END-NOSE),(theta+Math.PI/2)/Math.PI]};}
 function surfacePoint(z,theta){return upper(z,theta).p;}
 function surfaceNormal(z,theta){const q=upper(z,theta);return unit(cross(q.du,q.dv));}
 function rawSkirt(z){
  // A raised continuous mechanical opening leaves the complete exterior motion
  // visible. Three shallow circular crowns are real absent triangles, not decals.
  const front=1.18+.44*smooth((z+.55)/1.70);
  const completeExteriorMotion=1.18+.86*smooth((z+.35)/.84)+.13*smooth((z-2.0)/.8)-.55*smooth((z-10.60)/.85);
  let y=Math.max(front,completeExteriorMotion);
  for(const axis of DRIVER_AXES){const q=1.244**2-(z-axis)**2;if(q>0)y=Math.max(y,1.016+Math.sqrt(q));}
  return y;
 }
 function skirtEdge(z){const e=1e-5;return{y:rawSkirt(z),dy:(rawSkirt(clamp(z+e,NOSE,END))-rawSkirt(clamp(z-e,NOSE,END)))/(Math.min(END,z+e)-Math.max(NOSE,z-e))};}
 function halfWidthAt(y,z){const a=sectionAt(z);if(y>=a.shoulder){const c=clamp((y-a.shoulder)/(a.crown-a.shoulder),0,1);return a.halfWidth*Math.sqrt(Math.max(0,1-c*c));}const v=clamp((y-rawSkirt(z))/(a.shoulder-rawSkirt(z)),0,1);return a.halfWidth*(1-.075*(1-v)**2);}
 const front=theta=>.82+p.cabShift+.90*(theta/GLASS_ANGLE)**2;
 const rear=theta=>5.18+p.cabShift-.22*(theta/GLASS_ANGLE)**2;
 const frontDerivative=theta=>1.8*theta/GLASS_ANGLE**2;
 const rearDerivative=theta=>-.44*theta/GLASS_ANGLE**2;
 return{parameters:p,sectionAt,surfacePoint,surfaceNormal,upper,skirtEdge,halfWidthAt,glassFront:front,glassRear:rear,glassFrontDerivative:frontDerivative,glassRearDerivative:rearDerivative,glassAngle:GLASS_ANGLE,domain:[NOSE,END]};
}
function paramUpper(sample,start,end,dstart,dend){return(u,theta)=>{const a=start(theta),b=end(theta),z=a+(b-a)*u,dzdu=b-a,dzdt=dstart(theta)+(dend(theta)-dstart(theta))*u,q=sample.upper(z,theta);return{p:q.p,du:mul(q.du,dzdu),dv:add(q.dv,mul(q.du,dzdt)),uv:q.uv};};}
function shellGeometry(s){
 const b=new SurfaceBuilder(),allZ=linspace(NOSE,END,220),theta=linspace(-GLASS_ANGLE,GLASS_ANGLE,80);
 const constant=v=>()=>v,zero=()=>0;
 b.patch('continuous-short-nose-to-windscreen',paramUpper(s,constant(NOSE),s.glassFront,zero,s.glassFrontDerivative),linspace(0,1,80),theta,0,1);
 b.patch('continuous-canopy-rear-to-tender-interface',paramUpper(s,s.glassRear,constant(END),s.glassRearDerivative,zero),linspace(0,1,120),theta,0,1);
 for(const side of[-1,1]){
  const a=side<0?-Math.PI/2:GLASS_ANGLE,c=side<0?-GLASS_ANGLE:Math.PI/2;
  b.patch('continuous-roof-shoulder-'+side,s.upper,allZ,linspace(a,c,16),0,1);
  b.patch('raised-skirt-three-true-wheel-arches-'+side,(z,v)=>{const a=s.sectionAt(z),e=s.skirtEdge(z),h=a.shoulder-e.y;if(h<=.02)throw Error('Wheel/motion opening exceeds shoulder');return{p:[side*a.halfWidth*(1-.075*(1-v)**2),e.y+h*v,z],du:[side*a.dw*(1-.075*(1-v)**2),e.dy+(a.ds-e.dy)*v,1],dv:[side*a.halfWidth*.15*(1-v),h,0],uv:[(z-NOSE)/(END-NOSE),v]};},allZ,linspace(0,1,12),0,-side);
 }
 for(const[z,normal,label]of[[NOSE,[0,0,-1],'blunt-rounded-short-nose-terminal'],[END,[0,0,1],'rear-interface-bulkhead']]){
  const a=s.sectionAt(z),e=s.skirtEdge(z).y,q=[[-a.halfWidth*.925,e,z],...linspace(-Math.PI/2,Math.PI/2,100).map(t=>s.surfacePoint(z,t)),[a.halfWidth*.925,e,z]];b.polygon(label,q,normal);
 }
 return makePart('a6-continuous-body-with-open-canopy-and-wheel-arches','paint',b,{assembly:'exterior-shell',canopyIsActualOpening:true,mechanicsDeleted:false,hasFlatCabRoof:false,threeDrivingWheelArchAxes:DRIVER_AXES,innerShellNotGenerated:true});
}
function canopy(s){const b=new SurfaceBuilder();b.patch('embedded-curved-panoramic-glass',paramUpper(s,s.glassFront,s.glassRear,s.glassFrontDerivative,s.glassRearDerivative),linspace(0,1,88),linspace(-GLASS_ANGLE,GLASS_ANGLE,80),0,1);return thickenSurface('a6-14mm-closed-curved-canopy',b.build(),GLASS_THICKNESS,'glass',{assembly:'canopy',actualBodyOpening:true,opacityShortcut:false,engineeringGlassCertification:false});}
function contour(s){const t=s.glassAngle,path=[];for(const a of linspace(-t,t,80))path.push(s.surfacePoint(s.glassFront(a),a));for(const z of linspace(s.glassFront(t),s.glassRear(t),100).slice(1))path.push(s.surfacePoint(z,t));for(const a of linspace(t,-t,80).slice(1))path.push(s.surfacePoint(s.glassRear(a),a));for(const z of linspace(s.glassRear(-t),s.glassFront(-t),100).slice(1))path.push(s.surfacePoint(z,-t));return path;}
function surfaceTube(s,name,points,r,material,offset=.018,metadata={}){return tube(name,points.map(([z,t])=>add(s.surfacePoint(z,t),mul(s.surfaceNormal(z,t),offset))),r,material,{assembly:'exterior-detail',...metadata});}
function buildInterior(s){
 const p=s.parameters,parts=[],driverParts=[],shift=p.cabShift,eyeZ=3.2314+shift,seatZ=eyeZ+.10,cx=-.54;
 const cab=part=>{part.metadata={...part.metadata,assembly:'cab-interior',designOnly:true};parts.push(part);return part;};
 const human=part=>{part.metadata={...part.metadata,assembly:'driver',humanStatus:'Authored seated ergonomic witness, not a scanned or anatomically validated person',partOfDriver:true};parts.push(part);driverParts.push(part);return part;};
 cab(box('a6-cab-structural-floor',[0,FLOOR-.045,3.61+shift],[2.26,.09,2.64],'blackPaint',{floorTopM:FLOOR}));
 cab(box('a6-cab-floor-finish',[0,FLOOR+.009,3.61+shift],[2.20,.018,2.60],'interior'));
 cab(box('a6-driver-seat-cushion',[cx,FLOOR+.26,seatZ],[.49,.12,.49],'seat'));
 cab(ellipsoid('a6-driver-seat-rounded-back',[cx,FLOOR+.65,seatZ+.22],[.255,.36,.075],'seat'));
 cab(rod('a6-driver-seat-pedestal',[cx,FLOOR+.01,seatZ],[cx,FLOOR+.20,seatZ],.058,'brushedMetal'));
 cab(box('a6-low-forward-control-desk',[cx,FLOOR+.64,seatZ-.65],[1.19,.12,.42],'blackPaint'));
 cab(box('a6-concealed-driver-footwell-front',[cx,FLOOR+.27,seatZ-.78],[1.20,.53,.11],'paint',{feetScreenedFromSide:true}));
 for(let i=0;i<4;i++){
  const x=cx-.43+i*.285;
  cab(rod('a6-driver-instrument-bezel-'+i,[x,FLOOR+.702,seatZ-.65],[x,FLOOR+.725,seatZ-.65],.073,'gold',{segments:32}));
  cab(rod('a6-driver-instrument-face-'+i,[x,FLOOR+.727,seatZ-.65],[x,FLOOR+.731,seatZ-.65],.061,'interior',{segments:32}));
  cab(rod('a6-driver-instrument-needle-'+i,[x,FLOOR+.735,seatZ-.65],[x+.031,FLOOR+.735,seatZ-.675],.003,'blackPaint',{segments:8}));
 }
 const wheelCenter=[cx,FLOOR+.80,seatZ-.36];
 cab(ring('a6-driver-control-wheel',wheelCenter,.178,.018,[0,.45,-1],'blackPaint'));
 cab(rod('a6-control-column',[cx,FLOOR+.49,seatZ-.62],wheelCenter,.027,'brushedMetal'));
 // Exactly one transverse switch row behind the occupant. No second rear seat.
 const switchZ=4.74+shift,switchY=FLOOR+.79;
 cab(box('a6-single-rear-switch-row',[0,switchY,switchZ],[2.02,.22,.12],'blackPaint',{rows:1,switchCount:9,controlLogic:'Static design controls only; no operating linkages claimed'}));
 for(let i=0;i<9;i++){
  const x=-.84+i*.21;
  cab(ring('a6-rear-switch-bezel-'+i,[x,switchY,switchZ-.067],.042,.006,[0,0,-1],'gold'));
  cab(rod('a6-rear-switch-toggle-'+i,[x,switchY-.015,switchZ-.075],[x,switchY+.025,switchZ-.14],.010,'brushedMetal',{segments:12}));
 }
 for(const side of[-1,1])cab(rod('a6-switch-row-support-'+side,[side*.89,FLOOR+.01,switchZ],[side*.89,switchY-.11,switchZ],.024,'brushedMetal'));
 // Seated pose generated at full authoring dimensions; legs remain below sill.
 human(ellipsoid('a6-driver-torso',[cx,FLOOR+.66,seatZ],[.195,.275,.135],'uniform'));
 human(ellipsoid('a6-driver-neck',[cx,FLOOR+.94,eyeZ+.07],[.060,.075,.061],'skin'));
 human(ellipsoid('a6-driver-head',[cx,FLOOR+1.065,eyeZ+.025],[.108,.137,.105],'skin'));
 human(ellipsoid('a6-driver-nose',[cx,FLOOR+1.06,eyeZ-.078],[.030,.030,.038],'skin'));
 human(ellipsoid('a6-driver-cap',[cx,FLOOR+1.18,eyeZ+.022],[.128,.046,.124],'uniform'));
 human(ellipsoid('a6-driver-cap-peak',[cx,FLOOR+1.169,eyeZ-.081],[.135,.014,.097],'blackPaint'));
 for(const side of[-1,1]){
  const x=cx+side*.145,shoulder=[x,FLOOR+.82,seatZ-.018],elbow=[x+side*.034,FLOOR+.70,seatZ-.21],hand=[cx+side*.155,FLOOR+.81,seatZ-.35];
  human(rod('a6-driver-upper-arm-'+side,shoulder,elbow,.064,'uniform',{r2:.052}));
  human(rod('a6-driver-forearm-'+side,elbow,hand,.051,'uniform',{r2:.039}));
  human(ellipsoid('a6-driver-hand-'+side,hand,[.044,.045,.060],'skin',{landmark:side<0?'leftHand':'rightHand'}));
  human(rod('a6-driver-thigh-'+side,[cx+side*.105,FLOOR+.38,seatZ],[cx+side*.105,FLOOR+.36,seatZ-.35],.074,'uniform',{r2:.063}));
  human(rod('a6-driver-shin-'+side,[cx+side*.105,FLOOR+.36,seatZ-.35],[cx+side*.105,FLOOR+.10,seatZ-.40],.058,'uniform',{r2:.046}));
  human(ellipsoid('a6-driver-hidden-boot-'+side,[cx+side*.105,FLOOR+.06,seatZ-.445],[.062,.055,.125],'blackPaint',{landmark:side<0?'leftFoot':'rightFoot'}));
 }
 const landmarks={eye:[cx,FLOOR+1.075,eyeZ-.065],head:[cx,FLOOR+1.065,eyeZ+.025],torso:[cx,FLOOR+.66,seatZ],leftHand:[cx-.155,FLOOR+.81,seatZ-.35],rightHand:[cx+.155,FLOOR+.81,seatZ-.35],leftFoot:[cx-.105,FLOOR+.06,seatZ-.445],rightFoot:[cx+.105,FLOOR+.06,seatZ-.445]};
 return{parts,driverParts,landmarks,seatZ,driverEyeStation:landmarks.eye[2],floor:FLOOR,switchZ};
}
function buildOutlets(s){
 const parts=[];
 for(const[i,z]of[7.1,8.55].entries()){
  const b=new SurfaceBuilder(),base=s.sectionAt(z).crown-.035,H=.49;
  const evalOutlet=(u,a,inside=false)=>{const q=smooth(u),dq=6*u*(1-u),rx=.285-.110*q-(inside?.025:0),rz=.355-.125*q-(inside?.025:0),drx=-.110*dq,drz=-.125*dq,co=Math.cos(a),si=Math.sin(a);return{p:[rx*co,base+H*u,z+.095*q+rz*si],du:[drx*co,H,.095*dq+drz*si],dv:[-rx*si,0,rz*co]};};
  b.patch('curved-taper-outlet-'+i,(u,a)=>evalOutlet(u,a),linspace(0,1,36),linspace(0,2*Math.PI,64),0,-1);
  b.patch('open-dark-outlet-inner-'+i,(u,a)=>evalOutlet(u,a,true),linspace(.40,1,20),linspace(0,2*Math.PI,64),0,1);
  b.patch('outlet-thick-open-rim-'+i,(a,v)=>{const outer=evalOutlet(1,a),inner=evalOutlet(1,a,true),d=sub(inner.p,outer.p);return{p:add(outer.p,mul(d,v)),du:outer.dv,dv:d};},linspace(0,2*Math.PI,64),[0,1],0,-1);
  parts.push(makePart('a6-curved-steam-outlet-'+(i+1),'paint',b,{assembly:'steam-outlets',count:2,topNarrowerThanBase:true,curvedTaper:true,openMouth:true,workingSteamSystem:false}));
  parts.push(tube('a6-outlet-gold-rolled-lip-'+i,linspace(0,2*Math.PI,80).map(a=>evalOutlet(1,a).p),.010,'gold',{assembly:'steam-outlets'}));
  parts.push(ellipsoid('a6-outlet-dark-recess-'+i,[0,base+.19,z+.02],[.20,.012,.24],'blackPaint',{assembly:'steam-outlets',recessNotEmitting:true}));
 }
 return parts;
}
function buildDetails(s){
 const parts=[],outline=contour(s);
 parts.push(tube('a6-flush-curved-canopy-seal',outline,.019,'rubber',{assembly:'canopy-seal',followsActualOpening:true}));
 // Sparse, fine longitudinal joins rather than a rectangular cage.
 for(const z of[3.88+s.parameters.cabShift,4.62+s.parameters.cabShift])parts.push(surfaceTube(s,'a6-slender-curved-canopy-bow-'+z,linspace(-GLASS_ANGLE,GLASS_ANGLE,60).map(t=>[z,t]),.006,'brushedMetal',.015,{assembly:'canopy-frame'}));
 for(const side of[-1,1]){
  parts.push(surfaceTube(s,'a6-long-forward-windscreen-wiper-'+side,linspace(0,1,45).map(u=>[1.62+s.parameters.cabShift+1.25*u,side*(.50+.28*u)]),.013,'blackPaint',.026,{assembly:'wipers',sweepAnimation:false}));
  // Raised waist-line follows the shell without entering the motion openings.
  const line=linspace(NOSE+.10,END,240).map(z=>{const a=s.sectionAt(z),y=Math.max(s.skirtEdge(z).y+.075,Math.min(a.shoulder+.09,a.crown-.08));return[side*(s.halfWidthAt(y,z)+.010),y,z];});
  parts.push(tube('a6-restrained-gold-waistline-'+side,line,.012,'gold',{assembly:'waistline'}));
  // Three swept gills per side, aft of the actual glass and above the wordmark.
  for(let i=0;i<3;i++){
   const z=5.55+i*.27,poly=[[z-.07,3.49],[z+.10,3.79],[z+.21,3.79],[z+.04,3.49]],b=new SurfaceBuilder();
   b.patch('native-recessed-gill-'+side+'-'+i,(u,v)=>{const zz=(1-u)*((1-v)*poly[0][0]+v*poly[1][0])+u*((1-v)*poly[3][0]+v*poly[2][0]),y=3.49+.30*v,dy=.30,dzu=.11,dzv=.17,x=side*(s.halfWidthAt(y,zz)+.004),e=1e-5,dxdy=side*(s.halfWidthAt(y+e,zz)-s.halfWidthAt(y-e,zz))/(2*e),dxdz=side*(s.halfWidthAt(y,zz+e)-s.halfWidthAt(y,zz-e))/(2*e);return{p:[x,y,zz],du:[dxdz*dzu,0,dzu],dv:[dxdy*dy+dxdz*dzv,dy,dzv]};},linspace(0,1,6),linspace(0,1,14),0,-side);
   parts.push(makePart('a6-swept-shark-gill-'+side+'-'+i,'blackPaint',b,{assembly:'gills',behindGlass:true,ventStatus:'Visual recessed insert; no internal ventilation circuit simulated'}));
  }
  // Conformal sealed headlamp: shallow oval recessed dark housing and bright projectors.
  const z=-.18,t=side*.69,origin=s.surfacePoint(z,t),normal=s.surfaceNormal(z,t),b=new SurfaceBuilder(),basisU=unit(s.upper(z,t).du),basisV=unit(cross(normal,basisU));
  const circle=linspace(0,2*Math.PI,60).slice(0,-1).map(a=>add(add(origin,mul(normal,.015)),add(mul(basisU,.28*Math.cos(a)),mul(basisV,.105*Math.sin(a)))));b.polygon('sealed-flush-headlamp-'+side,circle,normal);
  parts.push(makePart('a6-sealed-oval-headlamp-housing-'+side,'blackPaint',b,{assembly:'lamps',sealedDesign:true}));
  parts.push(tube('a6-headlamp-metal-lip-'+side,[...circle,circle[0]],.010,'brushedMetal',{assembly:'lamps'}));
  for(const d of[-.12,.10]){const center=add(add(origin,mul(basisU,d)),mul(normal,.026));parts.push(rod('a6-headlamp-projector-'+side+'-'+d,center,add(center,mul(normal,.008)),.049,'lamp',{assembly:'lamps',segments:28}));}
 }
 // Ladder is deliberately retracted under the rear footplate, not advertised as operational.
 for(const side of[-1,1])parts.push(rod('a6-hidden-retracted-ladder-rail-'+side,[side*.26,1.44,9.95],[side*.26,2.10,9.95],.022,'brushedMetal',{assembly:'access-ladder',state:'retracted',deploymentTested:false}));
 for(const y of[1.50,1.75,2.0])parts.push(rod('a6-hidden-retracted-ladder-tread-'+y,[-.26,y,9.95],[.26,y,9.95],.018,'brushedMetal',{assembly:'access-ladder',state:'retracted'}));
 return parts;
}
export function buildA6LocomotiveShell(input={}){
 const s=createA6ShellSampler(input),cab=buildInterior(s),parts=[shellGeometry(s),canopy(s),...buildDetails(s),...buildOutlets(s),...cab.parts];
 const evidence={schema:'kaopu-native-a6-forward-cab/1',units:'m',coordinates:'x lateral, y above rail, z rearward from first leading axle',sourceRuntimeDependencies:[],sourcePointOrResidualBytes:0,teacherUsedAtRuntime:false,sourceFitUsed:false,mechanicsGeneratedOrModified:false,mechanicsPolicy:'Caller keeps all 338 native mechanical parts and six native driving-wheel meshes unchanged',verifiedAxleReferences:{axisZ:[...A4_DIMENSIONS.axisZ],driveDiameter:A4_DIMENSIONS.driveDiameter},noseFrontZ:NOSE,bodyRearZ:END,defaultWidth:2.743,commonRoofCrown:s.parameters.topHeight,continuousCurvedRoof:true,opaqueSheetBehindGlass:false,canopy:{frontCrownZ:s.glassFront(0),rearCrownZ:s.glassRear(0),sideFrontZ:s.glassFront(GLASS_ANGLE),sideRearZ:s.glassRear(GLASS_ANGLE),sideAngle:GLASS_ANGLE,thicknessM:GLASS_THICKNESS},driver:{...cab.landmarks,eyeAheadOfFirstDrivingAxleM:DRIVER_AXES[0]-cab.landmarks.eye[2],seatStationZ:cab.seatZ,floorTopY:FLOOR,fullAuthoringScale:true,sideVisibilityCheckRequired:true,poseStatus:'Authored ergonomic witness; no anatomical or operating certification'},rearSwitchRows:1,rearSwitchCount:9,steamOutlets:{count:2,eachNarrowerTopWiderBase:true,curvedTaper:true,steamFunctionSimulated:false},designAssumptions:['All shell, cabin, floor, seat, controls, lights and steam-outlet dimensions are explicit design assumptions, not historical A4 measurements.','The eye point is above and slightly forward of the first fixed driving axle, following the latest user placement.','Three genuinely open wheel arches are cut into an already elevated mechanical opening; a painted dark wheel overlay is never used.','The nominal curved shoulder/crown are C1 functions; triangulation is only a sampling of them.','Cab static floor/skin and sightline clearance are tested against generated geometry separately. No suspension travel or kinematic/thermal envelope is certified.'],parameterLimits:A6_LOCOMOTIVE_LIMITS,engineeringValidated:false,kinematicsSolved:false};
 return{parts,cabParts:cab.parts,driverParts:cab.driverParts,parameters:s.parameters,evidence};
}
