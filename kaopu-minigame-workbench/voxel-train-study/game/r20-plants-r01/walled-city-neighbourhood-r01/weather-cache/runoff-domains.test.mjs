import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {makeBuildingRecipe} from '../building-plan.mjs';
import {makeSurfacePlan} from '../surface-plan.mjs';
import {createNativePlaster} from '../plaster-native/plaster-native.mjs';
import {bindPlasterWater} from '../surface-bindings.mjs';
import {WATER_CHEAP_GLSL} from './glsl.mjs';
import {packInstancePatches,samplePackedPatch,makeGridLayout} from './cache.mjs';
import {makeWallRunoffPlan,deriveWallRunoffSources,adaptSurfacePlanRunoff,planRunoffCacheTemplates,createRunoffWeatherCacheSet,runoffEnvelopeAtReceiver,runoffGroundFactorAtReceiver,combineRunoffMask,patchRunoffReceiverFragment,bindRunoffReceiver,runoffReceiverGLSL} from './runoff-domains.mjs';
const THREE=await import(process.env.PLASTER_THREE_FILE?pathToFileURL(process.env.PLASTER_THREE_FILE):new URL('../../../../vendor/three.module.js',import.meta.url));
const recipe=makeBuildingRecipe(),base=makeSurfacePlan(recipe),adapted=adaptSurfacePlanRunoff(recipe,base);
const parent={id:'fixture',parentOriginMetres:[1,13.7,0],parentBasis:[[1,0,0],[0,1,0],[0,0,1]],fullDimensionsMetres:[2,27.4,.32],fieldScaleMetres:1.25,waterSeed:1234,weatherSeed:1235,parentNormal:[0,0,1]};
function fixture(bottom=5.5){const wall={id:'fixture-wall',alongX:true,start:0,end:2,fixed:0,bottom,height:2.6,side:'front',openings:[{id:'window',kind:'window',center:1,width:.8,bottom:1.1,height:.9}]};const r={walls:[wall],wood:[{id:'window-sill',position:[1,bottom+1.12,0],size:[.8,.1,.27]}],floors:[],metal:[]};return {wall,recipe:r,plan:makeWallRunoffPlan(r,wall,parent)};}

