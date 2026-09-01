'use strict';
// Synthetic contract fixtures. Real upstream browser tests are recorded separately.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EnvironmentBridge} = require('../environment-bridge.js');
const clone = x => structuredClone(x);
function fixture() {
  const env = {format:'weather-mother-environment',schemaVersion:1,units:{length:'metre',velocity:'metre/second',time:'simulation second'},axes:{east:'+X',up:'+Y',north:'-Z'},simulationSeconds:10,hour:12,paused:false,timeScale:1,
    wind:{fromDegrees:270,direction:[1,0,0],forceMps:20,gustMultiplier:1,velocityMps:[20,0,0]},
    cloud:{kind:'Cu',seed:4217,driftMps:7,velocityMps:[7,0,0],offsetMetres:[1200,0,0],loopPhase:.25},
    sun:{direction:[0,Math.sqrt(3)/2,.5],linearColor:[1.2,.8,.4],intensity:1,skylight:1,exposure:1},
    weather:{case:'fair',rain:0,fog:.03,snow:0,humidityPercent:68},limitations:['synthetic unit fixture']};
  const state={blend:1};
  const source={packageVersion:'1.0.0-clean',qa:{version:'1.0.0-clean',ready:true,errors:[],activeCloudKind:'Cu',seed:4217},getEnvironment:()=>env,getState:()=>state};
  const bridge=new EnvironmentBridge(()=>source);return {env,state,source,bridge};
}
const fails=(b,code)=>assert.throws(()=>b.sample(),e=>e.code===code);
test('independent wind and cloud speeds remain distinct',()=>{const {bridge}=fixture();const f=bridge.sample();assert.deepEqual(f.wind.velocityMps,[20,0,0]);assert.deepEqual(f.cloud.velocityMps,[7,0,0]);});
test('metre offsets are not multiplied by 1000 again',()=>assert.equal(fixture().bridge.sample().cloud.offsetMetres[0],1200));
test('shared delta is not multiplied by timeScale again',()=>{const {env,bridge}=fixture();bridge.sample();env.timeScale=20;env.simulationSeconds=14;assert.equal(bridge.sample().clock.deltaSimulationSeconds,4);});
test('pause keeps source clock without wall-clock substitution',()=>{const {env,bridge}=fixture();bridge.sample();env.paused=true;const f=bridge.sample();assert.equal(f.clock.deltaSimulationSeconds,0);assert.equal(f.clock.simulationSeconds,10);});
test('source rewind starts a new epoch with zero integration delta',()=>{const {env,bridge}=fixture();bridge.sample();env.simulationSeconds=2;const f=bridge.sample();assert.equal(f.clock.epoch,1);assert.equal(f.clock.deltaSimulationSeconds,0);assert.equal(f.clock.resetReason,'source-clock-rewind');});
test('source loss never falls back to stale wind',()=>{const {source,bridge}=fixture();bridge.sample();source.qa.ready=false;fails(bridge,'NOT_READY');source.qa.ready=true;assert.equal(bridge.sample().clock.resetReason,'source-reacquired');});
test('wrong versions are rejected',()=>{const {source,bridge}=fixture();source.packageVersion='0.6.2-loop';fails(bridge,'VERSION_MISMATCH');});
test('wrong units are rejected',()=>{const {env,bridge}=fixture();env.units.length='kilometre';fails(bridge,'UNITS_MISMATCH');});
test('wrong axes are rejected',()=>{const {env,bridge}=fixture();env.axes.north='+Z';fails(bridge,'AXES_MISMATCH');});
test('unknown schema is rejected',()=>{const {env,bridge}=fixture();env.schemaVersion=2;fails(bridge,'SCHEMA_MISMATCH');});
test('NaN values are rejected',()=>{const {env,bridge}=fixture();env.sun.intensity=NaN;fails(bridge,'INVALID_ENVIRONMENT');});
test('inconsistent wind vectors are rejected',()=>{const {env,bridge}=fixture();env.wind.velocityMps=[7,0,0];fails(bridge,'INVALID_ENVIRONMENT');});
test('pending cloud transition is rejected',()=>{const {state,bridge}=fixture();state.blend=.5;fails(bridge,'SOURCE_TRANSITION');});
test('requested seed must match active density field',()=>{const {env,bridge}=fixture();env.cloud.seed=7;fails(bridge,'SOURCE_TRANSITION');});
test('upstream runtime errors are rejected',()=>{const {source,bridge}=fixture();source.qa.errors.push('GPU lost');fails(bridge,'SOURCE_ERROR');});
test('result is deeply frozen and source is never mutated',()=>{const {env,bridge}=fixture();const before=clone(env);const f=bridge.sample();assert.throws(()=>{f.wind.velocityMps[0]=100;},TypeError);assert.deepEqual(env,before);});
test('solar direction and linear color are passed through exactly',()=>{const {env,bridge}=fixture();const f=bridge.sample();assert.deepEqual(f.sun,env.sun);});
test('source replacement starts an explicit epoch',()=>{const a=fixture(),b=fixture();let s=a.source;const bridge=new EnvironmentBridge(()=>s);bridge.sample();s=b.source;assert.equal(bridge.sample().clock.resetReason,'source-replaced');});
test('disposed adapters cannot continue reading',()=>{const {bridge,source}=fixture();bridge.dispose();fails(bridge,'DISPOSED');assert.equal(source.qa.ready,true);});
test('provider security errors produce an explicit source error',()=>{const b=new EnvironmentBridge(()=>{throw new Error('Cross-origin frame');});fails(b,'SOURCE_UNAVAILABLE');});
test('all physical directions preserve +X east and -Z north convention',()=>{for(const bearing of [0,90,180,270]){const {env,bridge}=fixture();const a=bearing*Math.PI/180;env.wind.fromDegrees=bearing;env.wind.direction=[-Math.sin(a),0,Math.cos(a)];env.wind.velocityMps=env.wind.direction.map(v=>v*20);env.cloud.velocityMps=env.wind.direction.map(v=>v*7);assert.deepEqual(bridge.sample().wind.direction,env.wind.direction);}});
test('same source time gives exactly zero delta on repeated polling',()=>{const {bridge}=fixture();bridge.sample();for(let i=0;i<100;i++)assert.equal(bridge.sample().clock.deltaSimulationSeconds,0);});
test('initial frame has an explicit synchronization boundary',()=>{const f=fixture().bridge.sample();assert.equal(f.clock.resetReason,'initial');assert.equal(f.clock.deltaSimulationSeconds,0);});
test('night sun remains below horizon with unmodified linear output',()=>{const {env,bridge}=fixture();env.hour=22;env.sun.direction=[0,-1,0];const f=bridge.sample();assert.equal(f.sun.direction[1],-1);assert.equal(f.sun.intensity,env.sun.intensity);});

