import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{footbridgeMembers,recommendFootbridgeHostPlacement}from'../../native-footbridge.mjs';
import{castColumnMembers}from'../../native-cast-column.mjs';import{sourceBeamBasis,sourceToStation,stationMemberBounds}from'../../native-station-lamps.mjs';
const{host}=JSON.parse(fs.readFileSync(new URL('./footbridge-host-source-r04.json',import.meta.url),'utf8')),proposal=recommendFootbridgeHostPlacement(host);
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],identity=[[1,0,0],[0,1,0],[0,0,1]];
// Exact OBB separating-axis test. Cylinder/flute/hex bounds enclose the real
// section. Tapered base bounds use16 enclosing height slabs, not a broad cuboid.
const boundsCache=new WeakMap();const bounds=o=>{if(!boundsCache.has(o))boundsCache.set(o,stationMemberBounds(o));return boundsCache.get(o);};
function overlap(a,b){const ab=bounds(a),bb=bounds(b);if([0,1,2].some(k=>ab.max[k]<=bb.min[k]||bb.max[k]<=ab.min[k]))return false;const axes=[...a.frame,...b.frame,...a.frame.flatMap(u=>b.frame.map(v=>cross(u,v)))],delta=sub(a.center,b.center);for(const axis of axes){if(dot(axis,axis)<1e-16)continue;const radius=o=>o.frame.reduce((s,f,i)=>s+Math.abs(dot(f,axis))*o.extent[i],0);if(Math.abs(dot(delta,axis))>=radius(a)+radius(b)-1e-10)return false;}return true;}
function columnBounds(){const all=[];
 for(const x of[-30,-10,10,30])for(const z of x===10?host.supports.retainedBoardingPostLocalZ:Array.from({length:19},(_,i)=>-10-i*7.5))for(const m of castColumnMembers()){
  let extent,frame=identity,center=m.center;
  if(m.type==='beam'){center=m.a.map((x,i)=>(x+m.b[i])/2);frame=sourceBeamBasis(sub(m.b,m.a));extent=[m.width/2,Math.hypot(...sub(m.b,m.a))/2,m.depth/2];}
  else if(m.type==='box')extent=m.size.map(x=>x/2);
  else if(m.type==='torus')extent=[m.radius+m.tube,m.tube,m.radius+m.tube];
  else if(m.type==='hex'){frame=sourceBeamBasis(m.direction);extent=[m.radius,m.depth/2,m.radius];}
  else{const r=m.radius??Math.max(m.bottomRadius,m.topRadius);extent=[r,m.height/2,r];}
  center=sourceToStation(center);frame=frame.map(sourceToStation);
  if(m.type==='cone'){for(let i=0;i<16;i++){const y0=-m.height/2+i*m.height/16,y1=y0+m.height/16,r0=m.bottomRadius+(m.topRadius-m.bottomRadius)*i/16,r1=m.bottomRadius+(m.topRadius-m.bottomRadius)*(i+1)/16;all.push({id:`column(${x},${z})-${m.id}-slab${i}`,center:add(center,[x,(y0+y1)/2,z]),extent:[Math.max(r0,r1),(y1-y0)/2,Math.max(r0,r1)],frame});}}
  else all.push({id:`column(${x},${z})-${m.id}`,center:add(center,[x,0,z]),extent,frame});
 }return all;
}
const columns=columnBounds();
function columnCollisions(options){const collisions=[];for(const a of footbridgeMembers(options)){if(a.id.startsWith('bridge-transfer-girder-'))continue;for(const b of columns)if(overlap(a,b))collisions.push([a.id,b.id]);}return collisions;}
test('rear footbridge avoids preserved Session actor/accessory sweep and retains lateral passage',()=>{
 assert.equal(proposal.options.bridgeZ,-120.5);assert.equal(proposal.steps,33);assert(proposal.stairZ[1]<host.passengerClearance.local.minZ);
 assert(proposal.passageNearM>=1.2);assert(proposal.otherIslandSidePassageM>=1.2);
 const parts=footbridgeMembers(proposal.options);
 for(let i=0;i<4;i++){const s=parts.filter(m=>m.id.startsWith('platform-'+i+'-stair-')).map(stationMemberBounds),lo=Math.min(...s.map(b=>b.min[0])),hi=Math.max(...s.map(b=>b.max[0]));assert(lo>=proposal.options.platformCenters[i]-proposal.options.platformHalfWidths[i]);assert(hi<=proposal.options.platformCenters[i]+proposal.options.platformHalfWidths[i]);}
});
test('all restored bridge solids clear every retained complete column, except intended girder-bearing junctions',()=>{
 assert.deepEqual(columnCollisions(proposal.options),[]);
 // Regression: the initially suggested round-number position genuinely fails.
 const old=columnCollisions({...proposal.options,bridgeZ:-120});assert(old.some(p=>p[0]==='bridge-deck'&&p[1]==='column(10,-118.75)-shaft'));
});
test('one identity-preserving bench relocation clears the full stair without deleting furniture',()=>{
 assert.deepEqual(proposal.benchRelocations,[{from:-111.25,sourceLocalZ:-36.25,to:-96.25,alreadyApplied:false}]);
 const b=host.benches,locations=b.retainedLocalZ.map(z=>z===-111.25?-96.25:z);assert.equal(locations.length,6);assert.equal(new Set(locations).size,6);assert.equal(b.retainedLocalZ[3],-111.25,'Proposal must not mutate host');
 const boxes=[];for(const row of[-30,-10,10,30])for(const z of row===10?locations:Array.from({length:6},(_,i)=>-13.75-i*22.5))boxes.push({id:`bench(${row},${z})`,center:[row===10?b.boardingRowLocalXM:row,1.53,z],extent:[.4,.7,1.7],frame:identity});
 const collisions=[];for(const a of footbridgeMembers(proposal.options))for(const bench of boxes)if(overlap(a,bench))collisions.push([a.id,bench.id]);assert.deepEqual(collisions,[]);
});

test('recommending the already-applied source bench move is idempotent and preserves its identity',()=>{
 const updated=structuredClone(host),index=updated.benches.sourceLocalZ.indexOf(-36.25);updated.benches.retainedLocalZ[index]=-96.25;const again=recommendFootbridgeHostPlacement(updated);
 assert.deepEqual(again.options,proposal.options);assert.deepEqual(again.benchRelocations,[{from:-111.25,sourceLocalZ:-36.25,to:-96.25,alreadyApplied:true}]);assert.deepEqual(again.stairZ,proposal.stairZ);
 const bad=structuredClone(updated);bad.benches.retainedLocalZ[index]=-110;assert.throws(()=>recommendFootbridgeHostPlacement(bad),/new bridge placement audit/);
});
