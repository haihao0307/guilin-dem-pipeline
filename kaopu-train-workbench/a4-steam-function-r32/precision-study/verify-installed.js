'use strict';
// Optional main-installation check. The study itself has no implicit outside dependency.
// Usage: node verify-installed.js /absolute/path/to/authorized/workbench
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
if(process.argv.length!==3)throw Error('Pass the explicit authorized workbench directory');
const root=path.resolve(process.argv[2]),SP=require('./steam-path.original'),original=SP.create(),packet=require('./load-original-samples')(),installed=require(path.join(root,'load-whole-scene.js'))(root),C=installed.dynamic.steamPathCandidate,D=installed.dynamic,currentSP=require(path.join(root,'steam-path.js')),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.ok(C,'Actual whole-page installation has no steam candidate');
for(const name of ['create','scalar','bounds','point','fillet','pathDistance'])assert.strictEqual(currentSP[name].toString(),SP[name].toString(),name+' CPU function changed');
for(const name of ['parameters','parts','hostCuts','routes','domains','status'])assert.strictEqual(JSON.stringify(C[name]),JSON.stringify(original[name]),name+' changed');
assert.strictEqual(hash(fs.readFileSync(path.join(root,'dynamic.js'))),hash(fs.readFileSync(__dirname+'/dynamic.original.js')),'Original dynamic.js bytes changed');
let maxDifference=0;for(const s of packet.samples){const inst={mode:'candidate',beta:s.beta},actual=s.kind==='part'?C.worldScalar(s.id,s.point,s.theta,inst):C.hostCutScalar(s.id,s.point,s.theta,inst);assert.strictEqual(actual,s.expectedCPU);maxDifference=Math.max(maxDifference,Math.abs(actual-s.expectedCPU));}
assert.ok(D.glsl.includes('dynCandidateBetaSinCos'));assert.ok(D.glsl.includes('installationCandidate==1?dynCandidateBetaSinCos(inc):vec2(sin(inc),cos(inc))'));assert.ok(D.glsl.includes('spBoundedBetaSinCos'));
const report={status:'PASS_INSTALLED_CPU_AST_LOCKS_ONLY',originalCPUSamples:packet.samples.length,maxCPUDifference:maxDifference,cpuGeometryASTParametersRoutesDomainsStatusUnchanged:true,originalDynamicFileBytesUnchanged:true,candidateBetaHelpersActuallyInstalled:true,installedSourceSHA256:hash(C.source),installedCommonSHA256:hash(C.commonSource),installedDynamicGLSLSHA256:hash(D.glsl),filesSHA256:installed.sha256,gpuAcceptance:false};fs.writeFileSync(__dirname+'/INSTALLED_CPU_AST_LOCK_QA.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,filesSHA256:undefined},null,2));
