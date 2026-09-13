import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const ALPHA_BYTES=[1,2,4,8,16,32,64];
const TARGET_TAUS=[1,2,4,8];
const MAX_SPLATS=4096;
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function floatMetrics(a,b){let maxAbs=0,sum2=0,changed=0,first=null;for(let i=0;i<a.length;i++){const d=Math.abs(Number(a[i])-Number(b[i]));maxAbs=Math.max(maxAbs,d);sum2+=d*d;if(d){changed++;first??={channel:i,a:Number(a[i]),b:Number(b[i]),absDiff:d};}}return{channels:a.length,maxAbs,rmse:Math.sqrt(sum2/a.length),changedChannels:changed,firstDifference:first};}
function byteMetrics(a,b){let max=0,sum2=0,changed=0,first=null;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);sum2+=d*d;if(d){changed++;first??={channelIndex:i,pixel:Math.floor(i/4),channel:i%4,a:a[i],b:b[i],diff:d};}}return{channels:a.length,maxCodeDiff:max,rmseCodes:Math.sqrt(sum2/a.length),changedChannels:changed,firstDifference:first};}
async function openPage(alphaByte,bufferName){
  const page=await browser.newPage({viewport:{width:32,height:32},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_alpha_overlap_r60.html?alpha=${alphaByte}&buffer=${bufferName}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:300000});
  const base=await page.evaluate(()=>window.__KAOPU_BASE__);
  if(base.status!=='candidate-observation')throw new Error(`R60 page failed alpha=${alphaByte} buffer=${bufferName}: ${base.message}`);
  return{page,base};
}
async function renderAndCapture(page,layerCount){
  const sample=await page.evaluate(n=>window.__KAOPU_RENDER__(n),layerCount);
  const shotBuffer=await page.locator('canvas').screenshot({omitBackground:false}),png=PNG.sync.read(shotBuffer),rgba=Buffer.from(png.data);
  return{...sample,presentation:{background:'opaque black page',pngHash:sha(rgba),rgba:Array.from(rgba)}};
}

