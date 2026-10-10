import assert from 'node:assert/strict';import fs from 'node:fs';
import {patchCheekMeso,attachCheekMesoGuard} from '../relief-r03/CheekMesoGuard.mjs';
const source=`vec3 fBands(highp sampler2DArray tex,vec2 mm){vec3 r=fPatch(tex,mm,vFRest.x>0.?7.:0.,vFRest.x>0.?vec2(14.):vec2(18.));
 if(vFB.x>.001)r=mix(r,fPatch(tex,mm,1.,vec2(20.)),vFB.x);
 if(vFA.w>.001)r=mix(r,fPatch(tex,mm,2.,vec2(10.,14.)),vFA.w);
 if(vFB.w>.001)r=mix(r,fPatch(tex,mm,7.,vec2(14.)),vFB.w);
 if(vFA.z>.001)r=mix(r,fPatch(tex,mm,6.,vec2(12.)),vFA.z);
 if(vFA.y>.001)r=mix(r,fPatch(tex,mm,3.,vec2(25.,8.)),vFA.y);return r;}
fData=fBands(uSamplingAtlas,fMM);fChroma=fBands(uSamplingChroma,fMM);`;
const patched=patchCheekMeso(source);assert.equal((patched.match(/fPatch\(/g)||[]).length,(source.match(/fPatch\(/g)||[]).length);assert.equal((patched.match(/\.g=\.5/g)||[]).length,2);assert(!patched.includes('uniform'));assert.throws(()=>patchCheekMeso(patched));assert.throws(()=>patchCheekMeso(source+source));
let renders=0,disposals=0;const before=s=>s.fragmentShader=source,key=()=> 'pinned-R02',dispose=()=>disposals++;
const skin={faceExtension:{},samplingExtension:{},material:{onBeforeCompile:before,customProgramCacheKey:key},dispose,viewer:{render(){renders++;}}};
const api=attachCheekMesoGuard(skin,{enabled:false});assert.equal(skin.material.customProgramCacheKey(),'pinned-R02');let sh={};skin.material.onBeforeCompile(sh);assert.equal(sh.fragmentShader,source);api.setEnabled(true);sh={};skin.material.onBeforeCompile(sh);assert.equal(sh.fragmentShader,patched);assert(skin.material.customProgramCacheKey().endsWith('cheek-meso-guard/r03'));assert.throws(()=>api.setEnabled(.5));assert.throws(()=>attachCheekMesoGuard(skin));
const ours=skin.material.onBeforeCompile;skin.material.onBeforeCompile=()=>{};assert.throws(()=>api.dispose(),/Dispose later/);skin.material.onBeforeCompile=ours;
api.setEnabled(false);assert.equal(skin.material.customProgramCacheKey(),'pinned-R02');api.dispose();api.dispose();assert.equal(skin.material.onBeforeCompile,before);assert.equal(skin.material.customProgramCacheKey,key);assert.equal(skin.dispose,dispose);assert.equal(skin.cheekMesoGuard,undefined);assert.throws(()=>api.setEnabled(true));
attachCheekMesoGuard(skin);skin.dispose();assert.equal(disposals,1);assert.equal(skin.cheekMesoGuard,undefined);assert.throws(()=>attachCheekMesoGuard({faceExtension:{}}));
// Algebraic isolation of the existing ordered native blends.
const mix=(a,b,t)=>a.map((x,i)=>x*(1-t)+b[i]*t),tiles=Array.from({length:8},(_,i)=>[i/9,(i+1)/10,(i+2)/11]);
function bands(side,w,guard,chroma=false){const sample=i=>tiles[i].map((v,c)=>guard&&!chroma&&c===1&&(i===0||i===7)?.5:v);let r=sample(side?7:0);for(const[i,k]of [[1,0],[2,1],[7,2],[6,3],[3,4]])if(w[k]>.001)r=mix(r,sample(i),w[k]);return r;}
let cases=0;for(let code=0;code<243;code++){const w=[];let n=code;for(let i=0;i<5;i++){w.push([0,.5,1][n%3]);n=Math.floor(n/3);}for(const side of [false,true]){const a=bands(side,w,false),b=bands(side,w,true);assert.equal(a[0],b[0]);assert.equal(a[2],b[2]);assert.deepEqual(bands(side,w,true,true),a);if(w[4]===1||w[3]===1)assert.deepEqual(a,b);cases++;}}
console.log(JSON.stringify({pass:true,nativeBlendCases:cases,shaderSamplesUnchanged:true,newUniforms:0,hookLifecycle:'off/dispose exact; out-of-order dispose fails closed'}));
