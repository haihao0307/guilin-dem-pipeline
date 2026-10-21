/** Complete source material constraints and a separately frozen wearer metric.
 *
 * This is a local kinematic-pose adaptation. The source flat-paper metric is
 * never overwritten in the descriptor. Capturing a neutral shape does not
 * certify that shape, body contact, or material strain. No motion or renderer
 * is imported here, and this module does not change the source packet.
 */
import {ClothSolver as SourceDescriptor, dihedral} from '../vendor/appearance/cloth-r10/cloth-physics.mjs';
import {ClothSolver as SourceClothSolver} from '../vendor/appearance/cloth-r10/material-physics.mjs';
import {unmatchedSewnSites,refineSewnBoundaries} from '../vendor/appearance/cloth-r10/seam-refinement.mjs';

export const GARMENT_METRIC_SOURCE=Object.freeze({
  commit:'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49',
  clothPhysicsSHA256:'ffe3fee9a82f75b28703273800dec2542a966b7003672bfdf58b8ef667643298',
  materialPhysicsSHA256:'5b040b89a14808f904ce4488e2e9d74835e8afaa0ba53836db4a64bf67cbd099',
  reducedClothSHA256:'a851fdee4a269c05e6cd0d8efd3479d9985a557247659235b67d6646940cf4e2'
});

function finiteArray(value,length,label){
  if(value.length!==length)throw Error(label+'_SIZE');
  for(let i=0;i<length;i++)if(!Number.isFinite(value[i]))throw Error(label+'_NOT_FINITE_'+i);
}
const lengthOf=(p,a,b)=>Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]);
const angularDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function nativeToClothCoordinates(native,out=new Float64Array(native.length)){
  for(let i=0;i<native.length;i+=3){out[i]=native[i];out[i+1]=native[i+2];out[i+2]=-native[i+1];}return out;
}
export function clothToNativeCoordinates(cloth,out=new Float64Array(cloth.length)){
  for(let i=0;i<cloth.length;i+=3){out[i]=cloth[i];out[i+1]=-cloth[i+2];out[i+2]=cloth[i+1];}return out;
}

/** Preserve source edge and bend provenance, including repeated constraints
 * on the same sewn endpoint pair when they originate in different panels.
 * This mirrors constructor traversal only; the equality checks below bind it
 * to the untouched source constructor rather than assuming equivalence.
 */
function constraintProvenance(packet,solver){
  const edges=[],bends=[],pending=new Map();let offset=0,sourceTriangle=0;
  for(let panelIndex=0;panelIndex<packet.spec.panels.length;panelIndex++){
    const panel=packet.spec.panels[panelIndex],seen=new Set();
    for(let localTriangle=0;localTriangle<panel.triangles.length;localTriangle++,sourceTriangle++){
      const tri=panel.triangles[localTriangle],ids=tri.map(i=>solver.map[offset+i]);
      if(new Set(ids).size<3)continue;
      for(let k=0;k<3;k++){
        const localA=tri[k],localB=tri[(k+1)%3],a=ids[k],b=ids[(k+1)%3],c=ids[(k+2)%3],key=a<b?a+','+b:b+','+a;
        if(!seen.has(key)){
          seen.add(key);edges.push({panelId:panel.id,panelIndex,localVertices:[localA,localB],sourceVertices:[offset+localA,offset+localB],sourceTriangle,a,b});
        }
        const prior=pending.get(key);
        if(prior){if(prior.c!==c)bends.push({a:prior.a,b:prior.b,c:prior.c,d:c,sourceTriangles:[prior.sourceTriangle,sourceTriangle],sourcePanels:[prior.panelId,panel.id]});}
        else pending.set(key,{a,b,c,sourceTriangle,panelId:panel.id});
      }
    }
    offset+=panel.uvMm.length;
  }
  if(edges.length!==solver.edges.length||bends.length!==solver.bends.length)throw Error('SOURCE_CONSTRAINT_COUNT_MISMATCH');
  for(let i=0;i<edges.length;i++)for(const k of ['a','b'])if(edges[i][k]!==solver.edges[i][k])throw Error('SOURCE_EDGE_ORDER_MISMATCH_'+i);
  for(let i=0;i<bends.length;i++)for(const k of ['a','b','c','d'])if(bends[i][k]!==solver.bends[i][k])throw Error('SOURCE_BEND_ORDER_MISMATCH_'+i);
  return {edges,bends};
}

/** Read the complete original constraint graph and freeze a distinct neutral
 * wearer metric. `neutralFittedNative` must be the original full material
 * vertex order, in metres and native Z-up, before any tested action/contact.
 *
 * BaseClothSolver is used ONLY to read its original constructor descriptors.
 * No source step is called, and sparse seams remain a reported block for the
 * stabilized source solver. Its stricter constructor is never bypassed below.
 */
