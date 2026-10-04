// Unit-level host function test with DOM/render side effects stubbed. Not a
// browser or visual acceptance. Real GNM model and source vectors are used.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {GNMHeadModel,parseContainer} from '../src/GNMModel.js';
import {listExpressionSources,listExpressionPresets,createSourceExpression} from '../src/ExpressionSources.js';
const root=new URL('../',import.meta.url);
const app=fs.readFileSync(new URL('src/app.js',root),'utf8');
const raw=fs.readFileSync(process.env.GNM_ASSETS_DIR?path.join(process.env.GNM_ASSETS_DIR,'gnm_head_web.bin'):new URL('assets/gnm_head_web.bin',root));
const parsed=parseContainer(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const model=new GNMHeadModel(parsed.meta,parsed.sections);
const c=vm.createContext({model,listExpressionSources,listExpressionPresets,createSourceExpression,Float32Array,JSON,Number,Array,Error});
const functionBlock=(start,end)=>app.slice(app.indexOf('function '+start+'('),app.indexOf('function '+end+'('));
vm.runInContext(`let ready=true,selectedExpressionSource='maya-semantic',sourceExpressionSelection=null,sourceExpressionStrength=1,expressionTarget=null,identityTarget=null;
let state={components:[true,true,true,true,true,true],hair:true,expressionStrength:1};
let evaluated=0,built=0,stopped=0,label='';
function stopAnimation(){stopped++;}function buildControls(){built++;}function changed(s){label=s;}
function evaluate(){evaluated++;const o=new Float32Array(model.numVertices*3);model.computeVertices(o);if(!o.every(Number.isFinite))throw Error('Nonfinite mesh');}
function diagnostics(){return {expressionSource:sourceExpressionSelection,selectedExpressionSource,hair:state.hair,evaluated,built,stopped};}
${functionBlock('applySourceExpression','parameterGroups')}
${functionBlock('captureState','setCase')}
${functionBlock('reset','sampleIdentity')}`,c);
const run=code=>vm.runInContext(code,c);
model.setIdentityParam(3,.7);model.setJointRotation(1,.05,.1,.03);model.setTranslation(.01,.02,.03);
const baseline=run('JSON.stringify(captureState().params)');
run("selectExpressionSource('max-pca')");assert.equal(run('JSON.stringify(captureState().params)'),baseline);assert.equal(run('evaluated'),0);assert.equal(run('stopped'),0);
run("applySourceExpression('max-pca','A')");const saved=JSON.parse(run('JSON.stringify(captureState())'));
assert.equal(saved.params.identity[3],Math.fround(.7));assert.deepEqual(saved.params.rotations,Array.from(model.rotations));assert.equal(run('state.hair'),true);
c.doc=saved;run("applySourceExpression('maya-semantic','happy')");run('applyState(doc)');assert.equal(run('sourceExpressionSelection.sourceId'),'max-pca');assert.equal(run('sourceExpressionSelection.presetId'),'A');
c.doc={...saved,expressionSource:{sourceId:'max-pca',presetId:'B',strength:1}};run('applyState(doc)');assert.equal(run('sourceExpressionSelection'),null);
c.doc={...saved,expressionSource:{sourceId:'max-pca',presetId:'A'}};run('applyState(doc)');assert.equal(run('sourceExpressionSelection'),null);
const before=run('JSON.stringify(captureState().params)');assert.throws(()=>run("applySourceExpression('max-pca','A',NaN)"));assert.equal(run('JSON.stringify(captureState().params)'),before);
run("applySourceExpression('max-pca','neutral')");assert.ok(model.expression.every(x=>Object.is(x,0)));assert.equal(model.identity[3],Math.fround(.7));assert.equal(run('state.hair'),true);
run("applySourceExpression('max-pca','A',0)");run('reset()');assert.equal(run('sourceExpressionStrength'),1);run("applySourceExpression('max-pca','A')");assert.ok(model.expression.some(x=>x!==0));
const report={passed:true,level:'unit-host-functions-with-render-stubs-not-browser',checks:['source-selector-no-model-mutation','source-apply-preserves-identity-pose-hair','trusted-source-association-round-trip','mismatched-or-incomplete-source-metadata-ignored','invalid-input-atomic','neutral-clears-expression-only','full-reset-restores-strength'],browserVisualAcceptance:false};
fs.writeFileSync(new URL('tests/app-source-contract-results.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
