import {loadWorld} from '../../runtime/world-data.mjs';import {GEOMETRY_WGSL} from '../../runtime/geometry.mjs';import {withoutAcceleration,BOUND_DIAGNOSTIC_WGSL} from './reference.mjs';
const proof={status:'starting',errors:[],records:[],checks:[],scope:'sparse accelerated versus all-floor same-formula macro queries; no scene rendering or mother-field changes'};window.__boundProbe=proof;
const log=(stage,data={})=>{console.log('BOUND_PROGRESS',JSON.stringify({stage,...data}));window.__qaProgress?.({stage,...data});};
const assert=(condition,message)=>{proof.checks.push({pass:!!condition,message});if(!condition)proof.errors.push(message);};
(async()=>{try{
 if(!navigator.gpu)throw Error('navigator.gpu absent');const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('adapter absent');const device=await adapter.requestDevice();proof.adapter={vendor:adapter.info.vendor,architecture:adapter.info.architecture};device.addEventListener('uncapturederror',e=>proof.errors.push(e.error.message));log('device');
 const response=await fetch(new URL('./points.json',import.meta.url));if(!response.ok)throw Error('point fixtures HTTP'+response.status);const fixture=await response.json(),points=fixture.points,n=points.length,packed=loadWorld();
 const world=device.createBuffer({size:packed.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(world,0,packed);const input=new Float32Array(points.flatMap(x=>[...x.p,0])),pb=device.createBuffer({size:input.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(pb,0,input);
 const run=async(reference)=>{const code=(reference?withoutAcceleration(GEOMETRY_WGSL):GEOMETRY_WGSL)+'\n'+BOUND_DIAGNOSTIC_WGSL,module=device.createShaderModule({code}),info=await module.getCompilationInfo();if(info.messages.some(x=>x.type==='error'))throw Error(info.messages.map(x=>x.message).join('\n'));const start=performance.now(),pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'macroProbe'}});log(reference?'reference-pipeline':'accelerated-pipeline',{ms:performance.now()-start});const out=device.createBuffer({size:n*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),rb=device.createBuffer({size:n*32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:pb}},{binding:1,resource:{buffer:world}},{binding:2,resource:{buffer:out}}]});const enc=device.createCommandEncoder(),pass=enc.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(n/32));pass.end();enc.copyBufferToBuffer(out,0,rb,0,n*32);device.queue.submit([enc.finish()]);await rb.mapAsync(GPUMapMode.READ);const a=Array.from(new Float32Array(rb.getMappedRange()));rb.unmap();out.destroy();rb.destroy();return Array.from({length:n},(_,i)=>({d:a[i*8],materialId:a[i*8+1],buildingId:a[i*8+2],componentId:a[i*8+3],stateId:a[i*8+4],boundKind:a[i*8+5],sourceIndex:a[i*8+6],boundD:a[i*8+7]}));};
 const accelerated=await run(false),reference=await run(true);let branchMismatchCount=0,maxSurfaceError=0;
 for(let i=0;i<n;i++){
  const p=points[i],a=accelerated[i],b=reference[i],refError=Math.abs(b.d-p.reference.d);assert(b.materialId>0&&refError<=.0001,`point ${i}: all-floor GPU reference agrees with same CPU formulas`);maxSurfaceError=Math.max(maxSurfaceError,refError);
  const mismatch=a.materialId!==p.accelerated.materialId||Math.abs(a.d-p.accelerated.d)>.0001;if(mismatch)branchMismatchCount++;
  if(a.materialId>0){assert(Math.abs(a.d-b.d)<=.0001,`point ${i}: accelerated real surface agrees with full reference`);}
  else{
   // Only this reviewed B02 envelope is eligible. Other bounds, bridge bounds or
   // 1m caps must fail rather than borrowing its containment proof.
   assert(a.boundKind===1&&a.buildingId===5&&a.componentId===0&&a.stateId===0&&a.sourceIndex===4,`point ${i}: exact reviewed building bound identity`);
   assert(Math.abs(a.d-a.boundD)<=.00001&&a.boundD>Math.fround(.30),`point ${i}: reported distance equals active source AABB`);
   assert(a.boundD>=0&&a.boundD<=b.d+.00001,`point ${i}: bound conservative versus independent all-floor GPU reference`);
  }
  proof.records.push({p:p.p,fixtureKind:p.kind,cpuAccelerated:p.accelerated,cpuReference:p.reference,accelerated:a,reference:b,refError,branchMismatch:mismatch});
 }
 proof.summary={points:n,branchMismatchCount,maxSurfaceErrorM:maxSurfaceError,disposition:'bounded branch differences recorded separately; no broad tolerance increase',containment:'B02 same authored components: outward rotating door bound .920309m <1.05m; roof maximum +1.072m <+1.15m; reference query removes all acceleration guards'};proof.status=proof.errors.length?'failed':'complete';log('complete',proof.summary);
}catch(e){proof.errors.push(e.stack??String(e));proof.status='failed';console.error(e);}})();
