const result={status:'running',phase:'loading',cases:[],errors:[],scope:'Finite-domain original-order timber HitField equivalence; not a full-domain proof'};
window.__heritageTimberProbe=result;
const stage=name=>{result.phase=name;console.log('HERITAGE_TIMBER_STAGE '+name);};
const vertex='#version 300 es\nprecision highp float;void main(){vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));gl_Position=vec4(p[gl_VertexID],0,1);}';
async function get(name,json=false){const r=await fetch('./heritage-timber-generated/'+name);if(!r.ok)throw Error(`${name}: HTTP ${r.status}`);return json?r.json():r.text();}
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s;}
function check(referenceBuffers,candidateBuffers,m,age){
 const failures=[],winnerIDs=new Set(),maxErrors=Array(12).fill(0),fields=['d','id','seed','baseD','q.x','q.y','q.z','sourceSeed','extent.x','extent.y','extent.z','physicalD'];
 let mismatchCount=0,nonzeroDisplacement=0;
 const take=(buffer,index)=>Array.from(buffer.slice(index*4,index*4+4));
 for(let i=0;i<m.samples.length;i++){
  const source=m.samples[i],reference=referenceBuffers.slice(0,3).flatMap(b=>take(b,i)),candidate=candidateBuffers.slice(0,3).flatMap(b=>take(b,i));
  const add=message=>{mismatchCount++;if(failures.length<50)failures.push({index:i,tag:source.tag,kind:source.kind,sourceId:source.sourceId,message,reference,candidate});};
  if(![...reference,...candidate].every(Number.isFinite)){add('Nonfinite HitField');continue;}
  for(let k=0;k<12;k++){
   const error=Math.abs(reference[k]-candidate[k]);maxErrors[k]=Math.max(maxErrors[k],error);
   const exact=[1,2,7].includes(k);if(error>(exact?0:m.toleranceM))add(`${fields[k]} differs by ${error}`);
  }
  for(let variant=0;variant<2;variant++){
   const h=variant?candidate:reference,identity=take((variant?candidateBuffers:referenceBuffers)[3],i);
   if(identity[3]!==source.tag||source.p.some((p,k)=>identity[k]!==Math.fround(p)))add('Input point/tag readback mismatch');
   if(h[1]!==4||h[2]!==172||!m.timberMembers.some(member=>member.member===h[7]))add('Invalid timber ID, role or winner');
   if(h[0]!==h[3]||h.slice(8,11).some(x=>!(x>0)))add('Returned raw winner/baseD or extents invalid');
  }
  winnerIDs.add(reference[7]);if(Math.abs(reference[11]-reference[3])>1e-9)nonzeroDisplacement++;
 }
 if(!nonzeroDisplacement){mismatchCount++;failures.push({message:'All physical distances equal raw distances'});}
 return {age,samples:m.samples.length,mismatchCount,failures,maxErrors:Object.fromEntries(fields.map((name,i)=>[name,maxErrors[i]])),nonzeroDisplacement,winnerIDs:[...winnerIDs].sort((a,b)=>a-b),referenceBuffers:referenceBuffers.map(b=>Array.from(b)),candidateBuffers:candidateBuffers.map(b=>Array.from(b))};
}
async function main(){
 const manifest=await get('manifest.json',true);result.manifest=manifest;result.programs=[];
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{antialias:false});
 if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 RGBA32F unavailable');
 if(gl.getParameter(gl.MAX_DRAW_BUFFERS)<4||gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)<4)throw Error('Four float MRT outputs required');
 let lost=false;canvas.addEventListener('webglcontextlost',()=>{lost=true;result.errors.push('WebGL context lost');result.status='failed';});
 const ensure=()=>{if(lost||gl.isContextLost())throw Error('WebGL context lost; invalid readbacks rejected');};
 const debug=gl.getExtension('WEBGL_debug_renderer_info');result.backend={version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
 stage('compile');const started=performance.now(),programs=[];
 for(const spec of manifest.programs){
  const fragment=await get(spec.name+'.frag'),program=gl.createProgram(),vs=shader(gl,gl.VERTEX_SHADER,vertex),fs=shader(gl,gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  const parallel=gl.getExtension('KHR_parallel_shader_compile');if(parallel)while(!gl.getProgramParameter(program,parallel.COMPLETION_STATUS_KHR)){ensure();if(performance.now()-started>240000)throw Error('Shader frontend compilation exceeded 240000ms');await new Promise(r=>setTimeout(r,25));}
  const status={name:spec.name,vertexOK:gl.getShaderParameter(vs,gl.COMPILE_STATUS),fragmentOK:gl.getShaderParameter(fs,gl.COMPILE_STATUS),linkOK:gl.getProgramParameter(program,gl.LINK_STATUS),vertexLog:gl.getShaderInfoLog(vs),fragmentLog:gl.getShaderInfoLog(fs),linkLog:gl.getProgramInfoLog(program)};result.programs.push(status);
  if(!status.vertexOK||!status.fragmentOK||!status.linkOK)throw Error('Shader front-end failed: '+JSON.stringify(status));
  const count=gl.getProgramParameter(program,gl.ACTIVE_UNIFORM_BLOCKS);if(count!==1)throw Error('Expected one Params block');if(gl.getActiveUniformBlockParameter(program,0,gl.UNIFORM_BLOCK_DATA_SIZE)!==80)throw Error('Params size changed');gl.uniformBlockBinding(program,0,0);
  const samplers=[];for(let i=0;i<gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(program,i);if(u.type===gl.SAMPLER_2D){const match=/group_0_binding_(\d+)_/.exec(u.name);if(!match)throw Error('Unknown sampler '+u.name);samplers.push({location:gl.getUniformLocation(program,u.name),binding:Number(match[1])});}}
  if(!samplers.some(x=>x.binding===1)||samplers.some(x=>x.binding<1||x.binding>4))throw Error('Invalid sampler bindings');programs.push({program,vs,fs,samplers,name:spec.name});
 }
 result.frontendCompileMs=performance.now()-started;stage('readback');ensure();
 const {width,inputHeight:height}=manifest,points=new Float32Array(width*height*4);manifest.samples.forEach((sample,i)=>points.set([...sample.p,sample.tag],i*4));
 const input=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,width,height);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,height,gl.RGBA,gl.FLOAT,points);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
 const target=()=>{const fbo=gl.createFramebuffer(),textures=[];gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);for(let i=0;i<4;i++){const t=gl.createTexture();textures.push(t);gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,width,height);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0);}gl.drawBuffers([0,1,2,3].map(i=>gl.COLOR_ATTACHMENT0+i));if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Incomplete MRT target');return{fbo,textures};};
 const targets=[target(),target(),target()],ub=gl.createBuffer();gl.bindBuffer(gl.UNIFORM_BUFFER,ub);gl.bufferData(gl.UNIFORM_BUFFER,80,gl.DYNAMIC_DRAW);gl.bindBufferBase(gl.UNIFORM_BUFFER,0,ub);gl.viewport(0,0,width,height);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.bindVertexArray(gl.createVertexArray());
 const read=target=>{ensure();gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);const buffers=[];for(let i=0;i<4;i++){gl.readBuffer(gl.COLOR_ATTACHMENT0+i);const values=new Float32Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,values);buffers.push(values);}ensure();if(buffers[3][3]!==1)throw Error('Invalid point tag/full-zero GPU result rejected');return buffers;};
 const readbackStart=performance.now();result.draws=[];
 for(const age of manifest.ages){
  gl.bufferSubData(gl.UNIFORM_BUFFER,0,new Float32Array([-20,2.5,4.2,age,0,0,-1,.43,1,0,0,1.5,0,1,0,0,width,height,0,0]));
  for(let i=0;i<17;i++){
   ensure();if(performance.now()-readbackStart>240000)throw Error('All GPU draws/readback exceeded 240000ms');
   const p=programs[i],dst=targets[i===16?2:i%2],src=targets[1-i%2],t=performance.now();gl.useProgram(p.program);gl.bindFramebuffer(gl.FRAMEBUFFER,dst.fbo);
   for(const s of p.samplers){gl.activeTexture(gl.TEXTURE0+s.binding-1);const tex=s.binding===1?input:src.textures[s.binding-2];if(dst.textures.includes(tex))throw Error('Read/write feedback rejected');gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(s.location,s.binding-1);}
   console.log('HERITAGE_TIMBER_DRAW '+JSON.stringify({name:p.name,age}));gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();ensure();const error=gl.getError();if(error)throw Error('WebGL draw error '+error);result.draws.push({name:p.name,age,completedMs:performance.now()-t});
  }
  result.cases.push(check(read(targets[1]),read(targets[2]),manifest,age));
 }
 result.readbackMs=performance.now()-readbackStart;if(result.readbackMs>240000)throw Error('All GPU draws/readback exceeded 240000ms');result.status=result.cases.some(c=>c.mismatchCount)||result.errors.length?'failed':'passed';stage('complete');document.querySelector('#status').textContent=result.status;
}
main().catch(e=>{result.failure=e.stack||String(e);result.status='failed';console.error(result.failure);});
