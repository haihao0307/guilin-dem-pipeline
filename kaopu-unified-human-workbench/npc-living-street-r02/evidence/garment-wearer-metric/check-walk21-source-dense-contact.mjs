/** Same accepted material state and same observed frame; restore only the
 * original dense-sample order/margins in the local corrective. No motion. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest} from '../../src/NativeGarmentFit.mjs';
import {NativeGarmentCorrective} from '../../src/NativeGarmentCorrective.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url);
const bytes=p=>fs.readFileSync(new URL(p,base)),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),load=p=>JSON.parse(bytes(p)),gz=p=>JSON.parse(zlib.gunzipSync(bytes(p)));
const prefix='evidence/garment-wearer-metric/';
const neutral=load(prefix+'D_CONTINUOUS_NEUTRAL_STATE.json'),csr=load('evidence/CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json');
const input=load('evidence/CAPTURE_RECOVERY_D_CLEARANCE_INITIAL_CONTACT_POSES.json'),state=input.states.find(s=>s.frame===21);
const geometry=load(prefix+'before-source-dense-contact/D-full-initial-history-first-failure-corrective-geometry.json'),entry=load(prefix+'D_WALK21_T03_ACCEPTED_ENTRY_STATE.json');
if(geometry.pose!==state.id||entry.frame!==21)throw Error('OBSERVED_WALK21_INPUT_ONLY');
for(const [p,expected] of Object.entries(entry.sourceHashes))if(p!=='src/NativeGarmentCorrective.mjs'&&hash(bytes(p))!==expected)throw Error('OTHER_SOURCE_CHANGED_'+p);
const raw=loadNativeBodyFixture('D'),W=raw.packet.weights,values=new Float64Array(W.values.length);
for(let i=0;i<csr.bodyVertexCount;i++)for(let n=0;n<csr.displayRange[i*4+1];n++)values[W.ptr[i]+n]=csr.displayPacked[(csr.displayRange[i*4]+n)*8+4];
const target={...raw,positions:Float64Array.from(neutral.bodyPositions),packet:{...raw.packet,weights:{...W,values}}};
const packet=gz('vendor/appearance/cloth-r10/native/T03.json.gz'),source=gz('vendor/appearance/cloth-r10/assets/native-person.json.gz');
const initial=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:'top',family:'denim'});
const saved=neutral.rows.find(r=>r.id==='T03'),binding=captureNeutralWearerRest(initial,Float64Array.from(saved.positions),{kind:'same frozen accepted neutral; no refit or new rest metric'}),C=new NativeGarmentCorrective(binding);
C.solver.p.set(entry.positions);C.previousReference=Float64Array.from(entry.previousReference);
const body=Float64Array.from(geometry.body.positions),reference=binding.sample(body,state.skinMatrices);
const instrument=process.env.TRACE_KIND_MARGINS==='1',events=[],phases=[],watched=[1698,1142];let pending=null,onContact=null;
const watch=()=>({positions:watched.map(i=>Array.from(C.solver.p.subarray(i*3,i*3+3))),lengthM:Math.hypot(...[0,1,2].map(c=>C.solver.p[watched[0]*3+c]-C.solver.p[watched[1]*3+c]))});
if(instrument){
  const flush=()=>{if(pending){pending.after=watch();pending=null;}},project=C.projectContacts.bind(C);
  C.projectContacts=(...args)=>{phases.push({phase:C.phase,when:'before',...watch()});project(...args);flush();phases.push({phase:C.phase,when:'after',...watch()});};
  onContact=e=>{flush();if(e.sample.ids.some(i=>watched.includes(i))){pending={...JSON.parse(JSON.stringify(e)),before:watch()};events.push(pending);}};
}
const result=C.solve(reference.positions,reference.normals,{warmStart:true,onContact});
if(instrument){
  const old=load(prefix+'D-walk21-original-dense-contact-geometry.json').garments.find(g=>g.id==='T03').positions;
  let maximumScalarDifferenceM=0;for(let i=0;i<old.length;i++)maximumScalarDifferenceM=Math.max(maximumScalarDifferenceM,Math.abs(old[i]-result.display[i]));
  if(maximumScalarDifferenceM!==0)throw Error('READONLY_DENSE_TRACE_CHANGED_GEOMETRY');
  const e=binding.metric.sourceEdges[4825];
  fs.writeFileSync(new URL('D_WALK21_SOURCE_DENSE_EDGE_TRACE.json',folder),JSON.stringify({schema:'same-actual-walk21-source-dense-worst-edge-trace/1',maximumScalarDifferenceM,sourceSHA256:hash(bytes('src/NativeGarmentCorrective.mjs')),edge:{index:4825,...e,wearerRestM:binding.metric.wearerEdges[4825],referenceLengthM:Math.hypot(...[0,1,2].map(c=>reference.positions[e.a*3+c]-reference.positions[e.b*3+c]))},references:watched.map(id=>({id,reference:binding.reference.refs[id],normal:Array.from(reference.normals.subarray(id*3,id*3+3)),position:Array.from(reference.positions.subarray(id*3,id*3+3))})),events,phases},null,2)+'\n');
}
const original=load(prefix+'before-source-dense-contact/D_FULL_INITIAL_HISTORY_GARMENT.json').frames.find(r=>r.frame===21).garments.find(g=>g.id==='T03');
const point=[0,0,0];for(const id of [1178,1177])for(let c=0;c<3;c++)point[c]+=result.positions[id*3+c]*.5;
const out={schema:'same-walk21-restored-original-dense-contact/1',releaseCandidate:false,visualAccepted:false,frame:21,bodyAndMotionChanged:false,neutralMetricChanged:false,
  originalSourceSHA256:hash(bytes('vendor/appearance/cloth-r10/cloth-physics.mjs')),
  oldCorrectiveSHA256:entry.sourceHashes['src/NativeGarmentCorrective.mjs'],newCorrectiveSHA256:hash(bytes('src/NativeGarmentCorrective.mjs')),
  acceptedEntrySHA256:hash(bytes(prefix+'D_WALK21_T03_ACCEPTED_ENTRY_STATE.json')),sameInputState:entry.inputSHA256,
  change:'restore original vertex→edge→triangle phase order and source0/600/800µm interior planning margins; local10µm guard unchanged; final4mm gate unchanged',
  sourceAuditMarginM:.004,localPlanningGuardM:.00001,originalSourceInteriorMarginsM:{vertex:0,edge:.0006,triangle:.0008},
  before:original,after:result.report,knownEdge:{ids:[1178,1177],point,actual:binding.contact.inspect(...point)}};
fs.writeFileSync(new URL('D_WALK21_ORIGINAL_DENSE_CONTACT_RESULT.json',folder),JSON.stringify(out,null,2)+'\n');
const rendered={...geometry,stage:'same accepted frame20 material state; restored original dense contact targets/order',garments:geometry.garments.map(g=>g.id==='T03'?{...g,positions:Array.from(result.display)}:g)};
fs.writeFileSync(new URL('D-walk21-original-dense-contact-geometry.json',folder),JSON.stringify(rendered));
console.log(JSON.stringify({eligible:result.report.numericallyEligible,beforeInside:original.contact.inside,beforeBelow4MM:original.contact.clearanceDeficits,beforeMinM:original.contact.minimumOutsideM,afterInside:result.report.contact.inside,afterBelow4MM:result.report.contact.clearanceDeficits,afterMinM:result.report.contact.minimumOutsideM,maxWearerEdge:result.report.after.maxWearerEdgeRatio,maxMoveM:result.report.after.maxReferenceMoveM,elapsedMS:result.report.elapsedMS,knownEdge:out.knownEdge},null,2));
