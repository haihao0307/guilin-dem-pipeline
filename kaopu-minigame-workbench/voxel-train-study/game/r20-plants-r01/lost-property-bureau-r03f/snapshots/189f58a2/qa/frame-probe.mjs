/**
 * Small actual-WGSL material-frame covariance probe. This module imports the
 * production shader and copies its reachable functions verbatim. It does not
 * render the scene, emulate the wood mother on the CPU, or claim visual QA.
 * runFrameProbe() is browser-only; buildFrameProbe() is safe to inspect in Node.
 */
import { shaderSource } from '../renderer.mjs';
import { selectStageSource } from '../stage-source.mjs';

const I = [1,0,0,0,1,0,0,0,1];
const WEST = [0,0,1,0,1,0,1,0,0];
const MIRROR = [-1,0,0,0,1,0,0,0,1];
const add = (a,b) => a.map((v,i) => v+b[i]);
const sub = (a,b) => a.map((v,i) => v-b[i]);
const scale = (v,s) => v.map(x=>x*s);
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const unit = v => scale(v,1/Math.hypot(...v));
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const transpose = a => [a[0],a[3],a[6],a[1],a[4],a[7],a[2],a[5],a[8]];
const mv = (a,v) => [dot(a.slice(0,3),v),dot(a.slice(3,6),v),dot(a.slice(6,9),v)];
const mm = (a,b) => Array.from({length:9},(_,i)=>{const r=Math.floor(i/3),c=i%3;return a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c];});
const determinant = a => a[0]*(a[4]*a[8]-a[5]*a[7])-a[1]*(a[3]*a[8]-a[5]*a[6])+a[2]*(a[3]*a[7]-a[4]*a[6]);
function axisAngle(axis,angle) {
  const [x,y,z]=unit(axis),c=Math.cos(angle),s=Math.sin(angle),t=1-c;
  return [t*x*x+c,t*x*y-s*z,t*x*z+s*y,t*x*y+s*z,t*y*y+c,t*y*z-s*x,t*x*z-s*y,t*y*z+s*x,t*z*z+c];
}
function cubeRotations() {
  const rotations=[];
  for(const p of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) for(const x of [-1,1]) for(const y of [-1,1]) for(const z of [-1,1]) {
    const a=Array(9).fill(0);[x,y,z].forEach((s,i)=>{a[i*3+p[i]]=s;});if(determinant(a)===1)rotations.push(a);
  }
  return [I,...rotations.filter(a=>a.some((v,i)=>v!==I[i]))];
}
const INPUT_FLOATS=48,OUTPUT_FLOATS=28;
const OUTPUT_LABELS=[
  'albedo.r','albedo.g','albedo.b','heightM',
  'localMaterialNormal.x','localMaterialNormal.y','localMaterialNormal.z','roughness',
  'footprintM','normalLightCosine','normalViewCosine','normalHalfCosine',
  'localPoint.x','localPoint.y','localPoint.z','componentEnabled',
  'extentMin.x','extentMin.y','extentMin.z','reservedMin',
  'extentMax.x','extentMax.y','extentMax.z','reservedMax',
  'cameraDistanceM','localGeometricNormal.x','localGeometricNormal.y','localGeometricNormal.z',
];
// Absolute tolerances. Actual error maxima and every failed metric are reported.
// A 2 µm height allowance is explicit; this is f32 covariance, not bit identity.
export const FRAME_PROBE_TOLERANCES=Object.freeze({
  albedo:0.002,heightM:0.000002,localMaterialNormal:0.003,roughness:0.0005,
  footprintM:0.0000002,cosine:0.003,localPointM:0.000002,extentM:0,
  cameraDistanceM:0.000003,localGeometricNormal:0.000002,
});
function tolerance(index) {
  const t=FRAME_PROBE_TOLERANCES;
  if(index<3)return t.albedo;if(index===3)return t.heightM;if(index<7)return t.localMaterialNormal;
  if(index===7)return t.roughness;if(index===8)return t.footprintM;if(index<12)return t.cosine;
  if(index<15)return t.localPointM;if(index<24)return t.extentM;if(index===24)return t.cameraDistanceM;
  return t.localGeometricNormal;
}

