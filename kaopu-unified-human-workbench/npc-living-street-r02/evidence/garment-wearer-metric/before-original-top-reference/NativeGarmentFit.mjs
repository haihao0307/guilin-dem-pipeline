/** New, explicitly local wearer adapter after recovery of the original source.
 * It is not a restoration of the lost a750 bytes. Source cloth vertices, UVs,
 * seams and paper metrics remain intact. Shape transport uses a continuous
 * positive displacement field. Pose references extend the original complete
 * CSR rotated-offset rule to a positive continuous body-support field; fixed
 * body faces retain contact-normal identities only.
 */
import {MeshContact,closestTriangle} from '../vendor/appearance/cloth-r10/mesh-contact.mjs';
import {createGarmentMetric,createGarmentSolverMetric,expandGarmentDisplay} from './NativeGarmentMetric.mjs';
import {NativeGarmentContact,nativeFaceNormal} from './NativeGarmentContact.mjs';
import {compileContinuousGarmentReference} from './NativeGarmentReference.mjs';
import {WaistAttachments} from '../vendor/appearance/cloth-r10/waist-attachments.mjs';

const GROUND_SHIFT=.9858653545379639;
const sourceCache=new WeakMap();
export function originalGarmentNative(packet){return Float64Array.from(packet.record.positionsMm.flatMap(p=>[p[0]*.001,-p[2]*.001,p[1]*.001-GROUND_SHIFT]));}
function bodyFaces(person){
  const F=person.faces,N=person.bodyCount,out=[];for(let f=0;f<F.length;f+=3)if(F[f]<N&&F[f+1]<N&&F[f+2]<N)out.push(F[f],F[f+1],F[f+2]);return Int32Array.from(out);
}
function sourceField(person){
  if(sourceCache.has(person))return sourceCache.get(person);
  const positions=Float64Array.from(person.positions.slice(0,person.bodyCount*3)),faces=bodyFaces(person),W=person.rig.weights,names=person.rig.names,
    torso=new Float64Array(person.bodyCount),lower=new Float64Array(person.bodyCount);
  for(let i=0;i<person.bodyCount;i++)for(let k=W.ptr[i];k<W.ptr[i+1];k++){
    const name=names[W.joints[k]],w=W.values[k];
    // The original upper garment reaches the proximal upper arm at its
    // armhole; the original waistband reaches spine02--04. These are its
    // underlying body, not passing foreign limbs. Hands/lower arms remain
    // excluded from the dynamic paired-contact domain.
    if(/^(root|spine|pelvis|clavicle|shoulder|neck|upperarm)/.test(name))torso[i]+=w;
    if(/^(root|spine|pelvis|upperleg|lowerleg|foot|toe)/.test(name))lower[i]+=w;
  }
  const vertices={},masks={};
  for(const region of ['torso','lower','left','right']){
    const values=region==='torso'?torso:lower,ids=[];for(let i=0;i<person.bodyCount;i++)if(values[i]>.65&&(region!=='left'||positions[i*3]>=-.001)&&(region!=='right'||positions[i*3]<=.001))ids.push(i);
    vertices[region]=Int32Array.from(ids);const mask=new Uint8Array(faces.length/3);
    for(let f=0;f<faces.length;f+=3){const a=faces[f],b=faces[f+1],c=faces[f+2],x=(positions[a*3]+positions[b*3]+positions[c*3])/3;
      if((values[a]+values[b]+values[c])/3>.65&&(region!=='left'||x>=-.001)&&(region!=='right'||x<=.001))mask[f/3]=1;
    }masks[region]=mask;
  }
  const result={positions,faces,vertices,masks};sourceCache.set(person,result);return result;
}
function groupRegions(packet,map,count,role){
  const tags=Array.from({length:count},()=>new Set());let offset=0;
  for(const panel of packet.spec.panels){
    const region=role==='top'?'torso':/^pant_.*_l$/.test(panel.id)?'left':/^pant_.*_r$/.test(panel.id)?'right':'lower';
    for(let i=0;i<panel.uvMm.length;i++)tags[map[offset+i]].add(region);offset+=panel.uvMm.length;
  }
  return tags.map(set=>set.size===1?[...set][0]:role==='top'?'torso':'lower');
}
function nearestBodyRegion(contact,mask,x,y,z){
  // Query the intact BVH with a material-domain predicate. No body face or
  // weight is removed. The original pant_*_l / pant_*_r identity prevents an
  // 8 mm right-leg material edge from switching to the left thigh at x=0.
  const stack=[0],q=new Float64Array(7);let best=Infinity,winner=-1;
  while(stack.length){
    const node=contact.nodes[stack.pop()],b=node.box,dx=Math.max(b[0]-x,0,x-b[3]),dy=Math.max(b[1]-y,0,y-b[4]),dz=Math.max(b[2]-z,0,z-b[5]);
    if(dx*dx+dy*dy+dz*dz>best)continue;
    if(node.left<0){for(let k=node.lo;k<node.hi;k++){const f=contact.tri[k];if(!mask[f/3])continue;closestTriangle(contact.p,contact.faces,f,x,y,z,q);if(q[0]<best){best=q[0];winner=f;}}}
    else{const a=contact.nodes[node.left].box,c=contact.nodes[node.right].box,da=(a[0]+a[3]-2*x)**2+(a[1]+a[4]-2*y)**2+(a[2]+a[5]-2*z)**2,dc=(c[0]+c[3]-2*x)**2+(c[1]+c[4]-2*y)**2+(c[2]+c[5]-2*z)**2;if(da<dc)stack.push(node.right,node.left);else stack.push(node.left,node.right);}
  }return winner;
}

