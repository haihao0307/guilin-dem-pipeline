/** Shared Node/browser verification over actual rendered geometry snapshots. */
import {SurfaceNarrowPhase as OracleSurface} from '../r02/SurfaceNarrowPhase.mjs';
import {castGloveSurface as oracleBody,castGloveGuard as oracleGuard,snapshotGlove} from '../r02/MeshSurfaceContact.mjs';
import {castGloveSurface as fastBody,castGloveGuard as fastGuard,prepareGloveStep,prepareGuardHierarchy} from './MeshSurfaceContact.mjs';

const shifted=(snapshot,delta)=>({...snapshot,positions:Float64Array.from(snapshot.positions,(value,i)=>value+delta[i%3])});
const now=()=>performance.now();
function same(a,b,path='result'){
 if(Object.is(a,b))return null;
 if(typeof a!==typeof b||a===null||b===null)return path;
 if(typeof a!=='object')return path;
 const ak=Object.keys(a),bk=Object.keys(b);if(ak.length!==bk.length||ak.some(k=>!Object.hasOwn(b,k)))return path+'.keys';
 for(const k of ak){const mismatch=same(a[k],b[k],path+'.'+k);if(mismatch)return mismatch;}
 return null;
}
export function compareExactResults(oracle,fast){
 const finite=value=>typeof value==='number'?Number.isFinite(value):value&&typeof value==='object'?Object.values(value).every(finite):true;
 const mismatch=same(oracle.hit,fast.hit,'hit')||(!finite(fast.hit)?'hit.nonfinite':null)||(!Object.is(oracle.unresolved,fast.unresolved)?'unresolved':null)||(!Object.is(oracle.trianglePairs,fast.trianglePairs)?'trianglePairs':null);
 return {matched:!mismatch,mismatch};
}
function oracleView(surface){
 // Both constructors use the same immutable R02 topology/influence builder.
 // Share that read-only tree, while every pose/vertex/bound cache is separate.
 return Object.assign(Object.create(OracleSurface.prototype),surface,{stats:{...surface.stats}});
}
function posePair(surface,pose,world){
 const snapshot=surface.snapshot(pose.skinMatrices,world);surface.setStep(snapshot,snapshot);return snapshot;
}
function frontHeadCenter(surface,snapshot){
 let best=null,bestScore=Infinity;
 for(const t of surface.triangleIds){
  if(surface.triangleRegion[t]!=='head')continue;
  const center=[0,0,0];for(let i=0;i<3;i++){const p=surface.vertex(surface.human.faces[t*3+i],snapshot);for(let k=0;k<3;k++)center[k]+=p[k]/3;}
  const score=Math.abs(center[0])*.5-center[2];if(score<bestScore){bestScore=score;best=center;}
 }
 if(!best)throw Error('Actual CSR head surface is absent');return best;
}
function resultSummary(row){return {kind:row.kind,cache:row.cache,comparison:row.comparison,oracleMs:row.oracleMs,fastPreparationMs:row.fastPreparationMs,fastQueryMs:row.fastQueryMs,fastTotalMs:row.fastTotalMs,trianglePairs:row.fast.trianglePairs,unresolved:row.fast.unresolved,toi:row.fast.hit?.toi??null,region:row.fast.hit?.bodyRegion??null,work:row.fast.work??null};}

/** All inputs must come from the actual rendered human and two actual gloves.
 * Fixtures reproduce R02's front-head sweep, then isolate 10 mm around each
 * oracle first contact. Long reference scans are reported separately and never
 * hidden inside a claimed fixed-step query time. The target pose stays static.
 */
