import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {Original} from '../native/timber-adapter.mjs';
import {extractShaderFunctions} from './shader-functions.mjs';
import {optimizedFragmentShaderSource,optimizationSource,optimizeTimberMaterial,makeParallaxSampleCountShader,AUDITED_ORIGINAL_CORE_SHA256} from './timber-optimizer.mjs';
import {compileExtractedParallax} from './cpu-glsl-subset.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const report={gpuVerified:false,sourceAudit:{},cpu:{},limitations:['The CPU interpreter covers scalar/vector control flow and bounded synthetic height functions; it is not a GPU derivative emulator.','No GPU timing, image, or spectral result is claimed until the parent runs the independent matched fixture.']};

test('original core SHA and all shader functions except applyParallax are byte-identical',async()=>{
 const core=await readFile(new URL('../native/timber-original.mjs',import.meta.url));
 assert.equal(hash(core),AUDITED_ORIGINAL_CORE_SHA256);
 const a=extractShaderFunctions(Original.fragmentShaderSource),b=extractShaderFunctions(optimizedFragmentShaderSource);
 assert.deepEqual([...a.keys()],[...b.keys()]);const functions=[];
 for(const [name,x] of a){const y=b.get(name),originalSha256=hash(x.text),optimizedSha256=hash(y.text),unchanged=originalSha256===optimizedSha256;assert.equal(unchanged,name!=='applyParallax');functions.push({name,originalSha256,optimizedSha256,unchanged,originalBytes:Buffer.byteLength(x.text),optimizedBytes:Buffer.byteLength(y.text)});}
 assert.equal(Original.fragmentShaderSource.replace(a.get('applyParallax').text,''),optimizedFragmentShaderSource.replace(b.get('applyParallax').text,''));
 report.sourceAudit={originalCoreSha256:hash(core),originalFragmentSha256:hash(Original.fragmentShaderSource),optimizedFragmentSha256:hash(optimizedFragmentShaderSource),vertexShaderSha256:hash(Original.vertexShaderSource),byteIdenticalOutsideApplyParallax:true,functions};
});

