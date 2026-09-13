import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const N=256;
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
function expectedBytes(values,output){
  const out=Buffer.alloc(N*4);
  for(let i=0;i<N;i++){
    const k=i*4,a=clamp(values[k+3]);
    for(let c=0;c<3;c++){
      const straight=a>0?clamp(values[k+c]/a):0;
      const encoded=output==='srgb'?oetf(straight):straight;
      out[k+c]=Math.round(clamp(encoded*a)*255);
    }
    out[k+3]=Math.round(a*255);
  }
  return out;
}
function byteMetrics(actual,expected){
  let max=0,sum2=0,changed=0,first=null;const per=[0,0,0,0];
  for(let i=0;i<actual.length;i++){
    const d=Math.abs(actual[i]-expected[i]);max=Math.max(max,d);per[i%4]=Math.max(per[i%4],d);sum2+=d*d;
    if(d){changed++;first??={channelIndex:i,pixel:Math.floor(i/4),channel:i%4,actual:actual[i],expected:expected[i],diff:d};}
  }
  return{channels:actual.length,maxCodeDiff:max,rmseCodes:Math.sqrt(sum2/actual.length),changedChannels:changed,perChannelMaxCodeDiff:per,firstDifference:first};
}
function blankTransparent(actual){for(let i=0;i<actual.length;i++)if(actual[i]!==0)return false;return true;}
async function run(output){
  const page=await browser.newPage({viewport:{width:300,height:64},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_webgpu_swapchain_r57.html?output=${output}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__KAOPU_DONE__===true,null,{timeout:300000});
  const result=await page.evaluate(()=>window.__KAOPU_RESULT__);
  if(result.status==='error'){fs.writeFileSync(`r57-${output}.json`,JSON.stringify(result,null,2)+'\n');await page.close();return result;}
  const screenshotBuffer=await page.screenshot({clip:{x:0,y:0,width:N,height:1},omitBackground:true});
  const png=PNG.sync.read(screenshotBuffer),screenshot=Buffer.from(png.data),swapchain=Buffer.from(result.swapchain.rgba),expected=expectedBytes(r55Premultiplied(),output);
  delete result.swapchain.rgba;
  const record={...result,expected:{sha256:sha(expected)},swapchain:{...result.swapchain,metrics:byteMetrics(swapchain,expected),blankTransparentPattern:blankTransparent(swapchain)},screenshot:{location:'Playwright transparent PNG after the immediate copy completed',sha256:sha(screenshot),metricsAgainstExpected:byteMetrics(screenshot,expected),metricsAgainstSwapchain:byteMetrics(screenshot,swapchain),blankTransparentPattern:blankTransparent(screenshot),rgba:Array.from(screenshot)}};
  fs.writeFileSync(`r57-${output}.json`,JSON.stringify(record,null,2)+'\n');await page.close();return record;
}

const runs=[await run('linear'),await run('srgb')];await browser.close();
const successful=runs.filter(r=>r.status==='candidate-observation');
const comparison={schema:'kaopu-three-webgpu-swapchain-comparison/r57',status:'Candidate-observation',fixture:{sampleCount:N,source:'exact R55 stepwise float32 premultiplied output',sourceHash:'0ca00d66d1646fd820cf6fca230460f4dd11b31d05c1a683aa12278603a1e520',rendererOutputColorSpaces:['LinearSRGBColorSpace','SRGBColorSpace'],toneMapping:'NoToneMapping',readback:'same-task GPUCanvasContext current texture copied to MAP_READ buffer after Three renderAsync',screenshotControl:'Playwright transparent PNG after immediate copy'},
  observations:Object.fromEntries(runs.map(r=>[r.outputName||'error',{status:r.status,format:r.contract?.format||null,swapchainHash:r.swapchain?.rgbaHash||null,swapchainMetrics:r.swapchain?.metrics||null,swapchainBlank:r.swapchain?.blankTransparentPattern??null,screenshotHash:r.screenshot?.sha256||null,screenshotMetricsAgainstExpected:r.screenshot?.metricsAgainstExpected||null,screenshotMetricsAgainstSwapchain:r.screenshot?.metricsAgainstSwapchain||null,screenshotBlank:r.screenshot?.blankTransparentPattern??null,error:r.status==='error'?{message:r.message,progress:r.progress}:null}])),
  checks:{twoSuccessfulRuns:successful.length===2,allPageChecks:successful.length===2&&successful.every(r=>Object.values(r.checks).every(Boolean)),sourceLocked:successful.length===2&&successful.every(r=>r.source.hash===r.source.lockedHash),swapchainNotBlank:successful.length===2&&successful.every(r=>r.swapchain.blankTransparentPattern===false),swapchainWithinTwoCodes:successful.length===2&&successful.every(r=>r.swapchain.metrics.maxCodeDiff<=2),linearAndSrgbSwapchainDiffer:successful.length===2&&successful[0].swapchain.rgbaHash!==successful[1].swapchain.rgbaHash,screenshotControlClassified:successful.length===2&&successful.every(r=>typeof r.screenshot.blankTransparentPattern==='boolean')},
  interpretation:{localizationRule:'Only when immediate current-texture bytes match the analytic output while the screenshot remains blank may this fixture localize the R56 blank result after Three output and before/inside screenshot-compositor readback.',sameChromiumSwiftShaderEvidenceRoot:true},limits:{hardwareGpu:false,targetDevice:false,appleSafariWebKit:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
comparison.status=Object.values(comparison.checks).every(Boolean)?'Candidate-pass':'Candidate-fail';
fs.writeFileSync('r57-comparison.json',JSON.stringify(comparison,null,2)+'\n');console.log(JSON.stringify(comparison,null,2));if(comparison.status!=='Candidate-pass')process.exitCode=10;