export function createGarmentMetric(packet,neutralFittedNative,{role='top',family='denim',doubleLayer=false,neutralEvidence=null}={}){
  const vertexCount=packet.spec.panels.reduce((n,p)=>n+p.uvMm.length,0);
  finiteArray(neutralFittedNative,vertexCount*3,'NEUTRAL_WEARER');
  const inputNative=Float64Array.from(neutralFittedNative),inputCloth=nativeToClothCoordinates(inputNative),
    source=new SourceDescriptor(packet,inputCloth,{family,doubleLayer,role,sdf:null,clearanceMM:4}),
    provenance=constraintProvenance(packet,source),unmatched=unmatchedSewnSites(packet),
    fittedCloth=source.p.slice(),fittedNative=clothToNativeCoordinates(fittedCloth),scratch=new Float64Array(13),
    wearerEdges=Float64Array.from(source.edges,e=>lengthOf(fittedCloth,e.a,e.b)),
    wearerBends=Float64Array.from(source.bends,b=>dihedral(fittedCloth,b.a,b.b,b.c,b.d,scratch)[0]);
  let seamAveragingMaxM=0;
  for(let i=0;i<source.map.length;i++){
    const g=source.map[i];seamAveragingMaxM=Math.max(seamAveragingMaxM,Math.hypot(...[0,1,2].map(k=>inputNative[i*3+k]-fittedNative[g*3+k])));
  }
  const sourceEdges=source.edges.map((e,i)=>{
    const origin=provenance.edges[i],uv=packet.sourceTemplate?.panelsUV?.[origin.panelIndex],a=uv?.[origin.localVertices[0]],b=uv?.[origin.localVertices[1]];
    return {...origin,paperRest:e.rest,ungradedSourcePaperRest:a&&b?Math.hypot(a[0]-b[0],a[1]-b[1])*.001:null};
  }),
    sourceBends=source.bends.map((b,i)=>({...provenance.bends[i],paperRest:b.rest}));
  const byPair=new Map();let repeatedEndpointConstraints=0;
  for(const e of sourceEdges){const key=e.a<e.b?e.a+','+e.b:e.b+','+e.a;if(byPair.has(key))repeatedEndpointConstraints++;else byPair.set(key,true);}
  const degenerateWearerEdges=[];for(let i=0;i<wearerEdges.length;i++)if(wearerEdges[i]<=1e-12)degenerateWearerEdges.push(i);
  return {
    schema:'native-wearer-material-metric/1',packet,role,family,doubleLayer,source:GARMENT_METRIC_SOURCE,
    vertexCount,count:source.count,map:source.map.slice(),faces:source.faces.slice(),
    mass:source.mass.slice(),inverseMass:source.w.slice(),sourcePins:Int32Array.from(source.pins),
    seamPairs:source.seamPairs.map(p=>p.slice()),surfaceEdges:source.surfaceEdges.map(e=>e.slice()),
    sourceEdges,sourceBends,wearerEdges,wearerBends,
    inputNative,fittedNative,fittedCloth,neutralEvidence,
    completeness:{unmatchedSewnSites:unmatched,sourceStabilizedSolverEligible:unmatched.length===0,sourceConstructorOnly:true,
      repeatedEndpointConstraints,degenerateWearerEdges,seamAveragingMaxM,
      allOriginalVerticesRetained:true,allOriginalTrianglesRetained:true,sourcePaperDataModified:false,
      constraintOrderVerifiedAgainstOriginalConstructor:true},
    certification:{neutralWearerAccepted:false,paperMetricCertified:false,contactCertified:false,visualAccepted:false}
  };
}

/** The original source refiner may add INTERNAL solver sites on existing
 * material edges. Display indices, UVs, triangles and source packet remain
 * untouched. Every original display vertex has an explicit lossless map to
 * its unchanged local vertex in the refined panel, then to the source sewn
 * solver site. No new visual patch or replacement mesh is generated.
 */
