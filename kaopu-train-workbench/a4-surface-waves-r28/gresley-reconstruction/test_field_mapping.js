'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const modelArg=process.argv.indexOf('--model');const base=path.resolve(modelArg>=0?process.argv[modelArg+1]:(process.env.A4_MODEL_DIR||path.join(__dirname,'..')));
const c={};c.window=c;vm.createContext(c);
for(const f of ['scene.js','dynamic.js'])vm.runInContext(fs.readFileSync(path.join(base,f),'utf8'),c);
const {createOutsideValveSolver}=require(path.join(base,'outside_valve_solver.js')),{createGresleySolver}=require('./gresley_solver');
const solver=createGresleySolver(c.SCENE,c.DYNAMIC,createOutsideValveSolver(c.DYNAMIC)),ref=solver.reference;
const ids=Object.keys(solver.whitelist),dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
assert.equal(ids.length,14);
assert.equal(ids.filter(id=>solver.classify(id).status==='moving').length,13);
const endpoints={two_to_one_lever:['A','C','O'],equal_lever:['B','E','C'],right_short_link:['R','A'],left_short_link:['L','B'],middle_short_link:['M','E']};
let maxJoint=0,maxInverse=0,maxIdentity=0,maxPlane=0,checks=0;
const mappings=ids.map(id=>{
 const part=c.SCENE.parts.find(p=>p.id===id);assert(part);
 const match=c.SCENE.sources.motion.match(new RegExp('float '+part.glsl_function+'\\(vec3 p\\) \\{[^\\n]+'));
 assert(match);
 return {id,glslFunction:part.glsl_function,sourceLine:match[0],...solver.whitelist[id],sourceAabb:[part.aabb_min,part.aabb_max]};
});
for(let k=0;k<=360;k++){
 const theta=.4+2*Math.PI*k/360,current=solver.pose(theta);
 for(const map of mappings){
  const frame=solver.transformFor(map.id,current),spec=solver.whitelist[map.id];
  assert.equal(frame.unchangedAxis,'Y');
  const rod=Object.entries(endpoints).find(([name])=>map.id==='valve/gresley_'+name);
  const keys=rod?rod[1]:[spec.anchor];
  for(const key of keys){const got=solver.transformPoint(ref.pins[key],frame);maxJoint=Math.max(maxJoint,dist(got,current.pins[key]));}
  if(map.id==='valve/middle_valve_spindle_inferred_horizontal')maxJoint=Math.max(maxJoint,dist(solver.transformPoint(ref.spindle.rear,frame),current.spindle.rear));
  for(let mask=0;mask<8;mask++){
   const point=[0,1,2].map(j=>map.sourceAabb[(mask>>j)&1][j]);
   const q=solver.transformPoint(point,frame),back=solver.transformPoint(q,frame,true);
   maxInverse=Math.max(maxInverse,dist(point,back));maxPlane=Math.max(maxPlane,Math.abs(point[1]-q[1]));
   if(k===0)maxIdentity=Math.max(maxIdentity,dist(point,q));checks++;
  }
 }
}
for(const p of c.SCENE.parts.filter(p=>!ids.includes(p.id)))assert.strictEqual(solver.transformFor(p.id,.4),null);
assert(Math.max(maxJoint,maxInverse,maxIdentity,maxPlane)<1e-12);
// The UMD browser export works without modifying DYNAMIC or auto-attaching.
const before=JSON.stringify(c.DYNAMIC);vm.runInContext(fs.readFileSync(path.join(__dirname,'gresley_solver.js'),'utf8'),c);
assert.equal(typeof c.createGresleySolver,'function');assert.equal(before,JSON.stringify(c.DYNAMIC));
const report={pass:true,totalWhitelistedFields:14,movingFields:13,fixedFields:1,plane:'XZ',unchangedAxis:'Y',testedPhases:361,aabbCornerChecks:checks,maxJointErrorM:maxJoint,maxInverseErrorM:maxInverse,maxReferenceIdentityErrorM:maxIdentity,maxUnchangedYErrorM:maxPlane,unsupportedFieldsReturnNull:true,sourceFieldsMutated:false,autoAttachedToRenderer:false,knownExistingLeverOverlap:true,wholeMechanicalAcceptance:false,mappings};
fs.writeFileSync(path.join(__dirname,'FIELD_MAPPING_QA.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,mappings:report.mappings.map(m=>({id:m.id,type:m.type,anchor:m.anchor,direction:m.direction}))},null,2));
