import test from 'node:test';
import assert from 'node:assert/strict';
import {SPEC, poly, withCandidateProfile} from './BrowCandidate.mjs';
const baseline=()=>({schema:'native-brow-band-profile/1',targetCenterYCoeff:[...SPEC.expectedBaselineCenter],targetHalfWidthCoeff:[...SPEC.expectedBaselineWidth],sourceAbsX:[.1391,.54167],unchanged:{material:'source'}});
test('callback sees the effective profile and successful construction restores every source field',async()=>{
 const p=baseline(),saved=structuredClone(p);const result=await withCandidateProfile(p,async()=>{assert.deepEqual(p.targetCenterYCoeff,SPEC.changes.targetCenterYCoeff);p.callbackDiagnostic=1;return 'bound'});assert.equal(result,'bound');assert.deepEqual(p,saved);
});
test('failed asynchronous binding restores source profile and propagates its error',async()=>{
 const p=baseline(),saved=structuredClone(p);await assert.rejects(withCandidateProfile(p,async()=>{await Promise.resolve();p.targetCenterYCoeff[0]=999;throw Error('binding failed')}),/binding failed/);assert.deepEqual(p,saved);
});
test('source mismatch rejects before running binding or changing the profile',async()=>{
 const p=baseline();p.targetCenterYCoeff[0]+=.001;const saved=structuredClone(p);let invoked=false;await assert.rejects(withCandidateProfile(p,async()=>{invoked=true}),/Unexpected original/);assert.equal(invoked,false);assert.deepEqual(p,saved);
});
test('authored band has one modest outer crest and a tapered descending tail',()=>{
 const c=SPEC.changes.targetCenterYCoeff,w=SPEC.changes.targetHalfWidthCoeff;
 let peak={t:0,y:-Infinity};for(let i=0;i<=1000;i++){const t=i/1000,y=poly(c,t);if(y>peak.y)peak={t,y};assert(poly(w,t)>.00018);assert(poly(w,t)<.0045);}
 assert(Math.abs(peak.t-.62)<.002);assert(peak.y-poly(c,0)<.0022);assert(poly(c,1)<poly(c,0));assert(poly(w,1)<.0006);assert(poly(w,.5)>.002);
});
