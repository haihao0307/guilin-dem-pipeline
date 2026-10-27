'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function load(file){const c={};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/'+file,'utf8'),c);return c.DYNAMIC;}
const old=load('dynamic.original.js'),proposal=load('dynamic.candidate-beta-proposal.js'),names=Object.keys(old).filter(n=>typeof old[n]==='function');
for(const name of names)assert.strictEqual(old[name].toString(),proposal[name].toString(),name);
for(const name of Object.keys(old).filter(n=>n!=='glsl'&&typeof old[n]!=='function'))assert.strictEqual(JSON.stringify(old[name]),JSON.stringify(proposal[name]),name);
assert.strictEqual(old.glsl.match(/vec2 dynRotate\([^\n]+/)[0],proposal.glsl.match(/vec2 dynRotate\([^\n]+/)[0]);
assert.strictEqual(old.glsl.match(/vec2 dynBig\([^\n]+/)[0],proposal.glsl.match(/vec2 dynBig\([^\n]+/)[0]);
let samples=0;for(let k=0;k<=100;k++)for(const beta of [.11,.126,.16])for(let side=0;side<3;side++){const theta=2*Math.PI*k/100;assert.strictEqual(JSON.stringify(old.pose(theta,side,beta)),JSON.stringify(proposal.pose(theta,side,beta)));samples++;}
const report={status:'PASS_CPU_AND_SOURCE_LOCKS_ONLY',cpuFunctionsUnchanged:names,cpuPoseSamples:samples,originalGenericDynRotateUnchanged:true,originalDynBigUnchanged:true,baselineBuiltinAxisBranchRetained:proposal.glsl.includes('installationCandidate==1?dynCandidateBetaSinCos(inc):vec2(sin(inc),cos(inc))'),glslCompiled:false,gpuExecuted:false,mainDynamicSourceEdited:false};fs.writeFileSync(__dirname+'/HOST_CPU_LOCK_QA.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
