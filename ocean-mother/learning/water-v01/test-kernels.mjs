import assert from 'node:assert/strict';
import {beamTransmittance as beam, advanceFoamCoverage as foam,
  directionalSamplePoint as warp} from './reference-kernels.mjs';
const results = [];
function test(name, fn) {
  try { fn(); results.push({name, passed:true}); }
  catch (e) { results.push({name, passed:false, error:String(e)}); }
}
const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a-b) <= eps, `${a} != ${b}`);
const a = [0.03,0.08,0.2], s=[0.1,0.07,0.02];
test('beam.zero_path_is_one',()=>assert.deepEqual(beam(a,s,0),[1,1,1]));
test('beam.zero_extinction_is_one',()=>assert.deepEqual(beam([0,0,0],[0,0,0],100),[1,1,1]));
test('beam.range',()=>beam(a,s,3).forEach(v=>assert.ok(v>=0&&v<=1)));
test('beam.monotonic_path',()=>beam(a,s,4).forEach((v,i)=>assert.ok(v<=beam(a,s,2)[i])));
test('beam.segment_composition',()=>beam(a,s,7).forEach((v,i)=>close(v,beam(a,s,2)[i]*beam(a,s,5)[i])));
test('beam.reject_negative_coefficients',()=>assert.throws(()=>beam([-1,0,0],s,1),RangeError));
test('beam.reject_negative_path',()=>assert.throws(()=>beam(a,s,-1),RangeError));
test('beam.reject_nonfinite',()=>assert.throws(()=>beam(a,s,NaN),TypeError));
test('beam.reject_wrong_vector',()=>assert.throws(()=>beam([0],s,1),TypeError));
test('foam.pause_preserves_state',()=>close(foam(.3,.7,.4,0),.3));
test('foam.zero_rates_preserve_state',()=>close(foam(.3,0,0,50),.3));
test('foam.pure_decay',()=>close(foam(.8,0,.4,2),.8*Math.exp(-.8)));
test('foam.pure_birth',()=>close(foam(0,.3,0,2),1-Math.exp(-.6)));
test('foam.equilibrium',()=>close(foam(.6,.3,.2,4),.6));
test('foam.time_partition_invariance',()=>close(foam(foam(.2,.6,.3,.25),.6,.3,.75),foam(.2,.6,.3,1)));
test('foam.bounded_rate_time_grid',()=>{
 for(const f of [0,.2,.7,1]) for(const b of [0,.1,100])
 for(const d of [0,.3,50]) for(const dt of [0,1e-8,.01,1,100]) {
   const v=foam(f,b,d,dt); assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
 }
});
test('foam.reject_negative_rate',()=>assert.throws(()=>foam(.2,-1,0,.1),RangeError));
test('foam.reject_invalid_coverage',()=>assert.throws(()=>foam(1.1,0,0,1),RangeError));
test('foam.reject_nonfinite_time',()=>assert.throws(()=>foam(.2,0,0,Infinity),TypeError));
test('warp.zero_amplitude_identity',()=>assert.deepEqual(warp([2,3],1,0),[2,3]));
test('warp.direction_units_and_input_immutability',()=>{
 const p=[2,3],q=warp(p,Math.PI/2,2);close(q[0],2);close(q[1],5);assert.deepEqual(p,[2,3]);
});
test('warp.reject_nonfinite',()=>assert.throws(()=>warp([2,3],NaN,1),TypeError));
const report={schema:'ocean-study-kernel-tests/1',node:process.version,
 environment:`${process.platform}/${process.arch}`,tests:results,
 passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,
 scope:'Independent numerical reference kernels only; no scene, GPU, browser or performance test.',
 runtimeIntegrated:false,visualApproved:false,productionApproved:false};
console.log(JSON.stringify(report,null,2));
process.exitCode=report.failed ? 1:0;
