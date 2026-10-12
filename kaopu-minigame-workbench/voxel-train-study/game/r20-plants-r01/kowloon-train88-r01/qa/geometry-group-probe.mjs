// Independent small-sample probe. Does not load or modify the retained host.
const query = new URLSearchParams(location.search);
const backend = query.get('backend') || 'webgl';
const groupIndex = Number(query.get('group') || 0);
const started = performance.now();
const result = {backend, group: groupIndex, status: 'running', stage: 'starting', cases: [], errors: [], events: []};
window.__stationGeometryGroupProbe = result;
const statusElement = document.getElementById('status');
const attachmentNames = ['a', 'b', 'c', 'e'];

function publish() {
  if (statusElement) statusElement.textContent = JSON.stringify({backend, group: groupIndex, name: result.name, status: result.status, stage: result.stage, elapsedMs: performance.now() - started, failure: result.failure}, null, 2);
  if (typeof window.__reportGeometryGroup === 'function') {
    Promise.resolve(window.__reportGeometryGroup(JSON.parse(JSON.stringify(result)))).catch(() => {});
  }
}
function stage(name) {
  if (result.status !== 'running') throw Error(result.failure || 'Probe already stopped');
  const elapsedMs = performance.now() - started;
  result.stage = name;
  result.events.push({stage: name, elapsedMs});
  console.log(`STATION_GEOMETRY_GROUP_STAGE ${backend} group=${groupIndex} ${name} ${elapsedMs.toFixed(1)}ms`);
  publish();
}
function fail(error) {
  if (result.status !== 'running') return;
  result.status = 'failed';
  result.failure = error?.stack || String(error);
  result.elapsedMs = performance.now() - started;
  console.error(`STATION_GEOMETRY_GROUP_FAILED ${backend} group=${groupIndex} stage=${result.stage}: ${result.failure}`);
  publish();
}
function active() {
  if (result.status !== 'running') throw Error(result.failure || 'Probe stopped');
}
async function source(url) {
  const response = await fetch(url, {cache: 'no-store'});
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  return response.text();
}
const params = (age, width, height) => new Float32Array([-20, 2.5, 4.2, age, 0, 0, -1, .43, 1, 0, 0, 1.5, 0, 1, 0, 0, width, height, 0, 0]);
function frameParams(width, height) {
  const values = new Float32Array(56);
  for (let matrix = 0; matrix < 3; matrix++) for (let i = 0; i < 4; i++) values[matrix * 16 + i * 5] = 1;
  values.set([width, height, 0, 8, 1, 320, 1400, 380], 48);
  return values;
}
function validateAttachments(attachments, pixels) {
  for (const name of attachmentNames) {
    if (attachments[name].length !== pixels * 4 || attachments[name].some(value => !Number.isFinite(value))) throw Error(`Invalid/nonfinite ${name} attachment`);
  }
  if (!attachments.a.some(value => value !== 0)) throw Error('All-zero HitField attachment: invalid GPU execution');
  for (let pixel = 0; pixel < pixels; pixel++) {
    const i = pixel * 4, id = attachments.a[i + 1], raw = attachments.c[i + 3], overflow = attachments.e[i];
    if (!Number.isInteger(id) || id < 0 || !Number.isInteger(raw) || raw < 0 || raw > 96 || ![0, 1].includes(overflow)) throw Error(`Invalid discrete metadata at sample ${pixel}`);
  }
}

