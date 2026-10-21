import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MATERIAL_GLSL,adaptHostedMaterialParameters} from '../material-quality-r01/material.mjs';
import {studyAreaLightingReference as area,studyDisplayReference as display,STUDY_LIGHTS} from '../material-quality-r01/material-study-reference.mjs';
import {materialQualityOpticalContract} from '../material-quality-r01/renderer.mjs';
const renderer=await readFile(new URL('../material-quality-r01/renderer.mjs',import.meta.url),'utf8');
const base=Object.freeze({baseColor:Object.freeze([.17,.25,.27]),roughness:.40,metallic:0,clearcoat:0,clearcoatRoughness:.14});
const points=[[-.32,0,.08],[.32,0,.08],[0,.57,.08],[0,-.57,.08]],view=p=>[.18-p[0],.10-p[1],1.85-p[2]];
const lit=(p,s)=>display(area(p,s,[0,0,1],view(p)),1),difference=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
function body(name){const i=MATERIAL_GLSL.indexOf(name+'('),start=MATERIAL_GLSL.indexOf('{',i);let end=start+1,depth=1;while(depth&&end<MATERIAL_GLSL.length){if(MATERIAL_GLSL[end]==='{')depth++;if(MATERIAL_GLSL[end]==='}')depth--;end++;}assert.equal(depth,0);return MATERIAL_GLSL.slice(start,end);}
test('fixed exposure and authored emitter controls are explicitly bounded, not finish-dependent',()=>{
 const p=adaptHostedMaterialParameters();for(const k of ['studyLighting','studyExposure','studyAreaStrength','studyEnvironmentStrength'])assert.equal(p[k],1);
 for(const x of [{studyExposure:0},{studyExposure:4.1},{studyAreaStrength:2.1},{studyEnvironmentStrength:-1},{studyLighting:NaN}])assert.throws(()=>adaptHostedMaterialParameters(x));
 assert.deepEqual(adaptHostedMaterialParameters({frameMaterialMode:1}).frameColor,adaptHostedMaterialParameters({frameMaterialMode:2}).frameColor);
 assert.match(renderer,/radiance\*=uStudyLighting>\.5\?uStudyExposure:1\./);
 assert.doesNotMatch(body('materialStudyLighting'),/frameMaterialMode|doorMaterialMode|Exposure/);
 assert.equal(materialQualityOpticalContract({fieldKind:'hosted-context'},{studyExposure:1}).exposure,1);
});
test('two finite authored rectangles use only the already evaluated BRDF, not new scene queries',()=>{
 const a=body('materialStudyAreaLighting'),e=body('materialStudyEnvironmentSpecular');
 assert.match(a,/light<2/);assert.match(a,/y<3/);assert.match(a,/x<3/);assert.match(a,/directBRDF\(s,n,view,l/);
 assert.match(e,/layer<2/);assert.match(e,/i<8/);assert.match(e,/materialStudySkyInFrame/);
 for(const code of [a,e])assert.doesNotMatch(code,/sampleFieldMaterial|evaluateTimberField|TraceRay|displayDistance|fieldDistance/);
 assert.match(a,/sourceVariance/);assert.match(body('materialStudyEmitterRay'),/lightT=t/);
 assert.match(MATERIAL_GLSL,/vec3\(-\.55,\.20,1\.40\)/);assert.match(MATERIAL_GLSL,/vec3\(9\.,8\.2,7\.4\)/);assert.equal(STUDY_LIGHTS.length,2);
 const report=materialQualityOpticalContract({fieldKind:'hosted-context'});assert.match(report.areaLightApproximation,/no_per_sample_shadows/);assert.match(report.environmentSpecular,/unoccluded_no_scene_rays/);
});
test('identical geometry/color/exposure yields measurable roughness and clearcoat differences under the actual finite rig',()=>{
 let roughDifference=0,coatDifference=0;
 for(const p of points){
  const low=lit(p,{...base,roughness:.16}),high=lit(p,{...base,roughness:.75}),coat=lit(p,{...base,clearcoat:1}),noCoat=lit(p,base);
  for(const v of [low,high,coat,noCoat])assert.ok(v.every(x=>Number.isFinite(x)&&x>=0&&x<=1));
  roughDifference=Math.max(roughDifference,difference(low,high));coatDifference=Math.max(coatDifference,difference(coat,noCoat));
 }
 assert.ok(roughDifference>.06,`area-only encoded difference ${roughDifference}`);assert.ok(coatDifference>.05,`area-only encoded difference ${coatDifference}`);
 assert.deepEqual(base.baseColor,[.17,.25,.27]);assert.equal(base.roughness,.40);
});
test('finite lights create spatial form cues and switch off cleanly without material changes',()=>{
 assert.ok(difference(lit(points[0],base),lit(points[1],base))>.10);
 for(const p of points)assert.deepEqual(area(p,base,[0,0,1],view(p),0),[0,0,0]);
 assert.deepEqual(area(points[0],base,[0,0,-1],view(points[0])),[0,0,0]);
});
test('member-chart boundaries reject cross-member height gradients without changing geometry',()=>{
 const b=body('materialMicroSlope');assert.match(b,/length\(b-a\)>eps\*1\.5\)return 0/);assert.match(b,/sampleFieldMaterial\(shifted/);
 assert.doesNotMatch(b,/trace|Distance|displace/i);assert.match(renderer,/materialMicroSlope\(h,surface,materialNormal,localTangent,footprint,eps\)/);
});
