/** Replay only observed runtime matrices, with the exact displayed-body CSR.
 * No motion module, interpolation, garment parameter or source mesh is changed.
 * Stop at the first failed common final material/contact geometry.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest} from '../../src/NativeGarmentFit.mjs';
import {NativeGarmentCorrective} from '../../src/NativeGarmentCorrective.mjs';
import {closestTriangle} from '../../vendor/appearance/cloth-r10/mesh-contact.mjs';

const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(p,base))));
const inputPath=process.argv[2]??'evidence/CAPTURE_RECOVERY_D_CLEARANCE_ENTRY_CONTACT_POSES.json';
const csrPath='evidence/CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json';
const knownPath='evidence/CAPTURE_RECOVERY_CHAIN_D_CLEARANCE_CONTACT_POSES.json';
const inputBytes=fs.readFileSync(new URL(inputPath,base)),csrBytes=fs.readFileSync(new URL(csrPath,base));
const input=JSON.parse(inputBytes),csr=JSON.parse(csrBytes),known=JSON.parse(fs.readFileSync(new URL(knownPath,base)));
const fullInitialHistory=input.states[0].phase==='initial-idle';
const reportName=process.env.GARMENT_REPORT_NAME??(fullInitialHistory?'D_FULL_INITIAL_HISTORY_GARMENT.json':'D_CONTINUOUS_CAPTURE_GARMENT.json');
const geometryPrefix=process.env.GARMENT_GEOMETRY_PREFIX??(fullInitialHistory?'D-full-initial-history':'D-continuous');
const lastObservedFrame=process.env.LAST_OBSERVED_FRAME===undefined?Infinity:Number(process.env.LAST_OBSERVED_FRAME);
if(Number.isNaN(lastObservedFrame))throw Error('INVALID_OBSERVED_FRAME_LIMIT');
const instrument=process.env.TRACE_T03_WORST==='1',trace=[];
const neutralOnly=process.env.NEUTRAL_ONLY==='1',frozenNeutralURL=new URL('D_CONTINUOUS_NEUTRAL_STATE.json',folder);
const frozenNeutral=process.env.USE_FROZEN_NEUTRAL==='1'?JSON.parse(fs.readFileSync(frozenNeutralURL)):null,neutralRows=[];
const previousReceiptURL=new URL(reportName,folder),previousGeometryURL=new URL(geometryPrefix+'-first-failure-corrective-geometry.json',folder);
const previousReceipt=instrument&&fs.existsSync(previousReceiptURL)?JSON.parse(fs.readFileSync(previousReceiptURL)):null;
const previousGeometry=instrument&&fs.existsSync(previousGeometryURL)?JSON.parse(fs.readFileSync(previousGeometryURL)):null;
if(previousReceipt)fs.writeFileSync(new URL('D_CONTINUOUS_CAPTURE_INITIAL_RECEIPT.json',folder),JSON.stringify(previousReceipt,null,2)+'\n');
const I=Array.from({length:104},()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function sampleBody(matrices){
  const positions=new Float64Array(csr.bodyVertexCount*3),R=csr.displayRange,A=csr.displayPacked;
  for(let i=0;i<csr.bodyVertexCount;i++)for(let n=0;n<R[i*4+1];n++){
    const k=(R[i*4]+n)*8,m=matrices[A[k+3]],w=A[k+4];
    for(let c=0;c<3;c++)positions[i*3+c]+=w*(m[c*4]*A[k]+m[c*4+1]*A[k+1]+m[c*4+2]*A[k+2]+m[c*4+3]);
  }return positions;
}
function actualViewBasis(state){
  const l=state.posedMatrices[csr.rigNames.indexOf('upperleg01.L')],r=state.posedMatrices[csr.rigNames.indexOf('upperleg01.R')];
  if(!l||!r)throw Error('MISSING_ACTUAL_HIP_AXIS_FOR_DIAGNOSTIC_CAMERA');
  const x=l[3]-r[3],y=l[7]-r[7],len=Math.hypot(x,y);
  if(len<1e-8)throw Error('DEGENERATE_ACTUAL_HIP_AXIS');
  return {front:[y/len,-x/len,0],side:[x/len,y/len,0],back:[-y/len,x/len,0],basis:'actual posed upperleg01.L minus upperleg01.R horizontal axis; native Z up'};
}
const originalTarget=loadNativeBodyFixture('D');
if(input.bodyVertexCount!==originalTarget.bodyCount||csr.bodyVertexCount!==input.bodyVertexCount||csr.rigNames.length!==104||input.faces.length!==originalTarget.faces.length||input.faces.some((v,i)=>v!==originalTarget.faces[i]||v!==csr.faces[i]))throw Error('ACTUAL_FULL_BODY_CONTRACT_MISMATCH');
for(let i=0;i<input.states.length;i++)if(input.states[i].skinMatrices.length!==104||input.states[i].frame!==input.states[0].frame+i)throw Error('DENSE_RUNTIME_SEQUENCE_HAS_GAP');
const knownBody=known.states.find(s=>s.id==='D-actual-contact-frame99').positions,lastBody=sampleBody(input.states.at(-1).skinMatrices);
let contactReplayErrorM=0;for(let i=0;i<lastBody.length;i++)contactReplayErrorM=Math.max(contactReplayErrorM,Math.abs(lastBody[i]-knownBody[i]));
if(contactReplayErrorM!==0)throw Error('DISPLAY_CSR_CONTACT_REPLAY_NOT_EXACT');

// Preserve every runtime Float32 weight and its original joint identity.
// Source packet values remain available separately; no native influence is cut.
const W=originalTarget.packet.weights,values=new Float64Array(W.values.length);
let weightRoundingMaximum=0,neutralRoundingMaximumM=0;
for(let i=0;i<csr.bodyVertexCount;i++){
  if(W.ptr[i+1]-W.ptr[i]!==csr.displayRange[i*4+1])throw Error('DISPLAY_CSR_INFLUENCE_COUNT_CHANGED');
  for(let n=0;n<csr.displayRange[i*4+1];n++){
    const j=W.ptr[i]+n,k=(csr.displayRange[i*4]+n)*8;
    if(W.joints[j]!==csr.displayPacked[k+3])throw Error('DISPLAY_CSR_JOINT_ID_CHANGED');
    values[j]=csr.displayPacked[k+4];weightRoundingMaximum=Math.max(weightRoundingMaximum,Math.abs(values[j]-W.values[j]));
  }
}
const neutralBody=sampleBody(I);
for(let i=0;i<neutralBody.length;i++)neutralRoundingMaximumM=Math.max(neutralRoundingMaximumM,Math.abs(neutralBody[i]-originalTarget.positions[i]));
const target={...originalTarget,positions:neutralBody,packet:{...originalTarget.packet,weights:{...W,values}}};
const source=read('vendor/appearance/cloth-r10/assets/native-person.json.gz'),garments=[];
if(frozenNeutral&&(frozenNeutral.csrSHA256!==hash(csrBytes)||frozenNeutral.bodyPositions.some((v,i)=>v!==target.positions[i])))throw Error('FROZEN_NEUTRAL_RUNTIME_BODY_MISMATCH');
const report={schema:'actual-sequential-capture-wearer-rest-garment/1',releaseCandidate:false,productionReady:false,visualAccepted:false,
  inputPath,inputSHA256:hash(inputBytes),csrPath,csrSHA256:hash(csrBytes),inputSourceHashes:input.sourceHashes,
  neutralInput:frozenNeutral?{reusedAcceptedState:true,path:'evidence/garment-wearer-metric/D_CONTINUOUS_NEUTRAL_STATE.json',sha256:hash(fs.readFileSync(frozenNeutralURL)),sourceHashes:frozenNeutral.sourceHashes}:null,
  sourceHashes:Object.fromEntries(['NativeGarmentFit','NativeGarmentMetric','NativeGarmentContact','NativeGarmentCorrective','NativeGarmentReference'].map(n=>['src/'+n+'.mjs',hash(fs.readFileSync(new URL('src/'+n+'.mjs',base)))])),
  originalWaistAttachmentsSHA256:hash(fs.readFileSync(new URL('vendor/appearance/cloth-r10/waist-attachments.mjs',base))),
  bodyReplay:{nativeBodyVertices:csr.bodyVertexCount,full104Matrices:true,allInfluences:true,contact99MaximumScalarErrorM:contactReplayErrorM,originalPacketToActualFloat32WeightRoundingMaximum:weightRoundingMaximum,originalFixtureToActualNeutralMaximumScalarM:neutralRoundingMaximumM},
  sequence:{availableFrames:input.states.length,firstGlobalFrame:input.states[0].frame,lastGlobalFrame:input.states.at(-1).frame,actualObservedFramesOnly:true,syntheticInterpolation:false,
    initialState:fullInitialHistory?'accepted exact displayed-body neutral wearer rest followed by the original observed runtime idle(dt=0), then every real walk/entry/contact frame':'accepted exact displayed-body neutral wearer rest; earlier walking garment state was not in the provided cache',
    includesOriginalIdleAndEveryEarlierWalkingFrame:fullInitialHistory,initialRuntimePosePresumedEqualToCanonicalNeutral:false,firstNeutralToEntryGapRecorded:!fullInitialHistory},
  constraints:{hSeconds:1/240,materialIterations:16,guardIterations:12,sourceAuditMarginM:.004,localPlanningGuardM:.00001,planningContactMarginM:.00401,sourceInteriorSampleMarginsM:{vertex:0,edge:.0006,triangle:.0008},sourceDenseSampleOrder:['vertex','edge','triangle'],perSampleContactStepM:.008,totalMaterialDisplacementLimitM:.08},
  poseCache:'Compare all 104 skin matrices exactly; unchanged local pose reuses the already accepted material geometry and audit. No tolerance or pose-distance threshold.',
  neutral:[],frames:[],completed:false,firstFailure:null};
const write=()=>{if(!neutralOnly)fs.writeFileSync(new URL(reportName,folder),JSON.stringify(report,null,2)+'\n');};
for(const id of ['T03','P01']){
  const packet=read('vendor/appearance/cloth-r10/native/'+id+'.json.gz');
  const initial=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:id==='P01'?'bottom':'top',family:'denim',neutralEvidence:{kind:'exact runtime packed-display neutral full body'}});
  const ref=initial.sample(target.positions,I),saved=frozenNeutral?.rows.find(r=>r.id===id);
  const neutral=saved?{positions:Float64Array.from(saved.positions),report:saved.report}:new NativeGarmentCorrective(initial).initializeNeutral(ref.positions,ref.normals);
  report.neutral.push({id,...neutral.report});write();
  if(!neutral.report.numericallyEligible)throw Error('EXACT_DISPLAY_NEUTRAL_WEARER_NOT_READY_'+id);
  const binding=captureNeutralWearerRest(initial,neutral.positions,{kind:'exact displayed-body neutral source-material solve before actual captured sequence',report:neutral.report}),corrective=new NativeGarmentCorrective(binding);
  neutralRows.push({id,positions:Array.from(neutral.positions),report:neutral.report});
  // The constructor holds the accepted neutral material geometry. Its matching
  // reference is known, so the first actual frame preserves that material state.
  corrective.previousReference=Float64Array.from(binding.sample(target.positions,I).positions);
  let offset=0;const faces=packet.spec.panels.flatMap(p=>{const f=p.triangles.flatMap(t=>t.map(i=>i+offset));offset+=p.uvMm.length;return f;});
  garments.push({id,packet,binding,corrective,faces});
  console.log(JSON.stringify({event:'neutral-ready',id,elapsedMS:neutral.report.elapsedMS,maxEdge:neutral.report.after.maxWearerEdgeRatio,inside:neutral.report.contact.inside,below4MM:neutral.report.contact.clearanceDeficits}));
}
if(!frozenNeutral)fs.writeFileSync(frozenNeutralURL,JSON.stringify({schema:'frozen-exact-runtime-neutral-material-state/1',csrSHA256:hash(csrBytes),bodyPositions:Array.from(target.positions),sourceHashes:report.sourceHashes,rows:neutralRows}));
if(neutralOnly){console.log(JSON.stringify({event:'neutral-state-frozen',rows:neutralRows.map(r=>r.id)}));process.exit(0);}
let previousBody=neutralBody,previousMatrices=null,previousAcceptedFrame=null;
report.sequence.requestedLastObservedFrame=Number.isFinite(lastObservedFrame)?lastObservedFrame:input.states.at(-1).frame;
for(let index=0;index<input.states.length&&input.states[index].frame<=lastObservedFrame;index++){
  const t=performance.now(),state=input.states[index],unchangedPose=previousMatrices&&state.skinMatrices.every((m,i)=>m.every((v,k)=>v===previousMatrices[i][k]));
  const body=unchangedPose?previousBody:sampleBody(state.skinMatrices),bodyRebuildMS=performance.now()-t;
  let maxBodyStepM=0;for(let i=0;i<body.length;i+=3)maxBodyStepM=Math.max(maxBodyStepM,Math.hypot(body[i]-previousBody[i],body[i+1]-previousBody[i+1],body[i+2]-previousBody[i+2]));
  const row={sequenceIndex:index,id:state.id,frame:state.frame,time:state.time,mode:state.mode??(state.phase==='entry'?'pickup':null),phase:state.phase,sourceFrame:state.sourceFrame,maximumBodyStepM:maxBodyStepM,bodyRebuildMS,exactUnchangedPose:Boolean(unchangedPose),fromAcceptedNeutral:index===0,garments:[]};
  const referenceGeometry={actor:'D',pose:state.id,nativeAxis:'Z-up',viewBasis:actualViewBasis(state),body:{positions:Array.from(body),faces:input.faces},headIncluded:false,rootWorld:state.rootWorld,actualMotionMatrices:true,motionRegenerated:false,stage:'actual observed frame garment reference; transport method recorded per garment',garments:[]};
  const finalGeometry={...referenceGeometry,stage:'same frame full material/contact final candidate',garments:[]};
  for(const g of garments){
    const refStart=performance.now(),reference=unchangedPose?g.lastReference:g.binding.sample(body,state.skinMatrices),referenceAndBodyBVHRefitMS=performance.now()-refStart;
    const onContact=instrument&&g.id==='T03'?event=>{if(event.sample.ids.some(i=>i===2090||i===1142))trace.push(JSON.parse(JSON.stringify(event)));}:null;
    const result=unchangedPose?g.lastResult:g.corrective.solve(reference.positions,reference.normals,{warmStart:true,onContact});
    const frameReport=unchangedPose?{...result.report,elapsedMS:0,metrics:{...result.report.metrics,materialMS:0,contactMS:0},queryDelta:Object.fromEntries(Object.keys(result.report.queryDelta).map(k=>[k,0])),exactPoseAuditReusedFromFrame:previousAcceptedFrame}:result.report;
    row.garments.push({id:g.id,referenceAndBodyBVHRefitMS,referenceField:g.binding.reference.transportReport,waistAttachment:g.binding.reference.waistAttachment,...frameReport});
    g.lastReference=reference;g.lastResult=result;
    const displayReference=new Float64Array(g.binding.metric.displayToSolver.length*3);
    for(let i=0;i<g.binding.metric.displayToSolver.length;i++)displayReference.set(reference.positions.subarray(g.binding.metric.displayToSolver[i]*3,g.binding.metric.displayToSolver[i]*3+3),i*3);
    referenceGeometry.garments.push({id:g.id,referenceTransport:g.binding.reference.transportReport,positions:Array.from(displayReference),faces:g.faces});
    finalGeometry.garments.push({id:g.id,positions:Array.from(result.display),faces:g.faces});
    console.log(JSON.stringify({event:'frame',index,frame:state.frame,phase:state.phase,sourceFrame:state.sourceFrame,id:g.id,exactPoseCached:Boolean(unchangedPose),eligible:result.report.numericallyEligible,elapsedMS:frameReport.elapsedMS,inside:result.report.contact.inside,positiveBelow4MM:result.report.contact.clearanceDeficits,edge:result.report.after.maxWearerEdgeRatio,moveMM:result.report.after.maxReferenceMoveM*1000,unresolved:result.report.metrics.unresolvedQueries}));
  }
  row.elapsedMS=performance.now()-t;report.frames.push(row);
  const failed=row.garments.filter(g=>!g.numericallyEligible);
  if(failed.length){
    report.firstFailure={sequenceIndex:index,frame:state.frame,phase:state.phase,sourceFrame:state.sourceFrame,garments:failed.map(g=>g.id),atNeutralToInitialRuntimePose:index===0,atInitialNeutralToEntryGap:index===0&&!fullInitialHistory};
    fs.writeFileSync(new URL(geometryPrefix+'-first-failure-reference-geometry.json',folder),JSON.stringify(referenceGeometry));
    fs.writeFileSync(new URL(geometryPrefix+'-first-failure-corrective-geometry.json',folder),JSON.stringify(finalGeometry));
    if(instrument){
      const g=garments.find(g=>g.id==='T03'),metric=g.binding.metric,edge=metric.sourceEdges[4823],coords=(P,i)=>Array.from(P.subarray(i*3,i*3+3));
      function faceWeights(face,point){
        if(face===undefined||face<0)return null;const q=new Float64Array(7);closestTriangle(body,input.faces,face,...point,q);
        const ids=input.faces.slice(face,face+3),weights=new Map();
        for(let a=0;a<3;a++)for(let n=W.ptr[ids[a]];n<W.ptr[ids[a]+1];n++){const name=target.rig.names[W.joints[n]];weights.set(name,(weights.get(name)??0)+values[n]*q[4+a]);}
        return {faceOffset:face,triangle:face/3,ids,bary:Array.from(q.subarray(4,7)),pointOnFace:Array.from(q.subarray(1,4)),completeWeights:[...weights].sort((a,b)=>b[1]-a[1])};
      }
      for(const event of trace){event.initialFace=faceWeights(event.result.face,event.point);event.selectedExitFace=faceWeights(event.result.sourceFace,event.point);}
      const oldGarments=previousGeometry?.garments||[];let maximumOutputScalarDifference=0;
      for(const output of finalGeometry.garments){const old=oldGarments.find(g=>g.id===output.id);if(old)for(let i=0;i<output.positions.length;i++)maximumOutputScalarDifference=Math.max(maximumOutputScalarDifference,Math.abs(output.positions[i]-old.positions[i]));}
      const watched=[2090,1142].map(i=>{const r=g.binding.reference.refs[i];return {group:i,rest:coords(metric.fittedNative,i),referenceFace:r.face,referenceIds:r.ids,referenceBary:r.bary,referenceOffset:r.offset,referenceWeights:Array.from({length:r.weights.length/2},(_,j)=>[target.rig.names[r.weights[j*2]],r.weights[j*2+1]])};});
      const outputs=finalGeometry.garments.find(g=>g.id==='T03'),before=referenceGeometry.garments.find(g=>g.id==='T03');
      const length=P=>Math.hypot(...[0,1,2].map(k=>P[edge.sourceVertices[0]*3+k]-P[edge.sourceVertices[1]*3+k]));
      fs.writeFileSync(new URL('D_ENTRY_T03_CONTACT_TRACE.json',folder),JSON.stringify({schema:'same-input-t03-entry-contact-trace/1',algorithmChanged:false,parametersChanged:false,sourceHashes:report.sourceHashes,frame:state.frame,inputSHA256:report.inputSHA256,maximumOutputScalarDifference,edge:{...edge,wearerRestM:metric.wearerEdges[4823],referenceLengthM:length(before.positions),correctiveLengthM:length(outputs.positions)},watched,events:trace},null,2)+'\n');
    }
    write();break;
  }
  previousBody=body;previousMatrices=state.skinMatrices;previousAcceptedFrame=state.frame;
  if(index===input.states.length-1){report.completed=true;fs.writeFileSync(new URL(geometryPrefix+'-contact99-corrective-geometry.json',folder),JSON.stringify(finalGeometry));}
  if(state.frame===lastObservedFrame){
    fs.writeFileSync(new URL(geometryPrefix+'-bounded-end-reference-geometry.json',folder),JSON.stringify(referenceGeometry));
    fs.writeFileSync(new URL(geometryPrefix+'-bounded-end-corrective-geometry.json',folder),JSON.stringify(finalGeometry));
  }
  write();
}
report.boundedEndReached=!report.firstFailure&&report.frames.at(-1)?.frame===report.sequence.requestedLastObservedFrame;write();
console.log(JSON.stringify({event:'complete',processedFrames:report.frames.length,availableFrames:input.states.length,completed:report.completed,boundedEndReached:report.boundedEndReached,firstFailure:report.firstFailure}));
