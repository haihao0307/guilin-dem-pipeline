/**
 * Read-only seam diagnostics for kaopu-sewing-graph@1, NOT an official GSL decoder.
 * Checks explicit topology and both entire discretized seam boundaries, separately
 * from needle equality. No repair, welding, UV editing, nearest-neighbour pairing,
 * blanket stitch-neighbour exclusion, or modification of the supplied result.
 *
 * The distance to a target polyline is 1-Lipschitz. For an interval of length L
 * with endpoint distances da/db, its maximum is <= (da + db + L) / 2. A tighter
 * bound follows from convex distance to any single target segment. Adaptive
 * subdivision bounds the unsampled maximum, rather than labelling five samples
 * a continuous-closure test. Bounds concern piecewise-linear edges only; JS
 * floating-point arithmetic is not a formal interval-arithmetic certificate.
 */
const SCHEMA = 'kaopu-sewing-graph@1';
const EPS = 1e-10;

export class SeamAuditError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'SeamAuditError'; this.code = code;
  }
}
const fail = (code, detail) => { throw new SeamAuditError(code, detail); };
const finitePoint = (p, n) => Array.isArray(p) && p.length === n && p.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e9);
const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const key = e => JSON.stringify([e.panelId, String(e.edge)]);

/** Return validated native references without changing IDs or the material. */
export function validateSeamReferences(spec, positionsMm) {
  if (spec?.schema !== SCHEMA || spec.units !== 'mm') fail('SCHEMA_UNITS', 'native sewing graph in millimetres required');
  if (!Array.isArray(spec.panels) || !spec.panels.length || !Array.isArray(spec.seams)) fail('INVALID_GRAPH', 'panels and seams required');
  const panels = new Map(); let offset = 0;
  for (const p of spec.panels) {
    if (typeof p.id !== 'string' || !p.id || panels.has(p.id)) fail('PANEL_ID', `missing or duplicate ${p.id}`);
    if (!Array.isArray(p.uvMm) || !p.uvMm.length || !p.uvMm.every(v=>finitePoint(v,2))) fail('INVALID_MATERIAL', p.id);
    if (!p.edges || typeof p.edges !== 'object') fail('MISSING_EDGES', p.id);
    panels.set(p.id, {panel:p,offset}); offset += p.uvMm.length;
  }
  if (!Array.isArray(positionsMm) || positionsMm.length !== offset || !positionsMm.every(p=>finitePoint(p,3))) fail('INVALID_POSITIONS', 'finite millimetre positions matching every material vertex required');
  const ids = new Set(), usedEdges = new Map();
  const resolve = (e, seamId) => {
    const data = panels.get(e?.panelId);
    if (!data) fail('DANGLING_PANEL', `${seamId}: ${e?.panelId}`);
    if (e.reverse !== undefined && typeof e.reverse !== 'boolean') fail('INVALID_ORIENTATION', seamId);
    if (!Object.hasOwn(data.panel.edges, e.edge)) fail('DANGLING_EDGE', `${seamId}: ${key(e)}`);
    const edge = data.panel.edges[e.edge];
    if (!Array.isArray(edge) || edge.length < 2 || edge.some(i=>!Number.isInteger(i)||i<0||i>=data.panel.uvMm.length)) fail('INVALID_EDGE_INDICES', `${seamId}: ${key(e)}`);
    if (new Set(edge).size !== edge.length) fail('REPEATED_EDGE_VERTEX', `${seamId}: ${key(e)}`);
    for (let j=1;j<edge.length;j++) {
      const a=data.panel.uvMm[edge[j-1]],b=data.panel.uvMm[edge[j]];
      if (Math.hypot(a[0]-b[0],a[1]-b[1]) < EPS) fail('ZERO_MATERIAL_EDGE', `${seamId}: ${key(e)}`);
    }
    if (usedEdges.has(key(e))) fail('EDGE_USED_TWICE', `${key(e)} in ${usedEdges.get(key(e))} and ${seamId}`);
    usedEdges.set(key(e), seamId);
    const ordered=e.reverse?[...edge].reverse():[...edge];
    return {...data,ordered,index:new Map(ordered.map((v,i)=>[v,i])),ref:{panelId:e.panelId,edge:e.edge,reverse:!!e.reverse}};
  };
  const resolved = [];
  for (const s of spec.seams) {
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id)) fail('SEAM_ID', `missing or duplicate ${s.id}`);
    ids.add(s.id);
    const a=resolve(s.a,s.id),b=resolve(s.b,s.id),pairs=s.stitchVertexPairs;
    if (!Array.isArray(pairs) || pairs.length < 2) fail('INVALID_NEEDLES', s.id);
    let previousA=-1,previousB=-1;
    for (const pair of pairs) {
      if (!Array.isArray(pair)||pair.length!==2||!a.index.has(pair[0])||!b.index.has(pair[1])) fail('NEEDLE_OUTSIDE_REFERENCED_EDGE', s.id);
      const ia=a.index.get(pair[0]),ib=b.index.get(pair[1]);
      if (ia<=previousA||ib<=previousB) fail('NEEDLE_ORDER', s.id);
      previousA=ia;previousB=ib;
    }
    if (pairs[0][0]!==a.ordered[0]||pairs[0][1]!==b.ordered[0]||pairs.at(-1)[0]!==a.ordered.at(-1)||pairs.at(-1)[1]!==b.ordered.at(-1)) fail('UNPAIRED_SEAM_ENDPOINT', s.id);
    const g=s.sourceSeam?.gathering;
    if (g && (![g.ruffleCoefficientA,g.ruffleCoefficientB].every(v=>Number.isFinite(v)&&v>0))) fail('INVALID_GATHERING', s.id);
    const gathered=g?Math.abs(g.ruffleCoefficientA-g.ruffleCoefficientB)>1e-8*Math.max(1,g.ruffleCoefficientA,g.ruffleCoefficientB):null;
    resolved.push({seam:s,a,b,gathered});
  }
  return {panels,seams:resolved,vertexCount:offset,unreferencedMaterialEdges:[...panels.values()].reduce((n,{panel})=>n+Object.keys(panel.edges).filter(edge=>!usedEdges.has(key({panelId:panel.id,edge}))).length,0),closedClothTopologyCertified:false};
}

