import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const N=256;
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const oetf=x=>x<0.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-0.055;
const clamp=x=>Math.max(0,Math.min(1,x));

function expectedBytes(values,output,background){
  const out=Buffer.alloc(N*4);
  for(let i=0;i<N;i++){
    const k=i*4,a=clamp(values[k+3]);
    for(let c=0;c<3;c++){
      const straight=a>0?clamp(values[k+c]/a):0;
      const encoded=output==='srgb'?oetf(straight):straight;
      const value=background==='transparent'?encoded:(encoded*a+(background==='white'?(1-a):0));
      out[k+c]=Math.round(clamp(value)*255);
    }
    out[k+3]=background==='transparent'?Math.round(a*255):255;
  }
  return out;
}
function byteMetrics(actual,expected){
  let max=0,sum2=0,changed=0,first=null;const per=[0,0,0,0];
  for(let i=0;i<actual.length;i++){
    const d=Math.abs(actual[i]-expected[i]);max=Math.max(max,d);per[i%4]=Math.max(per[i%4],d);sum2+=d*d;if(d){changed++;first??={channelIndex:i,pixel:Math.floor(i/4),channel:i%4,actual:actual[i],expected:expected[i],diff:d};}
  }
  return{channels:actual.length,maxCodeDiff:max,rmseCodes:Math.sqrt(sum2/actual.length),changedChannels:changed,perChannelMaxCodeDiff:per,firstDifference:first};
}
function blankPattern(actual,background){
  for(let i=0;i<actual.length;i++){
    const expected=i%4===3?(background==='transparent'?0:255):(background==='white'?255:0);
    if(actual[i]!==expected)return false;
  }
  return true;
}
async function run(mode,output,background){
  const page=await browser.newPage({viewport:{width:300,height:64},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:8765/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_presentation_r56.html?mode=${mode}&output=${output}`,{waitUntil:'load',timeout:120000});
  await page.waitForFunction(()=>window.__KAOPU_DONE__===true,null,{timeout:300000});
  const result=await page.evaluate(()=>window.__KAOPU_RESULT__);
  await page.evaluate(bg=>{document.documentElement.style.background=bg==='transparent'?'transparent':bg;document.body.style.background=bg==='transparent'?'transparent':bg;},background);
  await page.waitForTimeout(50);
  const pngBuffer=await page.screenshot({clip:{x:0,y:0,width:N,height:1},omitBackground:background==='transparent'});
  const png=PNG.sync.read(pngBuffer);if(png.width!==N||png.height!==1)throw new Error(`unexpected PNG ${png.width}x${png.height}`);
  const expected=expectedBytes(result.prePresentation.values,output,background),actual=Buffer.from(png.data);
  delete result.prePresentation.values;
  const record={...result,background,readback:{location:'Playwright page screenshot of CSS canvas rectangle while a continuous Three.js presentation loop is active',pngColorType:png.colorType,pngDepth:png.depth,width:png.width,height:png.height,actualSha256:sha(actual),expectedSha256:sha(expected),blankCanvasPattern:blankPattern(actual,background),metrics:byteMetrics(actual,expected),actual:Array.from(actual),expected:Array.from(expected)}};
  fs.writeFileSync(`r56-${mode}-${output}-${background}.json`,JSON.stringify(record,null,2)+'\n');
  await page.close();return record;
}

const runs=[];for(const mode of['webgl','webgpu'])for(const output of['linear','srgb'])for(const background of['transparent','black','white'])runs.push(await run(mode,output,background));await browser.close();
function find(mode,output,background){return runs.find(r=>r.requestedMode===mode&&r.outputName===output&&r.background===background);}
const backend={};for(const mode of['webgl','webgpu']){
  const rs=runs.filter(r=>r.requestedMode===mode);const hashes={};for(const r of rs)hashes[`${r.outputName}-${r.background}`]=r.readback.actualSha256;
  const allBlank=rs.every(r=>r.readback.blankCanvasPattern===true),presentationAvailable=!allBlank;
  const coreChecks={allPageChecks:rs.every(r=>Object.values(r.checks||{}).every(Boolean)),allOffscreenHashesSame:new Set(rs.map(r=>r.prePresentation.readbackHash)).size===1,sourceLocked:rs.every(r=>r.prePresentation.expectedHash==='0ca00d66d1646fd820cf6fca230460f4dd11b31d05c1a683aa12278603a1e520')};
  backend[mode]={status:rs.every(r=>r.status==='candidate-observation')?(presentationAvailable?'candidate-observation':'candidate-observation-presentation-unavailable'):'error',identity:rs[0]?.identity,offscreenHashes:[...new Set(rs.map(r=>r.prePresentation.readbackHash))],sourceHashes:[...new Set(rs.map(r=>r.prePresentation.expectedHash))],hashes,presentationAvailable,presentationBlankAllCases:allBlank,maxCodeDiffByCase:Object.fromEntries(rs.map(r=>[`${r.outputName}-${r.background}`,r.readback.metrics.maxCodeDiff])),checks:{...coreChecks,opaqueBackgroundsWithinTwoCodes:presentationAvailable?rs.filter(r=>r.background!=='transparent').every(r=>r.readback.metrics.maxCodeDiff<=2):null,transparentWithinEightCodes:presentationAvailable?rs.filter(r=>r.background==='transparent').every(r=>r.readback.metrics.maxCodeDiff<=8):null,linearAndSrgbDiffer:presentationAvailable?['transparent','black','white'].every(bg=>find(mode,'linear',bg).readback.actualSha256!==find(mode,'srgb',bg).readback.actualSha256):null}};
}
const cross={allPresentationHashesEqual:backend.webgl.presentationAvailable&&backend.webgpu.presentationAvailable?Object.keys(backend.webgl.hashes).every(k=>backend.webgl.hashes[k]===backend.webgpu.hashes[k]):null,offscreenHashEqual:backend.webgl.offscreenHashes[0]===backend.webgpu.offscreenHashes[0],sourceHashEqual:backend.webgl.sourceHashes[0]===backend.webgpu.sourceHashes[0]};
const comparison={schema:'kaopu-three-presentation-comparison/r56',status:'candidate-observation',fixture:{sampleCount:N,source:'exact R55 stepwise float32 premultiplied source-over output',sourceHash:'0ca00d66d1646fd820cf6fca230460f4dd11b31d05c1a683aa12278603a1e520',rendererOutputColorSpaces:['LinearSRGBColorSpace','SRGBColorSpace'],toneMapping:'NoToneMapping',backgrounds:['transparent','black','white'],readback:'Playwright PNG screenshot at CSS canvas rectangle after compositor frames',targetColorSpace:'offscreen RGBA32F NoColorSpace',outputBufferType:'FloatType'},webgl:backend.webgl,webgpu:backend.webgpu,crossBackend:cross,
  observations:Object.fromEntries(runs.map(r=>[`${r.requestedMode}-${r.outputName}-${r.background}`,{actualSha256:r.readback.actualSha256,expectedSha256:r.readback.expectedSha256,metrics:r.readback.metrics,offscreenMaxAbs:r.prePresentation.metrics.maxAbs}])),
  checks:{webglPresentationPass:backend.webgl.status==='candidate-observation'&&Object.values(backend.webgl.checks).every(v=>v===true),webgpuPrePresentationPass:backend.webgpu.checks.allPageChecks===true&&backend.webgpu.checks.allOffscreenHashesSame===true&&backend.webgpu.checks.sourceLocked===true,webgpuPresentationClassified:backend.webgpu.presentationAvailable?Object.values(backend.webgpu.checks).every(v=>v===true):backend.webgpu.presentationBlankAllCases===true,crossBackendOffscreenHashEqual:cross.offscreenHashEqual,crossBackendSourceHashEqual:cross.sourceHashEqual},
  limits:{hardwareGpu:false,targetDevice:false,appleSafariWebKit:false,gaussianCutoffPath:false,realPhotoOrLearnedAsset:false,humanAcceptance:false,sharedChromiumSwiftShaderLineage:true}};
comparison.status=Object.values(comparison.checks).every(Boolean)?'Candidate-pass':'Candidate-fail';
fs.writeFileSync('r56-comparison.json',JSON.stringify(comparison,null,2)+'\n');console.log(JSON.stringify(comparison,null,2));if(comparison.status!=='Candidate-pass')process.exitCode=10;
