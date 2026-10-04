import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {listExpressionSources,listExpressionPresets,createSourceExpression,createExpressionState} from '../src/ExpressionSources.js';
import {GNMHeadModel,parseContainer} from '../src/GNMModel.js';
import {GNMSamplers} from '../src/SemanticSampler.js';
const root=new URL('../',import.meta.url);
const extracted=JSON.parse(fs.readFileSync(new URL('tests/fixtures/expression-source-recipe.json',root)));
const reports=[];
function load(name,expected){const b=fs.readFileSync(process.env.GNM_ASSETS_DIR?path.join(process.env.GNM_ASSETS_DIR,name):new URL('../assets/'+name,import.meta.url));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),expected);return parseContainer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const h=load('gnm_head_web.bin','fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961');
const s=load('gnm_samplers_web.bin','827fc7850022cbc62d4401c6f6782b876c4dfa48f2a6f446d9644b0ba2b8122b');
const model=new GNMHeadModel(h.meta,h.sections),sampler=new GNMSamplers(s.meta,s.sections);
const evalMesh=()=>{const out=new Float32Array(model.numVertices*3);model.computeVertices(out);assert.ok(out.every(Number.isFinite));return out;};
const neutral=evalMesh();

test('catalog retains separate source identities and separate true neutral',()=>{
 assert.equal(listExpressionSources().length,2);
 assert.equal(listExpressionPresets('maya-semantic').length,21);
 assert.equal(listExpressionPresets('max-pca').length,10);
 for(const src of listExpressionSources())assert.deepEqual(createSourceExpression(src.id,'neutral'),new Float32Array(383));
 assert.ok(createSourceExpression('max-pca','X').some(x=>x!==0));
});
test('Maya class vectors reproduce fixed NumPy latents through official 64+20 decoder',()=>{
 assert.deepEqual(sampler.expressionClasses,extracted.classes);
 assert.equal(sampler.expressionMeta.latentDim,64);assert.equal(sampler.expressionMeta.conditionDim,20);
 for(const [i,label] of extracted.classes.entries()){const input=new Float32Array(84);input.set(extracted.mayaLatents[label]);input[64+i]=1;assert.deepEqual(createSourceExpression('maya-semantic',label),sampler.expressionDecoder.forward(input));}
});
test('Max source fallback coefficients are unchanged, zero outside lower face',()=>{
 for(const [code,lower] of Object.entries(extracted.maxFallback)){const v=createSourceExpression('max-pca',code);assert.deepEqual(v.slice(200,350),Float32Array.from(lower));assert.ok(v.slice(0,200).every(x=>x===0));assert.ok(v.slice(350).every(x=>x===0));}
});
test('all 29 presets deform actual full GNM mesh, remain finite, restore neutral exactly',()=>{
 for(const src of listExpressionSources())for(const preset of listExpressionPresets(src.id).filter(x=>x.id!=='neutral')){
  const vec=createSourceExpression(src.id,preset.id);assert.equal(vec.length,383);model.setExpressionVector(vec);const mesh=evalMesh();let maxDelta=0,changed=0;
  for(let i=0;i<mesh.length;i+=3){const delta=Math.hypot(mesh[i]-neutral[i],mesh[i+1]-neutral[i+1],mesh[i+2]-neutral[i+2]);maxDelta=Math.max(maxDelta,delta);if(delta>1e-7)changed++;}
  assert.ok(maxDelta>1e-6,preset.id+' has no actual mesh effect');
  reports.push({source:src.id,preset:preset.id,changedVertices:changed,maxDisplacement:maxDelta,finite:true});
  model.setExpressionVector(createSourceExpression(src.id,'neutral'));assert.deepEqual(evalMesh(),neutral);
 }
 fs.writeFileSync(new URL('tests/source-expression-mesh.json',root),JSON.stringify({passed:true,vertices:model.numVertices,expressionDim:383,allExactResets:true,visualAcceptance:false,presets:reports},null,2)+'\n');
});
test('immutable state bridge preserves identity and pose and rejects invalid states atomically',()=>{
 const current={format:'kaopu-gnm-face',version:1,params:{identity:Array(253).fill(.2),expression:Array(383).fill(.1),rotations:Array(12).fill(.02),translation:[.01,.02,.03]},view:{hair:true}};
 const old=JSON.stringify(current),next=createExpressionState(current,'max-pca','A');assert.equal(JSON.stringify(current),old);
 assert.notEqual(next,current);assert.deepEqual(next.params.identity,current.params.identity);assert.deepEqual(next.params.rotations,current.params.rotations);assert.deepEqual(next.params.translation,current.params.translation);assert.deepEqual(next.view,current.view);
 assert.throws(()=>createExpressionState({...current,params:{...current.params,translation:[0,NaN,0]}},'max-pca','A'));
 assert.throws(()=>createExpressionState({...current,params:{...current.params,identity:[0]}},'max-pca','A'));
 assert.equal(JSON.stringify(current),old);
});
test('pure vectors, strength, source switching, prototype keys, and malformed input are safe',()=>{
 const a=createSourceExpression('max-pca','A');a[200]=999;assert.notEqual(createSourceExpression('max-pca','A')[200],999);
 assert.deepEqual(createSourceExpression('maya-semantic','happy',{strength:0}),new Float32Array(383));
 for(const strength of [NaN,Infinity,-1,1.51,'1'])assert.throws(()=>createSourceExpression('max-pca','A',{strength}));
 for(const id of ['missing','__proto__','constructor']){assert.throws(()=>createSourceExpression(id,'A'));assert.throws(()=>createSourceExpression('max-pca',id));}
 assert.deepEqual(createSourceExpression('maya-semantic','happy'),createSourceExpression('maya-semantic','happy'));
 createSourceExpression('max-pca','H');assert.deepEqual(createSourceExpression('maya-semantic','neutral'),new Float32Array(383));
});
test('all source expressions at maximum strength preserve changed identity and pose on clear',()=>{
 sampler.seed(73);model.setIdentityVector(sampler.sampleIdentity([0,1],[0,1,0,0],.7));
 model.setJointRotation(0,.06,-.03,.02);model.setJointRotation(1,-.04,.2,.05);
 model.setTranslation(.01,-.02,.03);model.resetExpression();
 const baseline=evalMesh(),id=model.identity.slice(),rot=model.rotations.slice(),trans=model.translation.slice();
 for(const src of listExpressionSources())for(const preset of listExpressionPresets(src.id).filter(x=>x.id!=='neutral')){
  model.setExpressionVector(createSourceExpression(src.id,preset.id,{strength:1.5}));evalMesh();
  assert.deepEqual(model.identity,id);assert.deepEqual(model.rotations,rot);assert.deepEqual(model.translation,trans);
  model.setExpressionVector(createSourceExpression(src.id,'neutral'));assert.deepEqual(evalMesh(),baseline);
 }
 model.resetIdentity();model.resetExpression();model.resetPose();assert.deepEqual(evalMesh(),neutral);
});
