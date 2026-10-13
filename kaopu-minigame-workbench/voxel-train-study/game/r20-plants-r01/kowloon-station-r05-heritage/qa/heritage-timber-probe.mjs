const result={status:'running',phase:'loading',cases:[],errors:[],scope:'Finite-domain original-order timber HitField equivalence; not a full-domain proof'};
window.__heritageTimberProbe=result;
const stage=name=>{result.phase=name;console.log('HERITAGE_TIMBER_STAGE '+name);};
const vertex='#version 300 es\nprecision highp float;void main(){vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));gl_Position=vec4(p[gl_VertexID],0,1);}';
async function get(name,json=false){const r=await fetch('./heritage-timber-generated/'+name);if(!r.ok)throw Error(`${name}: HTTP ${r.status}`);return json?r.json():r.text();}
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s;}
function check(buffers,m,age){
 const failures=[],winnerIDs=new Set(),maxErrors=Array(12).fill(0),fields=['d','id','seed','baseD','q.x','q.y','q.z','sourceSeed','extent.x','extent.y','extent.z','physicalD'];
 let mismatchCount=0,nonzeroDisplacement=0;
 const take=(buffer,index,variant)=>{const x=index%m.width,y=Math.floor(index/m.width)*2+variant,offset=(y*m.width+x)*4;return Array.from(buffer.slice(offset,offset+4));};
 for(let i=0;i<m.samples.length;i++){
  const source=m.samples[i],reference=buffers.slice(0,3).flatMap(b=>take(b,i,0)),candidate=buffers.slice(0,3).flatMap(b=>take(b,i,1));
  const add=message=>{mismatchCount++;if(failures.length<50)failures.push({index:i,tag:source.tag,kind:source.kind,sourceId:source.sourceId,message,reference,candidate});};
  if(![...reference,...candidate].every(Number.isFinite)){add('Nonfinite HitField');continue;}
  for(let k=0;k<12;k++){
   const error=Math.abs(reference[k]-candidate[k]);maxErrors[k]=Math.max(maxErrors[k],error);
   const exact=[1,2,7].includes(k);if(error>(exact?0:m.toleranceM))add(`${fields[k]} differs by ${error}`);
  }
  for(let variant=0;variant<2;variant++){
   const h=variant?candidate:reference,identity=take(buffers[3],i,variant);
   if(identity[3]!==source.tag||source.p.some((p,k)=>identity[k]!==Math.fround(p)))add('Input point/tag readback mismatch');
   if(h[1]!==4||h[2]!==172||!m.timberMembers.some(member=>member.member===h[7]))add('Invalid timber ID, role or winner');
   if(h[0]!==h[3]||h.slice(8,11).some(x=>!(x>0)))add('Returned raw winner/baseD or extents invalid');
  }
  winnerIDs.add(reference[7]);if(Math.abs(reference[11]-reference[3])>1e-9)nonzeroDisplacement++;
 }
 if(!nonzeroDisplacement){mismatchCount++;failures.push({message:'All physical distances equal raw distances'});}
 return {age,samples:m.samples.length,mismatchCount,failures,maxErrors:Object.fromEntries(fields.map((name,i)=>[name,maxErrors[i]])),nonzeroDisplacement,winnerIDs:[...winnerIDs].sort((a,b)=>a-b),buffers:buffers.map(b=>Array.from(b))};
}
async function main(){
 const manifest=await get('manifest.json',true),fragment=await get('probe.frag');result.manifest=manifest;
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{antialias:false});
 if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 RGBA32F unavailable');
 if(gl.getParameter(gl.MAX_DRAW_BUFFERS)<4||gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)<4)throw Error('Four float MRT outputs required');
 canvas.addEventListener('webglcontextlost',()=>{result.errors.push('WebGL context lost');result.status='failed';});
 const debug=gl.getExtension('WEBGL_debug_renderer_info');result.backend={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
 stage('compile');const started=performance.now(),program=gl.createProgram(),vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
 const parallel=gl.getExtension('KHR_parallel_shader_compile');
 if(parallel)while(!gl.getProgramParameter(program,parallel.COMPLETION_STATUS_KHR)){if(performance.now()-started>240000)throw Error('Shader compile exceeded 240000ms');await new Promise(r=>setTimeout(r,25));}
 result.compile={vertexOK:gl.getShaderParameter(vs,gl.COMPILE_STATUS),fragmentOK:gl.getShaderParameter(fs,gl.COMPILE_STATUS),linkOK:gl.getProgramParameter(program,gl.LINK_STATUS),vertexLog:gl.getShaderInfoLog(vs),fragmentLog:gl.getShaderInfoLog(fs),linkLog:gl.getProgramInfoLog(program),durationMs:performance.now()-started};
 if(result.compile.durationMs>240000)throw Error('Shader compile exceeded 240000ms');
 if(!result.compile.vertexOK||!result.compile.fragmentOK||!result.compile.linkOK)throw Error('Shader compile/link failed: '+JSON.stringify(result.compile));
 stage('readback');gl.useProgram(program);
 const blocks=gl.getProgramParameter(program,gl.ACTIVE_UNIFORM_BLOCKS);if(blocks!==1)throw Error(`Expected one Params block, got ${blocks}`);
 const blockSize=gl.getActiveUniformBlockParameter(program,0,gl.UNIFORM_BLOCK_DATA_SIZE);if(blockSize!==80)throw Error(`Expected 80-byte Params block, got ${blockSize}`);
 const ub=gl.createBuffer();gl.bindBuffer(gl.UNIFORM_BUFFER,ub);gl.bufferData(gl.UNIFORM_BUFFER,blockSize,gl.DYNAMIC_DRAW);gl.uniformBlockBinding(program,0,0);gl.bindBufferBase(gl.UNIFORM_BUFFER,0,ub);
 const {width,inputHeight,outputHeight}=manifest,points=new Float32Array(width*inputHeight*4);
 manifest.samples.forEach((sample,i)=>points.set([...sample.p,sample.tag],i*4));
 const input=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,width,inputHeight);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,inputHeight,gl.RGBA,gl.FLOAT,points);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 const samplers=[];for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const uniform=gl.getActiveUniform(program,i);if(uniform.type===gl.SAMPLER_2D)samplers.push(uniform.name);}
 if(samplers.length!==1)throw Error(`Expected one point texture, got ${samplers.length}`);gl.uniform1i(gl.getUniformLocation(program,samplers[0]),0);
 const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);const textures=[];
 for(let i=0;i<4;i++){const texture=gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,width,outputHeight);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,texture,0);}
 gl.drawBuffers([0,1,2,3].map(i=>gl.COLOR_ATTACHMENT0+i));if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Float MRT target incomplete');
 gl.bindTexture(gl.TEXTURE_2D,input);gl.viewport(0,0,width,outputHeight);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const readbackStart=performance.now();
 for(const age of manifest.ages){
  if(performance.now()-readbackStart>120000)throw Error('Readback exceeded 120000ms');
  const p=new Float32Array([-20,2.5,4.2,age,0,0,-1,.43,1,0,0,1.5,0,1,0,0,width,outputHeight,0,0]);gl.bufferSubData(gl.UNIFORM_BUFFER,0,p);
  for(let i=0;i<4;i++)gl.clearBufferfv(gl.COLOR,i,new Float32Array([-999,-999,-999,-999]));gl.drawArrays(gl.TRIANGLES,0,3);
  const buffers=[];for(let i=0;i<4;i++){gl.readBuffer(gl.COLOR_ATTACHMENT0+i);const values=new Float32Array(width*outputHeight*4);gl.readPixels(0,0,width,outputHeight,gl.RGBA,gl.FLOAT,values);buffers.push(values);}
  const error=gl.getError();if(error)throw Error('WebGL error '+error);result.cases.push(check(buffers,manifest,age));
 }
 result.readbackMs=performance.now()-readbackStart;if(result.readbackMs>120000)throw Error('Readback exceeded 120000ms');
 result.status=result.cases.some(c=>c.mismatchCount)||result.errors.length?'failed':'passed';stage('complete');document.querySelector('#status').textContent=result.status;
 gl.deleteVertexArray(vao);gl.deleteFramebuffer(fbo);textures.forEach(t=>gl.deleteTexture(t));gl.deleteTexture(input);gl.deleteBuffer(ub);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
}
main().catch(e=>{result.failure=e.stack||String(e);result.status='failed';console.error(result.failure);});