/** Positive compact displacement field from the unchanged source-body vertex
 * correspondences. The 75 mm support scale is inherited from the source
 * ReducedCloth spatial grouping, but this body-shape transfer is a new local
 * adapter. It does not rotate/scale each garment triangle independently.
 */
function transferShape(source,targetPositions,donor,regions){
  const out=new Float64Array(donor.length);let maxMoveM=0,maxSupport=0,minSupport=Infinity;
  for(let i=0;i<regions.length;i++){
    const a=i*3,x=donor[a],y=donor[a+1],z=donor[a+2],ids=source.vertices[regions[i]],P=source.positions;
    let nearest=Infinity;for(const id of ids){const k=id*3,d=(P[k]-x)**2+(P[k+1]-y)**2+(P[k+2]-z)**2;if(d<nearest)nearest=d;}
    const radius=Math.max(.075,Math.sqrt(nearest)*1.25+.000001),r2=radius*radius;let sum=0,dx=0,dy=0,dz=0,support=0;
    for(const id of ids){const k=id*3,d2=(P[k]-x)**2+(P[k+1]-y)**2+(P[k+2]-z)**2;if(d2>=r2)continue;
      const u=Math.sqrt(d2)/radius,w=(1-u)**4*(1+4*u);sum+=w;support++;
      dx+=w*(targetPositions[k]-P[k]);dy+=w*(targetPositions[k+1]-P[k+1]);dz+=w*(targetPositions[k+2]-P[k+2]);
    }
    if(!(sum>0))throw Error('EMPTY_POSITIVE_BODY_SHAPE_SUPPORT');dx/=sum;dy/=sum;dz/=sum;
    out[a]=x+dx;out[a+1]=y+dy;out[a+2]=z+dz;maxMoveM=Math.max(maxMoveM,Math.hypot(dx,dy,dz));maxSupport=Math.max(maxSupport,support);minSupport=Math.min(minSupport,support);
  }return {positions:out,report:{method:'continuous nonnegative native body displacement field',weightsTruncated:false,minimumSupportVertices:minSupport,maximumSupportVertices:maxSupport,maxShapeMoveM:maxMoveM}};
}

