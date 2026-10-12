/** Explicit 180→1024→4096 sparse continuation, stable world and field precision. */
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('diagnostic anchor:'+a.slice(0,70));return s.replace(a,b);};
export function diagnosticReceiver(s){
 s=once(s,'visibilityMaximumSteps:atomic<u32>}','visibilityMaximumSteps:atomic<u32>,extendedPrimary:atomic<u32>}');
 s=once(s,'let resuming=u.controls.y==1.;','let resuming=u.controls.y>=1.;');
 s=once(s,'let old=hits[id];startT=old.ray.x;','let old=hits[id];if(old.ray.w!=2.){return;}if(u.controls.y==2.&&u.controls.w!=1024.){atomicAdd(&stats.extendedPrimary,1u);}startT=old.ray.x;');
 return once(s,'budget=1024u;glass=old.glass;','budget=select(1024u,4096u,u.controls.y==2.);if(u.controls.w>=1024.&&u.controls.w<=8192.){budget=u32(u.controls.w);}glass=old.glass;');
}
export function diagnosticHost(s){
 const read=String.raw`
async function readTraceTile(x,y,w,h){
 const rb=device.createBuffer({size:24576,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),e=device.createCommandEncoder();e.copyBufferToBuffer(hitBuffer,0,rb,0,24576);device.queue.submit([e.finish()]);await rb.mapAsync(GPUMapMode.READ);const mapped=rb.getMappedRange(),f=new Float32Array(mapped),u=new Uint32Array(mapped),out=[];
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=(j*16+i)*24;if(f[k+3]===2)out.push({pixel:[x+i,y+j],ray:Array.from(f.slice(k,k+4)),local:Array.from(f.slice(k+4,k+8)),ids:Array.from(u.slice(k+8,k+12)),normal:Array.from(f.slice(k+12,k+16)),glass:Array.from(f.slice(k+16,k+20)),through:Array.from(f.slice(k+20,k+24))});}rb.unmap();rb.destroy();return out;
}
`;
 s=once(s,'resumeFrameBuffer,resumeBind,worldBuffer','resumeFrameBuffer,resumeBind,extendedFrameBuffer,extendedBind,worldBuffer');
 s=once(s,'device.queue.writeBuffer(resumeFrameBuffer,0,b);','device.queue.writeBuffer(resumeFrameBuffer,0,b);f[29]=2;device.queue.writeBuffer(extendedFrameBuffer,0,b);');
 s=s.replaceAll('size:40,','size:44,').replaceAll('statsBuffer,0,rb,0,40','statsBuffer,0,rb,0,44').replaceAll('new Uint32Array(10)','new Uint32Array(11)');
 s=once(s,"'visibilityMaximumSteps'].map","'visibilityMaximumSteps','extendedPrimary'].map");
 s=once(s,"['resume',4,1],['finalize'","['resume',4,1],['extended',4,1],['finalize'");
 s=once(s,"name==='resume'?resumeBind:bind","name==='extended'?extendedBind:name==='resume'?resumeBind:bind");
 s=once(s,'worldBuffer=device.createBuffer','extendedFrameBuffer=device.createBuffer({size:128,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});worldBuffer=device.createBuffer');
 s=once(s,'proof.bufferBytes={','extendedBind=device.createBindGroup({layout,entries:[extendedFrameBuffer,worldBuffer,statsBuffer,hitBuffer,retryBuffer,normalBuffer,shadingBuffer,visibilityBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});proof.bufferBytes={extendedFrame:128,');
 s=s.replace('rayStats:40','rayStats:44');
 s=once(s,'async function render(view=selected,options={})',read+'\nasync function render(view=selected,options={})');
 s=once(s,'f.set([s.debug,0,s.stoneScale,0],28);','f.set([s.debug,0,s.stoneScale,s.diagnosticTraceLimit??0],28);');
 s=once(s,'s.rect=rect;status.textContent=',`s.rect=rect;if(options.diagnosticTraceLimit!==undefined){if(!options.rect||rect[2]*rect[3]>2048||!Number.isInteger(options.diagnosticTraceLimit)||options.diagnosticTraceLimit<1024||options.diagnosticTraceLimit>8192)throw Error('diagnostic continuation requires bounded <=2048 pixel crop');s.diagnosticTraceLimit=options.diagnosticTraceLimit;}status.textContent=`);
 s=once(s,'const visibilityContinuations=[];','const visibilityContinuations=[],primaryFailures=[];let maximumTileGPUCompletionMs=0,maximumTile=null;');
 s=once(s,'if(options.visibilityDiagnostics)visibilityContinuations.push(', 'if(options.primaryDiagnostics)primaryFailures.push(...await readTraceTile(x,y,w,h));if(options.visibilityDiagnostics)visibilityContinuations.push(');
 s=once(s,'rayStatus,visibilityContinuations,snapshot:s','rayStatus,visibilityContinuations,primaryFailures,maximumTileGPUCompletionMs,maximumTile,snapshot:s');s=once(s,'write(s,[x,y,w,h]);','const tileStart=performance.now();write(s,[x,y,w,h]);');
 s=once(s,'tiles++;proof.tileProgress=', 'const tileGPUCompletionMs=performance.now()-tileStart;if(tileGPUCompletionMs>maximumTileGPUCompletionMs){maximumTileGPUCompletionMs=tileGPUCompletionMs;maximumTile=[x,y,w,h];}tiles++;proof.tileProgress=');return s;
}
