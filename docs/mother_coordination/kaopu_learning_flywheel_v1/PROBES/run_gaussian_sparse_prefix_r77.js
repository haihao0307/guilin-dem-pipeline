import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { DataUtils } from 'three';

const WIDTH=33,HEIGHT=33,PIXELS=WIDTH*HEIGHT,CHANNELS=PIXELS*4;
const ALPHA_COUNTS={1:1779,2:114,8:48},ROTATION_PACKED=0xc0000115;
const MODELS=['f32-final','f32-staged'];
const FIXED_PREFIXES=[1,32,128,512,1024,1536,1941];
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hashJson=x=>sha(Buffer.from(JSON.stringify(x)));
function xorshift32(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function shuffle(out,seed){const rand=xorshift32(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function records(){const alphas=shuffle(Object.entries(ALPHA_COUNTS).flatMap(([a,n])=>Array(n).fill(Number(a))),0x4b41504f);return alphas.map((alpha,i)=>({alpha,color:i%3===0?[1,0,0]:i%3===1?[0,1,0]:[0,0,1]}));}
function halfBracket(value){const lowBits=DataUtils.toHalfFloat(Math.fround(value)),low=DataUtils.fromHalfFloat(lowBits);if(low===value)return{lowBits,low,highBits:lowBits,high:low,gap:0};const highBits=lowBits+1,high=DataUtils.fromHalfFloat(highBits);return{lowBits,low,highBits,high,gap:high-low};}
function halfRoundNearestEven(value){const b=halfBracket(value);if(b.gap===0)return b.low;const dl=value-b.low,dh=b.high-value;if(dl<dh)return b.low;if(dh<dl)return b.high;return(b.lowBits&1)===0?b.low:b.high;}
function blendInput(src,a,dst,model){if(model==='f32-final')return Math.fround(src*a+dst*(1-a));if(model==='f32-staged'){const oneMinus=Math.fround(1-a),s=Math.fround(src*a),d=Math.fround(dst*oneMinus);return Math.fround(s+d);}throw new Error(model);}
function stepState(state,maps,rec,model){for(let p=0;p<PIXELS;p++){const a=maps[rec.alpha][p],o=p*4,src=[...rec.color,1];for(let ch=0;ch<4;ch++)state[o+ch]=halfRoundNearestEven(blendInput(src[ch],a,state[o+ch],model));}}
function compare(actual,predicted){let mismatchChannels=0,maxAbs=0,maxIndex=-1;for(let i=0;i<actual.length;i++){const d=Math.abs(actual[i]-predicted[i]);if(d>0)mismatchChannels++;if(d>maxAbs){maxAbs=d;maxIndex=i;}}return{mismatchChannels,maxAbs,maxIndex,pixel:maxIndex<0?null:Math.floor(maxIndex/4),channel:maxIndex<0?null:maxIndex%4};}
async function openPage(params){const page=await browser.newPage({viewport:{width:64,height:64},deviceScaleFactor:1}),query=new URLSearchParams(params);await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_sparse_prefix_r77.html?${query}`,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:1200000});const base=await page.evaluate(()=>window.__KAOPU_BASE__);if(base.status!=='candidate-observation')throw new Error(`page failed ${query}: ${base.message}`);const render=await page.evaluate(()=>window.__KAOPU_RENDER__);await page.close();return{base,render,invocation:query.toString()};}

const source=records(),calibration={};
for(const alpha of [1,2,8])calibration[alpha]=await openPage({mode:'calibration',alpha:String(alpha),buffer:'float'});
const maps={};for(const alpha of [1,2,8])maps[alpha]=Array.from({length:PIXELS},(_,p)=>calibration[alpha].render.allPixels[p*4+3]);

// Predeclared deterministic selection: scan predicted f32-final versus f32-staged
// states, retain first/global-max/last divergent writes and their +/-1 neighborhoods,
// then union the fixed logarithmic controls above. No observed prefix is read yet.
const scanStates={'f32-final':new Float32Array(CHANNELS),'f32-staged':new Float32Array(CHANNELS)};
let firstDivergence=null,lastDivergence=null,maxDivergence=null,divergentChannelStates=0;
for(let step=1;step<=source.length;step++){
  for(const model of MODELS)stepState(scanStates[model],maps,source[step-1],model);
  for(let i=0;i<CHANNELS;i++)if(scanStates['f32-final'][i]!==scanStates['f32-staged'][i]){
    const item={step,pixel:Math.floor(i/4),channel:i%4,f32Final:scanStates['f32-final'][i],f32Staged:scanStates['f32-staged'][i],abs:Math.abs(scanStates['f32-final'][i]-scanStates['f32-staged'][i])};
    divergentChannelStates++;if(firstDivergence===null)firstDivergence=item;lastDivergence=item;if(maxDivergence===null||item.abs>maxDivergence.abs)maxDivergence=item;
  }
}
const centers=[firstDivergence?.step,maxDivergence?.step,lastDivergence?.step].filter(Number.isInteger);
const prefixSet=new Set(FIXED_PREFIXES);for(const center of centers)for(const d of [-1,0,1])if(center+d>=1&&center+d<=source.length)prefixSet.add(center+d);
const selectedPrefixes=Array.from(prefixSet).sort((a,b)=>a-b);

const predicted={};for(const model of MODELS){predicted[model]={};const state=new Float32Array(CHANNELS);for(let step=1;step<=source.length;step++){stepState(state,maps,source[step-1],model);if(prefixSet.has(step))predicted[model][step]=Array.from(state);}}

const control=await openPage({mode:'order',buffer:'default',prefix:'1941',control:'independent'});
const observations={};for(const prefix of selectedPrefixes)observations[prefix]=await openPage({mode:'order',buffer:'default',prefix:String(prefix),checkpoint:'independent'});
await browser.close();

const comparisons={};for(const prefix of selectedPrefixes){comparisons[prefix]={};for(const model of MODELS)comparisons[prefix][model]=compare(observations[prefix].render.allPixels,predicted[model][prefix]);}
const exactPrefixes={};for(const model of MODELS)exactPrefixes[model]=selectedPrefixes.filter(prefix=>comparisons[prefix][model].mismatchChannels===0);
const exactAllModels=MODELS.filter(model=>exactPrefixes[model].length===selectedPrefixes.length);
const distinguishedPrefixes=selectedPrefixes.filter(prefix=>comparisons[prefix]['f32-final'].mismatchChannels!==comparisons[prefix]['f32-staged'].mismatchChannels||comparisons[prefix]['f32-final'].maxAbs!==comparisons[prefix]['f32-staged'].maxAbs);
const allPages=[...Object.values(calibration),control,...Object.values(observations)];
const allPageChecks=allPages.every(x=>Object.values(x.base.checks).every(Boolean)&&Object.values(x.render.checks).every(Boolean));
const orderPages=[control,...Object.values(observations)];
const sameLockedSource=orderPages.every(x=>x.base.rotationPacked===ROTATION_PACKED&&x.base.spz.scaleBytes.join(',')==='128,96,96'&&x.base.spz.alphaSequenceHash===control.base.spz.alphaSequenceHash&&x.base.spz.colorSequenceHash===control.base.spz.colorSequenceHash&&x.base.spz.decodedCovarianceHash===control.base.spz.decodedCovarianceHash);
const calibrationContract=Object.entries(calibration).every(([alpha,x])=>x.base.spz.count===1&&x.base.calibrationAlpha===Number(alpha)&&x.base.rotationPacked===ROTATION_PACKED&&x.base.spz.scaleBytes.join(',')==='128,96,96');
const finalControlComparison=compare(control.render.allPixels,observations[1941].render.allPixels);
const checks={allPageChecks,sameLockedSource,calibrationContract,selectionOccurredBeforeObservedPrefixes:true,selectedPrefixesBounded:selectedPrefixes.length<=16,selectedPrefixesUnique:selectedPrefixes.length===new Set(selectedPrefixes).size,independentFullFrameReadbacks:Object.values(observations).every(x=>x.render.allPixels.length===CHANNELS&&x.invocation.includes('checkpoint=independent')),finalCheckpointEqualsIndependentControl:finalControlComparison.mismatchChannels===0,allModelsEvaluated:Object.keys(comparisons).length===selectedPrefixes.length&&selectedPrefixes.every(p=>Object.keys(comparisons[p]).length===MODELS.length),outcomeClassified:true};
let classification='neither-model-exact-at-all-sparse-prefixes';if(exactAllModels.length===2)classification=divergentChannelStates===0?'models-prediction-equivalent-on-fixture':'both-models-exact-despite-predicted-divergence';else if(exactAllModels.length===1)classification=`${exactAllModels[0]}-only-exact-at-all-sparse-prefixes`;
const result={schema:'kaopu-gaussian-sparse-prefix/r77',status:Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail',question:'Do independently rendered sparse Half checkpoints preserve R76 terminal replay equality, and can adversarial predicted-divergence checkpoints distinguish f32-final from f32-staged?',sourceLocks:{threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',threeGaussianSplatBlob:'06d37fe6af583cf8cbdf8bd93565403bc3b94691',r76Commit:'38bd60237e5f6337f43886b3587cfd0275006cc2'},preregistered:{fixedInputs:{rotationPacked:'0xc0000115',scaleBytes:[128,96,96],camera:[0,0,2],drawCount:1941,order:'R75/R76 deterministic identity order'},fixedPrefixes:FIXED_PREFIXES,adversarialRule:'Before any observed prefix render, derive first/global-max/last f32-final versus f32-staged predicted divergence steps, add +/-1, union fixed prefixes, maximum 16.',acceptance:'Exact Half-decoded equality only; prefix 1941 must equal an independently rendered full control. Terminal equality and sparse-prefix equality are separate.'},runtime:{threeRevision:control.base.threeRevision,identity:control.base.identity,backend:'software WebGL fallback of WebGPURenderer'},analysis:{sourceTokenHash:hashJson(source.map(r=>`${r.alpha}:${r.color.join('')}`)),predictedDivergence:{divergentChannelStates,first:firstDivergence,maximum:maxDivergence,last:lastDivergence},selectedPrefixes,comparisons,exactPrefixes,exactAllModels,distinguishedPrefixes,classification,finalControlComparison,controlDecodedHash:control.render.decodedHash,finalCheckpointDecodedHash:observations[1941].render.decodedHash},checks,interpretation:{observation:'Every checkpoint was a separate full-frame render and readback; the final checkpoint matched an independent full-frame control. Exact sparse-prefix outcomes are recorded without treating unobserved writes as measured.',candidate:'A replay model is only a candidate for the sampled writes if it is exact at every selected prefix. Even that does not prove unsampled writes or another backend.',rejected:['The invalid R76 scissored prefix series can be rehabilitated from its finite length alone.','Terminal equality is sufficient evidence for intermediate writes.'],sameChromiumSwiftShaderEvidenceRoot:true},limits:{sparsePrefixesOnly:true,unobservedWritesRemainUnknown:true,fixedSynthetic45DegreeFixtureOnly:true,fixedFunctionBlendInternalsNotDirectlyObserved:true,formalCrossBackendProof:false,softwareWebglOnly:true,hardwareGpu:false,webgpu:false,targetDevice:false,realAsset:false,humanAcceptance:false,motherAdoptionAcknowledged:false}};
fs.writeFileSync('r77-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.status!=='Candidate-pass')process.exitCode=10;
