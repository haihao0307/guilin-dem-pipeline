const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),c={};c.window=c;vm.createContext(c);
for(const f of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','gresley-dynamic.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),c);
const original=JSON.stringify(c.SCENE.parts),source=JSON.stringify(c.SCENE.sources);
for(const f of ['stack-fields.js','stack-dynamic.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),c);
assert.equal(JSON.stringify(c.SCENE.parts.slice(0,519)),original);const {stack,...oldSources}=c.SCENE.sources;assert.equal(JSON.stringify(oldSources),source);
assert.equal(c.SCENE.parts.length,592);assert.equal(new Set(c.SCENE.parts.map(p=>p.id)).size,592);
for(const [mode,count]of [['baseline',519],['candidate',574]])assert.equal(c.SCENE.parts.filter(p=>c.DYNAMIC.visible(p,{mode})).length,count);
let checks=0;for(let i=0;i<=360;i++)for(const p of c.STACK_CANDIDATE.parts){const t=.4+2*Math.PI*i/360,f=c.DYNAMIC.gresleyFrame(p,t,{mode:'candidate'}),b=c.DYNAMIC.bounds(p,t,{mode:'candidate'});assert(f.inverseXZ.every(Number.isFinite));assert(b.flat().every(Number.isFinite));assert.equal(c.DYNAMIC.argument(p),'dynGresley(p)');checks++;}
const r={pass:true,defined:592,baselineDraws:519,candidateDraws:574,originalFieldsUnchanged:true,inverseFrameChecks:checks,wholeMechanicalAcceptance:false,missing:['fixed O frame attachment','retainer locking construction','middle spindle guide/chest','whole train clearance']};fs.writeFileSync(path.join(__dirname,'STACK_ADAPTER_QA.json'),JSON.stringify(r,null,2));console.log(r);
