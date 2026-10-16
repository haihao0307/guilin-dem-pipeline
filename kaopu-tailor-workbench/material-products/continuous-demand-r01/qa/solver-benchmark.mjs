import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import os from'node:os';import{createWorld,root}from'./world.mjs';
const duration=Number(process.argv[2]||60),repeat=Number(process.argv[3]||3),results=[];
const sourceHashes=Object.fromEntries(['baseline','candidate'].map(v=>[v,Object.fromEntries(['cloth-kernel.wasm','wasm-cloth.mjs','coupled-cloth.mjs'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,v,f))).digest('hex')]))]));
const percentile=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor((s.length-1)*p))]};
for(let trial=0;trial<repeat;trial++)for(const variant of ['baseline','candidate']){
 const world=await createWorld(variant);for(let i=0;i<8;i++)world.step(1/30,false);for(let i=0;i<12;i++)world.step(1/60);
 const start=performance.now(),simStart=world.elapsed,samples=[],packetTimes=[];let frames=0;
 while(performance.now()-start<duration*1000){const t=performance.now();world.step(1/60);samples.push(performance.now()-t);frames++;}
 const wall=(performance.now()-start)/1000,sim=world.elapsed-simStart,step={p50:percentile(samples,.5),p95:percentile(samples,.95),p99:percentile(samples,.99),max:Math.max(...samples)};
 const r={variant,trial,activeWallSeconds:wall,simulationSeconds:sim,simulationToWallRatio:sim/wall,frames,stepMS:step,memory:process.memoryUsage(),quality:world.solvers.map(s=>s.audit(true)),queryReuse:variant==='candidate'?{full:world.acceleration.e.cache_full_queries(),exact:world.acceleration.e.cache_exact_hits(),certificate:world.acceleration.e.cache_certificate_hits()}:null};results.push(r);
 fs.writeFileSync(path.join(root,'qa/solver-benchmark.json'),JSON.stringify({scope:'isolated WASM solver in Node; does not measure displayed FPS or GPU',environment:{node:process.version,cpu:os.cpus()[0].model,platform:os.platform(),ramBytes:os.totalmem()},sourceHashes,durationSeconds:duration,repeat,results},null,2));console.log(JSON.stringify({variant,trial,wall,sim,step}));
}
