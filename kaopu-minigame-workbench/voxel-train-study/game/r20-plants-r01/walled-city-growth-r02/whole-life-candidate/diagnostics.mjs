/** QA readback/sparse continuation controls. No change to world or default budgets. */
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('diagnostic anchor:'+a.slice(0,70));return s.replace(a,b);};
export function diagnosticReceiver(s){return once(s,'budget=1024u;glass=old.glass;','budget=1024u;if(u.controls.w>=1024.&&u.controls.w<=8192.){budget=u32(u.controls.w);}glass=old.glass;');}
export function diagnosticHost(s){
 const read=String.raw`
async function readTraceTile(x,y,w,h){
 const rb=device.createBuffer({size:24576,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),e=device.createCommandEncoder();e.copyBufferToBuffer(hitBuffer,0,rb,0,24576);device.queue.submit([e.finish()]);await rb.mapAsync(GPUMapMode.READ);const f=new Float32Array(rb.getMappedRange()),u=new Uint32Array(rb.getMappedRange()),out=[];
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=(j*16+i)*24;if(f[k+3]===2)out.push({pixel:[x+i,y+j],ray:Array.from(f.slice(k,k+4)),local:Array.from(f.slice(k+4,k+8)),ids:Array.from(u.slice(k+8,k+12)),normal:Array.from(f.slice(k+12,k+16)),glass:Array.from(f.slice(k+16,k+20)),through:Array.from(f.slice(k+20,k+24))});}rb.unmap();rb.destroy();return out;
}
`;
 s=once(s,'async function render(view=selected,options={})',read+'\nasync function render(view=selected,options={})');
 s=once(s,'f.set([s.debug,0,s.stoneScale,0],28);','f.set([s.debug,0,s.stoneScale,s.diagnosticTraceLimit??0],28);');
 s=once(s,'s.rect=rect;status.textContent=',`s.rect=rect;if(options.diagnosticTraceLimit!==undefined){if(!options.rect||rect[2]*rect[3]>2048||!Number.isInteger(options.diagnosticTraceLimit)||options.diagnosticTraceLimit<1024||options.diagnosticTraceLimit>8192)throw Error('diagnostic continuation requires bounded <=2048 pixel crop');s.diagnosticTraceLimit=options.diagnosticTraceLimit;}status.textContent=`);
 s=once(s,'const visibilityContinuations=[];','const visibilityContinuations=[],primaryFailures=[];');
 s=once(s,'if(options.visibilityDiagnostics)visibilityContinuations.push(', 'if(options.primaryDiagnostics)primaryFailures.push(...await readTraceTile(x,y,w,h));if(options.visibilityDiagnostics)visibilityContinuations.push(');
 s=once(s,'rayStatus,visibilityContinuations,snapshot:s','rayStatus,visibilityContinuations,primaryFailures,snapshot:s');return s;
}
