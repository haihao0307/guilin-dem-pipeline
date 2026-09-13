import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});

async function run(mode){
  const page=await browser.newPage({viewport:{width:300,height:64}});
  let pageError=null,rejectPageError;const pageErrorPromise=new Promise((_,reject)=>{rejectPageError=reject;});
  page.on('console',msg=>console.log(`[browser:r54:${mode}] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror',e=>{pageError||=e;rejectPageError(e);console.error(`[browser:r54:${mode}] ${e.stack||e}`);});
  const url=`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_float_final_color_r54.html?mode=${mode}`;
  let result;
  try{
    await page.goto(url,{waitUntil:'load',timeout:120000});if(pageError)throw pageError;
    await Promise.race([page.waitForFunction(()=>window.__KAOPU_DONE__===true,null,{timeout:300000}),pageErrorPromise]);
    result=await page.evaluate(()=>window.__KAOPU_RESULT__);
  }catch(error){result={schema:'kaopu-three-float-final-color-runner/r54',status:'runner-error',requestedMode:mode,message:String(error?.message||error),stack:String(error?.stack||'')};}
  await page.close();
  fs.writeFileSync(`r54-result-${mode}.json`,JSON.stringify(result,null,2)+'\n');
  return result;
}

const webgl=await run('webgl');
const webgpu=await run('webgpu');
await browser.close();

const comparison={
  schema:'kaopu-three-float-final-color-comparison/r54',
  status:'candidate-observation',
  webgl:{status:webgl.status,actualBackend:webgl.actualBackend,identity:webgl.identity,summary:webgl.summary,checks:webgl.checks},
  webgpu:{status:webgpu.status,actualBackend:webgpu.actualBackend,identity:webgpu.identity,summary:webgpu.summary,checks:webgpu.checks},
  crossBackend:{
    floatTargetHashEqual:webgl.summary?.floatTargetSha256===webgpu.summary?.floatTargetSha256,
    finalTargetHashEqual:webgl.summary?.finalTargetSha256===webgpu.summary?.finalTargetSha256,
    maxAbsDelta:(webgl.summary&&webgpu.summary)?Math.abs(webgl.summary.maxAbs-webgpu.summary.maxAbs):null,
    rmseDelta:(webgl.summary&&webgpu.summary)?Math.abs(webgl.summary.rmse-webgpu.summary.rmse):null,
  },
  checks:{
    webglPass:webgl.status==='candidate-observation'&&webgl.actualBackend==='webgl'&&Object.values(webgl.checks||{}).every(Boolean),
    webgpuPass:webgpu.status==='candidate-observation'&&webgpu.actualBackend==='webgpu'&&Object.values(webgpu.checks||{}).every(Boolean),
    sameThreeRevision:String(webgl.threeRevision)==='186'&&String(webgpu.threeRevision)==='186',
    sameFixture:webgl.fixture?.sampleCount===256&&webgpu.fixture?.sampleCount===256,
  },
  limits:{hardwareGpu:false,targetDevice:false,browserPresentationSurface:false,gaussianBlendPath:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}
};
comparison.status=Object.values(comparison.checks).every(Boolean)?'Candidate-pass':'Candidate-fail';
comparison.interpretation='Stable-pixel direct TSL storage test: compare an offscreen RGBA32F render target with an offscreen RGBA8 target under explicit no-tone-map/no-target-color-space state. This isolates storage quantization from Gaussian cutoff and presentation transforms; it is not yet the blended splat or browser display path.';
fs.writeFileSync('r54-comparison.json',JSON.stringify(comparison,null,2)+'\n');
console.log(JSON.stringify(comparison,null,2));
if(comparison.status!=='Candidate-pass')process.exitCode=10;
