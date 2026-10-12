const selected=new URLSearchParams(location.search).get('variant');
if(!['reference','capacity','hierarchy'].includes(selected))throw Error('Explicit isolated variant required');
const report={variant:selected,status:'running',stage:'fetch',timings:[],comparisons:[],errors:[],scope:'original hall physical GeometryHit and source material identity, small samples only'};
const send=async()=>{document.querySelector('#status').textContent=JSON.stringify({status:report.status,stage:report.stage});await window.__hierarchyReport(structuredClone(report));};
const stage=async s=>{report.stage=s;console.log('HALL_HIERARCHY_STAGE '+s);await send();};
const text=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error(p+' HTTP '+r.status);return r.text();};
const params=(age,mode,w)=>new Float32Array([-20,2.5,4.2,age,0,0,-1,.43,1,0,0,1.5,0,1,0,mode,w,1,0,0]);
try{
 const manifest=JSON.parse(await text('./generated/manifest.json')),width=manifest.points.length,canvas=document.createElement('canvas');canvas.width=width;canvas.height=1;
 const gl=canvas.getContext('webgl2',{antialias:false});if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 float attachments unavailable');
 canvas.addEventListener('webglcontextlost',()=>{report.errors.push('webglcontextlost');});
 const debug=gl.getExtension('WEBGL_debug_renderer_info');report.adapter=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);report.points=width;report.originalSourceSHA256=manifest.originalSourceSHA256;report.variants=manifest.variants;report.hierarchy=manifest.hierarchy;
 const parallel=gl.getExtension('KHR_parallel_shader_compile'),programs={},vertex='#version 300 es\nprecision highp float;void main(){vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));gl_Position=vec4(p[gl_VertexID],0,1);}';
 for(const name of[selected]){
  const frag=await text('./generated/'+name+'.frag'),start=performance.now();await stage('compile-'+name);const program=gl.createProgram(),shaders=[];
  for(const[type,code]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,frag]]){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);gl.attachShader(program,s);shaders.push(s);}gl.linkProgram(program);
  if(parallel)while(!gl.getProgramParameter(program,parallel.COMPLETION_STATUS_KHR)){if(gl.isContextLost())throw Error('Lost during compilation');await new Promise(r=>setTimeout(r,20));}
  for(const s of shaders)if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  let buffer=null;for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORM_BLOCKS);i++){const n=gl.getActiveUniformBlockName(program,i);if(!/^Params(?:_|$)/.test(n))throw Error('Unexpected block '+n);buffer=gl.createBuffer();gl.bindBuffer(gl.UNIFORM_BUFFER,buffer);gl.bufferData(gl.UNIFORM_BUFFER,gl.getActiveUniformBlockParameter(program,i,gl.UNIFORM_BLOCK_DATA_SIZE),gl.DYNAMIC_DRAW);gl.uniformBlockBinding(program,i,0);}
  if(!buffer)throw Error('Physical state UBO missing');let sampler=null;for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const a=gl.getActiveUniform(program,i);if(a.type===gl.SAMPLER_2D){if(!/group_1_binding_0/.test(a.name)||sampler)throw Error('Unexpected point sampler '+a.name);sampler=gl.getUniformLocation(program,a.name);gl.uniform1i(sampler,0);}}
  if(sampler===null)throw Error('Point input absent');programs[name]={program,buffer,compileAndLinkMs:performance.now()-start,draws:0};
 }
 const input=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input);const values=new Float32Array(width*4);manifest.points.forEach((p,i)=>values.set([...p,1],i*4));gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,width,1,0,gl.RGBA,gl.FLOAT,values);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);const attachments=[];for(let i=0;i<4;i++){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,width,1);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0);attachments.push(gl.COLOR_ATTACHMENT0+i);}gl.drawBuffers(attachments);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('MRT incomplete');gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input);gl.viewport(0,0,width,1);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.bindVertexArray(gl.createVertexArray());
 const same=(a,b)=>{const x=new Uint32Array(a.buffer),y=new Uint32Array(b.buffer);let mismatches=0,first=[];for(let i=0;i<width;i++)for(let c=0;c<13;c++)if(x[i*16+c]!==y[i*16+c]){mismatches++;if(first.length<10)first.push({point:i,label:manifest.labels[i],channel:c,left:a[i*16+c],right:b[i*16+c],leftBits:x[i*16+c],rightBits:y[i*16+c]});}return{mismatches,first};};
 for(const age of[.05])for(const mode of[0]){const previous={};for(let repeat=0;repeat<manifest.repeats;repeat++){const pair={};for(const name of[selected]){
   await stage(`draw-${name}-${age}-${mode}-${repeat}`);const p=programs[name];report.uniformBits=Array.from(new Uint32Array(params(age,mode,width).buffer));gl.useProgram(p.program);gl.bindBuffer(gl.UNIFORM_BUFFER,p.buffer);gl.bufferSubData(gl.UNIFORM_BUFFER,0,params(age,mode,width));gl.bindBufferBase(gl.UNIFORM_BUFFER,0,p.buffer);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input);
   const t=performance.now();gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();const returned=performance.now();
   const drawError=gl.getError(),drawContextLost=gl.isContextLost(),combined=new Float32Array(width*16),attachmentErrors=[];
   for(let a=0;a<4;a++){const data=new Float32Array(width*4);gl.readBuffer(gl.COLOR_ATTACHMENT0+a);gl.readPixels(0,0,width,1,gl.RGBA,gl.FLOAT,data);attachmentErrors.push(gl.getError());for(let i=0;i<width;i++)combined.set(data.subarray(i*4,i*4+4),i*16+a*4);}
   const readbackReturned=performance.now(),contextLost=gl.isContextLost(),nonFinite=[];let nonFiniteCount=0,nonZeroCount=0;
   for(let i=0;i<combined.length;i++){if(!Number.isFinite(combined[i])){nonFiniteCount++;if(nonFinite.length<10)nonFinite.push({point:Math.floor(i/16),channel:i%16,bits:new Uint32Array(combined.buffer)[i]});}if(combined[i]!==0)nonZeroCount++;}
   const validity={drawError,drawContextLost,attachmentErrors,contextLost,nonFiniteCount,nonFinite,allZero:nonZeroCount===0};
   const failed=drawError!==gl.NO_ERROR||drawContextLost||attachmentErrors.some(x=>x!==gl.NO_ERROR)||contextLost||nonFiniteCount>0||nonZeroCount===0;
   // Preserve exact IEEE bits, including invalid values, BEFORE a failure is raised.
   await window.__saveHierarchyField({name:name+'-'+age+'-'+mode+'-'+repeat,bits:Array.from(new Uint32Array(combined.buffer))});
   report.readbacks??=[];report.readbacks.push({name,age,mode,repeat,...validity});
   report.lastDraw={name,age,mode,repeat,drawThroughReadbackMs:readbackReturned-t,submitAndFinishReturnMs:returned-t,readbackMs:readbackReturned-returned};
   if(failed){await send();throw Error('Invalid readback: '+JSON.stringify(validity));}
   let nodes=0,blocks=0,skipped=0,overflows=0;for(let i=0;i<width;i++){overflows+=combined[i*16+12];nodes+=combined[i*16+13];blocks+=combined[i*16+14];skipped+=combined[i*16+15];}if(overflows)throw Error('Candidate overflow in original field');
   report.timings.push({name,age,mode,repeat,cold:p.draws++===0,...report.lastDraw,nodes,blocks,skipped});pair[name]=combined;
   if(previous[name]){const c=same(previous[name],combined);if(c.mismatches)throw Error('Same-state repeated field changed '+JSON.stringify(c));}else previous[name]=combined;

  }await send();}}
 report.programs=Object.fromEntries(Object.entries(programs).map(([n,p])=>[n,{compileAndLinkMs:p.compileAndLinkMs,draws:p.draws}]));report.status='isolated-field-and-warm-cost-measured';report.remaining=['full station visual acceptance','complete ray/normal/shadow integration','hardware interactive cost'];await stage('complete');
}catch(error){report.status='failed';report.failure=error.stack||String(error);await send();}
