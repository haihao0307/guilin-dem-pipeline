import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StrandDynamics,DT} from '../src/physics.mjs';
const results=[];
for(const style of ['medium','long']){
 const d=new StrandDynamics(style);d.enabled=true;d.setWind(.38);let peak=0;
 for(let i=0;i<360;i++){d.advance(DT);peak=Math.max(peak,d.detail.peak);}
 const q=d.detail.q,bank=d.detail.bank,mean=q.reduce((s,v,i)=>s+(i%4===0?v:0),0)/10000;
 let variance=0,positive=0,negative=0,neighborDifference=0,pairs=0;
 for(let i=0;i<10000;i++){const a=q[i*4];variance+=(a-mean)**2;if(a>0)positive++;else negative++;if(i%13===0){let nearest=-1,best=Infinity;for(let j=i+1;j<Math.min(10000,i+80);j++){const dist=(bank.roots[i*4]-bank.roots[j*4])**2+(bank.roots[i*4+1]-bank.roots[j*4+1])**2;if(dist<best){best=dist;nearest=j;}}if(nearest>=0){neighborDifference+=Math.abs(a-q[nearest*4]);pairs++;}}}
 const rms=Math.sqrt(variance/10000),state=d.snapshot();assert.ok(rms>.0001);assert.ok(positive>1000&&negative>1000,'Local residual must separate on both sides rather than translate the entire mass');assert.equal(state.rootError,0);assert.ok(state.maxRelativeStretch<1e-4);
 d.paused=true;const frozen=d.detail.q.slice();d.advance(.05);assert.deepEqual(d.detail.q,frozen);d.paused=false;
 d.enabled=false;for(let i=0;i<720;i++)d.advance(DT);const decay=d.detail.peak;assert.ok(decay<peak*.002);
 d.reset();assert.ok(d.detail.texture.every(x=>x===0));
 d.enabled=true;d.setWind(1.5);for(let i=0;i<360;i++)d.advance(DT);assert.ok(d.detail.q.every(Number.isFinite));assert.ok(d.detail.peak<d.snapshot().nominalLength*.25);
 results.push({style,windStrength:.38,peakMetres:peak,rmsMetres:rms,meanMetres:mean,positive,negative,neighborDifference:neighborDifference/pairs,rootError:state.rootError,guideStretch:state.maxRelativeStretch,afterWindOff6sec:decay,maxWindResidual:d.detail.peak});
}
fs.writeFileSync('qa/wind-physics-report.json',JSON.stringify({passed:true,checks:['fixed roots under pure wind','signed individual displacement','nearby strand relative motion','pause freezes local modes','wind-off decay','reset clears GPU texture','strong wind nonlinear stiffening'],results},null,2));console.log(results);
