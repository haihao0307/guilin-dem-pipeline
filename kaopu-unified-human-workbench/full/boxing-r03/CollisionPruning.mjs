/** Conservative broad phase for the exact frozen-axis, translating capsule
 * approximation used by CollisionWorld. This rejects impossible pairs only;
 * every accepted contact is still decided by the official Jolt WASM cast. */
const finite3=x=>Array.isArray(x)&&x.length===3&&x.every(Number.isFinite);
export function sweptBounds(from,to,extent){
  if(!finite3(from)||!finite3(to)||!finite3(extent)||extent.some(x=>x<0))throw Error('Invalid swept bounds');
  return {min:from.map((x,k)=>Math.min(x,to[k])-extent[k]),max:from.map((x,k)=>Math.max(x,to[k])+extent[k])};
}
export function capsuleExtent(target){
  const q=target.rotation||[0,0,0,1],h=target.halfHeight||0,r=target.radius;
  if(q.length!==4||!q.every(Number.isFinite)||Math.abs(Math.hypot(...q)-1)>1e-4||!(r>0&&Number.isFinite(r)&&h>=0&&Number.isFinite(h)))throw Error('Invalid capsule extent');
  const [x,y,z,w]=q,axis=[2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)];return axis.map(v=>Math.abs(v)*h+r);
}
export function canSweptShapesMeet(attack,target){
  const a=sweptBounds(attack.from,attack.to,[attack.radius,attack.radius,attack.radius]);
  const b=sweptBounds(target.from,target.to,capsuleExtent(target));
  return a.min.every((v,k)=>v<=b.max[k]+1e-4&&a.max[k]>=b.min[k]-1e-4);
}
export function stepWithConservativePruning(world,{time,dt,attacks,targets}){
  let pairs=0,rejected=0;const events=[];
  for(const a of attacks){const candidates=[];for(const t of targets){if(a.actorId===t.actorId||a.pairId!==t.pairId)continue;pairs++;if(canSweptShapesMeet(a,t))candidates.push(t);else rejected++;}
    // Calling even with zero candidates lets the engine re-arm a separated hand.
    events.push(...world.step({time,dt,attacks:[a],targets:candidates}));
  }
  return {events,potentialPairs:pairs,broadPhaseRejected:rejected,narrowPhasePairs:pairs-rejected};
}
