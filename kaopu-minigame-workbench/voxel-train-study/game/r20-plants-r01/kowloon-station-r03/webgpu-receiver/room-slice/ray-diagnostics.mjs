// QA-only sparse replay. Uses the exact renderer camera, field and glass rays.
// It builds no geometry and is not included in the normal render stage closures.
import {selectStageSource} from './stage-source.mjs';
export function diagnosticSources(fullCode) {
  const start=fullCode.indexOf('fn traceWorld('), end=fullCode.indexOf('\nstruct RayStatistics',start);
  if(start<0||end<0)throw Error('Trace diagnostic source boundary changed');
  const original=fullCode.slice(start,end);
  let replay=original.replace('fn traceWorld(', 'fn traceDiagnosticWorld(')
    .replace('farT:f32)->Hit', 'farT:f32,regularBudget:u32,useSupport:bool)->Hit')
    .replace('i<692u','i<1536u').replace('regularSteps>=180u','regularSteps>=min(regularBudget,1024u)')
    .replace('true,692u,localSteps','true,1536u,localSteps')
    .replace('var t=.001;var prevT=t;', 'var limit=farT;var t=.001;if(useSupport){let support=diagnosticSupportInterval(ro,rd);if(support.x>support.y||support.y<.001||support.x>farT){return Hit(farT,false,false,0u,0u,rawField(1e4,0,ro+rd*farT));}t=max(t,support.x);limit=min(limit,support.y);}var prevT=t;')
    .replace('if(t>farT){return Hit(farT,false,false,i,localSteps,rawField(1e4,0,ro+rd*farT));}', 'if(t>limit){return Hit(limit,false,false,i,localSteps,rawField(1e4,0,ro+rd*limit));}');
  if(replay===original||!replay.includes('regularSteps>=min(regularBudget,1024u)'))throw Error('Trace diagnostic budget bridge changed');
  const code=fullCode+'\n'+replay+String.raw`
// QA candidate only. Proven whole-room zero support plus 50um query padding
// encloses the unchanged hit epsilon (<=40um for primary far32m).
fn diagnosticSupportInterval(ro:vec3<f32>,rd:vec3<f32>)->vec2<f32>{
 let lo=vec3<f32>(-3.47,-.20,-1.42)-vec3<f32>(.00005);let hi=vec3<f32>(3.47,3.4,4.32)+vec3<f32>(.00005);var enter=0.;var leave=1e4;
 for(var axis=0;axis<3;axis++){if(abs(rd[axis])<1e-8){if(ro[axis]<lo[axis]||ro[axis]>hi[axis]){return vec2<f32>(1.,-1.);}}else{let a=(lo[axis]-ro[axis])/rd[axis];let b=(hi[axis]-ro[axis])/rd[axis];enter=max(enter,min(a,b));leave=min(leave,max(a,b));}}return vec2<f32>(enter,leave);
}
struct DiagnosticRay { origin:vec4<f32>, direction:vec4<f32> };
@group(0) @binding(5) var<storage,read> diagnosticQueries:array<vec4<u32>>;
@group(0) @binding(6) var<storage,read_write> diagnosticRays:array<DiagnosticRay>;
@group(0) @binding(7) var<storage,read> diagnosticPrimary:array<GpuHit>;
@group(0) @binding(8) var<storage,read_write> diagnosticHits:array<GpuHit>;
@compute @workgroup_size(64) fn diagnosticOriginsMain(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=arrayLength(&diagnosticQueries)){return;}let query=diagnosticQueries[i];let rd=cameraRay(vec2<f32>(query.xy)+vec2<f32>(.5));
 if(query.w==0u){diagnosticRays[i]=DiagnosticRay(vec4<f32>(u.ro,32.),vec4<f32>(rd,1.));return;}
 let h=diagnosticPrimary[i];if(h.identity.z!=1u||h.identity.x!=6u){diagnosticRays[i]=DiagnosticRay(vec4<f32>(0.),vec4<f32>(0.));return;}
 let p=u.ro+rd*h.distances.x;let n=fieldNormal(p);
 if(query.w==1u){let exitZ=select(-.069,-.061,rd.z>0.);let exitT=max(0.,(exitZ-p.z)/select(-1e-7,1e-7,rd.z>=0.));let slabExit=select(max(0.,(exitZ-p.z)/rd.z),exitT,abs(rd.z)<1e-7);diagnosticRays[i]=DiagnosticRay(vec4<f32>(p+rd*(slabExit+.001),24.),vec4<f32>(rd,1.));}
 else{diagnosticRays[i]=DiagnosticRay(vec4<f32>(p+n*.006,24.),vec4<f32>(reflect(rd,n),1.));}
}
@compute @workgroup_size(64) fn diagnosticTraceMain(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=arrayLength(&diagnosticQueries)){return;}let ray=diagnosticRays[i];if(ray.direction.w==0.){diagnosticHits[i]=GpuHit(vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.),vec4<u32>(0u,0u,3u,0u));return;}
 let h=traceDiagnosticWorld(ray.origin.xyz,ray.direction.xyz,ray.origin.w,diagnosticQueries[i].z&65535u,(diagnosticQueries[i].z&65536u)!=0u);let state=select(select(0u,2u,h.exhausted),1u,h.hit);
 diagnosticHits[i]=GpuHit(vec4<f32>(h.t,h.field.d,f32(h.steps),f32(h.localSteps)),vec4<f32>(h.field.q,h.field.seed),vec4<f32>(h.field.wet,h.field.repair,h.field.age,0.),vec4<u32>(u32(h.field.id),u32(h.field.variant),state,0u));
}
`;
  return {origins:selectStageSource(code,['diagnosticOriginsMain']), trace:selectStageSource(code,['diagnosticTraceMain'])};
}

