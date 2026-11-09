import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,auditGarmentBody} from '../../src/NativeGarmentFit.mjs';
import {auditGarmentMetric} from '../../src/NativeGarmentMetric.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url);
const read=path=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(path,base))));
const sha=path=>crypto.createHash('sha256').update(fs.readFileSync(new URL(path,base))).digest('hex');
const source=read('vendor/appearance/cloth-r10/assets/native-person.json.gz'),target=loadNativeBodyFixture('D'),matrices=Array.from({length:target.rig.names.length},()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),rows=[];
const geometry={actor:'D',pose:'actual original neutral body; positive source-body shape transfer only',nativeAxis:'Z-up',body:{positions:Array.from(target.positions),faces:Array.from(target.faces)},garments:[]};
for(const id of ['T03','P01']){
  const start=performance.now(),packet=read('vendor/appearance/cloth-r10/native/'+id+'.json.gz'),binding=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:id==='P01'?'bottom':'top',family:'denim',neutralEvidence:{source:'original D canonical full body fixture',accepted:false}});
  const reference=binding.sample(target.positions,matrices);let identityErrorM=0;for(let i=0;i<reference.positions.length;i++)identityErrorM=Math.max(identityErrorM,Math.abs(reference.positions[i]-binding.metric.fittedNative[i]));
  const contact=auditGarmentBody(binding,binding.metric.fittedNative),metric=auditGarmentMetric(binding.metric,binding.metric.fittedNative),elapsedMS=performance.now()-start;
  rows.push({id,elapsedMS,identityErrorM,binding:binding.report,contact,metric});
  let off=0;const faces=packet.spec.panels.flatMap(p=>{const f=p.triangles.flatMap(t=>t.map(i=>i+off));off+=p.uvMm.length;return f;});
  geometry.garments.push({id,positions:Array.from(binding.neutralDisplay),faces});
  console.log(JSON.stringify({id,elapsedMS,identityErrorM,contact:{samples:contact.samples,inside:contact.inside,byKind:contact.byKind,minimumOutsideM:contact.minimumOutsideM},metric:{maxWearerEdgeRatio:metric.maxWearerEdgeRatio,maxPaperEdgeRatio:metric.maxPaperEdgeRatio}}));
}
fs.writeFileSync(new URL('D_NEUTRAL_TRANSFER.json',folder),JSON.stringify({schema:'d-neutral-continuous-source-shape-transfer/1',sourceHashes:Object.fromEntries(['src/NativeGarmentFit.mjs','src/NativeGarmentMetric.mjs','src/NativeGarmentContact.mjs'].map(p=>[p,sha(p)])),actor:target.source,rows,scope:'initial actual neutral geometry only; not a completed wearer-fit corrective or visual acceptance',productionReady:false},null,2)+'\n');
fs.writeFileSync(new URL('D-neutral-transfer-geometry.json',folder),JSON.stringify(geometry));
