/** Layered mesh candidate; exact CCD and visible geometry remain R02's oracle. */
import {sweepTriangles} from '../r02/TriangleContact.mjs';
import {SURFACE_TOLERANCE} from '../r02/SurfaceNarrowPhase.mjs';
export {snapshotGlove} from '../r02/MeshSurfaceContact.mjs';
const box=()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
const extend=(b,p)=>{for(let k=0;k<3;k++){if(p[k]<b.min[k])b.min[k]=p[k];if(p[k]>b.max[k])b.max[k]=p[k];}return b;};
export const overlap=(a,b)=>a.min[0]-SURFACE_TOLERANCE<=b.max[0]&&a.max[0]+SURFACE_TOLERANCE>=b.min[0]&&a.min[1]-SURFACE_TOLERANCE<=b.max[1]&&a.max[1]+SURFACE_TOLERANCE>=b.min[1]&&a.min[2]-SURFACE_TOLERANCE<=b.max[2]&&a.max[2]+SURFACE_TOLERANCE>=b.min[2];
export const unionBounds=(a,b)=>({min:[Math.min(a.min[0],b.min[0]),Math.min(a.min[1],b.min[1]),Math.min(a.min[2],b.min[2])],max:[Math.max(a.max[0],b.max[0]),Math.max(a.max[1],b.max[1]),Math.max(a.max[2],b.max[2])]});
const triangle=(s,t)=>{const r=[];for(let k=0;k<3;k++){const v=s.faces[t*3+k]*3;r.push([s.positions[v],s.positions[v+1],s.positions[v+2]]);}return r;};
export function intervalBounds(vertices){const b=box();for(const v of vertices)extend(b,v);return b;}
function limitedBounds(a,b,t){const q=box();for(let i=0;i<3;i++){extend(q,a[i]);for(let k=0;k<3;k++){const v=a[i][k]+(b[i][k]-a[i][k])*t;if(v<q.min[k])q.min[k]=v;if(v>q.max[k])q.max[k]=v;}}return q;}
/** Same conservative endpoint-box lower bound as R02, without temporary arrays. */
export function earliestBoxOverlap(a0,a1,b0,b1){
 let lo=0,hi=1;
 for(let k=0;k<3;k++)for(let side=0;side<2;side++){
  const x0=side?b0.min[k]:a0.min[k],x1=side?b1.min[k]:a1.min[k],y0=side?a0.max[k]:b0.max[k],y1=side?a1.max[k]:b1.max[k];
  const f=x0-y0-SURFACE_TOLERANCE,d=(x1-x0)-(y1-y0);
  if(Math.abs(d)<1e-15){if(f>0)return Infinity;}else if(d>0)hi=Math.min(hi,-f/d);else lo=Math.max(lo,-f/d);
  if(lo>hi)return Infinity;
 }
 return lo;
}
/** Call once per hand/fixed step, then reuse for every eligible body/guard pair.
 * The supplied snapshots and their arrays must remain immutable while reused.
 * No implicit WeakMap cache: mutating callers cannot accidentally reuse stale
 * preparation unless they explicitly retain this object against its contract. */
export function prepareGloveStep(previous,current){
 if(previous.positions.length!==current.positions.length||previous.faces.length!==current.faces.length)throw Error('Glove topology changed between snapshots');
 const entries=[],bounds=box(),center=[0,0,0];
 // Preserve oracle centroid summation order separately for each coordinate.
 for(let k=0;k<3;k++){let sum=0;for(let i=k;i<previous.positions.length;i+=3)sum+=previous.positions[i];center[k]=sum/(previous.positions.length/3);}
 for(let t=0;t<current.faces.length/3;t++){
  const a=triangle(previous,t),b=triangle(current,t),start=intervalBounds(a),end=intervalBounds(b),swept=unionBounds(start,end);
  entries.push({a,b,start,end,bounds:swept,id:t});extend(bounds,swept.min);extend(bounds,swept.max);
 }
 return {previous,current,entries,bounds,center};
}
function preparation(previous,current,prepared){if(!prepared)return prepareGloveStep(previous,current);if(prepared.previous!==previous||prepared.current!==current)throw Error('Prepared glove step does not match snapshot identities');return prepared;}
function score(bounds,center){let s=0;for(let k=0;k<3;k++){const d=Math.max(bounds.min[k]-center[k],0,center[k]-bounds.max[k]);s+=d*d;}return s;}