test('wrapping preserves original rendering hook, uniforms, geometry, shader core, and is idempotent',()=>{
 const hook=()=>{},uniforms={},geometry={},state={},material={vertexShader:Original.vertexShaderSource.replace(/^#version 300 es\n/,''),fragmentShader:Original.fragmentShaderSource.replace(/^#version 300 es\n/,''),uniforms,name:'Original'};
 const made={mesh:{material,geometry,onBeforeRender:hook},state,proof:{originalUniformBinding:true,originalShaderUnmodified:true}};
 assert.equal(optimizeTimberMaterial(made),made);assert.equal(made.mesh.onBeforeRender,hook);assert.equal(made.mesh.geometry,geometry);assert.equal(made.mesh.material.uniforms,uniforms);assert.equal(made.state,state);assert.equal(made.proof.originalShaderUnmodified,false);assert.deepEqual(made.proof.optimization.changedFunctions,['applyParallax']);assert.equal(made.proof.gpuVerified,false);
 const source=material.fragmentShader,name=material.name;optimizeTimberMaterial(made);assert.equal(material.fragmentShader,source);assert.equal(material.name,name);
 assert.throws(()=>optimizeTimberMaterial({mesh:{material:{...material,fragmentShader:'wrong'}},proof:{originalUniformBinding:true}}),/already modified/);
});

test('actual GLSL function extraction gives identical results under arbitrary bounded heights',()=>{
 let seed=0x31415926;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);const normalize=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
 const heights=[['maximum',()=>.68],['endMaximum',()=>.67],['zero',()=>0],['mid',()=>.5],['rapidSine',g=>.34+.34*Math.sin(g[0]*1234567+g[1]*876543+g[2]*33333)],['discontinuous',g=>{const x=g[0]*998877+g[1]*65432-g[2]*34567;return(x-Math.floor(x))<.47?.68:0;}],['thinSpikes',g=>Math.abs(Math.sin(g[0]*87654321+g[2]*7654321))>.97?.68:.13]];
 const perSteps={};let tests=0,maxCoordinateError=0,maxSamplePositionError=0,totalOriginalSamples=0,totalOptimizedSamples=0,unchangedSampleSuffixes=0;
 for(const float32 of [false,true]){
  const original=compileExtractedParallax(Original.fragmentShaderSource,{float32}),optimized=compileExtractedParallax(optimizedFragmentShaderSource,{float32});
  for(let steps=1;steps<=12;steps++)for(let i=0;i<490;i++){
   const normal=i%3===0?[1,0,0]:i%3===1?[0,1,0]:[0,0,1];
   const views=[normal,normal.map(v=>-v),normalize([1,1e-8,0]),normalize([1,.3,1]),normalize([random()-.5,random()-.5,random()-.5])];
   const parallax=[0,.0003,.00082,.00105,.00165][i%5],relief=[0,.01,1,1.6][i%4],texture=[0,.001,.65,1,1.2,3][i%6];
   const input={baseGrain:[(random()-.5)*10,(random()-.5)*2,(random()-.5)*2],localNormal:normal,viewGrain:views[i%views.length],surfaceClass:i%5,uniforms:{u_parallaxSteps:steps,u_textureScale:texture,u_reliefScale:relief,u_parallaxM:parallax},height:heights[i%heights.length][1]};
   const a=original(input),b=optimized(input);tests++;
   const error=Math.max(...a.grain.map((x,k)=>Math.abs(x-b.grain[k])));maxCoordinateError=Math.max(error,maxCoordinateError);
   assert.deepEqual(b.grain,a.grain,JSON.stringify({float32,steps,i,field:heights[i%heights.length][0],error,input}));assert.ok(b.calls<=a.calls);
   // Stronger than output equality: every retained sample is the exact original
   // suffix, preserving the index, physical position, height, and interpolation.
   assert.deepEqual(b.samples,a.samples.slice(a.calls-b.calls));unchangedSampleSuffixes++;
   const row=perSteps[steps]??={originalSamplesMin:Infinity,originalSamplesMax:0,optimizedSamplesMin:Infinity,optimizedSamplesMax:0,savedWhenRayActive:[],rays:0,normalIncidenceRays:0};
   row.rays++;if(!a.calls)row.normalIncidenceRays++;else{row.originalSamplesMin=Math.min(row.originalSamplesMin,a.calls);row.originalSamplesMax=Math.max(row.originalSamplesMax,a.calls);row.optimizedSamplesMin=Math.min(row.optimizedSamplesMin,b.calls);row.optimizedSamplesMax=Math.max(row.optimizedSamplesMax,b.calls);if(!row.savedWhenRayActive.includes(a.calls-b.calls))row.savedWhenRayActive.push(a.calls-b.calls);}
   totalOriginalSamples+=a.calls;totalOptimizedSamples+=b.calls;
  }
  // Round/clamp step boundaries and near-normal branch threshold, inclusive of
  // stepCounts 1 and 2 where the optimizer must retain the initial sample.
  for(const requestedSteps of [-10,0,.49,.5,1,1.49,1.5,2.49,2.5,5.49,5.5,11.49,11.5,12,20])for(const tangent of [0,.000009999,.00001,.000010001,.001,.3,1]){
   const input={baseGrain:[0,0,0],localNormal:[0,1,0],viewGrain:normalize([tangent,1,0]),uniforms:{u_parallaxSteps:requestedSteps,u_textureScale:1,u_reliefScale:1.6,u_parallaxM:.00165},height:()=>.68};const a=original(input),b=optimized(input);assert.deepEqual(b.grain,a.grain);assert.deepEqual(b.samples,a.samples.slice(a.calls-b.calls));tests++;
  }
 }
 assert.deepEqual(perSteps[12].savedWhenRayActive,[3]);assert.deepEqual(perSteps[6].savedWhenRayActive,[1]);assert.deepEqual(perSteps[3].savedWhenRayActive,[0]);
 report.cpu={tests,precisions:['JavaScript float64','per-operation float32 interpreter'],maxCoordinateErrorMetersInGrainSpace:maxCoordinateError,maxRetainedSamplePositionError:maxSamplePositionError,unchangedSampleSuffixes,totalOriginalSamples,totalOptimizedSamples,perSteps,fieldFamilies:heights.map(x=>x[0]),frequencyDecimation:0,meaning:'Zero is CPU control-flow equivalence, not an unrun GPU pixel claim.'};
});

test('global height upper bound is parameter-independent and conservative',()=>{
 // all upstream parameters influence phases/positions only; the ranges below
 // follow from the unchanged sin, smoothstep, nonnegative pow and clamp.
 for(const sideBand of [0,.5,1])for(const ringBand of [0,.5,1])for(const sideCrack of [0,.001,1])for(const radialCrack of [0,.001,1])for(const crossSection of [0,1]){
  const sideHeight=(sideBand-.5)*.36-sideCrack*.60,endHeight=(ringBand-.5)*.34-radialCrack*.68;
  const height=Math.min(1,Math.max(0,.5+(crossSection?endHeight:sideHeight)));
  assert.ok(height<=.68+Number.EPSILON);assert.ok(1-height>.31);
 }
 report.bound={allOriginalPresets:true,allOriginalLegalFiniteParameters:true,aaSine:[0,1],sideCrack:'nonnegative',radialCrack:'nonnegative',sideHeightUpper:.18,endHeightUpper:.17,coarseHeightUpper:.68,trueDepthLower:.32,usedDepthLower:.31,roundoffMargin:.01,skipPredicate:'currentLayer + layerStep < 0.31',preserves:'all ray positions, original first possible crossing, predecessor sample and original interpolation'};
});

test('sample-count diagnostic leaves the original height function intact',()=>{
 for(const source of [Original.fragmentShaderSource,optimizedFragmentShaderSource]){
  const diagnostic=makeParallaxSampleCountShader(source),functions=extractShaderFunctions(diagnostic);
  assert.equal(functions.get('coarseRelief').text,extractShaderFunctions(source).get('coarseRelief').text);
  assert.ok(functions.get('main').text.includes('timberCoarseSampleCount / 255.0'));
  assert.ok(functions.get('applyParallax').text.includes('countedCoarseRelief('));
 }
});

test('persist CPU/source audit separately from GPU evidence',async()=>{
 await writeFile(new URL('./cpu-source-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
});
