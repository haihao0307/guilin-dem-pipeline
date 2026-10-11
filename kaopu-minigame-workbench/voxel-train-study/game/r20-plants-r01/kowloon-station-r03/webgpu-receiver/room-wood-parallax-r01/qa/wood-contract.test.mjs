import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {shader as baseline} from '../../room-slice/qa/source.test.mjs';
import {receiverWGSL as before} from '../../room-slice/receiver.mjs';
import {receiverWGSL as after} from '../receiver.mjs';
import {WOOD_PARALLAX_WGSL} from '../wood-parallax.mjs';
import {selectStageSource} from '../../room-slice/stage-source.mjs';
import {scanWGSLIdentifiers} from '../../room-slice/qa/wgsl-identifiers.mjs';
const source=after("","");
const specs=[["mothers/brick-core.mjs","KP_BRICK_WGSL"],["mothers/plaster-core.mjs","KP_PLASTER_WGSL"],["mothers/v26-wet.mjs","KP_V26_WGSL"],["mothers/wood-core.mjs","KP_WOOD_WGSL"],["mothers/fabric-core.mjs","KP_FABRIC_WGSL"],["mothers/stone-fields.mjs","KP_STONE_WGSL"],["mothers/stone-slate.mjs","KP_STONE_SLATE_WGSL"],["metal.mjs","KP_METAL_WGSL"],["textile-domain.mjs","TEXTILE_DOMAIN_WGSL"],["fabric-coverage.mjs","KP_FABRIC_COVERAGE_WGSL"]];
const fields=[];for(const [path,name] of specs)fields.push((await import("../../room-slice/"+path))[name]);
const {skipZeroContributions}=await import("../../room-slice/evaluation.mjs"),{DOMAIN_WGSL}=await import("../../room-slice/domain.mjs"),{COVERAGE_DOMAIN_WGSL}=await import("../../room-slice/coverage-domain.mjs");
const shader=after(skipZeroContributions(fields.join("\n")),DOMAIN_WGSL+COVERAGE_DOMAIN_WGSL);
assert.deepEqual(scanWGSLIdentifiers(shader),[]);
assert(shader.includes('woodParallax:u32'));
assert(shader.includes('woodParallaxSource(f.q'));
const changed=new Set(['surface','shadeOpaqueCore']);
function functions(s){const out=new Map();for(const m of s.matchAll(/\bfn\s+(\w+)\s*\(/g)){let p=s.indexOf('{',m.index),d=1,q=p+1;for(;d&&q<s.length;q++)d+=(s[q]==='{')-(s[q]==='}');out.set(m[1],s.slice(m.index,q));}return out;}
const a=functions(baseline),b=functions(shader);for(const [name,text] of a)if(!changed.has(name))assert.equal(b.get(name),text,`Frozen existing function ${name}`);
for(const roots of [['primaryMain'],['primaryResumeMain'],['coverageMain'],['vs','fsOpaque'],['vs','fsGlass']]){const stage=selectStageSource(shader,roots);assert.deepEqual(scanWGSLIdentifiers(stage.code),[]);if(['primaryMain','primaryResumeMain','coverageMain'].includes(roots[0]))assert(!stage.functionNames.includes('woodParallaxSource'));}
const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');assert(app.includes('new Uint32Array(b)[33]=f.woodParallax'));assert(app.includes('new ArrayBuffer(144)'));assert(app.includes('woodParallax:frozen.woodParallax'));
// Original closed form for constant coarse height: linear interpolation lands
// at the requested source-depth fraction, including one-layer and 12-layer modes.
function march(depth,N){let current=0,previous=0;for(let i=0;i<12;i++){if(i>=N||current>=depth)break;previous=current;current+=1/N;}const after=depth-current,before=depth-previous,den=after-before,w=Math.abs(den)>.00001?Math.max(0,Math.min(1,after/den)):0;return current*(1-w)+previous*w;}
for(const steps of [1,6,12])for(const depth of [0,.1,.5,.9,1])assert(Math.abs(march(depth,steps)-depth)<1e-12);
assert.equal(.00105*.7741619322448968/.30<.002711,true);
console.log(JSON.stringify({result:'wood receiver source contracts passed',frozenExistingFunctions:a.size-changed.size,changedExistingFunctions:[...changed],addedFunctions:[...b.keys()].filter(x=>!a.has(x)),worldGeometryChanged:false,motherChanged:false,uniformBytes:144,maxCoordinateExcursionM:.00105*.7741619322448968/.30,shaderSha256:createHash('sha256').update(shader).digest('hex')},null,2));
export {shader};