function segmentDistance(p, a, b) {
  const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],d=x*x+y*y+z*z;
  const t=d>0?Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y+(p[2]-a[2])*z)/d)):0;
  return {distance:Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y,p[2]-a[2]-t*z),t};
}
function nearest(p, path) {
  let result={distance:Infinity,segment:-1,t:0};
  for(let j=1;j<path.length;j++){
    const v=segmentDistance(p,path[j-1],path[j]);
    if(v.distance<result.distance)result={...v,segment:j-1};
  }
  return result;
}
class MaxHeap {
  constructor(){this.items=[];}
  get top(){return this.items[0];}
  push(item){let i=this.items.length;this.items.push(item);while(i){const p=(i-1)>>1;if(this.items[p].upper>=item.upper)break;this.items[i]=this.items[p];i=p;}this.items[i]=item;}
  pop(){const root=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let j=i*2+1;if(j+1<this.items.length&&this.items[j+1].upper>this.items[j].upper)j++;if(this.items[j].upper<=last.upper)break;this.items[i]=this.items[j];i=j;}this.items[i]=last;}return root;}
}
/** Bidirectional Hausdorff-distance bounds for two finite piecewise-linear paths. */
export function polylineGapBounds(pathA,pathB,{toleranceMm=.02,maxEvaluations=200000}={}) {
  if (![pathA,pathB].every(p=>Array.isArray(p)&&p.length>=2&&p.every(v=>finitePoint(v,3)))) fail('INVALID_POLYLINE','two finite 3D paths required');
  if (!Number.isFinite(toleranceMm)||toleranceMm<=0||!Number.isInteger(maxEvaluations)||maxEvaluations<4) fail('INVALID_BUDGET','positive tolerance and evaluation budget required');
  const heap=new MaxHeap(),paths=[pathA,pathB];let lower=0,worst=null,evaluations=0;
  let magnitude=1;for(const path of paths)for(const p of path)for(const v of p)magnitude=Math.max(magnitude,Math.abs(v));
  const padding=Math.max(EPS,magnitude*Number.EPSILON*64);
  const sample=(p,side,segment,t)=>{
    const q=nearest(p,paths[1-side]);evaluations++;
    if(worst===null||q.distance>lower){lower=q.distance;worst={sourceSide:side,sourceSegment:segment,sourceT:t,sourcePositionMm:[...p],targetSegment:q.segment,targetT:q.t,distanceMm:q.distance};}
    return{p:[...p],...q,t};
  };
  const interval=(a,b,side,segment)=>{
    const length=dist(a.p,b.p),target=paths[1-side];
    let upper=(a.distance+b.distance+length)/2;
    // Distance to one convex target segment is convex on the source segment.
    // Trying the two endpoint-nearest segments gives another safe upper bound.
    for(const j of new Set([a.segment,b.segment]))upper=Math.min(upper,Math.max(segmentDistance(a.p,target[j],target[j+1]).distance,segmentDistance(b.p,target[j],target[j+1]).distance));
    heap.push({a,b,side,segment,upper:Math.max(a.distance,b.distance,upper)+padding});
  };
  for(let side=0;side<2;side++){
    const path=paths[side];
    if(evaluations+path.length>maxEvaluations)fail('AUDIT_BUDGET_TOO_SMALL','not all original edge vertices could be measured');
    const q=path.map((p,i)=>sample(p,side,Math.min(i,path.length-2),i===path.length-1?1:0));
    for(let j=1;j<path.length;j++)interval({...q[j-1],t:0},{...q[j],t:1},side,j-1);
  }
  while(heap.top && heap.top.upper>lower+toleranceMm && evaluations<maxEvaluations){
    const top=heap.pop(),t=(top.a.t+top.b.t)/2;
    const m=top.a.p.map((v,k)=>(v+top.b.p[k])/2),q=sample(m,top.side,top.segment,t);
    interval(top.a,q,top.side,top.segment);interval(q,top.b,top.side,top.segment);
  }
  const upper=Math.max(lower,heap.top?.upper??lower);
  return {lowerBoundMm:lower,upperBoundMm:upper,errorBoundMm:upper-lower,resolved:upper-lower<=toleranceMm,evaluations,worst,
    scope:'complete supplied piecewise-linear paths; finite floating-point tolerance',
    analyticCurveCertified:false,floatingPointIntervalCertified:false,motionCertified:false};
}

