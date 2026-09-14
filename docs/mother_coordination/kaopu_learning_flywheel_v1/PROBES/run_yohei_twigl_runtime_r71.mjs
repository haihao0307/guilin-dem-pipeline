import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const SNAPSHOT_URL = 'https://twigl-f67a0.firebaseio.com/snapshot/-OGsvumeLdZM1eg3CtFG.json';
const TWIGL_COMMIT = '969491b285ba217fd895132a466ee6b3128243f3';
const FRAGMEN_URL = `https://raw.githubusercontent.com/doxas/twigl/${TWIGL_COMMIT}/src/fragmen.js`;
const NOISE_URL = `https://raw.githubusercontent.com/doxas/twigl/${TWIGL_COMMIT}/src/shader_snippet/noise.glsl`;
const SOURCE_SHA256 = '5253b2a44baa9f99af79cd04d85747ac6bb515c021562c7558e841446a4c3fea';
const FRAGMEN_BLOB_SHA = '8fdee9a542b31cc2e3f9a106885c9f529f3c05c9';
const NOISE_BLOB_SHA = '37f731ca606ca3d0998e5bc366b9c478246d13b2';
const WIDTH = 32;
const HEIGHT = 32;
const TIMES = [0, 1.25, 7.5];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const gitBlobSha = (value) => createHash('sha1')
  .update(`blob ${Buffer.byteLength(value)}\0`)
  .update(value)
  .digest('hex');

async function fetchText(url) {
  const response = await fetch(url, { headers: { accept: 'text/plain, application/json' } });
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  return response.text();
}

const [snapshotText, fragmenSource, noise] = await Promise.all([
  fetchText(SNAPSHOT_URL),
  fetchText(FRAGMEN_URL),
  fetchText(NOISE_URL),
]);
const snapshot = JSON.parse(snapshotText);
const source = snapshot?.graphics?.source;
if (typeof source !== 'string' || snapshot?.graphics?.mode !== 7) {
  throw new Error('author snapshot source/mode missing');
}

const hostChecks = {
  sourceHash: sha256(source) === SOURCE_SHA256,
  sourceLength: Buffer.byteLength(source, 'utf8') === 265 && [...source].length === 265,
  fragmenGitBlob: gitBlobSha(fragmenSource) === FRAGMEN_BLOB_SHA,
  noiseGitBlob: gitBlobSha(noise) === NOISE_BLOB_SHA,
  exactVersionChunk: fragmenSource.includes("static get ES_300_CHUNK(){return '#version 300 es\\n';}"),
  exactOutputChunk: fragmenSource.includes("static get GEEKEST_OUT_CHUNK(){return 'out vec4 o;\\n';}"),
  exactWrapperComposition: fragmenSource.includes('Fragmen.GEEKEST_CHUNK.substr(0, Fragmen.GEEKEST_CHUNK.length - 1) + Fragmen.GEEKEST_OUT_CHUNK'),
  exactMainOpen: fragmenSource.includes("chunkMain = 'void main(){\\n'"),
  exactMainClose: fragmenSource.includes("chunkClose = '\\n}'"),
};

const kernelNeedle = 'dot(cos(p.zyy*s),cos(p.xyx*s))';
const kernelExpansion = '(cos(p.z*s)*cos(p.x*s)+cos(p.y*s)*cos(p.y*s)+cos(p.y*s)*cos(p.x*s))';
const kernelMatches = source.split(kernelNeedle).length - 1;
const expandedSource = source.replace(kernelNeedle, kernelExpansion);

const initDeclaration = 'float i,e,R,s;vec3 q,p,d=';
const initLoop = ';for(q--;';
const initDeclarationMatches = source.split(initDeclaration).length - 1;
const initLoopMatches = source.split(initLoop).length - 1;
const initializedSource = source
  .replace(initDeclaration, 'float i=0.,e=0.,R=0.,s;vec3 q=vec3(0.),p,d=')
  .replace(initLoop, ';o=vec4(0.);for(q--;');
const initializedExpandedSource = initializedSource.replace(kernelNeedle, kernelExpansion);

