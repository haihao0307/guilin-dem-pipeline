const fs=require('fs'),vm=require('vm'),path=require('path');const c={};c.window=c;vm.createContext(c);const root=path.resolve(__dirname,'..');
for(const f of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','gresley-dynamic.js','stack-fields.js','stack-dynamic.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c);
const B=JSON.parse(fs.readFileSync(path.join(__dirname,'BROADPHASE.json'))),D=c.DYNAMIC,inst=D.snapshot({mode:'candidate',beta:.126});
const ids=new Set(B.pairs.flatMap(x=>[x.stack,x.other]));const parts=c.SCENE.parts.filter(p=>ids.has(p.id));
function inverse(p,theta,v){const g=D.gresleyFrame(p,theta,inst);if(g)return D.gresleySolver.transformPoint(v,g,true);const f=D.valveFrame(p,theta,inst);if(f)return D.valvePoint(v,f,true);return D.transform(v,theta,D.classify(p),true,inst);}
const frames=Array.from({length:B.phaseSamples},(_,k)=>{const theta=.4+k*2*Math.PI/B.phaseSamples;return {Time:theta-.4,theta,parts:Object.fromEntries(parts.map(p=>{const off=inverse(p,theta,[0,0,0]),cols=[[1,0,0],[0,1,0],[0,0,1]].map(v=>inverse(p,theta,v).map((x,j)=>x-off[j]));return[p.id,{bounds:D.bounds(p,theta,inst),inverseOffset:off,inverseRows:[0,1,2].map(j=>cols.map(v=>v[j]))}]}))};});
fs.writeFileSync(path.join(__dirname,'FRAMES.json'),JSON.stringify(frames));
