import assert from 'node:assert/strict';import fs from 'node:fs';
import {sampleTriangle,encodeStrand,integrateStrand,smoothStrand,buildSpringTopology} from '../src/StrandCore.js';
let state=98765;const rng=()=>{state=Math.imul(state,1664525)+1013904223;return (state>>>0)/4294967296};
const a=[0,0,0],b=[0,0,0],count=100000;
for(let i=0;i<count;i++){const w=sampleTriangle(rng);assert(Math.abs(w.reduce((a,b)=>a+b)-1)<1e-12);w.forEach((v,k)=>a[k]+=v/count);const ra=rng(),rb=rng(),rc=rng(),old=[(1-rc)*(1-ra)+rc*(1-rb),(1-rc)*ra,rc*rb];old.forEach((v,k)=>b[k]+=v/count)}
assert(a.every(v=>Math.abs(v-1/3)<.004));assert(Math.abs(b[0]-.5)<.005);
const p=Float32Array.from([.1,.3,.02,.1008,.301,.021,.102,.3007,.022,.103,.302,.023,.104,.300,.026]);const d=encodeStrand(p),r=integrateStrand(d);assert(r.every((v,i)=>Math.abs(v-p[i])<1e-6));
const sm=smoothStrand(p,3);assert.deepEqual(Array.from(sm.slice(0,3)),Array.from(p.slice(0,3)));assert(sm.every(Number.isFinite));assert(!sm.every((v,i)=>v===p[i]));
const t=buildSpringTopology([p,p]);assert.equal(t.particleCount,10);assert.equal(t.links.length/2,18);assert.deepEqual(Array.from(t.rootIndices),[0,5]);assert(t.restLengths.every(v=>v>0));assert.equal(t.physicsRunning,false);
fs.mkdirSync('kaopu-hair-workbench/fusion/r11/evidence',{recursive:true});fs.writeFileSync('kaopu-hair-workbench/fusion/r11/evidence/unit.json',JSON.stringify({success:true,samples:count,uniformBarycentricMean:a,digitalSalonOriginalNestedLerpMean:b,roundTripToleranceMetres:1e-6,springLinks:18,rootPinIndices:Array.from(t.rootIndices),physicsRunning:false},null,2));console.log('PASS uniform roots, Perm-derived encode/integrate/smooth, Digital Salon topology');