// Only triangle membership/split topology survives across steps. Each refit
// uses this step's actual vertex endpoints, including every articulated cuff
// vertex. No posed bound or geometry is retained in this topology cache.
const guardTopologies=new WeakMap();
function guardTopology(prepared){
 const faces=prepared.current.faces,cached=guardTopologies.get(faces);
 if(cached&&cached.triangles===prepared.entries.length)return cached.root;
 const build=ids=>{
  if(ids.length<=12)return {ids};
  const b=box();for(const id of ids){const q=prepared.entries[id].bounds;extend(b,q.min);extend(b,q.max);}
  let axis=0;if(b.max[1]-b.min[1]>b.max[axis]-b.min[axis])axis=1;if(b.max[2]-b.min[2]>b.max[axis]-b.min[axis])axis=2;
  ids.sort((i,j)=>{const a=prepared.entries[i].bounds,b=prepared.entries[j].bounds;return (a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis])||i-j;});
  const half=ids.length>>1;return {children:[build(ids.slice(0,half)),build(ids.slice(half))]};
 };
 const root=build(prepared.entries.map(t=>t.id));guardTopologies.set(faces,{triangles:prepared.entries.length,root});return root;
}
/** Refit lazily only for a glove used as a guard. A prepared step may serve
 * many attackers. Fixed topology is reused while all swept leaf bounds come
 * from current actual geometry, so cuff articulation cannot be frozen out. */
export function prepareGuardHierarchy(prepared){
 if(prepared.guardHierarchy)return prepared.guardHierarchy;
 const refit=node=>{
  if(node.ids){const bounds=box();for(const id of node.ids){const b=prepared.entries[id].bounds;extend(bounds,b.min);extend(bounds,b.max);}return {bounds,ids:node.ids};}
  const children=node.children.map(refit);return {bounds:unionBounds(children[0].bounds,children[1].bounds),children};
 };
 return prepared.guardHierarchy=refit(guardTopology(prepared));
}
function guardCandidates(root,attackerBounds,entries,work){
 const candidates=[],visit=node=>{
  work.guardNodesVisited++;work.aabbTests++;if(!overlap(attackerBounds,node.bounds))return;
  if(node.children){visit(node.children[0]);visit(node.children[1]);return;}
  for(const id of node.ids){work.aabbTests++;if(overlap(attackerBounds,entries[id].bounds))candidates.push(entries[id]);}
 };
 visit(root);
 // The oracle iterates guards in original triangle order. Restoring it keeps
 // earliest-hit tie ownership, pruning history, pair budgets and unresolved
 // behavior identical; BVH traversal order must never become solver order.
 candidates.sort((a,b)=>a.id-b.id);return candidates;
}
/** Complete rendered glove mesh including cuff, against full-CSR target skin.
 * Parent-filtered candidates remain conservative because every descendant
 * vertex lies in each ancestor influence envelope. Only exact CCD makes hits.
 * Default budget and unresolved semantics intentionally stay oracle-identical. */
