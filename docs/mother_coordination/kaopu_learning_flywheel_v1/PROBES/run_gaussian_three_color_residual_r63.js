import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { DataUtils } from 'three';

const CASES=['blocked','cycled','seeded'];
const ALPHA_COUNTS={1:1779,2:114,8:48};
const CHECKPOINTS=new Set([0,255,511,1023,1535,1940]);
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function xorshift32(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}
function shuffle(out,seed){const rand=xorshift32(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function alphaSequence(){return shuffle(Object.entries(ALPHA_COUNTS).flatMap(([a,n])=>Array(n).fill(Number(a))),0x4b41504f);}
function colorSequence(name){
  const R=[1,0,0],G=[0,1,0],B=[0,0,1],n=647;
  if(name==='blocked')return [...Array(n).fill(R),...Array(n).fill(G),...Array(n).fill(B)];
  if(name==='cycled')return Array.from({length:n},()=>[R,G,B]).flat();
  if(name==='seeded')return shuffle([...Array(n).fill(R),...Array(n).fill(G),...Array(n).fill(B)],0x52474263);
  throw new Error(`unknown color case ${name}`);
}
function halfRoundNearestEven(value){
  const lowBits=DataUtils.toHalfFloat(Math.fround(value)),low=DataUtils.fromHalfFloat(lowBits);
  if(low===value)return{bits:lowBits,value:low};
  const highBits=lowBits+1,high=DataUtils.fromHalfFloat(highBits),dl=value-low,dh=high-value;
  if(dl<dh)return{bits:lowBits,value:low};if(dh<dl)return{bits:highBits,value:high};return(lowBits&1)===0?{bits:lowBits,value:low}:{bits:highBits,value:high};
}
function replay(name,alphaByByte){
  const alphas=alphaSequence(),colors=colorSequence(name),half=[0,0,0,0],float=[0,0,0,0],ideal=[0,0,0,0],propagated=[0,0,0,0],signedLocal=[0,0,0,0],absoluteLocal=[0,0,0,0],nonzero=[0,0,0,0],checkpoints=[];
  let alphaStalls=0;const trace=Buffer.alloc(alphas.length*40);
  for(let i=0;i<alphas.length;i++){
    const a=alphaByByte[alphas[i]],src=[...colors[i],1],local=[0,0,0,0],previousAlpha=half[3];
    for(let ch=0;ch<4;ch++){
      const unrounded=src[ch]*a+half[ch]*(1-a),q=halfRoundNearestEven(unrounded),residual=q.value-unrounded;
      half[ch]=q.value;ideal[ch]=src[ch]*a+ideal[ch]*(1-a);float[ch]=Math.fround(src[ch]*a+Math.fround(float[ch]*(1-a)));propagated[ch]=propagated[ch]*(1-a)+residual;signedLocal[ch]+=residual;absoluteLocal[ch]+=Math.abs(residual);if(residual!==0)nonzero[ch]++;local[ch]=residual;
      trace.writeUInt16LE(q.bits,i*40+ch*2);trace.writeDoubleLE(residual,i*40+8+ch*8);
    }
    if(half[3]===previousAlpha)alphaStalls++;
    if(CHECKPOINTS.has(i))checkpoints.push({write:i+1,alphaByte:alphas[i],color:colors[i],half:[...half],localResidual:local,propagatedResidual:[...propagated]});
  }
  const halfMinusIdeal=half.map((v,i)=>v-ideal[i]),decompositionAbsError=halfMinusIdeal.map((v,i)=>Math.abs(v-propagated[i]));
  return{name,writes:alphas.length,half,float,ideal,halfMinusIdeal,propagatedResidual:propagated,decompositionAbsError,signedLocalResidual:signedLocal,absoluteLocalResidual:absoluteLocal,nonzeroResidualWrites:nonzero,alphaStalls,traceSha256:sha(trace),checkpoints};
}
function numericMetrics(a,b,channels=a.length){let maxAbs=0,changed=0;for(let i=0;i<channels;i++){const d=Math.abs(a[i]-b[i]);maxAbs=Math.max(maxAbs,d);if(d)changed++;}return{channels,maxAbs,changedChannels:changed};}
function byteMetrics(a,b){let maxCodeDiff=0,changed=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);maxCodeDiff=Math.max(maxCodeDiff,d);if(d)changed++;}return{channels:a.length,maxCodeDiff,changedChannels:changed};}
async function openPage(params){
  const page=await browser.newPage({viewport:{width:32,height:32},deviceScaleFactor:1}),query=new URLSearchParams(params);
  await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_color_residual_r63.html?${query}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:300000});
  const base=await page.evaluate(()=>window.__KAOPU_BASE__);if(base.status!=='candidate-observation')throw new Error(`R63 page failed ${query}: ${base.message}`);
  const render=await page.evaluate(()=>window.__KAOPU_RENDER__),png=PNG.sync.read(await page.locator('canvas').screenshot({omitBackground:false})),rgba=Buffer.from(png.data);await page.close();return{base,render,presentation:{rgba:Array.from(rgba),sha256:sha(rgba)}};
}

