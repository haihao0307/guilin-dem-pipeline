import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {curveDistance} from '../src/StaticGroomRules.mjs';
const base=new URL('../',import.meta.url),load=name=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(name,base)))),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before=load('inputs/static-r01-baseline.json.gz'),after=load('assets/structure.json.gz'),bytes=zlib.gunzipSync(fs.readFileSync(new URL('assets/roots.bin.gz',base))),roots=new Float32Array(Uint8Array.from(bytes).buffer);
const identity=Buffer.concat(Array.from({length:after.rootCount},(_,i)=>bytes.subarray(i*after.stride*4,i*after.stride*4+7*4)));
assert.equal(sha(identity),before.rootIdentitySHA256,'Native triangle, barycentric position and candidate identity must stay unchanged');
assert.equal(after.rootCount,before.rootCount);
function atHeight(g,y){for(let n=1;n<g.points.length/3;n++){const a=g.points.slice((n-1)*3,n*3),b=g.points.slice(n*3,n*3+3);if(a[1]>=y&&b[1]<=y){const t=(a[1]-y)/(a[1]-b[1]);return a.map((v,k)=>v+(b[k]-v)*t);}}}
function metrics(data){
 let pairs=0,inversions=0;
 const curves=data.guides.filter(g=>g.zone>1).map(g=>({g,a:atHeight(g,.26),b:atHeight(g,.18)})).filter(q=>q.a&&q.b&&q.a[2]<.02&&q.b[2]<.02);
 for(let i=0;i<curves.length;i++)for(let j=i+1;j<curves.length;j++){const a=curves[i],b=curves[j];if(a.g.zone!==b.g.zone||Math.sign(a.a[0])!==Math.sign(b.a[0]))continue;pairs++;if((a.a[0]-b.a[0])*(a.b[0]-b.b[0])<-.000001)inversions++;}
 const tilts=data.guides.filter(g=>g.zone>1).map(g=>{const a=g.points.slice(-3),b=g.points.slice(-21,-18),d=a.map((v,k)=>v-b[k]);return Math.acos(Math.max(-1,Math.min(1,-d[1]/Math.hypot(...d))))*180/Math.PI;}).sort((a,b)=>a-b);
 return{guides:data.guides.length,backProjectionPairs:pairs,backProjectionOrderInversions:inversions,backProjectionInversionRatio:inversions/pairs,medianTipTiltDegrees:tilts[Math.floor(tilts.length*.5)],p90TipTiltDegrees:tilts[Math.floor(tilts.length*.9)],groups:Object.fromEntries(['macro','mid','micro'].map(level=>[level,data.clumpGraph.filter(g=>g.level===level).length]))};
}
const a=metrics(before),b=metrics(after);assert.ok(b.backProjectionInversionRatio<a.backProjectionInversionRatio*.5);assert.ok(b.medianTipTiltDegrees<a.medianTipTiltDegrees);assert.ok(b.p90TipTiltDegrees<a.p90TipTiltDegrees);
let excludedActiveRoots=0,invalidActiveRoots=0,active=0;
for(let i=0;i<after.rootCount;i++){const p=Array.from(roots.subarray(i*after.stride+4,i*after.stride+7)),enabled=roots[i*after.stride+25];if(before.activeMask[i]&&!enabled)excludedActiveRoots++;if(enabled){active++;if(!after.sourceDomain.eligibleMask[i])invalidActiveRoots++;}}
assert.equal(invalidActiveRoots,0);
let maxMeasuredMicroDiameter=0,maxMeasuredMidDiameter=0;
for(const group of after.clumpGraph){const members=group.guides.map(id=>after.guides.find(g=>g.id===id));let diameter=0;for(const a of members)for(const b of members)diameter=Math.max(diameter,curveDistance(a,b));assert.ok(Math.abs(diameter-group.curveDiameter)<1e-8);if(group.level==='mid'){maxMeasuredMidDiameter=Math.max(maxMeasuredMidDiameter,diameter);assert.ok(diameter<=after.profile.ClumpGraph.midDiameter+1e-10);}if(group.level==='micro'){maxMeasuredMicroDiameter=Math.max(maxMeasuredMicroDiameter,diameter);assert.ok(diameter<=after.profile.ClumpGraph.microDiameter+1e-10);}}
const geometry=JSON.parse(fs.readFileSync(new URL('evidence/structural-checks.json',base)));assert.equal(geometry.checks.find(c=>c.name==='guide centerlines avoid original body').details.crossings,0);
const report={pass:true,checkedUTC:new Date().toISOString(),revision:after.profile.revision,beforeSourceCommit:before.sourceCommit,beforeSourceAssetSHA256:before.sourceAssetSHA256,afterAssetSHA256:sha(fs.readFileSync(new URL('assets/structure.json.gz',base))),nativeCandidateIdentityPreserved:true,activeRoots:active,excludedPreviouslyActiveRoots:excludedActiveRoots,invalidActiveRoots,before:a,after:b,maxMeasuredMicroDiameterMM:maxMeasuredMicroDiameter*1000,maxMeasuredMidDiameterMM:maxMeasuredMidDiameter*1000,interpretation:'Projection order is a view-specific diagnostic, not proof of 3D self-collision safety. Tilt is a straight-groom regression measure, not a universal hairstyle rule. Static visual acceptance remains pending.'};
fs.writeFileSync(new URL('evidence/static-flow-checks.json',base),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
