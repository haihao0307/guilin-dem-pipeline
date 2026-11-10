// Preserve the source field, every pixel and both AA samples; only bound command duration.
// No adapter selection or CPU fallback is performed here.
{
 const originalRun=run, originalMetadata=metadata;
 const software=()=>/swiftshader|llvmpipe|lavapipe|software/i.test(JSON.stringify(adapterInfo))||adapterInfo?.isFallbackAdapter===true;
 metadata=function(){return {...originalMetadata(),scheduling:{softwareRenderRows:software()?8:null,pixelsOrQualityReduced:false,softwareWallIncludesSubmissionOverhead:true}};};
 run=async function(options={}){
  if(!software()||options.onlyControl)return originalRun(options);
  if(failed)throw Error('GPU已停止');
  const {m=mode,forceAll=locked,forceEager=eager,present=false}=options;
  const start=performance.now(),raw=parameters(m,forceAll,forceEager),w=width,h=height,steps=1+Math.ceil(h/8),group=bind();
  let qs,res,read;
  if(timestamps){qs=device.createQuerySet({type:'timestamp',count:steps*2});res=buffer(steps*16,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC);read=buffer(steps*16,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);}
  try{
   for(let i=0;i<steps;i++){
    const local=raw.slice(0);new Uint32Array(local)[31]=i===0?0:(i-1)*8;
    device.queue.writeBuffer(buffers.uniform,0,local);
    const enc=device.createCommandEncoder(),p=enc.beginComputePass(qs?{timestampWrites:{querySet:qs,beginningOfPassWriteIndex:i*2,endOfPassWriteIndex:i*2+1}}:{});
    p.setPipeline(pipelines[i===0?'controls':'render']);p.setBindGroup(0,group);
    p.dispatchWorkgroups(Math.ceil(w/8),i===0?Math.ceil(h/8):1);p.end();
    if(i===steps-1){
     if(present)enc.copyTextureToTexture({texture:tex},{texture:context.getCurrentTexture()},[w,h]);
     if(qs){enc.resolveQuerySet(qs,0,steps*2,res,0);enc.copyBufferToBuffer(res,0,read,0,steps*16);}
    }
    device.queue.submit([enc.finish()]);await device.queue.onSubmittedWorkDone();
    if(failed)throw Error('GPU执行失败');
   }
   const wallMs=performance.now()-start;let policyMs=null,renderMs=null;
   if(read){await read.mapAsync(GPUMapMode.READ);const t=new BigUint64Array(read.getMappedRange());policyMs=Number(t[1]-t[0])/1e6;renderMs=0;for(let i=1;i<steps;i++)renderMs+=Number(t[i*2+1]-t[i*2])/1e6;read.unmap();}
   return {wallMs,policyMs,renderMs,gpuMs:renderMs===null?null:policyMs+renderMs,controllerRepeat:1,submissionCount:steps,softwareRenderRows:8};
  }finally{read?.destroy();res?.destroy();qs?.destroy();}
 };
 window.KnitDistance.run=run;
}
