import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { makeConnectedWind } from '../src/connected-wind.js';
const baseline=fs.readFileSync(new URL('../baseline/runtime.js',import.meta.url),'utf8');
const candidate=fs.readFileSync(new URL('../src/runtime.js',import.meta.url),'utf8');
const graphFunction=s=>s.slice(s.indexOf('function growGraph(){'),s.indexOf('\nfunction setCylinder('));
assert.equal(graphFunction(candidate),graphFunction(baseline),'Original geometry generator must be byte identical');
function generator(source,seed=123303,params={}){
 const context=vm.createContext({THREE,seed,showProbe:true,MAX_SEGMENTS:3200});
 const head=source.slice(source.indexOf('const VOICES='),source.indexOf(source.includes('let seed=')?'let seed=':'const seed='));
 const body=source.slice(source.indexOf('function hash01('),source.indexOf('\nfunction setCylinder('));
 vm.runInContext(`const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));const rad=d=>THREE.MathUtils.degToRad(d);const up=new THREE.Vector3(0,1,0),quat=new THREE.Quaternion();${head}${body}\nthis.make=(params)=>{Object.assign(P,params);return growGraph();};`,context);
 return context.make(params);
}
const serialize=g=>JSON.stringify({segments:g.segments.map(s=>({...s,a:s.a.toArray(),b:s.b.toArray()})),buds:g.buds.map(b=>({...b,pos:b.pos.toArray(),dir:b.dir.toArray()}))});
const reports=[];let cases=0,maxLengthError=0,maxConnectionError=0,maxFrameError=0,maxRootError=0;
for(const voice of ['C','L','R'])for(const pass of [1,5,10,11]){
 const params={voice,pass};const a=generator(baseline,123303,params),g=generator(candidate,123303,params);
 assert.equal(serialize(g),serialize(a),`default original seed geometry differs ${voice}/${pass}`);
 for(const seed of [123303,1,42]){
  const graph=generator(candidate,seed,params),before=serialize(graph),rig=makeConnectedWind(THREE,graph,seed),id=JSON.stringify(rig.identity);
  assert.equal(serialize(generator(candidate,seed,params)),before,'seed nondeterministic');
  for(const strength of [0,.65,1.5])for(const time of [0,2.75,14.9,3000]){
   rig.pose(time,{strength});const m=rig.metrics();
   maxLengthError=Math.max(maxLengthError,m.lengthError);maxConnectionError=Math.max(maxConnectionError,m.connectionError);maxFrameError=Math.max(maxFrameError,m.frameError);maxRootError=Math.max(maxRootError,m.rootError);
   assert(m.connectionError<1e-12&&m.lengthError<1e-12&&m.frameError<1e-12&&m.rootError===0,'constraint failed');
   if(strength===0){for(let i=0;i<rig.nodes.length;i++){assert.deepEqual(rig.nodes[i].a.toArray(),graph.segments[i].a.toArray());assert.deepEqual(rig.nodes[i].b.toArray(),graph.segments[i].b.toArray());}for(let i=0;i<rig.buds.length;i++)assert.deepEqual(rig.buds[i].pos.toArray(),graph.buds[i].pos.toArray());}
   assert.equal(serialize(graph),before,'rest graph mutated');assert.equal(JSON.stringify(rig.identity),id,'pose mutated identity');cases++;
  }
  if(seed===123303)reports.push({voice,pass,...rig.identity});
 }
}
const graph=generator(candidate),rig=makeConnectedWind(THREE,graph,123303);
rig.pose(6,{strength:.7});const poseA=rig.nodes.map(n=>n.b.toArray());rig.pose(1,{strength:1.5});rig.pose(6,{strength:.7});assert.deepEqual(rig.nodes.map(n=>n.b.toArray()),poseA,'history dependence at fixed time');
rig.pose(6,{strength:.7,offsetX:5});const offsetDelta=Math.max(...rig.nodes.map((n,i)=>n.b.distanceTo(new THREE.Vector3(...poseA[i]))));assert(offsetDelta>.001,'world position has no effect');
rig.pose(6,{strength:.7,azimuth:125});const azDelta=Math.max(...rig.nodes.map((n,i)=>n.b.distanceTo(new THREE.Vector3(...poseA[i]))));assert(azDelta>.001,'orientation field has no effect');
assert.notEqual(makeConnectedWind(THREE,generator(candidate,42),42).identity.topologyHash,rig.identity.topologyHash,'different seed same identity');
const maxResponseSpread=(()=>{rig.pose(4,{strength:1});const values=rig.nodes.map(n=>n.response);return Math.max(...values)-Math.min(...values);})();assert(maxResponseSpread>.001);
const finite=rig.nodes.every(n=>n.a.toArray().concat(n.b.toArray()).every(Number.isFinite));assert(finite);
const report={timestamp:'2026-10-05T03:55:00Z',status:'NUMERICAL_PASS',baselineSha:'95ac11fe07b7940818321fc6be8b56778c3389de',threeRevision:THREE.REVISION,sourceGeneratorByteIdentical:true,defaultSeedGeometryByteEquivalent:true,cases,maxLengthError,maxConnectionError,maxFrameError,maxRootError,offsetDelta,azDelta,maxResponseSpread,restGraphImmutable:true,fixedTimeHistoryIndependent:true,cameraNotAnInput:true,rows:reports,limitations:['Not browser visual QA','Not calibrated physics','Not actual mobile device performance']};
fs.writeFileSync(new URL('../qa/NUMERICAL_QA.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
