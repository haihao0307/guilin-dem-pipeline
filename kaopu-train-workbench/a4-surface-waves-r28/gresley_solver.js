/* Independent numerical study of the retained inferred Gresley installation.
 * Reads exact retained scalar constructors, but does not modify SCENE, DYNAMIC,
 * shaders, geometry, installation, or any public artifact. No middle chest.
 * All lengths in metres. The inferred X=0, Y=1.48 slider line remains inferred.
 */
(function(root){
'use strict';
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>Math.hypot(...a);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const xz=p=>[p[0],p[2]];
function extractReference(scene) {
 const src=scene.sources.motion;
 function constructor(name,kind){
  const fn='motion_valve_'+name;
  const m=src.match(new RegExp('float '+fn+'\\(vec3 p\\) \\{ return '+kind+'\\(([^\\n]+)\\); \\}'));
  if(!m)throw Error('Retained constructor missing: '+fn);
  const points=[...m[1].matchAll(/vec3\(([^)]+)\)/g)].map(v=>v[1].split(',').map(Number));
  if(points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw Error('Non-numeric retained endpoint: '+fn);
  return {sourceLine:m[0],points};
 }
 const names={O:'fixed_pivot_pin',R:'right_input_pin',L:'left_input_pin',A:'long_end_pin',C:'equal_centre_pin',B:'equal_left_end_pin',E:'equal_middle_end_pin',M:'middle_valve_crosshead_pin'};
 const pins={},source={};
 for(const[k,n]of Object.entries(names)){const p=constructor('gresley_'+n,'mDisc');pins[k]=p.points[0];source[k]=p.sourceLine;}
 const specs={two_to_one_lever:['A','C','O'],equal_lever:['B','E','C'],right_short_link:['R','A'],left_short_link:['L','B'],middle_short_link:['M','E']};
 for(const[n,ks]of Object.entries(specs)){
  const c=constructor('gresley_'+n,'mFlatRod');source[n]=c.sourceLine;
  ks.forEach((k,i)=>{if(norm(sub(c.points[i],pins[k]))>1e-14)throw Error('Retained rod/pin mismatch: '+n+'/'+k);});
  if(!/\),1,vec3\(/.test(c.sourceLine))throw Error('Retained central rod is not in the XZ plane');
 }
 const spindle=constructor('middle_valve_spindle_inferred_horizontal','mCapsule');
 source.spindle=spindle.sourceLine;
 const [rear,front]=spindle.points;
 if(norm(sub(front,pins.M))>1e-14||rear[0]!==front[0]||rear[1]!==front[1])throw Error('Retained middle spindle line changed');
 const planeY=pins.O[1];
 if(Object.values(pins).some(p=>p[1]!==planeY))throw Error('Retained central points not coplanar');
 const P=Object.fromEntries(Object.entries(pins).map(([k,p])=>[k,xz(p)]));
 const lengths={long:norm(sub(P.A,P.O)),short:norm(sub(P.C,P.O)),equalLeft:norm(sub(P.B,P.C)),equalMiddle:norm(sub(P.E,P.C)),rightLink:norm(sub(P.A,P.R)),leftLink:norm(sub(P.B,P.L)),middleLink:norm(sub(P.E,P.M)),middleSpindle:norm(sub(front,rear))};
 const ratio=lengths.short/lengths.long,equalRatio=lengths.equalMiddle/lengths.equalLeft;
 if(norm(sub(P.C,sub(P.O,mul(sub(P.A,P.O),ratio))))>1e-14||norm(sub(P.E,sub(P.C,mul(sub(P.B,P.C),equalRatio))))>1e-14)throw Error('Retained lever collinearity failed');
 return {planeY,pins,P,lengths,ratio,equalRatio,spindle:{rear,front},source,
   rightBranch:Math.sign(cross(sub(P.R,P.O),sub(P.A,P.O))),
   leftBranch:Math.sign(cross(sub(P.L,P.C),sub(P.B,P.C))),
   middleBranch:Math.sign(P.M[1]-P.E[1])};
}
function circle(c,r,d,s,branch){
 const v=sub(d,c),distance=norm(v);
 if(!(distance>0)||!(distance>Math.abs(r-s)&&distance<r+s))throw Error('Circle closure infeasible or singular');
 const u=mul(v,1/distance),a=(r*r-s*s+distance*distance)/(2*distance),h2=r*r-a*a;
 if(!(h2>0))throw Error('Circle tangent or infeasible');
 const point=add(add(c,mul(u,a)),mul([-u[1],u[0]],branch*Math.sqrt(h2)));
 return {point,heightSquared:h2,distance,lowerTriangleMargin:distance-Math.abs(r-s),upperTriangleMargin:r+s-distance};
}
function createGresleySolver(scene,dynamic,outside){
 const ref=extractReference(scene),r=ref.lengths,p=ref.P;
 const outsideRef={left:outside.pose(dynamic.referenceTheta,'left'),right:outside.pose(dynamic.referenceTheta,'right')};
 const offsets={left:p.L[1]-outsideRef.left.spindleZ,right:p.R[1]-outsideRef.right.spindleZ};
 if(Math.abs(offsets.left-offsets.right)>1e-13)throw Error('Unequal retained outside front-pin offsets');
 function solveInputs(leftZ,rightZ){
  if(!Number.isFinite(leftZ)||!Number.isFinite(rightZ))throw Error('Finite outside spindle positions required');
  const R=[p.R[0],rightZ+offsets.right],L=[p.L[0],leftZ+offsets.left],O=p.O.slice();
  const long=circle(O,r.long,R,r.rightLink,ref.rightBranch),A=long.point;
  const C=sub(O,mul(sub(A,O),ref.ratio));
  const equal=circle(C,r.equalLeft,L,r.leftLink,ref.leftBranch),B=equal.point;
  const E=sub(C,mul(sub(B,C),ref.equalRatio)),dx=p.M[0]-E[0],middleHeightSquared=r.middleLink**2-dx**2;
  if(!(middleHeightSquared>0))throw Error('Middle inferred slider closure infeasible or singular');
  const M=[p.M[0],E[1]+ref.middleBranch*Math.sqrt(middleHeightSquared)];
  const yz={O,R,L,A,C,B,E,M};
  const pins=Object.fromEntries(Object.entries(yz).map(([k,v])=>[k,[v[0],ref.planeY,v[1]]]));
  const rear=[pins.M[0],ref.planeY,pins.M[2]-r.middleSpindle];
  const pairs={long:['A','O'],short:['C','O'],equalLeft:['B','C'],equalMiddle:['E','C'],rightLink:['A','R'],leftLink:['B','L'],middleLink:['E','M']};
  const errors=Object.fromEntries(Object.entries(pairs).map(([n,[a,b]])=>[n,Math.abs(norm(sub(yz[a],yz[b]))-r[n])]));
  const qLeft=leftZ-4.1,qRight=rightZ-4.1,datum=4.1+offsets.left,qMiddle=M[1]-datum;
  return {pins,spindle:{rear,front:pins.M.slice()},qLeft,qRight,qMiddle,
   idealComparisonOnly:-(qLeft+qRight),finiteMinusIdeal:qMiddle+qLeft+qRight,
   diagnostics:{rightCircle:long,leftCircle:equal,middleHeightSquared,lengthErrors:errors,maxLengthError:Math.max(...Object.values(errors))},
   scope:'finite continuation of retained inferred installation only',wholeAcceptance:false,middleChestPresent:false,rendererModified:false};
 }
 function fromOutside(left,right){
  if(left.side!=='left'||right.side!=='right'||left.theta!==right.theta)throw Error('Outside poses must share the same absolute theta and correct sides');
  const s=solveInputs(left.spindleZ,right.spindleZ);return {...s,theta:left.theta,outsideResidual:Math.max(left.maxEquationResidual,right.maxEquationResidual)};
 }
 let cachedTheta=null,cachedPose;
 function pose(theta){
  if(theta!==cachedTheta){cachedPose=fromOutside(outside.pose(theta,'left'),outside.pose(theta,'right'));cachedTheta=theta;}
  return cachedPose;
 }
 function atTime(Time,Location={},ObjectState={}){const state=dynamic.state(Time,Location,ObjectState);return {...pose(state.theta),Time,wholeState:state};}
 // Persistent, explicit allowlist. No middle chest, cylinder, installation shift,
 // pin-axis relayering, arbitrary Gresley-like identifier, or fallback transform.
 const whitelist=Object.freeze({
  'valve/gresley_two_to_one_lever':Object.freeze({type:'rigid',anchor:'O',direction:'A'}),
  'valve/gresley_equal_lever':Object.freeze({type:'rigid',anchor:'C',direction:'B'}),
  'valve/gresley_right_short_link':Object.freeze({type:'rigid',anchor:'R',direction:'A'}),
  'valve/gresley_left_short_link':Object.freeze({type:'rigid',anchor:'L',direction:'B'}),
  'valve/gresley_middle_short_link':Object.freeze({type:'rigid',anchor:'M',direction:'E'}),
  'valve/gresley_fixed_pivot_pin':Object.freeze({type:'fixed',anchor:'O'}),
  'valve/gresley_right_input_pin':Object.freeze({type:'translation',anchor:'R'}),
  'valve/gresley_left_input_pin':Object.freeze({type:'translation',anchor:'L'}),
  'valve/gresley_long_end_pin':Object.freeze({type:'translation',anchor:'A'}),
  'valve/gresley_equal_centre_pin':Object.freeze({type:'translation',anchor:'C'}),
  'valve/gresley_equal_left_end_pin':Object.freeze({type:'translation',anchor:'B'}),
  'valve/gresley_equal_middle_end_pin':Object.freeze({type:'translation',anchor:'E'}),
  'valve/gresley_middle_valve_crosshead_pin':Object.freeze({type:'translation',anchor:'M'}),
  'valve/middle_valve_spindle_inferred_horizontal':Object.freeze({type:'translation',anchor:'M'})
 });
 function classify(partId){
  if(!Object.prototype.hasOwnProperty.call(whitelist,partId))return {status:'unsupported',reason:'Not one of the 14 retained central fields; no inferred replacement or guessed installation'};
  const spec=whitelist[partId];
  return {status:spec.type==='fixed'?'fixed':'moving',...spec,scope:'retained inferred horizontal installation only',physicalAcceptance:false};
 }
 function transformFor(partId,thetaOrPose){
  const spec=classify(partId);if(spec.status==='unsupported')return null;
  const current=typeof thetaOrPose==='number'?pose(thetaOrPose):thetaOrPose;
  if(!current||!current.pins)throw Error('Central transform requires a numeric theta or central closure pose');
  const from=xz(ref.pins[spec.anchor]),to=xz(current.pins[spec.anchor]);let angle=0;
  if(spec.type==='rigid'){
   const u=sub(xz(ref.pins[spec.direction]),from),v=sub(xz(current.pins[spec.direction]),to);
   angle=Math.atan2(v[1],v[0])-Math.atan2(u[1],u[0]);
  }
  const c=Math.cos(angle),s=Math.sin(angle);
  return {partId,theta:current.theta,plane:'XZ',unchangedAxis:'Y',fromXZ:from,toXZ:to,angle,
   forwardXZ:[c,-s,to[0]-c*from[0]+s*from[1],s,c,to[1]-s*from[0]-c*from[1]],
   inverseXZ:[c,s,from[0]-c*to[0]-s*to[1],-s,c,from[1]+s*to[0]-c*to[1]],
   classification:spec,wholeMechanicalAcceptance:false,middleChestCreated:false};
 }
 function transformPoint(point,frame,inverse=false){
  if(!frame)return point.slice();
  const m=inverse?frame.inverseXZ:frame.forwardXZ;
  return [m[0]*point[0]+m[1]*point[2]+m[2],point[1],m[3]*point[0]+m[4]*point[2]+m[5]];
 }
 return Object.freeze({reference:ref,outsideInputOffsets:offsets,solveInputs,fromOutside,pose,atTime,whitelist,classify,transformFor,transformPoint});
}
if(typeof module!=='undefined'&&module.exports)module.exports={extractReference,createGresleySolver,circle};
else root.createGresleySolver=createGresleySolver;
})(typeof window!=='undefined'?window:globalThis);
