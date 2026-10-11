import * as T from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
/** Offline local radius clearance for interpolated fibres; no surface attraction. */
export function strandClearanceR30(geometry,{clearance=.0021,cell=.025}={}){const p=geometry.attributes.position.array,n=geometry.attributes.normal.array,ix=geometry.index.array,tris=[],grid=new Map();for(let i=0;i<ix.length;i+=3){const ids=Array.from(ix.subarray(i,i+3)),vs=ids.map(id=>new T.Vector3().fromArray(p,id*3)),id=tris.length;tris.push({ids,tri:new T.Triangle(...vs)});const lo=[0,1,2].map(k=>Math.floor(Math.min(...vs.map(v=>v.getComponent(k)))/cell)),hi=[0,1,2].map(k=>Math.floor(Math.max(...vs.map(v=>v.getComponent(k)))/cell));for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const key=[x,y,z].join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(id);}}
 let corrections=0,maxDisplacement=0,triangleTests=0;const candidate=new T.Vector3(),closest=new T.Vector3(),normal=new T.Vector3(),bary=new T.Vector3();function project(point,margin=clearance){const original=point.clone();for(let pass=0;pass<4;pass++){const c=point.toArray().map(x=>Math.floor(x/cell)),seen=new Set();let best=null,d=Infinity;for(let x=c[0]-1;x<=c[0]+1;x++)for(let y=c[1]-1;y<=c[1]+1;y++)for(let z=c[2]-1;z<=c[2]+1;z++)for(const id of grid.get([x,y,z].join(','))||[]){if(seen.has(id))continue;seen.add(id);triangleTests++;const r=tris[id];r.tri.closestPointToPoint(point,candidate);const dd=candidate.distanceToSquared(point);if(dd<d){d=dd;best=r;closest.copy(candidate);}}if(!best||d>.04*.04)break;best.tri.getBarycoord(closest,bary);normal.set(0,0,0);best.ids.forEach((id,k)=>normal.addScaledVector(new T.Vector3().fromArray(n,id*3),bary.getComponent(k)));normal.normalize();const signed=point.clone().sub(closest).dot(normal);if(signed>=margin)break;point.addScaledVector(normal,Math.min(.01,margin-signed));corrections++;}maxDisplacement=Math.max(maxDisplacement,point.distanceTo(original));return point;}

 /** A bounded STATIC prefix-only repair. Reuses the actual-body triangle grid.
  * Untouched strands keep bit-identical FP32 texels. Endpoints 0 and the release
  * point are fixed, so the original free section and project() are unchanged.
  * This detects centreline intersections, not a complete prefix radius test.
  */
 function repairPrefixSegments({pointData,count,segments=64,surfaceSegments=20,
   maxPasses=6,maxStepM=.00075,maxTotalM=.003,skinGapM=.00012,endpointEpsilonM=.00001}={}){
  const started=performance.now(),per=segments+1;
  if(!(pointData instanceof Float32Array)||!Number.isInteger(count)||count<1||pointData.length<count*per*4)throw Error('Invalid packed prefix repair input');
  if(surfaceSegments<2||surfaceSegments>=segments||!Number.isInteger(maxPasses)||maxPasses<1||maxPasses>8||maxStepM<=0||maxStepM>.001||maxTotalM<=0||maxTotalM>.003||skinGapM<=0)throw Error('Prefix repair limits exceed the bounded local policy');
  const stats={enabled:true,method:'finite segment/actual-body triangle intersections; bounded outward native-normal endpoint repair',
   scope:'prefix centreline only; fixed root 0 and release point; no complete prefix-radius guarantee',
   maxPasses,maxStepLimitM:maxStepM,maxTotalTravelLimitM:maxTotalM,skinGapM,endpointEpsilonM,
   fixedPointIndices:[0,surfaceSegments],testedSegments:0,triangleTests:0,initialCrossingSegments:0,
   strandsInitiallyAffected:0,repairedStrands:0,remainingCrossingSegments:0,remainingStrands:0,
   correctionSteps:0,correctedVertices:0,maxStepAppliedM:0,maxCumulativeTravelM:0,maxDisplacementM:0,
   maxPassesUsed:0,examples:[],remainingExamples:[],physics:false};
  const ray=new T.Ray(),a=new T.Vector3(),b=new T.Vector3(),delta=new T.Vector3(),hit=new T.Vector3(),weights=new T.Vector3();
  const getPoint=(strand,j,out)=>out.fromArray(pointData,(strand*per+j)*4);
  function crossings(strand){
   const result=[];
   for(let j=1;j<=surfaceSegments;j++){
    getPoint(strand,j-1,a);getPoint(strand,j,b);delta.copy(b).sub(a);const length=delta.length();if(length<1e-8)continue;
    stats.testedSegments++;ray.set(a,delta.divideScalar(length));
    const lo=[0,1,2].map(k=>Math.floor(Math.min(a.getComponent(k),b.getComponent(k))/cell));
    const hi=[0,1,2].map(k=>Math.floor(Math.max(a.getComponent(k),b.getComponent(k))/cell));
    const seen=new Set();let found=false;
    for(let x=lo[0];x<=hi[0]&&!found;x++)for(let y=lo[1];y<=hi[1]&&!found;y++)for(let z=lo[2];z<=hi[2]&&!found;z++)for(const id of grid.get([x,y,z].join(','))||[]){
     if(seen.has(id))continue;seen.add(id);stats.triangleTests++;const record=tris[id];
     if(!ray.intersectTriangle(record.tri.a,record.tri.b,record.tri.c,false,hit))continue;
     const distance=hit.distanceTo(a);if(distance<=endpointEpsilonM||distance>=length-endpointEpsilonM)continue;
     record.tri.getBarycoord(hit,weights);const nativeNormal=new T.Vector3();
     record.ids.forEach((vertex,k)=>nativeNormal.addScaledVector(new T.Vector3().fromArray(n,vertex*3),weights.getComponent(k)));
     const faceNormal=record.tri.getNormal(new T.Vector3());
     if(nativeNormal.lengthSq()>1e-12){nativeNormal.normalize();if(faceNormal.dot(nativeNormal)<0)faceNormal.negate();}else nativeNormal.copy(faceNormal);
     if(nativeNormal.dot(faceNormal)<.25)nativeNormal.copy(faceNormal);
     result.push({segment:j,triangle:id,point:hit.clone(),normal:nativeNormal,faceNormal});found=true;break;
    }
   }
   return result;
  }
  // Serialization-only inspection of unresolved geometry. This does not alter
  // contact selection, displacements, pass limits or the original free solver.
  function describeRemainingHit(strand,crossing,original,travel){
   const record=tris[crossing.triangle],endIndices=[crossing.segment-1,crossing.segment];
   const ends=endIndices.map(j=>getPoint(strand,j,new T.Vector3()));
   const nativeWeights=record.tri.getBarycoord(crossing.point,new T.Vector3());
   const nativeNormal=new T.Vector3();
   record.ids.forEach((vertex,k)=>nativeNormal.addScaledVector(new T.Vector3().fromArray(n,vertex*3),nativeWeights.getComponent(k)));
   const nativeLength=nativeNormal.length();if(nativeLength>0)nativeNormal.divideScalar(nativeLength);
   return{
    segment:crossing.segment,triangle:crossing.triangle,point:crossing.point.toArray(),
    segmentLengthM:ends[0].distanceTo(ends[1]),
    endpoints:endIndices.map((j,k)=>({pointIndex:j,position:ends[k].toArray(),
     originalPosition:(original.get(j)||ends[k]).toArray(),radiusM:pointData[(strand*per+j)*4+3],
     signedGapM:ends[k].clone().sub(crossing.point).dot(crossing.faceNormal),
     cumulativeRepairTravelM:travel.get(j)||0})),
    faceNormal:crossing.faceNormal.toArray(),
    geometricFaceNormal:record.tri.getNormal(new T.Vector3()).toArray(),
    nativeNormal:nativeLength>0?nativeNormal.toArray():null,
    repairDirection:crossing.normal.toArray(),
    nativeToFaceAlignment:nativeLength>0?nativeNormal.dot(crossing.faceNormal):null,
    repairToFaceAlignment:crossing.normal.dot(crossing.faceNormal),
    triangleVertexIds:[...record.ids],
    triangleVertices:[record.tri.a.toArray(),record.tri.b.toArray(),record.tri.c.toArray()],
    intersectionBarycentrics:nativeWeights.toArray(),
   };
  }
  for(let strand=0;strand<count;strand++){
   let hits=crossings(strand);if(!hits.length)continue;
   stats.initialCrossingSegments+=hits.length;stats.strandsInitiallyAffected++;
   const original=new Map(),travel=new Map();
   if(stats.examples.length<16)stats.examples.push({strand,initial:hits.map(h=>({segment:h.segment,triangle:h.triangle,point:h.point.toArray()}))});
   for(let pass=0;pass<maxPasses&&hits.length;pass++){
    stats.maxPassesUsed=Math.max(stats.maxPassesUsed,pass+1);let moved=false;
    for(const crossing of hits)for(const j of [crossing.segment-1,crossing.segment]){
     if(j===0||j===surfaceSegments)continue;
     const q=(strand*per+j)*4,current=new T.Vector3().fromArray(pointData,q);
     const gap=current.clone().sub(crossing.point).dot(crossing.faceNormal);
     const alignment=crossing.normal.dot(crossing.faceNormal);
     const need=(skinGapM-gap)/alignment;if(need<=0)continue;
     const used=travel.get(j)||0,remaining=maxTotalM-used;
     if(remaining<=1e-7)continue;
     // Leave a Float32 rounding allowance while respecting both step and total.
     const amount=Math.min(need,maxStepM,remaining)*.999;
     if(amount<=1e-8)continue;
     const next=current.clone().addScaledVector(crossing.normal,amount);
     for(let k=0;k<3;k++)next.setComponent(k,Math.fround(next.getComponent(k)));
     const distance=next.distanceTo(current);
     if(distance===0||distance>maxStepM||used+distance>maxTotalM)continue;
     if(!original.has(j))original.set(j,current.clone());
     next.toArray(pointData,q);travel.set(j,used+distance);moved=true;stats.correctionSteps++;
     stats.maxStepAppliedM=Math.max(stats.maxStepAppliedM,distance);
    }
    hits=crossings(strand);if(!moved)break;
   }
   stats.correctedVertices+=original.size;
   for(const [j,initial]of original){stats.maxDisplacementM=Math.max(stats.maxDisplacementM,getPoint(strand,j,new T.Vector3()).distanceTo(initial));stats.maxCumulativeTravelM=Math.max(stats.maxCumulativeTravelM,travel.get(j));}
   if(hits.length){stats.remainingCrossingSegments+=hits.length;stats.remainingStrands++;if(stats.remainingExamples.length<16)stats.remainingExamples.push({
    strand,coordinateSpace:'native body geometry / packed point local space, metres',
    hits:hits.map(h=>describeRemainingHit(strand,h,original,travel)),
    prefixPoints0To6:Array.from({length:Math.min(6,surfaceSegments)+1},(_,j)=>({pointIndex:j,
     position:getPoint(strand,j,new T.Vector3()).toArray(),
     originalPosition:(original.get(j)||getPoint(strand,j,new T.Vector3())).toArray(),
     radiusM:pointData[(strand*per+j)*4+3],cumulativeRepairTravelM:travel.get(j)||0})),
   });}
   else stats.repairedStrands++;
  }
  stats.elapsedMs=performance.now()-started;return stats;
 }
 return{project,repairPrefixSegments,report:()=>({kind:'local interpolated native-normal clearance, no attraction of safe samples',clearanceM:clearance,corrections,maxDisplacementM:maxDisplacement,triangleTests,physics:false})};}
