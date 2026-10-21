import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {actorFor} from '../shoe-recovery/native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
import {createNativeShoeField as oldBaseField} from './NativeShoeFit-baseline-importable.mjs';
const root=globalThis.__SHOE_QA_ROOT__,file='evidence/CAPTURE_RECOVERY_CHAIN_SIX_FINAL_POSES.json',bytes=fs.readFileSync(path.join(root,file)),cache=JSON.parse(bytes),rows=[];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
if(hash(bytes)!=='d86cb78585ccc95c8373eb234cda477ef31d9bc8a71ad674d6b03542332d5eaa')throw Error('Actual phase cache changed');
for(const id of cache.actorIds){const actor=actorFor(id);
 for(const side of ['L','R']){
  const fit=fitNativeShoeSide(actor,side),previous=cache.shoes[id].perSide[side],actual=fit.record,base=oldBaseField(fit.foot,fit.sourceModel.last,{scaleM:fit.scaleM,centerF:fit.field.centerF,centerR:fit.field.centerR});
  let changedSoleComponents=0,maximumSoleDeltaM=0,changedVerticalComponents=0,maximumVerticalDeltaM=0,vertices=0;
  if(actual.solePointsNative.length!==previous.solePointsNative.length)throw Error('Complete sole count changed');
  for(let i=0;i<actual.solePointsNative.length;i++)for(let k=0;k<3;k++){
   const a=actual.solePointsNative[i][k],b=previous.solePointsNative[i][k];changedSoleComponents+=a!==b;maximumSoleDeltaM=Math.max(maximumSoleDeltaM,Math.abs(a-b));
  }
  for(let j=0;j<fit.model.parts.length;j++){
   const p=fit.model.parts[j].geometry.attributes.position,original=fit.sourceModel.parts[j].geometry.attributes.position;
   for(let i=0;i<p.count;i++){
    const before=Math.fround(base.evaluate([original.getX(i),original.getY(i),original.getZ(i)]).p[1]),after=p.getY(i);
    changedVerticalComponents+=before!==after;maximumVerticalDeltaM=Math.max(maximumVerticalDeltaM,Math.abs(after-before)*fit.scaleM);vertices++;
   }
  }
  const row={actor:id,side,originalParts:fit.model.parts.length,vertices,soleVertices:actual.solePointsNative.length,changedSoleComponents,maximumSoleDeltaM,changedVerticalComponents,maximumVerticalDeltaM,
   oldSoleLiftM:previous.soleLiftM,currentSoleLiftM:actual.soleLiftM,soleLiftExactlyEqual:actual.soleLiftM===previous.soleLiftM,restNativeExactlyEqual:JSON.stringify(actual.restNative)===JSON.stringify(previous.restNative)};
  rows.push(row);console.log(JSON.stringify(row));
 }
}
const result={schema:'directional-shoe-preserves-actual-complete-sole-and-height/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,
 actualCache:{path:file,sha256:hash(bytes),source:cache.source},baseline:{path:'evidence/shoe-directional/NativeShoeFit-baseline.mjs',sha256:hash(fs.readFileSync(path.join(root,'evidence/shoe-directional/NativeShoeFit-baseline.mjs')))},
 method:'All 9877 native sole positions per foot compared component by component to the actual completed seven-bottle chain. Every current original shoe vertex Y compared to the former exact base field through the actual Float32 buffer. The former aperture map leaves Y unchanged by formula. Baseline importable adapter changes only one relative import path.',
 rows,passed:rows.every(r=>r.changedSoleComponents===0&&r.changedVerticalComponents===0&&r.soleLiftExactlyEqual&&r.restNativeExactlyEqual),motionClearanceAccepted:false,visualAcceptance:false};
fs.writeFileSync(path.join(root,'evidence/shoe-directional/SOLE_AND_HEIGHT_UNCHANGED.json'),JSON.stringify(result,null,2)+'\n');
if(!result.passed)throw Error('Directional field changed sole or Y');
