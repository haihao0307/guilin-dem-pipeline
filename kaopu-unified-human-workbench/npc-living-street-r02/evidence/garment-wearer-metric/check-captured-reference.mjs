import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest,auditGarmentBody} from '../../src/NativeGarmentFit.mjs';
import {auditGarmentMetric,expandGarmentDisplay} from '../../src/NativeGarmentMetric.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url),read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,base)))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputBytes=fs.readFileSync(new URL('D_ACTUAL_CONTACT99_INPUT.json',folder)),input=JSON.parse(inputBytes),state=input.states[0],neutralBytes=fs.readFileSync(new URL('D-neutral-corrective-geometry.json',folder)),neutral=JSON.parse(neutralBytes),source=read('vendor/appearance/cloth-r10/assets/native-person.json.gz'),target=loadNativeBodyFixture('D'),rows=[];
if(state.positions.length!==target.positions.length||input.faces.some((v,i)=>v!==target.faces[i]))throw Error('EXTERNAL_BODY_CONTRACT');
const geometry={actor:'D',pose:state.id,nativeAxis:'Z-up',body:{positions:state.positions,faces:input.faces},garments:[],headIncluded:false,stage:'paired original material-leg fixed reference; no contact solve',inputSHA256:hash(inputBytes)};
for(const id of ['T03','P01']){
 const packet=read('vendor/appearance/cloth-r10/native/'+id+'.json.gz'),initial=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:id==='P01'?'bottom':'top',family:'denim'}),g=neutral.garments.find(g=>g.id===id),sewn=initial.metric.fittedNative.slice();
 for(let i=0;i<initial.metric.displayToSolver.length;i++)sewn.set(g.positions.slice(i*3,i*3+3),initial.metric.displayToSolver[i]*3);
 const binding=captureNeutralWearerRest(initial,sewn,{kind:'same already-audited neutral fixture',neutralSHA256:hash(neutralBytes)}),reference=binding.sample(Float64Array.from(state.positions),state.skinMatrices),audit=auditGarmentMetric(binding.metric,reference.positions),contact=auditGarmentBody(binding,reference.positions),edge=binding.metric.sourceEdges[audit.maxWearerEdgeIndex];
 const points=[edge.a,edge.b].map(i=>{const r=binding.reference.refs[i],weights=[];for(let k=0;k<r.weights.length;k+=2)weights.push([target.rig.names[r.weights[k]],r.weights[k+1]]);return {group:i,region:r.region,face:r.face,weights,rest:Array.from(binding.metric.fittedNative.subarray(i*3,i*3+3)),posed:Array.from(reference.positions.subarray(i*3,i*3+3))};});
 let off=0;const faces=packet.spec.panels.flatMap(p=>{const f=p.triangles.flatMap(t=>t.map(i=>i+off));off+=p.uvMm.length;return f;});geometry.garments.push({id,positions:Array.from(expandGarmentDisplay(binding.metric,reference.positions)),faces});
 rows.push({id,audit,contact,maxEdgeWearerRestM:binding.metric.wearerEdges[audit.maxWearerEdgeIndex],maxEdgePoints:points});
 console.log(JSON.stringify({id,inside:contact.inside,maxEdge:audit.maxWearerEdgeRatio,wearerRestMM:binding.metric.wearerEdges[audit.maxWearerEdgeIndex]*1000,points}));
}
const report={schema:'paired-material-domain-reference-before-contact/1',inputSHA256:hash(inputBytes),neutralSHA256:hash(neutralBytes),fitSHA256:hash(fs.readFileSync(new URL('src/NativeGarmentFit.mjs',base))),materialOrContactIterations:0,sourceBodyGeometryChanged:false,sourceDisplayTopologyChanged:false,productionReady:false,rows};
fs.writeFileSync(new URL('D_CONTACT99_PAIRED_REFERENCE.json',folder),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(new URL('D-contact99-paired-reference-geometry.json',folder),JSON.stringify(geometry));
