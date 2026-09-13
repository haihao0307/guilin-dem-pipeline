import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function floatMetrics(a,b){let maxAbs=0,sum2=0,changed=0,first=null;for(let i=0;i<a.length;i++){const d=Math.abs(Number(a[i])-Number(b[i]));maxAbs=Math.max(maxAbs,d);sum2+=d*d;if(d){changed++;first??={channel:i,a:Number(a[i]),b:Number(b[i]),absDiff:d};}}return{channels:a.length,maxAbs,rmse:Math.sqrt(sum2/a.length),changedChannels:changed,firstDifference:first};}
function byteMetrics(a,b){let max=0,sum2=0,changed=0,first=null;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);sum2+=d*d;if(d){changed++;first??={channelIndex:i,pixel:Math.floor(i/4),channel:i%4,a:a[i],b:b[i],diff:d};}}return{channels:a.length,maxCodeDiff:max,rmseCodes:Math.sqrt(sum2/a.length),changedChannels:changed,firstDifference:first};}
async function run(bufferName){
  const page=await browser.newPage({viewport:{width:32,height:32},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_spz_accumulation_r59.html?buffer=${bufferName}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__KAOPU_DONE__===true,null,{timeout:300000});
  const result=await page.evaluate(()=>window.__KAOPU_RESULT__);
  const shotBuffer=await page.screenshot({clip:{x:0,y:0,width:3,height:3},omitBackground:false}),png=PNG.sync.read(shotBuffer),shot=Buffer.from(png.data);
  const record={...result,presentation:{layerCount:4096,background:'opaque black page',pngHash:sha(shot),rgba:Array.from(shot)}};
  fs.writeFileSync(`r59-${bufferName}.json`,JSON.stringify(record,null,2)+'\n');await page.close();return record;
}
const half=await run('default'),flt=await run('float');await browser.close();
function sampleMap(r){return new Map((r.samples||[]).map(x=>[x.layerCount,x]));}
const hm=sampleMap(half),fm=sampleMap(flt),layers=half.render?.layers||[];
const paired=layers.map(n=>{const h=hm.get(n),f=fm.get(n);return{layerCount:n,allPixels:floatMetrics(h.allPixels,f.allPixels),center:floatMetrics(h.center,f.center),halfCenter:h.center,floatCenter:f.center};});
const first=paired[0],last=paired.at(-1),maxPair=paired.reduce((a,b)=>b.allPixels.maxAbs>a.allPixels.maxAbs?b:a,paired[0]);
const half2048=hm.get(2048)?.center||[],half4096=hm.get(4096)?.center||[],float2048=fm.get(2048)?.center||[],float4096=fm.get(4096)?.center||[];
const halfTail=floatMetrics(half2048,half4096),floatTail=floatMetrics(float2048,float4096);
const presentation=half.presentation&&flt.presentation?byteMetrics(half.presentation.rgba,flt.presentation.rgba):null;
let accumulationClass='unclassified';
if(first&&last){if(last.allPixels.maxAbs>first.allPixels.maxAbs)accumulationClass='difference-grows-beyond-single-layer';else if(last.allPixels.maxAbs===first.allPixels.maxAbs)accumulationClass='difference-does-not-grow-at-sampled-layers';else accumulationClass='difference-decreases-at-final-layer';}
for(const x of paired){delete x.halfCenter;delete x.floatCenter;}
const comparison={schema:'kaopu-three-spz-accumulation-comparison/r59',status:'Candidate-observation',fixture:{source:'deterministic gzip SPZ v3 parsed by actual Three.js r186 SPZLoader and rendered by actual GaussianSplat',rawSpzHash:half.spz?.rawHash||null,gzipSpzHash:half.spz?.gzipHash||null,count:4096,alphaByte:2,identicalSplats:true,sortOrderEffect:'controlled out by identical splats',layers},
  half:{status:half.status,identity:half.identity,spz:half.spz,geometry:half.geometry,splat:half.splat,render:half.render,checks:half.checks,samples:(half.samples||[]).map(x=>({layerCount:x.layerCount,center:x.center,range:x.range,decodedHash:x.decodedHash})),presentation:{...half.presentation,rgba:undefined}},
  float:{status:flt.status,identity:flt.identity,spz:flt.spz,geometry:flt.geometry,splat:flt.splat,render:flt.render,checks:flt.checks,samples:(flt.samples||[]).map(x=>({layerCount:x.layerCount,center:x.center,range:x.range,decodedHash:x.decodedHash})),presentation:{...flt.presentation,rgba:undefined}},
  paired,analysis:{accumulationClass,firstLayerMaxAbs:first?.allPixels.maxAbs??null,finalLayerMaxAbs:last?.allPixels.maxAbs??null,maxSampledDifference:{layerCount:maxPair?.layerCount??null,maxAbs:maxPair?.allPixels.maxAbs??null},half2048To4096:halfTail,float2048To4096:floatTail,halfFixedAtTail:halfTail.maxAbs===0,floatStillChangesAtTail:floatTail.maxAbs>0,presentationHalfVsFloat:presentation},
  checks:{twoSuccessfulPages:half.status==='candidate-observation'&&flt.status==='candidate-observation',allPageChecks:[half,flt].every(r=>r.checks&&Object.values(r.checks).every(Boolean)),sameLockedSpz:half.spz?.rawHash===flt.spz?.rawHash&&half.spz?.gzipHash===flt.spz?.gzipHash,actualLoaderAndSplat:[half,flt].every(r=>r.spz?.container.includes('parsed by r186 SPZLoader')&&r.splat?.isGaussianSplat===true),normalBlendAndSortControlled:[half,flt].every(r=>r.checks?.normalBlendPath&&r.checks?.sortControlled),pairedLayerGradient:paired.length===10&&paired.every(x=>Number.isFinite(x.allPixels.maxAbs)&&Number.isFinite(x.center.maxAbs)),accumulationOutcomeClassified:accumulationClass!=='unclassified',tailBehaviorClassified:Number.isFinite(halfTail.maxAbs)&&Number.isFinite(floatTail.maxAbs),presentationCaptured:Boolean(presentation)&&Number.isFinite(presentation.maxCodeDiff)},
  interpretation:{currentBestViewCorrection:'HalfFloat remains the unmodified validation start, not a proven delivery preference. Float is the paired counterfactual.',decisionRule:'Only actual accumulation evidence can extend R58 single-write bounds; fixture results remain separate from real assets and human acceptance.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{fixtureNumbersAreNotAssetAcceptanceThresholds:true,softwareWebglOnly:true,hardwareGpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
comparison.status=Object.values(comparison.checks).every(Boolean)?'Candidate-pass':'Candidate-fail';
fs.writeFileSync('r59-comparison.json',JSON.stringify(comparison,null,2)+'\n');console.log(JSON.stringify(comparison,null,2));if(comparison.status!=='Candidate-pass')process.exitCode=10;