const calibration=[];
for(const alphaByte of ALPHA_BYTES){
  const {page,base}=await openPage(alphaByte,'float');
  const sample=await renderAndCapture(page,1);
  const centerAlpha=sample.center[3],tauStep=-Math.log1p(-centerAlpha);
  calibration.push({alphaByte,centerAlpha,tauStep,rawSpzHash:base.spz.rawHash,gzipSpzHash:base.spz.gzipHash});
  await page.close();
}
const plans=calibration.map(c=>({alphaByte:c.alphaByte,centerAlpha:c.centerAlpha,tauStep:c.tauStep,cells:TARGET_TAUS.map(targetTau=>{const layerCount=Math.max(1,Math.min(MAX_SPLATS,Math.round(targetTau/c.tauStep)));return{targetTau,layerCount,actualTau:c.tauStep*layerCount,idealOpacity:1-Math.exp(-c.tauStep*layerCount)};})}));
const records=[];
for(const plan of plans){
  for(const bufferName of ['default','float']){
    const {page,base}=await openPage(plan.alphaByte,bufferName),samples=[];
    for(const cell of plan.cells)samples.push({...cell,...await renderAndCapture(page,cell.layerCount)});
    await page.close();
    records.push({base,samples});
  }
}
await browser.close();
function find(alphaByte,bufferName){return records.find(r=>r.base.alphaByte===alphaByte&&r.base.bufferName===bufferName);}
const cells=[];
for(const plan of plans){
  const h=find(plan.alphaByte,'default'),f=find(plan.alphaByte,'float');
  for(const p of plan.cells){
    const hs=h.samples.find(x=>x.targetTau===p.targetTau),fsamp=f.samples.find(x=>x.targetTau===p.targetTau);
    cells.push({alphaByte:plan.alphaByte,targetTau:p.targetTau,layerCount:p.layerCount,tauStep:plan.tauStep,actualTau:p.actualTau,idealOpacity:p.idealOpacity,halfCenter:hs.center,floatCenter:fsamp.center,centerHalfVsFloat:floatMetrics(hs.center,fsamp.center),allPixelsHalfVsFloat:floatMetrics(hs.allPixels,fsamp.allPixels),halfVsIdealCenterAlpha:Math.abs(hs.center[3]-p.idealOpacity),floatVsIdealCenterAlpha:Math.abs(fsamp.center[3]-p.idealOpacity),presentationHalfVsFloat:byteMetrics(hs.presentation.rgba,fsamp.presentation.rgba),halfDecodedHash:hs.decodedHash,floatDecodedHash:fsamp.decodedHash,halfPngHash:hs.presentation.pngHash,floatPngHash:fsamp.presentation.pngHash});
  }
}
const groups=TARGET_TAUS.map(targetTau=>{
  const items=cells.filter(x=>x.targetTau===targetTau),taus=items.map(x=>x.actualTau),errs=items.map(x=>x.centerHalfVsFloat.maxAbs),codes=items.map(x=>x.presentationHalfVsFloat.maxCodeDiff);
  const maxErr=Math.max(...errs),minErr=Math.min(...errs),maxItem=items[errs.indexOf(maxErr)],minItem=items[errs.indexOf(minErr)];
  return{targetTau,cellCount:items.length,actualTauMin:Math.min(...taus),actualTauMax:Math.max(...taus),actualTauRelativeSpread:(Math.max(...taus)-Math.min(...taus))/targetTau,centerErrorMin:minErr,centerErrorMax:maxErr,centerErrorRatio:minErr===0?null:maxErr/minErr,presentationCodeMin:Math.min(...codes),presentationCodeMax:Math.max(...codes),largestError:{alphaByte:maxItem.alphaByte,layerCount:maxItem.layerCount,actualTau:maxItem.actualTau,error:maxErr},smallestError:{alphaByte:minItem.alphaByte,layerCount:minItem.layerCount,actualTau:minItem.actualTau,error:minErr}};
});
const counterexample=groups.filter(g=>g.actualTauRelativeSpread<=0.05&&g.centerErrorMax-g.centerErrorMin>=1e-4).sort((a,b)=>(b.centerErrorMax-b.centerErrorMin)-(a.centerErrorMax-a.centerErrorMin))[0]||null;
const allPageChecks=records.every(r=>Object.values(r.base.checks).every(Boolean)&&r.samples.every(s=>Object.values(s.checks).every(Boolean)));
const sourcePairsSame=ALPHA_BYTES.every(a=>{const h=find(a,'default').base.spz,f=find(a,'float').base.spz;return h.rawHash===f.rawHash&&h.gzipHash===f.gzipHash;});
const result={schema:'kaopu-three-alpha-overlap-comparison/r60',status:'Candidate-observation',question:'Does effective optical depth alone predict HalfFloat-versus-Float accumulation risk in the actual r186 SPZLoader/GaussianSplat path?',fixture:{alphaBytes:ALPHA_BYTES,targetTaus:TARGET_TAUS,maxSplats:MAX_SPLATS,calibration,plans,control:'identical splats control sorting; only alpha byte, layer count and paired output buffer type vary'},runtime:{threeRevision:records[0].base.threeRevision,identity:records[0].base.identity,backend:'software WebGL fallback of WebGPURenderer',source:'actual r186 SPZLoader and GaussianSplat',kernel:'fixed r186 KERNEL_2D_SIZE 0.3',blend:'NormalBlending',output:'SRGBColorSpace / NoToneMapping'},cells,analysis:{groups,sameTauDifferentErrorObserved:Boolean(counterexample),counterexample,opticalDepthAloneAssessment:counterexample?'rejected-as-sole-predictor-in-this-fixture':'not-rejected-in-this-fixture',maxInternalDifference:cells.reduce((a,b)=>b.allPixelsHalfVsFloat.maxAbs>a.allPixelsHalfVsFloat.maxAbs?b:a,cells[0]),maxPresentationDifference:cells.reduce((a,b)=>b.presentationHalfVsFloat.maxCodeDiff>a.presentationHalfVsFloat.maxCodeDiff?b:a,cells[0]),maxFloatIdealCenterError:Math.max(...cells.map(x=>x.floatVsIdealCenterAlpha)),maxHalfIdealCenterError:Math.max(...cells.map(x=>x.halfVsIdealCenterAlpha))},checks:{allPagesSuccessful:records.length===ALPHA_BYTES.length*2,allPageChecks,sourcePairsSame,calibrationComplete:calibration.length===ALPHA_BYTES.length&&calibration.every(x=>x.centerAlpha>0&&x.centerAlpha<1&&x.tauStep>0),gridComplete:cells.length===ALPHA_BYTES.length*TARGET_TAUS.length,countsBounded:cells.every(x=>x.layerCount>=1&&x.layerCount<=MAX_SPLATS),tauGroupsWithinFivePercent:groups.every(g=>g.actualTauRelativeSpread<=0.05),counterexampleTauWithinFivePercent:Boolean(counterexample)&&counterexample.actualTauRelativeSpread<=0.05,internalComparisonsFinite:cells.every(x=>Number.isFinite(x.allPixelsHalfVsFloat.maxAbs)&&Number.isFinite(x.centerHalfVsFloat.maxAbs)),presentationCaptured:cells.every(x=>Number.isFinite(x.presentationHalfVsFloat.maxCodeDiff)),outcomeClassified:Boolean(counterexample)},interpretation:{decisionRule:'Optical depth may describe ideal accumulated opacity, but precision risk also depends on per-write alpha step and finite target spacing. A fixture counterexample is not a real-asset threshold.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{fixtureNumbersAreNotAssetAcceptanceThresholds:true,syntheticIdenticalSplats:true,softwareWebglOnly:true,privateRevisionPinnedProbe:true,hardwareGpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
result.status=Object.values(result.checks).every(Boolean)?'Candidate-pass':'Candidate-fail';
fs.writeFileSync('r60-comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(result.status!=='Candidate-pass')process.exitCode=10;
