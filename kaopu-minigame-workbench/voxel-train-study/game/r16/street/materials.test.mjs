import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../../../vendor/three.module.js';
import {createMaterialLibrary,SURFACE_SHADER,MATERIAL_REVISION} from './materials.mjs';
const score=JSON.parse(readFileSync(new URL('./first-street.score.json',import.meta.url)));
const families=['plaster','brick','wood','iron','glass','cloth','sign','neon','concrete','paper','ceramic','zinc'];
const hook=material=>{
  const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
  material.onBeforeCompile(shader);
  return shader;
};

test('r170 source hooks work for every family, without texture objects or injected samplers',()=>{
  assert.equal(THREE.REVISION,'170');
  const lib=createMaterialLibrary(THREE,score);
  for(const family of families){
    const material=lib.get(family),shader=hook(material);
    assert.ok(material.isMeshStandardMaterial);
    for(const [name,value] of Object.entries(material)) if(/map$/i.test(name)) assert.equal(value,null,name);
    assert.equal(material.userData.street.textureFree,true);
    assert.match(shader.vertexShader,/instanceMatrix \* streetPosition/);
    assert.match(shader.vertexShader,/modelMatrix \* streetPosition/);
    assert.match(shader.vertexShader,/inverseTransformDirection\(transformedNormal, viewMatrix\)/);
    assert.match(shader.fragmentShader,/float stWet=/);
    assert.ok(shader.fragmentShader.indexOf('float stWet=')<shader.fragmentShader.indexOf('roughnessFactor=clamp'));
    assert.ok(shader.fragmentShader.indexOf('#include <normal_fragment_maps>')<shader.fragmentShader.indexOf('vec3 stDx='));
    assert.equal(shader.uniforms.stAge.value,material.userData.street.config.age);
    assert.equal(material.customProgramCacheKey(),MATERIAL_REVISION+'/'+families.indexOf(family));
  }
  assert.doesNotMatch(Object.values(SURFACE_SHADER).join('\n'),/sampler(?:2D|Cube)|texture(?:2D|Cube|Lod)\s*\(|\bvUv\b/);
  lib.dispose();
});

test('cache canonicalizes colors and option order; building masks are uniform rather than per-window materials',()=>{
  const lib=createMaterialLibrary(THREE,score);
  const first=lib.get('plaster',{age:.8,repair:.2,color:'#b0aa91',origin:[-2,0,-7]});
  assert.equal(lib.get('plaster',{origin:{x:-2,y:0,z:-7},color:0xb0aa91,repair:.2,age:.8}),first);
  assert.equal(lib.get('plaster',{origin:[-2,0,-7],tint:0xb0aa91,repair:.2,age:.8}),first);
  for(let i=0;i<80;i++) assert.equal(lib.get('plaster',{age:.8,repair:.2,color:'#b0aa91',origin:[-2,0,-7]}),first);
  assert.equal(lib.materials.length,1);
  assert.equal(lib.get('stone'),lib.get('plaster'));
  assert.equal(lib.get('rust'),lib.get('iron'));
  assert.equal(lib.get('enamel'),lib.get('iron'));
  assert.equal(lib.get('lamp'),lib.get('neon'));
  assert.equal(lib.get('soot'),lib.get('concrete'));
  assert.throws(()=>lib.get('unknown'),/Unknown street material family/);
  lib.dispose();
});

test('same seed and score reproduce values, with physical grid dimensions and explicit controls',()=>{
  const a=createMaterialLibrary(THREE,score),b=createMaterialLibrary(THREE,score);
  const options={seed:'brick-01',age:.79,repair:.18,wetness:.4,origin:[-10.78,0,-7.52],floorHeight:3.03,groundHeight:4.2,width:8.45,bays:3,sillHeight:.245,sillEdge:.108};
  const ma=a.get('brick',options),mb=b.get('brick',options);
  assert.deepEqual(ma.userData.street.config,mb.userData.street.config);
  assert.notEqual(a.get('brick',{...options,seed:'timber-02'}).userData.street.config.seed,ma.userData.street.config.seed);
  assert.deepEqual(hook(ma).uniforms.stGrid.value.toArray(),[3.03,4.2,8.45/3]);
  assert.deepEqual(hook(ma).uniforms.stOrigin.value.toArray(),options.origin);
  assert.deepEqual(hook(ma).uniforms.stSill.value.toArray(),[.245,.108]);
  assert.equal(hook(a.get('wood',{grainAxis:'x'})).uniforms.stGrainAxis.value.x,1);
  a.dispose(); b.dispose();
});

test('host time and weather reach already-compiled and newly-created shaders; explicit wetness remains local',()=>{
  const lib=createMaterialLibrary(THREE,score);
  const a=hook(lib.get('plaster')),b=hook(lib.get('brick',{wetness:.1}));
  lib.update(15,{wetness:.9});
  assert.equal(a.uniforms.stTime.value,15);
  assert.equal(a.uniforms.stWetness.value,.9);
  assert.equal(b.uniforms.stWetness.value,.1);
  const c=hook(lib.get('neon'));
  assert.equal(c.uniforms.stTime.value,15);
  assert.equal(c.uniforms.stWetness.value,.9);
  lib.update(NaN,{wetness:5});
  assert.equal(c.uniforms.stTime.value,15);
  assert.equal(c.uniforms.stWetness.value,1);
  lib.dispose();
});

test('host origin offset anchors metre masks while the train translates the entire street',()=>{
  const lib=createMaterialLibrary(THREE,score),a=hook(lib.get('plaster'));
  assert.deepEqual(a.uniforms.stWorldOffset.value.toArray(),[0,0,0]);
  lib.update(10,{originOffset:[-37,.0805,0]});
  assert.deepEqual(a.uniforms.stWorldOffset.value.toArray(),[-37,.0805,0]);
  const b=hook(lib.get('brick'));
  assert.equal(b.uniforms.stWorldOffset.value,a.uniforms.stWorldOffset.value);
  lib.update(10,{originOffset:[-38,.0805,0]});
  assert.deepEqual(a.uniforms.stWorldOffset.value.toArray(),[-38,.0805,0]);
  lib.update(10,{originOffset:[NaN,0,0]});
  assert.deepEqual(a.uniforms.stWorldOffset.value.toArray(),[-38,.0805,0]);
  assert.match(SURFACE_SHADER.surface,/stP=vStreetPosition-stWorldOffset-stOrigin/);
  const localPoint=new THREE.Vector3(-2,7,-8),hostTranslation=new THREE.Vector3(-38,.0805,0);
  const shaderPoint=localPoint.clone().add(hostTranslation).sub(a.uniforms.stWorldOffset.value);
  assert.ok(shaderPoint.distanceTo(localPoint)<1e-10);
  lib.dispose();
});

test('source keeps distinct source moisture, repaired base, fine grain, bond, wood and junction masks',()=>{
  const source=SURFACE_SHADER.surface;
  for(const token of ['stBelowLedge','stBelowSill','stSillEdge','stRising','stGrayPatch','stFresh','stFine','stRow','stJointDamp','stFiring','stGrain','stJunction','stSignWear']) assert.ok(source.includes(token),token);
  assert.match(source,/mod\(stRow,2\.0\)\*\.5/);
  assert.match(source,/stP\.zy : stP\.xy/);
  assert.match(SURFACE_SHADER.roughness,/,\.23,1\.0/);
  assert.match(source,/smoothstep\(\.003,\.021,stFootprint\)/);
});

test('material budget, single disposal and owner-managed resource disposal are explicit',()=>{
  const lib=createMaterialLibrary(THREE,{performance:{limits:{maxMaterials:2}}});
  let disposed=0;
  lib.get('brick').addEventListener('dispose',()=>disposed++);
  lib.get('wood');
  assert.throws(()=>lib.get('iron'),/material limit 2 exceeded/);
  lib.dispose(); lib.dispose();
  assert.equal(disposed,1);
  assert.equal(lib.materials.length,0);
  assert.throws(()=>lib.get('brick'),/has been disposed/);
  const owner=createMaterialLibrary(THREE,score);
  owner.get('brick').addEventListener('dispose',()=>disposed++);
  owner.dispose({resources:false});
  assert.equal(disposed,1);
  assert.equal(owner.materials.length,0);
});

test('unexpected Three shader changes fail loudly rather than silently dropping surfaces',()=>{
  const lib=createMaterialLibrary(THREE,score);
  assert.throws(()=>lib.get('plaster').onBeforeCompile({uniforms:{},vertexShader:'void main(){}',fragmentShader:''}),/Missing Three shader hook/);
  lib.dispose();
});


test('coastal exposure is a real bounded corrosion control, not ignored metadata',()=>{
 const a=createMaterialLibrary(THREE,{appearance:{saltExposure:0}}),b=createMaterialLibrary(THREE,{appearance:{saltExposure:1}});
 const x=a.get('iron'),y=b.get('iron');assert.equal(x.userData.street.uniforms.stSalt.value,0);assert.equal(y.userData.street.uniforms.stSalt.value,1);assert.match(SURFACE_SHADER.surface,/stSalt\*\.7/);a.dispose();b.dispose();
});
