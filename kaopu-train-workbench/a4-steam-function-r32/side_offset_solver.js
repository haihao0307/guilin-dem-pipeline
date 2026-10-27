/* R29 side-offset installation family. Self-authored finite analytic solver.
 * Official evidence supports separate middle power/valve bores and frame slots,
 * NOT these dimensions, coordinate sign, horizontal axis or pivot position.
 * Requires the unchanged outside-valve solver and one common absolute theta.
 * Does not mutate the retained scene, create apertures or claim whole acceptance.
 */
(function(root){
'use strict';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k),norm=a=>Math.hypot(...a),xz=p=>[p[0],p[2]];
function circle(c,r,d,s,branch){
 const v=sub(d,c),distance=norm(v),lower=distance-Math.abs(r-s),upper=r+s-distance;
 if(!(distance>0&&lower>0&&upper>0))throw Error('Infeasible or singular finite circle closure');
 const u=mul(v,1/distance),a=(r*r-s*s+distance*distance)/(2*distance),h2=r*r-a*a;
 if(!(h2>0))throw Error('Singular circle intersection');
 return {point:add(add(c,mul(u,a)),mul([-u[1],u[0]],branch*Math.sqrt(h2))),heightSquared:h2,distance,lowerTriangleMargin:lower,upperTriangleMargin:upper};
}
function createSideOffsetGresleySolver(scene,dynamic,outside,options={}){
 if(!dynamic||!outside||typeof outside.pose!=='function')throw Error('Common dynamic and outside solver required');
 const cfg={middleX:.390,planeY:1.48,pivotZ:5.55,inputFrontDatumZ:5.25,outsideSpindleDatumZ:4.1,middleLinkLength:.3,middleSpindleLength:1.15,middleAxisTilt:0,...options};
 for(const [k,v]of Object.entries(cfg))if(!Number.isFinite(v))throw Error('Finite installation parameter required: '+k);
 if(Math.abs(cfg.middleAxisTilt)>1e-14)throw Error('Inclined middle axis needs an evidenced transfer joint; fixed-plane revolute chain cannot accept it');
 const initial={left:outside.pose(dynamic.referenceTheta,'left'),right:outside.pose(dynamic.referenceTheta,'right')};
 const leftX=initial.left.lateral,rightX=initial.right.lateral,Y=cfg.planeY;
 for(const side of ['left','right'])if(Math.abs(initial[side].pins.valveCrossheadPin[1]-Y)>1e-12)throw Error('Outside valve axes fix the horizontal gear plane; independent Y shift is unsupported');
 const inputOffset=cfg.inputFrontDatumZ-cfg.outsideSpindleDatumZ;
 if(Math.abs(inputOffset-1.15)>1e-12)throw Error('Outside front pin offset must preserve the retained 1.15 m spindles');
 const ox=(cfg.middleX+rightX+leftX)/3,oz=cfg.pivotZ,link=oz-cfg.inputFrontDatumZ;
 const nominal={O:[ox,oz],R:[rightX,cfg.inputFrontDatumZ],L:[leftX,cfg.inputFrontDatumZ],A:[rightX,oz],C:[(cfg.middleX+leftX)/2,oz],B:[leftX,oz],E:[cfg.middleX,oz],M:[cfg.middleX,oz-cfg.middleLinkLength]};
 const lengths={long:rightX-ox,short:(rightX-ox)/2,equalLeft:(cfg.middleX-leftX)/2,equalMiddle:(cfg.middleX-leftX)/2,rightLink:link,leftLink:link,middleLink:cfg.middleLinkLength,middleSpindle:cfg.middleSpindleLength};
 if(Object.values(lengths).some(v=>!(v>0)))throw Error('Non-positive candidate link length');
 const pairs={long:['A','O'],short:['C','O'],equalLeft:['B','C'],equalMiddle:['E','C'],rightLink:['A','R'],leftLink:['B','L'],middleLink:['E','M']};
 function solveInputs(leftZ,rightZ){
  if(!Number.isFinite(leftZ)||!Number.isFinite(rightZ))throw Error('Finite spindle inputs required');
  const O=nominal.O.slice(),R=[rightX,rightZ+inputOffset],L=[leftX,leftZ+inputOffset];
  const a=circle(O,lengths.long,R,lengths.rightLink,+1),A=a.point,C=sub(O,mul(sub(A,O),.5));
  const b=circle(C,lengths.equalLeft,L,lengths.leftLink,-1),B=b.point,E=sub(C,sub(B,C));
  const dx=cfg.middleX-E[0],middleHeightSquared=lengths.middleLink**2-dx**2;
  if(!(middleHeightSquared>0))throw Error('Middle short link cannot reach side-offset slider or is tangent');
  const M=[cfg.middleX,E[1]-Math.sqrt(middleHeightSquared)],P={O,R,L,A,C,B,E,M};
  const pins=Object.fromEntries(Object.entries(P).map(([k,v])=>[k,[v[0],Y,v[1]]]));
  const lengthErrors=Object.fromEntries(Object.entries(pairs).map(([n,[u,v]])=>[n,Math.abs(norm(sub(P[u],P[v]))-lengths[n])]));
  const qLeft=leftZ-cfg.outsideSpindleDatumZ,qRight=rightZ-cfg.outsideSpindleDatumZ,qMiddle=M[1]-nominal.M[1];
  return {pins,spindle:{rear:[cfg.middleX,Y,M[1]-lengths.middleSpindle],front:pins.M.slice()},qLeft,qRight,qMiddle,
   idealComparisonOnly:-(qLeft+qRight),finiteMinusIdeal:qMiddle+qLeft+qRight,
   diagnostics:{rightCircle:a,leftCircle:b,middleHeightSquared,lengthErrors,maxLengthError:Math.max(...Object.values(lengthErrors))},
   scope:'inferred horizontal side-offset finite conjugated family',wholeAcceptance:false,historicalDimensions:false,middleChestPresent:false};
 }
 function fromOutside(left,right){if(left.side!=='left'||right.side!=='right'||left.theta!==right.theta)throw Error('Outer inputs must share the same absolute theta and sides');return {...solveInputs(left.spindleZ,right.spindleZ),theta:left.theta,outsideResidual:Math.max(left.maxEquationResidual,right.maxEquationResidual)};}
 let cachedTheta=null,cachedPose;
 function pose(theta){if(theta!==cachedTheta){cachedPose=fromOutside(outside.pose(theta,'left'),outside.pose(theta,'right'));cachedTheta=theta;}return cachedPose;}
 const refPose=fromOutside(initial.left,initial.right),reference={planeY:Y,pins:refPose.pins,P:Object.fromEntries(Object.entries(refPose.pins).map(([k,v])=>[k,xz(v)])),lengths,ratio:.5,equalRatio:1,spindle:refPose.spindle,rightBranch:1,leftBranch:-1,middleBranch:-1,nominal,config:cfg,sourceStatus:'candidate numerical dimensions inferred; source profile sizes must be inspected from original reference'};
 const whitelist={
  'valve/gresley_two_to_one_lever':{type:'rigid',anchor:'O',direction:'A'},'valve/gresley_equal_lever':{type:'rigid',anchor:'C',direction:'B'},
  'valve/gresley_right_short_link':{type:'rigid',anchor:'R',direction:'A'},'valve/gresley_left_short_link':{type:'rigid',anchor:'L',direction:'B'},'valve/gresley_middle_short_link':{type:'rigid',anchor:'M',direction:'E'},
  'valve/gresley_fixed_pivot_pin':{type:'fixed',anchor:'O'},'valve/gresley_right_input_pin':{type:'translation',anchor:'R'},'valve/gresley_left_input_pin':{type:'translation',anchor:'L'},
  'valve/gresley_long_end_pin':{type:'translation',anchor:'A'},'valve/gresley_equal_centre_pin':{type:'translation',anchor:'C'},'valve/gresley_equal_left_end_pin':{type:'translation',anchor:'B'},
  'valve/gresley_equal_middle_end_pin':{type:'translation',anchor:'E'},'valve/gresley_middle_valve_crosshead_pin':{type:'translation',anchor:'M'},'valve/middle_valve_spindle_inferred_horizontal':{type:'translation',anchor:'M'}
 };
 function classify(id){const a=whitelist[id];return a?{...a,status:a.type==='fixed'?'fixed':'moving',historicalDimensions:false,physicalAcceptance:false}:{status:'unsupported'};}
 function transformFor(id,thetaOrPose){const spec=classify(id);if(spec.status==='unsupported')return null;const now=typeof thetaOrPose==='number'?pose(thetaOrPose):thetaOrPose;if(!now?.pins)throw Error('Candidate pose required');
  const from=xz(reference.pins[spec.anchor]),to=xz(now.pins[spec.anchor]);let angle=0;
  if(spec.type==='rigid'){const u=sub(xz(reference.pins[spec.direction]),from),v=sub(xz(now.pins[spec.direction]),to);angle=Math.atan2(v[1],v[0])-Math.atan2(u[1],u[0]);}
  const c=Math.cos(angle),s=Math.sin(angle);return {partId:id,theta:now.theta,plane:'XZ',unchangedAxis:'Y',fromXZ:from,toXZ:to,angle,
   forwardXZ:[c,-s,to[0]-c*from[0]+s*from[1],s,c,to[1]-s*from[0]-c*from[1]],inverseXZ:[c,s,from[0]-c*to[0]-s*to[1],-s,c,from[1]+s*to[0]-c*to[1]],classification:spec,wholeMechanicalAcceptance:false};
 }
 function transformPoint(p,f,inverse=false){if(!f)return p.slice();const m=inverse?f.inverseXZ:f.forwardXZ;return [m[0]*p[0]+m[1]*p[2]+m[2],p[1],m[3]*p[0]+m[4]*p[2]+m[5]];}
 function atTime(Time,Location={},ObjectState={}){const s=dynamic.state(Time,Location,ObjectState);return {...pose(s.theta),Time,wholeState:s};}
 return Object.freeze({config:Object.freeze(cfg),reference,nominal,solveInputs,fromOutside,pose,atTime,classify,whitelist,transformFor,transformPoint,outsideInputOffsets:{left:inputOffset,right:inputOffset}});
}
const api={createSideOffsetGresleySolver,circle};if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(root,api);
})(typeof window!=='undefined'?window:globalThis);
