import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{stationLampMembers,stationMemberBounds,stationMemberPoint,stationMemberSample}from'../../native-station-lamps.mjs';
const{host}=JSON.parse(fs.readFileSync(new URL('./footbridge-host-source-r04.json',import.meta.url),'utf8')),deck=.85,center=[0,deck+3.15,-.70],half=[.271,.901,.761],members=stationLampMembers({deck});
const ordinary=Array.from({length:19},(_,i)=>-10-i*7.5),boarding=host.supports.retainedBoardingPostLocalZ;
const shiftedNearest=(z,posts)=>posts.reduce((best,p)=>Math.abs(z-p+.70)<Math.abs(z-best+.70)?p:best,posts[0]);
const unshiftedNearest=(z,posts)=>posts.reduce((best,p)=>Math.abs(z-p)<Math.abs(z-best)?p:best,posts[0]);
const ordinaryFormula=z=>-10+Math.max(-18,Math.min(0,Math.round((z+10+.70)/7.5)))*7.5;
const box=(p,b)=>{const q=p.map((x,i)=>Math.abs(x)-b[i]);return Math.hypot(...q.map(x=>Math.max(x,0)))+Math.min(Math.max(...q),0);};
const bound=(p,post)=>box([p[0],p[1]-center[1],p[2]-post+.70],half);
const actual=(p,post)=>Math.min(...members.map(m=>stationMemberSample(m,[p[0],p[1],p[2]-post]).d));
test('ordinary7.5m and densified3.75m selections equal the full minimum of all lamp envelopes',()=>{
 for(const posts of[ordinary,boarding])for(let i=0;i<=600;i++){const z=-151+i*.245,p=[.11,.2+(i%37)*.21,z],post=posts===ordinary?ordinaryFormula(z):shiftedNearest(z,posts),best=Math.min(...posts.map(s=>bound(p,s)));assert(Math.abs(bound(p,post)-best)<1e-10,JSON.stringify({p,post,best}));}
 for(const z of[-151,-101.876,-12,-8])assert.equal(ordinaryFormula(z),shiftedNearest(z,ordinary));
});
test('asymmetric shade at a dense-row cell boundary cannot use the farther columns lamp',()=>{
 const p=[0,4.31,-101.876],wrong=unshiftedNearest(p[2],boarding),right=shiftedNearest(p[2],boarding);assert.equal(wrong,-103.75);assert.equal(right,-100);
 assert(bound(p,wrong)>1.8);assert(actual(p,right)<.46);assert.equal(actual(p,right),Math.min(...boarding.map(z=>actual(p,z))));assert(bound(p,right)<=actual(p,right));
});
test('all six children plus30.01mm matter fit the independent envelope and its unique near-query cell',()=>{
 let corners=0;
 for(const posts of[ordinary,boarding])for(const post of posts)for(const m of members){const b=stationMemberBounds(m);for(let k=0;k<3;k++){assert(b.min[k]-.03001>=center[k]-half[k]);assert(b.max[k]+.03001<=center[k]+half[k]);}
  for(let mask=0;mask<8;mask++){const p=stationMemberPoint(m,m.extent.map((x,k)=>x*(mask>>k&1?1:-1)));p[2]+=post;assert.equal(shiftedNearest(p[2],posts),post);assert(bound(p,post)<0);assert.equal(posts.filter(z=>bound(p,z)<.15).length,1);corners++;}
 }
 assert.equal(corners,1824);
});
test('active station field uses independent shifted lamp selection and keeps material winner raw metadata',()=>{
 const code=fs.readFileSync(new URL('../../station-field.mjs',import.meta.url),'utf8');
 assert(code.includes('var lampOffsetZ=rep(p.z-SHED_FRONT+.70,7.5,-SHED_BAYS,0.)-.70;'));
 assert(code.includes('if(abs(offset+.70)<abs(lampOffsetZ+.70)){lampOffsetZ=offset;}'));
 assert(code.includes('p.z-lampOffsetZ'));assert(code.includes('lampOffsetZ+.70),vec3<f32>(.271,.901,.761)'));
 assert(code.includes('HitField(lamp.baseD,lamp.id,lamp.q,184.,lamp.baseD,lamp.extent,lamp.member)'));
 assert(code.includes('HitField(bridgeHit.baseD,bridgeHit.id,bridgeHit.q,185.,bridgeHit.baseD,bridgeHit.extent,bridgeHit.member)'));
 assert(code.includes('stationCandidatePhysicalDistance(HitField(h.baseD,h.id,h.q,184.,h.baseD,h.extent,h.member)'));
 assert(code.includes('stationCandidatePhysicalDistance(HitField(h.baseD,h.id,h.q,185.,h.baseD,h.extent,h.member)'));
});
