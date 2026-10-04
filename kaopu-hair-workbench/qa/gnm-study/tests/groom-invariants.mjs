/** Actual original-model numerical verification, no browser/GL substitute.
 * Run: GNM_ASSETS_DIR=../gnm-head-study/assets node tests/groom-invariants.mjs
 * No installed packages needed: use the same vendored Three.js as the app.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(specifier,context,next){if(specifier==='three')return {url:${JSON.stringify(new URL('../vendor/three.module.js',import.meta.url).href)},shortCircuit:true};return next(specifier,context);}`),import.meta.url);
const THREE=await import('three');
const {GNMHeadModel,parseContainer}=await import('../src/GNMModel.js');
const {GNMSamplers}=await import('../src/SemanticSampler.js');
const {createSourceExpression}=await import('../src/ExpressionSources.js');
const {HairLayer}=await import('../src/HairLayer.js');
const {FacialHairLayer}=await import('../src/FacialHairLayer.js');
const assets=process.env.GNM_ASSETS_DIR?path.resolve(process.env.GNM_ASSETS_DIR):new URL('../../gnm-head-study/assets/',import.meta.url);
const read=name=>{const file=typeof assets==='string'?path.join(assets,name):new URL(name,assets),b=fs.readFileSync(file);return parseContainer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const h=read('gnm_head_web.bin'),s=read('gnm_samplers_web.bin'),model=new GNMHeadModel(h.meta,h.sections),sampler=new GNMSamplers(s.meta,s.sections),positions=new Float32Array(model.numVertices*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(new THREE.BufferAttribute(model.triangles,1));
function evaluate(){model.computeVertices(positions);geometry.computeVertexNormals();return geometry.attributes.normal.array;}
let normals=evaluate();const start=performance.now(),hair=new HairLayer(model,positions,normals),face=new FacialHairLayer(model,positions,normals);const constructionMs=performance.now()-start;
const results=[],references={hairBinding:hair.binding,hairGeometry:hair.geometry,browIndices:face.regions.brows.triangleIndices,browGeometry:face.regions.brows.geometry,beardGeometry:face.regions.beard.geometry};
function inspectGuideShafts(region){
 const per=region.options.segments+1,tr=model.triangles,walker=face.walker,triangle=new THREE.Triangle(),probe=new THREE.Vector3(),closest=new THREE.Vector3(),normal=new THREE.Vector3(),offset=new THREE.Vector3();let minSignedMidpointGap=Infinity,samples=0;
 // Cover deterministic strands across both sides and all root regions. Inspect
 // shaft midpoints against the actual local adjacent triangles, not a fake head.
 for(let i=0;i<region.options.count;i+=17)for(let j=0;j<region.options.segments;j++){
  const q=i*per+j,triA=region.guideTriangles[q],triB=region.guideTriangles[q+1],candidates=new Set([triA,triB]);for(const t of [triA,triB])for(let edge=0;edge<3;edge++){const next=walker.adjacency[t*3+edge];if(next>=0)candidates.add(next);}
  probe.set((region.latestPoints[q*3]+region.latestPoints[q*3+3])/2,(region.latestPoints[q*3+1]+region.latestPoints[q*3+4])/2,(region.latestPoints[q*3+2]+region.latestPoints[q*3+5])/2);let nearest=Infinity,signed=Infinity;
  for(const t of candidates){triangle.a.fromArray(positions,tr[t*3]*3);triangle.b.fromArray(positions,tr[t*3+1]*3);triangle.c.fromArray(positions,tr[t*3+2]*3);triangle.closestPointToPoint(probe,closest);const distance=closest.distanceToSquared(probe);if(distance<nearest){nearest=distance;triangle.getNormal(normal);signed=offset.subVectors(probe,closest).dot(normal);}}
  minSignedMidpointGap=Math.min(minSignedMidpointGap,signed);samples++;
 }
 assert.ok(minSignedMidpointGap>0,region.name+' shafts must stay outside actual adjacent skin');return {samples,minSignedMidpointGap};
}
function check(label){normals=evaluate();hair.update(positions,normals);face.update(positions,normals);const hd=hair.diagnostics(),fd=face.diagnostics();for(const d of [hd,fd.brows,fd.beard]){assert.ok(d.finite,label+' finite buffers');assert.equal(d.invalidTriangles,0);assert.ok(d.minWeight>=-1e-7&&d.maxWeight<=1.0000001&&d.maxSumError<1e-6);assert.ok(d.minScalpNormalLength>.2);assert.ok(d.maxRootSurfaceDistance<(d.region?.000131:.000351));}assert.equal(fd.brows.invalidTemplateRoots,0);assert.equal(fd.beard.invalidTemplateRoots,0);for(const d of [fd.brows,fd.beard]){assert.equal(d.invalidGuideTriangles,0);assert.equal(d.invalidTemplateGuidePoints,0);assert.ok(d.minSignedSurfaceOffset>0.00005,label+' all guide supports above actual deformed skin');}assert.ok(fd.brows.minTemplateGuideEyeGap>.005);assert.ok(fd.beard.minTemplateGuideLipGap>.0035);assert.ok(fd.brows.minTemplateEyeGap>.005);assert.ok(fd.beard.minTemplateLipGap>.003);assert.ok(fd.beard.moustacheCount>100&&fd.beard.chinCount>100);const shaftChecks={brows:inspectGuideShafts(face.regions.brows),beard:inspectGuideShafts(face.regions.beard)};results.push({label,hair:hd,brows:fd.brows,beard:fd.beard,shaftChecks});return {hair:hd.rootHash,brows:fd.brows.rootHash,beard:fd.beard.rootHash};}
const neutral=check('neutral');
model.setExpressionVector(createSourceExpression('maya-semantic','smile_wide'));const smile=check('smile');assert.notEqual(smile.beard,neutral.beard);assert.notEqual(smile.brows,neutral.brows);
model.setExpressionVector(createSourceExpression('maya-semantic','surprise'));const surprise=check('surprise');assert.notEqual(surprise.brows,neutral.brows);assert.notEqual(surprise.beard,neutral.beard);
model.resetExpression();sampler.seed(42);model.setIdentityVector(sampler.sampleIdentity([0,1],[0,1,0,0],.8));const identity=check('identity');for(const key of ['hair','brows','beard'])assert.notEqual(identity[key],neutral[key]);
model.setExpressionVector(createSourceExpression('maya-semantic','smile_wide'));model.setJointRotation(0,.07,.03,-.025);model.setJointRotation(1,-.08,.3,.06);model.setTranslation(.02,-.01,.005);check('identity-smile-head-neck-pose');
model.resetIdentity();model.resetExpression();model.resetPose();assert.deepEqual(check('neutral-reset'),neutral);
// Density must update draw ranges without replacing buffers, roots, or binding.
hair.setAppearance({density:.2});face.setAppearance({brows:{density:.2},beard:{density:.2,visible:true}});
assert.equal(hair.binding,references.hairBinding);assert.equal(hair.geometry,references.hairGeometry);assert.equal(face.regions.brows.triangleIndices,references.browIndices);assert.equal(face.regions.brows.geometry,references.browGeometry);assert.equal(face.regions.beard.geometry,references.beardGeometry);assert.equal(hair.activeCount,3600);assert.equal(face.regions.brows.activeCount,320);assert.equal(face.regions.beard.activeCount,720);assert.deepEqual(check('low-density-stable-roots'),neutral);
// Length changes actual endpoints, with exact root preservation for all regions.
const tips={hair:hair.latestPoints.slice(),brows:face.regions.brows.latestPoints.slice(),beard:face.regions.beard.latestPoints.slice()};
hair.setAppearance({length:.032});face.setAppearance('brows',{length:.002});face.setAppearance('beard',{length:.001});assert.deepEqual(check('short-length-stable-roots'),neutral);
for(const [name,region]of [['hair',hair],['brows',face.regions.brows],['beard',face.regions.beard]]){const per=region.options.segments+1;assert.deepEqual(region.latestPoints.slice(0,3),tips[name].slice(0,3));assert.ok(region.latestPoints.slice((per-1)*3,per*3).some((v,i)=>Math.abs(v-tips[name][(per-1)*3+i])>.0001),name+' endpoint changes');}
// Colors and independent visibility do not leak to the other region.
face.setAppearance('brows',{color:'#78695b',visible:false});assert.equal(face.regions.beard.options.color,'#21170f');assert.equal(face.regions.beard.mesh.visible,true);assert.equal(face.regions.brows.mesh.visible,false);
for(const value of [{warmPower:3.2,coolPower:0,ambient:.35},{warmPower:0,coolPower:3,ambient:.35},{warmPower:0,coolPower:0,ambient:.35},{warmPower:3.2,coolPower:3,ambient:.35}]){hair.setLighting(value);face.setLighting(value);for(const material of [hair.material,face.regions.brows.material,face.regions.beard.material]){assert.equal(material.uniforms.warmPower.value,value.warmPower);assert.equal(material.uniforms.coolPower.value,value.coolPower);assert.equal(material.uniforms.ambientPower.value,value.ambient);}}
hair.setViewport({fov:35,zoom:1},800);const standardPixelFactor=hair.material.uniforms.pixelFactor.value;hair.setViewport({fov:35,zoom:6},800);face.setViewport({fov:35,zoom:6},800);assert.equal(hair.material.uniforms.pixelFactor.value,standardPixelFactor/6);assert.equal(face.regions.brows.material.uniforms.pixelFactor.value,standardPixelFactor/6);
// Full maximum ranges also remain finite and preserve the bound roots.
hair.setAppearance({density:1,length:.13});face.setAppearance({brows:{density:1,length:.012},beard:{density:1,length:.008}});assert.deepEqual(check('max-density-and-length'),neutral);
const report={passed:true,kind:'actual-original-GNM-triangle-and-barycentric-numerical-tests-not-GPU-rendering',modelVertices:model.numVertices,modelTriangles:model.triangles.length/3,constructionMs,densityDoesNotRebuild:true,lengthChangesEndpointsKeepsRoots:true,independentColorsAndVisibility:true,sharedWarmCoolUniforms:true,zoomPixelFactorCorrect:true,results};
fs.writeFileSync(new URL('r5-groom-numerical.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,constructionMs,cases:results.map(r=>({label:r.label,hairActive:r.hair.activeCount,browsActive:r.brows.activeCount,beardActive:r.beard.activeCount,hairRootGap:r.hair.maxRootSurfaceDistance,browsRootGap:r.brows.maxRootSurfaceDistance,beardRootGap:r.beard.maxRootSurfaceDistance})),browsEyeGap:results[0].brows.minTemplateEyeGap,beardLipGap:results[0].beard.minTemplateLipGap,moustacheCount:results[0].beard.moustacheCount,chinCount:results[0].beard.chinCount},null,2));hair.dispose();face.dispose();geometry.dispose();
