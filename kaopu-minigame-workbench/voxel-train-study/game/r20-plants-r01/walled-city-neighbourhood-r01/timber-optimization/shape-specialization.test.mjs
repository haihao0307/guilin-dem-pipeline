import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readFile,writeFile} from 'node:fs/promises';
import {Original} from '../native/timber-adapter.mjs';import {extractShaderFunctions} from './shader-functions.mjs';
import {shapeSpecializedFragmentSources,shapeSourceEvidence,shapeVariantForUniform,specializeTimberShape} from './shape-specialization.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),originalFunctions=extractShaderFunctions(Original.fragmentShaderSource),report={gpuVerified:false,sourceAudit:{},cpu:{},limits:['CPU source/coordinate proof is not GPU validation.','Finite original-defined inputs are covered; originally undefined GLSL evaluation, such as atan(0,0), does not acquire an equivalence guarantee.']};

test('core untouched; only the two dual-shape noise helpers change',async()=>{
 assert.equal(hash(await readFile(new URL('../native/timber-original.mjs',import.meta.url))),'ce6a10b73516cb3fe64b389c167daab6625354e2ea9a67c08ca6ab94c8b5df9c');
 for(const [shape,shader] of Object.entries(shapeSpecializedFragmentSources)){
  const specializedFunctions=extractShaderFunctions(shader),functions=[];assert.deepEqual([...specializedFunctions.keys()],[...originalFunctions.keys()]);
  for(const [name,original] of originalFunctions){const specialized=specializedFunctions.get(name),changed=['sideAnisotropicNoise','sideValueNoise'].includes(name);assert.equal(original.text===specialized.text,!changed);functions.push({name,originalSha256:hash(original.text),specializedSha256:hash(specialized.text),unchanged:!changed});}
  const formulaProof=[];for(const [name,e] of Object.entries(shapeSourceEvidence[shape])){for(const key of ['selectedPrelude','selectedCoordinate','selectedNoiseExpression']){assert.ok(e.originalFunction.includes(e[key]));assert.ok(e.specializedFunction.includes(e[key]));formulaProof.push({function:name,part:key,sha256:hash(e[key]),identicalInOriginalAndSpecialized:true,bytes:Buffer.byteLength(e[key])});}}
  assert.equal(specializedFunctions.get('applyParallax').text,originalFunctions.get('applyParallax').text);assert.equal(specializedFunctions.get('coarseRelief').text,originalFunctions.get('coarseRelief').text);
  report.sourceAudit[shape]={fragmentSha256:hash(shader),functions,formulaProof,parallaxUnmodified:true,coarseReliefUnmodified:true};
 }
});

// Execute the actual extracted helper bodies after only syntactic GLSL-to-JS
// lowering. The noise observer records exact inputs and gives a bounded output;
// shader fbm/valueNoise implementations remain untouched and byte-audited.
function compileHelper(source){
 const swizzle=s=>s.replace(/\b(\w+)\.([xyz])\b/g,(_m,v,c)=>v+'['+{x:0,y:1,z:2}[c]+']');
 const body=swizzle(source.slice(source.indexOf('{')+1,source.lastIndexOf('}'))).replace(/\b(?:float|vec3)\s+(\w+)\s*=/g,'let $1 =');
 const flat=name=>new Function('g','localNormal','abs',swizzle(originalFunctions.get(name).text.split('{')[1].split('}')[0]));
 const flatAcross=(g,n)=>flat('flatAcross')(g,n,Math.abs),flatDepth=(g,n)=>flat('flatDepth')(g,n,Math.abs);
 const fn=new Function('g','crossPosition','localNormal','axialFrequency','crossFrequency','phase','u_seed','u_roundGrainFlip','u_shapeMode','flatAcross','flatDepth','observe',`const atan=Math.atan2,cos=Math.cos,sin=Math.sin,vec3=(...a)=>a,step=(e,x)=>x<e?0:1,mix=(a,b,t)=>a*(1-t)+b*t,fbm=g=>observe('fbm',g),valueNoise=g=>observe('valueNoise',g); ${body}`);
 return input=>{const calls=[];const value=fn(input.g,input.crossPosition,input.localNormal,input.axialFrequency,input.crossFrequency,input.phase,input.u_seed,input.u_roundGrainFlip,input.u_shapeMode,flatAcross,flatDepth,(kind,g)=>{calls.push({kind,coordinate:g});return .5+.45*Math.sin(g[0]*.017+g[1]*.13+g[2]*.29);});return{value,calls};};
}