export async function createRayDiagnostics(device,fullCode,uniform){
 const stages=diagnosticSources(fullCode),pipelines={};
 for(const name of ['origins','trace']){const module=device.createShaderModule({code:stages[name].code});const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw Error(JSON.stringify(errors.map(m=>({stage:name,message:m.message,line:m.lineNum}))));pipelines[name]=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:name==='origins'?'diagnosticOriginsMain':'diagnosticTraceMain'}});}
 return async function replay(pixels,{regularBudget=180,secondary=false,bounded=false}={}){
  if(!pixels.length||pixels.length>8192||!Number.isInteger(regularBudget)||regularBudget<180||regularBudget>1024)throw Error('Sparse diagnostic bounds');
  const n=pixels.length,queries=new Uint32Array(n*4);pixels.forEach(([x,y],i)=>queries.set([x,y,regularBudget|(bounded?65536:0),0],i*4));
  const query=device.createBuffer({size:queries.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const rays=device.createBuffer({size:n*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  const primary=device.createBuffer({size:n*64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  const hits=device.createBuffer({size:n*64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
  const read=device.createBuffer({size:n*96,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  const originGroup=device.createBindGroup({layout:pipelines.origins.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:5,resource:{buffer:query}},{binding:6,resource:{buffer:rays}},{binding:7,resource:{buffer:primary}}]});
  const traceGroup=device.createBindGroup({layout:pipelines.trace.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:5,resource:{buffer:query}},{binding:6,resource:{buffer:rays}},{binding:8,resource:{buffer:hits}}]});
  const out={regularBudget,bounded,pixels,passes:[],stageBytes:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,v.bytes]))};
  try{for(let mode=0;mode<(secondary?3:1);mode++){pixels.forEach((_,i)=>queries[i*4+3]=mode);device.queue.writeBuffer(query,0,queries);const t=performance.now(),e=device.createCommandEncoder();for(const [name,group]of [['origins',originGroup],['trace',traceGroup]]){const p=e.beginComputePass();p.setPipeline(pipelines[name]);p.setBindGroup(0,group);p.dispatchWorkgroups(Math.ceil(n/64));p.end();}if(mode===0)e.copyBufferToBuffer(hits,0,primary,0,n*64);e.copyBufferToBuffer(hits,0,read,0,n*64);e.copyBufferToBuffer(rays,0,read,n*64,n*32);device.queue.submit([e.finish()]);await read.mapAsync(GPUMapMode.READ);const buffer=read.getMappedRange(),f=new Float32Array(buffer),u=new Uint32Array(buffer);const records=pixels.map((pixel,i)=>({pixel,t:f[i*16],distance:f[i*16+1],steps:f[i*16+2],localSteps:f[i*16+3],localPoint:Array.from(f.slice(i*16+4,i*16+7)),seed:f[i*16+7],variant:u[i*16+13],id:u[i*16+12],status:u[i*16+14],origin:Array.from(f.slice(n*16+i*8,n*16+i*8+3)),direction:Array.from(f.slice(n*16+i*8+4,n*16+i*8+7))}));read.unmap();out.passes.push({mode,elapsedMs:performance.now()-t,records});}}
  finally{query.destroy();rays.destroy();primary.destroy();hits.destroy();read.destroy();}
  return out;
 };
}
