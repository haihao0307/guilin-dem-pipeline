/* Own analytic candidate. No photo, mesh, point cloud, clock, or original-field edits.
 * Metres. One CSG expression tree drives the CPU evaluator, GLSL emitter and bounds.
 * Negative occupancy is solid; conservative certified Lipschitz bound is 1.
 * This is a GAME topology/clearance candidate, not measured 60009 geometry.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OUTER_CROSSHEAD=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const P=Object.freeze({
  revision:'outer-crosshead-candidate-02',
  leverHalfThickness:.012,leverBoreRadius:.0135,pinRadius:.012,pinHalfLength:.055,
  forkHalfGap:.014,cheekOuterX:.044,cheekY:.026,cheekBottomY:-.029,cheekRearZ:-.036,cheekFrontZ:.053,corner:.004,
  cheekBoreRadius:.0145,bushInnerRadius:.01215,
  socketRadius:.0215,socketRearZ:.043,socketFrontZ:.053,socketBoreRadius:.0162,spindleStartZ:.0445,
  keyZ:.049,keyHalfY:.003,keyHalfZ:.0015,keyClearance:.0002,
  shoeInnerX:.014,shoeOuterX:.055,shoeBottomY:-.039,shoeTopY:-.027,shoeRearZ:-.032,shoeFrontZ:.033,
  guideStartZ:3.979,coverContactZ:4.228,guideInnerX:.018,guideOuterX:.080,
  guideBottomY:-.049,guideRailTopY:-.040,guideWebInnerX:.056,
  capInnerX:.045,capBottomY:-.026,capTopY:-.021,boltX:.070,boltZ:[4.015,4.105,4.205],
  guideAssemblyGap:.001,spindleLength:1.15,frontEyeBore:.0135
});
const refs={left:[-.98,1.48,4.1231273253069523],right:[.98,1.48,4.153397901282459]};
const sources={
  topology:{grade:'official-photo-observed; same-class 60007, not measured 60009',urls:[
    'https://sirnigelgresley.org.uk/overhaul-1522/pics/o1203.jpg',
    'https://sirnigelgresley.org.uk/overhaul-1522/pics/o1204.jpg',
    'https://sirnigelgresley.org.uk/overhaul-1522/pics/o1206.jpg',
    'https://sirnigelgresley.org.uk/overhaul-1522/pics/o1218.jpg',
    'https://sirnigelgresley.org.uk/overhaul-1522/pics/o1125.jpg',
    'https://sirnigelgresley.org.uk/overhaul-1522/pics/o1139.jpg',
    'https://www.sirnigelgresley.org.uk/eng-reports/eng-24-a.shtml'],
    observed:'Independent long twin-cheek valve crosshead, transverse pin and fork, axial spindle socket and long cotter opening; separate guides with open centre; removable bolted guide strip above support arms.',
    limitations:'60007 evidence does not determine 60009 dimensions. o1125/o1139 side/front/rear identity is not established. Exact rear guide sections, cotter, buttons and locks remain candidate.'},
  retained:{grade:'exact retained R29 scalar / solver parameters; not historical measurement',parameters:['leverHalfThickness','leverBoreRadius','pinRadius','pinHalfLength','spindleLength','frontEyeBore','coverContactZ']},
  inferred:{grade:'explicit finite candidate fitted to retained geometric constraints; not measured or strength-certified',parameters:'All other dimensions and attachment/contact details.',reason:'Keep the original 24 mm lever, 24 mm pin, 32 mm spindle and all solver centres. Add finite cheek bearings and open guide shoes. An 8.5 mm socket engagement fits the existing maximum-travel cover gap; load capacity is not asserted.'}
};
const rb=(c,h,r=0)=>({op:'roundBox',c,h,r});
const box=(lo,hi,r=0)=>rb(lo.map((x,i)=>(x+hi[i])/2),lo.map((x,i)=>(hi[i]-x)/2),r);
const cyl=(axis,lo,hi,r,c=[0,0,0])=>({op:'cylinder',axis,lo,hi,r,c});
const cap=(a,b,r)=>({op:'capsule',a,b,r});
const bore=(axis,r,c=[0,0,0])=>({op:'throughBore',axis,r,c});
const uni=(...nodes)=>({op:'union',nodes});
const sub=(a,b)=>({op:'subtract',a,b});
const intersect=(...nodes)=>({op:'intersect',nodes});
const ring=(axis,lo,hi,ri,ro,c=[0,0,0])=>sub(cyl(axis,lo,hi,ro,c),cyl(axis,lo-.001,hi+.001,ri,c));
function scalar(n,p){
 if(n.op==='roundBox'){const q=p.map((v,i)=>Math.abs(v-n.c[i])-(n.h[i]-n.r));return Math.hypot(...q.map(v=>Math.max(v,0)))+Math.min(Math.max(...q),0)-n.r;}
 if(n.op==='cylinder'){const q=p.map((v,i)=>v-n.c[i]);return Math.max(Math.hypot(...q.filter((v,i)=>i!==n.axis))-n.r,n.lo-q[n.axis],q[n.axis]-n.hi);}
 if(n.op==='throughBore')return Math.hypot(...p.filter((v,i)=>i!==n.axis).map((v,j)=>v-n.c.filter((w,i)=>i!==n.axis)[j]))-n.r;
 if(n.op==='capsule'){const d=n.b.map((v,i)=>v-n.a[i]),q=p.map((v,i)=>v-n.a[i]),dd=d.reduce((s,v)=>s+v*v,0),t=dd?Math.max(0,Math.min(1,q.reduce((s,v,i)=>s+v*d[i],0)/dd)):0;return Math.hypot(...q.map((v,i)=>v-t*d[i]))-n.r;}
 if(n.op==='union')return Math.min(...n.nodes.map(v=>scalar(v,p)));
 if(n.op==='intersect')return Math.max(...n.nodes.map(v=>scalar(v,p)));
 if(n.op==='subtract')return Math.max(scalar(n.a,p),-scalar(n.b,p));
 throw Error('Unknown CSG primitive '+n.op);
}
function bounds(n){
 if(n.op==='roundBox')return[n.c.map((v,i)=>v-n.h[i]),n.c.map((v,i)=>v+n.h[i])];
 if(n.op==='cylinder')return[n.c.map((v,i)=>v+(i===n.axis?n.lo:-n.r)),n.c.map((v,i)=>v+(i===n.axis?n.hi:n.r))];
 if(n.op==='capsule')return[n.a.map((v,i)=>Math.min(v,n.b[i])-n.r),n.a.map((v,i)=>Math.max(v,n.b[i])+n.r)];
 if(n.op==='subtract')return bounds(n.a);
 const bs=n.nodes.map(bounds),un=n.op==='union';return[0,1].map(k=>[0,1,2].map(j=>(k===0?un?Math.min:Math.max:un?Math.max:Math.min)(...bs.map(b=>b[k][j]))));
}
const f=n=>{if(!Number.isFinite(n))throw Error('Finite GLSL literal required');const s=String(n);return /[.eE]/.test(s)?s:s+'.0';};
const v=a=>'vec3('+a.map(f).join(',')+')';
function emit(n,p='q'){
 if(n.op==='roundBox')return`ocRoundBox(${p},${v(n.c)},${v(n.h)},${f(n.r)})`;
 if(n.op==='cylinder')return`ocCylinder(${p}-${v(n.c)},${n.axis},${f(n.lo)},${f(n.hi)},${f(n.r)})`;
 if(n.op==='capsule')return`ocCapsule(${p},${v(n.a)},${v(n.b)},${f(n.r)})`;
 if(n.op==='throughBore')return`(length((${p}-${v(n.c)}).${n.axis===0?'yz':n.axis===1?'xz':'xy'})-${f(n.r)})`;
 if(n.op==='subtract')return`max(${emit(n.a,p)},-(${emit(n.b,p)}))`;
 return n.nodes.map(x=>emit(x,p)).reduce((a,b)=>`${n.op==='union'?'min':'max'}(${a},${b})`);
}
const helpers=`
float ocRoundBox(vec3 p,vec3 c,vec3 h,float r){vec3 q=abs(p-c)-(h-vec3(r));return length(max(q,vec3(0.)))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float ocCylinder(vec3 q,int axis,float lo,float hi,float r){vec2 rr=axis==0?q.yz:(axis==1?q.xz:q.xy);float a=axis==0?q.x:(axis==1?q.y:q.z);return max(length(rr)-r,max(lo-a,a-hi));}
float ocCapsule(vec3 p,vec3 a,vec3 b,float r){vec3 d=b-a;float den=dot(d,d);float t=den>0.?clamp(dot(p-a,d)/den,0.,1.):0.;return length(p-a-t*d)-r;}
`;
function create(){
 const p=P,parts=[],byId={},suppressed=[];
 function add(side,name,ast,frame='translate',material='steel',note='Explicit candidate geometry'){
  const origin=frame==='static'?[refs[side][0],1.48,0]:refs[side],b=bounds(ast),id=`outside_joint/${side}_${name}`;
  const part={id,group:'outside_joint',source:'outsideJoint',glsl_function:'outer_joint_'+side+'_'+name,aabb_min:b[0].map((v,i)=>v+origin[i]-1e-6),aabb_max:b[1].map((v,i)=>v+origin[i]+1e-6),lipschitz:1.000002,
    status:'inferred_topology_candidate_only; not measured 60009',proof:'1-Lipschitz primitives; min/max/negation preserve bound; rigid inverse preserves norm',side,frameKind:frame,frameSourceId:frame==='static'?null:`valve/${side}_${frame==='lever'?'combination_lever':'valve_spindle'}`,
    materialDescriptor:{preset:material,basis:'explicit candidate role',finish:'Retained analytic preset, not historical material identification'},origin,ast,note};
  parts.push(part);byId[id]=part;
 }
 const keySlot=box([-.060,-(p.keyHalfY+p.keyClearance),p.keyZ-p.keyHalfZ-p.keyClearance],[.060,p.keyHalfY+p.keyClearance,p.keyZ+p.keyHalfZ+p.keyClearance],.0002);
 for(const side of ['left','right']){
  const cheekNodes=[],shoeNodes=[];
  for(const sign of [-1,1]){
   const loX=sign<0?-p.cheekOuterX:p.forkHalfGap,hiX=sign<0?-p.forkHalfGap:p.cheekOuterX;
   cheekNodes.push(sub(box([loX,p.cheekBottomY,p.cheekRearZ],[hiX,p.cheekY,p.cheekFrontZ],p.corner),cyl(0,loX-.001,hiX+.001,p.cheekBoreRadius)));
   const slo=sign<0?-p.shoeOuterX:p.shoeInnerX,shi=sign<0?-p.shoeInnerX:p.shoeOuterX;
   shoeNodes.push(box([slo,p.shoeBottomY,p.shoeRearZ],[shi,p.shoeTopY,p.shoeFrontZ],.001));
   add(side,sign<0?'inner_cheek_bush':'outer_cheek_bush',ring(0,loX,hiX,p.bushInnerRadius,p.cheekBoreRadius),'translate','neutral','Candidate bearing sleeve; material unclassified. Bore-to-pin radial gap 0.15 mm.');
  }
  const bridge=box([-p.cheekOuterX,-.022,.044],[p.cheekOuterX,.022,p.cheekFrontZ],.001);
  const socket=cyl(2,p.socketRearZ,p.socketFrontZ,p.socketRadius);
  const body=sub(sub(uni(...cheekNodes,...shoeNodes,bridge,socket),cyl(2,p.spindleStartZ,.060,p.socketBoreRadius)),keySlot);
  add(side,'fork_crosshead_and_shoes',body,'translate','steel','Long rounded cheek blocks joined only ahead of the swinging lever. Integral bottom shoes and independent axial socket.');
  add(side,'combination_lever_bush',ring(0,-p.leverHalfThickness,p.leverHalfThickness,p.bushInnerRadius,p.leverBoreRadius),'lever','neutral','New sleeve in the original V bore; original lever and bore are unchanged.');
  const pin=sub(uni(cyl(0,-p.pinHalfLength,p.pinHalfLength,p.pinRadius),cyl(0,-.059,-.055,.020)),ring(0,.051,.054,.0105,.020));
  add(side,'transverse_pin',pin,'translate','steel','Original 24 mm shaft / 110 mm length, plus candidate finite head and end groove. These locks are not measured originals.');
  add(side,'inner_spacer_washer',ring(0,-.055,-.0445,.0122,.020));
  add(side,'outer_spacer_washer',ring(0,.0445,.0505,.0122,.020));
  add(side,'split_end_stop',sub(ring(0,.05125,.05375,.0105,.018),box([.050,0,-.0015],[.055,.03,.0015])),'translate','steel','Explicit finite split-retainer candidate, not a verified historical cotter/lock.');
  // Preserve the complete original forward capsule cap AND its Y-axis input-eye hole.
  // Only the rear end is shortened to enter the separate socket; no alias may fill it.
  let spindle=intersect(cap([0,0,p.spindleStartZ],[0,0,p.spindleLength],.016),box([-.02,-.02,p.spindleStartZ],[.02,.02,p.spindleLength+.02]));
  spindle=sub(spindle,bore(1,p.frontEyeBore,[0,0,p.spindleLength]));
  spindle=sub(spindle,keySlot);
  add(side,'canonical_valve_spindle',spindle,'translate','steel','32 mm round spindle. Socket insertion 8.5 mm, explicitly candidate; preserves original front Y bore and cap.');
  add(side,'socket_cross_key',box([-.048,-p.keyHalfY,p.keyZ-p.keyHalfZ],[.048,p.keyHalfY,p.keyZ+p.keyHalfZ],.0002),'translate','steel','Finite transverse rectangular cotter envelope. The official cotter/spacing-button topology is known; exact taper, button and positive locking are not reconstructed.');
  for(const sign of [-1,1]){
   const mirror=(lo,hi,r=0)=>box([sign<0?-hi[0]:lo[0],lo[1],lo[2]],[sign<0?-lo[0]:hi[0],hi[1],hi[2]],r);
   const base=uni(mirror([p.guideInnerX,p.guideBottomY,p.guideStartZ],[p.guideOuterX,p.guideRailTopY,p.coverContactZ]),mirror([p.guideWebInnerX,p.guideBottomY,p.guideStartZ],[p.guideOuterX,p.capBottomY,p.coverContactZ]),mirror([.020,-.063,4.217],[p.guideOuterX,-.042,p.coverContactZ]));
   const guideCap=mirror([p.capInnerX,p.capBottomY,p.guideStartZ],[p.guideOuterX,p.capTopY,p.coverContactZ]);
   const boltHoles=uni(...p.boltZ.map(z=>cyl(1,-.053,-.013,.0032,[sign*p.boltX,0,z])));
   const bolts=uni(...p.boltZ.map(z=>uni(cyl(1,-.048,p.capTopY,.003,[sign*p.boltX,0,z]),cyl(1,p.capTopY,-.016,.0055,[sign*p.boltX,0,z]))));
   const label=sign<0?'inner':'outer';
   add(side,label+'_guide_support',sub(base,boltHoles),'static','steel','Open lower support arm and shoe-side web. Connects at the existing rear-cover face z=4.228 by an explicitly shared fixed parent interface; no cover holes cut.');
   add(side,label+'_removable_guide_cap',sub(guideCap,boltHoles),'static','steel','Separate bolted retaining strip; centre channel is open above and below the lever.');
   add(side,label+'_guide_fasteners',bolts,'static','steel','Three candidate screw locations per strip, not a claim about exact historic count. Own holes only; unthreaded geometric fit.');
  }
  suppressed.push(`valve/${side}_valve_spindle`,`valve_chest/${side}_shared_valve_spindle`,`valve/${side}_valve_crosshead_pin`,`valve/${side}_fixed_valve_guide`,`stack_candidate/spindle/${side==='left'?'L':'R'}`);
 }
 const source=helpers+parts.map(part=>`float ${part.glsl_function}(vec3 p){vec3 q=p-${v(part.origin)};return ${emit(part.ast)};}`).join('\n');
 function referenceScalar(id,point){const part=byId[id];if(!part)throw Error('Unknown candidate field '+id);return scalar(part.ast,point.map((v,i)=>v-part.origin[i]));}
 return {version:P.revision,parameters:P,provenance:sources,parts,byId,source,suppress:suppressed,referenceScalar,scalarAST:scalar,boundsAST:bounds,
   mountInterface:{fixedParent:'valve_chest/{side}_rear_end_cover',planeZ:4.228,connection:'Shared fixed parent / integral support-root candidate; no moving transform and no hidden hole in retained cover.',coverRadialDomain:[.026,.1693],supportRadialDomain:[Math.hypot(.018,.040),Math.hypot(.080,.063)],stripBolts:{axis:'Y',radius:.003,boreRadius:.0032,centresX:[-.070,.070],worldZ:P.boltZ,threadDetail:'not modelled'}},
   limitations:['All sizes beyond retained scalar dimensions are unmeasured candidate parameters.','Socket engagement is only 8.5 mm; cotter taper/spacing button and strength remain unresolved, not made-up acceptance gates.','Contact planes and holes are geometric interfaces, not a verified constraint/force/fastener simulation.','A whole-neighbor sweep and GPU parity are separate checks; creation is not acceptance.']};
}
return Object.freeze({parameters:P,reference:refs,provenance:sources,create,scalar,bounds,emit,helpers});
});
