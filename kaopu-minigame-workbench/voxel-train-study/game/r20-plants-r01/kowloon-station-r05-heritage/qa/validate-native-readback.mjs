import fs from 'node:fs';import{createHash}from'node:crypto';import path from 'node:path';import assert from 'node:assert/strict';
import {clockTowerMembers} from '../native-clock-tower.mjs';
const dir=process.argv[2];if(!dir)throw Error('Usage: node validate-native-readback.mjs artifact-directory');
const r=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'))),raw=JSON.parse(fs.readFileSync(path.join(dir,'readback.json')));
assert(['rendered-for-architectural-review','native-smoke-rendered-not-visual-acceptance'].includes(r.status));assert.equal(r.errors.length,0);
assert.equal(raw.encoding,'RGBA32F bits, rows bottom to top');
const n=raw.width*raw.height,decoded={};
for(const [k,a]of Object.entries(raw.buffers)){assert.equal(a.length,n*4,k);const bits=Uint32Array.from(a),values=new Float32Array(bits.buffer);assert(values.every(Number.isFinite),k+': nonfinite');decoded[k]=values;}
let hit=0,miss=0,unresolved=0,maxNormalLengthError=0,maxSteps=0;
const ids={},seeds={},interiorMembers={},parts=clockTowerMembers().parts;
for(let i=0;i<n;i++){
 const k=i*4,t=decoded.trace,normal=decoded.normalBaseDistance,valid=decoded.normalValidity,material=decoded.albedoRoughness;
 const status=t[k+3];maxSteps=Math.max(maxSteps,t[k+2]);
 if(status===1){
  hit++;const id=t[k+1],seed=decoded.qSeed[k+3];ids[id]=(ids[id]||0)+1;seeds[seed]=(seeds[seed]||0)+1;
  const err=Math.abs(Math.hypot(normal[k],normal[k+1],normal[k+2])-1);maxNormalLengthError=Math.max(maxNormalLengthError,err);assert(err<2e-5,'Nonunit normal '+i);
  assert.equal(valid[k],0,'Normal validity '+i);assert(material[k]+material[k+1]+material[k+2]>0,'Empty material '+i);assert(material[k+3]>0&&material[k+3]<=1,'Roughness '+i);
  if(seed===174){const member=decoded.extentSourceSeed[k+3],name=parts[member]?.id;assert(name?.startsWith('heritage-inner-lining-'),'Invalid inner-lining source');interiorMembers[name]=(interiorMembers[name]||0)+1;}
 }else if(status===2)miss++;else unresolved++; // Native trace contract: 0 active, 1 hit, 2 miss, 3 failure.
}
assert.equal(unresolved,0);assert(hit>0);assert.equal(hit,r.state.kowloonFunction.hit);
const result={commit:r.commit,view:r.view,status:'numeric-native-readback-passed-not-visual-acceptance',canvas:raw.fullResolution,crop:raw.cropTopLeft,hit,miss,unresolved,maxSteps,maxNormalLengthError,ids,seeds,interiorMembers,allEightBuffersFinite:Object.keys(decoded).length===8};
const atomic=(name,obj)=>{const f=path.join(dir,name);fs.writeFileSync(f+'.tmp',JSON.stringify(obj,null,2)+'\n');fs.renameSync(f+'.tmp',f);};
atomic('validation.json',result);
const files=['receipt.json','readback.json','native-crop.png','perspective.png','validation.json',...(r.tile?['tile-core.png']:[])];
const hashes=Object.fromEntries(files.map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex')]));
atomic('checkpoint.json',{complete:true,scope:'completed native render only; not an in-progress GPU context checkpoint',modelCommit:r.modelCommit||r.commit,commit:r.commit,sourceSHA256:r.state.kowloonFunction.sourceSHA256,executionSourceSHA256:r.state.kowloonFunction.executionSourceSHA256,tile:r.tile||null,hashes});
console.log(JSON.stringify(result,null,2));
