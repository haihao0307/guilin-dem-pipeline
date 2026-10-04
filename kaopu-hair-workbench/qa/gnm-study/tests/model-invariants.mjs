import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {GNMHeadModel,parseContainer} from '../src/GNMModel.js';
import {GNMSamplers} from '../src/SemanticSampler.js';
const root=new URL('../',import.meta.url),checks=[];
function load(name,expected){const b=fs.readFileSync(new URL('assets/'+name,root));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),expected);return parseContainer(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const h=load('gnm_head_web.bin','fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961'),s=load('gnm_samplers_web.bin','827fc7850022cbc62d4401c6f6782b876c4dfa48f2a6f446d9644b0ba2b8122b');
const model=new GNMHeadModel(h.meta,h.sections),samplers=new GNMSamplers(s.meta,s.sections),out=new Float32Array(model.numVertices*3);
assert.deepEqual([model.numVertices,model.triangles.length/3,model.identityDim,model.expressionDim,model.numJoints],[17821,35324,253,383,4]);
function evaluate(label){model.computeVertices(out);assert.ok(out.every(Number.isFinite));checks.push({label,sha256:crypto.createHash('sha256').update(out).digest('hex')});return out.slice();}
const neutral=evaluate('neutral');
samplers.seed(42);model.setIdentityVector(samplers.sampleIdentity([0,1],[0,1,0,0],.8));const identity=evaluate('identity');assert.ok(identity.some((v,i)=>Math.abs(v-neutral[i])>1e-3));
model.resetIdentity();samplers.seed(42);model.setExpressionVector(samplers.sampleExpression(0,0));const expression=evaluate('surprise');assert.ok(expression.some((v,i)=>Math.abs(v-neutral[i])>1e-3));
model.resetExpression();model.setJointRotation(1,0,.25,0);const posed=evaluate('pose');assert.ok(posed.some((v,i)=>Math.abs(v-neutral[i])>1e-3));
model.resetPose();assert.deepEqual(evaluate('neutral-reset'),neutral);
for(let i=0;i<20;i++){samplers.seed(42);model.setExpressionVector(samplers.sampleExpression(i,0));evaluate('semantic-'+samplers.expressionClasses[i]);}
model.resetExpression();for(const [kind,index] of [['identity',252],['expression',382]]){kind==='identity'?model.setIdentityParam(index,1):model.setExpressionParam(index,1);assert.ok(evaluate(kind+'-last-component').some((v,i)=>v!==neutral[i]));model.resetIdentity();model.resetExpression();}
assert.equal(checks[0].sha256,checks[4].sha256);
console.log(JSON.stringify({passed:true,model:h.meta.model,dimensions:[253,383],checks},null,2));
