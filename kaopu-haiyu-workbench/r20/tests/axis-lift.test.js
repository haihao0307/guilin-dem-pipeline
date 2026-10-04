'use strict';
const assert=require('node:assert/strict'),lift=require('../src/axis-lift.js');
const old=require('./reference-core.js');
function near(a,b,e=1e-8){assert.ok(Math.abs(a-b)<e,`${a} != ${b}`)}
function verifySpine(m){for(const s of m.sections){for(const i of s.columnIndices){const v=m.positions[i].map((x,d)=>x-s.center[d]);const n=v.reduce((a,x,d)=>a+x*s.frame.normal[d],0)/s.halfWidth;const b=v.reduce((a,x,d)=>a+x*s.frame.binormal[d],0)/s.fieldDepth;assert.ok(Math.hypot(n,b)<=.72000001,'spine strictly contained by body section')}}}
function packet(m){verifySpine(m);assert.ok(m.positions.length<8000);assert.equal(m.faces.length,m.faceKinds.length);assert.equal(m.faces.length,m.faceComponents.length);assert.ok(m.positions.every(p=>p.length===3&&p.every(Number.isFinite)));const edges=new Map();for(const f of m.faces){assert.equal(new Set(f).size,3);for(const a of f)assert.ok(Number.isInteger(a)&&a>=0&&a<m.positions.length);for(let j=0;j<3;j++){let a=f[j],b=f[(j+1)%3],k=Math.min(a,b)+':'+Math.max(a,b);let v=edges.get(k)||[0,0];v[0]++;v[1]+=a<b?1:-1;edges.set(k,v)}}for(const e of edges.values()){assert.equal(e[0],2);assert.equal(e[1],0)}for(const c of m.components)assert.ok(c.signedVolume>0,`${c.id} volume ${c.signedVolume}`);assert.equal(m.diagnostics.maxAttachmentError,0);assert.ok(m.diagnostics.minBodyCurvatureMargin>12);for(const s of m.sections){for(const name of ['tangent','normal','binormal'])near(Math.hypot(...s.frame[name]),1,1e-10)}assert.ok(m.components.some(c=>c.kind==='tail'));assert.ok(m.components.some(c=>c.kind==='fin-left'));assert.ok(m.components.some(c=>c.kind==='fin-right'))}
for(const[k,stage]of[['multifrequency',4],['biomotion',5]]){
 for(const t of [0,3.17,19.2,47])for(let i=0;i<20000;i+=37){let a=lift.sourcePointByIndex(k,i,t),b=old.point(stage,i,t);near(a[0],b[0],3e-10);near(a[1],b[1],3e-10)}
 const a=lift.evaluate(k,3.17);packet(a);assert.deepEqual(a,lift.evaluate(k,3.17));assert.deepEqual(a,lift.evaluate(k,3.17,{camera:{yaw:12}}));const loop=lift.evaluate(k,3.17+lift.AUTHOR_PERIOD);for(let i=0;i<a.positions.length;i++)for(let d=0;d<3;d++)near(a.positions[i][d],loop.positions[i][d],1e-6);
 const rest=lift.evaluate(k,0,{motion:0}),frozen=lift.evaluate(k,17,{motion:0});assert.deepEqual(rest.positions,frozen.positions);assert.deepEqual(rest.faces,frozen.faces);assert.deepEqual(rest.lines,frozen.lines);
 const moved=lift.evaluate(k,3.17+lift.AUTHOR_STEP);assert.ok(a.positions.some((p,i)=>Math.hypot(...p.map((x,d)=>x-moved.positions[i][d]))>.01));
 packet(lift.evaluate(k,0,{detail:1,thickness:1,depth:1}));
 for(let frame=0;frame<480;frame++){let m=lift.evaluate(k,frame*lift.AUTHOR_STEP,{detail:0});assert.ok(m.positions.every(p=>p.every(Number.isFinite)));assert.ok(m.components.every(c=>c.signedVolume>0));assert.equal(m.diagnostics.maxAttachmentError,0);assert.ok(m.diagnostics.minBodyCurvatureMargin>12);verifySpine(m)}
 console.log('PASS',k,'source reference; capped oriented organs; roots; curvature; deterministic/camera; loop; motion=0; 480 finite positive-volume frames; vertices',a.positions.length);
}
console.log('ALL R20 NUMERICAL TESTS PASSED');
