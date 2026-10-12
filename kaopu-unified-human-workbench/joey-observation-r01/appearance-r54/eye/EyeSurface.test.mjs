import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {finiteSourceReflection,eyeEdgeMasks,reflectionRadiance,validateEyeSurface} from './EyeSurfaceMath.mjs';
import {attachNativeEyeSurfaceR54,patchNativeEyeSurface} from './NativeEyeSurfaceR54.mjs';
import {attachR05EyeBridge} from './fixtures/eye-r14/R05EyeBridge.mjs';

test('finite source responds to actual light direction and rejects the rear hemisphere',()=>{
 const base={normal:[0,0,1],view:[0,0,1],angularWidth:.075};
 assert.equal(finiteSourceReflection({...base,lightDirection:[0,0,1]}),.025);
 assert.equal(finiteSourceReflection({...base,lightDirection:[0,0,-1]}),0);
 assert.equal(finiteSourceReflection({...base,lightDirection:[1,0,0]}),0);
 assert.equal(finiteSourceReflection({normal:[0,1,0],view:[0,1,0],lightDirection:[0,1,0]}),.025,'vertical source basis remains finite');
 assert.equal(finiteSourceReflection({...base,lightDirection:[0,0,3]}),.025,'direction magnitude is irrelevant');
 assert.throws(()=>finiteSourceReflection({...base,lightDirection:[0,0,0]}),/Degenerate/);
});

test('light linear color and intensity directly scale reflected radiance',()=>{
 const input={reflection:.025,strength:1.2,wetness:.68,radial:.5};
 const a=reflectionRadiance({...input,color:[2,1,.5]}),b=reflectionRadiance({...input,color:[4,2,1]});
 assert.deepEqual(b,a.map(x=>x*2));
 assert.deepEqual(reflectionRadiance({...input,color:[0,0,0]}),[0,0,0]);
 assert.deepEqual(reflectionRadiance({...input,color:[1,0,0]}).slice(1),[0,0]);
 assert.deepEqual(reflectionRadiance({...input,color:[2,1,.5],wetness:0}),[0,0,0]);
});

test('edge controls soften appearance without moving the half-coverage boundaries',()=>{
 for(const enabled of [false,true]){
  assert.equal(eyeEdgeMasks({radius:1,pupilRadius:.3,enabled}).iris,.5);
  assert.equal(eyeEdgeMasks({radius:.3,pupilRadius:.3,enabled}).pupil,.5);
 }
 const soft=eyeEdgeMasks({radius:.304,pupilRadius:.3}),hard=eyeEdgeMasks({radius:.304,pupilRadius:.3,enabled:false});
 assert(soft.pupil>hard.pupil);assert.equal(hard.pupil,0);
 for(let i=0;i<=1000;i++){
  const a=eyeEdgeMasks({radius:i/500,pupilRadius:.3}),b=eyeEdgeMasks({radius:(i+1)/500,pupilRadius:.3});
  for(const k of ['iris','pupil']){assert(a[k]>=0&&a[k]<=1);assert(a[k]>=b[k]);}
 }
});

test('zero additional feather and disabled fields reproduce the native edge oracle',()=>{
 for(const derivative of [0,.001,.025])for(let i=0;i<400;i++){
  const input={radius:i/200,pupilRadius:.32,derivative};
  assert.deepEqual(eyeEdgeMasks({...input,enabled:false}),eyeEdgeMasks({...input,pupilFeather:0,limbusSoftness:0}));
 }
});

test('strict authored settings reject unsupported contact shadows, texture paths and invalid values',()=>{
 for(const input of [{contactShadow:1},{texture:'anything'},{enabled:1},{wetness:NaN},{pupilFeather:-1},{limbusSoftness:.5},null,[]])assert.throws(()=>validateEyeSurface(input));
 assert.deepEqual(validateEyeSurface({enabled:false}),{...validateEyeSurface(),enabled:false});
});

const sha=x=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+x.length+'\0'),x])).digest('hex');
test('fixtures are exact audited Git blobs, not a handwritten integration fixture',()=>{
 const blobs={'CommonSkinLayer.mjs':'7005138bfaac3e5b4c6858b006ab4972cfeac953','eye-r14/R05EyeBridge.mjs':'bfd1d9962bacdec99ed7fd9e82f51ae8ebb58c28','eye-r14/NativeEyeOptics.mjs':'bf33760d2ed089e04f427a44f177f37cf2fedd2a','eye-r14/IrisField.mjs':'10f5135a262c70f7eda29502cedf8ef095434153','eye-r14/EyeParameters.mjs':'2b81c54647823b6fd517659f8e9952e4aec550b8'};
 for(const[name,expected]of Object.entries(blobs))assert.equal(sha(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))),expected,name);
});