export function validateActualFixture({surface,pose,matrixWorld,gloves,presetIndex,poseTime,orientForward}){
 const fixtureBegin=now(),oracle=oracleView(surface),seed=posePair(oracle,pose,matrixWorld),center=frontHeadCenter(oracle,seed),[probe,guard]=gloves;
 for(const glove of gloves){glove.updateFromPose(pose.posedMatrices,surface.human.height);orientForward(glove);}
 const from=[center[0],center[1],center[2]+.5],to=[center[0],center[1],center[2]-.1];
 probe.position.fromArray(from);const previous=snapshotGlove(probe);probe.position.fromArray(to);const current=snapshotGlove(probe);
 guard.position.set(center[0],center[1],center[2]+.14);const guardSnapshot=snapshotGlove(guard);
 const referenceBegin=now(),referenceBody=oracleBody(oracle,previous,current),referenceGuard=oracleGuard(previous,current,guardSnapshot,guardSnapshot),referenceMs=now()-referenceBegin;
 if(referenceBody.unresolved||referenceGuard.unresolved)throw Error('Reference fixture is unresolved; no benchmark hit can be certified');
 if(!referenceBody.hit||!referenceGuard.hit)throw Error('Actual reference fixture has no body or guard contact');
 const makeShort=reference=>{const distance=-.6*reference.hit.toi;return {previous:shifted(previous,[0,0,distance+.005]),current:shifted(previous,[0,0,distance-.005]),from:from.map((v,k)=>v+(k===2?distance+.005:0)),to:from.map((v,k)=>v+(k===2?distance-.005:0))};};
 const bodyFixture=makeShort(referenceBody),guardFixture=makeShort(referenceGuard),fixturePreparationMs=now()-fixtureBegin,rows=[];
 posePair(surface,pose,matrixWorld);posePair(oracle,pose,matrixWorld);
 let bodyPrepared=null,guardAttackPrepared=null,guardPrepared=null;
 for(const kind of ['body','guard'])for(const cache of ['cold','warm']){
  const fixture=kind==='body'?bodyFixture:guardFixture;
  let begin=now();
  if(cache==='cold'){
   if(kind==='body')bodyPrepared=prepareGloveStep(fixture.previous,fixture.current);
   else {guardAttackPrepared=prepareGloveStep(fixture.previous,fixture.current);guardPrepared=prepareGloveStep(guardSnapshot,guardSnapshot);prepareGuardHierarchy(guardPrepared);}
  }
  const fastPreparationMs=cache==='cold'?now()-begin:0;
  // Keep oracle first in each paired measurement; report this order explicitly.
  begin=now();const expected=kind==='body'?oracleBody(oracle,fixture.previous,fixture.current):oracleGuard(fixture.previous,fixture.current,guardSnapshot,guardSnapshot),oracleMs=now()-begin;
  begin=now();const actual=kind==='body'?fastBody(surface,fixture.previous,fixture.current,{preparedAttack:bodyPrepared}):fastGuard(fixture.previous,fixture.current,guardSnapshot,guardSnapshot,{preparedAttack:guardAttackPrepared,preparedGuard:guardPrepared}),fastQueryMs=now()-begin;
  const comparison=compareExactResults(expected,actual),row={kind,cache,comparison,oracle:expected,fast:actual,oracleMs,fastPreparationMs,fastQueryMs,fastTotalMs:fastPreparationMs+fastQueryMs};rows.push(row);
  if(!comparison.matched)throw Object.assign(Error('Oracle/fast mismatch at '+comparison.mismatch),{comparison,row});
 }
 const result={schema:'browser-actual-surface-fast-verification/1',presetIndex,poseTime,physicalStepSeconds:1/120,fixture:{target:'static actual pose',shortSweepM:.010,referenceLongSweepM:.6,referenceMs,fixturePreparationMs,center,body:{from:bodyFixture.from,to:bodyFixture.to},guard:{from:guardFixture.from,to:guardFixture.to},guardPosition:guard.position.toArray(),guardBeforeBody:referenceGuard.hit.toi<referenceBody.hit.toi},geometry:{vertices:surface.human.N,displayTriangles:surface.human.faces.length/3,collisionTriangles:surface.triangleIds.length,fullCSR:true,weightsTruncated:surface.human.report.weightsTruncated,gloveTriangles:gloves.map(g=>g.geometry.index.count/3),cuffVertices:gloves.map(g=>g._cuffVertices.length)},reference:{body:referenceBody,guard:referenceGuard},rows,summary:rows.map(resultSummary),passed:rows.every(r=>r.comparison.matched&&!r.fast.unresolved&&r.fast.hit),cacheContract:'Cold body starts with new independent target caches and new prepared glove data; cold guard has new prepared data/refitted bounds, while topology may already exist from an earlier pose. Warm fast reuses the exact same body/prepared snapshots and guard hierarchy. R02 has independent warm body caches but its API always rebuilds glove arrays. All actual preparation time is included; warm reused preparation is zero. Oracle is timed before fast in each pair.',limitations:['Single actual human and two actual gloves; not connected to the 18-arena controller.','Static target at each tested pose; independent moving-target/cuff and unresolved regressions are separate evidence.','Short rigid translation is a diagnostic path, not a recorded live punch.','Browser timings vary with JIT, GC and renderer; not an 18-arena real-time claim.']};
 return result;
}
