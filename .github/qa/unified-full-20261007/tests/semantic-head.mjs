import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createCommon} from '../create-common.mjs';
import {defaultState} from '../src/State.mjs';
import{multiply,point,xyz,inverse3}from'../src/HeadMath.mjs';
const model=createCommon({headDriver:true}),sha=a=>crypto.createHash('sha256').update(a).digest('hex'),rows=[];
function run(s){return model.compute(s).slice();}
function diff(a,b){let max=0,n=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);if(d>1e-8)n++;}return{maxMetres:max,changedCoordinatesAbove10nm:n};}
const neutral=run(defaultState());assert.equal(sha(neutral),'fbc056553c1731b790769124bee121554f0800400271eaf564a0ad5e6f458571');
for(const owner of ['gnm','anny','mhr']){
 const s=defaultState();s.owners.headShape=owner;s.owners.expression=owner;s.owners.gaze=owner==='gnm'?'gnm':'expression';
 const before=run(s),saved=model.archive();
 for(const inactive of ['gnm','anny','mhr'].filter(x=>x!==owner)){
  const t=structuredClone(s);if(inactive==='anny')t.anny.facialActions={jawOpen:.5,eyeBlinkLeft:.5,tongueOut:.5};else t[inactive].expression[0]=.6;
  assert.equal(sha(run(t)),sha(before),owner+' changed under inactive '+inactive+' expression');
 }
 if(owner!=='gnm'){const t=structuredClone(s);t.gnm.identity[0]=1;assert.equal(sha(run(t)),sha(before),'Inactive GNM head shape');}
 model.restore(saved);assert.equal(sha(model.positions),sha(before));rows.push({name:owner+'-ownership',passed:true});
}
for(const gaze of ['gnm','rig','expression']){
 const s=defaultState();s.owners.headShape='anny';s.owners.expression='anny';s.owners.gaze=gaze;const a=run(s);
 if(gaze!=='gnm'){const t=structuredClone(s);t.gnm.rotation[6]=.25;assert.equal(sha(run(t)),sha(a),'Inactive GNM gaze');}
 if(gaze!=='rig'){const t=structuredClone(s);t.anny.pose['eye.L']=[15,10,5];assert.equal(sha(run(t)),sha(a),'Inactive native bone gaze');}
 if(gaze!=='expression'){const t=structuredClone(s);t.anny.facialActions.eyeLookDownLeft=.7;assert.equal(sha(run(t)),sha(a),'Inactive expression gaze');}
 rows.push({name:gaze+'-gaze-ownership',passed:true});
}
for(const source of ['anny','mhr']){
 const s=defaultState();s.owners.headShape=source;s.owners.expression=source;s.owners.gaze='expression';const base=run(s),labels=source==='anny'?model.anny.facialActionLabels:model.mhrMeta.expression_names;
 for(let index=0;index<labels.length;index++){
  const t=structuredClone(s);if(source==='anny')t.anny.facialActions[labels[index]]=1;else t.mhr.expression[index]=1;
  const v=run(t);assert(v.every(Number.isFinite));const d=diff(v,base);assert(d.maxMetres>1e-8,source+' active native expression does not affect its common semantic part: '+labels[index]);
  rows.push({name:source+'-'+labels[index],index,...d,passed:true,expectedPart:labels[index]==='tongueOut'?'isolated tongue':'native field and semantic component mapping'});
 }
}
const s=defaultState();s.owners.headShape='anny';s.owners.expression='anny';s.owners.gaze='rig';s.anny.pose['eye.L']=[15,10,5];run(s);
// Some source eye-rim vertices also carry head weights. Check pure eye-bone
// vertices against the actual native matrix; keep mixed-rim residual separate.
const a=model.anny,base=a.forward({phenotypes:s.anny.phenotypes}),posed=a.forward({phenotypes:s.anny.phenotypes,pose:s.anny.pose}),j=a.boneLabels.indexOf('eye.L'),B=base.bonePoses.slice(j*16,j*16+16),P=posed.bonePoses.slice(j*16,j*16+16),inv=inverse3([B[0],B[1],B[2],B[4],B[5],B[6],B[8],B[9],B[10]]),I=[inv[0],inv[1],inv[2],0,inv[3],inv[4],inv[5],0,inv[6],inv[7],inv[8],0,0,0,0,1];for(let r=0;r<3;r++)I[r*4+3]=-(I[r*4]*B[3]+I[r*4+1]*B[7]+I[r*4+2]*B[11]);const D=multiply(P,I);let pureMax=0,pureCount=0;
for(const i of model.headTransfer.d.anny_eye_0_ids){let w=0;for(let k=0;k<a.influences;k++){const slot=i*a.influences+k;if(a.arrays.vertex_bone_indices[slot]===j)w+=a.arrays.vertex_bone_weights[slot];}if(w===1){pureCount++;pureMax=Math.max(pureMax,Math.hypot(...point(D,xyz(base.vertices,i)).map((x,c)=>x-posed.vertices[i*3+c])));}}
assert(pureCount>0);assert(pureMax<1e-6,'Pure native eye-bone vertices fail source precision');rows.push({name:'native-eye-bone-transform',...model.headTransfer.last.gaze,pureVertices:pureCount,pureMaxMetres:pureMax,previousOverbroadGate:{failedMaxMM:.1048765377935334,requiredMM:.001,cause:'72 native eye vertices include head-weighted rim; that gate incorrectly assumed all weights equal one'},passed:true});

const saved=model.archive(),fingerprint=sha(model.positions);const invalid=structuredClone(saved);invalid.state.mhr.pose[0]=NaN;assert.throws(()=>model.restore(invalid));assert.equal(sha(model.positions),fingerprint);
fs.writeFileSync(new URL('../research/semantic-head-runtime-report.json',import.meta.url),JSON.stringify({passed:true,fingerprint:model.adapterFingerprint,rows,numericCoverageOnly:true,visualAcceptance:false,unresolved:['MHR independent globe-gaze semantics','eyelid/cavity cross intersections','extreme head shapes and age source comparisons']},null,2));
console.log({passed:true,checks:rows.length,nativeExpressions:124,visualAcceptance:false});
