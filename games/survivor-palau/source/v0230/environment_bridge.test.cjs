'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const B = require('./environment_bridge.cjs');
const p = path.join(__dirname, '../v0160/frozen/original-script-0.js');
const source = fs.readFileSync(p);
const expectedBlob = 'f29816e347b7b626c8d600f14c0f23d96a07e15c';
function blob(b) { return crypto.createHash('sha1').update('blob ' + b.length + '\0').update(b).digest('hex'); }
function fresh() { const ctx = { window: {} }; vm.runInNewContext(source.toString(), ctx); return ctx.window.OceanWeather; }
const opts = (t=0) => ({frameId:'frame-'+t,sourceId:expectedBlob,worldSeconds:t});
const tests=[];
function check(name, fn) { fn(); tests.push({name, passed:true}); }
check('frozen source matches current remote git blob',()=>assert.equal(blob(source),expectedBlob));
check('one provider read; no tick, reset or set',()=>{
 const W=fresh(), before=JSON.stringify(W.snapshot()); let reads=0;
 const frame=B.sampleFrame({getEnvironment(){reads++;return W.getEnvironment();}},opts());
 for(const r of B.ROLES)B.inputsFor(frame,r);
 assert.equal(reads,1);assert.equal(JSON.stringify(W.snapshot()),before);
});
check('five role ports share one immutable time/frame',()=>{
 const f=B.sampleFrame(fresh(),opts());for(const r of B.ROLES){const a=B.inputsFor(f,r);assert.equal(a.frameId,f.frameId);assert.equal(a.clock,f.clock);assert.ok(Object.isFrozen(a));}
 assert.throws(()=>{f.wind.velocityMps[0]=123;},TypeError);
 assert.throws(()=>{f.clock.worldSeconds=123;},TypeError);
});
check('tree and ocean use same wind; independent cloud drift is preserved',()=>{
 const W=fresh();W.set('wind',4);W.set('cloudSpeed',13);const f=B.sampleFrame(W,opts());
 assert.equal(B.inputsFor(f,'tree').wind,B.inputsFor(f,'ocean').wind);
 assert.ok(Math.abs(Math.hypot(...f.cloud.velocityMps)/Math.hypot(...f.wind.velocityMps)-13/4)<1e-12);
 assert.equal(f.wind.meanSpeedMps,4);assert.equal(f.wind.forceNewtons,undefined);
});
check('rain/fog are controls, not fabricated physical rates',()=>{
 const W=fresh();W.setWeather('rain');const f=B.sampleFrame(W,opts());
 assert.equal(f.weather.rainControl,.7);for(const v of Object.values(f.physical))assert.equal(v,null);
 assert.equal(B.inputsFor(f,'fish').wind,undefined);
});
check('timeScale-induced mismatch blocks all consumers',()=>{
 const W=fresh();W.set('timeScale',2);W.tick(.5);const f=B.sampleFrame(W,opts(.5));
 assert.equal(f.clock.errorSeconds,.5);assert.ok(f.diagnostics.includes('CLOCK_MISMATCH'));
 for(const r of B.ROLES)assert.throws(()=>B.inputsFor(f,r),/CLOCK_MISMATCH/);
});
check('aligned running time and pause retain source state',()=>{
 const W=fresh();W.tick(3);W.pause();const before=JSON.stringify(W.snapshot());
 const f=B.sampleFrame(W,opts(3));assert.equal(f.clock.coherent,true);assert.equal(f.clock.paused,true);
 B.inputsFor(f,'game');assert.equal(JSON.stringify(W.snapshot()),before);
});
check('serialized frame replays the same consumer data without a provider',()=>{
 const W=fresh();W.tick(8);const f=B.sampleFrame(W,opts(8)),copy=JSON.parse(JSON.stringify(f));
 for(const r of B.ROLES)assert.deepEqual(JSON.parse(JSON.stringify(B.inputsFor(f,r))),B.inputsFor(copy,r));
});
check('unsupported axes fail rather than silently rotate',()=>{
 const e=fresh().getEnvironment();e.axes.up='+Z';assert.throws(()=>B.sampleFrame({getEnvironment:()=>e},opts()),/axes/);
});
check('unsupported units fail rather than guess metres',()=>{
 const e=fresh().getEnvironment();e.units.velocity='km/h';assert.throws(()=>B.sampleFrame({getEnvironment:()=>e},opts()),/units/);
});
check('nonfinite samples and missing provider are rejected',()=>{
 const e=fresh().getEnvironment();e.wind.velocityMps[0]=NaN;assert.throws(()=>B.sampleFrame({getEnvironment:()=>e},opts()),/wind.velocity/);
 assert.throws(()=>B.sampleFrame({},opts()),/getEnvironment/);
});
check('unknown consumer and zero direction are rejected',()=>{
 const W=fresh(),f=B.sampleFrame(W,opts());assert.throws(()=>B.inputsFor(f,'unknown'),/consumer/);
 const e=W.getEnvironment();e.sun.direction=[0,0,0];assert.throws(()=>B.sampleFrame({getEnvironment:()=>e},opts()),/Non-unit/);
});
check('frame observations are detached from source arrays',()=>{
 const e=fresh().getEnvironment(),f=B.sampleFrame({getEnvironment:()=>e},opts()),x=f.wind.velocityMps[0];
 e.wind.velocityMps[0]=999;assert.equal(f.wind.velocityMps[0],x);
});
check('browser global and CommonJS expose the same version',()=>{
 const ctx={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'environment_bridge.cjs'),'utf8'),ctx);
 assert.equal(ctx.SMIEnvironmentBridge.VERSION,B.VERSION);
});
console.log(JSON.stringify({suite:'SMI environment consumer bridge R01',passed:tests.length,failed:0,
 sourceBlob:blob(source),sourceUnchanged:source.equals(fs.readFileSync(p)),tests,
 limits:['CPU/VM interface verification, not a browser/render/device test','No new fish/coral/tree assets or physical weather model','Existing scene has not imported the bridge yet']},null,2));
