const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),c={};c.window=c;vm.createContext(c);
for(const f of ['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','gresley-dynamic.js','stack-fields.js','stack-dynamic.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
const D=c.DYNAMIC,inst=D.snapshot({mode:'candidate',beta:.126});
const stack=c.SCENE.parts.filter(p=>p.source==='stack'),other=c.SCENE.parts.filter(p=>p.source!=='stack'&&D.visible(p,inst));
const pairs=new Map(), n=72;
const overlap=(a,b)=>[0,1,2].every(j=>Math.min(a[1][j],b[1][j])-Math.max(a[0][j],b[0][j])>0);
for(let k=0;k<n;k++){
 const Time=k*2*Math.PI/n,theta=.4+Time;
 const ob=other.map(p=>[p,D.bounds(p,theta,inst)]);
 for(const p of stack){const pb=D.bounds(p,theta,inst);for(const [q,qb]of ob){if(!overlap(pb,qb))continue;const id=p.id+' | '+q.id;let row=pairs.get(id);if(!row){row={stack:p.id,other:q.id,source:q.source,group:q.group,samples:[],first:{Time,theta,stackBounds:pb,otherBounds:qb},stackFunction:p.glsl_function,otherFunction:q.glsl_function};pairs.set(id,row);}row.samples.push(k);}}
}
const out={description:'Conservative transformed AABB overlap possibilities only; not collisions or full-cycle proof.',installation:inst,phaseSamples:n,TimeRange:[0,2*Math.PI],originals:c.SCENE.parts.filter(p=>p.source!=='stack').length,stack:stack.length,otherVisible:other.length,candidateVisible:stack.length+other.length,pairCount:pairs.size,pairs:[...pairs.values()]};
fs.writeFileSync(path.join(__dirname,'BROADPHASE.json'),JSON.stringify(out,null,2));
fs.writeFileSync(path.join(__dirname,'sources.json'),JSON.stringify(c.SCENE.sources,null,2));
fs.writeFileSync(path.join(__dirname,'parts.json'),JSON.stringify(c.SCENE.parts,null,2));
console.log(JSON.stringify({...out,pairs:out.pairs.map(x=>({stack:x.stack,other:x.other,samples:x.samples.length,theta:x.first.theta,functions:[x.stackFunction,x.otherFunction]}))},null,2));
