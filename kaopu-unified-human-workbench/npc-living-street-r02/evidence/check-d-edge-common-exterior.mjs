/** Read-only, exactly two original P01 vertices. No garment or motion update. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {MeshContact,closestTriangle} from '../vendor/appearance/cloth-adapted/mesh-contact.mjs';
import {FixedHemisphereExteriorQuery} from './garment-directed-exterior-probe/FixedHemisphereExteriorQuery.mjs';

const dir='evidence/garment-d-edge-common-exterior/';
fs.mkdirSync(dir,{recursive:true});
const sourceDir='evidence/garment-d-single-vertex-hemisphere-candidate/';
const stem='RAW_GARMENT_D_cmu11506-frame99-shoe-grounded-hip-hinge-source-coupled-wrist-contact';
const paths={rca:sourceDir+'D_REAR_HOLE_RCA.json',raw:sourceDir+stem+'_reference.json',references:sourceDir+'exact-hole-references/FROZEN_POSE_GARMENT_RECEIPT.json',pose:'evidence/PICKUP_CAPTURE11506_COUPLED_WRIST_D.json',person:'vendor/appearance/cloth-r10/assets/native-person.json.gz',source:'src/NativeGarmentFit.mjs',query:'evidence/garment-directed-exterior-probe/FixedHemisphereExteriorQuery.mjs',mesh:'vendor/appearance/cloth-adapted/mesh-contact.mjs'};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const production=['src/NativeMotion.mjs','src/NativeMotionLibrary.mjs','src/NativeCapturedPickup.mjs','src/NativeGarmentFit.mjs','src/NativeWardrobe.mjs'];
const productionBefore=Object.fromEntries(production.map(p=>[p,hash(p)]));
const rca=JSON.parse(fs.readFileSync(paths.rca)),raw=JSON.parse(fs.readFileSync(paths.raw)),receipt=JSON.parse(fs.readFileSync(paths.references)),pose=JSON.parse(fs.readFileSync(paths.pose)),person=JSON.parse(zlib.gunzipSync(fs.readFileSync(paths.person)));
const source=fs.readFileSync(paths.source,'utf8'),wa=source.indexOf('function nativeBodyWinding('),wb=source.indexOf('\nfunction domainsFor',wa),wc=source.indexOf('\nfunction sewnTopology',wb);
const winding=new Function('return '+source.slice(wa,wb).trim())(),domainsFor=new Function('const sourceDomains=new WeakMap();return '+source.slice(wb,wc).trim())();
const body=Float32Array.from(raw.body.positions),faces=Int32Array.from(raw.body.faces),contact=new MeshContact(body,faces),valid=domainsFor({person,positions:Float32Array.from(person.positions),faces}).valid.bottom;
const add=(a,b)=>a.map((x,d)=>x+b[d]),sub=(a,b)=>a.map((x,d)=>x-b[d]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,d)=>s+x*b[d],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>Math.hypot(...a),unit=a=>mul(a,1/norm(a)),point=i=>Array.from(body.subarray(i*3,i*3+3)),clamp=x=>Math.max(0,Math.min(1,x));
const margin=.004,tolerance=1e-7,bound=.08;
let maxBodyDifference=0;for(let i=0;i<body.length;i++)maxBodyDifference=Math.max(maxBodyDifference,Math.abs(body[i]-pose.states[0].positions[i]));
if(maxBodyDifference!==0||hash(paths.pose)!==rca.poseSHA256)throw Error('FROZEN_BODY_NOT_IDENTICAL');
const refs=receipt.frames[0].items.find(x=>x.id==='P01').contact.references;
const vertices=rca.longEdge.vertices.map(v=>{
 const r=refs.find(x=>x.id===v.sewnGroup),[a,b,c]=r.bodyReferenceIds.map(point),normal=unit(cross(sub(b,a),sub(c,a)));
 if(norm(sub(normal,v.fixedMaterialReference.currentGeometricNormal))>1e-13)throw Error('FIXED_GEOMETRIC_NORMAL_CHANGED');
 const rp=raw.items.find(x=>x.id==='P01').positions.slice(v.sourceId*3,v.sourceId*3+3);
 if(norm(sub(rp,v.referencePosition))!==0)throw Error('REFERENCE_POSITION_CHANGED');
 return{sourceId:v.sourceId,sewnGroup:v.sewnGroup,panel:v.panel,origin:v.referencePosition,fixedNormal:normal,fixedBodyReferenceIds:r.bodyReferenceIds,neutralFittedPoint:r.fittedPoint,paperUvMm:v.uvMm,originalSavedChoice:v.savedChoice};
});
const neutralLength=norm(sub(vertices[0].neutralFittedPoint,vertices[1].neutralFittedPoint)),paperLength=norm(sub(vertices[0].paperUvMm,vertices[1].paperUvMm))*.001;
const inspect=p=>{const f=contact.nearest(...p);return{winding:winding(contact,...p),distanceM:Math.sqrt(contact.best[0]),nearestBodyFace:f/3,nearestBodyIds:Array.from(faces.subarray(f,f+3))};};
function enumerate(v){
 const original=new FixedHemisphereExteriorQuery(contact,winding,valid).project(...v.origin,margin,v.fixedNormal);
 if(original.foreignUnderlyingContactSkipped||original.unresolved)throw Error('ORIGINAL_VERTEX_NOT_QUALIFIED');
 if(original.face/3!==v.originalSavedChoice.sourceFace||norm(sub(original.target,v.originalSavedChoice.point))>1e-12)throw Error('ORIGINAL_MINIMUM_NOT_REPRODUCED');
 const counts={completeBodyFaces:faces.length/3,pairedFaces:0,withinClosestDistanceBound:0,degenerate:0,outsideDisplacementBound:0,failedHemisphere:0,insideTarget:0,belowClearance:0,accepted:0},out=[],q=new Float64Array(7);
 // The original nearest query shrinks best2 to its current winner. Here only
 // that optimization is removed so every eligible <=80mm face candidate is
 // retained. Closest point, face normal, hemisphere, winding and clearance
 // are otherwise byte-for-byte the same formulas and original tolerances.
 for(let f=0;f<faces.length;f+=3){
  if(!valid[f/3])continue;counts.pairedFaces++;
  closestTriangle(body,faces,f,...v.origin,q);if(Math.sqrt(q[0])-margin>bound)continue;counts.withinClosestDistanceBound++;
  const ids=Array.from(faces.subarray(f,f+3)),[a,b,c]=ids.map(point),rawN=cross(sub(b,a),sub(c,a)),L=norm(rawN);if(L<1e-14){counts.degenerate++;continue;}
  const normal=mul(rawN,1/L),target=add(Array.from(q.subarray(1,4)),mul(normal,margin)),delta=sub(target,v.origin),move=norm(delta);
  if(move>=bound){counts.outsideDisplacementBound++;continue;}
  const hemisphereDot=dot(delta,v.fixedNormal);if(!(hemisphereDot>0)){counts.failedHemisphere++;continue;}
  const W=winding(contact,...target);if(W!==0){counts.insideTarget++;continue;}
  const nf=contact.nearest(...target),distance=Math.sqrt(contact.best[0]);if(distance<margin-tolerance){counts.belowClearance++;continue;}
  out.push({index:out.length,sourceFace:f/3,bodyIds:ids,closestPoint:Array.from(q.subarray(1,4)),bary:Array.from(q.subarray(4,7)),normal,point:target,delta,moveM:move,hemisphereDotM:hemisphereDot,hemisphereCosine:hemisphereDot/move,winding:W,distanceM:distance,nearestBodyFace:nf/3,nearestBodyIds:Array.from(faces.subarray(nf,nf+3))});
 }
 counts.accepted=out.length;
 return{...v,initial:inspect(v.origin),counts,candidates:out,minimumMoveCandidate:out.reduce((a,b)=>!a||b.moveM<a.moveM?b:a,null),originalMinimumReproduced:true};
}
const endpoints=vertices.map(enumerate);
console.log(JSON.stringify({stage:'endpoints',counts:endpoints.map(x=>x.counts),neutralLengthM:neutralLength,paperLengthM:paperLength}));

const tri=Array.from({length:faces.length/3},(_,i)=>{const ids=Array.from(faces.subarray(i*3,i*3+3)),[a,b,c]=ids.map(point);return{face:i,ids,a,b,c,e1:sub(b,a),e2:sub(c,a),normal:cross(sub(b,a),sub(c,a))};});
function segmentSegment(A,B,C,D){
 const u=sub(B,A),v=sub(D,C),w=sub(A,C),a=dot(u,u),b=dot(u,v),c=dot(v,v),d=dot(u,w),e=dot(v,w);
 let s=0,t=0;if(a<=1e-24&&c<=1e-24)return{distance2:dot(w,w),s,t};
 if(a<=1e-24)t=clamp(e/c);else if(c<=1e-24)s=clamp(-d/a);else{const den=a*c-b*b;s=den>1e-24?clamp((b*e-c*d)/den):0;t=(b*s+e)/c;if(t<0){t=0;s=clamp(-d/a);}else if(t>1){t=1;s=clamp((b-d)/a);}}
 const delta=sub(add(A,mul(u,s)),add(C,mul(v,t)));return{distance2:dot(delta,delta),s,t};
}
function segmentTriangleHit(A,B,T){
 const direction=sub(B,A),h=cross(direction,T.e2),det=dot(T.e1,h);
 if(Math.abs(det)<1e-16)return null;
 const s=sub(A,T.a),u=dot(s,h)/det;if(u<0||u>1)return null;
 const q=cross(s,T.e1),v=dot(direction,q)/det;if(v<0||u+v>1)return null;
 const t=dot(T.e2,q)/det;if(t<0||t>1)return null;
 return{face:T.face,t,bary:[1-u-v,u,v],point:add(A,mul(direction,t)),orientation:dot(direction,T.normal)>0?'out':'in'};
}
function segmentAudit(A,B){
 const box=[...A.map((x,d)=>Math.min(x,B[d])),...A.map((x,d)=>Math.max(x,B[d]))],stack=[0],hits=[],qa=new Float64Array(7),qb=new Float64Array(7);
 let best=Infinity,bestFace=-1,bestT=0,tested=0;
 while(stack.length){const node=contact.nodes[stack.pop()],bb=node.box;let lb=0;for(let d=0;d<3;d++){const gap=Math.max(box[d]-bb[d+3],bb[d]-box[d+3],0);lb+=gap*gap;}if(lb>best+1e-24)continue;
  if(node.left>=0){stack.push(node.left,node.right);continue;}
  for(let k=node.lo;k<node.hi;k++){const f=contact.tri[k],T=tri[f/3];tested++;const hit=segmentTriangleHit(A,B,T);if(hit){hits.push(hit);if(best>0){best=0;bestFace=f/3;bestT=hit.t;}continue;}
   closestTriangle(body,faces,f,...A,qa);closestTriangle(body,faces,f,...B,qb);
   for(const [d2,t]of [[qa[0],0],[qb[0],1]])if(d2<best){best=d2;bestFace=f/3;bestT=t;}
   for(const [C,D]of [[T.a,T.b],[T.b,T.c],[T.c,T.a]]){const x=segmentSegment(A,B,C,D);if(x.distance2<best){best=x.distance2;bestFace=f/3;bestT=x.s;}}
  }
 }
 hits.sort((a,b)=>a.t-b.t);const mid=mul(add(A,B),.5),midpoint=inspect(mid);
 return{crossingCount:hits.length,crossings:hits,minimumDistanceM:Math.sqrt(best),minimumDistanceFace:bestFace,minimumDistanceT:bestT,midpoint:{point:mid,...midpoint},testedBodyTriangles:tested};
}
const pairs=[];
for(const a of endpoints[0].candidates)for(const b of endpoints[1].candidates){
 const length=norm(sub(a.point,b.point)),strain=length/neutralLength-1,audit=segmentAudit(a.point,b.point),surfaceContinuous=audit.crossingCount===0&&audit.minimumDistanceM>1e-10&&audit.midpoint.winding===0;
 pairs.push({a:a.index,b:b.index,faces:[a.sourceFace,b.sourceFace],sameSourceFace:a.sourceFace===b.sourceFace,lengthM:length,strainRelativeToNeutral:strain,absoluteStrain:Math.abs(strain),ratioToPaper:length/paperLength,totalMoveM:a.moveM+b.moveM,maximumMoveM:Math.max(a.moveM,b.moveM),displacementCosine:dot(unit(a.delta),unit(b.delta)),deltaJumpM:norm(sub(a.delta,b.delta)),crossingCount:audit.crossingCount,minimumEdgeDistanceM:audit.minimumDistanceM,minimumEdgeDistanceFace:audit.minimumDistanceFace,minimumEdgeDistanceT:audit.minimumDistanceT,midpointWinding:audit.midpoint.winding,midpointDistanceM:audit.midpoint.distanceM,midpointFace:audit.midpoint.nearestBodyFace,surfaceContinuous,wholeEdge4mm:surfaceContinuous&&audit.minimumDistanceM>=margin-tolerance});
}
const ordered=rows=>rows.slice().sort((a,b)=>a.absoluteStrain-b.absoluteStrain||a.totalMoveM-b.totalMoveM||a.a-b.a||a.b-b.b);
const geometry=pairs.filter(p=>p.surfaceContinuous),clear=pairs.filter(p=>p.wholeEdge4mm),sameFace=clear.filter(p=>p.sameSourceFace);
function pareto(rows){let best=Infinity;const out=[];for(const r of ordered(rows)){if(r.totalMoveM<best){out.push(r);best=r.totalMoveM;}}return out;}
const paretoClear=pareto(clear);
function detail(p){if(!p)return null;const a=endpoints[0].candidates[p.a],b=endpoints[1].candidates[p.b];return{...p,endpoints:[a,b],edge:segmentAudit(a.point,b.point)};}
const oldPair={points:vertices.map(v=>v.originalSavedChoice.point),edge:segmentAudit(...vertices.map(v=>v.originalSavedChoice.point))};
oldPair.lengthM=norm(sub(...oldPair.points));oldPair.strainRelativeToNeutral=oldPair.lengthM/neutralLength-1;oldPair.ratioToPaper=oldPair.lengthM/paperLength;oldPair.totalMoveM=vertices.reduce((s,v)=>s+v.originalSavedChoice.moveM,0);
const packet={schema:'two-fixed-endpoint-exterior-candidate-pairs/1',endpoints,pairs};
fs.writeFileSync(dir+'D_EDGE_ALL_CANDIDATE_PAIRS.json.gz',zlib.gzipSync(JSON.stringify(packet)+'\n'));
const productionAfter=Object.fromEntries(production.map(p=>[p,hash(p)]));
if(JSON.stringify(productionBefore)!==JSON.stringify(productionAfter))throw Error('PRODUCTION_CHANGED_DURING_READ_ONLY_QUERY');
const report={schema:'fixed-two-point-common-exterior-feasibility/1',diagnosticOnly:true,productionChanged:false,noGarmentMotionOrSolverExecuted:true,scope:{actor:'D',garment:'P01',sourceVertexIds:[6179,6192],sewnGroups:[5801,5814],state:raw.state,externalPoseSHA256:hash(paths.pose)},inputs:Object.fromEntries(Object.entries(paths).map(([k,p])=>[k,{path:p,bytes:fs.statSync(p).size,sha256:hash(p)}])),sourceHashes:productionBefore,body:{vertices:body.length/3,triangles:faces.length/3,maximumDifferenceFromFrozenPoseM:maxBodyDifference,allActualBodyTrianglesInAudit:true},method:{candidate:'Complete original eligible body face enumeration; closest point to each fixed original posed endpoint plus the original outward oriented face normal times4mm. Only winner-distance pruning is disabled to retain all choices.',searchBoundM:bound,clearanceM:margin,originalFloatingClearanceToleranceM:tolerance,hemisphere:'strict dot(candidate-origin,current exact fixed original reference face normal)>0; no angle threshold or direction grid',pairedMask:'unchanged domainsFor(source).valid.bottom,original weight mean>.65; mask restricts candidate generation only,not winding/clearance/edge checks',pairOrder:'All Cartesian pairs. Rank absolute engineering strain against exact saved neutral wearer-fitted edge,then summed endpoint displacement. Pareto report retains competing strain/displacement objectives; no arbitrary combined weight.',edgeAudit:'Full actual-body triangle segment intersections plus exact segment-triangle nearest distance (endpoint-to-triangle and all triangle-edge-to-segment cases) through existing BVH; full-body midpoint winding/distance. No angular branch classification.',branchWitness:'An original same source-face pair with a wholly exterior connecting edge is a sufficient common local-shell witness. Different-face pairs are reported by actual connecting-edge geometry,never inferred from similar endpoint normals.',iterations:0},lengths:{originalPaperM:paperLength,neutralWearerFittedM:neutralLength,posedBeforeContactM:norm(sub(vertices[0].origin,vertices[1].origin)),independentlyShortestAfterContactM:oldPair.lengthM},endpoints:endpoints.map(({candidates,...x})=>({...x,candidateCount:candidates.length})),counts:{candidatePairs:pairs.length,surfaceContinuous:geometry.length,wholeEdge4mm:clear.length,sameSourceFaceWholeEdge4mm:sameFace.length,continuousAtMostNeutral:geometry.filter(p=>p.lengthM<=neutralLength).length,continuousAtMostPaper:geometry.filter(p=>p.lengthM<=paperLength).length,wholeEdge4mmAtMostNeutral:clear.filter(p=>p.lengthM<=neutralLength).length,wholeEdge4mmAtMostPaper:clear.filter(p=>p.lengthM<=paperLength).length,paretoWholeEdge4mm:paretoClear.length},originalIndependentPair:oldPair,bestAbsoluteNeutralStrainWithoutEdgeGate:detail(ordered(pairs)[0]),bestAbsoluteNeutralStrainContinuous:detail(ordered(geometry)[0]),bestAbsoluteNeutralStrainWholeEdge4mm:detail(ordered(clear)[0]),bestAbsoluteNeutralStrainSameSourceFaceWholeEdge4mm:detail(ordered(sameFace)[0]),minimumTotalMoveWholeEdge4mm:detail(clear.slice().sort((a,b)=>a.totalMoveM-b.totalMoveM||a.absoluteStrain-b.absoluteStrain)[0]),paretoWholeEdge4mm:paretoClear,allPairs:{path:dir+'D_EDGE_ALL_CANDIDATE_PAIRS.json.gz',sha256:hash(dir+'D_EDGE_ALL_CANDIDATE_PAIRS.json.gz'),bytes:fs.statSync(dir+'D_EDGE_ALL_CANDIDATE_PAIRS.json.gz').size},limitations:['Two-point finite-candidate feasibility is not a simultaneous original triangle/whole garment solution.','No evidence about neighbouring material vertices,triangle orientation,seams,dynamic cloth,rendered appearance or temporal branch stability is added.','The finite original face-normal-offset pool is not an exhaustive continuous free-space solution; a negative result would apply to this pool only.','Paper length is a separate16mm material reference; wearer-fitted length is measured14.400907mm,not silently replaced with paper length.'],productionAfter,reproduce:'node evidence/check-d-edge-common-exterior.mjs'};
fs.writeFileSync(dir+'D_EDGE_COMMON_EXTERIOR_FEASIBILITY.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({counts:report.counts,lengths:report.lengths,originalIndependent:oldPair,bestWhole:report.bestAbsoluteNeutralStrainWholeEdge4mm,bestSameFace:report.bestAbsoluteNeutralStrainSameSourceFaceWholeEdge4mm,pareto:paretoClear},null,2));