export function castGloveSurface(surface,previous,current,{maxTrianglePairs=100000,preparedAttack=null}={}){
 if(!surface.previous||!surface.current)throw Error('Surface step requires both actual poses');
 const attack=preparation(previous,current,preparedAttack),center=attack.center;let best=null,unresolved=false,pairs=0,nodesVisited=0,aabbTests=0;
 const visit=(node,parentCandidates)=>{
  if(pairs>maxTrianglePairs){unresolved=true;return;}nodesVisited++;
  const swept=unionBounds(surface.bounds(node,surface.previous),surface.bounds(node,surface.current));
  if(!overlap(attack.bounds,swept))return;
  const candidates=[];for(const t of parentCandidates){aabbTests++;if(overlap(t.bounds,swept))candidates.push(t);}if(!candidates.length)return;
  if(node.children){
   // Binary BVH preserves R02's stable distance ordering, including equal scores.
   let a=node.children[0],b=node.children[1];if(score(surface.bounds(a,surface.previous),center)>score(surface.bounds(b,surface.previous),center))[a,b]=[b,a];
   visit(a,candidates);visit(b,candidates);return;
  }
  for(const t of node.triangles){
   const faces=surface.human.faces,ids=[faces[t*3],faces[t*3+1],faces[t*3+2]],a=ids.map(v=>surface.vertex(v,surface.previous)),b=ids.map(v=>surface.vertex(v,surface.current));
   const start=intervalBounds(a),end=intervalBounds(b),tb=unionBounds(start,end);let limited=null,limitedToi=-1;
   for(const candidate of candidates){
    aabbTests++;if(!overlap(tb,candidate.bounds))continue;
    const lower=earliestBoxOverlap(candidate.start,candidate.end,start,end);if(!Number.isFinite(lower)||best&&lower>best.toi)continue;
    if(best){if(best.toi!==limitedToi){limited=limitedBounds(a,b,best.toi);limitedToi=best.toi;}if(!overlap(limited,limitedBounds(candidate.a,candidate.b,best.toi)))continue;}
    if(++pairs>maxTrianglePairs){unresolved=true;return;}
    const hit=sweepTriangles(candidate.a,candidate.b,a,b);if(hit?.unresolved){unresolved=true;continue;}
    if(hit&&(!best||hit.toi<best.toi))best={...hit,triangleId:t,attackerTriangleId:candidate.id,vertexIds:ids,bodyRegion:surface.triangleRegion[t],source:'actual glove mesh / full CSR surface continuous triangle contact',proxyApproximation:false,surfaceToleranceM:SURFACE_TOLERANCE,trajectory:'linear rendered vertices per fixed step'};
   }
  }
 };
 visit(surface.root,attack.entries);return {hit:best,unresolved,trianglePairs:pairs,reason:unresolved?'exact-mesh-budget-or-convergence':null,work:{nodesVisited,aabbTests}};
}
export function castGloveGuard(attackPrevious,attackCurrent,guardPrevious,guardCurrent,{maxTrianglePairs=100000,preparedAttack=null,preparedGuard=null}={}){
 const attack=preparation(attackPrevious,attackCurrent,preparedAttack),guard=preparation(guardPrevious,guardCurrent,preparedGuard);let best=null,unresolved=false,pairs=0;
 const work={guardNodesVisited:0,aabbTests:0,brutePairAABBTests:attack.entries.length*guard.entries.length};
 if(!overlap(attack.bounds,guard.bounds))return {hit:null,unresolved:false,trianglePairs:0,work};
 const hierarchy=prepareGuardHierarchy(guard);
 for(const a of attack.entries)for(const b of guardCandidates(hierarchy,a.bounds,guard.entries,work)){
  const lower=earliestBoxOverlap(a.start,a.end,b.start,b.end);if(!Number.isFinite(lower)||best&&lower>best.toi)continue;
  if(++pairs>maxTrianglePairs)return {hit:best,unresolved:true,trianglePairs:pairs,work};
  const hit=sweepTriangles(a.a,a.b,b.a,b.b);if(hit?.unresolved){unresolved=true;continue;}
  if(hit&&(!best||hit.toi<best.toi))best={...hit,attackerTriangleId:a.id,triangleId:b.id,bodyRegion:'glove.'+guardCurrent.side,source:'actual glove / actual guard continuous triangle contact',proxyApproximation:false};
 }
 return {hit:best,unresolved,trianglePairs:pairs,work};
}
