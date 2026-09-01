'use strict';
// Execute the exact getEnvironment source function from the verified engine.
// Surrounding state and DOM checkbox are explicit fixtures. This is not browser QA.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {EnvironmentBridge}=require('../environment-bridge.js');
const enginePath=process.env.WEATHER_ENGINE_PATH || path.join(__dirname,'../../../weather-mother/clean-v1/engine.js');
const bytes=fs.readFileSync(enginePath);
const actualHash=crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(actualHash,'08b48d07792fa5d8e1dfd57c332fc7ae6e08ee1e4acbc12b91954f8bccb698fb');
const engine=bytes.toString('utf8');
const start=engine.indexOf('function getEnvironment(){');
const end=engine.indexOf('\n}\n',start)+2;
assert.ok(start>0&&end>start);
const exactFunction=engine.slice(start,end);
const normal=engine.match(/normal=(v=>\{const l=Math\.hypot\(\.\.\.v\)\|\|1;return v\.map\(x=>x\/l\);\})/)[1];
function setup(extra={},link=false){
 const state={hour:12,direction:270,gust:0,wind:20,cloudSpeed:7,timeScale:1,haze:.16,sunlight:1,skylight:1,exposure:1,rain:0,fog:.03,snow:0,humidity:68,...extra};
 const context=vm.createContext({state,time:10,playing:false,kind:'Cu',seed:4217,weather:'fair',windOffset:[1.2,0,0],loopPhase:.25,$:()=>({checked:link})});
 vm.runInContext('const normal='+normal+';\n'+exactFunction,context);
 const source={packageVersion:'1.0.0-clean',qa:{version:'1.0.0-clean',ready:true,errors:[],activeCloudKind:'Cu',seed:4217},getState:()=>({blend:1}),getEnvironment:()=>JSON.parse(JSON.stringify(context.getEnvironment()))};
 return {context,source,bridge:new EnvironmentBridge(()=>source)};
}
test('exact locked engine source function executes',()=>assert.equal(setup().source.getEnvironment().format,'weather-mother-environment'));
for(const [bearing,expected] of [[0,[0,0,20]],[90,[-20,0,0]],[180,[0,0,-20]],[270,[20,0,0]]]) {
 test('original function direction '+bearing,()=>{const f=setup({direction:bearing}).bridge.sample();f.wind.velocityMps.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-9));});
}
test('original function keeps 20 m/s wind separate from 7 m/s cloud drift',()=>{const f=setup().bridge.sample();assert.equal(f.wind.forceMps,20);assert.equal(f.cloud.driftMps,7);});
test('original function links cloud speed only when source checkbox is set',()=>{const f=setup({},true).bridge.sample();assert.equal(f.cloud.driftMps,20);assert.deepEqual(f.cloud.velocityMps,f.wind.velocityMps);});
test('original function gust vectors survive adapter unchanged',()=>{const {source,bridge}=setup({gust:.9});const s=source.getEnvironment(),f=bridge.sample();assert.deepEqual(f.wind,s.wind);assert.deepEqual(f.cloud,s.cloud);});
for(const hour of [6.6,12,17.5,22]) {
 test('original solar output is copied exactly at hour '+hour,()=>{const {source,bridge}=setup({hour});assert.deepEqual(bridge.sample().sun,source.getEnvironment().sun);});
}
test('original function converts km offset to metres exactly once',()=>assert.deepEqual(setup().bridge.sample().cloud.offsetMetres,[1200,0,0]));
test('original source simulation time is used without second timeScale multiplication',()=>{const {context,bridge}=setup({timeScale:60});bridge.sample();context.time=14;const f=bridge.sample();assert.equal(f.clock.deltaSimulationSeconds,4);assert.equal(f.clock.timeScale,60);});
test('original function pause state is preserved',()=>assert.equal(setup().bridge.sample().clock.paused,true));
test('original weather payload is passed through unchanged',()=>{const {source,bridge}=setup({rain:.4,fog:.2,humidity:88});assert.deepEqual(bridge.sample().weather,source.getEnvironment().weather);});
fs.mkdirSync(path.join(__dirname,'../qa'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../qa/source-api-provenance.json'),JSON.stringify({testType:'unit execution of exact original getEnvironment() and normal(); surrounding state/checkbox are explicit fixtures',engineSha256:actualHash,functionSha256:crypto.createHash('sha256').update(exactFunction).digest('hex'),browserQA:false,sourceModified:false},null,2)+'\n');