export async function createGarmentSolverMetric(packet,neutralFittedNative,options={}){
  const displayVertexCount=packet.spec.panels.reduce((n,p)=>n+p.uvMm.length,0);
  finiteArray(neutralFittedNative,displayVertexCount*3,'NEUTRAL_DISPLAY');
  const missing=unmatchedSewnSites(packet),groundShift=options.sourceGroundShiftM??.9858653545379639;
  let internalPacket=packet,internalNative=Float64Array.from(neutralFittedNative);
  if(missing.length){
    const fittedPacket=structuredClone(packet);
    fittedPacket.record.positionsMm=Array.from({length:displayVertexCount},(_,i)=>[
      neutralFittedNative[i*3]*1000,(neutralFittedNative[i*3+2]+groundShift)*1000,-neutralFittedNative[i*3+1]*1000
    ]);
    internalPacket=await refineSewnBoundaries(fittedPacket);
    internalNative=Float64Array.from(internalPacket.record.positionsMm.flatMap(p=>[p[0]*.001,-p[2]*.001,p[1]*.001-groundShift]));
  }
  const metric=createGarmentMetric(internalPacket,internalNative,options),offsets=new Map();let offset=0;
  for(const panel of internalPacket.spec.panels){offsets.set(panel.id,{offset,panel});offset+=panel.uvMm.length;}
  const displayToSolver=new Int32Array(displayVertexCount),displayToInternalVertex=new Int32Array(displayVertexCount);let displayOffset=0,maxRoundtripM=0;
  for(const panel of packet.spec.panels){
    const entry=offsets.get(panel.id);if(!entry||entry.panel.uvMm.length<panel.uvMm.length)throw Error('REFINER_LOST_ORIGINAL_PANEL_VERTEX');
    for(let i=0;i<panel.uvMm.length;i++){
      if(panel.uvMm[i][0]!==entry.panel.uvMm[i][0]||panel.uvMm[i][1]!==entry.panel.uvMm[i][1])throw Error('REFINER_CHANGED_ORIGINAL_DISPLAY_UV');
      const source=displayOffset+i,internal=entry.offset+i;displayToInternalVertex[source]=internal;displayToSolver[source]=metric.map[internal];
      maxRoundtripM=Math.max(maxRoundtripM,Math.hypot(...[0,1,2].map(k=>internalNative[internal*3+k]-neutralFittedNative[source*3+k])));
    }
    displayOffset+=panel.uvMm.length;
  }
  metric.displayPacket=packet;metric.displayVertexCount=displayVertexCount;metric.displayToSolver=displayToSolver;metric.displayToInternalVertex=displayToInternalVertex;
  metric.internalRefinement={sourceOperation:'refineSewnBoundaries',used:missing.length>0,
    sourceUnmatchedSites:missing,sourceProof:internalPacket.record.meshRefinement??null,
    displayVertexCount,internalVertexCount:metric.vertexCount,internalAddedVertices:metric.vertexCount-displayVertexCount,
    originalDisplayIndexSequenceRetained:true,originalDisplayUVRetained:true,originalDisplayTrianglesRetained:true,
    sourcePacketModified:false,maxOriginalPositionRoundtripM:maxRoundtripM};
  return metric;
}

export function expandGarmentDisplay(metric,sewnNative,out=new Float64Array((metric.displayVertexCount??metric.vertexCount)*3)){
  finiteArray(sewnNative,metric.count*3,'SEWN_DISPLAY_SOURCE');
  const map=metric.displayToSolver??metric.map;finiteArray(out,map.length*3,'DISPLAY_OUTPUT');
  for(let i=0;i<map.length;i++)for(let k=0;k<3;k++)out[i*3+k]=sewnNative[map[i]*3+k];return out;
}

/** Instantiate the unchanged stabilized source solver only when its original
 * seam contract is satisfied. Separately copy the frozen wearer metric into
 * runtime constraints; immutable source-paper values stay in `metric`.
 * The returned solver is intentionally NOT described as original-paper cloth.
 */
export function createWearerRestSolver(metric,{bend=1,softness=1,damping=7}={}){
  if(!metric.completeness.sourceStabilizedSolverEligible)throw Error('SOURCE_SEAM_CONTRACT_UNSATISFIED');
  if(metric.completeness.degenerateWearerEdges.length)throw Error('DEGENERATE_NEUTRAL_WEARER_EDGE');
  const solver=new SourceClothSolver(metric.packet,nativeToClothCoordinates(metric.inputNative),{
    family:metric.family,doubleLayer:metric.doubleLayer,role:metric.role,sdf:null,
    clearanceMM:4,bend,softness,damping,gravity:0,deferContactInitialization:true
  });
  if(solver.map.length!==metric.map.length||solver.edges.length!==metric.sourceEdges.length||solver.bends.length!==metric.sourceBends.length)throw Error('SOURCE_SOLVER_DESCRIPTOR_MISMATCH');
  for(let i=0;i<metric.map.length;i++)if(solver.map[i]!==metric.map[i])throw Error('SOURCE_SEWN_MAP_CHANGED');
  for(let i=0;i<solver.edges.length;i++){
    const e=solver.edges[i],s=metric.sourceEdges[i];if(e.a!==s.a||e.b!==s.b||e.rest!==s.paperRest)throw Error('SOURCE_EDGE_DESCRIPTOR_CHANGED');
    e.rest=metric.wearerEdges[i];
  }
  for(let i=0;i<solver.bends.length;i++){
    const b=solver.bends[i],s=metric.sourceBends[i];if(['a','b','c','d'].some(k=>b[k]!==s[k])||b.rest!==s.paperRest)throw Error('SOURCE_BEND_DESCRIPTOR_CHANGED');
    b.rest=metric.wearerBends[i];
  }
  solver.wearerMetric=metric;
  return solver;
}