test('R02 sources resolve to real sills/exposed slabs, never ordinary capped wall tops or alleged pipe leakage',()=>{
  assert.equal(adapted.walls.length,120);assert.equal(adapted.runoffProof.sourceCount,65);
  const ids=new Set([...recipe.wood,...recipe.floors].map(o=>o.id));
  for(const spec of adapted.walls)for(const source of spec.runoff.sources){assert(source.evidenceIds.every(id=>ids.has(id)));assert(source.fallLength<=1.35);assert(!source.id.includes('riser'));}
  assert.equal(adapted.walls.find(w=>w.wallId==='W2-back').runoff.sources.length,0);
  assert.deepEqual(adapted.walls.find(w=>w.wallId==='S2-back').runoff.sources.map(s=>s.id),['S2-vent-sill']);
  const ground=fixture(),r=ground.recipe;r.floors=[{id:'capped-floor',x0:0,x1:2,z0:-2,z1:0,y:8.25,thickness:.1}];r.walls.push({...ground.wall,id:'upper',bottom:8.25});
  assert(!deriveWallRunoffSources(r,ground.wall).sources.some(s=>s.id==='capped-floor'));
});
test('sill origin is the actual lower exterior solid edge; no invented source without its object',()=>{
  const {wall,recipe:r,plan}=fixture(),s=plan.sources[0];assert.deepEqual(s.originMetres,[1,6.57,.135]);assert.equal(s.fallLength,.9);
  r.wood=[];assert.equal(deriveWallRunoffSources(r,wall).sources.length,0);
  r.runoffOutlets=[{id:'leak',wallId:wall.id,objectId:'unknown',position:[1,7,.1]}];assert.throws(()=>deriveWallRunoffSources(r,wall));
});
test('finite gravity envelope is zero above, beyond length, beyond source width, and on interior',()=>{
  const {plan}=fixture(),s=plan.sources[0],Y=s.y;
  assert(runoffEnvelopeAtReceiver(plan,[1,Y-.2,.07])>0);
  for(const point of [[1,Y+.01,.07],[1,Y,.07],[1,Y-s.fallLength,.07],[1,Y-s.fallLength-.5,.07],[0,Y-.2,.07],[1,Y-.2,-.07]])assert.equal(runoffEnvelopeAtReceiver(plan,point),0,JSON.stringify(point));
  const near=runoffEnvelopeAtReceiver(plan,[1,Y-s.fallLength+1e-5,.07]);assert(near<1e-9);
  assert(runoffEnvelopeAtReceiver(plan,[1,Y-.6,.07])<runoffEnvelopeAtReceiver(plan,[1,Y-.15,.07]));
});
test('domain keeps source isotropic metres and never inherits full tower height',()=>{
  for(const spec of adapted.walls){const p=spec.runoff;assert.equal(p.domain.fullDimensionsMetres[1],2.6);assert.equal(p.domain.fieldScaleMetres,1.25);assert(p.domain.fullDimensionsMetres[1]<4);}
  assert.equal(fixture(5.5).plan.domain.fullDimensionsMetres[1],fixture(50).plan.domain.fullDimensionsMetres[1]);
  assert.throws(()=>makeWallRunoffPlan(fixture().recipe,{...fixture().wall,height:27},parent));
});
test('upper walls cannot acquire repeated lowerDamp at every storey; true ground uses original height gate only outside',()=>{
  const upper=fixture().plan,ground=fixture(.04).plan;
  for(let y=5.5;y<8.1;y+=.1){assert.equal(runoffGroundFactorAtReceiver(upper,[1,y,.07]),0);assert.equal(combineRunoffMask(upper,[1,y,.07],0,1),0);}
  assert(runoffGroundFactorAtReceiver(ground,[1,.10,.07])>.5);
  assert.equal(runoffGroundFactorAtReceiver(ground,[1,1.1,.07]),0);
  assert.equal(runoffGroundFactorAtReceiver(ground,[1,.10,-.07]),0);
  assert.throws(()=>combineRunoffMask(ground,[1,.1,.07],2,0));
});
test('shared templates bound GPU bakes and persistent bytes rather than baking all 120 walls',()=>{
  const p=planRunoffCacheTemplates(adapted);assert.equal(p.metrics.gpuBakes,18);assert.equal(p.metrics.gpuSampleNodes,21280);assert.equal(p.metrics.sharedRetainedLowStateBytes,155648);
  let calls=0;const sampler={sampleLow(domain,positions){calls++;const values=new Float32Array(positions.length/3*2);for(let i=0;i<values.length/2;i++){values[i*2]=.4+positions[i*3]*.01+positions[i*3+1]*.01;values[i*2+1]=.3;}return {values,metrics:{testMock:true}};}};
  const result=createRunoffWeatherCacheSet({sampler,surfacePlan:adapted});assert.equal(calls,18);assert.equal(result.caches.size,120);
  for(const group of p.entries){const caches=group.plans.map(plan=>result.caches.get(plan.id));for(const cache of caches){assert.equal(cache.broad,caches[0].broad);assert.equal(cache.lowerFactor,caches[0].lowerFactor);}}
  const group=p.entries.find(g=>g.active&&g.plans.length>1),a=result.caches.get(group.plans[0].id),b=result.caches.get(group.plans[1].id);
  const at=cache=>cache.domain.parentOriginMetres.map((v,i)=>v+[.1,.1,.02][i]);assert.deepEqual(a.sampleWorld(at(a)),b.sampleWorld(at(b)));
  const point=[.1,.1,.02],bounds={min:point.map(x=>x-.01),max:point.map(x=>x+.01)},payload=packInstancePatches(a,[bounds,bounds]);
  assert.deepEqual(samplePackedPatch(a,payload,0,point),samplePackedPatch(a,payload,1,point));
});
test('bridge retains exact original V26 cheap function and adds no stochastic kernel or vertex attributes',()=>{
  const shader='float w26WaterAtReceiverWithLow(vec3 receiverMetres,vec2 cachedLow){vec3 parent=receiverMetres;return waterMaskFromCached(parent/w26FieldScaleMetres,w26ParentNormal,parent,w26FullDimensionsMetres,w26WaterSeed,cachedLow);}\n'+WATER_CHEAP_GLSL;
  const patched=patchRunoffReceiverFragment(shader);assert(patched.includes(WATER_CHEAP_GLSL));assert(patched.includes('vec2(cachedLow.x,0.)'));assert(patched.includes('nativeRunoffGroundDamp*outside'));
  assert(!/noise|hash\d|random|attribute|texture/i.test(runoffReceiverGLSL()));
  assert.throws(()=>patchRunoffReceiverFragment('wrong receiver'));
  assert.throws(()=>patchRunoffReceiverFragment(patched));
});
test('interior plaster receives an explicit zero-source/zero-ground binding; repeated shared material binding is safe',()=>{
  const {wall,plan}=fixture(.04),state={strength:.82,wetSRGB:[.012,.027,.039],wetBlend:.48,roughnessDriver:.16,roughnessRange:[.78,.96]};
  const cache={domain:plan.domain,axes:makeGridLayout(plan.domain).axes,sampleWorld(){return [.4,.3];}};
  for(const face of [-1,1]){const made=createNativePlaster({THREE,parentWall:wall,faces:[face],regions:[{u0:0,u1:2,y0:wall.bottom,y1:wall.bottom+wall.height}]}),water=bindPlasterWater({THREE,made,cache,state}),original=made.material.fragmentShader;
    const bound=bindRunoffReceiver({THREE,material:made.material,plan});
    assert.equal(made.material.uniforms.nativeRunoffCount.value,face<0?0:1);assert.equal(made.material.uniforms.nativeRunoffGroundDamp.value,face<0?0:1);
    assert.equal(bound.proof.explicitInteriorCoatDisabled,face<0);assert.equal(bindRunoffReceiver({THREE,material:made.material,plan}),bound);
    bound.dispose();bound.dispose();assert.equal(made.material.fragmentShader,original);assert(!made.material.uniforms.nativeRunoffCount);water.dispose();made.dispose();
  }
});
test('frozen original water source bytes still match the source handoff lock',()=>{
  const path=new URL('../weather-audit/original-water-weather.mjs',import.meta.url),sha=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  console.log('Unmodified water module SHA256:',sha);assert.equal(sha,'3d8308fb51ba8f77ad54bd2b6039a84dde9a1c3dbd452bb05228273d6a4dd028');
});
