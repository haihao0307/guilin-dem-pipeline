import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const ORDERS=['ascending','descending','interleaved','seeded'];
const ALPHA_COUNTS={1:1779,2:114,8:48};
const browser=await chromium.launch({headless:true,args:['--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function metrics(a,b){let maxAbs=0,sum2=0,changed=0,first=null;for(let i=0;i<a.length;i++){const d=Math.abs(Number(a[i])-Number(b[i]));maxAbs=Math.max(maxAbs,d);sum2+=d*d;if(d){changed++;first??={channel:i,a:Number(a[i]),b:Number(b[i]),absDiff:d};}}return{channels:a.length,maxAbs,rmse:Math.sqrt(sum2/a.length),changedChannels:changed,firstDifference:first};}
function byteMetrics(a,b){let max=0,sum2=0,changed=0,first=null;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);max=Math.max(max,d);sum2+=d*d;if(d){changed++;first??={channelIndex:i,pixel:Math.floor(i/4),channel:i%4,a:a[i],b:b[i],diff:d};}}return{channels:a.length,maxCodeDiff:max,rmseCodes:Math.sqrt(sum2/a.length),changedChannels:changed,firstDifference:first};}
async function openPage(params){
  const page=await browser.newPage({viewport:{width:32,height:32},deviceScaleFactor:1}),query=new URLSearchParams(params);
  await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_mixed_alpha_order_r61.html?${query}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__KAOPU_READY__===true,null,{timeout:300000});
  const base=await page.evaluate(()=>window.__KAOPU_BASE__);
  if(base.status!=='candidate-observation')throw new Error(`R61 page failed ${query}: ${base.message}`);
  const render=await page.evaluate(()=>window.__KAOPU_RENDER__);
  const shot=await page.locator('canvas').screenshot({omitBackground:false}),png=PNG.sync.read(shot),rgba=Buffer.from(png.data);
  await page.close();
  return{base,render,presentation:{background:'opaque black page',pngHash:sha(rgba),rgba:Array.from(rgba)}};
}

