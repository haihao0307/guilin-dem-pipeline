import {SURFACE_TOLERANCE} from './SurfaceNarrowPhase.mjs';
import {castGloveSurface,castGloveGuard,prepareGloveStep,unionBounds,overlap} from './MeshSurfaceContact.mjs';

function snapshotBounds(snapshot){
 const p=snapshot.positions,b={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){const v=p[i+k];if(v<b.min[k])b.min[k]=v;if(v>b.max[k])b.max[k]=v;}
 return b;
}
function geometryIdentity(surface){
 const h=surface.human;
 return [h,h.N,h.positions,h.faces,h.range,h.packed,h.names,h.geometry,h.geometry?.attributes?.position,h.geometry?.attributes?.csRegion,h.geometry?.index?.array];
}
/** Fixed-step owner of endpoint reuse and layered candidate work.
 *
 * advance([{id, surface, body, gloves, collisionGroup?, geometryRevision?}],
 *         {sampleTime}) takes NEW immutable
 * snapshots at each endpoint. `body` is surface.snapshot(...); `gloves` contains
 * both actual posed snapshotGlove(...) meshes, including articulated cuffs.
 * First call seeds state and reports no interval. Later calls reuse the previous
 * snapshots, their skinned vertices and their already computed root bounds.
 *
 * By default every distinct actor is eligible. An explicit collisionGroup is
 * a caller-owned interaction policy: two explicit different groups cannot hit.
 * Use this for independent rings only when that separation is intentional.
 * sampleTime is PHYSICAL simulation seconds, not Motion.evaluate canonical
 * playback time. It must advance by physical fixedStepSeconds (usually 1/120).
 * canonicalTime is optional output metadata and never controls validation.
 * Missed/out-of-order/variable
 * intervals throw before traversal; reset explicitly before discontinuities.
 * Replacing human/CSR/mesh arrays or geometryRevision on a retained actor throws.
 * Callers MUST change geometryRevision for any in-place recipe/geometry edit.
 * Build a new SurfaceNarrowPhase after any geometry edit, then reset the world.
 * Missing actors are removed; call reset() after teleports or topology changes.
 * The controller chooses physical response; this class never changes geometry,
 * choreography, scoring or the oracle, and never turns unresolved into a miss.
 */
export class FixedStepCollisionWorld {
 constructor({maxTrianglePairs=100000,fixedStepSeconds=1/120}={}){
  if(!Number.isFinite(fixedStepSeconds)||fixedStepSeconds<=0)throw Error('fixedStepSeconds must be positive and finite');
  this.frames=new Map();this.maxTrianglePairs=maxTrianglePairs;this.fixedStepSeconds=fixedStepSeconds;this.sampleTime=null;
 }
 reset(){this.frames.clear();this.sampleTime=null;}
 advance(frames,{sampleTime,canonicalTime=null}={}){
  if(!Number.isFinite(sampleTime))throw Error('sampleTime is required and must be finite');
  if(canonicalTime!==null&&!Number.isFinite(canonicalTime))throw Error('canonicalTime metadata must be finite when provided');
  if(this.sampleTime!==null){
   const delta=sampleTime-this.sampleTime,tolerance=64*Number.EPSILON*Math.max(1,Math.abs(sampleTime),Math.abs(this.sampleTime));
   if(delta<=0||Math.abs(delta-this.fixedStepSeconds)>tolerance)throw Error('Snapshots must be consecutive fixed steps; reset before a discontinuity');
  }
  const next=new Map(),active=[],surfaces=new Set(),stats={actors:frames.length,seededActors:0,bodyBroadTests:0,guardBroadTests:0,bodyCandidates:0,guardCandidates:0,glovesPrepared:0,trianglePairs:0,unresolvedCalls:0},queries=[];
  for(const frame of frames){
   if(next.has(frame.id))throw Error('Duplicate actor id');
   if(surfaces.has(frame.surface))throw Error('Each actor needs its own SurfaceNarrowPhase instance');surfaces.add(frame.surface);
   if(frame.gloves.length!==2)throw Error('Each actor requires both actual glove snapshots');
   const previous=this.frames.get(frame.id),identity=geometryIdentity(frame.surface),current={...frame,identity,gloveBounds:frame.gloves.map(snapshotBounds)};next.set(frame.id,current);
   if(!previous){stats.seededActors++;continue;}
   if(previous.surface!==frame.surface)throw Error('Surface changed: reset collision world before topology changes');
   if(previous.geometryRevision!==current.geometryRevision||identity.some((v,i)=>v!==previous.identity[i]))throw Error('Geometry changed: rebuild SurfaceNarrowPhase and reset collision world');
   frame.surface.setStep(previous.body,current.body);
   const bodyBounds=unionBounds(frame.surface.bounds(frame.surface.root,previous.body),frame.surface.bounds(frame.surface.root,current.body));
   active.push({previous,current,bodyBounds,gloveBounds:current.gloveBounds.map((b,h)=>unionBounds(previous.gloveBounds[h],b)),prepared:[null,null]});
  }
  const prepare=(frame,hand)=>{if(!frame.prepared[hand]){frame.prepared[hand]=prepareGloveStep(frame.previous.gloves[hand],frame.current.gloves[hand]);stats.glovesPrepared++;}return frame.prepared[hand];};
  for(const attacker of active)for(let hand=0;hand<2;hand++){
   let earliest=null,unresolved=false;
   const record=(result,target,kind,targetHand=null)=>{
    stats.trianglePairs+=result.trianglePairs;if(result.unresolved){unresolved=true;stats.unresolvedCalls++;}
    queries.push({attacker:attacker.current.id,hand,target:target.current.id,targetHand,kind,...result});
    if(result.hit&&(!earliest||result.hit.toi<earliest.hit.toi))earliest={target:target.current.id,targetHand,kind,hit:result.hit};
   };
   for(const target of active){
    if(attacker===target)continue;
    const ag=attacker.current.collisionGroup,tg=target.current.collisionGroup;if(ag!==undefined&&tg!==undefined&&ag!==tg)continue;
    stats.bodyBroadTests++;
    if(overlap(attacker.gloveBounds[hand],target.bodyBounds)){
     stats.bodyCandidates++;record(castGloveSurface(target.current.surface,attacker.previous.gloves[hand],attacker.current.gloves[hand],{maxTrianglePairs:this.maxTrianglePairs,preparedAttack:prepare(attacker,hand)}),target,'body');
    }
    for(let guard=0;guard<2;guard++){
     stats.guardBroadTests++;
     if(!overlap(attacker.gloveBounds[hand],target.gloveBounds[guard]))continue;
     stats.guardCandidates++;record(castGloveGuard(attacker.previous.gloves[hand],attacker.current.gloves[hand],target.previous.gloves[guard],target.current.gloves[guard],{maxTrianglePairs:this.maxTrianglePairs,preparedAttack:prepare(attacker,hand),preparedGuard:prepare(target,guard)}),target,'guard',guard);
    }
   }
   // A guard or adjacent limb wins naturally by geometric TOI. Any unresolved
   // eligible query prevents certifying this hand's global earliest contact.
   attacker.results??=[];attacker.results.push({attacker:attacker.current.id,hand,unresolved,hit:unresolved?null:earliest,candidate:unresolved?earliest:null});
  }
  this.frames=next;this.sampleTime=sampleTime;
  return {stats,queries,contacts:active.flatMap(a=>a.results||[]),sampleTime,canonicalTime,fixedStepSeconds:this.fixedStepSeconds,surfaceToleranceM:SURFACE_TOLERANCE,trajectory:'linear rendered vertices per fixed step'};
 }
}
