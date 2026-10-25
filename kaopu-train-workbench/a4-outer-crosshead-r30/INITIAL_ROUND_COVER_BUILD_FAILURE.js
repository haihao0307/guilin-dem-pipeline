/* Candidate-only analytic common-casting web, distinct valve bore, end covers,
 * guides and same-Time heads. Dimensions are hypotheses, not a recovered GA. */
const fs=require('fs'),vm=require('vm'),path=require('path'),P=require('./topology-parameters');
const c={};c.window=c;vm.createContext(c);for(const f of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','topology-parameters.js','side_offset_solver.js','gresley-dynamic.js','stack-fields.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),c);
const G=c.DYNAMIC.gresleySolver,C=P.chest,x=P.middleX,y=P.planeY,parts=[],code=[];
const f=v=>Number(v).toPrecision(17),v=a=>'vec3('+a.map(f).join(',')+')';
function add(id,expr,lo,hi,moving=false){const fn='topology_'+id;parts.push({id:'middle_topology/'+id,source:moving?'stack':'installation',group:'middle_topology',glsl_function:fn,aabb_min:lo,aabb_max:hi,lipschitz:1.5,frameSourceId:moving?'valve/gresley_middle_valve_crosshead_pin':undefined,status:'inferred_dimensions_official_topology_only'});code.push({moving,glsl:`float ${fn}(vec3 p){return ${expr};}`});}
const q=`p-${v([x,y,0])}`;
const ann=(ri,ro,a,b)=>ri===0?`mCylZ(${q},${f(ro)},${f(a)},${f(b)})`:`mAnnulusZ(${q},${f(ri)},${f(ro)},${f(a)},${f(b)})`;
const box=(r,a,b)=>[[x-r,y-r,a],[x+r,y+r,b]];
add('chest_wall',ann(C.boreRadius,C.outerRadius,C.rear,C.front),...box(C.outerRadius,C.rear,C.front));
for(const [name,a,b] of [['rear',C.rear-C.coverThickness,C.rear],['front',C.front,C.front+C.coverThickness]]){
 add(name+'_cover',ann(C.packingRadius,C.outerRadius,a,b),...box(C.outerRadius,a,b));
 add(name+'_packing',ann(C.shaftRadius+.00015,C.packingRadius,a,b),...box(C.packingRadius,a,b));
}
add('front_guide',ann(C.shaftRadius+.0002,.035,C.front+C.coverThickness,C.guideEnd),...box(.035,C.front+C.coverThickness,C.guideEnd));
// The casting web occupies ONLY material outside both bores. These subtractions
// define a new cast ligament; they never cut a piston, axle, frame or old wall.
const web=`max(max(topologyWebOuter(p),-mCylZ(mLocal(p-vec3(0.,1.016,0.),sin(middleInclination),cos(middleInclination)),.23495,4.2,5.3)),-mCylZ(${q},${f(C.boreRadius)},4.2,5.3))`;
add('common_casting_web',web,[-.045,1.35,4.35],[x+.045,1.9,5.0]);
const ref=G.pose(.4),qRef=ref.qMiddle;
for(let i=0;i<2;i++){
 const z=C.headCentres[i]+qRef,a=z-C.headHalfLength,b=z+C.headHalfLength;
 add('head_core_'+i,ann(0,C.headCoreRadius,a,b),...box(C.headCoreRadius,a,b),true);
 add('seal_band_'+i,ann(C.headCoreRadius,C.sealRadius,a,b),...box(C.sealRadius,a,b),true);
}
const prefix=c.SCENE.sources.motion.slice(0,c.SCENE.sources.motion.indexOf('float '+c.SCENE.parts.find(p=>p.source==='motion').glsl_function+'('));
const helper=`float topologyWebOuter(vec3 p){vec2 a=vec2(0.,1.016+tan(middleInclination)*p.z),b=vec2(${f(x)},${f(y)}),d=b-a;float t=clamp(dot(p.xy-a,d)/dot(d,d),0.,1.);float axisZ=sin(middleInclination)*(p.y-1.016)+cos(middleInclination)*p.z;return max(max(length(p.xy-a-t*d)-.045,max(4.35-p.z,p.z-5.0)),max(4.37-axisZ,axisZ-5.13));}\n`;
const data={source:prefix+helper+code.filter(x=>!x.moving).map(x=>x.glsl).join('\n'),parts:parts.filter(p=>p.source==='installation'),movingSource:code.filter(x=>x.moving).map(x=>x.glsl).join('\n'),movingParts:parts.filter(p=>p.source==='stack'),parameters:P,assertions:{wholeMechanicalAcceptance:false,officialNumericalDimensions:false,originalGeometryChanged:false,castingWebBoresSubtracted:true,steamPortsAndPassagesComplete:false}};
fs.writeFileSync(path.join(__dirname,'middle-chest-fields.js'),'window.MIDDLE_CHEST='+JSON.stringify(data)+';\n');
console.log(JSON.stringify({static:data.parts.length,moving:data.movingParts.length,refQ:qRef}));
