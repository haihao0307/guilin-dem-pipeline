import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { DataUtils } from 'three';

const WIDTH=33,HEIGHT=33,PIXELS=WIDTH*HEIGHT,ALPHA_COUNTS={1:1779,2:114,8:48},EPS=2e-15,BLOCK_SIZE=128;
const VARIANTS=['baseline','reverse','alpha-asc','alpha-desc','color-group','rotate-647','shuffle-r72'];
const CONTEXT={threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',renderer:'WebGL fallback of WebGPURenderer',outputBufferType:'HalfFloatType',blend:'NormalBlending',blockSize:BLOCK_SIZE,camera:{fov:60,aspect:1,near:0.1,far:10,position:[0,0,2]},scaleByte:116};
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hashJson=x=>sha(Buffer.from(JSON.stringify(x)));
function xorshift32(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function shuffle(out,seed){const rand=xorshift32(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function baseRecords(){const alphas=shuffle(Object.entries(ALPHA_COUNTS).flatMap(([a,n])=>Array(n).fill(Number(a))),0x4b41504f);return alphas.map((alpha,i)=>({alpha,color:i%3===0?[1,0,0]:i%3===1?[0,1,0]:[0,0,1],index:i}));}
function recordsFor(variant){const r=baseRecords();if(variant==='baseline')return r;if(variant==='reverse')return r.reverse();if(variant==='alpha-asc')return r.sort((a,b)=>a.alpha-b.alpha||a.index-b.index);if(variant==='alpha-desc')return r.sort((a,b)=>b.alpha-a.alpha||a.index-b.index);if(variant==='color-group')return r.sort((a,b)=>a.color.findIndex(Boolean)-b.color.findIndex(Boolean)||a.index-b.index);if(variant==='rotate-647')return r.slice(647).concat(r.slice(0,647));if(variant==='shuffle-r72')return shuffle(r,0x72322032);throw new Error(`bad variant ${variant}`);}
function recordToken(r){return `${r.alpha}:${r.color.join('')}`;}
function halfBracket(value){const lowBits=DataUtils.toHalfFloat(Math.fround(value)),low=DataUtils.fromHalfFloat(lowBits);if(low===value)return{lowBits,low,highBits:lowBits,high:low,gap:0};const highBits=lowBits+1,high=DataUtils.fromHalfFloat(highBits);return{lowBits,low,highBits,high,gap:high-low};}
function halfRoundNearestEven(value){const b=halfBracket(value);if(b.gap===0)return{bits:b.lowBits,value:b.low,localBound:0};const dl=value-b.low,dh=b.high-value;if(dl<dh)return{bits:b.lowBits,value:b.low,localBound:b.gap/2};if(dh<dl)return{bits:b.highBits,value:b.high,localBound:b.gap/2};return(b.lowBits&1)===0?{bits:b.lowBits,value:b.low,localBound:b.gap/2}:{bits:b.highBits,value:b.high,localBound:b.gap/2};}
async function openPage(params){const page=await browser.newPage({viewport:{width:64,height:64},deviceScaleFactor:1}),query=new URLSearchParams(params);await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_order_cache_r72.html?${query}`,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:300000});const base=await page.evaluate(()=>window.__KAOPU_BASE__);if(base.status!=='candidate-observation')throw new Error(`page failed ${query}: ${base.message}`);const render=await page.evaluate(()=>window.__KAOPU_RENDER__);await page.close();return{base,render};}
function replay(pixel,alphaMaps,records){
  const half=[0,0,0,0],ideal=[0,0,0,0],perStepBound=[0,0,0,0],composedBound=[0,0,0,0],summaries=[];
  let maxCompositionAbs=0,localViolations=0;
  for(let start=0;start<records.length;start+=BLOCK_SIZE){
    const end=Math.min(records.length,start+BLOCK_SIZE),blockG=[0,0,0,0];let blockT=1;
    for(let i=start;i<end;i++){
      const rec=records[i],a=alphaMaps[rec.alpha][pixel],src=[...rec.color,1];blockT*=1-a;
      for(let ch=0;ch<4;ch++){
        const u=src[ch]*a+half[ch]*(1-a),q=halfRoundNearestEven(u);if(Math.abs(q.value-u)>q.localBound+EPS)localViolations++;
        half[ch]=q.value;ideal[ch]=src[ch]*a+ideal[ch]*(1-a);perStepBound[ch]=perStepBound[ch]*(1-a)+q.localBound;blockG[ch]=blockG[ch]*(1-a)+q.localBound;
      }
    }
    for(let ch=0;ch<4;ch++){composedBound[ch]=composedBound[ch]*blockT+blockG[ch];maxCompositionAbs=Math.max(maxCompositionAbs,Math.abs(composedBound[ch]-perStepBound[ch]));}
    summaries.push(...half,...blockG,blockT);
  }
  return{half,ideal,perStepBound,composedBound,summaries,maxCompositionAbs,localViolations};
}

const calibration=[];for(const alphaByte of [1,2,8])calibration.push({alphaByte,record:await openPage({mode:'calibration',alpha:String(alphaByte),buffer:'float',variant:'baseline'})});
const observed={};for(const variant of VARIANTS)observed[variant]=await openPage({mode:'order',buffer:'default',variant});await browser.close();
const alphaMaps={};for(const {alphaByte,record} of calibration)alphaMaps[alphaByte]=Array.from({length:PIXELS},(_,p)=>record.render.allPixels[p*4+3]);
const alphaMapHashes=Object.fromEntries(Object.entries(alphaMaps).map(([k,v])=>[k,hashJson(v)]));
const replays={},orderedHashes={},weakHashes={},summaryDigests={},strongKeys={};
for(const variant of VARIANTS){
  const records=recordsFor(variant),orderedTokens=records.map(recordToken),unorderedTokens=orderedTokens.slice().sort();
  orderedHashes[variant]=hashJson(orderedTokens);weakHashes[variant]=hashJson(unorderedTokens);
  strongKeys[variant]=hashJson({...CONTEXT,orderedRecordHash:orderedHashes[variant],effectiveAlphaMapHashes:alphaMapHashes});
  replays[variant]=Array.from({length:PIXELS},(_,p)=>replay(p,alphaMaps,records));
  summaryDigests[variant]=hashJson(replays[variant].flatMap(x=>x.summaries));
}
const baselineBounds=replays.baseline.map(x=>x.composedBound);
const stats={};let globalReplayAbs=0,globalLocalViolations=0,globalCompositionAbs=0;
for(const variant of VARIANTS){
  const actual=observed[variant].render.allPixels,s={variant,orderedRecordHash:orderedHashes[variant],weakUnorderedMultisetHash:weakHashes[variant],strongCacheKey:strongKeys[variant],summaryDigest:summaryDigests[variant],recomputedUnderestimatedChannels:0,staleBaselineUnderestimatedChannels:0,minRecomputedSlack:Infinity,minStaleSlack:Infinity,maxActualError:0,maxReplayAbs:0,firstStaleCounterexample:null};
  for(let p=0;p<PIXELS;p++){
    const r=replays[variant][p];globalLocalViolations+=r.localViolations;globalCompositionAbs=Math.max(globalCompositionAbs,r.maxCompositionAbs);
    for(let ch=0;ch<4;ch++){
      const obs=actual[p*4+ch],replayAbs=Math.abs(obs-r.half[ch]),actualError=Math.abs(obs-r.ideal[ch]),recomputedSlack=r.composedBound[ch]-actualError,staleSlack=baselineBounds[p][ch]-actualError;
      globalReplayAbs=Math.max(globalReplayAbs,replayAbs);s.maxReplayAbs=Math.max(s.maxReplayAbs,replayAbs);s.maxActualError=Math.max(s.maxActualError,actualError);s.minRecomputedSlack=Math.min(s.minRecomputedSlack,recomputedSlack);s.minStaleSlack=Math.min(s.minStaleSlack,staleSlack);
      if(recomputedSlack < -EPS)s.recomputedUnderestimatedChannels++;
      if(variant!=='baseline'&&staleSlack < -EPS){s.staleBaselineUnderestimatedChannels++;if(!s.firstStaleCounterexample)s.firstStaleCounterexample={pixel:p,x:p%WIDTH,y:Math.floor(p/WIDTH),channel:ch,actualError,staleBaselineBound:baselineBounds[p][ch],underestimate:actualError-baselineBounds[p][ch]};}
    }
  }
  stats[variant]=s;
}
const allPages=[...calibration.map(x=>x.record),...Object.values(observed)],allPageChecks=allPages.every(x=>Object.values(x.base.checks).every(Boolean)&&Object.values(x.render.checks).every(Boolean));
const changed=VARIANTS.filter(v=>v!=='baseline'),staleFailures=changed.reduce((n,v)=>n+stats[v].staleBaselineUnderestimatedChannels,0),differentSummaryVariants=changed.filter(v=>summaryDigests[v]!==summaryDigests.baseline),differentStrongKeyVariants=changed.filter(v=>strongKeys[v]!==strongKeys.baseline);
const checks={allPageChecks,halfReplayBitExact:globalReplayAbs===0,localHalfGapBoundValid:globalLocalViolations===0,blockCompositionExact:globalCompositionAbs<=1e-12,unorderedMultisetKeyCollision:VARIANTS.every(v=>weakHashes[v]===weakHashes.baseline),orderedRecordKeysInvalidateAllChangedOrders:differentStrongKeyVariants.length===changed.length,recomputedSummariesChangeAllOrders:differentSummaryVariants.length===changed.length,recomputedBoundsConservative:VARIANTS.every(v=>stats[v].recomputedUnderestimatedChannels===0),staleSummaryReuseRejected:staleFailures>0&&changed.some(v=>stats[v].staleBaselineUnderestimatedChannels>0),outcomeClassified:true};
const result={schema:'kaopu-gaussian-order-cache/r72',status:'Candidate-observation',question:'Can R66 block summaries be reused after draw order changes when the unordered splat multiset and all renderer/view conditions stay fixed?',sourceLocks:{threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',r66Commit:'9d8c8a58b7b15a43da9a2e2b0c0186cca28427b7'},preregistered:{blockSize:BLOCK_SIZE,variants:VARIANTS,negativeControl:'reuse baseline composed block bound for every changed order',positiveControl:'recompute sequential summaries from the true Half boundary state for each order',weakKey:'hash of sorted alpha+RGB record tokens',strongKeyFields:Object.keys({...CONTEXT,orderedRecordHash:'',effectiveAlphaMapHashes:{}})},runtime:{threeRevision:observed.baseline.base.threeRevision,identity:observed.baseline.base.identity,backend:'software WebGL fallback of WebGPURenderer'},analysis:{alphaMapHashes,baseline:{orderedRecordHash:orderedHashes.baseline,weakUnorderedMultisetHash:weakHashes.baseline,strongCacheKey:strongKeys.baseline,summaryDigest:summaryDigests.baseline},byVariant:stats,globalReplayAbs,globalLocalViolations,globalCompositionAbs,staleUnderestimatedChannels:staleFailures,differentSummaryVariants,differentStrongKeyVariants},checks,interpretation:{observation:'All fixed order changes preserved the unordered splat multiset but changed the ordered source key and recomputed summary digest. Recomputed summaries remained conservative; stale baseline summaries underestimated at least one changed-order channel.',candidate:'Cache lookup must bind the exact ordered draw stream plus effective alpha maps, renderer/output/blend/block schema and view state. Recompute sequential summaries after an order-key change.',rejected:'An unordered splat multiset hash, unchanged camera, or unchanged block size is sufficient authority to reuse R66 summaries after sorting changes.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{drawOrderOnly:true,cameraChangeNotTested:true,syntheticRepeatedCenteredSplats:true,dcColorsOnly:true,softwareWebglOnly:true,hardwareGpu:false,webgpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false,motherAdoptionAcknowledged:false}};
result.status=Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail';fs.writeFileSync('r72-comparison.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.status!=='Candidate-pass')process.exitCode=10;