function poseReferences(metric,target,source){
  // Source ReducedCloth.reference supplies the fixed triangle/bary/offset and
  // complete-CSR transport. Its neutral query here keeps the original material
  // pants-leg domain; upper-arm armholes and the full spine waistband remain
  // included. A posed foreign hand must never replace this fixed identity.
  const body=target.positions,faces=source.faces,regions=groupRegions(metric.packet,metric.map,metric.count,metric.role),contact=new MeshContact(body,faces);
  const W=target.packet?.weights??target.rig?.weights;if(!W)throw Error('MISSING_COMPLETE_NATIVE_CSR');
  const refs=[],q=new Float64Array(7);let maximumInfluences=0,roundoffBaryClamps=0,maximumBaryRoundoff=0;
  for(let i=0;i<metric.count;i++){
    const k=i*3,P=metric.fittedNative,f=nearestBodyRegion(contact,source.masks[regions[i]],P[k],P[k+1],P[k+2]);
    if(f<0)throw Error('MISSING_PAIRED_BODY_REFERENCE');closestTriangle(body,faces,f,P[k],P[k+1],P[k+2],q);
    const ids=Array.from(faces.subarray(f,f+3)),bary=Array.from(q.subarray(4,7)),offset=[P[k]-q[1],P[k+1]-q[2],P[k+2]-q[3]],weights=new Map();
    // Source closestTriangle can return -5.55e-17 for 1-b-c at an edge.
    // Correct only floating roundoff in geometric barycentrics; native CSR
    // values and every nonzero contributing influence remain untouched.
    if(bary.some(v=>v<0||v>1)){
      if(bary.some(v=>v< -1e-12||v>1+1e-12))throw Error('INVALID_SOURCE_TRIANGLE_BARYCENTRICS');
      for(let j=0;j<3;j++){const v=Math.max(0,Math.min(1,bary[j]));maximumBaryRoundoff=Math.max(maximumBaryRoundoff,Math.abs(v-bary[j]));bary[j]=v;}
      const total=bary.reduce((a,b)=>a+b,0);for(let j=0;j<3;j++)bary[j]/=total;roundoffBaryClamps++;
    }
    for(let j=0;j<3;j++)for(let n=W.ptr[ids[j]];n<W.ptr[ids[j]+1];n++){
      const w=W.values[n]*bary[j];if(w<0)throw Error('NEGATIVE_NATIVE_REFERENCE_WEIGHT '+JSON.stringify({w,bary,sourceWeight:W.values[n],group:i}));if(w===0)continue;
      weights.set(W.joints[n],(weights.get(W.joints[n])??0)+w);
    }
    const sum=[...weights.values()].reduce((a,b)=>a+b,0);if(Math.abs(sum-1)>1e-4)throw Error('INCOMPLETE_NATIVE_REFERENCE_CSR');
    refs.push({ids,bary,offset,weights:[...weights].flat(),face:f,region:regions[i]});maximumInfluences=Math.max(maximumInfluences,weights.size);
  }
  const field=compileContinuousGarmentReference(metric,target,source,regions);
  // Restore the source's separate contract for the declared fixed waistband
  // sites. Their original triangle/bary/local-frame offset is carried by the
  // actual posed body. The continuous field still transports all other sites;
  // no new pin, body deformation or garment-wide triangle mapping is added.
  const waistWorld=metric.role==='bottom'&&metric.sourcePins.length?{
    solvers:[null,{p:metric.fittedNative.slice(),pins:Array.from(metric.sourcePins)}],
    body:contact,actor:{positions:body}
  }:null;
  const waist=waistWorld?new WaistAttachments(waistWorld):null;
  const waistAttachment=waist?{method:'unchanged original WaistAttachments fixed body triangle + barycentric point + local basis offset',sourceSHA256:'bf63216f946e834ace38ccd2118f822de52bab3045d757d49b79a140e9269bd6',originalPins:waist.rows.length,additionalPins:0}:null;
  return {refs,regions,maximumInfluences,roundoffBaryClamps,maximumBaryRoundoff,field,waistAttachment,
    sample(posedBody,skinMatrices,out=new Float64Array(metric.count*3),normals=new Float64Array(metric.count*3)){
      field.sample(posedBody,skinMatrices,out);
      if(waist){waistWorld.actor.positions=posedBody;waistWorld.solvers[1].p=out;waist.begin();waist.apply(1);}
      for(let i=0;i<refs.length;i++){
        const r=refs[i],k=i*3,n=nativeFaceNormal(posedBody,faces,r.face);normals.set(n,k);
      }return {positions:out,normals};
    }
  };
}

export async function createWholeGarmentBinding({sourcePerson,targetBody,packet,role='top',family='denim',neutralEvidence=null}){
  const source=sourceField(sourcePerson),target=targetBody;
  if(target.bodyCount!==source.positions.length/3||target.faces.length!==source.faces.length||target.faces.some((v,i)=>v!==source.faces[i]))throw Error('NATIVE_BODY_CORRESPONDENCE_CHANGED');
  const donor=originalGarmentNative(packet),donorMetric=createGarmentMetric(packet,donor,{role,family}),regions=groupRegions(packet,donorMetric.map,donorMetric.count,role),transfer=transferShape(source,target.positions,donorMetric.fittedNative,regions);
  const fittedDisplay=expandGarmentDisplay(donorMetric,transfer.positions),metric=await createGarmentSolverMetric(packet,fittedDisplay,{role,family,neutralEvidence}),reference=poseReferences(metric,target,source),contact=new NativeGarmentContact(target.positions,source.faces);
  return {metric,reference,source,target,contact,role,packet,neutralDisplay:expandGarmentDisplay(metric,metric.fittedNative),
    report:{...transfer.report,method:transfer.report.method+'; continuous full CSR offset transport',referenceField:reference.field.report,
      sourceVertices:donor.length/3,sourceTriangles:packet.spec.panels.reduce((n,p)=>n+p.triangles.length,0),indexSequenceRetained:true,sourcePaperUVRetained:true,
      weightsTruncated:false,maximumReferenceInfluences:Math.max(reference.maximumInfluences,reference.field.report.maximumBones),geometricBarycentricRoundoff:{count:reference.roundoffBaryClamps,maximum:reference.maximumBaryRoundoff},bodyGeometryChanged:false,internalRefinement:metric.internalRefinement,neutralAccepted:false,visualAccepted:false},
    eligibleFaces:source.masks[role==='top'?'torso':'lower'],
    sample(posedBody,skinMatrices){contact.refit(posedBody);return reference.sample(posedBody,skinMatrices);}
  };
}

