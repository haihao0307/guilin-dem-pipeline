// Independent read-only capture: all new bodies against every visible train body.
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const outdir=process.env.OUT_DIR?path.resolve(process.env.OUT_DIR):__dirname;fs.mkdirSync(outdir,{recursive:true});const root=path.resolve(__dirname,'../r29'),c={};c.window=c;vm.createContext(c);
const inputs=['scene.js','dynamic.js','outside_valve_solver.js','valve-dynamic.js','gresley_solver.js','topology-parameters.js','side_offset_solver.js','gresley-dynamic.js','stack-fields.js','stack-dynamic.js','middle-chest-fields.js','middle-chest-dynamic.js','frame-support-fields.js','frame-support-dynamic.js'];
for(const f of inputs)vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
const D=c.DYNAMIC,inst=D.snapshot({mode:'candidate',beta:Number(process.env.BETA||.126)}),n=72;
const all=c.SCENE.parts.filter(p=>D.visible(p,inst));
const added=all.filter(p=>p.id.startsWith('stack_candidate/')||p.id.startsWith('middle_topology/')||p.id.startsWith('frame_support/'));
const hashes=Object.fromEntries(inputs.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const addedIds=new Set(added.map(p=>p.id)),pairs=new Map();
const overlap=(a,b)=>[0,1,2].every(j=>Math.min(a[1][j],b[1][j])-Math.max(a[0][j],b[0][j])>0);
for(let k=0;k<n;k++){
 const Time=k*2*Math.PI/n,theta=.4+Time,ab=all.map(p=>[p,D.bounds(p,theta,inst)]);
 for(const p of added){const pb=D.bounds(p,theta,inst);for(const [q,qb]of ab){if(p.id===q.id||(addedIds.has(q.id)&&p.id>q.id)||!overlap(pb,qb))continue;
 const id=p.id+' | '+q.id;let row=pairs.get(id);if(!row){row={stack:p.id,other:q.id,source:q.source,group:q.group,samples:[],first:{Time,theta,stackBounds:pb,otherBounds:qb},stackFunction:p.glsl_function,otherFunction:q.glsl_function};pairs.set(id,row);}row.samples.push(k);
 }}
}
const out={description:'Conservative transformed AABB overlap possibilities only; not collisions or full-cycle proof.',installation:inst,phaseSamples:n,TimeRange:[0,2*Math.PI],baselineVisible:c.SCENE.parts.filter(p=>D.visible(p,D.snapshot({mode:'baseline'}))).length,added:added.length,candidateVisible:all.length,pairCount:pairs.size,pairs:[...pairs.values()]};
function write(name,data){fs.writeFileSync(path.join(outdir,name),JSON.stringify(data,null,2));}
write('INPUT_SHA256.json',hashes);write('BROADPHASE.json',out);write('sources.json',c.SCENE.sources);write('parts.json',c.SCENE.parts);write('HOST_CUTS.json',c.SCENE.hostCuts);write('PARAMETERS.json',c.TOPOLOGY_PARAMETERS);
const ids=new Set(out.pairs.flatMap(x=>[x.stack,x.other]));const parts=all.filter(p=>ids.has(p.id));
function inverse(p,theta,v){const g=D.gresleyFrame(p,theta,inst);if(g)return D.gresleySolver.transformPoint(v,g,true);const f=D.valveFrame(p,theta,inst);if(f)return D.valvePoint(v,f,true);return D.transform(v,theta,D.classify(p),true,inst);}
const frames=Array.from({length:n},(_,k)=>{const theta=.4+k*2*Math.PI/n;return {Time:theta-.4,theta,parts:Object.fromEntries(parts.map(p=>{const off=inverse(p,theta,[0,0,0]),cols=[[1,0,0],[0,1,0],[0,0,1]].map(v=>inverse(p,theta,v).map((x,j)=>x-off[j]));return[p.id,{bounds:D.bounds(p,theta,inst),inverseOffset:off,inverseRows:[0,1,2].map(j=>cols.map(v=>v[j]))}]}))};});
fs.writeFileSync(path.join(outdir,'FRAMES.json'),JSON.stringify(frames));
console.log(JSON.stringify({...out,pairs:undefined,candidateIds:added.map(p=>p.id)}));
