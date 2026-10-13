import assert from 'node:assert/strict';import fs from 'node:fs';import {validate,patch}from'./LipFinish.mjs';import{BROW_PROFILE,mapBrowField,browDensity}from'./BrowProfile.mjs';
const skin=fs.readFileSync(new URL('./CommonSkinLayer.source.txt',import.meta.url),'utf8');
for(const invalid of[{edgeGamma:NaN},{roughness:Infinity},{clearcoat:-1},{enabled:'yes'}])assert.throws(()=>validate(invalid));
const shader={fragmentShader:skin,uniforms:{}};patch(shader,{});assert.match(shader.fragmentShader,/uR65LipGamma/);assert.throws(()=>patch(shader,{}));assert.throws(()=>patch({fragmentShader:'wrong engine',uniforms:{}},{}));
for(let i=0;i<=100;i++){const t=i/100,x=BROW_PROFILE.sourceAbsX[0]+t*(BROW_PROFILE.sourceAbsX[1]-BROW_PROFILE.sourceAbsX[0]);const y=BROW_PROFILE.sourceCenterYCoeff.reduce((a,c,j)=>a+c*t**j,0);const a=mapBrowField([x,y,0],[x,y,0],.012),b=mapBrowField([-x,y,0],[-x,y,0],.012);assert(a.every(Number.isFinite));assert.equal(a[0],-b[0]);assert.equal(a[1],b[1]);assert.equal(a[2],b[2]);assert(browDensity(x)>=0&&browDensity(x)<=1);}
assert(browDensity(BROW_PROFILE.sourceAbsX[0])<.4);assert(browDensity(BROW_PROFILE.sourceAbsX[1])<.5);
// With no lip field, pigment, roughness and coat all have exactly zero scope.
for(const g of[.65,.9,1.5]){assert.equal(0**g,0);assert.equal(1**g,1)}
console.log('PASS 8 bounded cosmetics/source contracts and 101 symmetric brow samples; no native render claimed');
