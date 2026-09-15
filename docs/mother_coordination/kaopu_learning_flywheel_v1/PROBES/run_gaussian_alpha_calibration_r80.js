import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { DataUtils } from 'three';

const WIDTH=33,HEIGHT=33,PIXELS=WIDTH*HEIGHT,CENTER=544;
const COLORS=[0,1,2,4,8,16,32,64,96,128,160,192,224,240,248,252,254,255];
const MODELS=['staged','no_comp','no_prod','no_sum'];
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function halfBracket(value){const lowBits=DataUtils.toHalfFloat(Math.fround(value)),low=DataUtils.fromHalfFloat(lowBits);if(low===value)return{lowBits,low,highBits:lowBits,high:low,gap:0};const highBits=lowBits+1,high=DataUtils.fromHalfFloat(highBits);return{lowBits,low,highBits,high,gap:high-low};}
function halfRoundNearestEven(value){const b=halfBracket(value);if(b.gap===0)return b.low;const dl=value-b.low,dh=b.high-value;if(dl<dh)return b.low;if(dh<dl)return b.high;return(b.lowBits&1)===0?b.low:b.high;}
function blendPre(src,a,dst,model){
  if(model==='staged'){const c=Math.fround(1-a),s=Math.fround(src*a),d=Math.fround(dst*c);return Math.fround(s+d);}
  if(model==='no_comp'){const c=1-a,s=Math.fround(src*a),d=Math.fround(dst*c);return Math.fround(s+d);}
  if(model==='no_prod'){const c=Math.fround(1-a);return Math.fround(src*a+dst*c);}
  if(model==='no_sum'){const c=Math.fround(1-a),s=Math.fround(src*a),d=Math.fround(dst*c);return s+d;}
  throw new Error(model);
}
function step(dst,src,a,model){const pre=blendPre(src,a,dst,model);return{pre,half:halfRoundNearestEven(pre)};}
function compare(a,b){let mismatches=0,maxAbs=0,maxIndex=-1;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d>0)mismatches++;if(d>maxAbs){maxAbs=d;maxIndex=i;}}return{mismatches,maxAbs,maxIndex};}
function alphaPlane(pixels){return Float32Array.from({length:PIXELS},(_,p)=>pixels[p*4+3]);}
async function openAlpha(alpha,kind){const page=await browser.newPage({viewport:{width:64,height:64},deviceScaleFactor:1}),query=new URLSearchParams({alpha:String(alpha),buffer:'float',kind});await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_alpha_calibration_r80.html?${query}`,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:1200000});const base=await page.evaluate(()=>window.__KAOPU_BASE__);if(base.status!=='candidate-observation')throw new Error(`page failed alpha ${alpha}: ${base.message}`);const render=await page.evaluate(()=>window.__KAOPU_RENDER__);await page.close();return{base,render,invocation:query.toString()};}

const observed=[];
for(let alpha=0;alpha<=255;alpha++)observed.push(await openAlpha(alpha,'primary'));
const centerAlpha=observed.map(x=>x.render.allPixels[CENTER*4+3]);

// Derive one fresh complement-rounding candidate from observed calibration only.
const first=[];
for(let alphaByte=0;alphaByte<=255;alphaByte++)for(const colorByte of COLORS){const a=centerAlpha[alphaByte],src=Math.fround(colorByte/255),values=Object.fromEntries(MODELS.map(m=>[m,step(0,src,a,m).half]));if(new Set(Object.values(values)).size===1)first.push({alphaByte,colorByte,dst:values.staged});}
let complementCandidate=null;
outer:for(const f of first)for(let alphaByte2=0;alphaByte2<=255;alphaByte2++)for(const colorByte2 of COLORS){const a=centerAlpha[alphaByte2],src=Math.fround(colorByte2/255),values=Object.fromEntries(MODELS.map(m=>[m,step(f.dst,src,a,m)]));if(values.no_comp.half!==values.staged.half&&values.no_prod.half===values.staged.half&&values.no_sum.half===values.staged.half){complementCandidate={records:[{alphaByte:f.alphaByte,colorByte:f.colorByte},{alphaByte:alphaByte2,colorByte:colorByte2}],centerAlpha:[centerAlpha[f.alphaByte],a],states:values,isolated:true};break outer;}}

const repeatBytes=Array.from(new Set([0,255,...(complementCandidate?complementCandidate.records.map(x=>x.alphaByte):[])]));
const repeats={};for(const alpha of repeatBytes)repeats[alpha]=await openAlpha(alpha,'independent-repeat');
await browser.close();

const entries=observed.map((x,alpha)=>{const plane=alphaPlane(x.render.allPixels);return{alphaByte:alpha,centerAlpha:centerAlpha[alpha],rawHash:x.render.rawHash,decodedHash:x.render.decodedHash,alphaPlaneHash:sha(Buffer.from(plane.buffer))};});
const repeatComparisons=Object.fromEntries(repeatBytes.map(alpha=>[alpha,compare(observed[alpha].render.allPixels,repeats[alpha].render.allPixels)]));
const allPages=[...observed,...Object.values(repeats)],allPageChecks=allPages.every(x=>Object.values(x.base.checks).every(Boolean)&&Object.values(x.render.checks).every(Boolean));
const centerStrictlyIncreasing=centerAlpha.every((v,i)=>i===0||v>centerAlpha[i-1]);
const noHalfTargets=allPages.every(x=>x.base.bufferName==='float'&&x.render.rawConstructor==='Float32Array');
const candidateIsolated=!!complementCandidate&&complementCandidate.states.no_comp.half!==complementCandidate.states.staged.half&&complementCandidate.states.no_prod.half===complementCandidate.states.staged.half&&complementCandidate.states.no_sum.half===complementCandidate.states.staged.half;
const checks={allPageChecks,all256Covered:observed.length===256&&entries.every((x,i)=>x.alphaByte===i),centerStrictlyIncreasing,zeroAtByte0:centerAlpha[0]===0,noHalfTargets,candidateFound:!!complementCandidate,candidateIsolated,independentRepeats:Object.values(repeatComparisons).every(x=>x.mismatches===0)};
const result={schema:'kaopu-gaussian-alpha-calibration/r80',status:Object.values(checks).every(Boolean)?'Candidate-pass':'Candidate-fail',question:'Can a calibration-only r186 cycle freeze the exact center effective Alpha table before deriving a new complement-rounding target fixture?',sourceLocks:{threePackage:'0.186.0',threeTagCommit:'148ef33ecb6d2502ff796d4554abd1549c95d519',threeGaussianSplatBlob:'06d37fe6af583cf8cbdf8bd93565403bc3b94691',r79Commit:'7786e62a113ac8126fc7245ff39b44385b19e8ca'},runtime:{threeRevision:observed[255].base.threeRevision,identity:observed[255].base.identity,backend:'software WebGL fallback of WebGPURenderer'},calibration:{entries,centerTableHash:sha(Buffer.from(new Float32Array(centerAlpha).buffer)),minimumPositive:centerAlpha[1],maximum:centerAlpha[255],repeatBytes,repeatComparisons},derivedCandidate:{status:'Candidate-unrendered-target',search:{alphaBytes:'0..255',colorBytes:COLORS,ordering:'lexicographically first two-record isolated no_comp result',source:'only the frozen observed centerAlpha table'},complementCandidate},checks,interpretation:{observation:'The Float calibration table and selected independent repeats are executable observations. No Half target page exists in this cycle.',candidate:'The derived complement pair is only an input fixture candidate for a later separately preregistered Half target cycle.',rejected:['Approximate Alpha ratios are sufficient for ULP-boundary target fixture selection.','A candidate derived from calibration is already renderer target evidence.'],sameChromiumSwiftShaderEvidenceRoot:true},limits:{calibrationOnly:true,halfTargetRendered:false,fixed45DegreeFootprint:true,centerOnlyCandidateSearch:true,colorSubset:COLORS,softwareWebglOnly:true,hardwareGpu:false,webgpu:false,targetDevice:false,realAsset:false,humanAcceptance:false,motherAdoptionAcknowledged:false}};
fs.writeFileSync('r80-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,centerTableHash:result.calibration.centerTableHash,minimumPositive:result.calibration.minimumPositive,maximum:result.calibration.maximum,repeatBytes,complementCandidate,checks},null,2));if(result.status!=='Candidate-pass')process.exitCode=10;
