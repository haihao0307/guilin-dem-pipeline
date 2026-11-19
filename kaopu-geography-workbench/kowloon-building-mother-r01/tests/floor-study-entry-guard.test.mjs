import test from 'node:test';import assert from 'node:assert/strict';
import {assemblyEntryStart,ASSEMBLY_ENTRY_GUARD_GLSL} from '../whole-building-floor-study-r01/ray-entry-guard.mjs';
const f=Math.fround;
test('actual speckled cap witness is positive after broad-phase entry guard',()=>{
 const ro=[1,6.400000095367432,6],rd=[-.3721560537815094,-.4162429869174957,-.829603374004364],boundsLo=(3-ro[1])/rd[1],old=f(boundsLo),oldY=f(ro[1]+f(rd[1]*old));
 assert.ok(oldY<3);const start=f(assemblyEntryStart({low:[-10,2.82,-10],high:[10,3,10],ro,rd,boundsLo:old,clipLo:3.79699516})),y=f(ro[1]+f(rd[1]*start)),cap=f((3-y)/rd[1]);
 assert.ok(y>3);assert.ok(cap>0);assert.ok(Math.abs(f(start+cap)-old)<2e-6);
});
test('physical clip entry is never moved back, including clips inside the slab',()=>{
 for(const clipLo of[0,2,8.25,8.5,20]){const a={low:[-10,2.82,-10],high:[10,3,10],ro:[0,6.4,0],rd:[0,-.4,0],boundsLo:8.5,clipLo};const s=assemblyEntryStart(a);assert.ok(s>=clipLo);assert.ok(s>=0);if(clipLo>=8.5)assert.equal(s,clipLo);}
});
test('inside-AABB and parallel axes do not invent a negative entry',()=>{
 assert.equal(assemblyEntryStart({low:[-1,-1,-1],high:[1,1,1],ro:[0,0,0],rd:[1,0,0],boundsLo:0}),0);
 const o={low:[-1,-1,-1],high:[1,1,1],ro:[2,0,0],rd:[-1,1e-14,0],boundsLo:1,clipLo:.9};assert.ok(assemblyEntryStart(o)<1);assert.ok(assemblyEntryStart(o)>=.9);
});
test('grazing entry error includes direction and large local-frame subtraction scale',()=>{
 const a={low:[-1,-1,-1],high:[1,1,1],ro:[2,0,0],rd:[-1e-5,0,0],boundsLo:(1-2)/(-1e-5),clipLo:99990};const x=assemblyEntryStart(a),y=assemblyEntryStart({...a,eye:[1e5+2,0,0],origin:[1e5,0,0]});assert.ok(x<1e5);assert.ok(y<=x);assert.ok(y>=a.clipLo);
 assert.match(ASSEMBLY_ENTRY_GUARD_GLSL,/max\(clipLo,max\(0\.,boundsLo-pad\)\)/);
});
