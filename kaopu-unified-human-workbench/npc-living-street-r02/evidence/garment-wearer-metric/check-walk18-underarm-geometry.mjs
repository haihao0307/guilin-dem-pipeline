/** Same observed geometry only; no pose or cloth solve. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest,auditGarmentBody} from '../../src/NativeGarmentFit.mjs';
import {auditGarmentMetric,expandGarmentDisplay,nativeToClothCoordinates,clothToNativeCoordinates} from '../../src/NativeGarmentMetric.mjs';
import crypto from 'node:crypto';
import {closestTriangle} from '../../vendor/appearance/cloth-r10/mesh-contact.mjs';
import {nativeFaceNormal} from '../../src/NativeGarmentContact.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url),load=p=>JSON.parse(fs.readFileSync(new URL(p,base))),gz=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,base))));
const f='evidence/garment-wearer-metric/',neutral=load(f+'D_CONTINUOUS_NEUTRAL_STATE.json'),csr=load('evidence/CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json'),input=load('evidence/CAPTURE_RECOVERY_D_CLEARANCE_INITIAL_CONTACT_POSES.json'),state=input.states.find(s=>s.frame===18);
const geometry=load(f+'D-source-dense-initial-prefix-first-failure-corrective-geometry.json'),referenceGeometry=load(f+'D-source-dense-initial-prefix-first-failure-reference-geometry.json');
if(geometry.pose!==state.id)throw Error('FROZEN_WALK18_ONLY');
const raw=loadNativeBodyFixture('D'),W=raw.packet.weights,values=new Float64Array(W.values.length);
for(let i=0;i<csr.bodyVertexCount;i++)for(let n=0;n<csr.displayRange[i*4+1];n++)values[W.ptr[i]+n]=csr.displayPacked[(csr.displayRange[i*4]+n)*8+4];
const target={...raw,positions:Float64Array.from(neutral.bodyPositions),packet:{...raw.packet,weights:{...W,values}}};
const initial=await createWholeGarmentBinding({sourcePerson:gz('vendor/appearance/cloth-r10/assets/native-person.json.gz'),targetBody:target,packet:gz('vendor/appearance/cloth-r10/native/T03.json.gz'),role:'top',family:'denim'});
const saved=neutral.rows.find(r=>r.id==='T03'),binding=captureNeutralWearerRest(initial,Float64Array.from(saved.positions),{kind:'existing accepted neutral only'}),body=Float64Array.from(geometry.body.positions),reference=binding.sample(body,state.skinMatrices),F=binding.source.faces;
const G=geometry.garments.find(g=>g.id==='T03').positions,R=referenceGeometry.garments.find(g=>g.id==='T03').positions;
const map=binding.metric.displayToSolver,sewn=new Float64Array(binding.metric.count*3);let exactReferenceErrorM=0;
for(let i=0;i<map.length;i++){sewn.set(G.slice(i*3,i*3+3),map[i]*3);for(let c=0;c<3;c++)exactReferenceErrorM=Math.max(exactReferenceErrorM,Math.abs(reference.positions[map[i]*3+c]-R[i*3+c]));}
if(exactReferenceErrorM!==0)throw Error('FROZEN_REFERENCE_NOT_EXACT');
function info(p){
  const actual=binding.contact.inspect(...p),q=closestTriangle(body,F,actual.face,...p),weights=new Map(),ids=Array.from(F.subarray(actual.face,actual.face+3));
  for(let a=0;a<3;a++)for(let k=W.ptr[ids[a]];k<W.ptr[ids[a]+1];k++){const name=target.rig.names[W.joints[k]];weights.set(name,(weights.get(name)??0)+values[k]*q[4+a]);}
  return{position:Array.from(p),actual,bodyIds:ids,bary:Array.from(q.slice(4)),nearestPoint:Array.from(q.slice(1,4)),normal:Array.from(nativeFaceNormal(body,F,actual.face)),bodyWeights:[...weights].sort((a,b)=>b[1]-a[1])};
}
const ids=[1178,1177],rows=ids.map(id=>{
  const r=binding.reference.refs[id],B=[0,0,0],offset=[0,0,0];
  for(let a=0;a<3;a++)for(let c=0;c<3;c++)B[c]+=body[r.ids[a]*3+c]*r.bary[a];
  for(let k=0;k<r.weights.length;k+=2){const m=state.skinMatrices[r.weights[k]],w=r.weights[k+1];for(let c=0;c<3;c++)offset[c]+=w*(m[c*4]*r.offset[0]+m[c*4+1]*r.offset[1]+m[c*4+2]*r.offset[2]);}
  return{id,fixedBodyReference:{face:r.face,ids:r.ids,bary:r.bary,offset:r.offset,currentBaryPoint:B,currentCross:Array.from(nativeFaceNormal(body,F,r.face)),allWeights:Array.from({length:r.weights.length/2},(_,k)=>[target.rig.names[r.weights[k*2]],r.weights[k*2+1]])},neutral:Array.from(binding.metric.fittedNative.subarray(id*3,id*3+3)),currentContinuous:info(reference.positions.subarray(id*3,id*3+3)),final:info(sewn.subarray(id*3,id*3+3)),sourceReducedAlgebra:info(B.map((v,c)=>v+offset[c]))};
});
const norm=v=>Math.hypot(...v),difference=(a,b)=>a.map((v,k)=>v-b[k]),deltas=rows.map(r=>difference(r.final.position,r.currentContinuous.position)),dot=deltas[0].reduce((s,v,k)=>s+v*deltas[1][k],0)/(norm(deltas[0])*norm(deltas[1]));
const out={schema:'same-walk18-underarm-reference-exterior-readonly/1',frame:18,clothOrMotionChanged:false,exactReferenceErrorM,ids,rows,contactDeltas:deltas,contactDeltaCosine:dot,sourceReducedReferenceEdgeM:norm(difference(rows[0].sourceReducedAlgebra.position,rows[1].sourceReducedAlgebra.position)),scope:'Original reference formula is evaluated at only these two fixed refs, using every original CSR contribution. This is read-only algebra, not a new binding candidate or a claim of whole-garment feasibility.'};
fs.writeFileSync(new URL('D_WALK18_UNDERARM_GEOMETRY_READONLY.json',folder),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));

// Execute the two pure original functions byte-for-byte from the fixed source.
// Only the documented native-Z-up <-> cloth-Y-up adapter surrounds them.
const reducedBytes=fs.readFileSync(new URL('vendor/appearance/cloth-r10/reduced-cloth.mjs',base)),lines=reducedBytes.toString().split(/\r?\n/);
const deformLine=lines.find(s=>s.startsWith('const deformVector=')),sampleLine=lines.find(s=>s.startsWith('function sampleReference('));
if(!deformLine||!sampleLine)throw Error('ORIGINAL_REFERENCE_FUNCTIONS_MISSING');
const sourceSample=Function('const vectorScratch=new Float64Array(3);\n'+deformLine+'\n'+sampleLine+'\nreturn sampleReference;')();
const actor={positions:nativeToClothCoordinates(body),skin:state.skinMatrices},sourceCloth=new Float64Array(binding.metric.count*3),sourceNormalsCloth=new Float64Array(sourceCloth.length),manual=new Float64Array(sourceCloth.length);
for(let i=0;i<binding.reference.refs.length;i++){
  const r=binding.reference.refs[i],ref={...r,offset:[r.offset[0],r.offset[2],-r.offset[1]]};sourceSample(ref,actor,sourceCloth,i*3,sourceNormalsCloth);
  for(let a=0;a<3;a++)for(let c=0;c<3;c++)manual[i*3+c]+=body[r.ids[a]*3+c]*r.bary[a];
  for(let k=0;k<r.weights.length;k+=2){const m=state.skinMatrices[r.weights[k]],w=r.weights[k+1];for(let c=0;c<3;c++)manual[i*3+c]+=w*(m[c*4]*r.offset[0]+m[c*4+1]*r.offset[1]+m[c*4+2]*r.offset[2]);}
}
const sourceNative=clothToNativeCoordinates(sourceCloth),sourceNormals=clothToNativeCoordinates(sourceNormalsCloth);let sourceAlgebraMaximumDifferenceM=0;
for(let i=0;i<sourceNative.length;i++)sourceAlgebraMaximumDifferenceM=Math.max(sourceAlgebraMaximumDifferenceM,Math.abs(sourceNative[i]-manual[i]));
if(sourceAlgebraMaximumDifferenceM>1e-14)throw Error('ORIGINAL_SOURCE_REFERENCE_ALGEBRA_MISMATCH');
const actual={material:auditGarmentMetric(binding.metric,sourceNative,{referenceNative:sourceNative}),contact:auditGarmentBody(binding,sourceNative)},continuous={material:auditGarmentMetric(binding.metric,reference.positions,{referenceNative:reference.positions}),contact:auditGarmentBody(binding,reference.positions)};
const geometryReport={schema:'same-walk18-complete-top-original-reference-readonly/1',actor:'D',garment:'T03',frame:18,additionalClothSolve:false,bodyOrMotionChanged:false,
  sourcePath:'kaopu-tailor-workbench/material-products/mp05-studio-r10-3fc034fa91ef/reduced-cloth.mjs',sourceCommit:'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49',sourceSHA256:crypto.createHash('sha256').update(reducedBytes).digest('hex'),
  pureSourceFunctionsExecuted:['deformVector','sampleReference'],sourceAlgebraMaximumDifferenceM,allCSRInfluencesRetained:true,sourceDisplayIndicesAndUVRetained:true,sewnCoordinatesShared:true,
  currentContinuous:continuous,originalSource:actual,knownEdge:{ids,wearerRestM:binding.metric.wearerEdges[3435],originalReferenceLengthM:Math.hypot(...[0,1,2].map(c=>sourceNative[1178*3+c]-sourceNative[1177*3+c]))},
  limitation:'This full upper-garment reference is not a material/contact solve or a dynamic-history pass. Pants remain the existing continuous cross-leg field.'};
fs.writeFileSync(new URL('D_WALK18_COMPLETE_SOURCE_TOP_REFERENCE.json',folder),JSON.stringify(geometryReport,null,2)+'\n');
fs.writeFileSync(new URL('D-walk18-original-top-reference-geometry.json',folder),JSON.stringify({...geometry,stage:'original ReducedCloth top reference only; unchanged accepted-pose pants',garments:geometry.garments.map(g=>g.id==='T03'?{...g,positions:Array.from(expandGarmentDisplay(binding.metric,sourceNative))}:g)}));
console.log(JSON.stringify({event:'complete-original-top-reference',sourceAlgebraMaximumDifferenceM,original:{inside:actual.contact.inside,below4MM:actual.contact.clearanceDeficits,maxWearerEdge:actual.material.maxWearerEdgeRatio,maxPaperEdge:actual.material.maxPaperEdgeRatio},continuous:{inside:continuous.contact.inside,below4MM:continuous.contact.clearanceDeficits,maxWearerEdge:continuous.material.maxWearerEdgeRatio},knownEdge:geometryReport.knownEdge}));
