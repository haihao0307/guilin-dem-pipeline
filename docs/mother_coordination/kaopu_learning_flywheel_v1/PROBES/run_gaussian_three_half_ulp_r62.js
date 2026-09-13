import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { DataUtils } from 'three';

const LOCKED_ORDERS=['ascending','descending','interleaved','seeded'];
const TARGET_ORDERS=['seed112','seed545'];
const ORDERS=[...LOCKED_ORDERS,...TARGET_ORDERS];
const ALPHA_COUNTS={1:1779,2:114,8:48};
const R61_CENTERS={ascending:{half:0.9912109375,float:0.9996616840362549},descending:{half:0.9267578125,float:0.9996613264083862},interleaved:{half:0.9267578125,float:0.9996613264083862},seeded:{half:0.97900390625,float:0.9996615052223206}};
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function xorshift32(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function sequence(orderName){
  const ascending=Object.entries(ALPHA_COUNTS).flatMap(([a,n])=>Array(n).fill(Number(a)));
  if(orderName==='ascending')return ascending;
  if(orderName==='descending')return [...ascending].reverse();
  if(orderName==='interleaved'){
    const left=new Map(Object.entries(ALPHA_COUNTS).map(([a,n])=>[Number(a),n])),out=[];
    while(out.length<ascending.length)for(const a of [1,2,8])if(left.get(a)>0){out.push(a);left.set(a,left.get(a)-1);}
    return out;
  }
  const seed=orderName==='seed112'?112:orderName==='seed545'?545:0x4b41504f;
  const out=[...ascending],rand=xorshift32(seed);
  for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function nextHalfUp(value){
  const bits=DataUtils.toHalfFloat(value);
  return DataUtils.fromHalfFloat(bits+1);
}
function toHalfRoundNearestEven(value){
  // r186 DataUtils.toHalfFloat is a truncating storage packer. GPU Half targets
  // use round-to-nearest behavior, so bracket with official decode values and
  // select the nearest representable Half; exact ties choose an even low bit.
  const lowBits=DataUtils.toHalfFloat(Math.fround(value));
  const low=DataUtils.fromHalfFloat(lowBits);
  if(low===value)return low;
  const highBits=lowBits+1,high=DataUtils.fromHalfFloat(highBits);
  const lowDistance=value-low,highDistance=high-value;
  if(lowDistance<highDistance)return low;
  if(highDistance<lowDistance)return high;
  return (lowBits&1)===0?low:high;
}
function replay(orderName,alphas){
  let half=0,float=0,atOrBelowHalfUlpCount=0,exactStallCount=0,firstAtOrBelowHalfUlp=null,firstExactStall=null;
  const seq=sequence(orderName);
  for(let i=0;i<seq.length;i++){
    const alpha=alphas[seq[i]],increment=alpha*(1-half),upUlp=nextHalfUp(half)-half;
    if(increment<=0.5*upUlp){atOrBelowHalfUlpCount++;if(firstAtOrBelowHalfUlp===null)firstAtOrBelowHalfUlp=i;}
    const nextHalf=toHalfRoundNearestEven(alpha+half*(1-alpha));
    if(nextHalf===half){exactStallCount++;if(firstExactStall===null)firstExactStall=i;}
    half=nextHalf;
    float=Math.fround(alpha+Math.fround(float*(1-alpha)));
  }
  return{orderName,writes:seq.length,atOrBelowHalfUlpCount,exactStallCount,firstAtOrBelowHalfUlp,firstExactStall,half,float};
}
async function openPage(params){
  const page=await browser.newPage({viewport:{width:32,height:32},deviceScaleFactor:1}),query=new URLSearchParams(params);
  await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_half_ulp_r62.html?${query}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:300000});
  const base=await page.evaluate(()=>window.__KAOPU_BASE__);if(base.status!=='candidate-observation')throw new Error(`R62 page failed ${query}: ${base.message}`);
  const render=await page.evaluate(()=>window.__KAOPU_RENDER__);await page.close();return{base,render};
}

