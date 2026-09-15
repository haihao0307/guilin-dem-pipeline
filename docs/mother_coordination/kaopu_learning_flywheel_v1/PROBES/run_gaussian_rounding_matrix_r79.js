import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { DataUtils } from 'three';

const WIDTH=33,HEIGHT=33,PIXELS=WIDTH*HEIGHT,CHANNELS=PIXELS*4,CENTER=544;
const ROTATION_PACKED=0xc0000115;
const MODELS=['staged','no_comp','no_prod','no_sum'];
const CASES={
  no_comp:{targetChannel:0,records:[{alpha:19,color:[240/255,0,0]},{alpha:237,color:[4/255,0,0]}]},
  no_prod:{targetChannel:1,records:[{alpha:13,color:[0,8/255,0]},{alpha:123,color:[0,248/255,0]}]},
  no_sum:{targetChannel:2,records:[{alpha:1,color:[0,0,224/255]},{alpha:120,color:[0,0,192/255]}]}
};
const ALPHAS=[1,13,19,120,123,237];
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hashJson=x=>sha(Buffer.from(JSON.stringify(x)));
function halfBracket(value){const lowBits=DataUtils.toHalfFloat(Math.fround(value)),low=DataUtils.fromHalfFloat(lowBits);if(low===value)return{lowBits,low,highBits:lowBits,high:low,gap:0};const highBits=lowBits+1,high=DataUtils.fromHalfFloat(highBits);return{lowBits,low,highBits,high,gap:high-low};}
function halfRoundNearestEven(value){const b=halfBracket(value);if(b.gap===0)return b.low;const dl=value-b.low,dh=b.high-value;if(dl<dh)return b.low;if(dh<dl)return b.high;return(b.lowBits&1)===0?b.low:b.high;}
function blendInput(src,a,dst,model){
  if(model==='staged'){const c=Math.fround(1-a),s=Math.fround(src*a),d=Math.fround(dst*c);return Math.fround(s+d);}
  if(model==='no_comp'){const c=1-a,s=Math.fround(src*a),d=Math.fround(dst*c);return Math.fround(s+d);}
  if(model==='no_prod'){const c=Math.fround(1-a);return Math.fround(src*a+dst*c);}
  if(model==='no_sum'){const c=Math.fround(1-a),s=Math.fround(src*a),d=Math.fround(dst*c);return s+d;}
  throw new Error(model);
}
function stepState(state,maps,rec,model){for(let p=0;p<PIXELS;p++){const a=maps[rec.alpha][p],o=p*4,src=[...rec.color,1];for(let ch=0;ch<4;ch++)state[o+ch]=halfRoundNearestEven(blendInput(src[ch],a,state[o+ch],model));}}
function compare(actual,predicted){let mismatchChannels=0,maxAbs=0,maxIndex=-1;for(let i=0;i<actual.length;i++){const d=Math.abs(actual[i]-predicted[i]);if(d>0)mismatchChannels++;if(d>maxAbs){maxAbs=d;maxIndex=i;}}return{mismatchChannels,maxAbs,maxIndex,pixel:maxIndex<0?null:Math.floor(maxIndex/4),channel:maxIndex<0?null:maxIndex%4};}
async function openPage(params){const page=await browser.newPage({viewport:{width:64,height:64},deviceScaleFactor:1}),query=new URLSearchParams(params);await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_rounding_matrix_r79.html?${query}`,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:1200000});const base=await page.evaluate(()=>window.__KAOPU_BASE__);if(base.status!=='candidate-observation')throw new Error(`page failed ${query}: ${base.message}`);const render=await page.evaluate(()=>window.__KAOPU_RENDER__);await page.close();return{base,render,invocation:query.toString()};}

// All independent Float alpha calibration is completed first. No Half target is
// rendered unless every locked case isolates its declared arithmetic ablation.
const calibration={};for(const alpha of ALPHAS)calibration[alpha]=await openPage({mode:'calibration',case:'no_comp',alpha:String(alpha),buffer:'float'});
const maps={};for(const alpha of ALPHAS)maps[alpha]=Array.from({length:PIXELS},(_,p)=>calibration[alpha].render.allPixels[p*4+3]);
const predicted={},preTarget={};
for(const [caseName,c] of Object.entries(CASES)){
  predicted[caseName]={};
  for(const model of MODELS){const state=new Float32Array(CHANNELS);predicted[caseName][model]={};for(let step=1;step<=2;step++){stepState(state,maps,c.records[step-1],model);predicted[caseName][model][step]=Array.from(state);}}
  const staged=predicted[caseName].staged[2],target=compare(staged,predicted[caseName][caseName][2]);
  const otherAblations=MODELS.filter(m=>m!=='staged'&&m!==caseName),others=Object.fromEntries(otherAblations.map(m=>[m,compare(staged,predicted[caseName][m][2])]));
  const centerIndex=CENTER*4+c.targetChannel;
  preTarget[caseName]={targetAblation:caseName,targetDivergence:target,otherAblations:others,isolated:target.mismatchChannels>0&&target.maxIndex===centerIndex&&Object.values(others).every(x=>x.mismatchChannels===0),centerPredicted:Object.fromEntries(MODELS.map(m=>[m,predicted[caseName][m][2][centerIndex]]))};
}
if(!Object.values(preTarget).every(x=>x.isolated)){await browser.close();throw new Error(`preregistered matrix did not isolate all stages; target render prohibited: ${JSON.stringify(preTarget)}`);}

const observed={};
for(const caseName of Object.keys(CASES)){
  observed[caseName]={
    prefix1:await openPage({mode:'order',case:caseName,buffer:'default',prefix:'1',checkpoint:'independent'}),
    prefix2:await openPage({mode:'order',case:caseName,buffer:'default',prefix:'2',checkpoint:'independent'}),
    control2:await openPage({mode:'order',case:caseName,buffer:'default',prefix:'2',control:'independent'})
  };
}
await browser.close();

const analysis={};
for(const [caseName,c] of Object.entries(CASES)){
  const o=observed[caseName],comparisons={prefix1:{},prefix2:{}};
  for(const model of MODELS){comparisons.prefix1[model]=compare(o.prefix1.render.allPixels,predicted[caseName][model][1]);comparisons.prefix2[model]=compare(o.prefix2.render.allPixels,predicted[caseName][model][2]);}
  const exactBothPrefixes=MODELS.filter(m=>comparisons.prefix1[m].mismatchChannels===0&&comparisons.prefix2[m].mismatchChannels===0);
  const duplicateControl=compare(o.prefix2.render.allPixels,o.control2.render.allPixels),centerIndex=CENTER*4+c.targetChannel;
  analysis[caseName]={records:c.records.map(r=>({alphaByte:r.alpha,rgb:r.color})),targetChannel:c.targetChannel,preTarget:preTarget[caseName],comparisons,exactBothPrefixes,targetAblationRejected:comparisons.prefix2[caseName].mismatchChannels>0,stagedExact:comparisons.prefix1.staged.mismatchChannels===0&&comparisons.prefix2.staged.mismatchChannels===0,duplicateControl,centerObserved:o.prefix2.render.allPixels[centerIndex],observedHashes:{prefix1:o.prefix1.render.decodedHash,prefix2:o.prefix2.render.decodedHash,prefix2Control:o.control2.render.decodedHash},predictedHashes:Object.fromEntries(MODELS.map(m=>[m,hashJson(predicted[caseName][m][2])]))};
}
const allPages=[...Object.values(calibration),...Object.values(observed).flatMap(x=>Object.values(x))];
const allPageChecks=allPages.every(x=>Object.values(x.base.checks).every(Boolean)&&Object.values(x.render.checks).every(Boolean));
const calibrationContract=Object.entries(calibration).every(([alpha,x])=>x.base.spz.count===1&&x.base.calibrationAlpha===Number(alpha)&&x.base.rotationPacked===ROTATION_PACKED);
const caseTargetLocks=Object.entries(observed).every(([caseName,o])=>[o.prefix1,o.prefix2,o.control2].every(x=>x.base.caseName===caseName&&x.base.rotationPacked===ROTATION_PACKED&&x.base.spz.count===2&&x.base.spz.scaleBytes.join(',')==='128,96,96'&&x.base.spz.alphaSequenceHash===o.prefix2.base.spz.alphaSequenceHash&&x.base.spz.colorSequenceHash===o.prefix2.base.spz.colorSequenceHash&&x.base.spz.decodedCovarianceHash===o.prefix2.base.spz.decodedCovarianceHash));
const allThreeStagesRequired=Object.values(analysis).every(x=>x.stagedExact&&x.targetAblationRejected);
const checks={allPageChecks,calibrationContract,caseTargetLocks,allCasesIsolatedBeforeTarget:Object.values(preTarget).every(x=>x.isolated),independentPrefixReadbacks:Object.values(observed).every(x=>x.prefix1.invocation.includes('checkpoint=independent')&&x.prefix2.invocation.includes('checkpoint=independent')),duplicateControls:Object.values(analysis).every(x=>x.duplicateControl.mismatchChannels===0),allModelsEvaluated:Object.values(analysis).every(x=>Object.keys(x.comparisons.prefix2).length===MODELS.length),outcomeClassified:true};
const result={schema:'kaopu-gaussian-rounding-matrix/r79',status:Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail',question:'Can three preregistered r186 Half-boundary counterexamples separately test complement, product and sum Float32 staging?',sourceLocks:{threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',threeGaussianSplatBlob:'06d37fe6af583cf8cbdf8bd93565403bc3b94691',r78Commit:'67179ec3aec92ff308899e21f006fae2bb2d566b'},preregistered:{derivation:'CPU search using the R78 center alpha ratio; actual Float calibration must isolate each declared ablation before any target render.',cases:Object.fromEntries(Object.entries(CASES).map(([k,v])=>[k,{targetChannel:v.targetChannel,records:v.records.map(r=>({alphaByte:r.alpha,rgbBytes:r.color.map(x=>Math.round(x*255))}))}])),targetRenderProhibition:'Do not render any Half target unless all three actual-calibration predictions isolate the declared ablation at the declared center channel.',acceptance:'Exact decoded Half equality at independent prefixes 1 and 2; one independent duplicate prefix-2 control per case.'},runtime:{threeRevision:observed.no_comp.prefix2.base.threeRevision,identity:observed.no_comp.prefix2.base.identity,backend:'software WebGL fallback of WebGPURenderer'},calibrationAlphaAtCenter:Object.fromEntries(ALPHAS.map(a=>[a,maps[a][CENTER]])),analysis,allThreeStagesRequired,checks,interpretation:{observation:'All targets were withheld until actual Float calibration proved three isolated stored-output divergences. Independent target readbacks can therefore accept or reject each staged operation without post-target fixture selection.',candidate:'A stage marked required is input/output evidence for this synthetic software route only; it does not reveal hidden fixed-function instructions or prove cross-backend generality.',rejected:['Prediction-equivalent cases can identify an arithmetic stage.','One R78 counterexample establishes complement, product and sum staging independently.'],sameChromiumSwiftShaderEvidenceRoot:true},limits:{threeSyntheticTwoSplatCasesOnly:true,oneDeclaredColorChannelPerCase:true,fixed45DegreeFootprint:true,fixedFunctionInternalsInferredNotObserved:true,formalCrossBackendProof:false,softwareWebglOnly:true,hardwareGpu:false,webgpu:false,targetDevice:false,realAsset:false,humanAcceptance:false,motherAdoptionAcknowledged:false}};
fs.writeFileSync('r79-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.status!=='Candidate-pass')process.exitCode=10;
