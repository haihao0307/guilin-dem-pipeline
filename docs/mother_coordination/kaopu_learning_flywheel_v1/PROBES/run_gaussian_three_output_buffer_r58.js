import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const N=256;
const MODES=['webgl','webgpu'];
const BUFFERS=['default','float'];
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const oetf=x=>x<0.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-0.055;
const clamp=x=>Math.max(0,Math.min(1,x));
const f32=Math.fround;

function r55Premultiplied(){
  const back=new Float32Array(N*4),front=new Float32Array(N*4),out=new Float32Array(N*4);
  for(let i=0;i<N;i++){
    back.set([f32(((i*97+13)%1021+0.37)/1021),f32(((i*193+71)%1021+0.61)/1021),f32(((i*389+127)%1021+0.49)/1021),f32(0.05+0.9*(((i*53+17)%997)/996))],i*4);
    front.set([f32(((i*149+29)%1019+0.73)/1019),f32(((i*307+43)%1019+0.19)/1019),f32(((i*461+83)%1019+0.57)/1019),f32(0.05+0.9*(((i*79+31)%991)/990))],i*4);
  }
  for(let i=0;i<N;i++){
    const k=i*4,ba=back[k+3],fa=front[k+3],oma=f32(1-fa);
    for(let c=0;c<3;c++)out[k+c]=f32(f32(front[k+c]*fa)+f32(f32(back[k+c]*ba)*oma));
    out[k+3]=f32(fa+f32(ba*oma));
  }
  return out;
}
function expectedBlackBytes(values){
  const out=Buffer.alloc(N*4);
  for(let i=0;i<N;i++){
    const k=i*4,a=clamp(values[k+3]);
    for(let c=0;c<3;c++){const straight=a>0?clamp(values[k+c]/a):0;out[k+c]=Math.round(clamp(oetf(straight)*a)*255);}
    out[k+3]=255;
  }
  return out;
}
function byteMetrics(actual,expected,channels=[0,1,2,3]){
  let max=0,sum2=0,changed=0,count=0,first=null;const per=[0,0,0,0];
  for(let i=0;i<actual.length;i++){const c=i%4;if(!channels.includes(c))continue;const d=Math.abs(actual[i]-expected[i]);max=Math.max(max,d);per[c]=Math.max(per[c],d);sum2+=d*d;count++;if(d){changed++;first??={channelIndex:i,pixel:Math.floor(i/4),channel:c,actual:actual[i],expected:expected[i],diff:d};}}
  return{channelsCompared:count,maxCodeDiff:max,rmseCodes:Math.sqrt(sum2/count),changedChannels:changed,perChannelMaxCodeDiff:per,firstDifference:first};
}
function floatMetrics(a,b){let maxAbs=0,sum2=0,changed=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);maxAbs=Math.max(maxAbs,d);sum2+=d*d;if(d)changed++;}return{channels:a.length,maxAbs,rmse:Math.sqrt(sum2/a.length),changedChannels:changed};}
function blackPattern(actual){for(let i=0;i<actual.length;i+=4)if(actual[i]||actual[i+1]||actual[i+2]||actual[i+3]!==255)return false;return true;}

