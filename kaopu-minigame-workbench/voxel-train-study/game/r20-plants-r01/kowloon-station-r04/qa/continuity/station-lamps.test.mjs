import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{stationLampMembers,stationLampWGSL,sourceToStation,stationToSource,stationMemberPoint,stationMemberSample,sourceBeamBasis}from'../../native-station-lamps.mjs';
import{scanWGSLIdentifiers}from'../wgsl-identifiers.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./station-lamps-source-r02.json',import.meta.url),'utf8'));
const close=(a,b,tolerance=2e-12)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>assert(Math.abs(x-b[i])<tolerance,JSON.stringify({a,b})));};
const subtract=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const parts=stationLampMembers(fixture.parameters);
test('all six accepted lamp children retain role, size and attachment-relative placement',()=>{
 assert.equal(parts.length,6);assert.equal(fixture.parts.length,6);
 for(const p of fixture.parts){const m=parts.find(m=>m.id===p.id.slice('lamp-sign-0-0-'.length)),s=p.shape;assert(m,p.id);assert.equal(m.materialRole,p.materialRole);assert.equal(m.feature,p.feature);assert.equal(m.sourceShape.type,s.type);
  if(s.center){close(m.sourceShape.center,subtract(s.center,fixture.sourceOrigin));close(m.center,sourceToStation(subtract(s.center,fixture.sourceOrigin)));}
  if(s.size)close(m.sourceShape.size,s.size);
  if(s.type==='beam'){for(const k of['a','b'])close(m.sourceShape[k],subtract(s[k],fixture.sourceOrigin));assert.equal(m.width,s.width);assert.equal(m.depth,s.depth);}
  if(s.type==='cylinder'){for(const k of['radius','height','segments'])assert.equal(m.sourceShape[k],s[k]);assert.equal(m.sourceShape.radiusTop,s.radiusTop);}
  if(p.lettering)assert.deepEqual(m.lettering,p.lettering);
 }
});
test('source-to-station rotation is proper, invertible, and every material frame is right handed',()=>{
 const basis=[[1,0,0],[0,1,0],[0,0,1]].map(sourceToStation);assert.equal(dot(cross(basis[0],basis[1]),basis[2]),1);
 close(stationToSource(sourceToStation([3,4,-7])),[3,4,-7]);
 for(const m of parts){assert(Math.abs(dot(cross(m.frame[0],m.frame[1]),m.frame[2])-1)<1e-12);close(stationMemberSample(m,stationMemberPoint(m,[.021,.03,-.017])).q,[.021,.03,-.017]);}
 const arm=parts.find(m=>m.id==='arm');close(arm.b.map((x,i)=>x-arm.a[i]),[0,0,-1.2]);const sign=parts.find(m=>m.id==='sign');assert.equal(sign.center[0],.03);assert.equal(sign.center[2],-.72);
});
test('lamp datums adapt without proxy enlargement or losing tapered shade/glass/sign',()=>{
 const m=stationLampMembers({deck:.85});assert.equal(m.find(x=>x.id==='shade').radius,.24);assert.equal(m.find(x=>x.id==='shade').topRadius,.095);assert.equal(m.find(x=>x.id==='bulb').height,.08);assert.deepEqual(m.find(x=>x.id==='sign').extent,[.56,.26,.0225]);
 assert.equal(m.find(x=>x.id==='stem').center[1],.85+3.9-.18);
 assert.throws(()=>stationLampMembers({lampHeight:.1}));assert.throws(()=>stationLampMembers({row:4}));
});
test('WGSL emits each real source child with physical q, extent, material and direction frame',()=>{
 const code=stationLampWGSL({materialDistance:'lampPhysicalDistance'});assert.deepEqual(scanWGSLIdentifiers(code),[]);
 for(const m of parts)assert(code.includes('// '+m.id+': complete R02'));
 assert(code.includes('memberCone(q,0.24,0.095,0.25,24u)'));assert(code.includes('memberCone(q,0.11,0.11,0.08,16u)'));
 assert(code.includes('frame:mat3x3<f32>'));assert(code.includes('h.d=lampPhysicalDistance(h,p)'));assert(code.includes('stationLampMemberAt(p,origin,i)'));
 for(const token of['textureSample','sampler','vertexBuffer','BufferGeometry','THREE.'])assert(!code.includes(token));
});
