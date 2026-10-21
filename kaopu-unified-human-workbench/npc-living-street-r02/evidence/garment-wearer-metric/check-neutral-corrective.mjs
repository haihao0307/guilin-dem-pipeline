import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding} from '../../src/NativeGarmentFit.mjs';
import {NativeGarmentCorrective} from '../../src/NativeGarmentCorrective.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url),read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,base))));
const source=read('vendor/appearance/cloth-r10/assets/native-person.json.gz'),target=loadNativeBodyFixture('D'),matrices=Array.from({length:target.rig.names.length},()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),rows=[];
const geometry={actor:'D',pose:'actual neutral wearer; one full material corrective',nativeAxis:'Z-up',body:{positions:Array.from(target.positions),faces:Array.from(target.faces)},garments:[]};
for(const id of ['T03','P01']){
 const packet=read('vendor/appearance/cloth-r10/native/'+id+'.json.gz'),binding=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:id==='P01'?'bottom':'top',family:'denim',neutralEvidence:{kind:'D neutral positive source-body field; initial not accepted'}}),reference=binding.sample(target.positions,matrices),corrective=new NativeGarmentCorrective(binding),result=corrective.initializeNeutral(reference.positions,reference.normals);
 rows.push({id,...result.report});let off=0;const faces=packet.spec.panels.flatMap(p=>{const f=p.triangles.flatMap(t=>t.map(i=>i+off));off+=p.uvMm.length;return f;});geometry.garments.push({id,positions:Array.from(result.display),faces});
 console.log(JSON.stringify({id,eligible:result.report.numericallyEligible,elapsedMS:result.report.elapsedMS,inside:result.report.contact.inside,positiveBelow4MM:result.report.contact.clearanceDeficits,maxWearerEdgeRatio:result.report.after.maxWearerEdgeRatio,maxMoveMM:result.report.after.maxReferenceMoveM*1000,metrics:result.report.metrics,queryDelta:result.report.queryDelta}));
 fs.writeFileSync(new URL('D_NEUTRAL_CORRECTIVE.json',folder),JSON.stringify({schema:'d-neutral-full-source-material-corrective/1',sourceHashes:Object.fromEntries(['src/NativeGarmentFit.mjs','src/NativeGarmentMetric.mjs','src/NativeGarmentContact.mjs','src/NativeGarmentCorrective.mjs'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(new URL(p,base))).digest('hex')])),rows,productionReady:false},null,2)+'\n');
 fs.writeFileSync(new URL('D-neutral-corrective-geometry.json',folder),JSON.stringify(geometry));
}
