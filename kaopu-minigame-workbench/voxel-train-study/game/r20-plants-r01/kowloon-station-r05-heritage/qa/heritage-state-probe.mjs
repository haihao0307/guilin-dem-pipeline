// Raw WebGL2/float readback only. No scene, alternative material, or image path.
const result={status:'running',phase:'loading',cases:[],errors:[],scope:'same-production-closure numeric state consistency; not visual or performance acceptance'};
window.__heritageStateProbe=result;
const vertex='#version 300 es\nprecision highp float;void main(){vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));gl_Position=vec4(p[gl_VertexID],0,1);}';
const stage=name=>{result.phase=name;console.log('HERITAGE_STATE_STAGE '+name);};
async function get(name,json=false){const r=await fetch('./heritage-state-generated/'+name);if(!r.ok)throw Error(`${name}: HTTP ${r.status}`);return json?r.json():r.text();}
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s;}
function params(age,width,height){return new Float32Array([-20,2.5,4.2,age,0,0,-1,.43,1,0,0,1.5,0,1,0,0,width,height,0,0]);}
function check(values,age,m){
 const rows=[],failures=[],{width,height}=m;
 if(values.length!==width*height*4)throw Error('Readback length mismatch');
 for(let i=0;i<width;i++){
  const take=row=>Array.from(values.slice((row*width+i)*4,(row*width+i+1)*4));
  const a=take(0),b=take(1),c=take(2),s=take(3),fixture=m.fixtures[i];
  const row={name:fixture.name,geometryD:a[0],matterD:a[1],layer:a[2],sampleTag:a[3],albedo:b.slice(0,3),roughness:b[3],microHeight:c[0],loss:c[1],thickness:c[2],baseD:c[3],memberState:{age:s[0],wet:s[1],repair:s[2],retained:s[3]},distanceError:Math.abs(a[0]-a[1])};
  if(![...a,...b,...c,...s].every(Number.isFinite))failures.push(`${fixture.name}: nonfinite output`);
  if(row.distanceError>m.toleranceM)failures.push(`${fixture.name}: geometry/matter distance error ${row.distanceError}`);
  if(a[3]!==i+1)failures.push(`${fixture.name}: sample tag ${a[3]}`);
  if(!fixture.layers.includes(a[2]))failures.push(`${fixture.name}: layer ${a[2]}`);
  if(Math.abs(c[3]-fixture.baseD)>m.toleranceM)failures.push(`${fixture.name}: nominal distance readback`);
  if(b.slice(0,3).every(x=>Math.abs(x)<1e-9)||!(b[3]>0&&b[3]<=1))failures.push(`${fixture.name}: empty/invalid material output`);
  const expectedAge=fixture.name.startsWith('heritage-')?Math.min(1,.32+age*.78):age;
  if(Math.abs(s[0]-expectedAge)>2e-7)failures.push(`${fixture.name}: age uniform/state mapping ${s[0]}`);
  if(fixture.brickIdentity){
   const actual=take(4),expected=fixture.brickIdentity;
   row.brickIdentity={q:actual.slice(0,3),seed:actual[3],row:expected.row,column:expected.column};
   if(!actual.every(Number.isFinite))failures.push(`${fixture.name}: nonfinite production brick coordinates/seed`);
   if(actual[3]!==expected.seed)failures.push(`${fixture.name}: actual production brick seed ${actual[3]} != ${expected.seed}`);
   if(actual.slice(0,3).some((v,j)=>Math.abs(v-expected.q[j])>8e-6))failures.push(`${fixture.name}: production brick local-coordinate mismatch`);
  }
  rows.push(row);
 }
 const controls=m.unchangedControls.cases.find(c=>c.age===age);
 if(!controls)failures.push('Missing original C control age');
 for(const expected of controls?.rows||[]){
  const actual=rows.find(r=>r.name===expected.name);
  if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push('Material differs from actual bdcd C GPU values: '+expected.name);
 }
 const named=name=>rows.find(r=>r.name===name)?.brickIdentity;
 for(const pair of [['heritage-brick-internal-left','heritage-brick-internal-right'],['heritage-brick-depth-back','heritage-brick-depth-front'],['heritage-brick-negative-left','heritage-brick-negative-right'],['heritage-lantern-local-depth-0','heritage-lantern-local-depth-1'],['heritage-brick-axis12-depth-0','heritage-brick-axis12-depth-1']]){
  const a=named(pair[0]),b=named(pair[1]);if(!a||!b||a.seed!==b.seed)failures.push('One physical brick changed identity: '+pair.join('/'));
 }
 const before=named('heritage-brick-cell-left'),after=named('heritage-brick-cell-right');
 if(!before||!after||after.seed!==before.seed+1)failures.push('True staggered cell boundary did not change identity once');
 return {age,rows,failures,readback:Array.from(values)};
}
async function main(){
 const manifest=await get('manifest.json',true),fragment=await get('probe.frag');result.manifest=manifest;
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{antialias:false});
 if(!gl||!gl.getExtension('EXT_color_buffer_float'))throw Error('WebGL2 RGBA32F unavailable');
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
 const {width,height}=manifest,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,width,height);
 const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
 if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Float framebuffer incomplete');
 gl.viewport(0,0,width,height);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const readbackStart=performance.now();
 for(const age of manifest.ages){
  if(performance.now()-readbackStart>120000)throw Error('Readback exceeded 120000ms');
  gl.bufferSubData(gl.UNIFORM_BUFFER,0,params(age,width,height));gl.clearColor(-999,-999,-999,-999);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
  const values=new Float32Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.FLOAT,values);
  const error=gl.getError();if(error)throw Error('WebGL error '+error);
  result.cases.push(check(values,age,manifest));
 }
 result.readbackMs=performance.now()-readbackStart;if(result.readbackMs>120000)throw Error('Readback exceeded 120000ms');
 // Retain the original 11 displaced fixtures as the anti-stub check. Added
 // cell-identity fixtures may legitimately land in a flat brick-face interior.
 for(let i=0;i<width;i++)if(manifest.fixtures[i].requirePhysicalDisplacement&&!result.cases.some(c=>Math.abs(c.rows[i].geometryD-c.rows[i].baseD)>1e-9))result.errors.push(`${manifest.fixtures[i].name}: all geometry samples equal nominal distance`);
 result.failures=result.cases.flatMap(c=>c.failures.map(message=>({age:c.age,message})));
 result.status=result.failures.length||result.errors.length?'failed':'passed';stage('complete');
 gl.deleteVertexArray(vao);gl.deleteFramebuffer(fbo);gl.deleteTexture(texture);gl.deleteBuffer(ub);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
 document.querySelector('#status').textContent=result.status;
}
main().catch(e=>{result.failure=e.stack||String(e);result.status='failed';console.error(result.failure);});
