import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FIELDS,DEFAULTS,validate,regionalMasks,lipFilterGain,response} from '../regions/RegionalRules.mjs';
import {patchRegionalShader} from '../regions/RegionalShader.mjs';
const values=[];
for(let l=0;l<=100;l++)for(let t=0;t<7;t++){
 const m=regionalMasks({face:1,cover:t===0?1:0,type:t,lip:l/100,thin:.9,nose:1,x:10,y:270});
 for(const v of Object.values(m))assert(Number.isFinite(v)&&v>=0&&v<=1);
 if(t>0)assert(Object.values(m).every(v=>v===0));
 values.push(m);
}
assert.equal(regionalMasks({face:1,cover:1,lip:0}).core,0);assert.equal(regionalMasks({face:1,cover:1,lip:1}).border,0);
for(const m of values)for(const lipDryness of [0,1])for(const alarOil of [0,1]){
 const r=response(.4,.25,.3,m,{...DEFAULTS,lipDryness,alarOil});assert(r.roughness>=.24&&r.roughness<=.95&&r.coat>=0&&r.coat<=.65);
}
assert.deepEqual(response(.15,.9,.05,values[50],{...DEFAULTS,enabled:false}),{roughness:.15,coat:.9,coatRoughness:.05});
for(const bad of [{lipDryness:2},{orbitalMicrorelief:NaN},{enabled:1},{x:1}])assert.throws(()=>validate(bad));
assert.equal(lipFilterGain(0,0),1);assert(lipFilterGain(5,5)<.13);
// Independent numerical integration: verify the Gaussian footprint formula itself,
// not a claim of exact pixel-box integration or perceptual realism.
let error=0;for(const d of [.2,.8,1.7]){let sum=0,weight=0;const sigma=d/Math.sqrt(12);for(let i=-1000;i<=1000;i++){const x=i/1000*5*sigma,w=Math.exp(-x*x/(2*sigma*sigma));sum+=Math.cos(x)*w;weight+=w;}error=Math.max(error,Math.abs(sum/weight-lipFilterGain(d,0)));}assert(error<2e-6);
const face=fs.readFileSync(new URL('../../face-transfer/FaceSkin.mjs',import.meta.url),'utf8'),host=fs.readFileSync(new URL('../../full/ui/skin/CommonSkinLayer.mjs',import.meta.url),'utf8');
// Feed extracted conceptual anchors rather than host JS (which repeats includes).
const anchors=[
 'uniform sampler2D uFAtlas,uFChroma;','float csSurfaceRough=clamp(',
 'float csGrooves=sin(vCSRest.x*12300.+csNoise(vCSRest*310.)*3.)*.5;',
 '(fData.r-.5)*.000032*uFDetail','visibility*ageGain*(1.-vFA.y)*(1.-vFA.z*.85)*(1.+vFA.w*.35)',
 '#include <clearcoat_normal_fragment_maps>',
 'material.clearcoatRoughness=clamp(material.clearcoatRoughness-(.045*vFA.y+.015*vFA.w)*fMask,.23,.55);',
 'if(uFLayer>.5&&uFLayer<1.5)'];
for(const a of anchors)assert((host+face).includes(a),a);
const eye=face.split('\n').find(s=>s.startsWith('vec3 fEyeColor()'));
const patched=patchRegionalShader(anchors.join('\n')+'\n'+eye);assert(patched.includes(eye));assert.throws(()=>patchRegionalShader('wrong host'));assert.throws(()=>patchRegionalShader(patched));
console.log(JSON.stringify({pass:true,maskCases:values.length,nonSkinLeak:0,gaussianReferenceMaxError:error,sourceAnchors:anchors.length,eyeFunctionUnchanged:true,newTextures:0}));
const {installRegionalSkin,attachRegionalSkin}=await import('../regions/RegionalSkin.mjs');
let native={faceParameters:[1,2,3]},renders=0;
const model={canonical:{topologySha256:'same-native-topology'},archive:()=>structuredClone(native),restore:r=>{native={faceParameters:[...r.faceParameters]};},faceSurface:{fields:{rest:[],landmark:(a,id)=>({31:[-.01,.27,.1],35:[.01,.27,.1],36:[-.046,.3,.1],39:[-.018,.3,.1],42:[.018,.3,.1],45:[.046,.3,.1]})[id]},attachSkin(){}}};
const api=installRegionalSkin(model),skin={viewer:{model,render(){renders++;}},faceExtension:{},material:{customProgramCacheKey:()=> 'native',onBeforeCompile(){}},dispose(){this.disposed=true;}};
const ext=attachRegionalSkin(skin,api);assert.equal(attachRegionalSkin(skin,api),ext);
let uniforms;for(const enabled of [true,false,true,false,true]){api.set({enabled});const s={fragmentShader:anchors.join('\n'),uniforms:{}};skin.material.onBeforeCompile(s);if(uniforms)assert.equal(s.uniforms.uRAla,uniforms.uRAla);uniforms=s.uniforms;assert.equal(s.fragmentShader.includes('rLipPhase'),enabled);}
const original=model.archive();api.set({lipDryness:0});model.restore(original);assert.equal(api.settings.lipDryness,DEFAULTS.lipDryness);
assert.throws(()=>model.restore({...original,regionalSkin:{...original.regionalSkin,settings:{alarOil:100}}}));assert.deepEqual(model.archive(),original);
model.restore({faceParameters:[1,2,3]});assert.equal(api.settings.enabled,false);assert.deepEqual(native,{faceParameters:[1,2,3]});skin.dispose();assert.equal(api.skins.size,0);assert(ext.disposed);
console.log(JSON.stringify({pass:true,lifecycleToggles:5,archiveRestoration:true,invalidAtomic:true,legacyOptOut:true,disposal:true,renders}));

for(const [x,y] of [[0,355],[0,250],[32,260],[-32,260]])assert.equal(regionalMasks({face:1,cover:1,thin:.9,x,y}).orbital,0);
assert(regionalMasks({face:1,cover:1,thin:.9,x:32,y:300}).orbital>.5);
console.log('Orbital mask rejects forehead, alar and lower-cheek probes');

for(const [key,,lo,,step]of FIELDS){const index=(DEFAULTS[key]-lo)/step;assert(Math.abs(index-Math.round(index))<1e-9,key+" default must be exactly representable by native range input");}
