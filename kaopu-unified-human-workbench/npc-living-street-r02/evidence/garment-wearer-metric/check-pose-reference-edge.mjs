import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest} from '../../src/NativeGarmentFit.mjs';
import {NativeGarmentCorrective} from '../../src/NativeGarmentCorrective.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url),read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,base))));
const inputBytes=fs.readFileSync(new URL('D_ACTUAL_CONTACT99_INPUT.json',folder)),input=JSON.parse(inputBytes),state=input.states[0],source=read('vendor/appearance/cloth-r10/assets/native-person.json.gz'),target=loadNativeBodyFixture('D'),M=Array.from({length:104},()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),rows=[];
const tested=JSON.parse(fs.readFileSync(new URL('D_ACTUAL_CONTACT99_GARMENT.json',folder)));
for(const id of ['T03','P01']){
 const packet=read('vendor/appearance/cloth-r10/native/'+id+'.json.gz'),initial=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:id==='P01'?'bottom':'top',family:'denim'}),n=initial.sample(target.positions,M),fit=new NativeGarmentCorrective(initial).initializeNeutral(n.positions,n.normals),binding=captureNeutralWearerRest(initial,fit.positions,{kind:'same neutral fixture'}),posed=binding.sample(Float64Array.from(state.positions),state.skinMatrices),record=tested.rows.find(r=>r.id===id),metric=binding.metric;
 const edgeIndices=[record.before.maxWearerEdgeIndex,record.after.maxWearerEdgeIndex],edges=[];
 for(const index of new Set(edgeIndices)){
  const e=metric.sourceEdges[index],points=[e.a,e.b].map(i=>{
   const r=binding.reference.refs[i],restPoint=Array.from(metric.fittedNative.subarray(i*3,i*3+3)),posedPoint=Array.from(posed.positions.subarray(i*3,i*3+3));
   const restBody=[0,0,0],posedBody=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++){restBody[k]+=target.positions[r.ids[j]*3+k]*r.bary[j];posedBody[k]+=state.positions[r.ids[j]*3+k]*r.bary[j];}
   const weights=[];for(let k=0;k<r.weights.length;k+=2)weights.push([target.rig.names[r.weights[k]],r.weights[k+1]]);weights.sort((a,b)=>b[1]-a[1]);
   const material=[];let off=0;for(const panel of packet.spec.panels){for(let v=0;v<panel.uvMm.length;v++)if(metric.displayToSolver[off+v]===i)material.push({panel:panel.id,local:v,display:off+v});off+=panel.uvMm.length;}
   return {group:i,material,reference:r,weights,restPoint,posedPoint,restBody,posedBody,offsetLengthM:Math.hypot(...r.offset)};
  });
  const length=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
  edges.push({index,provenance:e,wearerRestM:metric.wearerEdges[index],posedLengthM:length(points[0].posedPoint,points[1].posedPoint),referenceBodyRestSeparationM:length(points[0].restBody,points[1].restBody),referenceBodyPosedSeparationM:length(points[0].posedBody,points[1].posedBody),points});
 }
 rows.push({id,edges});
}
const report={schema:'captured-pose-fixed-reference-edge-contract/1',inputSHA256:crypto.createHash('sha256').update(inputBytes).digest('hex'),newContactCandidate:false,productionChanged:false,rows};
fs.writeFileSync(new URL('D_CONTACT99_REFERENCE_EDGE_RCA.json',folder),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({id:r.id,edges:r.edges.map(e=>({index:e.index,wearerRestMM:e.wearerRestM*1000,lengthMM:e.posedLengthM*1000,restBodySeparationMM:e.referenceBodyRestSeparationM*1000,posedBodySeparationMM:e.referenceBodyPosedSeparationM*1000,points:e.points.map(p=>({group:p.group,material:p.material,face:p.reference.face,weights:p.weights.slice(0,5),rest:p.restPoint,posed:p.posedPoint}))}))})),null,2));