/** Audits current positions only. Review threshold is not a physical stitch tolerance. */
export function auditSeamSpans(spec,positionsMm,{activeSeamIds=null,toleranceMm=.02,reviewThresholdMm=.25,maxEvaluations=200000}={}) {
  if(!Number.isFinite(reviewThresholdMm)||reviewThresholdMm<0)fail('INVALID_THRESHOLD','non-negative review threshold required');
  const graph=validateSeamReferences(spec,positionsMm),allIds=new Set(spec.seams.map(s=>s.id));
  if(activeSeamIds!==null && (!Array.isArray(activeSeamIds)||activeSeamIds.some(s=>!allIds.has(s))))fail('UNKNOWN_ACTIVE_SEAM','active IDs must be explicitly declared');
  const active=new Set(activeSeamIds??allIds),rows=[];
  for(const {seam:s,a,b,gathered} of graph.seams){
    if(!active.has(s.id))continue;
    const pathA=a.ordered.map(i=>positionsMm[a.offset+i]),pathB=b.ordered.map(i=>positionsMm[b.offset+i]);
    const needleGapMm=s.stitchVertexPairs.reduce((n,[i,j])=>Math.max(n,dist(positionsMm[a.offset+i],positionsMm[b.offset+j])),0);
    const bounds=polylineGapBounds(pathA,pathB,{toleranceMm,maxEvaluations});
    const assessment=bounds.lowerBoundMm>reviewThresholdMm?'separation_detected':bounds.upperBoundMm<=reviewThresholdMm?'within_review_threshold':'unresolved';
    rows.push({seamId:s.id,stageId:s.stageId,sourceStitchIndex:s.sourceStitchIndex??null,a:a.ref,b:b.ref,declaredGathering:gathered,
      needleCount:s.stitchVertexPairs.length,needleGapMm,span:bounds,assessment,
      measurementMeaning:gathered?'separation of naked gathered boundaries; allowances/folded seam construction require a separate test':'separation of declared sewn boundaries; topology order checked separately'});
  }
  const max = select => rows.reduce((n,r)=>Math.max(n,select(r)),0);
  return {schema:'kaopu-bounded-seam-span-audit@1',inputSchema:SCHEMA,units:'mm',vertexCount:graph.vertexCount,
    activeScope:activeSeamIds===null?'all declared seams assumed active':'explicit active seam IDs',measuredSeams:rows.length,reviewThresholdMm,toleranceMm,
    maxNeedleGapMm:max(r=>r.needleGapMm),maxSpanLowerBoundMm:max(r=>r.span.lowerBoundMm),maxSpanUpperBoundMm:max(r=>r.span.upperBoundMm),
    separatedSeamIds:rows.filter(r=>r.assessment==='separation_detected').map(r=>r.seamId),
    unresolvedSeamIds:rows.filter(r=>r.assessment==='unresolved'||!r.span.resolved).map(r=>r.seamId),
    allWithinReviewThreshold:rows.length>0&&rows.every(r=>r.assessment==='within_review_threshold'&&r.span.resolved),
    rows,needleEqualityDoesNotProveContinuousClosure:true,
    unreferencedEdgesAreNotAutomaticallyErrors:true,unreferencedMaterialEdges:graph.unreferencedMaterialEdges,
    garmentAccepted:false,dynamicWearCertified:false,readOnly:true,
    limits:'No material, seam-allowance, bending, surface self-contact or motion validity certification. Bounds apply to discretized edge geometry, not the unsampled original analytic curve.'};
}
