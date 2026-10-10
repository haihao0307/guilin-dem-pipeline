import assert from 'node:assert/strict';
import fs from 'node:fs';
import {attachSkinSampling} from '../SkinSampling.mjs';
const host=fs.readFileSync(new URL('../../face-transfer/FaceSkin.mjs',import.meta.url),'utf8');
const image={width:1024,height:512},data=new Uint8ClampedArray(1024*512*4);
globalThis.document={createElement:type=>{assert.equal(type,'canvas');return{width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data})})};}};
const atlas={value:{image}},chroma={value:{image}},U={uFAtlas:atlas,uFChroma:chroma};let renders=0,disposals=0;
const skin={disposed:false,faceReady:Promise.resolve(),faceExtension:{U},viewer:{render(){renders++;}},material:{customProgramCacheKey:()=> 'original-et13',onBeforeCompile:shader=>Object.assign(shader.uniforms,U)},dispose(){this.disposed=true;disposals++;}};
const ext=await attachSkinSampling(skin);assert.equal(await attachSkinSampling(skin),ext);
const compiled=[];for(const enabled of [true,false,true,false,true]){
 ext.setEnabled(enabled);const shader={fragmentShader:host,uniforms:{}};skin.material.onBeforeCompile(shader);compiled.push(shader);
 assert.equal(shader.uniforms.uFAtlas,atlas);assert.equal(shader.uniforms.uFChroma,chroma);
 assert(shader.uniforms.uSamplingAtlas.value.isDataArrayTexture);assert(shader.uniforms.uSamplingChroma.value.isDataArrayTexture);
 assert.equal(shader.fragmentShader.includes('textureGrad(tex,vec3(uv,tile),dx,dy)'),enabled);
 const eye=host.split('\n').find(x=>x.startsWith('vec3 fEyeColor()'));assert(shader.fragmentShader.includes(eye));
}
assert(compiled.every(s=>s.uniforms.uSamplingAtlas===compiled[0].uniforms.uSamplingAtlas));
assert.equal(U.uFAtlas,atlas);assert.equal(U.uFChroma,chroma);skin.dispose();assert(ext.disposed);assert.equal(disposals,1);assert.throws(()=>ext.setEnabled(true));
delete globalThis.document;console.log(JSON.stringify({passed:true,scope:'real Three texture objects, mocked Canvas source; shader anchors, original sampler identity, stable uniforms across five toggles, eye source unchanged, disposal',renders}));