const calibration=[];
for(const alphaByte of Object.keys(ALPHA_COUNTS).map(Number)){const r=await openPage({mode:'calibration',alpha:String(alphaByte),buffer:'float'});calibration.push({alphaByte,centerAlpha:r.render.center[3]});}
const alphaByByte=Object.fromEntries(calibration.map(x=>[x.alphaByte,x.centerAlpha]));
const records=[];for(const orderName of ORDERS)for(const buffer of ['default','float'])records.push(await openPage({mode:'order',order:orderName,buffer}));
await browser.close();
const find=(order,buffer)=>records.find(r=>r.base.orderName===order&&r.base.bufferName===buffer);
const cells=ORDERS.map(orderName=>{const h=find(orderName,'default'),f=find(orderName,'float'),sim=replay(orderName,alphaByByte);return{orderName,sequenceHash:h.base.spz.alphaSequenceHash,halfObserved:h.render.center[3],floatObserved:f.render.center[3],simulation:sim,halfReplayAbsError:Math.abs(h.render.center[3]-sim.half),floatReplayAbsError:Math.abs(f.render.center[3]-sim.float)};});
const target=cells.filter(c=>TARGET_ORDERS.includes(c.orderName));
const countCollision=target[0].simulation.atOrBelowHalfUlpCount===target[1].simulation.atOrBelowHalfUlpCount;
const observedOutputDivergence=Math.abs(target[0].halfObserved-target[1].halfObserved);
const checks={allPageChecks:records.every(r=>Object.values(r.base.checks).every(Boolean)&&Object.values(r.render.checks).every(Boolean)),distinctSequences:new Set(cells.map(c=>c.sequenceHash)).size===ORDERS.length,lockedR61Reproduced:cells.filter(c=>LOCKED_ORDERS.includes(c.orderName)).every(c=>c.halfObserved===R61_CENTERS[c.orderName].half&&c.floatObserved===R61_CENTERS[c.orderName].float),halfReplayExact:cells.every(c=>c.halfReplayAbsError===0),floatReplayClose:cells.every(c=>c.floatReplayAbsError<=1e-6),thresholdCountEqualsExactStalls:cells.every(c=>c.simulation.atOrBelowHalfUlpCount===c.simulation.exactStallCount&&c.simulation.firstAtOrBelowHalfUlp===c.simulation.firstExactStall),targetCountCollision:countCollision,targetObservedOutputDivergence:observedOutputDivergence>=0.001,outcomeClassified:true};
const result={schema:'kaopu-three-half-ulp/r62',status:'Candidate-observation',question:'Can the predeclared count of source-over writes whose increment is at or below half the current upward Half ULP explain the locked R61 orders and survive a targeted same-count counterexample?',sourceLocks:{threePackage:'0.186.0',r61ResultCommit:'d0ad7a38829b1cabbc64422daec39ebf61e1c499'},fixture:{alphaCounts:ALPHA_COUNTS,calibration,lockedOrders:LOCKED_ORDERS,targetedOrders:{seed112:112,seed545:545},selectionRule:'deterministic same-multiset xorshift32 permutations selected because the predeclared count collides while simulated final Half differs'},runtime:{threeRevision:records[0].base.threeRevision,identity:records[0].base.identity,backend:'software WebGL fallback of WebGPURenderer',source:'actual r186 SPZLoader and GaussianSplat; official DataUtils.fromHalfFloat decode plus bracketed IEEE nearest-even replay',blend:'NormalBlending'},cells,analysis:{targetSameCount:target[0].simulation.atOrBelowHalfUlpCount,targetHalfObserved:[target[0].halfObserved,target[1].halfObserved],targetHalfObservedAbsDifference:observedOutputDivergence,assessment:countCollision&&observedOutputDivergence>=0.001?'rejected-as-sufficient-order-sensitive-predictor':'not-rejected-in-this-bounded-test',stepMechanismAssessment:checks.halfReplayExact&&checks.thresholdCountEqualsExactStalls?'confirmed-for-six-locked-sequences':'not-confirmed'},checks,interpretation:{observation:'The threshold identifies exact Half stalls in these six sequences and exact nearest-even Half replay reproduces the renderer center.',rejected:['The total count alone is not sufficient: equal counts can end at different Half values.','The truncating r186 DataUtils.toHalfFloat packer is not an exact model of GPU Half-target blending.'],candidate:'Keep sequential replay or an equivalently order-sensitive state trace for validation; do not promote a universal threshold.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{syntheticCenteredSplats:true,softwareWebglOnly:true,privateRevisionPinnedProbe:true,hardwareGpu:false,webgpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
const required=Object.keys(checks);result.status=required.every(k=>checks[k]===true)?'Candidate-pass':'Candidate-fail';
fs.writeFileSync('r62-comparison.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.status!=='Candidate-pass')process.exitCode=10;
