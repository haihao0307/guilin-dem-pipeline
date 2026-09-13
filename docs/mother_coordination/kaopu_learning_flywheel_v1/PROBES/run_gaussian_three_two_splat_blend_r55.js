import fs from 'node:fs';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
async function run(mode){
  const page=await browser.newPage({viewport:{width:300,height:64}});let pageError=null,rejectPageError;const pageErrorPromise=new Promise((_,reject)=>{rejectPageError=reject;});
  page.on('console',msg=>console.log(`[browser:r55:${mode}] ${msg.type()}: ${msg.text()}`));page.on('pageerror',e=>{pageError||=e;rejectPageError(e);console.error(`[browser:r55:${mode}] ${e.stack||e}`);});
  const url=`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_two_splat_blend_r55.html?mode=${mode}`;let result;
  try{await page.goto(url,{waitUntil:'load',timeout:120000});if(pageError)throw pageError;await Promise.race([page.waitForFunction(()=>window.__KAOPU_DONE__===true,null,{timeout:300000}),pageErrorPromise]);result=await page.evaluate(()=>window.__KAOPU_RESULT__);}catch(error){result={schema:'kaopu-three-two-splat-blend-runner/r55',status:'runner-error',requestedMode:mode,message:String(error?.message||error),stack:String(error?.stack||'')};}
  await page.close();fs.writeFileSync(`r55-result-${mode}.json`,JSON.stringify(result,null,2)+'\n');return result;
}
const webgl=await run('webgl'),webgpu=await run('webgpu');await browser.close();
const comparison={schema:'kaopu-three-two-splat-blend-comparison/r55',status:'candidate-observation',
  webgl:{status:webgl.status,actualBackend:webgl.actualBackend,identity:webgl.identity,fixture:webgl.fixture,summary:webgl.summary,checks:webgl.checks},
  webgpu:{status:webgpu.status,actualBackend:webgpu.actualBackend,identity:webgpu.identity,fixture:webgpu.fixture,summary:webgpu.summary,checks:webgpu.checks},
  crossBackend:{inputHashEqual:webgl.summary?.hashes?.inputs===webgpu.summary?.hashes?.inputs,byteHashEqual:webgl.summary?.hashes?.byte===webgpu.summary?.hashes?.byte,referenceBlendErrorDelta:(webgl.summary&&webgpu.summary)?Math.abs(webgl.summary.referenceVsByte.maxAbs-webgpu.summary.referenceVsByte.maxAbs):null},
  checks:{webglPass:webgl.status==='candidate-observation'&&webgl.actualBackend==='webgl'&&Object.values(webgl.checks||{}).every(Boolean),webgpuPass:webgpu.status==='candidate-observation'&&webgpu.actualBackend==='webgpu'&&webgpu.fixture?.floatBlendSupported===true&&Object.values(webgpu.checks||{}).every(Boolean),webglCapabilityClassified:typeof webgl.fixture?.floatBlendSupported==='boolean',sameThreeRevision:String(webgl.threeRevision)==='186'&&String(webgpu.threeRevision)==='186',sameFixture:webgl.fixture?.sampleCount===256&&webgpu.fixture?.sampleCount===256,inputIdentityEqual:webgl.summary?.hashes?.inputs===webgpu.summary?.hashes?.inputs},
  limits:{hardwareGpu:false,targetDevice:false,browserPresentationSurface:false,gaussianCutoffPath:false,realPhotoOrLearnedAsset:false,humanAcceptance:false}};
comparison.status=Object.values(comparison.checks).every(Boolean)?'Candidate-pass':'Candidate-fail';
comparison.interpretation='Direct Three.js r186 two-layer source-over accumulation test. It separates float accumulation from RGBA8 per-draw accumulation, locks draw order, and uses a reversed-order negative control. It does not cover Gaussian cutoff, presentation transforms, hardware GPU, devices, real assets or perceptual acceptance.';
fs.writeFileSync('r55-comparison.json',JSON.stringify(comparison,null,2)+'\n');console.log(JSON.stringify(comparison,null,2));if(comparison.status!=='Candidate-pass')process.exitCode=10;
