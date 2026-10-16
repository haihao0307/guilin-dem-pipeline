import assert from 'node:assert/strict';
import fs from 'node:fs';
const deployedRuntime=new URL('../../material-master-r02/vendor/three.module.js',import.meta.url);
const T=await import(fs.existsSync(deployedRuntime)?deployedRuntime:new URL('../../material-master-workbench-r02/vendor/three.module.js',import.meta.url));
import {TILE_CASES,normalizeOptions,panelDimensions,sampleChannels,chipMask,buildTileCase} from '../ceramic.mjs';
const checks=[],record=(name,extra={})=>checks.push({name,passed:true,...extra});
assert.equal(T.REVISION,'170');record('Runtime is Three r170');
assert.throws(()=>normalizeOptions({finish:'missing'}));assert.equal(normalizeOptions({width:0,joint:4}).width,.016);assert.equal(normalizeOptions({width:0,joint:4}).joint,.012);record('Invalid preset rejected; SI dimensions safely bounded');
for(const finish of Object.keys(TILE_CASES)){
 const p=normalizeOptions({finish}),d=panelDimensions(.86,1.5,p);assert(Math.abs(d.width/d.nx-p.width-p.joint)<1e-12);assert(Math.abs(d.height/d.ny-p.height-p.joint)<1e-12);
 const baseline=buildTileCase(T,{finish,variant:0}),candidate=buildTileCase(T,{finish,variant:1});
 const snapshot=JSON.stringify(baseline.userData.state),u=baseline.userData.materials[0].userData.uniforms;
 candidate.userData.update({wear:1,stain:1,wetness:1});assert.equal(JSON.stringify(baseline.userData.state),snapshot);assert.equal(u.ctWet.value,0);assert.equal(u.ctVariant.value,0);
 const counts=[];candidate.traverse(o=>{if(o.isInstancedMesh){assert(o.count>0);assert.equal(o.geometry.attributes.tileCell.count,o.count);assert(o.geometry.userData.bevel>0);const z=o.geometry.boundingBox;assert(Math.abs(z.max.z-z.min.z-p.thickness)<1e-7);assert(o.geometry.attributes.position.array.every(Number.isFinite));counts.push(o.count);}});
 assert.equal(counts.length,6);assert.equal(counts.reduce((a,b)=>a+b,0),candidate.userData.receiver.tileCount);
 for(const mat of candidate.userData.materials){if(mat.isMeshPhysicalMaterial){const shader={vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader,uniforms:{}};mat.onBeforeCompile(shader);assert(!shader.fragmentShader.includes('undefined'));if(mat.userData.uniforms.ctWear){assert(shader.vertexShader.includes('attribute vec3 tileCell'));for(const tag of ['ctEvaluate(ctBase','roughnessFactor=ctRough','material.clearcoat=ctCoat','dFdx(ctHeight)'])assert(shader.fragmentShader.includes(tag));}}}
 let damaged=0;for(let seed=0;seed<8;seed++)for(let ix=0;ix<31;ix++)for(let iy=0;iy<31;iy++){
 const x=(ix/30-.5)*p.width,y=(iy/30-.5)*p.height;
 const intact=sampleChannels({finish,x,y,seed,wear:0}),half=sampleChannels({finish,x,y,seed,wear:.5}),worn=sampleChannels({finish,x,y,seed,wear:1}),wet=sampleChannels({finish,x,y,seed,wear:1,wetness:1}),base=sampleChannels({finish,x,y,seed,wear:1,wetness:1,variant:0});
 assert.equal(intact.chip,0);assert.equal(base.chip,0);assert.equal(base.wetness,0);assert(half.chip<=worn.chip+1e-12);assert(worn.glaze<=intact.glaze);assert(wet.roughness<=worn.roughness);assert.equal(worn.metalness,0);assert.equal(worn.ior,1.5);assert.equal(wet.chip,worn.chip);
 if(worn.chip>.2){damaged++;assert(worn.height<intact.height);if(p.glaze)assert(worn.clearcoat<intact.clearcoat);}
 if(!p.glaze){assert.equal(worn.glaze,0);assert.equal(worn.clearcoat,0);}
 for(const v of Object.values(wet))assert(Number.isFinite(v));
 }
 assert(damaged>20);record(`${finish}: metric packing, six physical panels, baseline isolation, valid shader injection, shared monotonic chip response, wet/dry independence`,{tileCount:candidate.userData.receiver.tileCount,damagedSamples:damaged,samples:7688});
 baseline.userData.dispose();candidate.userData.dispose();
}
const result={passed:true,checks,scope:'Node geometry and CPU causal invariants; not browser rendering or measured material accuracy',browserRun:'pending external authorized Chromium CI'};
fs.writeFileSync(new URL('./numeric-receipt.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
