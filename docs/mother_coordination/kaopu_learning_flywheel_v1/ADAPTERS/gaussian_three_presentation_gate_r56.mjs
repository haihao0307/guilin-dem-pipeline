export function validatePresentationR56(report){
  const errors=[],warnings=[];
  if(report?.schema!=='kaopu-three-presentation-comparison/r56')errors.push('schema-mismatch');
  if(report?.status!=='Candidate-pass')errors.push('comparison-not-pass');
  if(report?.fixture?.sourceHash!=='0ca00d66d1646fd820cf6fca230460f4dd11b31d05c1a683aa12278603a1e520')errors.push('r55-source-hash-not-locked');
  if(report?.fixture?.toneMapping!=='NoToneMapping')errors.push('tone-mapping-not-isolated');
  if(report?.fixture?.targetColorSpace!=='offscreen RGBA32F NoColorSpace')errors.push('offscreen-target-contract-missing');
  for(const side of['webgl','webgpu']){
    const r=report?.[side];if(r?.status!=='candidate-observation')errors.push(`${side}-invalid`);
    for(const[k,v]of Object.entries(r?.checks||{}))if(v!==true)errors.push(`${side}-check-failed-${k}`);
    if(r?.offscreenHashes?.length!==1||r?.sourceHashes?.length!==1)errors.push(`${side}-source-varied-between-cases`);
  }
  for(const[k,v]of Object.entries(report?.checks||{}))if(v!==true)errors.push(`check-failed-${k}`);
  for(const[k,v]of Object.entries(report?.observations||{})){
    if(!Number.isFinite(v?.metrics?.maxCodeDiff)||!Number.isFinite(v?.metrics?.rmseCodes))errors.push(`${k}-metrics-invalid`);
    if(!(v?.offscreenMaxAbs<=1e-6))errors.push(`${k}-offscreen-source-mismatch`);
  }
  warnings.push('opaque-two-code-and-transparent-eight-code-limits-are-fixture-integrity-guards-not-asset-or-perceptual-thresholds');
  warnings.push('screenshot-PNG-readback-includes-browser-canvas-and-compositor-quantization');
  warnings.push('software-webgl-and-webgpu-share-chromium-swiftshader-lineage');
  warnings.push('no-hardware-gpu-apple-device-real-asset-or-human-acceptance');
  return{status:errors.length?'Candidate-fail':'Candidate-pass',errors,warnings,interpretation:'Integrity gate for the locked R55 float result through Three.js r186 linear/sRGB canvas output and browser screenshot composition. It does not convert fixture code widths into production tolerances.'};
}
if(import.meta.url===`file://${process.argv[1]}`){const chunks=[];for await(const c of process.stdin)chunks.push(c);console.log(JSON.stringify(validatePresentationR56(JSON.parse(Buffer.concat(chunks).toString('utf8'))),null,2));}
