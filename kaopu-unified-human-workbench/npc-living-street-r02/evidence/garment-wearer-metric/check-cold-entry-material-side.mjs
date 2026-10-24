/** Read-only comparison on the already rejected neutral->entry jump.
 * This never substitutes that jump for the true initial-idle/walk sequence.
 */
import fs from 'node:fs';import zlib from 'node:zlib';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest} from '../../src/NativeGarmentFit.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url),json=p=>JSON.parse(fs.readFileSync(new URL(p,base))),gzip=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,base))));
const frozen=json('evidence/garment-wearer-metric/before-neutral-planning-guard/D_CONTINUOUS_NEUTRAL_STATE.json'),csr=json('evidence/CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json');
const referenceGeometry=json('evidence/garment-wearer-metric/after-outside-radial-hemisphere/D-continuous-first-failure-reference-geometry.json'),finalGeometry=json('evidence/garment-wearer-metric/after-outside-radial-hemisphere/D-continuous-first-failure-corrective-geometry.json');
const state=json('evidence/CAPTURE_RECOVERY_D_CLEARANCE_INITIAL_CONTACT_POSES.json').states.find(s=>s.frame===130),packet=gzip('vendor/appearance/cloth-r10/native/T03.json.gz'),source=gzip('vendor/appearance/cloth-r10/assets/native-person.json.gz');
const raw=loadNativeBodyFixture('D'),W=raw.packet.weights,values=new Float64Array(W.values.length);
for(let i=0;i<csr.bodyVertexCount;i++)for(let n=0;n<csr.displayRange[i*4+1];n++)values[W.ptr[i]+n]=csr.displayPacked[(csr.displayRange[i*4]+n)*8+4];
const target={...raw,positions:Float64Array.from(frozen.bodyPositions),packet:{...raw.packet,weights:{...W,values}}};
const initial=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:'top',family:'denim'}),neutral=frozen.rows.find(r=>r.id==='T03');
const binding=captureNeutralWearerRest(initial,Float64Array.from(neutral.positions),{kind:'old exact neutral state for read-only cold-entry RCA only'});
const reference=binding.sample(Float64Array.from(referenceGeometry.body.positions),state.skinMatrices),metric=binding.metric,display=referenceGeometry.garments.find(g=>g.id==='T03'),final=finalGeometry.garments.find(g=>g.id==='T03');
let maximumReferenceDifferenceM=0;for(let i=0;i<metric.displayToSolver.length;i++)for(let c=0;c<3;c++)maximumReferenceDifferenceM=Math.max(maximumReferenceDifferenceM,Math.abs(reference.positions[metric.displayToSolver[i]*3+c]-display.positions[i*3+c]));
if(maximumReferenceDifferenceM!==0)throw Error('FROZEN_COLD_REFERENCE_MISMATCH');
// Sum actual full triangle area normals in the complete sewn material map.
// Original active seam sites share one sum; indices and paper orientation stay.
const normals=new Float64Array(metric.count*3);
for(let k=0;k<display.faces.length;k+=3){
  const ids=display.faces.slice(k,k+3),P=display.positions,a=ids[0]*3,b=ids[1]*3,c=ids[2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
  for(const id of ids)for(let j=0;j<3;j++)normals[metric.displayToSolver[id]*3+j]+=n[j];
}
for(let i=0;i<metric.count;i++){const k=i*3,l=Math.hypot(...normals.subarray(k,k+3));if(l)for(let c=0;c<3;c++)normals[k+c]/=l;}
const groups=[567,568],rows=[];
for(const group of groups){
  const r=binding.reference.refs[group],bodyNormal=Array.from(reference.normals.subarray(group*3,group*3+3)),materialNormal=Array.from(normals.subarray(group*3,group*3+3)),origin=Array.from(reference.positions.subarray(group*3,group*3+3)),displayIndex=metric.displayToSolver.findIndex(v=>v===group);
  const phases=[];for(const [label,point]of [['frozen reference',origin],['rejected final geometry',final.positions.slice(displayIndex*3,displayIndex*3+3)]]){
    const actual=binding.contact.inspect(...point),bodySide=binding.contact.project(point,{eligibleFaces:binding.eligibleFaces,preferredNormal:bodyNormal,referenceOrigin:origin,margin:.004,limit:.08}),materialSide=binding.contact.project(point,{eligibleFaces:binding.eligibleFaces,preferredNormal:materialNormal,referenceOrigin:origin,margin:.004,limit:.08});
    phases.push({label,point,referenceOrigin:origin,actual,fixedBodySideExit:bodySide,actualReferenceMaterialSideExit:materialSide});
  }
  rows.push({group,displayIndex,fixedReferenceFace:r.face,referenceBodyIds:r.ids,referenceBodyBary:r.bary,referenceBodyWeights:Array.from({length:r.weights.length/2},(_,i)=>[target.rig.names[r.weights[i*2]],r.weights[i*2+1]]),fixedBodyNormal:bodyNormal,materialReferenceNormal:materialNormal,normalDot:bodyNormal.reduce((s,v,k)=>s+v*materialNormal[k],0),phases});
}
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),out={schema:'cold-entry-original-material-side-readonly/1',productionChanged:false,additionalSolve:false,actualSequentialHistoryAcceptance:false,
  maximumReferenceDifferenceM,materialNormals:'all original reference triangles area-weighted through complete source sewn map; no normal smoothing radius, truncation or new geometry',
  pairFixedBodyNormalDot:dot(rows[0].fixedBodyNormal,rows[1].fixedBodyNormal),pairReferenceMaterialNormalDot:dot(rows[0].materialReferenceNormal,rows[1].materialReferenceNormal),rows};
fs.writeFileSync(new URL('D_COLD_ENTRY_LEFT_MATERIAL_SIDE_RCA.json',folder),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
