import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{footbridgeMembers,footbridgePlan,footbridgeWGSL,createFootbridgeSampler,footbridgeBounds,recommendFootbridgeHostPlacement}from'../../native-footbridge.mjs';
import{sourceToStation,stationMemberPoint,stationMemberBounds}from'../../native-station-lamps.mjs';
import{scanWGSLIdentifiers}from'../wgsl-identifiers.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./footbridge-source-r02.json',import.meta.url),'utf8'));
const close=(a,b,tolerance=2e-10)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>assert(Math.abs(x-b[i])<tolerance,JSON.stringify({a,b})));};
const sub=(a,b)=>a.map((x,i)=>x-b[i]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// Independent source Quaternion.setFromUnitVectors(+Y, direction) equivalent.
function quaternionBasis(a,b){const delta=sub(b,a),l=Math.hypot(...delta),n=delta.map(x=>x/l),xyz=[n[2],0,-n[0]],qw=1+n[1],len=Math.hypot(...xyz,qw),q=xyz.map(x=>x/len),w=qw/len;return[[1,0,0],[0,1,0],[0,0,1]].map(v=>{const t=cross(q,v).map(x=>x*2),u=cross(q,t);return v.map((x,i)=>x+w*t[i]+u[i]);});}
const members=footbridgeMembers(fixture.parameters);
test('all895 frozen bridge children survive with identical source sections, roles and names',()=>{
 assert.equal(fixture.parts.length,895);assert.equal(members.length,895);
 for(let i=0;i<members.length;i++){const m=members[i],p=fixture.parts[i],s=p.shape;assert.equal(m.id,p.id);assert.equal(m.materialRole,p.materialRole);assert.equal(m.feature,p.feature);assert.equal(m.type,s.type);
  for(const k of['center','size','a','b'])if(s[k])close(m.sourceShape[k],s[k]);
  for(const k of['width','depth'])if(s[k])assert.equal(m.sourceShape[k],s[k]);
  if(s.center)close(m.center,sourceToStation(s.center));
  if(s.type==='beam'){close(m.a,sourceToStation(s.a));close(m.b,sourceToStation(s.b));const sourceFrame=quaternionBasis(s.a,s.b);for(let j=0;j<3;j++)close(m.frame[j],sourceToStation(sourceFrame[j]));}
  assert(Math.abs(dot(cross(m.frame[0],m.frame[1]),m.frame[2])-1)<1e-10);
 }
});
test('each accepted family is complete and every source-west landing remains open',()=>{
 assert.equal(members.filter(m=>m.id.startsWith('bridge-transfer-girder-')).length,4);
 assert.equal(members.filter(m=>m.id.includes('-tread-')).length,124);assert.equal(members.filter(m=>m.id.includes('-stringer-')).length,8);assert.equal(members.filter(m=>m.id.includes('-handrail-')).length,8);assert.equal(members.filter(m=>m.id.includes('-post-')).length,128);
 const sample=createFootbridgeSampler(fixture.parameters),plan=sample.plan;
 for(const st of plan.stairs){const p=sourceToStation([st.end[0],plan.deckY+.6,st.end[2]]);assert(sample(p).d>.4,st.id+' landing opening is obstructed');}
});
test('R04 scales finite repetition from the same dimensions and keeps every stair reachable',()=>{
 const plan=footbridgePlan(),parts=footbridgeMembers(),b=footbridgeBounds();assert.equal(parts.length,1009);
 for(const st of plan.stairs){assert.equal(st.steps,33);assert(st.rise<=.18);assert.equal(st.tread,.29);assert.equal(st.width,1.5);assert(Math.abs(st.start[1]+st.steps*st.rise-plan.deckY)<1e-12);assert.equal(st.end[0],118.8);assert(Math.abs(st.start[0]-109.23)<1e-10);}
 assert.equal(parts.filter(m=>m.id.includes('-tread-')).length,132);assert.equal(parts.filter(m=>m.id.includes('-post-')).length,136);
 assert(b.min[2]>-145&&b.max[2]<-10);assert(b.max[1]<9.25);assert.equal(plan.deckY-.32,6.33);
});
test('compact analytic repeated-member queries match every-child union with material applied first',()=>{
 const options={stairCenters:[-28.7,-8.7,8.8,28.7]},distance=(h,p,m)=>h.baseD+Math.sin(m.member*1.791+p[0]*.17)*.025;
 const fast=createFootbridgeSampler(options,{materialDistance:distance}),full=createFootbridgeSampler(options,{materialDistance:distance,exhaustive:true});
 let seed=982433;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const points=[];for(let i=0;i<350;i++)points.push([-35+random()*70,.5+random()*8,-125+random()*20]);
 for(let i=0;i<fast.parts.length;i+=7){const m=fast.parts[i],q=m.extent.map(e=>(random()*2-1)*e);q[i%3]=m.extent[i%3]+(random()-.5)*.04;points.push(stationMemberPoint(m,q));}
 for(const p of points){const a=fast(p),b=full(p);assert(Math.abs(a.d-b.d)<1e-10,JSON.stringify({p,a:a.sourceId,b:b.sourceId,da:a.d,db:b.d}));assert(Math.abs(a.d-a.baseD)<=.025001);}
 assert.throws(()=>createFootbridgeSampler(options,{materialDistance:h=>h.baseD+.1})([0,3,-116]),/bound exceeded/);
});
test('WGSL retains per-child physical fields without unrolling895+ shader calls',()=>{
 const code=footbridgeWGSL({materialDistance:'bridgePhysicalDistance'});assert.deepEqual(scanWGSLIdentifiers(code),[]);
 assert(code.includes('1009 complete source children in 51 finite analytic groups'));assert(code.length<25000);
 assert(code.includes('h.d=bridgePhysicalDistance(h,p)'));assert(code.includes('frame:mat3x3<f32>'));assert(code.includes('let s=vec3<f32>(-p.z,p.y,p.x)'));
 assert(code.includes('bridge-deck'));assert(code.includes('platform-3-stair-post-1-32'));assert(!code.includes('recordPart('));
 for(const token of['textureSample','sampler','vertexBuffer','BufferGeometry','THREE.'])assert(!code.includes(token));
});
