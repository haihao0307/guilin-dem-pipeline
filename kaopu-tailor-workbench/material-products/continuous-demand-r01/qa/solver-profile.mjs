import fs from 'node:fs';import zlib from 'node:zlib';import path from 'node:path';import {fileURLToPath,pathToFileURL}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),variant=process.argv[2]||'baseline',directory=path.join(root,variant);
const {BodySDF}=await import(pathToFileURL(path.join(directory,'material-physics.mjs'))),{CoupledCloth}=await import(pathToFileURL(path.join(directory,'coupled-cloth.mjs'))),{accelerateWorld,loadClothKernel}=await import(pathToFileURL(path.join(directory,'wasm-cloth.mjs')));
const input=JSON.parse(fs.readFileSync(path.join(root,'qa/input.json'))),meta=JSON.parse(fs.readFileSync(path.join(directory,'assets/body-sdf-grid.json'))),raw=zlib.gunzipSync(fs.readFileSync(path.join(directory,'assets/common-body.sdfd.gz')));
const sdf=new BodySDF(meta,new Int16Array(raw.buffer,raw.byteOffset,raw.byteLength/2),input.lock.groundShiftM),world=accelerateWorld(new CoupledCloth(input.rows.map(r=>({...r,positions:Float32Array.from(r.positions)})),{sdf,actor:input.actor,settings:input.settings}),await loadClothKernel(fs.readFileSync(path.join(directory,'cloth-kernel.wasm'))));
for(let i=0;i<8;i++)world.step(1/30,false);
const b=world.acceleration,profile={};b.e=Object.fromEntries(Object.entries(b.e).map(([name,f])=>[name,typeof f!=='function'?f:(...args)=>{let t=performance.now();const r=f(...args),dt=performance.now()-t,s=profile[name]||(profile[name]={calls:0,ms:0});s.calls++;s.ms+=dt;return r}]));
if(process.argv[3]==='curve')b.config={stageProfile:true};
const steps=[];for(let i=0;i<(process.argv[3]==='curve'?1:8);i++){const t=performance.now();world.step(1/60);steps.push(performance.now()-t);}
const result={variant,particles:world.solvers.map(s=>s.count),edges:world.solvers.map(s=>s.edges.length),bends:world.solvers.map(s=>s.bends.length),steps,profile,metrics:b.metrics};fs.writeFileSync(path.join(root,'qa/profile-'+variant+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
