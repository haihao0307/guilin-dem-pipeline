import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { DataUtils } from 'three';

const WIDTH=33,HEIGHT=33,PIXELS=WIDTH*HEIGHT,ALPHA_COUNTS={1:1779,2:114,8:48},EPS=2e-15,BLOCK_SIZE=128;
const VIEWS=[{id:'near-z1.5',z:1.5},{id:'baseline-z2.0',z:2},{id:'far-z2.5',z:2.5}],BASELINE='baseline-z2.0';
const CONTEXT={threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',renderer:'WebGL fallback of WebGPURenderer',outputBufferType:'HalfFloatType',blend:'NormalBlending',blockSize:BLOCK_SIZE,cameraProjection:{fov:60,aspect:1,near:0.1,far:10},scaleByte:116};
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hashJson=x=>sha(Buffer.from(JSON.stringify(x)));
function xorshift32(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function shuffle(out,seed){const rand=xorshift32(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function records(){const alphas=shuffle(Object.entries(ALPHA_COUNTS).flatMap(([a,n])=>Array(n).fill(Number(a))),0x4b41504f);return alphas.map((alpha,i)=>({alpha,color:i%3===0?[1,0,0]:i%3===1?[0,1,0]:[0,0,1]}));}
function halfBracket(value){const lowBits=DataUtils.toHalfFloat(Math.fround(value)),low=DataUtils.fromHalfFloat(lowBits);if(low===value)return{lowBits,low,highBits:lowBits,high:low,gap:0};const highBits=lowBits+1,high=DataUtils.fromHalfFloat(highBits);return{lowBits,low,highBits,high,gap:high-low};}
function halfRoundNearestEven(value){const b=halfBracket(value);if(b.gap===0)return{bits:b.lowBits,value:b.low,localBound:0};const dl=value-b.low,dh=b.high-value;if(dl<dh)return{bits:b.lowBits,value:b.low,localBound:b.gap/2};if(dh<dl)return{bits:b.highBits,value:b.high,localBound:b.gap/2};return(b.lowBits&1)===0?{bits:b.lowBits,value:b.low,localBound:b.gap/2}:{bits:b.highBits,value:b.high,localBound:b.gap/2};}
async function openPage(params){const page=await browser.newPage({viewport:{width:64,height:64},deviceScaleFactor:1}),query=new URLSearchParams(params);await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_view_cache_r73.html?${query}`,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:300000});const base=await page.evaluate(()=>window.__KAOPU_BASE__);if(base.status!=='candidate-observation')throw new Error(`page failed ${query}: ${base.message}`);const render=await page.evaluate(()=>window.__KAOPU_RENDER__);await page.close();return{base,render};}
function replay(pixel,alphaMaps,source){
 const half=[0,0,0,0],ideal=[0,0,0,0],perStepBound=[0,0,0,0],composedBound=[0,0,0,0],summaries=[];let maxCompositionAbs=0,localViolations=0;
 for(let start=0;start<source.length;start+=BLOCK_SIZE){
  const end=Math.min(source.length,start+BLOCK_SIZE),blockG=[0,0,0,0];let blockT=1;
  for(let i=start;i<end;i++){
   const rec=source[i],a=alphaMaps[rec.alpha][pixel],src=[...rec.color,1];blockT*=1-a;
   for(let ch=0;ch<4;ch++){const u=src[ch]*a+half[ch]*(1-a),q=halfRoundNearestEven(u);if(Math.abs(q.value-u)>q.localBound+EPS)localViolations++;half[ch]=q.value;ideal[ch]=src[ch]*a+ideal[ch]*(1-a);perStepBound[ch]=perStepBound[ch]*(1-a)+q.localBound;blockG[ch]=blockG[ch]*(1-a)+q.localBound;}
  }
  for(let ch=0;ch<4;ch++){composedBound[ch]=composedBound[ch]*blockT+blockG[ch];maxCompositionAbs=Math.max(maxCompositionAbs,Math.abs(composedBound[ch]-perStepBound[ch]));}
  summaries.push(...half,...blockG,blockT);
 }
 return{half,ideal,perStepBound,composedBound,summaries,maxCompositionAbs,localViolations};
}

const captures={};
for(const view of VIEWS){const calibration={};for(const alpha of [1,2,8])calibration[alpha]=await openPage({mode:'calibration',alpha:String(alpha),buffer:'float',cameraZ:String(view.z)});const observed=await openPage({mode:'order',buffer:'default',cameraZ:String(view.z)});captures[view.id]={view,calibration,observed};}
await browser.close();
const source=records(),sourceTokenHash=hashJson(source.map(r=>`${r.alpha}:${r.color.join('')}`)),replays={},alphaMapsByView={},alphaMapHashes={},summaryDigests={},strongKeys={},weakKeys={};
for(const {id,z} of VIEWS){
 const c=captures[id],maps={};for(const alpha of [1,2,8])maps[alpha]=Array.from({length:PIXELS},(_,p)=>c.calibration[alpha].render.allPixels[p*4+3]);alphaMapsByView[id]=maps;
 alphaMapHashes[id]=Object.fromEntries(Object.entries(maps).map(([k,v])=>[k,hashJson(v)]));
 replays[id]=Array.from({length:PIXELS},(_,p)=>replay(p,maps,source));summaryDigests[id]=hashJson(replays[id].flatMap(x=>x.summaries));
 weakKeys[id]=hashJson({...CONTEXT,sourceTokenHash});strongKeys[id]=hashJson({...CONTEXT,sourceTokenHash,cameraPosition:[0,0,z],effectiveAlphaMapHashes:alphaMapHashes[id]});
}
const baselineBounds=replays[BASELINE].map(x=>x.composedBound),stats={};let globalReplayAbs=0,globalLocalViolations=0,globalCompositionAbs=0;
for(const {id,z} of VIEWS){
 const actual=captures[id].observed.render.allPixels,s={view:id,cameraZ:z,sourceRawHash:captures[id].observed.base.spz.rawHash,alphaSequenceHash:captures[id].observed.base.spz.alphaSequenceHash,colorSequenceHash:captures[id].observed.base.spz.colorSequenceHash,alphaMapHashes:alphaMapHashes[id],weakViewInsensitiveKey:weakKeys[id],strongViewKey:strongKeys[id],summaryDigest:summaryDigests[id],recomputedUnderestimatedChannels:0,staleBaselineUnderestimatedChannels:0,minRecomputedSlack:Infinity,minStaleSlack:Infinity,maxActualError:0,maxReplayAbs:0,firstStaleCounterexample:null};
 for(let p=0;p<PIXELS;p++){
  const r=replays[id][p];globalLocalViolations+=r.localViolations;globalCompositionAbs=Math.max(globalCompositionAbs,r.maxCompositionAbs);
  for(let ch=0;ch<4;ch++){
   const obs=actual[p*4+ch],replayAbs=Math.abs(obs-r.half[ch]),actualError=Math.abs(obs-r.ideal[ch]),recomputedSlack=r.composedBound[ch]-actualError,staleSlack=baselineBounds[p][ch]-actualError;
   globalReplayAbs=Math.max(globalReplayAbs,replayAbs);s.maxReplayAbs=Math.max(s.maxReplayAbs,replayAbs);s.maxActualError=Math.max(s.maxActualError,actualError);s.minRecomputedSlack=Math.min(s.minRecomputedSlack,recomputedSlack);s.minStaleSlack=Math.min(s.minStaleSlack,staleSlack);
   if(recomputedSlack < -EPS)s.recomputedUnderestimatedChannels++;
   if(id!==BASELINE&&staleSlack < -EPS){s.staleBaselineUnderestimatedChannels++;if(!s.firstStaleCounterexample)s.firstStaleCounterexample={pixel:p,x:p%WIDTH,y:Math.floor(p/WIDTH),channel:ch,actualError,staleBaselineBound:baselineBounds[p][ch],underestimate:actualError-baselineBounds[p][ch]};}
  }
 }
 stats[id]=s;
}
const allCaptures=Object.values(captures),allPageChecks=allCaptures.every(c=>[...Object.values(c.calibration),c.observed].every(x=>Object.values(x.base.checks).every(Boolean)&&Object.values(x.render.checks).every(Boolean)));
const changed=VIEWS.map(v=>v.id).filter(id=>id!==BASELINE),baselineRaw=stats[BASELINE].sourceRawHash,sourceStable=VIEWS.every(v=>stats[v.id].sourceRawHash===baselineRaw&&stats[v.id].alphaSequenceHash===stats[BASELINE].alphaSequenceHash&&stats[v.id].colorSequenceHash===stats[BASELINE].colorSequenceHash),staleFailures=changed.reduce((n,id)=>n+stats[id].staleBaselineUnderestimatedChannels,0);
const changedAlphaMaps=changed.filter(id=>hashJson(alphaMapHashes[id])!==hashJson(alphaMapHashes[BASELINE])),changedSummaries=changed.filter(id=>summaryDigests[id]!==summaryDigests[BASELINE]),changedStrongKeys=changed.filter(id=>strongKeys[id]!==strongKeys[BASELINE]);
const checks={allPageChecks,sourceBytesAndOrderStable:sourceStable,halfReplayBitExact:globalReplayAbs===0,localHalfGapBoundValid:globalLocalViolations===0,blockCompositionExact:globalCompositionAbs<=1e-12,viewInsensitiveKeyCollision:VIEWS.every(v=>weakKeys[v.id]===weakKeys[BASELINE]),effectiveAlphaMapsInvalidateBothChangedViews:changedAlphaMaps.length===changed.length,strongViewKeysInvalidateBothChangedViews:changedStrongKeys.length===changed.length,recomputedSummariesChangeBothViews:changedSummaries.length===changed.length,recomputedBoundsConservative:VIEWS.every(v=>stats[v.id].recomputedUnderestimatedChannels===0),staleViewReuseRejected:staleFailures>0,outcomeClassified:true};
const result={schema:'kaopu-gaussian-view-cache/r73',status:'Candidate-observation',question:'Can R72/R66 summaries be reused after changing only camera z while source bytes and draw order stay fixed?',sourceLocks:{threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',r72Commit:'a2cd466e6ca92378f105c8507e8f2900f1e3dfb7'},preregistered:{blockSize:BLOCK_SIZE,baseline:{id:BASELINE,cameraZ:2},changedViews:[{id:'near-z1.5',cameraZ:1.5},{id:'far-z2.5',cameraZ:2.5}],onlyChangedInput:'camera position z',negativeControl:'reuse baseline-z2.0 composed bound',positiveControl:'recalibrate effective alpha maps and recompute sequential summaries from true Half checkpoints',weakKey:'renderer/source key without camera or effective-alpha hashes',strongKeyAdds:['camera position','effective alpha-map hashes']},runtime:{threeRevision:captures[BASELINE].observed.base.threeRevision,identity:captures[BASELINE].observed.base.identity,backend:'software WebGL fallback of WebGPURenderer'},analysis:{sourceTokenHash,baseline:{sourceRawHash:baselineRaw,weakViewInsensitiveKey:weakKeys[BASELINE],strongViewKey:strongKeys[BASELINE],alphaMapHashes:alphaMapHashes[BASELINE],summaryDigest:summaryDigests[BASELINE]},byView:stats,globalReplayAbs,globalLocalViolations,globalCompositionAbs,staleUnderestimatedChannels:staleFailures,changedAlphaMaps,changedSummaries,changedStrongKeys},checks,interpretation:{observation:'Changing only camera z changed every calibrated effective-alpha-map digest, strong view key and recomputed summary digest. Recomputed bounds remained conservative, while stale baseline reuse underestimated at least one changed-view channel.',candidate:'Bind exact camera/view state and calibrated effective-alpha maps in the diagnostic-summary key and recompute sequential summaries after either changes.',rejected:'Stable source bytes and draw order, or a renderer/source-only key, is sufficient authority to reuse R66/R72 summaries across camera changes.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{cameraZOnly:true,drawOrderFixed:true,covarianceFixed:true,syntheticRepeatedCenteredSplats:true,dcColorsOnly:true,softwareWebglOnly:true,hardwareGpu:false,webgpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false,motherAdoptionAcknowledged:false}};
result.status=Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail';fs.writeFileSync('r73-comparison.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.status!=='Candidate-pass')process.exitCode=10;