export function frameProbeCases() {
  const hosts=[
    {name:'identity',A:I},
    {name:'west-reflection',A:WEST},
    {name:'arbitrary-reflected-host',A:mm(axisAngle([4,-1,2],0.391),MIRROR)},
  ];
  const rotations=[...cubeRotations(),...[
    [[1,2,3],0.617],[[3,-2,1],-1.127],[[2,1,-4],Math.PI-0.019],[[1,-3,2],-0.083],
  ].map(([axis,angle])=>axisAngle(axis,angle))];
  const normals=[[1,0,0],[0,0,1],unit([1,2,3])];
  const angles=[0,89.5*Math.PI/180];
  const result=[];
  for(const host of hosts) for(let normalIndex=0;normalIndex<normals.length;normalIndex++) for(let incidence=0;incidence<angles.length;incidence++) {
    const A=host.A,origin=[0.25,-0.125,0.375],q=[0.3125+normalIndex*0.03125,0.0625,0.09375],normal=normals[normalIndex];
    const tangent=unit(cross(Math.abs(normal[1])<0.8?[0,1,0]:[1,0,0],normal));
    const bitangent=unit(cross(normal,tangent)),theta=angles[incidence],distance=2.5,pixelAngle=0.00011;
    const ray=add(scale(normal,-Math.cos(theta)),scale(tangent,Math.sin(theta)));
    const cameraRight=add(scale(tangent,Math.cos(theta)),scale(normal,Math.sin(theta)));
    const differential=v=>scale(sub(v,scale(ray,dot(normal,v)/dot(normal,ray))),distance*pixelAngle);
    const dx=differential(cameraRight),dy=differential(bitangent);
    const toWorldPoint=v=>add(origin,mv(transpose(A),v)),toWorldVector=v=>mv(transpose(A),v);
    const base={p:toWorldPoint(q),origin,n:toWorldVector(normal),dx:toWorldVector(dx),dy:toWorldVector(dy),eye:toWorldPoint(sub(q,scale(ray,distance))),light:toWorldPoint(add(q,[1.7,2.3,-1.1]))};
    const group=`${host.name}/normal-${normalIndex}/${incidence?'grazing-89.5deg':'normal-incidence'}`;
    for(let rotationIndex=0;rotationIndex<rotations.length;rotationIndex++) {
      const R=rotations[rotationIndex],translation=rotationIndex===0?[0,0,0]:[0.375,-0.25,0.125];
      const point=v=>add(mv(R,v),translation),direction=v=>mv(R,v);
      result.push({
        group,rotationIndex,name:`${group}/rotation-${rotationIndex}`,hostDeterminant:determinant(A),
        A:mm(A,transpose(R)),p:point(base.p),origin:point(base.origin),n:direction(base.n),
        dx:direction(base.dx),dy:direction(base.dy),eye:point(base.eye),light:point(base.light),
        lower:[-0.845,0,0.01],upper:[0.845,2.195,0.21],baseFootprint:0.0001,
        expected:{q,normal,footprint:Math.max(0.0001,Math.hypot(...dx),Math.hypot(...dy)),cameraDistance:distance},
      });
    }
  }
  return result;
}

const PROBE_WGSL=String.raw`
struct FrameProbeInput {
 pointFootprint:vec4<f32>,origin:vec4<f32>,normal:vec4<f32>,dx:vec4<f32>,dy:vec4<f32>,eye:vec4<f32>,light:vec4<f32>,
 axis0:vec4<f32>,axis1:vec4<f32>,axis2:vec4<f32>,lower:vec4<f32>,upper:vec4<f32>
};
struct FrameProbeOutput {
 colorHeight:vec4<f32>,normalRoughness:vec4<f32>,footprintResponse:vec4<f32>,localPoint:vec4<f32>,
 lower:vec4<f32>,upper:vec4<f32>,distanceGeometricNormal:vec4<f32>
};
@group(0) @binding(8) var<storage,read> frameProbeInput:array<FrameProbeInput>;
@group(0) @binding(9) var<storage,read_write> frameProbeOutput:array<FrameProbeOutput>;
@compute @workgroup_size(64) fn frameProbe(@builtin(global_invocation_id) gid:vec3<u32>){
 if(gid.x>=arrayLength(&frameProbeInput)){return;}
 let v=frameProbeInput[gid.x];let a=mat3x3<f32>(v.axis0.xyz,v.axis1.xyz,v.axis2.xyz);
 let p=v.pointFootprint.xyz;let q=a*(p-v.origin.xyz);let n=normalize(v.normal.xyz);
 let f=Field(0.,14u,q,1.,.74,.035,MaterialFrame(a,v.lower.xyz,v.upper.xyz,1.));
 let fp=componentFootprint(f,v.pointFootprint.w,v.dx.xyz,v.dy.xyz);
 let material=surfaceRaw(f,p,n,fp);let materialN=materialNormal(f,p,n,fp);
 let lightDirection=normalize(v.light.xyz-p);let viewDirection=normalize(v.eye.xyz-p);
 let halfDirection=normalize(lightDirection+viewDirection);
 var o:FrameProbeOutput;
 o.colorHeight=vec4<f32>(material.albedo,material.height);
 o.normalRoughness=vec4<f32>(a*materialN,material.roughness);
 o.footprintResponse=vec4<f32>(fp,dot(materialN,lightDirection),dot(materialN,viewDirection),dot(materialN,halfDirection));
 o.localPoint=vec4<f32>(q,f.component.enabled);o.lower=vec4<f32>(f.component.lower,0.);o.upper=vec4<f32>(f.component.upper,0.);
 o.distanceGeometricNormal=vec4<f32>(length(v.eye.xyz-p),a*n);frameProbeOutput[gid.x]=o;
}
`;

