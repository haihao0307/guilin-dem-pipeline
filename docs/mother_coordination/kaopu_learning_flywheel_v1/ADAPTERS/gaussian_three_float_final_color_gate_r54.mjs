export function validateFloatFinalColorR54(report) {
  const errors=[];
  const warnings=[];
  if(report?.schema!=='kaopu-three-float-final-color-comparison/r54')errors.push('schema-mismatch');
  if(report?.status!=='Candidate-pass')errors.push('comparison-not-pass');
  if(report?.webgl?.status!=='candidate-observation'||report?.webgl?.actualBackend!=='webgl')errors.push('webgl-observation-invalid');
  if(report?.webgpu?.status!=='candidate-observation'||report?.webgpu?.actualBackend!=='webgpu')errors.push('webgpu-observation-invalid');
  for(const side of ['webgl','webgpu']){
    const s=report?.[side]?.summary||{};
    if(s.sampledChannels!==1024)errors.push(`${side}-channel-count-mismatch`);
    if(!(s.maxAbs<=0.5/255+1e-6))errors.push(`${side}-max-error-over-half-code-plus-epsilon`);
    if(s.channelsOverOneCode!==0)errors.push(`${side}-channels-over-one-code`);
    if(report?.[side]?.checks?.allPixelsCovered!==true)errors.push(`${side}-coverage-failed`);
    if(report?.[side]?.checks?.noChannelsOverOneCode!==true)errors.push(`${side}-one-code-check-failed`);
  }
  if(report?.crossBackend?.floatTargetHashEqual!==true)errors.push('float-target-hash-differs');
  if(report?.crossBackend?.finalTargetHashEqual!==true)errors.push('final-target-hash-differs');
  if(report?.crossBackend?.maxAbsDelta!==0)errors.push('max-abs-metric-differs');
  if(report?.crossBackend?.rmseDelta!==0)errors.push('rmse-metric-differs');
  for(const [k,v] of Object.entries(report?.checks||{}))if(v!==true)errors.push(`check-failed-${k}`);

  warnings.push('no-gaussian-blending-in-r54');
  warnings.push('no-browser-presentation-surface-in-r54');
  warnings.push('software-backends-are-not-hardware-device-proof');
  warnings.push('real-assets-and-human-acceptance-remain-unverified');
  return{
    status:errors.length===0?'Candidate-pass':'Candidate-fail',errors,warnings,
    interpretation:'Direct Three.js r186 TSL stable-pixel storage gate comparing offscreen RGBA32F and RGBA8 with explicit no-tone-map/no-target-color-space state. A pass bounds this fixture to about half an 8-bit code plus float epsilon and confirms identical software WebGL/WebGPU outputs; it does not cover blending, presentation transforms, hardware, assets or human acceptance.'
  };
}
if(import.meta.url===`file://${process.argv[1]}`){const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);console.log(JSON.stringify(validateFloatFinalColorR54(JSON.parse(Buffer.concat(chunks).toString('utf8'))),null,2));}
