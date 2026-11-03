import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,originalContactSamples} from '../../src/NativeGarmentFit.mjs';
import {createWearerRestSolver} from '../../src/NativeGarmentMetric.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url);
const read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,base))));
const source=read('vendor/appearance/cloth-r10/assets/native-person.json.gz'),target=loadNativeBodyFixture('D');
const input=new URL('D-neutral-corrective-geometry.json',folder),geometry=JSON.parse(fs.readFileSync(input)),rows=[];
function faceWeights(packet,names,faces,f){
 const weights=new Map();
 for(let j=0;j<3;j++)for(let k=packet.ptr[faces[f+j]];k<packet.ptr[faces[f+j]+1];k++)weights.set(names[packet.joints[k]],(weights.get(names[packet.joints[k]])??0)+packet.values[k]/3);
 return [...weights].sort((a,b)=>b[1]-a[1]);
}
for(const garment of geometry.garments){
 const id=garment.id,packet=read('vendor/appearance/cloth-r10/native/'+id+'.json.gz'),binding=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:id==='P01'?'bottom':'top',family:'denim'}),metric=binding.metric,solver=createWearerRestSolver(metric),p=metric.fittedNative.slice(),map=metric.displayToSolver;
 for(let i=0;i<map.length;i++)p.set(garment.positions.slice(i*3,i*3+3),map[i]*3);
 const pinSet=new Set(solver.pins),membership=Array.from({length:metric.count},()=>[]);let off=0;
 for(const panel of packet.spec.panels){for(let i=0;i<panel.uvMm.length;i++)membership[map[off+i]].push({panel:panel.id,local:i,display:off+i});off+=panel.uvMm.length;}
 const inside=[],positive=[],classes={};
 for(const sample of originalContactSamples(metric)){
  const point=[0,0,0];for(let j=0;j<sample.ids.length;j++)for(let k=0;k<3;k++)point[k]+=p[sample.ids[j]*3+k]*sample.weights[j];
  const q=binding.contact.inspect(...point);if(!q.inside&&q.distance>=.004-1e-10)continue;
  const eligible=!!binding.eligibleFaces[q.face/3],weights=faceWeights(target.packet.weights,target.rig.names,target.faces,q.face),sourceWeights=faceWeights(source.rig.weights,source.rig.names,binding.source.faces,q.face);
  const row={...sample,point,...q,eligible,weights,sourceWeights,pins:sample.ids.map(i=>pinSet.has(i)),refs:sample.ids.map(i=>binding.reference.refs[i]),material:sample.ids.map(i=>membership[i])};
  if(q.inside){const key=weights[0][0]+' / '+(eligible?'eligible':'foreign');classes[key]=(classes[key]??0)+1;inside.push(row);}else positive.push(row);
 }
 rows.push({id,inside:inside.length,classes,waistPins:solver.pins.length,insideAllPinned:inside.filter(s=>s.pins.every(Boolean)).length,insideAnyPinned:inside.filter(s=>s.pins.some(Boolean)).length,insideEligible:inside.filter(s=>s.eligible).length,worst:inside.sort((a,b)=>b.distance-a.distance).slice(0,id==='P01'?20:12),positiveBelow4MM:positive.length,positiveAllPinned:positive.filter(s=>s.pins.every(Boolean)).length,positiveAnyPinned:positive.filter(s=>s.pins.some(Boolean)).length,worstPositive:positive.sort((a,b)=>a.distance-b.distance).slice(0,12)});
}
const report={schema:'neutral-remaining-contact-contract/1',inputGeometrySHA256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),productionChanged:false,newCandidate:false,rows};
fs.writeFileSync(new URL('D_NEUTRAL_REMAINING_CONTACT_CONTRACT.json',folder),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(({worst,worstPositive,...row})=>row)));
