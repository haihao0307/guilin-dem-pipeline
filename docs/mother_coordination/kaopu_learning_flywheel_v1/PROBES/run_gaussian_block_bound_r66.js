import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { DataUtils } from 'three';

const WIDTH=33,HEIGHT=33,PIXELS=WIDTH*HEIGHT,ALPHA_COUNTS={1:1779,2:114,8:48},EPS=2e-15,BLOCK_SIZES=[32,64,128,256,512];
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function xorshift32(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function shuffle(out,seed){const rand=xorshift32(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function alphaSequence(){return shuffle(Object.entries(ALPHA_COUNTS).flatMap(([a,n])=>Array(n).fill(Number(a))),0x4b41504f);}
function colorSequence(){const R=[1,0,0],G=[0,1,0],B=[0,0,1],out=[];for(let i=0;i<647;i++)out.push(R,G,B);return out;}
function halfBracket(value){const lowBits=DataUtils.toHalfFloat(Math.fround(value)),low=DataUtils.fromHalfFloat(lowBits);if(low===value)return{lowBits,low,highBits:lowBits,high:low,gap:0};const highBits=lowBits+1,high=DataUtils.fromHalfFloat(highBits);return{lowBits,low,highBits,high,gap:high-low};}
function halfRoundNearestEven(value){const b=halfBracket(value);if(b.gap===0)return{bits:b.lowBits,value:b.low,localBound:0};const dl=value-b.low,dh=b.high-value;if(dl<dh)return{bits:b.lowBits,value:b.low,localBound:b.gap/2};if(dh<dl)return{bits:b.highBits,value:b.high,localBound:b.gap/2};return(b.lowBits&1)===0?{bits:b.lowBits,value:b.low,localBound:b.gap/2}:{bits:b.highBits,value:b.high,localBound:b.gap/2};}
function topology(alphaMap){const covered=alphaMap.map(a=>a>0),category=[];for(let p=0;p<PIXELS;p++){const x=p%WIDTH,y=Math.floor(p/WIDTH),neighbors=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&nx<WIDTH&&ny>=0&&ny<HEIGHT)neighbors.push(covered[ny*WIDTH+nx]);}category[p]=covered[p]?(neighbors.some(v=>!v)?'cutoff-inside':'stable-inside'):(neighbors.some(Boolean)?'cutoff-outside':'stable-outside');}return{covered,category,counts:Object.fromEntries(['stable-inside','cutoff-inside','cutoff-outside','stable-outside'].map(k=>[k,category.filter(x=>x===k).length]))};}
async function openPage(params){const page=await browser.newPage({viewport:{width:64,height:64},deviceScaleFactor:1}),query=new URLSearchParams(params);await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_spatial_residual_r64.html?${query}`,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:300000});const base=await page.evaluate(()=>window.__KAOPU_BASE__);if(base.status!=='candidate-observation')throw new Error(`page failed ${query}: ${base.message}`);const render=await page.evaluate(()=>window.__KAOPU_RENDER__);await page.close();return{base,render};}
function replayBlockBound(pixel,alphaMaps,alphas,colors,blockSize){
  const half=[0,0,0,0],ideal=[0,0,0,0],perStepBound=[0,0,0,0],composedBound=[0,0,0,0],resetComposedBound=[0,0,0,0];
  let maxCompositionAbs=0,localViolations=0,blockCount=0;
  for(let start=0;start<alphas.length;start+=blockSize){
    const end=Math.min(alphas.length,start+blockSize),blockG=[0,0,0,0],resetG=[0,0,0,0],resetHalf=[0,0,0,0];
    let blockT=1;
    for(let i=start;i<end;i++){
      const a=alphaMaps[alphas[i]][pixel],src=[...colors[i],1];
      blockT*=1-a;
      for(let ch=0;ch<4;ch++){
        const u=src[ch]*a+half[ch]*(1-a),q=halfRoundNearestEven(u);
        if(Math.abs(q.value-u)>q.localBound+EPS)localViolations++;
        half[ch]=q.value;
        ideal[ch]=src[ch]*a+ideal[ch]*(1-a);
        perStepBound[ch]=perStepBound[ch]*(1-a)+q.localBound;
        blockG[ch]=blockG[ch]*(1-a)+q.localBound;

        const resetU=src[ch]*a+resetHalf[ch]*(1-a),resetQ=halfRoundNearestEven(resetU);
        resetHalf[ch]=resetQ.value;
        resetG[ch]=resetG[ch]*(1-a)+resetQ.localBound;
      }
    }
    for(let ch=0;ch<4;ch++){
      composedBound[ch]=composedBound[ch]*blockT+blockG[ch];
      resetComposedBound[ch]=resetComposedBound[ch]*blockT+resetG[ch];
      maxCompositionAbs=Math.max(maxCompositionAbs,Math.abs(composedBound[ch]-perStepBound[ch]));
    }
    blockCount++;
  }
  return{half,ideal,perStepBound,composedBound,resetComposedBound,maxCompositionAbs,localViolations,blockCount};
}

const calibration=[];for(const alphaByte of [1,2,8])calibration.push({alphaByte,record:await openPage({mode:'calibration',alpha:String(alphaByte),buffer:'float'})});const observed=await openPage({mode:'order',buffer:'default'});await browser.close();
const alphaMaps={};for(const {alphaByte,record} of calibration)alphaMaps[alphaByte]=Array.from({length:PIXELS},(_,p)=>record.render.allPixels[p*4+3]);
const topo=topology(alphaMaps[8]),alphas=alphaSequence(),colors=colorSequence(),actual=observed.render.allPixels;
const stats=Object.fromEntries(BLOCK_SIZES.map(k=>[k,{blockSize:k,blockCount:Math.ceil(alphas.length/k),maxCompositionAbs:0,underestimatedChannels:0,resetUnderestimatedChannels:0,minSlack:Infinity,maxActualAbs:0,maxBound:0,firstResetCounterexample:null}]));
let globalLocalViolations=0,maxReplayAbs=0;
for(let p=0;p<PIXELS;p++)for(const k of BLOCK_SIZES){
  const r=replayBlockBound(p,alphaMaps,alphas,colors,k),s=stats[k];
  globalLocalViolations+=r.localViolations;s.maxCompositionAbs=Math.max(s.maxCompositionAbs,r.maxCompositionAbs);
  for(let ch=0;ch<4;ch++){
    const obs=actual[p*4+ch],replayAbs=Math.abs(obs-r.half[ch]),actualError=Math.abs(obs-r.ideal[ch]),slack=r.composedBound[ch]-actualError,resetSlack=r.resetComposedBound[ch]-actualError;
    maxReplayAbs=Math.max(maxReplayAbs,replayAbs);s.minSlack=Math.min(s.minSlack,slack);s.maxActualAbs=Math.max(s.maxActualAbs,actualError);s.maxBound=Math.max(s.maxBound,r.composedBound[ch]);
    if(slack < -EPS)s.underestimatedChannels++;
    if(resetSlack < -EPS){s.resetUnderestimatedChannels++;if(!s.firstResetCounterexample)s.firstResetCounterexample={pixel:p,x:p%WIDTH,y:Math.floor(p/WIDTH),category:topo.category[p],channel:ch,actualError,resetBound:r.resetComposedBound[ch],underestimate:actualError-r.resetComposedBound[ch]};}
  }
}
const stateCost={definition:'numeric values persisted per pixel; source draw data and calibrated alpha maps are excluded and remain required',fullPerStepHalfAndLocalBoundValues:alphas.length*8,blockSchemes:{}};
for(const k of BLOCK_SIZES){const blocks=stats[k].blockCount,persisted=blocks*9;stateCost.blockSchemes[k]={blocks,persistedValues: persisted,reductionVsFullPerStepTrace:1-persisted/stateCost.fullPerStepHalfAndLocalBoundValues,valuesPerBlock:'4 Half endpoint + 4 bound contribution + 1 transmittance'};}
const allPageChecks=calibration.every(x=>Object.values(x.record.base.checks).every(Boolean)&&Object.values(x.record.render.checks).every(Boolean))&&Object.values(observed.base.checks).every(Boolean)&&Object.values(observed.render.checks).every(Boolean);
const checks={allPageChecks,fullCoverageTopology:Object.values(topo.counts).every(n=>n>0),halfReplayBitExact:maxReplayAbs===0,localHalfGapBoundValid:globalLocalViolations===0,allBlockCompositionsExact:Object.values(stats).every(s=>s.maxCompositionAbs<=1e-12),allBlockBoundsConservative:Object.values(stats).every(s=>s.underestimatedChannels===0),boundaryHalfStateOmissionRejected:Object.values(stats).every(s=>s.resetUnderestimatedChannels>0),stateReductionExplicit:stateCost.blockSchemes[128].reductionVsFullPerStepTrace>0.99,outcomeClassified:true};
const digest=Buffer.from(new Float64Array(Object.values(stats).flatMap(s=>[s.maxCompositionAbs,s.minSlack,s.maxActualAbs,s.maxBound,s.resetUnderestimatedChannels])).buffer);
const result={schema:'kaopu-gaussian-block-bound/r66',status:'Candidate-observation',question:'Can checkpointed block summaries compose the R65 conservative bound with much less persisted diagnostic state, and is the boundary Half state necessary?',sourceLocks:{threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',r65Commit:'29204b27aec3ca1e9536873af6df0c0156018bf6'},blockDefinition:{summary:'per block and pixel: ending four-channel Half state, four-channel bound contribution from zero incoming bound, and scalar transmittance',composition:'B_out = B_in * T_block + G_block',boundaryRequirement:'the true Half endpoint of the previous block seeds local-gap calculation in the next block',preregisteredBlockSizes:BLOCK_SIZES},fixture:{viewport:[WIDTH,HEIGHT],splatCount:alphas.length,alphaCounts:ALPHA_COUNTS,alphaOrder:'xorshift32 0x4b41504f',colorOrder:'RGB cycle repeated 647 times',scaleByte:116,topology:topo.counts},runtime:{threeRevision:observed.base.threeRevision,identity:observed.base.identity,backend:'software WebGL fallback of WebGPURenderer',source:'actual r186 SPZLoader and GaussianSplat Half target'},analysis:{maxReplayAbs,globalLocalViolations,byBlockSize:stats,stateCost,resultDigestSha256:sha(digest),blockCompositionAssessment:Object.values(stats).every(s=>s.maxCompositionAbs<=1e-12)?'matches-per-step-bound':'composition-mismatch',boundaryStateAssessment:Object.values(stats).every(s=>s.resetUnderestimatedChannels>0)?'required-by-counterexample':'not-rejected-in-this-fixture'},checks,interpretation:{observation:'Checkpointed block contributions compose the same conservative endpoint bound for every locked channel at all preregistered block sizes.',candidate:'Persist block summaries for later localization while computing each block online from the true boundary Half state.',rejected:'Blocks can be independently restarted from zero Half state and still certify the accumulated endpoint error.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{sourceDrawDataAndAlphaMapsExcludedFromStateCost:true,blockSummaryMustBeComputedSequentially:true,notACompactAssetSummary:true,syntheticRepeatedSplats:true,dcColorsOnly:true,softwareWebglOnly:true,hardwareGpu:false,webgpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
result.status=Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail';fs.writeFileSync('r66-comparison.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.status!=='Candidate-pass')process.exitCode=10;