test('selected original coordinates and output are exact across shape/parameter boundaries',()=>{
 const original=Object.fromEntries(['sideAnisotropicNoise','sideValueNoise'].map(n=>[n,compileHelper(originalFunctions.get(n).text)]));
 const variants=Object.fromEntries(Object.entries(shapeSourceEvidence).map(([shape,fns])=>[shape,Object.fromEntries(Object.entries(fns).map(([name,e])=>[name,compileHelper(e.specializedFunction)]))]));
 let seed=7654321;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);let cases=0,maxOutputError=0,maxCoordinateError=0;
 const modes=[-2,-Number.EPSILON,0,.5-Number.EPSILON,.5,.5+Number.EPSILON,1,2],flips=[-1,-Number.EPSILON,0,Number.EPSILON,1],normals=[[0,1,0],[0,0,1],[0,1,1],[1,0,0],[0,-1,1]],frequencies=[0,.18,.31,.42,.46,.72,1.35,1.55,2.25,3.1,4.4,7.2,18,38*1.75,1e4],seeds=[0,Number.EPSILON,.5,1-Number.EPSILON];
 for(const u_shapeMode of modes)for(let i=0;i<420;i++){
  const tiny=Number.EPSILON,input={g:[(random()-.5)*20,(random()-.5)*2,(random()-.5)*2],crossPosition:i%4===0?[-1,tiny]:i%4===1?[-1,-tiny]:i%4===2?[tiny,1]:[random()-.5,random()-.5],localNormal:normals[i%normals.length],axialFrequency:frequencies[i%frequencies.length],crossFrequency:frequencies[(i*7)%frequencies.length],phase:i%2?1e6:-1e6,u_seed:seeds[i%seeds.length],u_roundGrainFlip:flips[i%flips.length],u_shapeMode};
  const shape=shapeVariantForUniform(u_shapeMode),selectedIndex=shape==='planar'?0:1;
  for(const name of Object.keys(original)){const a=original[name](input),b=variants[shape][name](input);assert.equal(a.calls.length,2);assert.equal(b.calls.length,1);assert.deepEqual(b.calls[0],a.calls[selectedIndex]);assert.equal(b.value,a.value);cases++;maxOutputError=Math.max(maxOutputError,Math.abs(a.value-b.value));for(let c=0;c<3;c++)maxCoordinateError=Math.max(maxCoordinateError,Math.abs(b.calls[0].coordinate[c]-a.calls[selectedIndex].coordinate[c]));}
 }
 report.cpu={cases,maxOutputError,maxSelectedCoordinateError:maxCoordinateError,originalNoiseCallsPerHelper:2,specializedNoiseCallsPerHelper:1,shapeModeBoundaryValues:modes,roundFlipBoundaryValues:flips,normalCases:normals,frequencyCases:frequencies,seedCases:seeds,coordinateBranchCutCases:true,originalNoiseImplementationUnmodified:true};
});

