import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StrandDynamics,DT} from '../src/physics.mjs';
import {makeRoots,sampleWeights,hashFloats} from '../src/specimen.mjs';
const results=[];
for(const style of ['medium','long']){
 const d=new StrandDynamics(style),rest=d.sample(42,1),trajectory=[];d.impulse();
 for(let i=0;i<Math.round(3/DT);i++){
  d.advance(DT);if(i%2===0)trajectory.push({time:d.time,tip:d.sample(42,1),energy:d.snapshot().kineticEnergy});
  assert.ok(d.q.every(Number.isFinite));
 }
 const impulse=d.snapshot(),firstPeak=trajectory.reduce((a,b)=>Math.abs(b.tip[0]-rest[0])>Math.abs(a.tip[0]-rest[0])?b:a);
 assert.equal(impulse.rootError,0);assert.ok(impulse.maxRelativeStretch<1e-5);
 assert.ok(Math.abs(firstPeak.tip[0]-rest[0])>.002);assert.ok(trajectory.at(-1).energy<Math.max(...trajectory.map(x=>x.energy))*.02);
 d.reset();const weights=new Float32Array(85);for(let i=0;i<85;i++)weights[i]=Math.exp(-((d.positions[i*3])**2)/.0001-((d.positions[i*3+2])**2)/.00008);
 d.setGrab(weights,.65,[style==='long'?.07:.03,0,.01]);
 for(let i=0;i<Math.round(.5/DT);i++)d.advance(DT);
 const held=d.snapshot();assert.ok(held.maxOffset>.004);assert.ok(held.maxRelativeStretch<1e-4);assert.equal(held.rootError,0);
 d.release();for(let i=0;i<Math.round(3/DT);i++)d.advance(DT);const released=d.snapshot();assert.ok(released.maxVelocity<.05);
 d.reset();d.enabled=true;d.setWind(1.5);for(let i=0;i<Math.round(2/DT);i++)d.advance(DT);const wind=d.snapshot();assert.ok(d.q.every(Number.isFinite));assert.ok(wind.maxRelativeStretch<1e-4);assert.equal(wind.rootError,0);assert.ok(wind.maxOffset>.0001&&wind.maxOffset<.5);
 d.reset();d.sway=true;for(let i=0;i<Math.round(1.5/DT);i++)d.advance(DT);const sway=d.snapshot();assert.equal(sway.rootError,0);assert.ok(sway.maxRelativeStretch<1e-4);
 d.paused=true;const frozen=d.q.slice();d.advance(.05);assert.deepEqual(d.q,frozen);
 results.push({style,firstPeak,rest,impulse,held,released,wind,sway,trajectory});
}
assert.ok(results[1].firstPeak.time>results[0].firstPeak.time*1.35,'Long hair must respond more slowly than medium hair');
const a=new StrandDynamics(),b=new StrandDynamics();a.impulse();b.impulse();for(let i=0;i<120;i++)a.advance(1/120);for(let i=0;i<60;i++)b.advance(1/60);assert.ok(a.q.every((v,i)=>Math.abs(v-b.q[i])<1e-12),'Frame chunking must preserve the fixed-step state');
const bank=makeRoots(),again=makeRoots();assert.equal(hashFloats([bank.roots,bank.traits]),hashFloats([again.roots,again.traits]));
for(let i=0;i<10000;i++){
 const x=bank.roots[i*4],z=bank.roots[i*4+1];assert.ok((x/.027)**2+(z/.014)**2<=1.00001);
 const w=sampleWeights(x,z);assert.ok(Math.abs(w.weights.reduce((a,b)=>a+b,0)-1)<1e-12);assert.ok(w.weights.every(v=>v>=0));assert.ok(w.ids.every(v=>v>=0&&v<85));
}
fs.writeFileSync('qa/physics-report.json',JSON.stringify({passed:true,checks:['elliptical stable roots','four normalized guide weights','fixed follicle and tangent','guide length convergence','decaying impulse','different length-dependent peak time','grab/release','maximum wind','root sway','pause','fixed-step input equivalence'],results},null,2));
console.log('Physics checks passed. First peaks:',results.map(x=>[x.style,x.firstPeak.time,Math.abs(x.firstPeak.tip[0]-x.rest[0])]).join(' / '));