const transformChecks = {
  oneKernelExpression: kernelMatches === 1,
  oneDeclarationInsertion: initDeclarationMatches === 1,
  oneLoopInsertion: initLoopMatches === 1,
  compactUnchanged: sha256(source) === SOURCE_SHA256,
  expandedChanged: sha256(expandedSource) !== SOURCE_SHA256,
  initializedChanged: sha256(initializedSource) !== SOURCE_SHA256,
  initializedHasNoTargetReadBeforeSeed:
    initializedSource.startsWith('float i=0.,e=0.,R=0.,s;vec3 q=vec3(0.),p,d=') &&
    initializedSource.indexOf('o=vec4(0.)') < initializedSource.indexOf('for(q--;'),
};

if (![...Object.values(hostChecks), ...Object.values(transformChecks)].every(Boolean)) {
  throw new Error(`source/wrapper transform gate failed: ${JSON.stringify({ hostChecks, transformChecks })}`);
}

const prefix = '#define FC gl_FragCoord\nprecision highp float;uniform vec2 r;uniform vec2 m;uniform float t;uniform float f;uniform float s;uniform sampler2D b;\n';
const wrap = (body) => `#version 300 es\n${prefix}${noise}out vec4 o;\nvoid main(){\n${body}\n}`;
const variants = {
  compact_undefined: wrap(source),
  kernel_expanded_undefined: wrap(expandedSource),
  compact_initialized: wrap(initializedSource),
  kernel_expanded_initialized: wrap(initializedExpandedSource),
};
const sourceFingerprints = Object.fromEntries(Object.entries({
  compact_undefined: source,
  kernel_expanded_undefined: expandedSource,
  compact_initialized: initializedSource,
  kernel_expanded_initialized: initializedExpandedSource,
}).map(([name, text]) => [name, { sha256: sha256(text), utf8Bytes: Buffer.byteLength(text) }]));
const preprocessedFingerprints = Object.fromEntries(Object.entries(variants)
  .map(([name, text]) => [name, { sha256: sha256(text), utf8Bytes: Buffer.byteLength(text) }]));

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-features=Vulkan', '--use-angle=vulkan', '--use-vulkan=swiftshader',
    '--disable-vulkan-surface', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

