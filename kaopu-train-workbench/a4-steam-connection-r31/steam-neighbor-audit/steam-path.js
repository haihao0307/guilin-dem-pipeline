/* Own R31 analytic GAME candidate. No meshes, point clouds, new clock, fluid solve,
 * history-calibrated valve events, or pressure certification. All new dimensions
 * and routes are inferred. One CSG AST drives CPU, GLSL, ports and bounds. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.STEAM_PATH=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const parameters=Object.freeze({revision:'R31-steam-candidate-02',units:'m',inferred:true,
 header:{center:[0,3.3,3.35],innerHalf:[.55,.07,.07],partitionHalf:.006,outletInnerY:3.25,outletBendY:3.16,outletFaceY:3.21,cutY:[3.18,3.26],outletX:[-.40,0,.40],outletZ:3.395},
 branch:{inner:.026,outer:.038,bend:.18,jointY:1.90,lensHalf:.003,lensMajor:.035,lensRadial:.009,flangeRadius:.069,flangeThickness:.014,bendY:2.60,bendZ:3.72,approachY:2.15,supplyY:1.695,supplyZ:4.68},
 jointFastener:{count:4,pitchRadius:.054,angleOffset:Math.PI/4,rodRadius:.0035,holeRadius:.004,washerRadius:.009,washerThickness:.002,nutApothem:.006,nutThickness:.005,endReserve:.001},
 work:{outerInner:.018,outerRadius:.030,middleInner:.014,middleOuter:.026,bend:.035,stubExtensionY:1.260,stubEndY:1.265,stubEngagement:.005,rearStation:4.372,frontStation:5.128,outerEndRadial:[.13,.17],middleEndX:.100,middleShoulderX:.100,middleShoulderRadial:-.290,middleEndRadial:-.190,middleChestBottomY:1.300,middleFrontBypassZ:5.120,middleWorkZ:[4.49,4.88]},
 cylinder:{x:[-.82,0,.82],axisY:1.016,bore:.23495,outer:.260,rear:4.35,front:5.15,rearCover:4.315,frontCover:5.185,pistonHalf:.025,pistonOffset:1.25,rodRadius:.025},betaRange:[.11,.16],retainedOutsideGap:.0208932181,
 evidence:{topology:['https://sirnigelgresley.org.uk/overhaul-1522/overhaul-20.shtml','https://sirnigelgresley.org.uk/overhaul-1522/overhaul-17.shtml','https://www.sirnigelgresley.org.uk/eng-reports/eng-22.shtml'],numbers:'Every added route, bore, flange, gasket and partition dimension is inferred; retained host dimensions are code facts.',limits:'No measured 60009 geometry, complete steam circuit, historical valve events, fluid solve or pressure certification.'}});
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a)),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const F=n=>{if(!Number.isFinite(n))throw Error('Nonfinite GLSL literal');const s=String(n);return /[eE.]/.test(s)?s:s+'.0';},V=a=>'vec3('+a.map(F).join(',')+')';
const cp=(side,station,x=0,r=0)=>({kind:'cylinderPoint',side,station,x,r});
function point(p,beta){if(Array.isArray(p))return p;const b=p.side===1?beta:0;return[parameters.cylinder.x[p.side]+p.x,parameters.cylinder.axisY+p.station*Math.sin(b)+p.r*Math.cos(b),p.station*Math.cos(b)-p.r*Math.sin(b)];}
function pointGL(p){return Array.isArray(p)?V(p):`spCylinderPoint(${p.side},${F(p.station)},${F(p.x)},${F(p.r)})`;}
const cap=(a,b,r)=>({op:'capsule',a,b,r}),cyl=(a,b,r)=>({op:'cylinder',a,b,r}),box=(c,h)=>({op:'box',c,h}),uni=(...nodes)=>({op:'union',nodes}),diff=(a,b)=>({op:'subtract',a,b});
// Exact circular fillets tangent to both adjacent straight runs. Fillet tangent
// distance is bounded by .35 of either run, so adjacent arcs cannot overlap.
function fillet(a,b,c,bend){const u=unit(sub(a,b)),v=unit(sub(c,b)),co=clamp(dot(u,v),-.999999,.999999),half=Math.acos(co)/2,t=Math.min(bend/Math.tan(half),.35*norm(sub(a,b)),.35*norm(sub(c,b))),r=t*Math.tan(half),center=add(b,mul(unit(add(u,v)),t/Math.cos(half))),start=add(b,mul(u,t)),end=add(b,mul(v,t)),e=unit(sub(start,center)),f=unit(sub(sub(end,center),mul(e,dot(sub(end,center),e)))),angle=Math.acos(clamp(dot(unit(sub(end,center)),e),-1,1));return{start,end,center,e,f,r,angle};}
function segment(p,a,b){const d=sub(b,a),t=clamp(dot(sub(p,a),d)/dot(d,d),0,1);return norm(sub(sub(p,a),mul(d,t)));}
function pathDistance(p,pts,bend){if(pts.length===2)return segment(p,pts[0],pts[1]);const corners=pts.slice(1,-1).map((v,i)=>fillet(pts[i],v,pts[i+2],bend));let d=Infinity;for(let i=0;i<pts.length-1;i++)d=Math.min(d,segment(p,i===0?pts[0]:corners[i-1].end,i===pts.length-2?pts[pts.length-1]:corners[i].start));for(const a of corners){const q=sub(p,a.center),angle=Math.atan2(dot(q,a.f),dot(q,a.e)),end=add(mul(a.e,a.r*Math.cos(a.angle)),mul(a.f,a.r*Math.sin(a.angle)));let arc=Math.min(norm(sub(q,mul(a.e,a.r))),norm(sub(q,end)));if(angle>=0&&angle<=a.angle)arc=Math.min(arc,norm(sub(q,add(mul(a.e,a.r*Math.cos(angle)),mul(a.f,a.r*Math.sin(angle))))));d=Math.min(d,arc);}return d;}
function scalar(n,p,beta=.126){
 if(n.op==='box'){const q=p.map((v,i)=>Math.abs(v-n.c[i])-n.h[i]);return norm(q.map(v=>Math.max(v,0)))+Math.min(Math.max(...q),0);}
 if(n.op==='capsule'||n.op==='cylinder'){const a=point(n.a,beta),b=point(n.b,beta),d=sub(b,a),l=norm(d),u=mul(d,1/l),q=sub(p,a),t=dot(q,u);return n.op==='cylinder'?Math.max(norm(sub(q,mul(u,t)))-n.r,-t,t-l):segment(p,a,b)-n.r;}
 if(n.op==='path'||n.op==='tube'){const pts=n.points.map(q=>point(q,beta)),d=pathDistance(p,pts,n.bend);if(n.op==='path')return d-n.r;const last=pts.length-1;return Math.max(d-n.ro,n.ri-d,-dot(sub(p,pts[0]),unit(sub(pts[1],pts[0]))),dot(sub(p,pts[last]),unit(sub(pts[last],pts[last-1]))));}
 if(n.op==='hexY'){const q=sub(p,n.c);return Math.max(...[0,Math.PI/3,2*Math.PI/3].map(a=>Math.abs(q[0]*Math.cos(a)+q[2]*Math.sin(a))-n.apothem),n.lo-p[1],p[1]-n.hi);}
 if(n.op==='lens'){const q=sub(p,n.c);return Math.min(n.radial,n.half)*(Math.hypot((Math.hypot(q[0],q[2])-n.major)/n.radial,q[1]/n.half)-1);}
 if(n.op==='union')return Math.min(...n.nodes.map(x=>scalar(x,p,beta)));
 if(n.op==='subtract')return Math.max(scalar(n.a,p,beta),-scalar(n.b,p,beta));
 throw Error('Unknown node '+n.op);
}
function emit(n,p='p'){
 if(n.op==='box')return`spBox(${p},${V(n.c)},${V(n.h)})`;
 if(n.op==='capsule'||n.op==='cylinder')return`sp${n.op==='capsule'?'Capsule':'Cylinder'}(${p},${pointGL(n.a)},${pointGL(n.b)},${F(n.r)})`;
 if(n.op==='path'||n.op==='tube'){const pts=n.points.map(pointGL),d=`spPath${pts.length}(${p},${pts.join(',')},${F(n.bend)})`;if(n.op==='path')return`(${d}-${F(n.r)})`;return`max(max(${d}-${F(n.ro)},${F(n.ri)}-${d}),max(-dot(${p}-${pts[0]},normalize(${pts[1]}-${pts[0]})),dot(${p}-${pts.at(-1)},normalize(${pts.at(-1)}-${pts.at(-2)}))))`;}
 if(n.op==='hexY')return`spHexY(${p},${V(n.c)},${F(n.apothem)},${F(n.lo)},${F(n.hi)})`;
 if(n.op==='lens')return`spLens(${p},${V(n.c)},${F(n.major)},${F(n.radial)},${F(n.half)})`;
 if(n.op==='subtract')return`max(${emit(n.a,p)},-(${emit(n.b,p)}))`;
 return n.nodes.map(x=>emit(x,p)).reduce((a,b)=>`min(${a},${b})`);
}
function trigRange(a,b){const [lo,hi]=parameters.betaRange,ts=[lo,hi];for(let k=-2;k<=2;k++){const t=Math.atan2(a,b)+k*Math.PI;if(t>lo&&t<hi)ts.push(t);}const vs=ts.map(t=>a*Math.sin(t)+b*Math.cos(t));return[Math.min(...vs),Math.max(...vs)];}
function pointBounds(p){if(Array.isArray(p))return[p.slice(),p.slice()];if(p.side!==1){const q=point(p,.126);return[q.slice(),q.slice()];}const y=trigRange(p.station,p.r),z=trigRange(-p.r,p.station);return[[p.x,parameters.cylinder.axisY+y[0],z[0]],[p.x,parameters.cylinder.axisY+y[1],z[1]]];}
function bounds(n){
 if(n.op==='box')return[n.c.map((v,i)=>v-n.h[i]),n.c.map((v,i)=>v+n.h[i])];
 if(n.op==='hexY')return[[n.c[0]-n.apothem,n.lo,n.c[2]-n.apothem/Math.cos(Math.PI/6)],[n.c[0]+n.apothem,n.hi,n.c[2]+n.apothem/Math.cos(Math.PI/6)]];
 if(n.op==='lens'){const h=[n.major+n.radial,n.half,n.major+n.radial];return[n.c.map((v,i)=>v-h[i]),n.c.map((v,i)=>v+h[i])];}
 if(['capsule','cylinder','path','tube'].includes(n.op)){const bs=(n.points||[n.a,n.b]).map(pointBounds),r=n.ro||n.r;return[[0,1,2].map(i=>Math.min(...bs.map(b=>b[0][i]))-r),[0,1,2].map(i=>Math.max(...bs.map(b=>b[1][i]))+r)];}
 if(n.op==='subtract')return bounds(n.a);const bs=n.nodes.map(bounds);return[[0,1,2].map(i=>Math.min(...bs.map(b=>b[0][i]))),[0,1,2].map(i=>Math.max(...bs.map(b=>b[1][i])))];
}
let helpers=`
#ifndef R31_STEAM_HELPERS
#define R31_STEAM_HELPERS
vec3 spCylinderPoint(int side,float station,float x,float radial){float b=side==1?middleInclination:0.;return vec3((side==0?-.82:(side==2?.82:0.))+x,1.016+station*sin(b)+radial*cos(b),station*cos(b)-radial*sin(b));}
float spBox(vec3 p,vec3 c,vec3 h){vec3 q=abs(p-c)-h;return length(max(q,vec3(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
float spSegment(vec3 p,vec3 a,vec3 b){vec3 d=b-a;float t=clamp(dot(p-a,d)/dot(d,d),0.,1.);return length(p-a-t*d);}
float spCapsule(vec3 p,vec3 a,vec3 b,float r){return spSegment(p,a,b)-r;}
float spCylinder(vec3 p,vec3 a,vec3 b,float r){vec3 d=b-a;float l=length(d);vec3 u=d/l;float t=dot(p-a,u);return max(length(p-a-t*u)-r,max(-t,t-l));}
float spLens(vec3 p,vec3 c,float major,float radial,float halfDepth){vec3 q=p-c;return min(radial,halfDepth)*(length(vec2((length(q.xz)-major)/radial,q.y/halfDepth))-1.);}
float spHexY(vec3 p,vec3 c,float apothem,float lo,float hi){vec3 q=p-c;float d=max(abs(q.x),max(abs(.5*q.x+.8660254037844386*q.z),abs(-.5*q.x+.8660254037844386*q.z)))-apothem;return max(d,max(lo-p.y,p.y-hi));}
struct SPFillet{vec3 start;vec3 end;vec3 center;vec3 e;vec3 f;float r;float angle;};
SPFillet spFillet(vec3 a,vec3 b,vec3 c,float bend){vec3 u=normalize(a-b),v=normalize(c-b);float co=clamp(dot(u,v),-.999999,.999999),halfAngle=acos(co)*.5,t=min(bend/tan(halfAngle),.35*min(length(a-b),length(c-b)));SPFillet f;f.r=t*tan(halfAngle);f.center=b+normalize(u+v)*(t/cos(halfAngle));f.start=b+u*t;f.end=b+v*t;f.e=normalize(f.start-f.center);f.f=normalize(f.end-f.center-f.e*dot(f.end-f.center,f.e));f.angle=acos(clamp(dot(normalize(f.end-f.center),f.e),-1.,1.));return f;}
float spArcDistance(vec3 p,SPFillet f){vec3 q=p-f.center;float a=atan(dot(q,f.f),dot(q,f.e));float d=min(length(q-f.r*f.e),length(q-f.r*(f.e*cos(f.angle)+f.f*sin(f.angle))));if(a>=0.&&a<=f.angle)d=min(d,length(q-f.r*(f.e*cos(a)+f.f*sin(a))));return d;}
float spPath2(vec3 p,vec3 a0,vec3 a1,float bend){return spSegment(p,a0,a1);}
`;
for(let n=3;n<=5;n++){let s=`float spPath${n}(vec3 p,${Array.from({length:n},(_,i)=>'vec3 a'+i).join(',')},float bend){`;for(let i=1;i<n-1;i++)s+=`SPFillet f${i}=spFillet(a${i-1},a${i},a${i+1},bend);`;s+='float d=1e10;';for(let i=0;i<n-1;i++)s+=`d=min(d,spSegment(p,${i===0?'a0':`f${i}.end`},${i===n-2?`a${n-1}`:`f${i+1}.start`}));`;for(let i=1;i<n-1;i++)s+=`d=min(d,spArcDistance(p,f${i}));`;helpers+=s+'return d;}\n';}helpers+='#endif\n';
function create(options={}){
 const P=parameters,B=P.branch,J=P.jointFastener,W=P.work,C=P.cylinder,H=P.header,D=options.dynamic||null,T=options.topology||{middleX:.38,planeY:1.48,chest:{rear:4.38,front:5.01,boreRadius:.1143}};
 const parts=[],byId={},domains={},cuts={},routes=[],portDefs=[],connections=[],jointFasteners=[];
 function addPart(name,ast,preset='steel',role='inferred solid',extra={}){const id='steam_path/'+name,b=bounds(ast),p={id,group:'steam_path',source:'steamPath',glsl_function:'sp_part_'+name.replace(/\W/g,'_'),aabb_min:b[0].map(v=>v-1e-6),aabb_max:b[1].map(v=>v+1e-6),lipschitz:1.000002,status:'inferred candidate; no historical/pressure certification',proof:'Exact distance to filleted centreline, planes and primitives; min/max preserve 1-Lipschitz; beta held per snapshot',role,materialDescriptor:{preset,basis:'explicit candidate role',finish:'Existing analytic wave preset; no displacement or independent clock'},ast,...extra};parts.push(p);byId[id]=p;return id;}
 function cut(id,ast){(cuts[id]||(cuts[id]=[])).push(ast);}
 function port(id,position,direction,r,kind,host,extra={}){portDefs.push({id,label:id,position,direction,radius:r,kind,host,state:'connected_candidate',...extra});}
 function route(id,pts,ri,ro,preset,trim=[],extra={}){let wall={op:'tube',points:pts,ri,ro,bend:extra.bend??W.bend};const lumen={op:'path',points:pts,r:ri,bend:wall.bend};if(trim.length)wall=diff(wall,uni(...trim));const partId=addPart(id,wall,preset,'Open-ended circular-fillet passage; inferred route and dimensions',extra);domains['lumen/'+id]=lumen;routes.push({id,partId,points:pts,innerRadius:ri,outerRadius:ro,bend:extra.bend??W.bend,lumenDomain:'lumen/'+id,...extra});return{wall,lumen,partId};}
 const headerInside=box(H.center,H.innerHalf);addPart('header_separator',box(H.center,[H.innerHalf[0],H.innerHalf[1],H.partitionHalf]),'steel','Inferred minimum pre/post-superheater separation, not real header internal drawing');
 const chamberHalf=(H.innerHalf[2]-H.partitionHalf)/2,chamberOffset=(H.innerHalf[2]+H.partitionHalf)/2;domains['header/pre_superheat']=box([H.center[0],H.center[1],H.center[2]-chamberOffset],[H.innerHalf[0],H.innerHalf[1],chamberHalf]);domains['header/post_superheat']=box([H.center[0],H.center[1],H.center[2]+chamberOffset],[H.innerHalf[0],H.innerHalf[1],chamberHalf]);
 for(const[id,pos]of [['upstream_missing',[0,3.3,3.28]],['elements_out_missing',[-.20,3.3,3.312]],['elements_return_missing',[.20,3.3,3.388]]])port('header/'+id,pos,[0,0,-1],.026,'unbuilt_sealed_interface','smokebox/superheater_header',{state:'open_break',physicalPortBuilt:false,reason:'No geometry supplied for upstream or real superheater elements; no shortcut'});
 const chestBore=cyl([T.middleX,T.planeY,T.chest.rear-.003],[T.middleX,T.planeY,T.chest.front+.003],T.chest.boreRadius),cylinderBore=side=>cyl(cp(side,C.rear-.001),cp(side,C.front+.001),C.bore);
 for(let side=0;side<3;side++){
  const name=['left','middle','right'][side],x=side===1?T.middleX:side===0?-.98:.98,z=B.supplyZ,joint=[x,B.jointY,z];
  const steelPoints=[[H.outletX[side],H.outletInnerY,H.outletZ],[H.outletX[side],H.outletBendY,H.outletZ],[H.outletX[side],B.bendY,B.bendZ],[x,B.approachY,z],[x,B.jointY+B.lensHalf,z]];
  const steel=route(name+'_steel_branch',steelPoints,B.inner,B.outer,'steel',[headerInside],{bend:B.bend,materialRole:'steel branch, documented category'});
  const castEnd=side===1?[x,T.planeY,z]:[x,B.supplyY,z],castPoints=[[x,B.jointY-B.lensHalf,z],castEnd],cast=route(name+'_cast_top_pipe',castPoints,B.inner,B.outer,'neutral',side===1?[chestBore]:[],{materialRole:'cast-iron cylinder-top pipe; neutral existing preset'});
  cut('smokebox/superheater_header',cyl([H.outletX[side],H.cutY[0],H.outletZ],[H.outletX[side],H.cutY[1],H.outletZ],B.inner));
  cut('smokebox/smokebox_wrapper',{op:'path',points:steelPoints,r:B.outer,bend:B.bend});
  const centers=Array.from({length:J.count},(_,k)=>[x+J.pitchRadius*Math.cos(J.angleOffset+k*2*Math.PI/J.count),0,z+J.pitchRadius*Math.sin(J.angleOffset+k*2*Math.PI/J.count)]),lower=B.jointY-B.lensHalf-B.flangeThickness,upper=B.jointY+B.lensHalf+B.flangeThickness;
  for(const[label,y0,y1,mat]of [['steel',B.jointY+B.lensHalf,upper,'steel'],['cast',lower,B.jointY-B.lensHalf,'neutral']]){
   const holes=centers.map(q=>cyl([q[0],y0-.001,q[2]],[q[0],y1+.001,q[2]],J.holeRadius));
   addPart(name+'_'+label+'_joint_flange',diff(cyl([x,y0,z],[x,y1,z],B.flangeRadius),uni(cyl([x,y0-.001,z],[x,y1+.001,z],B.outer),...holes)),mat,'Finite annular flange with four candidate through holes; count and dimensions inferred');
  }
  const studs=[],nuts=[],washers=[],studWitnesses=[],nutWitnesses=[],washerWitnesses=[];
  for(const q of centers){const lo=lower-J.washerThickness-J.nutThickness-J.endReserve,hi=upper+J.washerThickness+J.nutThickness+J.endReserve;
   studs.push(cyl([q[0],lo,q[2]],[q[0],hi,q[2]],J.rodRadius));studWitnesses.push([q[0],B.jointY,q[2]]);
   for(const[wlo,whi,nlo,nhi]of [[lower-J.washerThickness,lower,lower-J.washerThickness-J.nutThickness,lower-J.washerThickness],[upper,upper+J.washerThickness,upper+J.washerThickness,upper+J.washerThickness+J.nutThickness]]){
    washers.push(diff(cyl([q[0],wlo,q[2]],[q[0],whi,q[2]],J.washerRadius),cyl([q[0],wlo-.001,q[2]],[q[0],whi+.001,q[2]],J.holeRadius)));
    nuts.push(diff({op:'hexY',c:q,apothem:J.nutApothem,lo:nlo,hi:nhi},cyl([q[0],nlo-.001,q[2]],[q[0],nhi+.001,q[2]],J.rodRadius)));
    washerWitnesses.push([q[0]+.5*(J.holeRadius+J.washerRadius),.5*(wlo+whi),q[2]]);nutWitnesses.push([q[0]+.5*(J.rodRadius+J.nutApothem),.5*(nlo+nhi),q[2]]);
   }
  }
  const hardware=[addPart(name+'_joint_studs',uni(...studs),'steel','Four finite candidate studs; count/size inferred, nominal thread envelope only',{diagnosticWitnesses:studWitnesses,componentCount:J.count}),addPart(name+'_joint_nuts',uni(...nuts),'steel','Eight finite hexagonal nuts; nominal contact bore, no thread or preload certification',{diagnosticWitnesses:nutWitnesses,componentCount:2*J.count}),addPart(name+'_joint_washers',uni(...washers),'steel','Eight finite annular washers bearing on flange outer faces',{diagnosticWitnesses:washerWitnesses,componentCount:2*J.count})];
  jointFasteners.push({branch:name,centers:centers.map(q=>[q[0],B.jointY,q[2]]),parts:hardware,countPerJoint:J.count,quantityAndDimensionsInferred:true,threadResolved:false,preloadVerified:false,loadedSealVerified:false});
  addPart(name+'_lens_ring',{op:'lens',c:joint,major:B.lensMajor,radial:B.lensRadial,half:B.lensHalf},'neutral','Finite convex lens ring; composition and loaded sealing state unverified');
  port(name+'/header_outlet',[H.outletX[side],H.outletFaceY,H.outletZ],[0,-1,0],B.inner,'post_superheat_outlet','smokebox/superheater_header');
  port(name+'/lens_joint',joint,[0,-1,0],B.inner,'steel_lens_cast_joint',steel.partId,{counterpart:cast.partId});
  port(name+'/supply',side===1?[x,1.62,z]:castEnd,[0,1,0],B.inner,'candidate_supply_not_historical_admission',side===1?'middle_topology/chest_wall':'valve_chest/'+name+'_supply_stub_wall');
  connections.push({from:'header/post_superheat',to:name+'/supply',via:[steel.partId,'steam_path/'+name+'_lens_ring',cast.partId],state:'connected_candidate',label:name+' 分段供汽候选',reason:'Constructed open bores and finite flange/lens contact; endpoint tests pass, whole-neighbor and loaded seal verification not implied'});
  if(side===1){const a=cyl([x,1.46,z],[x,1.705,z],B.inner);cut('middle_topology/chest_wall',a);cut('middle_topology/common_casting_web',a);}
  for(let end=0;end<2;end++){
   const tag=end?'front':'rear',station=end?W.frontStation:W.rearStation,host='actuation/'+name+'_cylinder_wall';let pts,ri,ro,trim=[cylinderBore(side),cyl(cp(side,C.rearCover),cp(side,C.rear),C.outer),cyl(cp(side,C.front),cp(side,C.frontCover),C.outer)];
   if(side!==1){const workZ=end?4.90:4.46,sign=side===0?-1:1;pts=[[x,W.stubEndY+W.stubEngagement,workZ],[x,W.stubExtensionY,workZ],[x,W.stubExtensionY,station],[C.x[side]+sign*W.outerEndRadial[0],C.axisY+W.outerEndRadial[1],station]];ri=W.outerInner;ro=W.outerRadius;}
   else{const workZ=W.middleWorkZ[end];pts=[[T.middleX,T.planeY,workZ],[T.middleX,W.middleChestBottomY,workZ],...(end?[[T.middleX,W.middleChestBottomY,W.middleFrontBypassZ]]:[]),cp(1,station,W.middleShoulderX,W.middleShoulderRadial),cp(1,station,W.middleEndX,W.middleEndRadial)];ri=W.middleInner;ro=W.middleOuter;trim.push(chestBore);}
   const r=route(name+'_'+tag+'_working_passage',pts,ri,ro,'neutral',trim,{side,cylinderEnd:tag,materialRole:'inferred working steam-passage envelope; real cast passage exterior unverified',role:'推断工作汽道包络；真实铸造通道外形未证，不认定为实车外接弯钢管'});cut(host,r.lumen);if(side!==1)cut('valve_chest/'+name+'_'+tag+'_working_stub_wall',r.lumen);if(side===1){cut('middle_topology/chest_wall',r.lumen);cut('middle_topology/common_casting_web',r.lumen);}
   port(name+'/'+tag+'_working',pts[0],[0,-1,0],ri,'candidate_valve_work_port',side===1?'middle_topology/chest_wall':'valve_chest/'+name+'_'+tag+'_working_stub_wall');
   port(name+'/'+tag+'_cylinder',pts.at(-1),{from:pts.at(-2),to:pts.at(-1)},ri,'power_chamber_port_beta_bound',host,{station,side});
   connections.push({from:name+'/'+tag+'_working',to:'chamber/'+name+'/'+tag,via:[r.partId],state:'connected_candidate',label:name+' '+tag+' 工作腔候选连接',reason:'Constructed subtract-only wall port at end station; endpoint test passes; full-route clearance, pressure and valve events remain separate checks'});
  }
 }
 const hostCuts={};for(const[id,nodes]of Object.entries(cuts))hostCuts[id]={glsl_function:'sp_cut_'+id.replace(/\W/g,'_'),ast:uni(...nodes),space:'current train-local; beta-bound',reason:'subtract-only finite intended interface aperture'};
 const missingEdges=[{from:'boiler_water_or_steam',to:'regulator',reason:'Steam take-off / regulator unknown and unbuilt'},{from:'regulator',to:'main_steam_pipe',reason:'Main steam pipe unbuilt'},{from:'main_steam_pipe',to:'header/pre_superheat',reason:'Tubeplate/header inlet route unbuilt'},{from:'header/pre_superheat',to:'superheater_elements',reason:'Element loop unbuilt; no substitute short circuit'},{from:'superheater_elements',to:'header/post_superheat',reason:'Actual return holes / internal header topology unknown'},...['left','middle','right'].map(s=>({from:s+'/exhaust',to:'exhaust_collector',reason:'Real exhaust convergence unknown; no invented crossover'})),{from:'exhaust_collector',to:'existing_two_nozzles',reason:'Collector / two-nozzle distribution unknown'}].map(e=>({...e,state:'open_break',label:e.from+' → '+e.to}));
 const conditionalEdges=['left','middle','right'].flatMap(s=>['rear','front'].map(e=>({from:s+'/supply',to:s+'/'+e+'_working',state:'unverified',label:s+' '+e+' 配汽事件',reason:'Existing moving valve solid controls geometric occlusion; real A4 timing and admission mapping unverified'})));
 const graph={nodes:[...new Set([...connections,...missingEdges,...conditionalEdges].flatMap(e=>[e.from,e.to]))].map(id=>({id,label:id,state:id.includes('missing')?'open_break':'unverified'})),edges:[...connections,...missingEdges,...conditionalEdges],connections,missingEdges,conditionalEdges,forbiddenEdges:[['header/pre_superheat','header/post_superheat'],['header/post_superheat','smokebox_combustion_gas']]};
 const commonSource=helpers+'\n'+Object.values(hostCuts).map(c=>`float ${c.glsl_function}(vec3 p){return ${emit(c.ast)};}`).join('\n'),source=helpers+'\n'+parts.map(p=>`float ${p.glsl_function}(vec3 p){return ${emit(p.ast)};}`).join('\n');
 const steamEnvelope=uni(headerInside,...routes.filter(r=>r.id.includes('steel_branch')||r.id.includes('cast_top_pipe')).map(r=>({op:'path',points:r.points,r:r.outerRadius,bend:r.bend})));const domainExclusions={'pr_smokebox_combustion_gas_domain':steamEnvelope};
 const status={scope:'minimum inferred geometric connection candidate',inferredDimensions:true,headerPrePostSeparated:true,jointClampBuilt:true,jointClampCountAndDimensionsInferred:true,threadResolved:false,preloadVerified:false,lensLoadedSealVerified:false,superheaterElementLoopComplete:false,upstreamComplete:false,exhaustCollectorComplete:false,middleExhaustPortsComplete:false,historicalValveEventsVerified:false,fluidDomainsRenderedAsSolids:false,completeSteamFlow:false,CFD:false,pressureCertified:false,wholeMechanicalAcceptance:false,noSecondClock:true,originalSourceChanged:false,modifiedHostIDs:Object.keys(hostCuts)};
 function valid(theta,installation){if(!Number.isFinite(theta))throw Error('Pass same mechanical theta');if(!installation||installation.mode!=='candidate'||!Number.isFinite(installation.beta)||installation.beta<P.betaRange[0]||installation.beta>P.betaRange[1])throw Error('Pass candidate installation snapshot beta [.11,.16]');}
 function chamberInfo(side,theta,installation){if(!D)throw Error('Dynamic provider required for chambers');const beta=side===1?installation.beta:0,pose=D.pose(theta,side,beta),pistonStation=(pose.s[0]-C.axisY)*Math.sin(beta)+pose.s[1]*Math.cos(beta)+C.pistonOffset;return{side:['left','middle','right'][side],beta,pistonStation,pistonRear:pistonStation-C.pistonHalf,pistonFront:pistonStation+C.pistonHalf,rearEnd:C.rear,frontEnd:C.front,rearRange:[C.rear,pistonStation-C.pistonHalf],frontRange:[pistonStation+C.pistonHalf,C.front],rearPortStation:W.rearStation,frontPortStation:W.frontStation,axis:[0,Math.sin(beta),Math.cos(beta)],rearPlaneCenter:point(cp(side,C.rear),installation.beta),frontPlaneCenter:point(cp(side,C.front),installation.beta),pistonRearCenter:point(cp(side,pistonStation-C.pistonHalf),installation.beta),pistonFrontCenter:point(cp(side,pistonStation+C.pistonHalf),installation.beta),poseSource:'D.pose(theta, side, installation.beta)',theta};}
 function worldScalar(id,p,theta,installation){valid(theta,installation);if(!byId[id])throw Error('Unknown steam solid '+id);return scalar(byId[id].ast,p,installation.beta);}
 function hostCutScalar(id,p,theta,installation){valid(theta,installation);return hostCuts[id]?scalar(hostCuts[id].ast,p,installation.beta):Infinity;}
 function domainScalar(id,p,theta,installation){valid(theta,installation);if(domains[id])return scalar(domains[id],p,installation.beta);const m=id.match(/^chamber\/(left|middle|right)\/(rear|front)$/);if(!m)throw Error('Unknown query domain '+id);const side=['left','middle','right'].indexOf(m[1]),c=chamberInfo(side,theta,installation),range=m[2]==='rear'?c.rearRange:c.frontRange;if(range[1]<=range[0])return Infinity;let f=scalar(cyl(cp(side,range[0]),cp(side,range[1]),C.bore),p,installation.beta);if(m[2]==='rear')f=Math.max(f,-scalar(cyl(cp(side,range[0]-.001),cp(side,range[1]+.001),C.rodRadius),p,installation.beta));return f;}
 function ports(theta,installation){valid(theta,installation);return portDefs.map(p=>({...p,position:point(p.position,installation.beta),direction:Array.isArray(p.direction)?p.direction.slice():unit(sub(point(p.direction.to,installation.beta),point(p.direction.from,installation.beta))),theta,installation:{...installation}}));}
 function clipExistingDomain(id,existingScalar,p,theta,installation){valid(theta,installation);if(!Number.isFinite(existingScalar))throw Error('Supply the existing host-domain scalar at this same point');return domainExclusions[id]?Math.max(existingScalar,-scalar(domainExclusions[id],p,installation.beta)):existingScalar;}
 function inspection(theta,installation){valid(theta,installation);return{theta,installation:{...installation},endpoints:ports(theta,installation),workingChambers:[0,1,2].map(s=>chamberInfo(s,theta,installation)),knownBreaks:missingEdges,status};}
 return{version:P.revision,parameters:P,source,commonSource,parts,byId,hostCuts,domainIds:[...Object.keys(domains),...['left','middle','right'].flatMap(s=>['chamber/'+s+'/rear','chamber/'+s+'/front'])],domains,domainExclusions,clipExistingDomain,jointFasteners,routes,ports,inspection,graph,status,worldScalar,referenceScalar:(id,p,beta=.126)=>scalar(byId[id].ast,p,beta),hostCutScalar,domainScalar,bounds:id=>bounds(byId[id].ast),point,scalar};
}
return{parameters,create,scalar,bounds,point,fillet,pathDistance};
});
