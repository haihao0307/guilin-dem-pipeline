import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest,auditGarmentBody} from '../../src/NativeGarmentFit.mjs';
import {NativeGarmentCorrective} from '../../src/NativeGarmentCorrective.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url),read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,base)))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputPath=process.argv[2]??'evidence/CAPTURE_RECOVERY_CHAIN_D_FIRST_CONTACT_POSES.json',inputBytes=fs.readFileSync(new URL(inputPath,base)),input=JSON.parse(inputBytes),state=input.states.find(s=>s.id==='D-actual-contact-frame99');
if(!state)throw Error('ACTUAL_CAPTURE_CONTACT_STATE_MISSING');
fs.writeFileSync(new URL('D_ACTUAL_CONTACT99_INPUT.json',folder),inputBytes);
const source=read('vendor/appearance/cloth-r10/assets/native-person.json.gz'),target=loadNativeBodyFixture('D'),matrices=Array.from({length:104},()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),rows=[];
if(input.bodyVertexCount!==target.bodyCount||state.positions.length!==target.positions.length||input.faces.length!==target.faces.length||input.faces.some((v,i)=>v!==target.faces[i])||state.skinMatrices.length!==104)throw Error('EXTERNAL_POSE_NATIVE_BODY_CONTRACT_MISMATCH');
const common={actor:'D',pose:state.id,nativeAxis:'Z-up',inputSHA256:hash(inputBytes),body:{positions:state.positions,faces:input.faces},headIncluded:false,rootWorld:state.rootWorld,actualMotionMatrices:true,motionRegenerated:false};
const beforeGeometry={...common,stage:'continuous original-body complete-CSR reference before material corrective',garments:[]},afterGeometry={...common,stage:'same reference plus full source wearer-rest material corrective',garments:[]};
for(const id of ['T03','P01']){
 const packet=read('vendor/appearance/cloth-r10/native/'+id+'.json.gz'),initialBinding=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:id==='P01'?'bottom':'top',family:'denim',neutralEvidence:{kind:'actual D neutral source-body continuous field'}}),neutralReference=initialBinding.sample(target.positions,matrices),neutral=new NativeGarmentCorrective(initialBinding).initializeNeutral(neutralReference.positions,neutralReference.normals);
 if(!neutral.report.numericallyEligible||neutral.report.contact.clearanceDeficits!==0)throw Error('NEUTRAL_WEARER_NOT_READY_'+id);
 const binding=captureNeutralWearerRest(initialBinding,neutral.positions,{kind:'actual neutral D full source material constraints before source99 motion',report:neutral.report}),reference=binding.sample(Float64Array.from(state.positions),state.skinMatrices),referenceContact=auditGarmentBody(binding,reference.positions),corrective=new NativeGarmentCorrective(binding),result=corrective.solve(reference.positions,reference.normals,{warmStart:false});
 const expandedReference=new Float64Array(binding.metric.displayToSolver.length*3);for(let i=0;i<binding.metric.displayToSolver.length;i++)expandedReference.set(reference.positions.subarray(binding.metric.displayToSolver[i]*3,binding.metric.displayToSolver[i]*3+3),i*3);
 let off=0;const faces=packet.spec.panels.flatMap(p=>{const f=p.triangles.flatMap(t=>t.map(i=>i+off));off+=p.uvMm.length;return f;});
 beforeGeometry.garments.push({id,positions:Array.from(expandedReference),faces});afterGeometry.garments.push({id,positions:Array.from(result.display),faces});
 rows.push({id,neutral:neutral.report,neutralRestCapture:{sourcePaperRetained:true,seamReaverageM:binding.report.maximumSeamReaverageM},referenceField:binding.reference.field.report,referenceContact,...result.report});
 console.log(JSON.stringify({id,eligible:result.report.numericallyEligible,elapsedMS:result.report.elapsedMS,referenceInside:referenceContact.inside,inside:result.report.contact.inside,positiveBelow4MM:result.report.contact.clearanceDeficits,beforeMaxEdge:result.report.before.maxWearerEdgeRatio,afterMaxEdge:result.report.after.maxWearerEdgeRatio,maxMoveMM:result.report.after.maxReferenceMoveM*1000,unresolved:result.report.metrics.unresolvedQueries}));
 const report={schema:'actual-captured-source99-full-material-garment/1',inputPath,inputSHA256:hash(inputBytes),inputState:state.id,inputSourceHashes:input.sourceHashes,garmentSourceHashes:Object.fromEntries(['NativeGarmentFit','NativeGarmentMetric','NativeGarmentContact','NativeGarmentCorrective','NativeGarmentReference'].map(n=>['src/'+n+'.mjs',hash(fs.readFileSync(new URL('src/'+n+'.mjs',base)))])),wholeMotionAcceptance:false,headIncluded:false,productionReady:false,rows};
 fs.writeFileSync(new URL('D_ACTUAL_CONTACT99_GARMENT.json',folder),JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(new URL('D-contact99-reference-geometry.json',folder),JSON.stringify(beforeGeometry));fs.writeFileSync(new URL('D-contact99-corrective-geometry.json',folder),JSON.stringify(afterGeometry));
}
