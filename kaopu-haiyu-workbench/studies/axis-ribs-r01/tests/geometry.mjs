import {evaluate,inspect,transportedFrames,project,dot} from '../geometry.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
const hash=p=>crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex'),checks=[];
for(const amplitude of[0,.4,1,2])for(const time of[0,.5,1,1.5,2,2.5,3,3.5,4])for(const ribCount of[2,12,24]){
 const p=evaluate({amplitude,time,ribCount}),before=hash(p),m=inspect(p);
 assert.ok(m.allFinite);assert.ok(m.orthogonality<1e-12);assert.ok(m.unitError<1e-12);assert.ok(m.handedness>1-1e-12);assert.ok(m.adjacentNormalDot>0);assert.equal(m.rootError,0);assert.equal(m.stations,ribCount);assert.equal(m.ribCount,2*ribCount);
 for(const view of['front','top','side','orbit'])for(const v of p.axis)project(v,view,1.1,.8);
 assert.equal(hash(p),before);assert.equal(hash(evaluate({amplitude,time,ribCount})),before);checks.push({amplitude,time,ribCount,...m});
}
assert.throws(()=>transportedFrames([[1,0,0],[-1,0,0]]),/reverse/);assert.throws(()=>transportedFrames([[0,0,0]]),/Degenerate/);assert.throws(()=>evaluate({camera:[1,1,1]}),/Unsupported/);
assert.throws(()=>transportedFrames([[1,0,0],[0,1,0]]),/60 degrees/);
assert.throws(()=>transportedFrames([[1,0,0],[1,0,0]],[0,1,0],{closed:true}),/Closed paths/);
assert.throws(()=>transportedFrames([[1,0,0]],[1,0,0]),/Degenerate/);
const parallel=transportedFrames([[1,0,0],[1,1e-14,0],[1,-1e-14,0]]);assert.ok(dot(parallel[0].N,parallel[2].N)>.999999);
const straight=transportedFrames(Array.from({length:32},()=>[1,0,0]));assert.ok(straight.every(f=>dot(f.N,[0,1,0])===1));
// Longitudinal threshold-crossing: no auxiliary-axis sign switch around |T.y|=.95.
const tangents=Array.from({length:1001},(_,i)=>{const a=1.15+.5*i/1000;return[Math.cos(a),Math.sin(a),.06*Math.sin(4*a)]});const f=transportedFrames(tangents,[0,0,1]);let minimum=1;for(let i=1;i<f.length;i++)minimum=Math.min(minimum,dot(f[i].N,f[i-1].N));assert.ok(minimum>.99);
// Temporal continuity at every fixed station over one explicit 4s cycle.
let last=null,minTemporal=1,maxRootSpeed=0;for(let n=0;n<=240;n++){const p=evaluate({time:n/60,amplitude:2});if(last){for(let i=0;i<p.frames.length;i++)minTemporal=Math.min(minTemporal,dot(p.frames[i].N,last.frames[i].N));}last=p;}assert.ok(minTemporal>.999);
const report={ok:true,geometryCases:checks.length,maxRootError:Math.max(...checks.map(x=>x.rootError)),maxOrthogonalityError:Math.max(...checks.map(x=>x.orthogonality)),minimumSpatialNormalDot:Math.min(...checks.map(x=>x.adjacentNormalDot)),minimumTemporalNormalDot:minTemporal,thresholdCrossingNormalDot:minimum,cameraHashUnchanged:true,reversalRejected:true,sharpTurnAbove60DegreesRejected:true,closedLoopRejected:true,zeroTangentRejected:true,parallelSeedRejected:true,nearParallelPass:true,straightPass:true,scope:"108 selected states plus stated synthetic edge cases; open curves only, no global guarantee",physicalSimulation:false,browserVerified:false};fs.writeFileSync(new URL('../geometry-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
