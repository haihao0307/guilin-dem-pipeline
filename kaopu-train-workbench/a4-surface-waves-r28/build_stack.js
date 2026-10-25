const fs=require('fs'),vm=require('vm'),path=require('path');const c={};c.window=c;vm.createContext(c);for(const f of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','gresley-dynamic.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),c);
const S=require('./stack-reconstruction/stack_candidate'),I=require('./stack-reconstruction/integration_spec'),G=c.DYNAMIC.gresleySolver,P=S.inspect(c.SCENE,G.reference),D=S.derive(P,G.reference,{}, {terminalEyes:true}),B=I.pack(D,P,G.pose(.4));
const first=c.SCENE.parts.find(p=>p.source==='motion').glsl_function;
const source=c.SCENE.sources.motion.slice(0,c.SCENE.sources.motion.indexOf('float '+first+'('))+B.helperGLSL+B.fields.map(f=>f.glsl).join('\n');
const parts=B.fields.map(f=>({id:'stack_candidate/'+f.id,source:'stack',group:'stack',glsl_function:f.fieldFunction,aabb_min:f.AABB[0],aabb_max:f.AABB[1],lipschitz:f.lipschitzGpuInflated,frameSourceId:f.referenceRigidFrameSourcePartId,status:'inferred_finite_thickness_candidate_only'}));
const suppress=[...B.fields.filter(f=>f.sourcePartId).map(f=>f.sourcePartId),...B.aliasPolicy.map(f=>f.sourcePartId)];
fs.writeFileSync(path.join(__dirname,'stack-fields.js'),'window.STACK_CANDIDATE='+JSON.stringify({source,parts,suppress,warnings:B.warnings})+';\n');
console.log(JSON.stringify({extra:parts.length,suppress:suppress.length,baseline:519,candidate:519-suppress.length+parts.length}));
