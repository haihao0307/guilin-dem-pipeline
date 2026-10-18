import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../../../a4-a6-source-comparison-r03/vendor/three.module.js';
import {createA6MaterialLibrary} from '../src/a6-materials.mjs';
import {A6_COATING_FIELDS, A6_COATING_SUBSTITUTIONS, A6_COATING_PROVENANCE, A6_COATING_ROLES, A6_DEFAULT_COATING_WEAR, validateA6CoatingWear, bindA6RestAttributes, A6_REST_ATTRIBUTE_VERSION} from '../src/a6-causal-coating.mjs';
import {evaluateA6CoatingLayer, a6NoiseValueGradient} from '../src/a6-coating-reference.mjs';
import {PARAMETERIZED_METAL_FIELDS} from '../../master-materials-v3-1/r06-source-parameters.mjs';
const base = new URL('../../', import.meta.url);
const checks = [
 ['master-materials-v3-1/vendor/material-master-r06/metal-surface.mjs', A6_COATING_PROVENANCE.layerSourceSha256],
 ['master-materials-v3-1/r06-source-parameters.mjs', A6_COATING_PROVENANCE.parameterAdapterSha256],
 ['master-materials-v3-1/vendor/train-r08/materials/matter.mjs', A6_COATING_PROVENANCE.enamelSourceSha256],
 ['student-native-r01/src/native-materials.mjs', A6_COATING_PROVENANCE.nativeTransportSha256],
];
for (const [path, expected] of checks) assert.equal(createHash('sha256').update(readFileSync(new URL(path, base))).digest('hex'), expected, path);
let derived = PARAMETERIZED_METAL_FIELDS;
for (const [before, after] of A6_COATING_SUBSTITUTIONS) {assert.equal(derived.split(before).length, 2); derived = derived.replace(before, after);}
assert.equal(derived, A6_COATING_FIELDS);
for (const name of ['mt_kh','mt_kn','mt_kfb','mt_knvg','mt_kfbvg','mt_aa','mt_resolved']) {
 const declaration = new RegExp(`(?:float|vec4) ${name}\\([^]*?\\n?\\}`);
 const original=PARAMETERIZED_METAL_FIELDS.match(declaration)?.[0];assert(original, name+' source function found');
 assert.equal(A6_COATING_FIELDS.match(declaration)?.[0], original);
}
for (const value of [-.01,1.01,NaN,Infinity,'0.3',null]) assert.throws(() => validateA6CoatingWear(value));
const lib = createA6MaterialLibrary(T), options = {restMatrix: new T.Matrix4().toArray(), units: 'm'}, coated = [];
const shaderFor = m => {const s = {uniforms:T.UniformsUtils.clone(T.ShaderLib.physical.uniforms), vertexShader:T.ShaderLib.physical.vertexShader, fragmentShader:T.ShaderLib.physical.fragmentShader};m.onBeforeCompile(s);return s;};
for (const role of A6_COATING_ROLES) {
 const m = lib.create(role, options), s = shaderFor(m); coated.push([m,s]);
 assert(m.userData.a6Coating.shaderHookExecuted);
 assert.equal(s.uniforms.uWear.value, A6_DEFAULT_COATING_WEAR);
 assert.equal(s.uniforms.uVariant.value, 1);assert.equal(s.uniforms.uJointCount.value, 0);
 assert.deepEqual(s.uniforms.uTrainSourceColor.value.toArray(), [m.color.r,m.color.g,m.color.b]);
 for (const key of ['uHistory','uWet','uRack']) assert.equal(s.uniforms[key].value, 0);
 assert(s.fragmentShader.startsWith(A6_COATING_FIELDS));
 assert(s.fragmentShader.includes('float oxideClass=0.;'));
 assert(s.fragmentShader.includes('float pits=0.;'));
 if (m.userData.a6Coating.inheritedFamily === 'paint') {
  assert(s.fragmentShader.includes('fh88FinishReliefM*(1.-smoothstep(.4,1.6,footprint))*a6ms.layers.x+a6ms.height;'));
  assert(s.fragmentShader.includes('material.specularColor=a6ms.coverageF0;'));
  assert(s.fragmentShader.includes('metalnessFactor=a6ms.metal;'));
  assert(s.vertexShader.includes('vRestM=(uNativeRestMetres*vec4(position,1.)).xyz;'));
 }
}
for (const role of ['gold','glass','lamp','skin','uniform','seat','rubber','interior','dark-iron','brushedMetal','trim-brass']) assert.equal(lib.create(role, options).userData.a6Coating, undefined, role);
const cacheKeys = coated.map(([m]) => m.customProgramCacheKey());
assert.equal(lib.setCoatingWear(.73).materialCount, A6_COATING_ROLES.length);
for (const [m,s] of coated) {assert.equal(m.userData.a6Coating.wear,.73);assert.equal(s.uniforms.uWear.value,.73);}
assert.deepEqual(coated.map(([m]) => m.customProgramCacheKey()), cacheKeys, 'Wear must only change uniforms.');
assert.equal(lib.create('paint',options).userData.a6Coating.wear,.73);
assert.throws(() => lib.setCoatingWear(2));assert.equal(lib.getCoatingState().wear,.73);
lib.dispose();assert.throws(() => lib.setCoatingWear(.2));
// Deforming shrouds sample explicit immutable rest attributes; lighting stays live.
const restLibrary=createA6MaterialLibrary(T);let restAttributeShaderHooks=0;
for(const role of ['paint','blackPaint','red']) {
 const material=restLibrary.create(role,options), before=shaderFor(material), beforeKey=material.customProgramCacheKey();
 assert.equal(bindA6RestAttributes(material),material);
 const after=shaderFor(material), afterKey=material.customProgramCacheKey();
 assert.equal(after.fragmentShader,before.fragmentShader,'Rest binding cannot change physical lighting or fragment logic.');
 let expected=before.vertexShader.replace('vRestM=(uNativeRestMetres*vec4(position,1.)).xyz;vSurfaceN=normalize(uNativeRestNormal*normal);','vRestM=a6RestPosition;vSurfaceN=normalize(a6RestNormal);');
 if(material.userData.a6Coating.inheritedFamily==='paint')expected=expected.replace('vKP=(uNativeRestMetres*kpos).xyz;vKN=normalize(uNativeRestNormal*knorm);','vKP=a6RestPosition;vKN=normalize(a6RestNormal);');
 assert.equal(after.vertexShader,'attribute vec3 a6RestPosition;attribute vec3 a6RestNormal;\n'+expected,'Only material-field coordinates may change.');
 assert.equal(afterKey,beforeKey+'|'+A6_REST_ATTRIBUTE_VERSION);
 assert(material.userData.a6Coating.restAttributes.shaderHookExecuted);
 assert.equal(material.userData.a6Coating.restAttributes.currentLightingNormalPreserved,true);
 assert.equal(material.userData.a6Coating.restAttributes.geometryCorrespondenceVerified,false);
 bindA6RestAttributes(material);assert.equal(material.customProgramCacheKey(),afterKey,'Repeated binding is idempotent.');
 assert.equal(shaderFor(material).vertexShader,after.vertexShader);
 restLibrary.setCoatingWear(.47);assert.equal(after.uniforms.uWear.value,.47);
 restAttributeShaderHooks++;
}
assert.throws(()=>bindA6RestAttributes(restLibrary.create('gold',options)));
assert.throws(()=>bindA6RestAttributes({}));
// A source drift must be reported, not silently remapped to current/deformed positions.
const drift=restLibrary.create('paint',options), compile=drift.onBeforeCompile.bind(drift);
drift.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replace('vKP=(uNativeRestMetres*kpos).xyz;','vKP=vec3(0.);');};
bindA6RestAttributes(drift);assert.throws(()=>shaderFor(drift),/R08 explicit rest attributes drift/);
restLibrary.dispose();
// Verify the analytic noise gradient against finite differences, not fixed image samples.
for (const p of [[.31,.56,.89],[-2.27,4.62,7.23],[17.6,9.12,-.21]]) {
 const a = a6NoiseValueGradient(p), eps = 1e-5;
 for (let axis = 0; axis < 3; axis++) {const b=[...p],c=[...p];b[axis]+=eps;c[axis]-=eps;assert(Math.abs(a[axis+1]-(a6NoiseValueGradient(b)[0]-a6NoiseValueGradient(c)[0])/(2*eps))<1e-7);}
}
let samples=0, maxConservationError=0, monotonic=true, primerSamples=0, bareSamples=0;
const wears=[0,A6_DEFAULT_COATING_WEAR,.65,1], coverage=wears.map(() => 0);
for (let ix=0;ix<97;ix++) for(let iy=0;iy<29;iy++) {
 const p=[-6+ix*.1271,.23+iy*.1137,1.183], n=[0,0,1];let previous=-1;
 for (let wi=0;wi<wears.length;wi++) {
  const q=evaluateA6CoatingLayer(p,n,{wear:wears[wi]});
  maxConservationError=Math.max(maxConservationError,Math.abs(q.layers.reduce((a,b)=>a+b,0)-1));
  assert(q.layers.every(x=>x>=0 && x<=1));assert(q.loss+1e-12>=previous);previous=q.loss;
  assert.equal(q.metalness,q.layers[2]);assert.equal(q.corrosion,0);
  assert(q.roughness>=0 && q.roughness<=1);assert(q.heightM>=-.000003001 && q.heightM<=.000140001);
  coverage[wi]+=q.loss;
  if(wi===0){assert.deepEqual(q.layers,[1,0,0]);assert.equal(q.metalness,0);assert.equal(q.roughness,.40);assert.equal(q.heightM,.00014);}
  if(q.layers[1]>.01)primerSamples++;if(q.layers[2]>.99)bareSamples++;
 }
 samples++;
}
assert(maxConservationError<1e-12);assert(primerSamples>0);assert(bareSamples>0);
for(let i=0;i<coverage.length;i++)coverage[i]/=samples;
assert(coverage[1]>0 && coverage[1]<.02,'Default must be modest sampled wear; this is not whole-train area measurement.');
assert(coverage[2]>coverage[1] && coverage[3]>coverage[2]);
const report={version:A6_COATING_PROVENANCE.version,result:'PASS',shaderHooksExecuted:coated.length,restAttributeShaderHooks,originalSourceHashesChecked:checks.length,guardedFieldSubstitutions:A6_COATING_SUBSTITUTIONS.length,referenceSamples:samples,referenceCoverage:wears.map((wear,i)=>({wear,coverage:coverage[i]})),maxConservationError,primerSamples,bareSamples,monotonic,normalGradientFiniteDifferenceVerified:true,units:'m',gpuCompileValidated:false,visualAcceptance:false,notes:'CPU hook and double-precision causal semantics only. Finite plane sampling is not actual train area loss. Real WebGL compile and detail/brand renders are required separately.'};
writeFileSync(new URL('./causal-coating.cpu-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
