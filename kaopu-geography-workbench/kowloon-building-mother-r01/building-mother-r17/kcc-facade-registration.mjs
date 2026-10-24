/** Horizontal KCC registration candidates, not surveyed/as-built placement.
 * Source shell is never mutated. 5–17/F and 18–26/F are fitted independently.
 * The 20-point outline generalizes terminal bays/chamfers only to compare to
 * the coarse source shell. R0 is the best all-outline fit, NOT proven north.
 * A concave-corner-only fit reverses/ties the ranking. Always expose R180 too.
 * A window endpoint is projected to its named source wall and bounded by that
 * finite wall. The projection and any endpoint clipping are explicit outputs.
 * This module assigns no vertical elevations, sill/head, or window mechanism.
 */
import {KCC_OBSERVED_WINDOW_FAMILIES} from './kcc-observed-windows.mjs';
import {observedFloor} from './kcc-observed-layout.mjs';

export const KCC_REGISTRATION_BUILDING_ID='B359971994401063C0';
const lowerOriginal20=[[425,934],[1073,934],[1073,425],[1545,425],[1545,934],[1664,934],[1664,425],[2133,425],[2133,934],[2785,934],[2785,1407],[2130,1407],[2130,1989],[1660,1989],[1660,1407],[1545,1407],[1545,1989],[1074,1989],[1074,1407],[425,1407]];
export const KCC_GENERALIZED_PLAN_OUTLINES=Object.freeze({
 lower:lowerOriginal20.map(p=>[p[0]*1414/3308,p[1]*1000/2339]),
 upper:[[169,423],[447,423],[447,206],[646,206],[646,423],[698,423],[698,206],[897,206],[897,423],[1176,423],[1176,621],[897,621],[897,870],[698,870],[698,621],[646,621],[646,870],[447,870],[447,621],[169,621]]
});
const CONCAVE=[1,4,5,8,11,14,15,18];
// Indices address this SCORE roof ring. The older official-footprint ledger
// starts its 20-point list five vertices earlier and must not be copied here.
const SOURCE_INDICES={R0:[8,7,6,5,4,3,2,1,0,19,18,17,16,15,14,13,12,11,10,9],R180:[18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,19]};
const WINDOW_HOSTS={R0:{A:'p003',B:'p005',C:'p018',D:'p016',E:'p010',F:'p013'},R180:{A:'p016',B:'p010',C:'p013',D:'p003',E:'p005',F:'p018'}};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),mean=p=>p.reduce((s,q)=>s.map((v,i)=>v+q[i]/p.length),[0,0]);
const mapPoint=(p,t)=>[p[0]*t.matrixRow[0][0]+p[1]*t.matrixRow[1][0]+t.translationXZ[0],p[0]*t.matrixRow[0][1]+p[1]*t.matrixRow[1][1]+t.translationXZ[1]];
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)/2);
function fit(p,q){
 const pc=mean(p),qc=mean(q);let a=0,b=0,den=0;
 for(let i=0;i<p.length;i++){const x=sub(p[i],pc),y=sub(q[i],qc);a+=dot(x,y);b+=x[0]*y[1]-x[1]*y[0];den+=dot(x,x);}
 if(den<1e-9)throw Error('Degenerate registration controls');
 const c=a/den,s=b/den,matrixRow=[[c,s],[-s,c]],translationXZ=[qc[0]-pc[0]*c+pc[1]*s,qc[1]-pc[0]*s-pc[1]*c],t={matrixRow,translationXZ,scaleMPerViewPixel:Math.hypot(c,s),rotationDegrees:Math.atan2(s,c)*180/Math.PI,determinant:1};
 const residuals=p.map((v,i)=>Math.hypot(...sub(mapPoint(v,t),q[i])));
 return{transform:t,residual:{rmsM:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/p.length),maxM:Math.max(...residuals),controlCount:p.length,residualsM:residuals}};
}
function sourceRing(source){
 const p=source.patches.find(p=>p.sourcePatchId==='p000');if(!p||p.loops[0].length!==20||p.sourceKind!=='roofPlane')throw Error('Expected verified KCC 20-point source roof boundary');
 return p.loops[0].map(q=>[p.origin[0]+p.u[0]*q[0]+p.v[0]*q[1],p.origin[2]+p.u[2]*q[0]+p.v[2]*q[1]]);
}
function project(patch,segment,transform){
 const mapped=segment.map(p=>mapPoint(p,transform)),points=mapped.map(p=>[p[0],0,p[1]]),along=points.map(p=>dot(sub(p,patch.origin),patch.u)),offsets=points.map(p=>dot(sub(p,patch.origin),patch.n)),uv=patch.loops.flat().map(p=>p[0]),minU=Math.min(...uv),maxU=Math.max(...uv),rawStartU=Math.min(...along),rawEndU=Math.max(...along),startU=Math.max(minU,rawStartU),endU=Math.min(maxU,rawEndU),d=sub(points[1],points[0]),angleDeg=Math.acos(Math.min(1,Math.abs(dot(d,patch.u))/Math.hypot(...d)))*180/Math.PI;
 return{sourcePatchId:patch.sourcePatchId,startU,endU,rawStartU,rawEndU,hostURange:[minU,maxU],mappedXZ:mapped,projectionResidualM:Math.sqrt(offsets.reduce((s,v)=>s+v*v,0)/offsets.length),signedOffsetsM:offsets,angleDeg,endpointClippedM:Math.max(0,startU-rawStartU,rawEndU-endU),endpointPolicy:'project_to_named_source_plane_then_clip_to_finite_source_wall_not_measured_endpoint',projectedXZ:along.map(u=>[patch.origin[0]+patch.u[0]*u,patch.origin[2]+patch.u[2]*u]),sourcePlaneOrigin:structuredClone(patch.origin),sourcePlaneU:structuredClone(patch.u),sourcePlaneNormal:structuredClone(patch.n),usable:endU>startU&&angleDeg<8};
}
function sourceEdgeId(source,a,b){
 let best=null;
 for(const p of source.patches.filter(p=>p.sourceKind==='wallStrip')){const v=p.loops.flat().map(q=>q[0]),lo=Math.min(...v),hi=Math.max(...v),ends=[lo,hi].map(u=>[p.origin[0]+p.u[0]*u,p.origin[2]+p.u[2]*u]),e=Math.min(Math.hypot(...sub(a,ends[0]))+Math.hypot(...sub(b,ends[1])),Math.hypot(...sub(a,ends[1]))+Math.hypot(...sub(b,ends[0])));if(!best||e<best.error)best={id:p.sourcePatchId,error:e};}
 if(!best||best.error>1e-5)throw Error('Generalized plan edge did not match a source wall');return best.id;
}
export function deriveKccFacadeRegistration(source){
 if(source?.sourceModelId!==KCC_REGISTRATION_BUILDING_ID||source.coordinateSystem!=='source_local_east_up_south_metres')throw Error('Expected untransformed local KCC source model');
 const ring=sourceRing(source),candidates=[];
 for(const id of ['R0','R180']){
  const indices=SOURCE_INDICES[id],target=indices.map(i=>ring[i]),candidate={id,status:'inferred_shape_registration_candidate_not_as_built',transform:{},residual:{},windowsByFamily:{},generalizedEdges:indices.map((n,i)=>({planEdgeIndex:i,sourcePatchId:sourceEdgeId(source,ring[n],ring[indices[(i+1)%indices.length]])})),unitWallEdgesByFamily:{}};
  for(const family of ['lower','upper']){
   const p=KCC_GENERALIZED_PLAN_OUTLINES[family],full=fit(p,target),corner=fit(CONCAVE.map(i=>p[i]),CONCAVE.map(i=>target[i]));
   if(full.residual.rmsM>.9)throw Error('KCC source ring order/shape no longer matches reviewed registration candidates');
   const edgeLengthResidualsM=p.map((v,i)=>Math.hypot(...sub(p[(i+1)%20],v))*full.transform.scaleMPerViewPixel-Math.hypot(...sub(target[(i+1)%20],target[i])));
   candidate.transform[family]=full.transform;candidate.residual[family]={...full.residual,areaRatio:area(p.map(v=>mapPoint(v,full.transform)))/area(ring),edgeLengthRmsM:Math.sqrt(edgeLengthResidualsM.reduce((s,v)=>s+v*v,0)/20),edgeLengthMaxAbsM:Math.max(...edgeLengthResidualsM.map(Math.abs)),edgeLengthResidualsM,concaveOnlyFit:{...corner.residual,transform:corner.transform},manualTraceUncertaintyViewPixels:3,actualSourceAccuracyM:null};
   candidate.windowsByFamily[family]=KCC_OBSERVED_WINDOW_FAMILIES[family].windows.map(w=>{const patch=source.patches.find(p=>p.sourcePatchId===WINDOW_HOSTS[id][w.unit]);if(!patch)throw Error('Missing KCC source host');return{observationId:w.id,unit:w.unit,hostWallId:w.hostWallId,sourceSegment:structuredClone(w.sourceSegment),sourceUrl:KCC_OBSERVED_WINDOW_FAMILIES[family].sourceUrl,...project(patch,w.hostProjectedSegment,full.transform),projectionSensitivity:project(patch,w.hostProjectedSegment,corner.transform),actualVerticalRangeM:null,actualWidthM:null,geometryEvidence:'observed_plan_interval_plus_explicit_shape_registration_and_projection_inference'};});
   const layout=observedFloor(family==='lower'?5:18),units=layout.nodes.filter(n=>n.type==='dwelling');
   candidate.unitWallEdgesByFamily[family]=units.flatMap(unit=>unit.polygon.map((a,i)=>{const b=unit.polygon[(i+1)%unit.polygon.length],proposals=source.patches.filter(p=>p.sourceKind==='wallStrip').map(p=>project(p,[a,b],full.transform)).filter(p=>p.angleDeg<8).sort((a,b)=>(a.projectionResidualM+a.endpointClippedM)-(b.projectionResidualM+b.endpointClippedM)),best=proposals[0]??null;return{hostWallId:`unit:${unit.label}:edge-${i}`,planSegment:[a,b],...(best??{}),acceptedAsCoarseBoundaryProjection:!!best&&best.usable&&best.projectionResidualM<=.85&&best.endpointClippedM<=.15,reason:!best?'Bay chamfer has no parallel coarse source wall':best.projectionResidualM>.85||best.endpointClippedM>.15?'Interior/partial/bay edge does not agree with finite coarse source host':'Coarse shell correspondence only; not an as-built wall assertion'};}));
  }
  candidates.push(candidate);
 }
 return{schema:'kaopu.kcc-facade-registration/1',buildingId:KCC_REGISTRATION_BUILDING_ID,coordinateSpace:'source_local_east_up_south_metres',defaultCandidateId:'R0',defaultReason:'Lowest all20 generalized-outline residual, not independently verified orientation',candidates,orientationVerified:false,actualFFLVerified:false,verticalGeometryAssigned:false,sourceGeometryChanged:false,actualWindowDimensionsVerified:false,reflectionAllowed:false,ambiguity:'R0 and R180 both survive. Concave-only lower fit prefers R180; upper concave fits tie. Never infer true flat/cardinal orientation from default R0.',rejected:{otherProperRotationBestRmsM:{lower:5.577171712330946,upper:5.590747611537466},bestMirrorRmsM:{lower:.3042371208104982,upper:.2941639637544731},mirrorReason:'Lower residual does not authorize reversing plan handedness; diagnostic only.'},scope:'Horizontal registrations of partial window-symbol observations for 5–17/F and 18–26/F. Not full-window-count, as-built status, a dimension schedule, a floor-height measurement or product identification.'};
}
