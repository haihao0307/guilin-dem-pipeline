/** r6 scalp tests use the actual unchanged GNM data, not synthetic head bounds. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(specifier,context,next){if(specifier==='three')return {url:${JSON.stringify(new URL('../vendor/three.module.js',import.meta.url).href)},shortCircuit:true};return next(specifier,context);}`),import.meta.url);
const THREE=await import('three');
const {GNMHeadModel,parseContainer}=await import('../src/GNMModel.js');
const {GNMSamplers}=await import('../src/SemanticSampler.js');
const {createSourceExpression}=await import('../src/ExpressionSources.js');
const {HairLayer,SCALP_STYLES,createStrandMaterial}=await import('../src/HairLayer.js');
const assets=process.env.GNM_ASSETS_DIR?path.resolve(process.env.GNM_ASSETS_DIR):new URL('../../gnm-head-study/assets/',import.meta.url);
const read=name=>{const file=typeof assets==='string'?path.join(assets,name):new URL(name,assets),b=fs.readFileSync(file);return parseContainer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const h=read('gnm_head_web.bin'),s=read('gnm_samplers_web.bin'),model=new GNMHeadModel(h.meta,h.sections),sampler=new GNMSamplers(s.meta,s.sections),positions=new Float32Array(model.numVertices*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(new THREE.BufferAttribute(model.triangles,1));
function evaluate(){model.computeVertices(positions);geometry.computeVertexNormals();return geometry.attributes.normal.array;}
let normals=evaluate();const started=performance.now(),hair=new HairLayer(model,positions,normals),constructionMs=performance.now()-started;
const initial=hair.diagnostics(),references={binding:hair.binding,geometry:hair.geometry,positions:hair.p,index:hair.fullIndex,roots:hair.binding.rootTriangles,rootBarycentrics:hair.binding.rootBarycentrics,supports:hair.supportTriangles};
const results=[],styleTips=new Map(),styleLengths={},styleDifferences={},controlChecks={};
function selected(){return new Set(hair.activeRoots.subarray(0,hair.activeCount));}
function stable(){assert.equal(hair.binding,references.binding);assert.equal(hair.geometry,references.geometry);assert.equal(hair.p,references.positions);assert.equal(hair.fullIndex,references.index);assert.equal(hair.binding.rootTriangles,references.roots);assert.equal(hair.binding.rootBarycentrics,references.rootBarycentrics);assert.equal(hair.supportTriangles,references.supports);}
function inspect(label){
 normals=evaluate();hair.update(positions,normals);const d=hair.diagnostics();assert.ok(d.finite,label+' finite');assert.equal(d.invalidTriangles,0);assert.ok(d.minWeight>=-1e-7&&d.maxWeight<=1.0000001&&d.maxSumError<1e-6);assert.ok(d.maxRootSurfaceDistance<.000351);assert.ok(d.minScalpNormalLength>.999);stable();
 let minTemplateMargin=Infinity,minSignedOffset=Infinity,minEyeGap=Infinity,maxWeightError=0,arcLength=0;const per=hair.options.segments+1,landmarks=new Float32Array(model.landmarkIndices.length);model.computeLandmarks(model.template,landmarks);
 for(let i=0;i<hair.options.count;i+=7)for(let j=0;j<per;j++){
  const q=i*per+j,t=hair.supportTriangles[q],b=hair.supportBarycentrics.subarray(q*3,q*3+3),p=hair.binding.point(t,b),deformed=hair.binding.point(t,b,positions);assert.ok(Array.from(b).every(v=>v>=0&&v<=1.0000001));maxWeightError=Math.max(maxWeightError,Math.abs(b[0]+b[1]+b[2]-1));for(let k=0;k<3;k++)assert.equal(model.componentId[model.triangles[t*3+k]],0);minTemplateMargin=Math.min(minTemplateMargin,hair.binding.safetyMargin(p));
  let signed=0;for(let k=0;k<3;k++)signed+=(hair.latestPoints[q*3+k]-deformed[k])*hair.n[q*6+k];minSignedOffset=Math.min(minSignedOffset,signed);
  for(let eye=36;eye<=47;eye++)minEyeGap=Math.min(minEyeGap,Math.hypot(p[0]-landmarks[eye*3],p[1]-landmarks[eye*3+1],p[2]-landmarks[eye*3+2]));
  if(j)arcLength+=Math.hypot(...[0,1,2].map(k=>hair.latestPoints[q*3+k]-hair.latestPoints[(q-1)*3+k]));
 }
 assert.ok(maxWeightError<1e-6);assert.ok(minTemplateMargin>-.0001,label+' no ear/face support intrusion');assert.ok(minSignedOffset>.00034,label+' attached positive surface offset');assert.ok(minEyeGap>.015,label+' eyes clear');
 results.push({label,style:d.style,rootHash:d.rootHash,activeCount:d.activeCount,maxLift:d.maxLift,guideBuilds:d.guideBuilds,minTemplateMargin,minSignedOffset,minEyeGap,maxWeightError,meanArcLength:arcLength/Math.ceil(hair.options.count/7),updateMs:d.lastUpdateMs});return d;
}
const neutral=inspect('neutral');assert.ok(neutral.maxLift<.0037,'default stays close to scalp');
for(const style of SCALP_STYLES){hair.setAppearance({style});const d=inspect(style);assert.equal(d.rootHash,neutral.rootHash);styleTips.set(style,hair.latestPoints.slice());styleLengths[style]=results.at(-1).meanArcLength;}
assert.ok(styleLengths['short-crop']<styleLengths['side-sweep']*.6,'crop substantially shorter with same user length');
for(const [a,b]of [['side-sweep','swept-back'],['side-sweep','short-crop'],['swept-back','short-crop']]){let delta=0;const ap=styleTips.get(a),bp=styleTips.get(b),per=hair.options.segments+1;for(let i=0;i<hair.options.count;i++){const q=(i*per+per-1)*3;delta+=Math.hypot(ap[q]-bp[q],ap[q+1]-bp[q+1],ap[q+2]-bp[q+2]);}styleDifferences[a+'/'+b]=delta/hair.options.count;assert.ok(delta/hair.options.count>.004,a+' vs '+b+' distinct endpoints');}
assert.equal(hair.binding.guideBuilds,3);for(const style of [...SCALP_STYLES,...SCALP_STYLES])hair.setAppearance({style});assert.equal(hair.binding.guideBuilds,3,'cached styles never rebind');
for(const [source,expression]of [['maya-semantic','smile_wide'],['maya-semantic','surprise'],['max-pca','A']]){model.setExpressionVector(createSourceExpression(source,expression));for(const style of SCALP_STYLES){hair.setAppearance({style});inspect(expression+'/'+style);}}
model.resetExpression();sampler.seed(42);model.setIdentityVector(sampler.sampleIdentity([0,1],[0,1,0,0],.8));for(const style of SCALP_STYLES){hair.setAppearance({style});const d=inspect('identity/'+style);assert.notEqual(d.rootHash,neutral.rootHash);}
model.setExpressionVector(createSourceExpression('maya-semantic','smile_wide'));model.setJointRotation(0,.07,.03,-.025);model.setJointRotation(1,-.08,.3,.06);model.setTranslation(.02,-.01,.005);inspect('identity-expression-pose');model.resetIdentity();model.resetExpression();model.resetPose();hair.setAppearance({style:'side-sweep'});assert.equal(inspect('neutral-reset').rootHash,neutral.rootHash);
const baseline=selected();for(const key of ['frontCoverage','backCoverage','sideCoverage']){hair.setAppearance({[key]:0});const reduced=selected();assert.ok(reduced.size<baseline.size*.95,key+' has visible effect');for(const i of reduced)assert.ok(baseline.has(i),key+' only removes weighted roots');assert.equal(hair.diagnostics().rootHash,neutral.rootHash);controlChecks[key]={defaultCount:baseline.size,reducedCount:reduced.size,selectionMs:hair.lastSelectionMs};hair.setAppearance({[key]:1});assert.deepEqual(selected(),baseline);}
hair.setAppearance({hairlineHeight:-1});const lowLine=selected();hair.setAppearance({hairlineHeight:1});const highLine=selected();assert.ok(highLine.size<lowLine.size);for(const i of highLine)assert.ok(lowLine.has(i));hair.setAppearance({hairlineHeight:0});assert.deepEqual(selected(),baseline);
hair.setAppearance({density:.2});const sparse=selected();assert.ok(sparse.size<baseline.size*.3);for(const i of sparse)assert.ok(baseline.has(i));hair.setAppearance({density:.9});assert.deepEqual(selected(),baseline);
const unchangedPositions=hair.p.slice(),supportTime=hair.lastSupportMs,updateTime=hair.lastUpdateMs;hair.setAppearance({width:2,color:'#112233',roughness:.7});assert.equal(hair.material.uniforms.radius.value,.00056);assert.deepEqual(hair.p,unchangedPositions);assert.equal(hair.lastSupportMs,supportTime);assert.equal(hair.lastUpdateMs,updateTime);hair.setAppearance({width:.5});assert.equal(hair.material.uniforms.radius.value,.00014);
hair.setAppearance({length:.012,volume:0,frizz:0});inspect('minimum-length-volume-frizz');assert.equal(hair.diagnostics().rootHash,neutral.rootHash);hair.setAppearance({length:.13,volume:.026,frizz:.0014,width:2,density:1});inspect('maximum-length-volume-frizz');assert.equal(hair.diagnostics().rootHash,neutral.rootHash);
hair.setAppearance({guides:true});assert.equal(hair.geometry.drawRange.count,hair.drawnCount*hair.options.segments*6);assert.ok(hair.drawnCount<hair.activeCount/10);hair.setAppearance({guides:false});assert.equal(hair.geometry.drawRange.count,hair.activeCount*hair.options.segments*6);
const faceMaterial=createStrandMaterial({radius:.00015,specular:.025});assert.equal(faceMaterial.uniforms.surfaceSpecular.value,.025);faceMaterial.dispose();
console.log(JSON.stringify({passed:true,kind:'actual-original-GNM-r6-scalp-style-numerical-tests',constructionMs,initialActiveCount:initial.activeCount,styleLengths,styleDifferences,controlChecks,stylesCached:hair.binding.guideBuilds,stableRootUnion:true,monotoneRegionalCoverage:true,widthOnlyChangesRadius:true,controlsKeepBufferIdentity:true,results},null,2));hair.dispose();geometry.dispose();