const calibration=[];
for(const alphaByte of Object.keys(ALPHA_COUNTS).map(Number)){
  const r=await openPage({mode:'calibration',alpha:String(alphaByte),buffer:'float'}),centerAlpha=r.render.center[3];
  calibration.push({alphaByte,centerAlpha,tauStep:-Math.log1p(-centerAlpha),rawSpzHash:r.base.spz.rawHash,gzipSpzHash:r.base.spz.gzipHash});
}
const tau=calibration.reduce((s,c)=>s+ALPHA_COUNTS[c.alphaByte]*c.tauStep,0);
const sumAlphaSquared=calibration.reduce((s,c)=>s+ALPHA_COUNTS[c.alphaByte]*c.centerAlpha*c.centerAlpha,0);
const idealOpacity=1-Math.exp(-tau);
const records=[];
for(const orderName of ORDERS)for(const buffer of ['default','float'])records.push(await openPage({mode:'order',order:orderName,buffer}));
await browser.close();
const find=(order,buffer)=>records.find(r=>r.base.orderName===order&&r.base.bufferName===buffer);
const cells=ORDERS.map(orderName=>{
  const h=find(orderName,'default'),f=find(orderName,'float');
  return{orderName,tau,sumAlphaSquared,idealOpacity,alphaCounts:ALPHA_COUNTS,alphaMultisetHash:h.base.spz.alphaMultisetHash,alphaSequenceHash:h.base.spz.alphaSequenceHash,halfCenter:h.render.center,floatCenter:f.render.center,centerHalfVsFloat:metrics(h.render.center,f.render.center),allPixelsHalfVsFloat:metrics(h.render.allPixels,f.render.allPixels),halfVsIdealCenterAlpha:Math.abs(h.render.center[3]-idealOpacity),floatVsIdealCenterAlpha:Math.abs(f.render.center[3]-idealOpacity),presentationHalfVsFloat:byteMetrics(h.presentation.rgba,f.presentation.rgba),halfDecodedHash:h.render.decodedHash,floatDecodedHash:f.render.decodedHash,halfPngHash:h.presentation.pngHash,floatPngHash:f.presentation.pngHash};
});
const errors=cells.map(c=>c.centerHalfVsFloat.maxAbs),codes=cells.map(c=>c.presentationHalfVsFloat.maxCodeDiff);
const asc=cells.find(c=>c.orderName==='ascending'),desc=cells.find(c=>c.orderName==='descending');
const halfOrderDifference=metrics(asc.halfCenter,desc.halfCenter),floatOrderDifference=metrics(asc.floatCenter,desc.floatCenter);
const allPageChecks=records.every(r=>Object.values(r.base.checks).every(Boolean)&&Object.values(r.render.checks).every(Boolean));
const pairSourcesSame=ORDERS.every(o=>{const h=find(o,'default').base.spz,f=find(o,'float').base.spz;return h.rawHash===f.rawHash&&h.gzipHash===f.gzipHash&&h.alphaSequenceHash===f.alphaSequenceHash;});
const multisetHashes=[...new Set(cells.map(c=>c.alphaMultisetHash))],sequenceHashes=[...new Set(cells.map(c=>c.alphaSequenceHash))];
const result={schema:'kaopu-three-mixed-alpha-order-comparison/r61',status:'Candidate-observation',question:'Does adding sum(alpha^2) to effective optical depth make a sufficient HalfFloat accumulation-risk predictor when mixed-alpha order changes?',fixture:{orders:ORDERS,alphaCounts:ALPHA_COUNTS,calibration,tau,sumAlphaSquared,idealOpacity,control:'identical alpha multiset, geometry, color, scale, rotation, view and output; autoSort=false locks each source sequence'},runtime:{threeRevision:records[0].base.threeRevision,identity:records[0].base.identity,backend:'software WebGL fallback of WebGPURenderer',source:'actual r186 SPZLoader and GaussianSplat',kernel:'fixed r186 KERNEL_2D_SIZE 0.3',blend:'NormalBlending',output:'SRGBColorSpace / NoToneMapping'},cells,analysis:{metricIdenticalAcrossOrders:cells.every(c=>c.tau===tau&&c.sumAlphaSquared===sumAlphaSquared),halfFloatErrorMin:Math.min(...errors),halfFloatErrorMax:Math.max(...errors),halfFloatErrorSpread:Math.max(...errors)-Math.min(...errors),presentationCodeMin:Math.min(...codes),presentationCodeMax:Math.max(...codes),ascendingVsDescending:{halfOrderDifference,floatOrderDifference},sumAlphaSquaredAssessment:'pending',maxFloatIdealCenterError:Math.max(...cells.map(c=>c.floatVsIdealCenterAlpha)),maxHalfIdealCenterError:Math.max(...cells.map(c=>c.halfVsIdealCenterAlpha))},checks:{allPagesSuccessful:records.length===ORDERS.length*2,allPageChecks,pairSourcesSame,calibrationComplete:calibration.length===3&&calibration.every(c=>c.centerAlpha>0&&c.centerAlpha<1),oneMultiset:multisetHashes.length===1,distinctSequences:sequenceHashes.length===ORDERS.length,metricExactlyMatched:cells.every(c=>c.tau===tau&&c.sumAlphaSquared===sumAlphaSquared),floatOrderStable:floatOrderDifference.maxAbs<=1e-5,orderCounterexample:halfOrderDifference.maxAbs>=0.01&&Math.max(...errors)-Math.min(...errors)>=0.01,presentationCaptured:cells.every(c=>Number.isFinite(c.presentationHalfVsFloat.maxCodeDiff)),outcomeClassified:true},interpretation:{decisionRule:'A permutation counterexample with identical tau and sum(alpha^2) rejects that unordered pair as a sufficient precision-risk predictor. It does not reject either statistic as a feature in a richer model.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{fixtureNumbersAreNotAssetAcceptanceThresholds:true,syntheticIdenticalCenteredSplats:true,softwareWebglOnly:true,privateRevisionPinnedProbe:true,hardwareGpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
result.analysis.sumAlphaSquaredAssessment=result.checks.orderCounterexample&&result.checks.metricExactlyMatched&&result.checks.floatOrderStable?'rejected-with-tau-as-sufficient-unordered-predictor-in-this-fixture':'not-rejected-in-this-fixture';
const required=['allPagesSuccessful','allPageChecks','pairSourcesSame','calibrationComplete','oneMultiset','distinctSequences','metricExactlyMatched','floatOrderStable','orderCounterexample','presentationCaptured','outcomeClassified'];
result.status=required.every(k=>result.checks[k]===true)?'Candidate-pass':'Candidate-fail';
fs.writeFileSync('r61-comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(result.status!=='Candidate-pass')process.exitCode=10;