async function webgl(group, probe) {
  const {width, height, ages} = probe;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); result.errors.push('webglcontextlost'); fail(Error('webglcontextlost')); });
  canvas.addEventListener('webglcontextcreationerror', event => fail(Error(event.statusMessage || 'webglcontextcreationerror')));
  stage('context');
  const gl = canvas.getContext('webgl2', {antialias: false, preserveDrawingBuffer: false});
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('WebGL2 float attachments unsupported');
  if (gl.getParameter(gl.MAX_DRAW_BUFFERS) < 4 || gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) < 4) throw Error('Four float MRT attachments unsupported');
  const renderer = gl.getExtension('WEBGL_debug_renderer_info');
  result.adapter = renderer ? gl.getParameter(renderer.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  stage('fetch');
  const fragment = await source(`../generated/${group.stem}.frag`);
  const vertex = '#version 300 es\nprecision highp float;void main(){vec2 p[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));gl_Position=vec4(p[gl_VertexID],0,1);}';
  stage('compile');
  const program = gl.createProgram(), shaders = [];
  for (const [type, code] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    active(); const shader = gl.createShader(type); shaders.push(shader);
    gl.shaderSource(shader, code); gl.compileShader(shader); gl.attachShader(program, shader);
  }
  stage('link'); gl.linkProgram(program);
  if (parallel) {
    while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
      if (gl.isContextLost()) throw Error('Context lost during program compilation');
      active(); await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  active();
  for (const shader of shaders) if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader) || 'Shader compilation failed');
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) || 'Program linking failed');
  gl.useProgram(program);
  stage('bindings');
  let paramsBuffer = null;
  result.uniformBlocks = [];
  const blockCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);
  for (let i = 0; i < blockCount; i++) {
    const name = gl.getActiveUniformBlockName(program, i);
    const isFrame = /^HostFrame(?:_|$)/.test(name), isParams = /^Params(?:_|$)/.test(name);
    if (!isFrame && !isParams) throw Error(`Unexpected active uniform block: ${name}`);
    const binding = isFrame ? 1 : 0, bytes = gl.getActiveUniformBlockParameter(program, i, gl.UNIFORM_BLOCK_DATA_SIZE);
    const data = isFrame ? frameParams(width, height) : params(ages[0], width, height);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, Math.max(bytes, data.byteLength), gl.DYNAMIC_DRAW);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data); gl.uniformBlockBinding(program, i, binding); gl.bindBufferBase(gl.UNIFORM_BUFFER, binding, buffer);
    if (isParams) paramsBuffer = buffer;
    result.uniformBlocks.push({name, binding, bytes});
  }
  const framebuffer = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  const drawBuffers = [];
  for (let i = 0; i < 4; i++) {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0);
    drawBuffers.push(gl.COLOR_ATTACHMENT0 + i);
  }
  gl.drawBuffers(drawBuffers);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Incomplete RGBA32F MRT framebuffer');
  gl.viewport(0, 0, width, height); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.bindVertexArray(gl.createVertexArray());
  result.startupMs = performance.now() - started;
  for (const age of ages) {
    stage(`draw-${age}`); const start = performance.now();
    if (paramsBuffer) {gl.bindBuffer(gl.UNIFORM_BUFFER, paramsBuffer); gl.bufferSubData(gl.UNIFORM_BUFFER, 0, params(age, width, height));}
    for (let i = 0; i < 4; i++) gl.clearBufferfv(gl.COLOR, i, new Float32Array(4));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    stage(`readback-${age}`);
    const attachments = {};
    for (let i = 0; i < 4; i++) {
      active(); const values = new Float32Array(width * height * 4);
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + i); gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, values);
      if (gl.isContextLost()) throw Error('Context lost during MRT readback');
      const error = gl.getError(); if (error !== gl.NO_ERROR) throw Error(`GL error ${error} reading ${attachmentNames[i]}`);
      attachments[attachmentNames[i]] = Array.from(values);
    }
    validateAttachments(attachments, width * height);
    result.cases.push({age, throughCompletionMs: performance.now() - start, attachments}); publish();
  }
}

