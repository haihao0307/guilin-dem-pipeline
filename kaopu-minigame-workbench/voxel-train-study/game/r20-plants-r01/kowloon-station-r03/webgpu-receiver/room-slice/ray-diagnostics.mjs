// QA-only sparse replay using the production resumable trace core. No geometry.
import {selectStageSource} from './stage-source.mjs';
export function diagnosticSources(fullCode){
 const code=fullCode+String.raw`
struct DiagnosticRay {origin:vec4<f32>,direction:vec4<f32>};
@group(0) @binding(9) var<storage,read> diagnosticQueries:array<vec4<u32>>;
@group(0) @binding(10) var<storage,read_write> diagnosticRays:array<DiagnosticRay>;
@group(0) @binding(11) var<storage,read> diagnosticPrimary:array<GpuHit>;
@group(0) @binding(12) var<storage,read_write> diagnosticHits:array<GpuHit>;
@group(0) @binding(13) var<storage,read_write> diagnosticPrevious:array<vec4<f32>>;
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
 let limit=diagnosticQueries[i].z;let result=traceProgress(ray.origin.xyz,ray.direction.xyz,ray.origin.w,traceStart(ray.origin.xyz),vec4<f32>(.001,1.,0.,0.),limit,select(692u,1024u,limit>180u));diagnosticHits[i]=packHit(result.h);diagnosticPrevious[i]=result.previous;
}
@compute @workgroup_size(64) fn diagnosticResumeMain(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=arrayLength(&diagnosticQueries)||diagnosticHits[i].identity.z!=2u){return;}let ray=diagnosticRays[i];let result=traceProgress(ray.origin.xyz,ray.direction.xyz,ray.origin.w,unpackHit(diagnosticHits[i]),diagnosticPrevious[i],1024u,1024u);diagnosticHits[i]=packHit(result.h);diagnosticPrevious[i]=result.previous;
}
`;
 return Object.fromEntries([['origins','diagnosticOriginsMain'],['trace','diagnosticTraceMain'],['resume','diagnosticResumeMain']].map(([name,entry])=>[name,selectStageSource(code,[entry])]));
}
export async function createRayDiagnostics(device,fullCode,uniform){
 const stages=diagnosticSources(fullCode),pipelines={};
 for(const[name,entryPoint]of [['origins','diagnosticOriginsMain'],['trace','diagnosticTraceMain'],['resume','diagnosticResumeMain']]){const module=device.createShaderModule({code:stages[name].code});const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw Error(JSON.stringify(errors.map(m=>({stage:name,message:m.message,line:m.lineNum}))));pipelines[name]=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint}});}
 return async function replay(pixels,{regularBudget=180,secondary=false,resume=false}={}){
  if(!pixels.length||pixels.length>8192||!Number.isInteger(regularBudget)||regularBudget<180||regularBudget>1024)throw Error('Sparse diagnostic bounds');
  const n=pixels.length,queries=new Uint32Array(n*4);pixels.forEach(([x,y],i)=>queries.set([x,y,regularBudget,0],i*4));
  const query=device.createBuffer({size:queries.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),rays=device.createBuffer({size:n*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),primary=device.createBuffer({size:n*64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),hits=device.createBuffer({size:n*64,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),previous=device.createBuffer({size:n*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=device.createBuffer({size:n*112,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  const buffers={0:uniform,9:query,10:rays,11:primary,12:hits,13:previous},groups={};for(const[name,stage]of Object.entries(stages)){groups[name]=device.createBindGroup({layout:pipelines[name].getBindGroupLayout(0),entries:stage.bindings.map(({binding})=>({binding,resource:{buffer:buffers[binding]}}))});}
  const out={regularBudget,resume,pixels,passes:[],stageBytes:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,v.bytes]))};
  async function run(names,mode,resumed){const t=performance.now(),e=device.createCommandEncoder();for(const name of names){const p=e.beginComputePass();p.setPipeline(pipelines[name]);p.setBindGroup(0,groups[name]);p.dispatchWorkgroups(Math.ceil(n/64));p.end();}if(mode===0&&!resumed)e.copyBufferToBuffer(hits,0,primary,0,n*64);e.copyBufferToBuffer(hits,0,read,0,n*64);e.copyBufferToBuffer(rays,0,read,n*64,n*32);e.copyBufferToBuffer(previous,0,read,n*96,n*16);device.queue.submit([e.finish()]);await read.mapAsync(GPUMapMode.READ);const buffer=read.getMappedRange(),f=new Float32Array(buffer),u=new Uint32Array(buffer);const records=pixels.map((pixel,i)=>({pixel,t:f[i*16],distance:f[i*16+1],steps:f[i*16+2],localSteps:f[i*16+3],localPoint:Array.from(f.slice(i*16+4,i*16+7)),seed:f[i*16+7],variant:u[i*16+13],id:u[i*16+12],status:u[i*16+14],origin:Array.from(f.slice(n*16+i*8,n*16+i*8+3)),direction:Array.from(f.slice(n*16+i*8+4,n*16+i*8+7)),previous:Array.from(f.slice(n*24+i*4,n*24+i*4+4))}));read.unmap();out.passes.push({mode,resumed,elapsedMs:performance.now()-t,records});}
  try{for(let mode=0;mode<(secondary?3:1);mode++){pixels.forEach((_,i)=>queries[i*4+3]=mode);device.queue.writeBuffer(query,0,queries);await run(['origins','trace'],mode,false);if(resume)await run(['resume'],mode,true);}}
  finally{for(const b of [query,rays,primary,hits,previous,read])b.destroy();}return out;
 };
}