export function buildFrameProbe() {
  const closure=selectStageSource(shaderSource()+'\n'+PROBE_WGSL,['frameProbe']);
  const expectedBindings=['u','frameProbeInput','frameProbeOutput'];
  if(closure.bindings.length!==3||!expectedBindings.every(name=>closure.bindings.some(b=>b.name===name)))throw Error('Unexpected probe bindings: '+JSON.stringify(closure.bindings));
  for(const name of ['frameProbe','surfaceRaw','materialNormal','componentFootprint','componentVector','componentTangent','offsetComponent','receiverWoodSample','kpWoodOriginalSample']) {
    if(!closure.functionNames.includes(name))throw Error('Missing real production shader function: '+name);
  }
  if(closure.functionNames.includes('sceneField'))throw Error('Probe must not expand or raymarch the building domain');
  const cases=frameProbeCases(),data=new Float32Array(cases.length*INPUT_FLOATS);
  for(let index=0;index<cases.length;index++) {
    const c=cases[index],fields=[
      [...c.p,c.baseFootprint],[...c.origin,0],[...c.n,0],[...c.dx,0],[...c.dy,0],[...c.eye,0],[...c.light,0],
      [c.A[0],c.A[3],c.A[6],0],[c.A[1],c.A[4],c.A[7],0],[c.A[2],c.A[5],c.A[8],0],[...c.lower,0],[...c.upper,0],
    ];
    data.set(fields.flat(),index*INPUT_FLOATS);
  }
  return {closure,cases,data,inputStride:INPUT_FLOATS*4,outputStride:OUTPUT_FLOATS*4};
}

function compareCovariance(values,cases) {
  const baselines=new Map(),maxAbsoluteError=Object.fromEntries(OUTPUT_LABELS.map(label=>[label,0])),failures=[];
  let failureCount=0,comparisons=0;
  function compare(index,j,expected,kind) {
    comparisons++;const actual=values[index*OUTPUT_FLOATS+j],error=Math.abs(actual-expected);
    maxAbsoluteError[OUTPUT_LABELS[j]]=Math.max(maxAbsoluteError[OUTPUT_LABELS[j]],error);
    if(!Number.isFinite(actual)||!Number.isFinite(expected)||error>tolerance(j)) {
      failureCount++;if(failures.length<40)failures.push({case:cases[index].name,metric:OUTPUT_LABELS[j],kind,actual,expected,absoluteError:error,tolerance:tolerance(j)});
    }
  }
  cases.forEach((c,index)=>{
    if(c.rotationIndex===0)baselines.set(c.group,index);
    const baseline=baselines.get(c.group);
    if(baseline===undefined)throw Error('No baseline for '+c.group);
    for(let j=0;j<OUTPUT_FLOATS;j++)compare(index,j,values[baseline*OUTPUT_FLOATS+j],'same-material rigid covariance');
    c.expected.q.forEach((x,j)=>compare(index,12+j,x,'independent input contract'));
    compare(index,8,c.expected.footprint,'independent metric footprint');
    compare(index,24,c.expected.cameraDistance,'independent camera distance');
    c.expected.normal.forEach((x,j)=>compare(index,25+j,x,'independent local normal'));
    c.lower.forEach((x,j)=>compare(index,16+j,Math.fround(x),'unchanged local lower extent'));
    c.upper.forEach((x,j)=>compare(index,20+j,Math.fround(x),'unchanged local upper extent'));
  });
  return {passed:failureCount===0,comparisons,failureCount,failures,maxAbsoluteError};
}