async function run(mode,bufferName){
  const page=await browser.newPage({viewport:{width:300,height:64},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_output_buffer_r58.html?mode=${mode}&buffer=${bufferName}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__KAOPU_DONE__===true,null,{timeout:300000});
  const result=await page.evaluate(()=>window.__KAOPU_RESULT__);
  if(result.status!=='candidate-observation'){fs.writeFileSync(`r58-${mode}-${bufferName}.json`,JSON.stringify(result,null,2)+'\n');await page.close();return result;}
  const decoded=Float32Array.from(result.internalTarget.decoded);delete result.internalTarget.decoded;
  const shotBuffer=await page.screenshot({clip:{x:0,y:0,width:N,height:1},omitBackground:false});
  const png=PNG.sync.read(shotBuffer),shot=Buffer.from(png.data),expected=expectedBlackBytes(decoded);
  const record={...result,internalTarget:{...result.internalTarget,decodedValuesHash:sha(Buffer.from(decoded.buffer))},presentation:{background:'opaque black page',pngHash:sha(shot),blankBlackPattern:blackPattern(shot),rgbMetricsAgainstAnalyticStoredValues:byteMetrics(shot,expected,[0,1,2]),rgba:Array.from(shot)}};
  fs.writeFileSync(`r58-${mode}-${bufferName}.json`,JSON.stringify(record,null,2)+'\n');await page.close();return{...record,_decoded:decoded,_shot:shot};
}

const runs=[];for(const mode of MODES)for(const bufferName of BUFFERS)runs.push(await run(mode,bufferName));await browser.close();
const successful=runs.filter(r=>r.status==='candidate-observation');
const byKey=Object.fromEntries(successful.map(r=>[`${r.actualBackend}-${r.bufferName}`,r]));
function pair(mode){const h=byKey[`${mode}-default`],f=byKey[`${mode}-float`];if(!h||!f)return null;return{internalHalfVsFloat:floatMetrics(h._decoded,f._decoded),canvasHalfVsFloatRgb:byteMetrics(h._shot,f._shot,[0,1,2]),halfInternal:h.internalTarget.metricsAgainstSource,floatInternal:f.internalTarget.metricsAgainstSource,halfCanvas:h.presentation.rgbMetricsAgainstAnalyticStoredValues,floatCanvas:f.presentation.rgbMetricsAgainstAnalyticStoredValues};}
const comparisons={webgl:pair('webgl'),webgpu:pair('webgpu')};
const half=runs.filter(r=>r.status==='candidate-observation'&&r.bufferName==='default'),flt=runs.filter(r=>r.status==='candidate-observation'&&r.bufferName==='float');
const comparison={schema:'kaopu-three-output-buffer-comparison/r58',status:'Candidate-observation',fixture:{sampleCount:N,source:'exact R55 stepwise float32 premultiplied output',sourceHash:'0ca00d66d1646fd820cf6fca230460f4dd11b31d05c1a683aa12278603a1e520',outputColorSpace:'SRGBColorSpace forces the r186 internal framebuffer path',toneMapping:'NoToneMapping',bufferCases:['constructor default omitted (HalfFloatType)','explicit FloatType'],presentation:'opaque-black Playwright PNG; RGB checked separately from internal target'},
  observations:Object.fromEntries(runs.map(r=>[`${r.requestedMode||'unknown'}-${r.bufferName||'unknown'}`,r.status==='candidate-observation'?{actualBackend:r.actualBackend,identity:r.identity,internalTarget:r.internalTarget,presentation:{...r.presentation,rgba:undefined}}:{status:r.status,message:r.message||null}])),comparisons,
  checks:{fourSuccessfulPages:successful.length===4,allPageChecks:successful.length===4&&successful.every(r=>Object.values(r.checks).every(Boolean)),sourceLocked:successful.length===4&&successful.every(r=>r.source.hash===r.source.lockedHash),defaultIsHalfFloat:half.length===2&&half.every(r=>r.internalTarget.rendererOutputBufferType===r.internalTarget.expectedType&&r.internalTarget.rawConstructor==='Uint16Array'),explicitIsFloat:flt.length===2&&flt.every(r=>r.internalTarget.rendererOutputBufferType===r.internalTarget.expectedType&&r.internalTarget.rawConstructor==='Float32Array'),floatPathMatchesSource:flt.length===2&&flt.every(r=>r.internalTarget.metricsAgainstSource.maxAbs<=1e-6),halfPathFiniteAndBounded:half.length===2&&half.every(r=>r.internalTarget.finiteChannels===1024&&r.internalTarget.metricsAgainstSource.maxAbs>0&&r.internalTarget.metricsAgainstSource.maxAbs<=0.0005),webglCanvasClassified:Boolean(comparisons.webgl)&&comparisons.webgl.halfCanvas.maxCodeDiff<=2&&comparisons.webgl.floatCanvas.maxCodeDiff<=2&&comparisons.webgl.canvasHalfVsFloatRgb.maxCodeDiff<=2,webgpuCanvasClassified:Boolean(comparisons.webgpu)&&typeof byKey['webgpu-default'].presentation.blankBlackPattern==='boolean'&&typeof byKey['webgpu-float'].presentation.blankBlackPattern==='boolean'},
  interpretation:{candidate:'For the bounded [0,1] R55 fixture, the r186 default path must be judged from observed RGBA16F storage error separately from the later sRGB/canvas quantization.',counterexample:'A matching or smaller final 8-bit difference cannot prove the internal Float and HalfFloat paths are equivalent.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{fixtureErrorBoundsAreNotAssetAcceptanceThresholds:true,privateRevisionPinnedProbe:true,hardwareGpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
comparison.status=Object.values(comparison.checks).every(Boolean)?'Candidate-pass':'Candidate-fail';
fs.writeFileSync('r58-comparison.json',JSON.stringify(comparison,null,2)+'\n');console.log(JSON.stringify(comparison,null,2));if(comparison.status!=='Candidate-pass')process.exitCode=10;