function fixture(){
 let newTextures=0,renders=0;
 class Vector2{constructor(x=0,y=0){this.x=x;this.y=y;}}
 class Vector3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}fromArray(a){[this.x,this.y,this.z]=a;return this;}}
 class BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.count=array.length/itemSize;}}
 class DataTexture{constructor(data,width,height){this.image={data,width,height};newTextures++;}dispose(){this.disposed=true;}}
 const THREE={Vector2,Vector3,BufferAttribute,DataTexture,MeshPhysicalMaterial:function(p){Object.assign(this,p);},FrontSide:0};
 const raw=fs.readFileSync(new URL('./fixtures/CommonSkinLayer.mjs',import.meta.url),'utf8');
 const makeMaterial=vm.runInNewContext(raw.replace(/^import .*;\n/gm,'').replace(/export /g,'')+'\nmakeMaterial',{THREE});
 const material=makeMaterial({}),attributes={};
 const geometry={getAttribute:k=>attributes[k],setAttribute(k,v){attributes[k]=v;},deleteAttribute(k){delete attributes[k];}};
 const template=new Float32Array([-.03,0,.01,-.025,0,.01,-.03,.005,.01,.03,0,.01,.035,0,.01,.03,.005,.01]);
 const model={vertexCount:6,bodyCount:0,positions:template.slice(),faces:new Uint32Array([0,1,2,3,4,5]),gnm:{numVertices:6,template,componentId:[1,1,1,2,2,2],materialId:[6,5,5,6,5,5]},canonical:{gnmRecipes:Array.from({length:6},(_,i)=>[i,i,0])}};
 const skin={material,viewer:{geometry,model,render(){renders++;}},dispose(){this.disposed=true;}};
 const commonCompile=material.onBeforeCompile,commonKey=material.customProgramCacheKey;
 const bridge=attachR05EyeBridge(skin,{THREE});
 const shader=()=>({uniforms:{},vertexShader:'void main(){\n#include <begin_vertex>\n}',fragmentShader:'#include <common>\nvoid main() {\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <clearcoat_normal_fragment_maps>\n#include <lights_physical_fragment>\n#include <lights_fragment_begin>\n#include <opaque_fragment>\n}'});
 return {skin,bridge,shader,commonCompile,commonKey,textures:()=>newTextures,renders:()=>renders};
}

test('real R05 + E1 compile hooks accept adapter; E1 atlas, chart and geometry survive; complete disposal restores CommonSkin',()=>{
 const f=fixture(),{skin,bridge}=f,oldCompile=skin.material.onBeforeCompile,oldKey=skin.material.customProgramCacheKey;
 const positions=skin.viewer.model.positions.slice(),faces=skin.viewer.model.faces.slice(),chart=skin.viewer.geometry.getAttribute('fEye'),atlas=skin.eyeOptics.uniforms.uE1Atlas.value,textures=f.textures();
 const a=attachNativeEyeSurfaceR54(skin),shader=f.shader();skin.material.onBeforeCompile(shader);
 assert.equal(a.report().compiles,1);assert.equal(a.report().contactShading,false);assert.equal(a.report().geometryChanged,false);
 assert.equal(skin.viewer.geometry.getAttribute('fEye'),chart);assert.equal(skin.eyeOptics.uniforms.uE1Atlas.value,atlas);assert.equal(f.textures(),textures);
 assert.deepEqual(skin.viewer.model.positions,positions);assert.deepEqual(skin.viewer.model.faces,faces);
 assert(shader.fragmentShader.includes('directionalLights[r54Light].color'));assert(shader.fragmentShader.includes('directionalLights[r54Light].direction'));
 assert(shader.fragmentShader.indexOf('r54Reflection+=')<shader.fragmentShader.indexOf('if(uE1Enabled>.5&&uR54EyeEnabled>.5'));
 assert.equal((shader.fragmentShader.match(/#include <opaque_fragment>/g)||[]).length,1);
 assert.equal(attachNativeEyeSurfaceR54(skin),a,'idempotent installation');
 const before=a.report().parameters;assert.throws(()=>a.set({wetness:NaN}));assert.deepEqual(a.report().parameters,before,'invalid updates are atomic');
 a.enabled(false);assert.equal(a.uniforms.uR54EyeEnabled.value,0);a.enabled(true);assert.equal(a.uniforms.uR54EyeEnabled.value,1);
 a.dispose();assert.equal(skin.material.onBeforeCompile,oldCompile);assert.equal(skin.material.customProgramCacheKey,oldKey);a.dispose();assert.throws(()=>a.set({wetness:0}),/disposed/);
 const next=attachNativeEyeSurfaceR54(skin);bridge.dispose();assert(next.report().disposed);assert.equal(skin.material.onBeforeCompile,f.commonCompile);assert.equal(skin.material.customProgramCacheKey,f.commonKey);assert.equal(skin.viewer.geometry.getAttribute('fEye'),undefined);assert.equal(skin.nativeEyeSurfaceR54,undefined);assert.equal(skin.eyeOptics,undefined);
});

test('shader anchor failure is atomic and later material layers cannot be accidentally removed',()=>{
 const f=fixture(),s=f.shader();f.skin.material.onBeforeCompile(s);s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>','MISSING');
 const text=s.fragmentShader,uniforms={...s.uniforms};assert.throws(()=>patchNativeEyeSurface(s,{newUniform:{value:1}}),/contract changed/);assert.equal(s.fragmentShader,text);assert.deepEqual(s.uniforms,uniforms);
 const api=attachNativeEyeSurfaceR54(f.skin),original=f.skin.material.onBeforeCompile;f.skin.material.onBeforeCompile=()=>{};
 assert.throws(()=>api.dispose(),/later eye/);assert.equal(api.report().disposed,false);f.skin.material.onBeforeCompile=original;f.bridge.dispose();
});