async function webgpu(group, probe) {
  const {width, height, ages} = probe;
  stage('adapter');
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) throw Error('WebGPU adapter unavailable');
  stage('device');
  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', event => {result.errors.push(event.error.message); fail(Error(event.error.message));});
  device.lost.then(info => {if (result.status === 'running') fail(Error(`device-lost (${info.reason}): ${info.message}`));});
  result.adapter = {vendor: adapter.info?.vendor, architecture: adapter.info?.architecture, device: adapter.info?.device, description: adapter.info?.description};
  result.outputLayout = 'four adjacent rgba32float pixels per complete HitField; diagnostic only';
  stage('fetch');
  const original = await source(`../generated/${group.stem}.wgsl`);
  // Same point/state queried independently for each output vec4. This avoids
  // both the 32B render-attachment baseline and an unvalidated compute backend.
  // It serializes diagnostics only; it is not a station rendering strategy.
  const code = original.replace(/@location\([0-3]\)/g, '')
    .replace('@fragment fn geometryGroupProbe(@builtin(position)pixel:', 'fn geometryGroupRecord(pixel:') + `
@vertex fn geometryGroupProbeVertex(@builtin(vertex_index)i:u32)->@builtin(position)vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1.,-1.),vec2<f32>(3.,-1.),vec2<f32>(-1.,3.));return vec4<f32>(p[i],0.,1.);}
@fragment fn serializedGeometryGroupProbe(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 let h=geometryGroupRecord(vec4<f32>(floor(pixel.x/4.)+.5,pixel.y,0.,1.));
 switch u32(pixel.x)%4u{case 0u:{return h.a;}case 1u:{return h.b;}case 2u:{return h.c;}default:{return h.e;}}
}
`;
  stage('compile');
  const module = device.createShaderModule({code});
  const info = await module.getCompilationInfo(); active();
  result.compilationMessages = info.messages.map(message => ({type: message.type, message: message.message, lineNum: message.lineNum}));
  if (info.messages.some(message => message.type === 'error')) throw Error(JSON.stringify(result.compilationMessages));
  // Explicit layouts allow either UBO to be optimized away without guessing the auto-layout's holes.
  const bindGroupLayout = device.createBindGroupLayout({entries: [
    {binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: {type: 'uniform', minBindingSize: 80}},
    {binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: {type: 'uniform', minBindingSize: 224}},
  ]});
  stage('pipeline');
  const pipeline = await device.createRenderPipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[bindGroupLayout]}),vertex:{module,entryPoint:'geometryGroupProbeVertex'},fragment:{module,entryPoint:'serializedGeometryGroupProbe',targets:[{format:'rgba32float'}]},primitive:{topology:'triangle-list'}});
  active(); stage('bindings');
  const uniform = device.createBuffer({size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  const frame = device.createBuffer({size: 224, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(frame, 0, frameParams(width, height));
  const bindGroup = device.createBindGroup({layout: bindGroupLayout, entries: [{binding: 0, resource: {buffer: uniform}}, {binding: 1, resource: {buffer: frame}}]});
  const recordFloats=16,renderWidth=width*4,bytesPerRow=Math.ceil(renderWidth*16/256)*256,readSize=bytesPerRow*height;
  const output=device.createTexture({size:[renderWidth,height],format:'rgba32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
  result.startupMs = performance.now() - started;
  for (const age of ages) {
    stage(`draw-${age}`); const start = performance.now();
    device.queue.writeBuffer(uniform, 0, params(age, width, height));
    const encoder = device.createCommandEncoder();
    const pass=encoder.beginRenderPass({colorAttachments:[{view:output.createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,0]}]});
    pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.draw(3);pass.end();
    const read=device.createBuffer({size:readSize,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    encoder.copyTextureToBuffer({texture:output},{buffer:read,bytesPerRow},[renderWidth,height]);
    device.queue.submit([encoder.finish()]); stage(`readback-${age}`);
    await read.mapAsync(GPUMapMode.READ); active();
    const padded=new Float32Array(read.getMappedRange()),packed=new Float32Array(width*height*recordFloats),attachments={};
    for(let row=0;row<height;row++)packed.set(padded.subarray(row*bytesPerRow/4,row*bytesPerRow/4+width*recordFloats),row*width*recordFloats);
    for(let a=0;a<attachmentNames.length;a++){
      const values=new Float32Array(width*height*4);
      for(let i=0;i<width*height;i++)values.set(packed.subarray(i*recordFloats+a*4,i*recordFloats+a*4+4),i*4);
      attachments[attachmentNames[a]]=Array.from(values);
    }
    read.unmap();read.destroy();
    validateAttachments(attachments, width * height);
    result.cases.push({age, throughCompletionMs: performance.now() - start, attachments}); publish();
  }
}

async function main() {
  if (!['webgl', 'webgpu'].includes(backend) || !Number.isInteger(groupIndex) || groupIndex < 0) throw Error('Use ?backend=webgl|webgpu&group=<nonnegative index>');
  stage('manifest');
  const manifest = JSON.parse(await source('../generated/geometry-group-manifest.json'));
  const group = manifest.groups.find(item => item.index === groupIndex), probe = manifest.probe;
  if (!group || group.outputs !== 4 || !/^[a-zA-Z0-9_-]+$/.test(group.stem)) throw Error('Missing or invalid four-output group entry');
  if (!probe || !Number.isInteger(probe.width) || probe.width < 1 || !Number.isInteger(probe.height) || probe.height < 1 || !Array.isArray(probe.ages) || !probe.ages.length || probe.ages.some(age => !Number.isFinite(age))) throw Error('Invalid probe dimensions/ages');
  Object.assign(result, {name: group.name, stem: group.stem, width: probe.width, height: probe.height, ages: probe.ages, scope: 'Small-sample shader compilation and numerical execution only; not full-station visual acceptance.'});
  await (backend === 'webgl' ? webgl : webgpu)(group, probe);
  active(); stage('complete'); result.status = 'sampled'; result.elapsedMs = performance.now() - started; publish();
}
main().catch(fail);