const calibration=[];for(const alphaByte of Object.keys(ALPHA_COUNTS).map(Number)){const r=await openPage({mode:'calibration',alpha:String(alphaByte),buffer:'float'});calibration.push({alphaByte,centerAlpha:r.render.center[3]});}
const alphaByByte=Object.fromEntries(calibration.map(x=>[x.alphaByte,x.centerAlpha])),records=[];
for(const colorCase of CASES)for(const buffer of ['default','float'])records.push(await openPage({mode:'order',case:colorCase,buffer}));
await browser.close();
const find=(colorCase,buffer)=>records.find(r=>r.base.colorCase===colorCase&&r.base.bufferName===buffer);
const cells=CASES.map(colorCase=>{const h=find(colorCase,'default'),f=find(colorCase,'float'),simulation=replay(colorCase,alphaByByte),halfObserved=h.render.center,floatObserved=f.render.center;return{colorCase,alphaSequenceHash:h.base.spz.alphaSequenceHash,colorSequenceHash:h.base.spz.colorSequenceHash,colorMultisetHash:h.base.spz.colorMultisetHash,halfObserved,floatObserved,halfVsFloat:numericMetrics(halfObserved,floatObserved),rgbHalfVsFloat:numericMetrics(halfObserved,floatObserved,3),presentationHalfVsFloat:byteMetrics(h.presentation.rgba,f.presentation.rgba),halfPresentationHash:h.presentation.sha256,floatPresentationHash:f.presentation.sha256,simulation,halfReplay:numericMetrics(halfObserved,simulation.half),floatReplay:numericMetrics(floatObserved,simulation.float),halfFloatDecompositionMaxAbs:Math.max(...halfObserved.map((v,i)=>Math.abs((v-floatObserved[i])-(simulation.propagatedResidual[i]+simulation.ideal[i]-floatObserved[i]))))};});
const rgbErrors=cells.map(c=>c.rgbHalfVsFloat.maxAbs),alphaStates=cells.map(c=>JSON.stringify({half:c.simulation.half[3],ideal:c.simulation.ideal[3],stalls:c.simulation.alphaStalls,prop:c.simulation.propagatedResidual[3]}));
const checks={allPageChecks:records.every(r=>Object.values(r.base.checks).every(Boolean)&&Object.values(r.render.checks).every(Boolean)),sameAlphaSequence:new Set(cells.map(c=>c.alphaSequenceHash)).size===1,sameColorMultiset:new Set(cells.map(c=>c.colorMultisetHash)).size===1,distinctColorSequences:new Set(cells.map(c=>c.colorSequenceHash)).size===CASES.length,halfReplayBitExact:cells.every(c=>c.halfReplay.maxAbs===0),floatReplayClose:cells.every(c=>c.floatReplay.maxAbs<=1e-6),propagatedResidualIdentity:cells.every(c=>Math.max(...c.simulation.decompositionAbsError)<=1e-12&&c.halfFloatDecompositionMaxAbs<=1e-12),alphaTraceIdentical:new Set(alphaStates).size===1,mixedColorAlphaOnlyCounterexample:Math.max(...rgbErrors)-Math.min(...rgbErrors)>=0.001,presentationCaptured:cells.every(c=>Number.isFinite(c.presentationHalfVsFloat.maxCodeDiff)),outcomeClassified:true};
const result={schema:'kaopu-three-color-residual/r63',status:'Candidate-observation',question:'Can a per-channel signed propagated rounding-residual trace explain mixed-color Half divergence that an identical alpha-only trace cannot?',sourceLocks:{threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',r62Commit:'93433ea36a9d1364805a15b1b0cf9c319ea84387'},fixture:{alphaCounts:ALPHA_COUNTS,alphaOrder:'fixed xorshift32 seed 0x4b41504f for every case',colorCounts:{red:647,green:647,blue:647},colorCases:{blocked:'647 red, then 647 green, then 647 blue',cycled:'RGB repeated 647 times',seeded:'same color multiset shuffled with xorshift32 seed 0x52474263'},calibration,control:'same alpha sequence and color multiset; only color assignment order changes'},runtime:{threeRevision:records[0].base.threeRevision,identity:records[0].base.identity,backend:'software WebGL fallback of WebGPURenderer',source:'actual r186 SPZLoader and GaussianSplat',blend:'NormalBlending',output:'SRGBColorSpace / NoToneMapping'},cells,analysis:{rgbHalfFloatErrorMin:Math.min(...rgbErrors),rgbHalfFloatErrorMax:Math.max(...rgbErrors),rgbHalfFloatErrorSpread:Math.max(...rgbErrors)-Math.min(...rgbErrors),alphaOnlyAssessment:checks.mixedColorAlphaOnlyCounterexample?'rejected-as-sufficient-for-rgb-precision':'not-rejected-in-this-bounded-test',signedPropagatedResidualAssessment:checks.halfReplayBitExact&&checks.propagatedResidualIdentity?'confirmed-as-exact-decomposition-for-three-locked-cases':'not-confirmed'},checks,interpretation:{observation:'The signed propagated local Half residual exactly decomposes Half-minus-ideal per channel, and nearest-even replay matches actual Half centers.',rejected:'An identical alpha sequence, alpha state trace and color multiset are sufficient to predict RGB precision.',candidate:'Retain ordered per-channel state or the signed propagated residual trace for diagnostics; no compact universal threshold is established.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{traceIsDiagnosticReplayNotPhysicalTruth:true,syntheticCenteredSplats:true,softwareWebglOnly:true,privateRevisionPinnedProbe:true,hardwareGpu:false,webgpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
result.status=Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail';fs.writeFileSync('r63-comparison.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(result.status!=='Candidate-pass')process.exitCode=10;

