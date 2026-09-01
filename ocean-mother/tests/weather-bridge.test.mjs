import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createWeatherBridge, validateEnvironment } from '../src/weather-bridge.mjs';

// Test the real frozen exporter text, not a manually rewritten substitute.
const root = process.env.WEATHER_CLEAN_DIR;
if (!root) throw new Error('Set WEATHER_CLEAN_DIR to the verified, unmodified clean-v1 directory');
const bytes = fs.readFileSync(path.join(root, 'engine.js'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),
  '08b48d07792fa5d8e1dfd57c332fc7ae6e08ee1e4acbc12b91954f8bccb698fb');
const source = bytes.toString('utf8');
const begin = source.indexOf('function getEnvironment(){');
const end = source.indexOf('\nwindow.WeatherMother={qa,packageVersion:', begin);
assert.ok(begin >= 0 && end > begin);
const exporter = source.slice(begin, end);
function fixture() {
  const context = vm.createContext({ state: { hour: 16, direction: 270, gust: .15, wind: 12,
    cloudSpeed: 40, timeScale: 1, haze: .16, sunlight: 1, skylight: 1, exposure: 1,
    rain: 0, fog: .03, snow: 0, humidity: 68 }, time: 0, playing: true,
    kind: 'Cu', seed: 4217, weather: 'fair', windOffset: [1,0,-2], loopPhase: .25,
    windLink: false });
  vm.runInContext('const normal=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};' +
    'const $=id=>({checked:windLink});' + exporter, context);
  const api = { packageVersion: '1.0.0-clean', qa: { ready: true, errors: [] },
    getEnvironment: () => vm.runInContext('getEnvironment()', context) };
  return { context, api, bridge: createWeatherBridge(api) };
}
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6, `${a} != ${b}`);

test('frozen exporter validates and bridge preserves every environment field',()=>{
 const {api,bridge}=fixture(); const original=JSON.parse(JSON.stringify(api.getEnvironment()));
 assert.deepEqual(bridge.sample().environment, original);
});
test('west wind drives east, independently of cloud speed',()=>{
 const {context,bridge}=fixture(); context.state.gust=0;
 const s=bridge.sample(); near(s.waveWindVelocityMps[0],12); near(s.waveWindVelocityMps[2],0);
 near(s.environment.cloud.velocityMps[0],40);
});
test('north wind drives positive Z',()=>{
 const {context,bridge}=fixture(); context.state.direction=0; context.state.gust=0;
 const s=bridge.sample(); near(s.waveWindVelocityMps[0],0);near(s.waveWindVelocityMps[2],12);
});
test('cloud velocity is never used as wave forcing',()=>{
 const {context,bridge}=fixture(); const a=bridge.sample().waveWindVelocityMps;
 context.state.cloudSpeed=200; assert.deepEqual(bridge.sample().waveWindVelocityMps,a);
});
test('explicit upstream windLink remains the only cloud-speed linkage',()=>{
 const {context,bridge}=fixture(); context.windLink=true;
 const s=bridge.sample();assert.deepEqual(s.environment.cloud.velocityMps,s.waveWindVelocityMps);
});
test('exported metres are not multiplied twice',()=>{
 assert.deepEqual(fixture().bridge.sample().environment.cloud.offsetMetres,[1000,0,-2000]);
});
test('absolute simulation clock passes through without a second timeScale multiplication',()=>{
 const {context,bridge}=fixture();bridge.sample();context.time=2;context.state.timeScale=60;
 const s=bridge.sample();assert.equal(s.environment.simulationSeconds,2);assert.equal(s.deltaSimulationSeconds,2);
});
test('unchanged paused clock remains unchanged over repeated samples',()=>{
 const {context,bridge}=fixture();context.playing=false;const a=bridge.sample();const b=bridge.sample();
 assert.equal(b.environment.simulationSeconds,a.environment.simulationSeconds);assert.equal(b.deltaSimulationSeconds,0);
});
test('configuration rewind signals cache reset and never emits negative delta',()=>{
 const {context,bridge}=fixture();context.time=100;bridge.sample();context.time=5;
 const s=bridge.sample();assert.equal(s.clockRewound,true);assert.equal(s.deltaSimulationSeconds,0);
});
test('readiness and upstream errors block sampling',()=>{
 const {api,bridge}=fixture();api.qa.ready=false;assert.throws(()=>bridge.sample(),/not ready/);
 api.qa.ready=true;api.qa.errors=['GPU failure'];assert.throws(()=>bridge.sample(),/runtime errors/);
});
test('wrong units and coordinate axes are rejected',()=>{
 const {api}=fixture();const e=JSON.parse(JSON.stringify(api.getEnvironment()));
 e.units.length='kilometre';assert.throws(()=>validateEnvironment(e),/unit mismatch/);
 e.units.length='metre';e.axes.north='+Z';assert.throws(()=>validateEnvironment(e),/axis mismatch/);
});
test('non-finite and malformed inputs are rejected',()=>{
 const {context,bridge}=fixture();context.state.wind=NaN;assert.throws(()=>bridge.sample(),/wind/);
});
test('all ten cloud genera and eight weather labels are accepted without replacement',()=>{
 const {context,bridge}=fixture();
 for(const k of ['Cu','Cb','Sc','St','Ns','Ac','As','Ci','Cc','Cs']){context.kind=k;assert.equal(bridge.sample().environment.cloud.kind,k);}
 for(const w of ['fair','coast','mountain','rain','storm','rainbow','snow','high']){context.weather=w;assert.equal(bridge.sample().environment.weather.case,w);}
});
test('sunlight fields match the exporter in morning, noon, dusk, and night',()=>{
 const {context,api,bridge}=fixture();for(const h of [6.6,12,17.5,22]){context.state.hour=h;
 assert.deepEqual(bridge.sample().environment.sun,JSON.parse(JSON.stringify(api.getEnvironment().sun)));}
});
test('snapshots are detached and deeply immutable',()=>{
 const {context,bridge}=fixture();const s=bridge.sample();assert.ok(Object.isFrozen(s.environment.wind.velocityMps));
 assert.throws(()=>{s.environment.wind.velocityMps[0]=0;},TypeError);context.state.wind=2;
 assert.notEqual(bridge.sample().environment.wind.forceMps,s.environment.wind.forceMps);
});
test('unsupported baseline and disposed adapters fail explicitly',()=>{
 const {api,bridge}=fixture();assert.throws(()=>createWeatherBridge({...api,packageVersion:'legacy'}),/Clean/);
 bridge.dispose();assert.throws(()=>bridge.sample(),/disposed/);
});
test('sampling never writes configuration or claims ocean completion',()=>{
 const {api}=fixture();api.set=()=>{throw Error('must not call set');};api.applyConfiguration=()=>{throw Error('must not apply');};
 const s=createWeatherBridge(api).sample();assert.ok(Object.values(s.integration).every(v=>v===false));
});
