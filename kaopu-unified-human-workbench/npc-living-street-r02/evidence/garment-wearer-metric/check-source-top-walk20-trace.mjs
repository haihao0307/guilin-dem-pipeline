/** Read-only replay of the frozen actual prefix. Observe the one failed T03
 * edge; no new pose, cloth candidate, parameter, pass or reference change. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest} from '../../src/NativeGarmentFit.mjs';
import {NativeGarmentCorrective} from '../../src/NativeGarmentCorrective.mjs';
import {closestTriangle} from '../../vendor/appearance/cloth-r10/mesh-contact.mjs';
import {nativeFaceNormal} from '../../src/NativeGarmentContact.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url),prefix='evidence/garment-wearer-metric/';
const bytes=p=>fs.readFileSync(new URL(p,base)),load=p=>JSON.parse(bytes(p)),gz=p=>JSON.parse(zlib.gunzipSync(bytes(p))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const receipt=load(prefix+'D_SOURCE_TOP_REFERENCE_INITIAL_PREFIX.json'),neutral=load(prefix+'D_CONTINUOUS_NEUTRAL_STATE.json'),input=load(receipt.inputPath),csr=load(receipt.csrPath);
const frozen=load(prefix+'D-source-top-reference-initial-prefix-first-failure-corrective-geometry.json');
for(const [p,want] of Object.entries(receipt.sourceHashes))if(hash(bytes(p))!==want)throw Error('FROZEN_SOURCE_CHANGED_'+p);
if(hash(bytes(receipt.inputPath))!==receipt.inputSHA256||hash(bytes(receipt.csrPath))!==receipt.csrSHA256)throw Error('FROZEN_INPUT_CHANGED');
const stop=receipt.firstFailure.frame,edgeIndex=receipt.frames.at(-1).garments.find(g=>g.id==='T03').after.maxWearerEdgeIndex;
const raw=loadNativeBodyFixture('D'),W=raw.packet.weights,values=new Float64Array(W.values.length);
for(let i=0;i<csr.bodyVertexCount;i++)for(let n=0;n<csr.displayRange[i*4+1];n++)values[W.ptr[i]+n]=csr.displayPacked[(csr.displayRange[i*4]+n)*8+4];
const target={...raw,positions:Float64Array.from(neutral.bodyPositions),packet:{...raw.packet,weights:{...W,values}}};
const packet=gz('vendor/appearance/cloth-r10/native/T03.json.gz'),source=gz('vendor/appearance/cloth-r10/assets/native-person.json.gz');
const initial=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:'top',family:'denim'}),saved=neutral.rows.find(r=>r.id==='T03');
const binding=captureNeutralWearerRest(initial,Float64Array.from(saved.positions),{kind:'unchanged accepted neutral for read-only source-top prefix trace'}),C=new NativeGarmentCorrective(binding);
const I=Array.from({length:104},()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
C.previousReference=Float64Array.from(binding.sample(target.positions,I).positions);
function sampleBody(M){const p=new Float64Array(csr.bodyVertexCount*3),R=csr.displayRange,A=csr.displayPacked;for(let i=0;i<csr.bodyVertexCount;i++)for(let n=0;n<R[i*4+1];n++){const k=(R[i*4]+n)*8,m=M[A[k+3]],w=A[k+4];for(let c=0;c<3;c++)p[i*3+c]+=w*(m[c*4]*A[k]+m[c*4+1]*A[k+1]+m[c*4+2]*A[k+2]+m[c*4+3]);}return p;}
const edge=binding.metric.sourceEdges[edgeIndex],watched=[edge.a,edge.b],events=[],phases=[],frames=[];
let pending=null,frameBody=null;
function measure(){const positions=watched.map(i=>Array.from(C.solver.p.subarray(i*3,i*3+3))),point=positions[0].map((v,k)=>(v+positions[1][k])*.5);return{positions,lengthM:Math.hypot(...positions[0].map((v,k)=>v-positions[1][k])),point,actual:binding.contact.inspect(...point)};}
function witness(f,point){if(f===undefined||f<0)return null;const q=new Float64Array(7);closestTriangle(frameBody,input.faces,f,...point,q);const ids=input.faces.slice(f,f+3),weights=new Map();for(let j=0;j<3;j++)for(let n=W.ptr[ids[j]];n<W.ptr[ids[j]+1];n++){const name=target.rig.names[W.joints[n]];weights.set(name,(weights.get(name)??0)+values[n]*q[j+4]);}return{faceOffset:f,triangle:f/3,ids,bary:Array.from(q.subarray(4,7)),closest:Array.from(q.subarray(1,4)),normal:Array.from(nativeFaceNormal(frameBody,input.faces,f)),weights:[...weights].sort((a,b)=>b[1]-a[1])};}
for(const state of input.states){
  if(state.frame>stop)break;const body=sampleBody(state.skinMatrices),reference=binding.sample(body,state.skinMatrices);let observer=null;
  if(state.frame===stop){
    frameBody=body;
    const flush=()=>{if(pending){pending.after=measure();pending=null;}},project=C.projectContacts.bind(C);
    C.projectContacts=(...args)=>{phases.push({phase:C.phase,when:'before',...measure()});project(...args);flush();phases.push({phase:C.phase,when:'after',...measure()});};
    observer=e=>{flush();if(e.sample.ids.some(i=>watched.includes(i))){pending={...JSON.parse(JSON.stringify(e)),before:measure()};events.push(pending);}};
    fs.writeFileSync(new URL('D_WALK20_SOURCE_TOP_ACCEPTED_ENTRY_STATE.json',folder),JSON.stringify({schema:'same-accepted-material-state-before-source-top-walk20/1',sourceHashes:receipt.sourceHashes,inputSHA256:receipt.inputSHA256,csrSHA256:receipt.csrSHA256,frame:stop,previousAcceptedFrame:state.frame-1,positions:Array.from(C.solver.p),previousReference:Array.from(C.previousReference)}));
  }
  const result=C.solve(reference.positions,reference.normals,{warmStart:true,onContact:observer});
  const original=receipt.frames.find(r=>r.frame===state.frame).garments.find(g=>g.id==='T03');
  if(result.report.numericallyEligible!==original.numericallyEligible||result.report.after.maxWearerEdgeRatio!==original.after.maxWearerEdgeRatio)throw Error('READONLY_REPLAY_DIVERGED_'+state.frame);
  frames.push({frame:state.frame,numericallyEligible:result.report.numericallyEligible,maxWearerEdgeRatio:result.report.after.maxWearerEdgeRatio});
  if(state.frame===stop){
    let maximumOutputScalarDifferenceM=0,maximumBodyScalarDifferenceM=0;const old=frozen.garments.find(g=>g.id==='T03').positions;
    for(let i=0;i<old.length;i++)maximumOutputScalarDifferenceM=Math.max(maximumOutputScalarDifferenceM,Math.abs(old[i]-result.display[i]));
    for(let i=0;i<body.length;i++)maximumBodyScalarDifferenceM=Math.max(maximumBodyScalarDifferenceM,Math.abs(body[i]-frozen.body.positions[i]));
    if(maximumOutputScalarDifferenceM!==0||maximumBodyScalarDifferenceM!==0)throw Error('READONLY_TRACE_CHANGED_FROZEN_GEOMETRY');
    for(const event of events){event.initialFace=witness(event.result.face,event.point);event.exitFace=witness(event.result.sourceFace,event.point);}
    const pointFor=i=>Array.from(reference.positions.subarray(i*3,i*3+3));
    const out={schema:'actual-source-top-walk20-worst-edge-readonly/1',releaseCandidate:false,algorithmChanged:false,sourceHashes:receipt.sourceHashes,inputSHA256:receipt.inputSHA256,csrSHA256:receipt.csrSHA256,frame:stop,frames,
      maximumOutputScalarDifferenceM,maximumBodyScalarDifferenceM,
      edge:{index:edgeIndex,...edge,wearerRestM:binding.metric.wearerEdges[edgeIndex],referenceLengthM:Math.hypot(...pointFor(edge.a).map((v,k)=>v-pointFor(edge.b)[k]))},
      references:watched.map(id=>({id,source:binding.reference.refs[id],position:pointFor(id),normal:Array.from(reference.normals.subarray(id*3,id*3+3)),actual:binding.contact.inspect(...pointFor(id)),sourceFaceWitness:witness(binding.reference.refs[id].face,pointFor(id))})),
      report:result.report,events,phases};
    fs.writeFileSync(new URL('D_WALK20_SOURCE_TOP_CONTACT_TRACE.json',folder),JSON.stringify(out,null,2)+'\n');
    console.log(JSON.stringify({frame:stop,maximumOutputScalarDifferenceM,maximumBodyScalarDifferenceM,events:events.length,edge:out.edge,eligible:result.report.numericallyEligible}));
    break;
  }
  console.log(JSON.stringify({frame:state.frame,eligible:result.report.numericallyEligible}));
}
