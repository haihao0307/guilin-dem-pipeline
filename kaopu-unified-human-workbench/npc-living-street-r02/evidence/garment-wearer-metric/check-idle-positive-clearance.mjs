import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest,originalContactSamples} from '../../src/NativeGarmentFit.mjs';
import {createWearerRestSolver} from '../../src/NativeGarmentMetric.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url),load=p=>JSON.parse(fs.readFileSync(new URL(p,base)));
const packet=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('vendor/appearance/cloth-r10/native/P01.json.gz',base))));
const source=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('vendor/appearance/cloth-r10/assets/native-person.json.gz',base))));
const frozen=load('evidence/garment-wearer-metric/D_CONTINUOUS_NEUTRAL_STATE.json'),csr=load('evidence/CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json'),input=load('evidence/CAPTURE_RECOVERY_D_CLEARANCE_INITIAL_CONTACT_POSES.json');
const geometry=load('evidence/garment-wearer-metric/D-full-initial-history-first-failure-corrective-geometry.json'),referenceGeometry=load('evidence/garment-wearer-metric/D-full-initial-history-first-failure-reference-geometry.json');
const frame=Number(process.argv[2]??-1),state=input.states.find(s=>s.frame===frame);
if(!state||geometry.pose!==state.id)throw Error('EXPECTED_FIXED_OBSERVED_POSE_ONLY');
const raw=loadNativeBodyFixture('D'),W=raw.packet.weights,values=new Float64Array(W.values.length);
for(let i=0;i<csr.bodyVertexCount;i++)for(let n=0;n<csr.displayRange[i*4+1];n++)values[W.ptr[i]+n]=csr.displayPacked[(csr.displayRange[i*4]+n)*8+4];
const target={...raw,positions:Float64Array.from(frozen.bodyPositions),packet:{...raw.packet,weights:{...W,values}}};
const initial=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:'bottom',family:'denim'});
const saved=frozen.rows.find(r=>r.id==='P01'),binding=captureNeutralWearerRest(initial,Float64Array.from(saved.positions),{kind:'same frozen accepted neutral, no new solver'});
const reference=binding.sample(Float64Array.from(geometry.body.positions),state.skinMatrices),metric=binding.metric,solver=createWearerRestSolver(metric);
const display=geometry.garments.find(g=>g.id==='P01').positions,displayReference=referenceGeometry.garments.find(g=>g.id==='P01').positions,sewn=new Float64Array(metric.count*3),written=new Uint8Array(metric.count);
let maximumDuplicateDifferenceM=0,maximumReferenceDifferenceM=0;
for(let i=0;i<metric.displayToSolver.length;i++){
  const j=metric.displayToSolver[i];
  if(written[j])for(let c=0;c<3;c++)maximumDuplicateDifferenceM=Math.max(maximumDuplicateDifferenceM,Math.abs(sewn[j*3+c]-display[i*3+c]));
  sewn.set(display.slice(i*3,i*3+3),j*3);written[j]=1;
  for(let c=0;c<3;c++)maximumReferenceDifferenceM=Math.max(maximumReferenceDifferenceM,Math.abs(reference.positions[j*3+c]-displayReference[i*3+c]));
}
if(written.some(x=>!x)||maximumDuplicateDifferenceM!==0||maximumReferenceDifferenceM!==0)throw Error('EXACT_SAVED_MATERIAL_RECONSTRUCTION_FAILED');
const deficits=[];
for(const sample of originalContactSamples(metric)){
  const point=[0,0,0],origin=[0,0,0],normal=[0,0,0];let inverse=0;
  for(let a=0;a<sample.ids.length;a++){
    const i=sample.ids[a],w=sample.weights[a];inverse+=solver.w[i]*w*w;
    for(let c=0;c<3;c++){point[c]+=sewn[i*3+c]*w;origin[c]+=reference.positions[i*3+c]*w;normal[c]+=reference.normals[i*3+c]*w;}
  }
  const actual=binding.contact.inspect(...point);
  if(!actual.inside&&actual.distance<.004-1e-10){
    const length=Math.hypot(...normal);if(length)for(let c=0;c<3;c++)normal[c]/=length;
    const exit=binding.contact.project(point,{eligibleFaces:binding.eligibleFaces,preferredNormal:normal,referenceOrigin:origin,margin:.004,limit:.08});
    const points=sample.ids.map(i=>({group:i,position:Array.from(sewn.subarray(i*3,i*3+3)),inverseMass:solver.w[i],isOriginalWaistPin:solver.pins.includes(i),actual:binding.contact.inspect(...sewn.subarray(i*3,i*3+3))}));
    const sourceEdges=metric.sourceEdges.map((e,index)=>({...e,index})).filter(e=>sample.ids.length===2&&sample.ids.includes(e.a)&&sample.ids.includes(e.b));
    deficits.push({sample,point,origin,actual,deficitM:.004-actual.distance,inverseConstraintMass:inverse,points,sourceEdges,qualifiedFourMMExit:exit});
  }
}
binding.contact.refit(target.positions);
for(const d of deficits){const p=[0,0,0];for(let a=0;a<d.sample.ids.length;a++)for(let c=0;c<3;c++)p[c]+=saved.positions[d.sample.ids[a]*3+c]*d.sample.weights[a];d.acceptedNeutralPoint=p;d.acceptedNeutralClearance=binding.contact.inspect(...p);}
const fixedAnchorDeficits=deficits.filter(d=>d.inverseConstraintMass===0).length;
const out={schema:'actual-observed-positive-clearance-rca/1',frame,phase:state.phase,bodyAndMaterialUnchanged:true,additionalSolve:false,insideNotInferredFromPositiveDeficit:true,maximumDuplicateDifferenceM,maximumReferenceDifferenceM,
  fixedAnchorDeficits,
  maximumPlanningDeficitM:Math.max(0,...deficits.map(d=>d.deficitM)),
  allSampleVerticesAlreadyOutsideFourMM:deficits.every(d=>d.points.every(p=>!p.actual.inside&&p.actual.distance>=.004-1e-10)),
  conclusion:fixedAnchorDeficits?'Residual fixed original waistband edge midpoints have zero dynamic inverse constraint mass. Compare the same-source original waist target transport before changing the accepted neutral shape; increasing the dynamic contact target alone cannot move them.':'Residual free edge midpoints need a bounded planning-clearance review; no fixed anchor deficit was found.',
  sourceAuditMarginM:.004,currentLocalPlanningGuardM:.00001,additionalPlanningGuardProposed:false,auditMarginUnchanged:true,deficits};
fs.writeFileSync(new URL(frame===-1?'D_INITIAL_IDLE_POSITIVE_CLEARANCE_RCA.json':`D_WALK${frame}_POSITIVE_CLEARANCE_RCA.json`,folder),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