test('a matching version string does not prove loaded runtime byte identity',()=>{const f=fixture().bridge.sample();assert.equal(f.source.runtimeByteIdentityVerified,false);assert.equal(f.source.requiredPublicationRef,'2619725efe236d2df8f2a55031bdae9e60a51555');});
test('wrong wind bearing is rejected despite internally consistent velocities',()=>{const {env,bridge}=fixture();env.wind.fromDegrees=90;fails(bridge,'INVALID_ENVIRONMENT');});
test('unknown cloud genus is rejected',()=>{const {env,source,bridge}=fixture();env.cloud.kind='UNKNOWN';source.qa.activeCloudKind='UNKNOWN';fails(bridge,'INVALID_ENVIRONMENT');});
test('unknown weather case is rejected',()=>{const {env,bridge}=fixture();env.weather.case='unknown';fails(bridge,'INVALID_ENVIRONMENT');});
test('nonstring limitations never freeze upstream nested objects',()=>{const {env,bridge}=fixture();const nested={mutable:true};env.limitations=[nested];fails(bridge,'INVALID_ENVIRONMENT');assert.equal(Object.isFrozen(nested),false);});
test('non Error provider exceptions preserve an explicit failure',()=>{const b=new EnvironmentBridge(()=>{throw null;});fails(b,'SOURCE_UNAVAILABLE');});
test('cloud morphology wrap never resets the ocean clock',()=>{const {env,bridge}=fixture();env.cloud.loopPhase=.99;bridge.sample();env.cloud.loopPhase=.01;env.simulationSeconds=11;const f=bridge.sample();assert.equal(f.clock.deltaSimulationSeconds,1);assert.equal(f.clock.discontinuity,false);});
test('explicit resynchronization handles a known forward configuration load',()=>{const {env,bridge}=fixture();bridge.sample();env.simulationSeconds=1000;bridge.resynchronize();const f=bridge.sample();assert.equal(f.clock.deltaSimulationSeconds,0);assert.equal(f.clock.discontinuity,true);assert.equal(f.clock.epoch,1);});
