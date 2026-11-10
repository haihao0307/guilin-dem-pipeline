// Scheduling only. Source yarn functions, sample counts and solver limits are untouched.
// Slow software adapters receive bounded query submissions to avoid long GPU-process stalls.
// Hardware adapters retain the original command batching. This does not select a CPU backend.
{
 const anchor='fn linearId(id:vec3<u32>)->u32{return id.x+id.y*16384u;}';
 if(window.KNIT_WGSL.split(anchor).length!==2)throw Error('Dispatch offset anchor changed');
 window.KNIT_WGSL=window.KNIT_WGSL.replace(anchor,'fn linearId(id:vec3<u32>)->u32{return id.x+id.y*16384u+g.info.w;}');
 const originalParams=KnitCompare.prototype.params,originalExecute=KnitCompare.prototype.execute,originalMeta=KnitCompare.prototype.metadata;
 const software=e=>/swiftshader|llvmpipe|software|lavapipe/i.test(JSON.stringify(e.adapter))||e.adapter?.isFallbackAdapter===true;
 KnitCompare.prototype.params=function(mode,base=0){const raw=originalParams.call(this,mode);new Uint32Array(raw)[55]=base;return raw;};
 KnitCompare.prototype.metadata=function(){return {...originalMeta.call(this),executionScheduling:{softwareQueryBatchPixels:software(this)?1024:null,triangleDraws:0,sourceFunctionChanged:false,qualityReduction:false}};};
 KnitCompare.prototype.execute=async function(steps,{canvas=-1,prep=false,target=this.shadowTarget,timed=false}={}){
  if(!software(this))return originalExecute.call(this,steps,{canvas,prep,target,timed});
  if(this.failed)throw Error(this.failed);
  const d=this.device,work=[],start=performance.now(),frozen=new Map(steps.map(([name,count,mode])=>[mode,originalParams.call(this,mode)]));
  for(const [name,count,mode] of steps){const batch=name==='query'?1024:count;for(let base=0;base<count;base+=batch)work.push({name,count:Math.min(batch,count-base),mode,base});}
  let qs,rb,read;const stages=[];
  if(timed&&this.timestamp){qs=d.createQuerySet({type:'timestamp',count:work.length*2});rb=d.createBuffer({size:work.length*16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});read=d.createBuffer({size:work.length*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});}
  for(let i=0;i<work.length;i++){
   const task=work[i],encoder=d.createCommandEncoder();const parameters=frozen.get(task.mode).slice(0);new Uint32Array(parameters)[55]=task.base;d.queue.writeBuffer(this.uniform,0,parameters);
   const pass=encoder.beginComputePass(qs?{timestampWrites:{querySet:qs,beginningOfPassWriteIndex:i*2,endOfPassWriteIndex:i*2+1}}:{});
   pass.setPipeline(this.pipelines[task.name]);pass.setBindGroup(0,this.group(0,prep,target));const groups=Math.ceil(task.count/64);pass.dispatchWorkgroups(Math.min(groups,256),Math.ceil(groups/256));pass.end();
   if(i===work.length-1){if(canvas>=0)encoder.copyTextureToTexture({texture:this.output},{texture:this.contexts[canvas].getCurrentTexture()},[this.w,this.h]);if(qs){encoder.resolveQuerySet(qs,0,work.length*2,rb,0);encoder.copyBufferToBuffer(rb,0,read,0,work.length*16);}}
   d.queue.submit([encoder.finish()]);await d.queue.onSubmittedWorkDone();if(this.failed)throw Error(this.failed);
  }
  const wall=performance.now()-start;
  if(read){await read.mapAsync(GPUMapMode.READ);const x=new BigUint64Array(read.getMappedRange());for(let i=0;i<work.length;i++){const ms=Number(x[i*2+1]-x[i*2])/1e6;let item=stages.at(-1);if(item?.stage===work[i].name)item.ms+=ms;else stages.push({stage:work[i].name,ms});}read.unmap();read.destroy();rb.destroy();qs.destroy();}
  return {completedWallMs:wall,gpuMs:stages.length?stages.reduce((s,x)=>s+x.ms,0):null,stages,submissionCount:work.length,softwareQueryBatchPixels:1024};
 };
}