export async function runFrameProbe() {
  const started=performance.now(),receipt={
    status:'running',gpuExecuted:false,actualMother:'production kpWoodOriginalSample via surfaceRaw, timber mat14',
    visualAcceptance:false,renderCompared:false,normalScope:'rigid orthogonal frames, including reflections; no nonuniform scale/shear',
    tolerances:FRAME_PROBE_TOLERANCES,errors:[],
  };
  let device,buffers=[];
  try {
    if(!globalThis.navigator?.gpu)throw Error('WebGPU unavailable; actual GPU mother probe did not run');
    const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('WebGPU adapter unavailable');
    const info=adapter.info;
    receipt.adapter=info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:null;
    device=await adapter.requestDevice();device.addEventListener('uncapturederror',e=>receipt.errors.push(e.error.message));
    const {closure,cases,data,inputStride,outputStride}=buildFrameProbe();
    receipt.cases=cases.length;receipt.groups=new Set(cases.map(c=>c.group)).size;
    receipt.rotationsPerGroup=28;receipt.cubeRotations=24;receipt.arbitraryRotations=4;
    receipt.hostFrames=3;receipt.reflectedHostFrames=2;receipt.incidenceDegrees=[0,89.5];
    receipt.shaderBytes=closure.bytes;receipt.bindings=closure.bindings;receipt.functions=closure.functionNames;
    receipt.inputStrideBytes=inputStride;receipt.outputStrideBytes=outputStride;
    device.pushErrorScope('validation');
    const module=device.createShaderModule({code:closure.code});
    const compilation=await module.getCompilationInfo();
    receipt.compilationMessages=compilation.messages.map(m=>({type:m.type,line:m.lineNum,column:m.linePos,message:m.message}));
    const shaderErrors=receipt.compilationMessages.filter(m=>m.type==='error');
    if(shaderErrors.length)throw Error('WGSL compile failed: '+shaderErrors.map(m=>`${m.line}:${m.column} ${m.message}`).join('; '));
    const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'frameProbe'}});
    const create=descriptor=>{const b=device.createBuffer(descriptor);buffers.push(b);return b;};
    const uniform=create({size:144,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    const input=create({size:data.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
    const byteLength=cases.length*outputStride;
    const output=create({size:byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    const readback=create({size:byteLength,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    device.queue.writeBuffer(input,0,data);
    const bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:uniform}},{binding:8,resource:{buffer:input}},{binding:9,resource:{buffer:output}},
    ]});
    async function run(enabled) {
      const params=new Float32Array(36);params[26]=enabled?1:0;params[27]=1;device.queue.writeBuffer(uniform,0,params);
      const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);
      pass.dispatchWorkgroups(Math.ceil(cases.length/64));pass.end();encoder.copyBufferToBuffer(output,0,readback,0,byteLength);
      device.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);
      const result=new Float32Array(readback.getMappedRange().slice(0));readback.unmap();return result;
    }
    const fixedValues=await run(true);receipt.gpuExecuted=true;
    receipt.fixed=compareCovariance(fixedValues,cases);
    const legacyValues=await run(false),legacy=compareCovariance(legacyValues,cases);
    // The retained frameFix=0 path is a negative control, expected to disagree.
    const materialMetric=index=>index<8||(index>=9&&index<12);
    let legacyBrokenGroups=0;const legacyExamples=[];
    for(const group of new Set(cases.map(c=>c.group))) {
      const indices=cases.flatMap((c,i)=>c.group===group?[i]:[]),base=indices[0];let broken=false;
      for(const index of indices.slice(1)) for(let j=0;j<OUTPUT_FLOATS;j++) if(materialMetric(j)) {
        const error=Math.abs(legacyValues[index*OUTPUT_FLOATS+j]-legacyValues[base*OUTPUT_FLOATS+j]);
        if(error>tolerance(j)) {broken=true;if(legacyExamples.length<8)legacyExamples.push({case:cases[index].name,metric:OUTPUT_LABELS[j],absoluteError:error,tolerance:tolerance(j)});}
      }
      if(broken)legacyBrokenGroups++;
    }
    receipt.legacyNegativeControl={expectedToFailCovariance:true,detected:legacyBrokenGroups>0,brokenMaterialGroups:legacyBrokenGroups,examples:legacyExamples,maxAbsoluteError:legacy.maxAbsoluteError};
    receipt.samples=cases.filter(c=>c.rotationIndex===0).map(c=>{const i=cases.indexOf(c);return {case:c.name,fixed:Array.from(fixedValues.slice(i*OUTPUT_FLOATS,(i+1)*OUTPUT_FLOATS)),legacy:Array.from(legacyValues.slice(i*OUTPUT_FLOATS,(i+1)*OUTPUT_FLOATS))};});
    receipt.outputLabels=OUTPUT_LABELS;
    const validation=await device.popErrorScope();if(validation)receipt.errors.push(validation.message);
    receipt.status=receipt.fixed.passed&&receipt.legacyNegativeControl.detected&&receipt.errors.length===0?'passed':'failed';
    if(receipt.status==='failed')receipt.failure='GPU covariance, legacy sensitivity, or validation check failed; inspect fixed.failures and errors';
  } catch(error) {
    receipt.status='failed';receipt.failure=error?.stack||String(error);
  } finally {
    for(const buffer of buffers)buffer.destroy();if(device)device.destroy();
    receipt.deviceDestroyed=!!device;receipt.durationMs=performance.now()-started;receipt.ready=true;
  }
  return receipt;
}
