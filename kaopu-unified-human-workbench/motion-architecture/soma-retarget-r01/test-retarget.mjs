import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {createHash} from 'node:crypto';
import {AnnyModel} from '../../full/source/kaopu-anny-workbench/r02/src/AnnyModel.js';
import {createSomaForearmCalibration,C,mul,transpose,mv} from './soma_forearm_calibration.mjs';
const sourcePath=process.argv[2]||new URL('./SOURCE-DIAGNOSTIC.json.gz.b64',import.meta.url);
const encoded=fs.readFileSync(sourcePath),sourceBytes=String(sourcePath).endsWith('.b64')?zlib.gunzipSync(Buffer.from(encoded.toString(),'base64'),{maxOutputLength:2000000}):encoded,source=JSON.parse(sourceBytes);assert.equal(source.source,'official-SOMA-X-analytical');assert.equal(source.neuralInferenceExecuted,false);
const sha=x=>createHash('sha256').update(x).digest('hex'),full=path.resolve(import.meta.dirname,'../../full'),bytes=zlib.gunzipSync(Buffer.concat(Array.from({length:6},(_,i)=>fs.readFileSync(path.join(full,'assets/anny-all/anny-model-'+String(i).padStart(2,'0')+'.bin.part')))));
const model=new AnnyModel(JSON.parse(fs.readFileSync(path.join(full,'assets/anny-all/anny-model.json'))),bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));const states=JSON.parse(fs.readFileSync(path.join(full,'research/characters-r02/ACCEPTED-STATES.json'))).states;
const matrices=a=>Array.from({length:104},(_,j)=>Array.from(a.slice(j*16,j*16+16))),r=m=>[m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]],p=m=>[m[3],m[7],m[11]],sub=(a,b)=>a.map((x,i)=>x-b[i]),norm=a=>Math.hypot(...a),unit=a=>a.map(x=>x/norm(a)),error=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i]))),I=[1,0,0,0,1,0,0,0,1];
const axisR=(axis,a)=>{const [x,y,z]=axis,c=Math.cos(a),s=Math.sin(a),t=1-c;return[t*x*x+c,t*x*y-s*z,t*x*z+s*y,t*x*y+s*z,t*y*y+c,t*y*z-s*x,t*x*z-s*y,t*y*z+s*x,t*z*z+c]};
const sourceZero=source.frames[0].transforms.map(m=>m.flat()),si=source.names.indexOf('LeftForeArm'),sw=source.names.indexOf('LeftHand');let sourceAxisMax=0,sourceSigns=0;
for(const frame of source.frames.filter(x=>x.label.startsWith('forearm_'))){const [_,axis,sign]=frame.label.split('_');const d=mul(r(frame.transforms[si].flat()),transpose(r(sourceZero[si]))),expected=axisR([0,1,2].map(x=>+(x===+axis)),+sign*Math.PI/18);sourceAxisMax=Math.max(sourceAxisMax,error(d,expected));assert(error(d,expected)<2e-5);sourceSigns++;}
let cases=0,maxRootRotation=0,maxDeltaRotation=0,maxWristDirection=0,maxRootTranslation=0,maxUnmappedLocal=0,maxBoneLength=0,negative=0;const rows=[];
for(const s of states){const options={phenotypes:s.phenotypes,localChanges:s.localChanges};const neutral=model.forward(options),rest=matrices(neutral.bonePoses),names=model.boneLabels,parents=model.boneParents,fingerprint=sha(JSON.stringify({names:Array.from(names),parents:Array.from(parents),restMatrices:rest}));const cfg={sourceNames:source.names,sourceParents:source.parents,sourceZeroTransforms:sourceZero,targetNames:names,targetParents:parents,targetRestMatrices:rest,restFingerprint:fingerprint};const calibration=createSomaForearmCalibration(cfg),arm=names.indexOf('lowerarm01.L'),wrist=names.indexOf('wrist.L');let rowMax=0;
 for(const f of source.frames){const mapped=calibration.convert(f,{expectedRestFingerprint:fingerprint}),out=model.forward({...options,pose:mapped.pose}),posed=matrices(out.bonePoses),deltas=posed.map((m,j)=>mul(r(m),transpose(r(rest[j]))));
  const armActual=mul(transpose(deltas[parents[arm]]),deltas[arm]),rotErr=error(armActual,mapped.targetLocalArmRotation);assert(rotErr<2e-5);maxDeltaRotation=Math.max(maxDeltaRotation,rotErr);rowMax=Math.max(rowMax,rotErr);
  const rootRotErr=error(deltas[0],mapped.rootRotation);assert(rootRotErr<2e-5);maxRootRotation=Math.max(maxRootRotation,rootRotErr);
  if(f.label.startsWith('root_rotation_')){const axis=+f.label.split('_').at(-1),expected=mul(mul(C,axisR([0,1,2].map(x=>+(x===axis)),Math.PI/18)),transpose(C));assert(error(deltas[0],expected)<2e-5);}
  const rootErr=error(p(posed[0]),mapped.rootTranslation);assert(rootErr<2e-6);maxRootTranslation=Math.max(maxRootTranslation,rootErr);
  for(let j=1;j<104;j++){const lengthErr=Math.abs(norm(sub(p(posed[j]),p(posed[parents[j]])))-norm(sub(p(rest[j]),p(rest[parents[j]]))));maxBoneLength=Math.max(maxBoneLength,lengthErr);assert(lengthErr<1e-6);if(j!==arm){const local=mul(transpose(deltas[parents[j]]),deltas[j]);maxUnmappedLocal=Math.max(maxUnmappedLocal,error(local,I));assert(error(local,I)<2e-5);}}
  const srcWorldRoot=mul(r(f.transforms[1].flat()),transpose(r(sourceZero[1]))),srcVector=mv(C,mv(transpose(srcWorldRoot),sub(p(f.transforms[sw].flat()),p(f.transforms[si].flat())))),targetVector=mv(transpose(deltas[0]),sub(p(posed[wrist]),p(posed[arm]))),mappedSource=mv(calibration.metadata.Q,unit(srcVector)),dirErr=error(unit(targetVector),mappedSource);assert(dirErr<2e-5);maxWristDirection=Math.max(maxWristDirection,dirErr);
  assert.equal(Object.keys(mapped.pose).length,2);assert.equal(out.bonePoses.length,104*16);cases++;
 }
 assert.throws(()=>calibration.convert(source.frames[0],{expectedRestFingerprint:'f'.repeat(64)}),/recalibrate/);negative++;
 const bad=structuredClone(source.frames[0]);bad.transforms[0][0][3]=1;assert.throws(()=>calibration.convert(bad,{expectedRestFingerprint:fingerprint}),/virtual Root/);negative++;
 for(const mutate of [
  x=>{x.transforms.pop()},
  x=>{x.transforms[2][0][0]=NaN},
  x=>{x.transforms[2][0][0]*=-1;x.transforms[2][1][0]*=-1;x.transforms[2][2][0]*=-1},
  x=>{x.transforms[sw][0][3]+=.1},
  x=>{const head=source.names.indexOf('Head'),m=x.transforms[head],d=mul(axisR([0,0,1],.1),r(m.flat()));for(let a=0;a<3;a++)for(let b=0;b<3;b++)m[a][b]=d[a*3+b]},
 ]){const altered=structuredClone(source.frames[0]);mutate(altered);assert.throws(()=>calibration.convert(altered,{expectedRestFingerprint:fingerprint}));negative++;}
 assert.throws(()=>createSomaForearmCalibration({...cfg,sourceParents:Array(110).fill(0)}),/source parent/);negative++;
 const badRest=structuredClone(rest);badRest[wrist]=badRest[arm].slice();assert.throws(()=>createSomaForearmCalibration({...cfg,targetRestMatrices:badRest}),/degenerate/);negative++;
 const badSourceRest=structuredClone(sourceZero);badSourceRest[0][3]=100;assert.throws(()=>createSomaForearmCalibration({...cfg,sourceZeroTransforms:badSourceRest}),/rest virtual Root/);negative++;
 const badTargetRest=structuredClone(rest);badTargetRest[0][3]=100;assert.throws(()=>createSomaForearmCalibration({...cfg,targetRestMatrices:badTargetRest}),/target rest root/);negative++;
 const before=calibration.convert(source.frames[6],{expectedRestFingerprint:fingerprint});calibration.metadata.Q.fill(0);const after=calibration.convert(source.frames[6],{expectedRestFingerprint:fingerprint});assert.deepEqual(before,after);
 rows.push({id:s.id,restFingerprint:fingerprint,rotationMaxError:rowMax,forearmLength:calibration.metadata.targetForearmLength});
}
const report={schema:'soma-to-anny-minimal-calibration-qa/1',targetAssetSha256:sha(bytes),targetPresetsSha256:sha(fs.readFileSync(path.join(full,'research/characters-r02/ACCEPTED-STATES.json'))),mapperSha256:sha(fs.readFileSync(path.join(import.meta.dirname,'soma_forearm_calibration.mjs'))),sourceCommit:source.sourceCommit,sourceSha256:sha(sourceBytes),sourceFrames:source.frames.length,sourceAxisAndSignCases:sourceSigns,sourceAxisMax,characters:states.length,cases,bonesRetained:104,unmappedTargetLocalInputs:102,negativeChecks:negative,maxRootRotation,maxDeltaRotation,maxWristDirection,maxRootTranslation,maxUnmappedLocal,maxBoneLength,neuralInferenceExecuted:false,boxingActionsProduced:0,scope:'Hips/root and LeftForeArm/lowerarm01.L only. Anatomical rest calibration uses elbow/wrist and index/pinky MCP; source public twist detail is not redistributed to target twist bones. No full-body retarget or combat clip.',rows};
fs.writeFileSync(path.join(import.meta.dirname,'RETARGET-QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined},null,2));
