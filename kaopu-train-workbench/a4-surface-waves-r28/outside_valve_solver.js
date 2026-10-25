/* Reconstructed inferred finite outside-valve closure. NOT recovered R20 generator.
 * Own retained scalar coefficients only; not A4 historical measurements.
 * This module does not edit shaders or attach itself to DYNAMIC.
 * Controls: common theta supplied by caller; retained reversing setting ONLY.
 * No reverser mapping, middle-valve mechanism or physical whole-train acceptance.
 */
(function(root){
'use strict';
const REF={
  "left": {
    "E": [
      1.169804032476048,
      -0.04409443949192207
    ],
    "J": [
      1.06224336408321,
      1.7526889928156242
    ],
    "U": [
      1.5490014591870458,
      4.082645247419837
    ],
    "L": [
      0.9797394208939174,
      4.416622389988536
    ],
    "V": [
      1.48,
      4.123127325306952
    ],
    "C": [
      0.9,
      3.8017714936278795
    ],
    "A": [
      1.3457208553597624,
      1.5146785427860692
    ],
    "H": [
      1.992517232944385,
      1.4502235511763384
    ],
    "T": [
      1.56,
      1.8
    ],
    "D": [
      1.3675009200555428,
      1.7898178325682585
    ],
    "B": [
      1.1445859366303164,
      0.30413434021975266
    ],
    "K": [
      2.21,
      1.0
    ],
    "Q": [
      [
        0.9955132718335802,
        0.09462201436875174
      ],
      [
        -0.09462201436875174,
        0.9955132718335802
      ]
    ],
    "sigma": -0.08383680358924032
  },
  "right": {
    "E": [
      0.9947532945835973,
      0.15858303033095505
    ],
    "J": [
      1.0850628697643372,
      1.9563160974548464
    ],
    "U": [
      1.5596640024236432,
      4.160722293260349
    ],
    "L": [
      0.9024359824285868,
      4.100296059442761
    ],
    "V": [
      1.48,
      4.153397901282459
    ],
    "C": [
      0.9,
      3.480300844953482
    ],
    "A": [
      1.358302989511583,
      1.592604355454721
    ],
    "H": [
      1.992517232944385,
      1.4502235511763384
    ],
    "T": [
      1.56,
      1.8
    ],
    "D": [
      1.379877383752161,
      1.8677598487910383
    ],
    "B": [
      0.685825340352334,
      -0.004090736675446463
    ],
    "K": [
      2.21,
      1.0
    ],
    "Q": [
      [
        0.9498742604713257,
        -0.31263219490969263
      ],
      [
        0.31263219490969263,
        0.9498742604713257
      ]
    ],
    "sigma": -0.08369670411332253
  }
};
const TAU=2*Math.PI, T=[1.56,1.8], axis=[1.016,0];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]], sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], scale=(a,s)=>[a[0]*s,a[1]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1], cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const rotate=(v,a)=>{let c=Math.cos(a),s=Math.sin(a);return[c*v[0]-s*v[1],s*v[0]+c*v[1]];};
const norm=a=>Math.hypot(...a), maxabs=a=>Math.max(...a.map(Math.abs));
function createOutsideValveSolver(dynamic){
 if(!dynamic||typeof dynamic.pose!=='function')throw Error('The common DYNAMIC.pose is required');
 const refs={};
 for(const side of ['left','right']){
  let r=REF[side],i=side==='left'?0:2,p=dynamic.pose(.4,i,0);
  if(norm(sub(p.b,r.B))>1e-10||norm(sub(add(p.s,[0,-0]),[1.016,r.C[1]]))>1e-10)throw Error('Reference crank/crosshead differs from retained geometry');
  refs[side]={...r,i,initial:[r.sigma,Math.atan2(r.U[1]-r.L[1],r.U[0]-r.L[0]),r.V[1]],
    q:Math.atan2(-(r.J[1]-r.T[1]),-(r.J[0]-r.T[0])),
    tailBranch:Math.sign(cross(sub(r.E,T),sub(r.J,T))),crossheadOffset:sub(r.C,p.s)};
 }
 function context(theta,side){
  if(!Number.isFinite(theta)||!refs[side])throw Error('Finite theta and left/right side required');
  const r=refs[side],p=dynamic.pose(theta,r.i,0),B=p.b.slice(),C=add(p.s,r.crossheadOffset);
  const E=add(axis,rotate(sub(r.E,axis),-(theta-.4))),v=sub(E,T),d=norm(v),u=scale(v,1/d);
  const a=(.5*.5-1.8*1.8+d*d)/(2*d),h2=.25-a*a;
  if(!(h2>1e-12))throw Error('Expansion tail branch is singular or infeasible');
  const J=add(add(T,scale(u,a)),scale([-u[1],u[0]],r.tailBranch*Math.sqrt(h2)));
  return {B,C,E,J,T:T.slice(),H:r.H.slice(),K:r.K.slice(),q:Math.atan2(-(J[1]-T[1]),-(J[0]-T[0])),tailHeightSquared:h2};
 }
 function points(x,c){
  const[sigma,gamma,vz]=x,D=add(T,rotate([2.3*Math.sin(sigma),2.3*(1-Math.cos(sigma))],c.q)),w=[Math.cos(gamma),Math.sin(gamma)];
  const V=[1.48,vz],U=add(V,scale(w,.08)),L=add(V,scale(w,-.58)),A=sub(scale(D,1.12),scale(U,.12));
  return {D,V,U,L,A};
 }
 function equations(x,c){
  const p=points(x,c),r=sub(p.U,p.D),n=sub(p.L,c.C),h=sub(p.A,c.H);
  return [dot(r,r)-2.3**2,dot(n,n)-.62**2,dot(h,h)-.65**2];
 }
 function jacobian(x,c){
  const[sigma,gamma]=x,p=points(x,c),dD=rotate([2.3*Math.cos(sigma),2.3*Math.sin(sigma)],c.q),dw=[-Math.sin(gamma),Math.cos(gamma)],dU=scale(dw,.08),dL=scale(dw,-.58),r=sub(p.U,p.D),n=sub(p.L,c.C),h=sub(p.A,c.H);
  return [[-2*dot(r,dD),2*dot(r,dU),2*r[1]],[0,2*dot(n,dL),2*n[1]],[2*dot(h,scale(dD,1.12)),2*dot(h,scale(dU,-.12)),-.24*h[1]]];
 }
 function solve3(A,b){
  let m=A.map((r,i)=>[...r,b[i]]);
  for(let k=0;k<3;k++){
   let best=k;for(let i=k+1;i<3;i++)if(Math.abs(m[i][k])>Math.abs(m[best][k]))best=i;
   if(Math.abs(m[best][k])<1e-12)throw Error('Closure Jacobian singular');
   [m[k],m[best]]=[m[best],m[k]];let pivot=m[k][k];for(let j=k;j<4;j++)m[k][j]/=pivot;
   for(let i=0;i<3;i++)if(i!==k){let f=m[i][k];for(let j=k;j<4;j++)m[i][j]-=f*m[k][j];}
  }return m.map(r=>r[3]);
 }
 function newton(c,guess){
  let x=guess.slice(),iterations=0;
  for(;iterations<24;iterations++){
   const f=equations(x,c),err=maxabs(f);if(err<2e-13)break;
   const dx=solve3(jacobian(x,c),f.map(v=>-v));let alpha=1,accepted=false;
   for(let tries=0;tries<14;tries++,alpha*=.5){let y=x.map((v,i)=>v+alpha*dx[i]);if(Math.abs(y[0])<=.2&&maxabs(equations(y,c))<err){x=y;accepted=true;break;}}
   if(!accepted)throw Error('Newton failed to reduce finite closure residual');
  }
  const residual=maxabs(equations(x,c));if(residual>1e-10||Math.abs(x[0])>.2)throw Error('Finite closure or slot limit failed');
  return {state:x,residual,iterations};
 }
 function pose(theta,side,previous){
  const c=context(theta,side),r=refs[side];let sol;
  if(previous){if(previous.side!==side)throw Error('Continuation side mismatch');sol=newton(c,previous.state);}
  else{
   // Reference-seeded, bounded continuation for arbitrary random-access time.
   // This is numerical closure at every step, not trajectory interpolation.
   let delta=((theta-.4+Math.PI)%TAU+TAU)%TAU-Math.PI,steps=Math.max(1,Math.ceil(Math.abs(delta)/.12)),x=r.initial;
   for(let k=1;k<=steps;k++){sol=newton(context(.4+delta*k/steps,side),x);x=sol.state;}
   sol=newton(c,x);
  }
  const yz={...c,...points(sol.state,c)};delete yz.q;delete yz.tailHeightSquared;
  const result={theta,side,lateral:side==='left'?-.98:.98,state:sol.state,slotAngle:sol.state[0],combinationAngle:sol.state[1],expansionAngle:c.q,spindleZ:sol.state[2],spindleDisplacement:sol.state[2]-4.1,yz,maxEquationResidual:sol.residual,iterations:sol.iterations,scope:'reconstructed_inferred_outside_only_fixed_reversing_setting',wholeAcceptance:false};
  const pinNames={B:'mainCrankPin',C:'crossheadDropPin',E:'eccentricPin',J:'expansionTailPin',T:'fixedTrunnion',H:'liftTopPin',K:'fixedReversingShaft',D:'dieBlockPin',V:'valveCrossheadPin',U:'combinationUpperPin',L:'combinationLowerPin',A:'radiusLiftPickupPin'};
  result.pins=Object.fromEntries(Object.entries(pinNames).map(([key,name])=>[name,[result.lateral,...yz[key]]]));
  result.rods={returnCrank:[result.pins.mainCrankPin,result.pins.eccentricPin],eccentricRod:[result.pins.eccentricPin,result.pins.expansionTailPin],radiusRod:[result.pins.radiusLiftPickupPin,result.pins.combinationUpperPin],unionLink:[result.pins.crossheadDropPin,result.pins.combinationLowerPin],liftingLink:[result.pins.radiusLiftPickupPin,result.pins.liftTopPin],liftingArm:[result.pins.fixedReversingShaft,result.pins.liftTopPin],combinationLever:[result.pins.combinationLowerPin,result.pins.combinationUpperPin],valveSpindle:[result.pins.valveCrossheadPin,[result.lateral,1.48,result.spindleZ+1.15]]};
  return result;
 }
 const rigidPairs={return_crank:['B','E'],eccentric_rod:['E','J'],radius_rod:['A','U'],union_link:['C','L'],lifting_link:['A','H'],combination_lever:['L','U']};
 const translations={crosshead_rigid_drop_arm:'C',main_crank_lateral_mount:'B',valve_spindle:'V',die_block:'D',eccentric_pin_pin:'E',expansion_tail_pin:'J',combination_upper_pin:'U',combination_lower_pin:'L',valve_crosshead_pin:'V',crosshead_drop_pin:'C',radius_lift_pickup_pin:'A'};
 const fixed=new Set(['lift_top_pin','lifting_arm','trunnion_inner_journal','trunnion_outer_journal','fixed_valve_guide']);
 function fieldFrame(partName,current){
  // 2x3 affine matrices are row-major: [a,b,ty,c,d,tz]. X is unchanged.
  // GLSL inverse query: vec2(a*p.y+b*p.z+ty,c*p.y+d*p.z+tz).
  const r=refs[current.side],name=partName.replace(/^valve\//,'').replace(/^(left|right)_/,''),now=current.yz;
  let from=[0,0],to=[0,0],angle=0;
  if(fixed.has(name)){}
  else if(rigidPairs[name]){let[a,b]=rigidPairs[name];from=r[a];to=now[a];angle=Math.atan2(now[b][1]-now[a][1],now[b][0]-now[a][0])-Math.atan2(r[b][1]-r[a][1],r[b][0]-r[a][0]);}
  else if(name==='expansion_link_slotted_cheeks'){from=r.T;to=now.T;angle=current.expansionAngle-r.q;}
  else if(translations[name]){let k=translations[name];from=r[k];to=now[k];}
  else throw Error('Not an outside-valve field: '+partName);
  const c=Math.cos(angle),s=Math.sin(angle);
  return {fromYZ:from.slice(),toYZ:to.slice(),angle,
   forwardYZ:[c,-s,to[0]-c*from[0]+s*from[1],s,c,to[1]-s*from[0]-c*from[1]],
   inverseYZ:[c,s,from[0]-c*to[0]-s*to[1],-s,c,from[1]+s*to[0]-c*to[1]]};
 }
 function fieldTransform(partName,p,current,inverse=false){
  // Pure CPU field transform. No GLSL emission and no renderer changes.
  const f=fieldFrame(partName,current),m=inverse?f.inverseYZ:f.forwardYZ;
  return[p[0],m[0]*p[1]+m[1]*p[2]+m[2],m[3]*p[1]+m[4]*p[2]+m[5]];
 }
 function frames(current){
  const names=[...Object.keys(rigidPairs),...Object.keys(translations),...fixed,'expansion_link_slotted_cheeks'];
  return Object.fromEntries(names.map(n=>['valve/'+current.side+'_'+n,fieldFrame(n,current)]));
 }
 const chestMoving=new Set(['rear_valve_head_core','front_valve_head_core','rear_effective_seal_band','front_effective_seal_band','shared_valve_spindle']);
 const chestFixed=new Set(['chest_pressure_shell','ported_liner','rear_end_cover','front_end_cover','rear_gland_packing','front_gland_packing','supply_stub_wall','rear_exhaust_stub_wall','front_exhaust_stub_wall','rear_working_stub_wall','front_working_stub_wall']);
 function classify(partId){
  const match=/^(valve|valve_chest)\/(left|right)_(.+)$/.exec(partId);
  if(!match)return {status:'unsupported',reason:'Not an outside-valve/chest field; middle and conjugated mechanism deliberately excluded'};
  const[,group,side,name]=match;
  if(group==='valve_chest'){
   if(chestMoving.has(name))return {status:'moving',side,type:'chestSlider',name};
   if(chestFixed.has(name))return {status:'fixed',side,type:'chestFixed',name};
  }else{
   if(fixed.has(name))return {status:'fixed',side,type:'fixed',name};
   if(rigidPairs[name]||translations[name]||name==='expansion_link_slotted_cheeks')return {status:'moving',side,type:'outsideField',name};
  }
  return {status:'unsupported',side,reason:'Unknown outside field; no guessed attachment'};
 }
 const poseCache={};
 function transformFor(partId,thetaOrPose){
  const m=classify(partId);if(m.status!=='moving')return null;
  let current=thetaOrPose;
  if(typeof thetaOrPose==='number'){
   const cached=poseCache[m.side];current=cached&&cached.theta===thetaOrPose?cached:pose(thetaOrPose,m.side);poseCache[m.side]=current;
  }
  if(!current||current.side!==m.side)throw Error('transformFor requires matching outside pose or numeric theta');
  let f;
  if(m.type==='chestSlider'){
   const from=refs[m.side].V,to=current.yz.V,dz=to[1]-from[1];
   f={fromYZ:from.slice(),toYZ:to.slice(),angle:0,forwardYZ:[1,0,0,0,1,dz],inverseYZ:[1,0,0,0,1,-dz]};
  }else f=fieldFrame(partId,current);
  return {...f,from:f.fromYZ.slice(),to:f.toYZ.slice(),side:m.side,classification:m};
 }
 return Object.freeze({pose,transformFor,classify,fieldFrame,fieldTransform,frames,reference:REF,equations,jacobian,context});
}
if(typeof module!=='undefined'&&module.exports)module.exports={createOutsideValveSolver};else root.createOutsideValveSolver=createOutsideValveSolver;
})(typeof window!=='undefined'?window:globalThis);
