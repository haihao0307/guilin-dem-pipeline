export function validateTwoSplatBlendR55(report){
  const errors=[],warnings=[];
  if(report?.schema!=='kaopu-three-two-splat-blend-comparison/r55')errors.push('schema-mismatch');
  if(report?.status!=='Candidate-pass')errors.push('comparison-not-pass');
  for(const side of['webgl','webgpu']){
    const r=report?.[side]||{},s=r.summary||{},m=s.referenceVsByte||{},e=s.floatVsExpected,o=s.order||{},supportsFloat=r.fixture?.floatBlendSupported===true;
    if(r.status!=='candidate-observation'||r.actualBackend!==side)errors.push(`${side}-observation-invalid`);
    if(r.fixture?.sampleCount!==256||r.fixture?.sampledChannels!==1024||r.fixture?.drawsPerPixel!==2)errors.push(`${side}-fixture-count-mismatch`);
    if(!String(r.fixture?.blending||'').includes('NormalBlending'))errors.push(`${side}-blend-contract-missing`);
    if(supportsFloat&&!(e?.maxAbs<=1e-5))errors.push(`${side}-float-reference-mismatch`);
    if(!supportsFloat&&side!=='webgl')errors.push(`${side}-required-float-blend-unsupported`);
    if(!supportsFloat&&r.fixture?.floatBlendCapability?.reason!=='EXT_float_blend not exposed')errors.push(`${side}-unsupported-capability-not-explicit`);
    if(!(o.maxRgbAbs>1e-4&&o.changedRgbChannels>0))errors.push(`${side}-reverse-control-did-not-change-rgb`);
    if(!(o.maxAlphaAbs<=(supportsFloat?1e-6:1/255+1e-7)))errors.push(`${side}-reverse-control-changed-alpha`);
    if(!(Number.isFinite(m.maxAbs)&&Number.isFinite(m.rmse)))errors.push(`${side}-blend-metrics-invalid`);
    if(m.channelsOverTwoCodes!==0)errors.push(`${side}-channel-over-two-codes`);
    for(const[k,v]of Object.entries(r.checks||{}))if(v!==true)errors.push(`${side}-check-failed-${k}`);
  }
  for(const[k,v]of Object.entries(report?.checks||{}))if(v!==true)errors.push(`check-failed-${k}`);
  if(report?.crossBackend?.inputHashEqual!==true)errors.push('input-identity-differs');
  if(report?.crossBackend?.byteHashEqual!==true)errors.push('byte-target-hash-differs');
  if(report?.webgl?.fixture?.floatBlendCapability?.floatBlendListed!==true||report?.webgl?.fixture?.floatBlendCapability?.floatBlendActivated!==true)errors.push('webgl-float-blend-not-explicitly-activated');
  if(report?.activationControl?.floatBlendListed!==true||report?.activationControl?.floatBlendActivated!==false||report?.activationControl?.status!=='candidate-observation')errors.push('listed-only-control-invalid');
  if(report?.crossBackend?.listedOnlyFloatHashEqual!==true||report?.crossBackend?.listedOnlyByteHashEqual!==true||report?.crossBackend?.listedOnlyReverseHashEqual!==true)errors.push('listed-only-control-output-differs');
  warnings.push('observed-two-code-bound-is-a-fixture-regression-envelope-not-an-asset-threshold');
  warnings.push('software-webgl-and-webgpu-are-not-independent-physical-roots');
  warnings.push('no-browser-presentation-transform-hardware-device-real-asset-or-human-acceptance');
  return{status:errors.length===0?'Candidate-pass':'Candidate-fail',errors,warnings,interpretation:'Integrity gate for the locked direct Three.js r186 two-layer source-over fixture. It validates the analytic float path, draw-order negative control, and finite RGBA8 accumulation metrics. Any observed code-width is scoped to this fixture and backend identity.'};
}
if(import.meta.url===`file://${process.argv[1]}`){const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);console.log(JSON.stringify(validateTwoSplatBlendR55(JSON.parse(Buffer.concat(chunks).toString('utf8'))),null,2));}