/** Original ReducedCloth positive reference stiffness, evaluated on every
 * complete sewn site for this explicit full-material local adaptation.
 * No negative interpolation or opposite-leg averaging is introduced here.
 * It is a location constraint; distance/dihedral alone have rigid null modes.
 */
export function createPositiveReferenceAttachments(metric){
  const p=metric.fittedCloth,n=metric.count,weight=new Float64Array(n),omegaSquared=new Float64Array(n),compliance=new Float64Array(n),
    familyFactor=metric.family==='leather'?1.6:metric.family==='denim'?1.2:1;
  let ymin=Infinity,ymax=-Infinity;for(let i=1;i<p.length;i+=3){ymin=Math.min(ymin,p[i]);ymax=Math.max(ymax,p[i]);}
  for(let i=0;i<n;i++){
    const x=Math.abs(p[i*3]),y=p[i*3+1],t=Math.max(0,Math.min(1,(y-ymin)/(ymax-ymin||1)));let w=metric.role==='top'?Math.pow(1-t,1.4):Math.pow(1-t,1.1);
    if(metric.role==='top'&&x>.30)w=Math.max(w,.75);
    if(metric.role==='top'&&x>.13&&x<.28&&y>.25&&y<.46)w=Math.min(w,.12);
    if(metric.role==='bottom'&&x<.075&&y>-.28)w=Math.min(w,.1);
    if(t>.9)w=0;
    weight[i]=w;omegaSquared[i]=familyFactor*(130+2200*(1-w)**2);
    compliance[i]=1/(Math.max(1e-7,metric.mass[i])*omegaSquared[i]);
  }
  return {weight,omegaSquared,compliance,
    method:'source ReducedCloth positive reference stiffness sampled at all original sewn material sites',
    adaptation:'full material reference attachment; not the source reduced runtime or original paper XPBD'};
}

export function auditGarmentMetric(metric,sewnNative,{referenceNative=null}={}){
  finiteArray(sewnNative,metric.count*3,'POSED_SEWN');
  const p=nativeToClothCoordinates(sewnNative),q=new Float64Array(13);let minWearer=Infinity,maxWearer=0,maxPaper=0,maxReferenceMoveM=0,maxBendDifferenceRad=0,maxEdge=-1;
  for(let i=0;i<metric.sourceEdges.length;i++){
    const e=metric.sourceEdges[i],length=lengthOf(p,e.a,e.b),ratio=length/metric.wearerEdges[i];
    minWearer=Math.min(minWearer,ratio);if(ratio>maxWearer){maxWearer=ratio;maxEdge=i;}maxPaper=Math.max(maxPaper,length/e.paperRest);
  }
  for(let i=0;i<metric.sourceBends.length;i++){const b=metric.sourceBends[i],angle=dihedral(p,b.a,b.b,b.c,b.d,q)[0];maxBendDifferenceRad=Math.max(maxBendDifferenceRad,Math.abs(angularDifference(angle,metric.wearerBends[i])));}
  if(referenceNative){finiteArray(referenceNative,p.length,'POSED_REFERENCE');for(let i=0;i<metric.count;i++)maxReferenceMoveM=Math.max(maxReferenceMoveM,Math.hypot(...[0,1,2].map(k=>sewnNative[i*3+k]-referenceNative[i*3+k])));}
  return {restMetric:'frozen neutral wearer; original flat-paper ratios reported separately',
    sourceEdges:metric.sourceEdges.length,sourceBends:metric.sourceBends.length,minWearerEdgeRatio:minWearer,maxWearerEdgeRatio:maxWearer,maxPaperEdgeRatio:maxPaper,
    maxWearerEdgeIndex:maxEdge,maxWearerEdge:maxEdge<0?null:metric.sourceEdges[maxEdge],maxBendDifferenceRad,maxReferenceMoveM,
    paperMetricCertified:false,contactCertified:false,visualAccepted:false};
}