const records = await page.evaluate(async ({ variants, width, height, times }) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const floatExt = gl.getExtension('EXT_color_buffer_float');
  if (!floatExt) throw new Error('EXT_color_buffer_float unavailable');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const identity = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    glVersion: gl.getParameter(gl.VERSION),
    shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    drawingBufferColorSpace: gl.drawingBufferColorSpace ?? null,
  };
  const vertex = '#version 300 es\nin vec3 p;void main(){gl_Position=vec4(p,1.);}';
  const postVertex = '#version 300 es\nin vec3 position;out vec2 vTexCoord;void main(){vTexCoord=(position+1.0).xy/2.0;gl_Position=vec4(position,1.0);}';
  const postFragment = '#version 300 es\nprecision mediump float;uniform sampler2D drawTexture;in vec2 vTexCoord;layout (location = 0) out vec4 outColor;void main(){outColor=texture(drawTexture,vTexCoord);}';
  const compile = (type, text) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    const log = gl.getShaderInfoLog(shader) || '';
    if (!ok) throw new Error(`shader compile failed: ${log}`);
    return { shader, log };
  };
  const program = (vsText, fsText) => {
    const vs = compile(gl.VERTEX_SHADER, vsText);
    const fs = compile(gl.FRAGMENT_SHADER, fsText);
    const p = gl.createProgram();
    gl.attachShader(p, vs.shader);
    gl.attachShader(p, fs.shader);
    gl.linkProgram(p);
    const linked = gl.getProgramParameter(p, gl.LINK_STATUS);
    const linkLog = gl.getProgramInfoLog(p) || '';
    gl.deleteShader(vs.shader);
    gl.deleteShader(fs.shader);
    if (!linked) throw new Error(`program link failed: ${linkLog}`);
    return { p, compileLogs: [vs.log, fs.log], linkLog };
  };
  const vertices = new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,1,0]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('float framebuffer incomplete');
  const back = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, back);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(4));
  const post = program(postVertex, postFragment);
  const runs = [];
  const draw = (name, fsText, time, clear) => {
    const main = program(vertex, fsText);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, width, height);
    gl.clearColor(...clear);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(main.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const loc = gl.getAttribLocation(main.p, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gl.getUniformLocation(main.p, 'r'), width, height);
    gl.uniform2f(gl.getUniformLocation(main.p, 'm'), 0, 0);
    gl.uniform1f(gl.getUniformLocation(main.p, 't'), time);
    gl.uniform1f(gl.getUniformLocation(main.p, 'f'), 0);
    gl.uniform1f(gl.getUniformLocation(main.p, 's'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, back);
    gl.uniform1i(gl.getUniformLocation(main.p, 'b'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
    const floatPixels = new Float32Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, floatPixels);
    const floatError = gl.getError();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(post.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const postLoc = gl.getAttribLocation(post.p, 'position');
    gl.enableVertexAttribArray(postLoc);
    gl.vertexAttribPointer(postLoc, 3, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(post.p, 'drawTexture'), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
    const bytePixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytePixels);
    const byteError = gl.getError();
    gl.deleteProgram(main.p);
    return { name, time, clear, floatError, byteError, compileLogs: main.compileLogs, linkLog: main.linkLog, floatPixels: Array.from(floatPixels), bytePixels: Array.from(bytePixels) };
  };
  for (const [name, fsText] of Object.entries(variants)) {
    for (const time of times) runs.push(draw(name, fsText, time, [0, 0, 0, 0]));
  }
  runs.push(draw('compact_undefined_clear_control', variants.compact_undefined, 1.25, [0.75, 0.125, 0.5, 1]));
  runs.push(draw('compact_initialized_repeat', variants.compact_initialized, 1.25, [0, 0, 0, 0]));
  gl.deleteProgram(post.p);
  return { identity, runs };
}, { variants, width: WIDTH, height: HEIGHT, times: TIMES });

await page.close();
await browser.close();

function summarize(run) {
  const floats = Float32Array.from(run.floatPixels);
  const bytes = Uint8Array.from(run.bytePixels);
  let finite = 0, nan = 0, positiveInfinity = 0, negativeInfinity = 0;
  let min = Infinity, max = -Infinity;
  for (const value of floats) {
    if (Number.isNaN(value)) nan++;
    else if (value === Infinity) positiveInfinity++;
    else if (value === -Infinity) negativeInfinity++;
    else { finite++; min = Math.min(min, value); max = Math.max(max, value); }
  }
  return {
    name: run.name,
    time: run.time,
    clear: run.clear,
    floatReadError: run.floatError,
    byteReadError: run.byteError,
    shaderLogsEmpty: [...run.compileLogs, run.linkLog].every((x) => x === ''),
    floatSha256: sha256(Buffer.from(floats.buffer)),
    byteSha256: sha256(Buffer.from(bytes.buffer)),
    channels: floats.length,
    finite, nan, positiveInfinity, negativeInfinity,
    finiteRange: finite === 0 ? null : [min, max],
  };
}
const runs = records.runs.map(summarize);
const find = (name, time) => runs.find((r) => r.name === name && r.time === time);
const comparisons = Object.fromEntries(TIMES.map((time) => [String(time), {
  compactVsExpandedUndefinedFloatEqual:
    find('compact_undefined', time).floatSha256 === find('kernel_expanded_undefined', time).floatSha256,
  compactVsInitializedFloatEqual:
    find('compact_undefined', time).floatSha256 === find('compact_initialized', time).floatSha256,
  initializedCompactVsExpandedFloatEqual:
    find('compact_initialized', time).floatSha256 === find('kernel_expanded_initialized', time).floatSha256,
  initializedCompactVsExpandedByteEqual:
    find('compact_initialized', time).byteSha256 === find('kernel_expanded_initialized', time).byteSha256,
}]));
const clearBase = find('compact_undefined', 1.25);
const clearControl = find('compact_undefined_clear_control', 1.25);
const repeatBase = find('compact_initialized', 1.25);
const repeatControl = find('compact_initialized_repeat', 1.25);
const runtimeChecks = {
  allRunsCompleted: runs.length === 14,
  noReadErrors: runs.every((r) => r.floatReadError === 0 && r.byteReadError === 0),
  allChannelCounts: runs.every((r) => r.channels === WIDTH * HEIGHT * 4),
  compileAndLinkLogsEmpty: runs.every((r) => r.shaderLogsEmpty),
  clearControlClassified: Boolean(clearBase && clearControl),
  initializedRepeatDeterministic:
    repeatBase.floatSha256 === repeatControl.floatSha256 && repeatBase.byteSha256 === repeatControl.byteSha256,
  comparisonsClassified: Object.keys(comparisons).length === TIMES.length,
};
const result = {
  schema: 'kaopu-yohei-twigl-fixed-runtime/r71',
  status: [...Object.values(hostChecks), ...Object.values(transformChecks), ...Object.values(runtimeChecks)].every(Boolean)
    ? 'Candidate-pass' : 'Candidate-fail',
  checkedAt: new Date().toISOString(),
  question: 'What do the exact compact source, kernel-expanded form, and explicitly initialized reinterpretation produce in one fixed software WebGL2 runtime?',
  sourceLocks: {
    snapshotId: '-OGsvumeLdZM1eg3CtFG',
    snapshotSourceSha256: SOURCE_SHA256,
    twiglCommit: TWIGL_COMMIT,
    fragmenBlobSha: FRAGMEN_BLOB_SHA,
    noiseBlobSha: NOISE_BLOB_SHA,
    graphicsMode: snapshot.graphics.mode,
  },
  fixture: {
    viewport: [WIDTH, HEIGHT],
    times: TIMES,
    target: 'RGBA32F plus historical twigl one-to-one post pass to default RGBA8',
    uniforms: { m: [0, 0], f: 0, s: 0, b: '1x1 zero RGBA32F' },
    vertex: 'historical twigl vertex source transformed for GLSL ES 3.00',
    initializationReinterpretation: 'i=0, e=0, R=0, q=vec3(0), o=vec4(0); p and s remain assigned before first read',
    kernelExpansion: 'one dot(cos(p.zyy*s),cos(p.xyx*s)) term expanded componentwise; all other source tokens retained',
  },
  runtime: records.identity,
  sourceFingerprints,
  preprocessedFingerprints,
  hostChecks,
  transformChecks,
  runtimeChecks,
  runs,
  comparisons,
  controls: {
    compactUndefinedClearColorAffectsFloat:
      clearBase.floatSha256 !== clearControl.floatSha256,
    compactUndefinedClearColorAffectsByte:
      clearBase.byteSha256 !== clearControl.byteSha256,
    compactInitializedRepeatFloatEqual:
      repeatBase.floatSha256 === repeatControl.floatSha256,
    compactInitializedRepeatByteEqual:
      repeatBase.byteSha256 === repeatControl.byteSha256,
  },
  classifications: {
    observation: 'All hashes and pixel summaries describe only the pinned Chromium/SwiftShader condition recorded by runtime identity.',
    candidate: 'The explicitly initialized compact/expanded pair is a portable reinterpretation candidate for differential testing; it is not the author original.',
    rejected: [
      'A successful compile or stable pixel hash makes undefined local/output initialization portable.',
      'A compact-versus-expanded match or mismatch under undefined state proves algebraic equivalence or inequivalence.',
      'A single software renderer establishes the author recording pixels, cross-GPU behavior, physical meaning, or visual acceptance.',
    ],
    unknown: [
      'Author recording browser, GPU, driver, compiler and framebuffer pixels',
      'Cross-browser and cross-GPU results',
      'Artwork adaptation and redistribution permission',
      'Mother acceptance and production applicability',
    ],
  },
  sourcePolicy: 'No raw author artwork source or preprocessed shader text is emitted; only fingerprints, lengths, runtime identity and aggregate pixel evidence are persisted.',
};
await writeFile('r71-runtime-result.json', `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'Candidate-pass') process.exitCode = 10;