/** Freeze a separately evidenced, neutral wearer shape before any action.
 * Reuse the already-refined source solver topology: refining again would
 * re-average curved seam sites from linear display edges. Complete original
 * display indices and the explicit display-to-solver map stay unchanged.
 * Source flat-paper lengths remain immutable; only wearer rest is captured.
 */
export function captureNeutralWearerRest(binding,sewnNative,neutralEvidence){
  const old=binding.metric;
  if(sewnNative.length!==old.count*3||!Array.from(sewnNative).every(Number.isFinite))throw Error('INVALID_NEUTRAL_WEARER_REST');
  for(let i=0;i<binding.target.positions.length;i++)if(binding.contact.mesh.p[i]!==binding.target.positions[i])throw Error('CANNOT_CAPTURE_POSED_BODY_AS_NEUTRAL_REST');
  const contactAudit=auditGarmentBody(binding,sewnNative);
  if(contactAudit.inside!==0)throw Error('NEUTRAL_WEARER_REST_INSIDE_BODY');
  const internalNative=new Float64Array(old.map.length*3);
  for(let i=0;i<old.map.length;i++)internalNative.set(sewnNative.subarray(old.map[i]*3,old.map[i]*3+3),i*3);
  const metric=createGarmentMetric(old.packet,internalNative,{role:old.role,family:old.family,doubleLayer:old.doubleLayer,neutralEvidence});
  for(let i=0;i<old.map.length;i++)if(old.map[i]!==metric.map[i])throw Error('FROZEN_REST_SEWN_MAP_CHANGED');
  for(let i=0;i<old.sourceEdges.length;i++)if(old.sourceEdges[i].paperRest!==metric.sourceEdges[i].paperRest)throw Error('FROZEN_REST_CHANGED_SOURCE_PAPER');
  for(const key of ['displayPacket','displayVertexCount','displayToSolver','displayToInternalVertex','internalRefinement'])metric[key]=old[key];
  let maximumSeamReaverageM=0;for(let i=0;i<old.count;i++)maximumSeamReaverageM=Math.max(maximumSeamReaverageM,Math.hypot(...[0,1,2].map(k=>metric.fittedNative[i*3+k]-sewnNative[i*3+k])));
  const reference=poseReferences(metric,binding.target,binding.source),contact=binding.contact;
  return {...binding,metric,reference,neutralDisplay:expandGarmentDisplay(metric,metric.fittedNative),
    report:{...binding.report,neutralRestCaptured:true,neutralContactAudit:contactAudit,neutralEvidence,maximumSeamReaverageM,referenceField:reference.field.report,sourcePaperMetricCertified:false,visualAccepted:false},
    sample(posedBody,skinMatrices){contact.refit(posedBody);return reference.sample(posedBody,skinMatrices);}
  };
}

export function originalContactSamples(metric){
  const packet=metric.displayPacket??metric.packet,map=metric.displayToSolver??metric.map,samples=[],seenEdges=new Set();
  for(let i=0;i<metric.count;i++)samples.push({kind:'vertex',ids:[i],weights:[1]});
  let off=0,face=0;for(const panel of packet.spec.panels){
    for(const tri of panel.triangles){const ids=tri.map(i=>map[off+i]);
      samples.push({kind:'triangle',sourceFace:face,ids,weights:[1/3,1/3,1/3]});
      for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?a+','+b:b+','+a;if(!seenEdges.has(key)){seenEdges.add(key);samples.push({kind:'edge',ids:[a,b],weights:[.5,.5]});}}face++;
    }off+=panel.uvMm.length;
  }return samples;
}
export function auditGarmentBody(binding,sewnNative,{margin=.004}={}){
  const samples=originalContactSamples(binding.metric),byKind={},worst=[];let inside=0,minimumOutside=Infinity,clearanceDeficits=0;
  for(let i=0;i<samples.length;i++){
    const s=samples[i],p=[0,0,0];for(let j=0;j<s.ids.length;j++)for(let k=0;k<3;k++)p[k]+=sewnNative[s.ids[j]*3+k]*s.weights[j];
    const q=binding.contact.inspect(...p),row=byKind[s.kind]??(byKind[s.kind]={count:0,inside:0,positiveBelowMargin:0});row.count++;
    if(q.inside){inside++;row.inside++;worst.push({...s,point:p,...q});}
    else{minimumOutside=Math.min(minimumOutside,q.distance);if(q.distance<margin-1e-10){clearanceDeficits++;row.positiveBelowMargin++;}}
  }
  worst.sort((a,b)=>b.distance-a.distance);
  return {samples:samples.length,byKind,inside,clearanceDeficits,minimumOutsideM:minimumOutside,worstInside:worst.slice(0,12),
    marginM:margin,fullBody:true,triangleSamplesRetained:true,positiveBelowMarginIsNotPenetration:true,continuousCollisionCertified:false};
}