test('original binding runs first; shape change reselects; invalid input restores original',()=>{
 let mode=0,called=0,needs=0;const uniforms={u_shapeMode:{value:NaN}},geometry={},state={},originalName='OriginalTimber';
 const material={vertexShader:Original.vertexShaderSource.replace(/^#version 300 es\n/,''),fragmentShader:Original.fragmentShaderSource.replace(/^#version 300 es\n/,''),uniforms,name:originalName,set needsUpdate(value){if(value)needs++;}};
 const mesh={material,geometry,onBeforeRender:function(...args){assert.equal(this,mesh);assert.deepEqual(args,['renderer','scene','camera']);called++;uniforms.u_shapeMode.value=mode;return 42;}},hook=mesh.onBeforeRender,made={mesh,state,proof:{originalUniformBinding:true}};
 specializeTimberShape(made);assert.notEqual(mesh.onBeforeRender,hook);assert.equal(made.proof.shapeSpecialization.originalHookIdentityPreserved,false);assert.equal(mesh.geometry,geometry);assert.equal(material.uniforms,uniforms);assert.equal(made.state,state);
 const render=()=>mesh.onBeforeRender('renderer','scene','camera');assert.equal(render(),42);assert.equal(made.proof.shapeSpecialization.currentVariant,'planar');assert.equal(needs,1);render();assert.equal(needs,1);
 mode=1;render();assert.equal(made.proof.shapeSpecialization.currentVariant,'round');assert.equal(material.fragmentShader,shapeSpecializedFragmentSources.round.replace(/^#version 300 es\n/,''));assert.equal(needs,2);
 mode=0;render();assert.equal(made.proof.shapeSpecialization.currentVariant,'planar');assert.equal(needs,3);
 for(const invalid of [NaN,Infinity,-Infinity,undefined,null,'round']){mode=invalid;render();assert.equal(made.proof.shapeSpecialization.currentVariant,'original');assert.equal(material.fragmentShader,Original.fragmentShaderSource.replace(/^#version 300 es\n/,''));}
 assert.equal(needs,4);assert.equal(called,10);const wrapped=mesh.onBeforeRender;specializeTimberShape(made);assert.equal(mesh.onBeforeRender,wrapped);assert.equal(made.proof.shapeSpecialization.boundedSkipCombined,false);report.lifecycle={originalBindingCalledFirst:true,originalHookContextArgumentsAndReturnPreserved:true,planarRoundPlanarReselection:true,invalidShapeFallback:true,noRecompileForUnchangedMode:true,changedHookIdentityDisclosed:true};
});

test('actual native binder drives box, material-round and inferred-cylinder program selection',()=>{
 const preset=Original.getYunnanTimberPreset('yunnan_light_weathered_v2'),geometry=Original.createSubdividedBoxGeometry(2.06,.218,.038,{lengthSegments:8,crossSegments:2,endSegments:2});
 const sourceMesh={id:'shape-test',kind:'wood',geometry,material:Original.materialFor('source','shape-test',198107,preset),model:Original.mat4Identity()};
 const names=[...new Set([...Original.vertexShaderSource.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g),...Original.fragmentShaderSource.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map(m=>m[1]))],uniforms=Object.fromEntries(names.map(n=>[n,{value:0}])),locations=Object.fromEntries(names.map(n=>[n,n]));
 const put=(n,v)=>uniforms[n].value=v,gl={uniform1f:put,uniform1i:put,uniform2fv:put,uniform3fv:put,uniformMatrix4fv:(n,_t,v)=>put(n,v)},frame={preset,settings:{reliefMode:'inspection'},view:Original.mat4Identity(),projection:Original.mat4Identity(),cameraPosition:[2,3,4]};
 const material={vertexShader:Original.vertexShaderSource.replace(/^#version 300 es\n/,''),fragmentShader:Original.fragmentShaderSource.replace(/^#version 300 es\n/,''),uniforms,name:'Native'},made={mesh:{material,onBeforeRender(){Original.bindOriginalTimberUniforms(gl,locations,sourceMesh,frame);}},proof:{originalUniformBinding:true}};
 specializeTimberShape(made);made.mesh.onBeforeRender();assert.equal(made.proof.shapeSpecialization.currentVariant,'planar');assert.equal(uniforms.u_parallaxSteps.value,12);
 sourceMesh.material.shapeMode='round';made.mesh.onBeforeRender();assert.equal(made.proof.shapeSpecialization.currentVariant,'round');
 sourceMesh.material.shapeMode=0;made.mesh.onBeforeRender();assert.equal(made.proof.shapeSpecialization.currentVariant,'planar');
 sourceMesh.geometry={...geometry,metadata:{...geometry.metadata,type:'cylinder-member'}};made.mesh.onBeforeRender();assert.equal(made.proof.shapeSpecialization.currentVariant,'round');
 report.nativeBinding={actualOriginalBinderExecuted:true,boxSelection:'planar',materialRoundSelection:'round',inferredCylinderSelection:'round',inspectionParallaxSteps:uniforms.u_parallaxSteps.value};
});

test('reject mutated source rather than silently combining optimizations',()=>{assert.throws(()=>specializeTimberShape({mesh:{onBeforeRender(){},material:{fragmentShader:'modified',vertexShader:'modified'}},proof:{originalUniformBinding:true}}),/unmodified original/);});

test('persist specialization source and CPU evidence',async()=>{await writeFile(new URL('./shape-specialization-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');});
