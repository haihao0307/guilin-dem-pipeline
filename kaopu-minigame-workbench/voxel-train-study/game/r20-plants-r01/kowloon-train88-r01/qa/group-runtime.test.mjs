import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStationWGSL} from '../../kowloon-station-r04/receiver.mjs';
import {STATION_SCORE} from '../../kowloon-station-r04/station-score.mjs';
import {createStationBinding} from '../station-binding.mjs';
import {hostConstructionWGSL} from '../host-construction.mjs';
import {GEOMETRY_GROUP_NAMES, stationGeometryGroupSource} from '../geometry-groups.mjs';
import {createGroupRuntimeWGSL, groupRuntimeEntryWGSL, GROUP_QUERY_CONTROL_BYTES} from '../group-runtime.mjs';
import {createGroupQueryReceiver} from '../group-query-receiver.mjs';

const datums = JSON.parse(fs.readFileSync(new URL('./host-datums.json', import.meta.url)));
const construction = createStationBinding({score: STATION_SCORE, ...datums}).construction;
const source = createStationWGSL({construction, hostWGSL: hostConstructionWGSL(construction.host)});
const uncomment = value => value.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
function functionText(source, name) {
  source = uncomment(source);
  const start = source.indexOf(`fn ${name}(`), open = source.indexOf('{', start);
  assert(start >= 0 && open > start, `Missing ${name}`);
  let end = open + 1, depth = 1;
  for (; depth; end++) {if (source[end] === '{') depth++; if (source[end] === '}') depth--; assert(end < source.length);}
  return source.slice(start, end);
}

test('all runtime groups retain their exact selected stationDomain and physical resolver source', () => {
  for (let index = 0; index < GEOMETRY_GROUP_NAMES.length; index++) {
    const selected = stationGeometryGroupSource(source, index), runtime = createGroupRuntimeWGSL(source, index);
    for (const name of ['stationDomain', 'recordCandidate', 'resolveCandidates', 'stationCandidatePhysicalDistance']) assert.equal(functionText(runtime, name), functionText(selected, name), `${index}:${name}`);
    assert.equal((runtime.match(/@fragment fn stationGroupQuery/g) || []).length, 1);
    assert(!runtime.includes('fn geometryGroupProbe('));
    assert.match(runtime, /@group\(0\) @binding\(2\) var<uniform> groupQueryControl:GroupQueryControl/);
    assert.match(runtime, /let h=stationDomain\(p,skipRoof,skipFloor\)/);
    const text = uncomment(runtime);
    for (const name of new Set(text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [])) assert(text.includes(`const ${name}:`) || text.includes(`const ${name}=`), `Missing constant ${name} in ${index}`);
  }
});

test('runtime query has literal initialization, complete strict physical merge, sticky raw overflow, and caller phase/skip gates', () => {
  assert.equal(GROUP_QUERY_CONTROL_BYTES, 32);
  const first = groupRuntimeEntryWGSL(0), later = groupRuntimeEntryWGSL(11);
  assert.match(first, /var merged=GroupQueryResult\(vec4<f32>\(10000\.,0\.,10000\.,0\.\)/);
  assert.doesNotMatch(first, /textureLoad\(previousGroup/);
  for (const name of ['A', 'B', 'C', 'E']) assert(later.includes(`textureLoad(previousGroup${name},ij,0)`));
  assert.match(later, /h\.d<merged\.a\.x/); assert.doesNotMatch(later, /h\.d<=/);
  assert.match(later, /vec4<f32>\(h\.d,f32\(h\.id\),h\.baseD,h\.seed\)/);
  assert.match(later, /vec4<f32>\(h\.q,h\.sourceSeed\)/); assert.match(later, /vec4<f32>\(h\.extent,rawCount\)/);
  assert.match(later, /merged\.c\.w\+f32\(stationRawCandidateCount\)/);
  assert.match(later, /merged\.e\.x!=0\.\|\|stationCandidateOverflow\|\|rawCount>96\./);
  assert.match(later, /merged\.a=vec4<f32>\(0\.,999\.,0\.,0\.\)/);
  assert.match(later, /merged\.b=vec4<f32>\(p,0\.\)/);
  assert.match(later, /phase==0\.&&trace\.w!=0\./); assert.match(later, /phase==1\.&&trace\.w!=1\./);
  assert.match(later, /skipRoof=full\.y==15\.;skipFloor=full\.y==17\./);
  assert(later.indexOf('if(!skipRoof&&!skipFloor){return merged;}') < later.indexOf('stationDomain(p,skipRoof,skipFloor)'));
  assert.throws(() => groupRuntimeEntryWGSL(-1)); assert.throws(() => groupRuntimeEntryWGSL(12));
});

class Vector4 {constructor(x = 0, y = 0, z = 0, w = 0) {this.set(x, y, z, w);} set(x, y, z, w) {Object.assign(this, {x, y, z, w}); return this;}}
class Scene {constructor() {this.children = [];} add(child) {child.parent = this; this.children.push(child);}}
class Camera {}
class Mesh {constructor(geometry, material) {Object.assign(this, {geometry, material});} removeFromParent() {this.parent = null;}}
class BufferGeometry {setAttribute(name, value) {this[name] = value;} dispose() {this.disposed = true;}}
class RawShaderMaterial {constructor(options) {Object.assign(this, options);} dispose() {this.disposed = true;}}
class WebGLRenderTarget {
  constructor(width, height, options) {Object.assign(this, {width, height, options, scissor: new Vector4(), viewport: new Vector4(0, 0, width, height), textures: Array.from({length: options.count}, () => ({isTexture: true}))});}
  dispose() {this.disposed = true;}
}
const THREE = {Vector4, Scene, Camera, Mesh, BufferGeometry, RawShaderMaterial, WebGLRenderTarget, Float32BufferAttribute: class {constructor(values, size) {Object.assign(this, {values, size});}}, GLSL3: '300es', FloatType: 'float', RGBAFormat: 'rgba', NearestFilter: 'nearest', NoBlending: 'none', NoColorSpace: ''};
function fixture(compactTrace=false) {
  const gl = {MAX_DRAW_BUFFERS: 1, MAX_COLOR_ATTACHMENTS: 2, MAX_TEXTURE_SIZE: 3, getExtension: () => ({}), getParameter: key => key === 3 ? 4096 : 4, isContextLost: () => false};
  const oldTarget = {name: 'caller-target'}, calls = [], paths = [];
  const renderer = {capabilities: {isWebGL2: true}, shadowMap: {enabled: true}, autoClear: true, target: oldTarget, getContext: () => gl, getRenderTarget() {return this.target;}, getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 1,
    setRenderTarget(target, face, mip) {this.target = target; this.restore = {target, face, mip};},
    render(scene, camera) {
      const material = scene.children[0].material;
      calls.push({scene, camera, material, target: this.target, scissorTest: this.target.scissorTest, scissor: {...this.target.scissor}, samplers: Object.fromEntries(Object.entries(material.uniforms).filter(([key]) => key.includes('_group_1_')).map(([key, value]) => [key, value.value])), control: {...material.uniforms._group_0_binding_2_fs.value.offsetAndPhase}, options: {...material.uniforms._group_0_binding_2_fs.value.options}});
      if (this.throwAt === calls.length) throw Error('Mock dispatch failure');
    }};
  const manifest = {sourceSHA256: 'test-source', groups: GEOMETRY_GROUP_NAMES.map((name, index) => ({index, name, outputs: 4}))};
  function fragment(index) {
    const types = index === 1 ? ['HostFrame', 'GroupQueryControl'] : ['Params', 'HostFrame', 'GroupQueryControl'];
    return '#version 300 es\n' + types.map(type => {const binding = {Params: 0, HostFrame: 1, GroupQueryControl: 2}[type]; return `layout(std140) uniform ${type}_block { ${type} _group_0_binding_${binding}_fs; };`;}).join('\n') + '\n' + (index === 0 ? [0, 5] : compactTrace ? [0,1,5] : [0, 1, 2, 3, 4, 5]).map(binding => `uniform highp sampler2D _group_1_binding_${binding}_fs;`).join('\n') + '\nvoid main(){}';
  }
  const fetch = async url => {
    const pathname = new URL(url).pathname; paths.push(pathname);
    if(pathname.endsWith('/compact-trace-r01/generated/manifest.json'))return{ok:true,json:async()=>({sourceSHA256:'test-source',outputs:Object.fromEntries(GEOMETRY_GROUP_NAMES.map((_,i)=>['runtime-'+i,{entry:'stationCompactQuery',sha256:'fixture-'+i}]))})};
    if(pathname.endsWith('/generated/group-runtime-manifest.json'))return{ok:true,json:async()=>({sourceSHA256:'test-source',outputs:Object.fromEntries(GEOMETRY_GROUP_NAMES.map((_,i)=>['group-runtime-'+i,{entry:'stationGroupQuery',sha256:'fixture-'+i}]))})};
    if (pathname.endsWith('/generated/geometry-group-manifest.json')) return {ok: true, json: async () => manifest};
    const match = (compactTrace?/\/generated\/runtime-(\d+)\.frag$/:/\/generated\/group-runtime-(\d+)\.frag$/).exec(pathname);
    assert(match, `Unexpected fetch ${pathname}`);
    return {ok: true, text: async () => fragment(Number(match[1]))};
  };
  return {renderer, gl, oldTarget, calls, paths, fetch, u: {age: .58}, frame: {viewport: new Vector4(16, 8, 0, 8)}};
}
async function withReceiver(callback) {
  const setup = fixture(), oldFetch = globalThis.fetch; globalThis.fetch = setup.fetch;
  let receiver;
  try {receiver = await createGroupQueryReceiver({renderer: setup.renderer, THREE, u: setup.u, frame: setup.frame}); await callback(receiver, setup);}
  finally {receiver?.dispose(); globalThis.fetch = oldFetch;}
}

test('mock-only receiver fetches just manifest and runtime GLSL, dispatches ordered physical groups through two MRTs, restores renderer state', async () => {
  await withReceiver((receiver, fixture) => {
    assert.equal(fixture.paths.length, 14); assert.equal(fixture.calls.length, 0);
    const trace = {isTexture: true}, full = {isTexture: true};
    const output = receiver.query({width: 16, height: 8, traceTexture: trace, fullHitTexture: full, offset: [0, .00045, 0], phase: 1, skip: 3});
    assert.equal(fixture.calls.length, 12); assert.equal(new Set(fixture.calls.map(call => call.target)).size, 2);
    fixture.calls.forEach((call, index) => {
      assert(call.material.name.startsWith(`Station grouped query ${index}:`));
      assert.equal(call.samplers._group_1_binding_0_fs, trace); assert.equal(call.samplers._group_1_binding_5_fs, full);
      assert.deepEqual(call.control, {x: 0, y: .00045, z: 0, w: 1}); assert.equal(call.options.x, 3);
      if (index) for (let binding = 1; binding <= 4; binding++) {assert.equal(call.samplers[`_group_1_binding_${binding}_fs`], fixture.calls[index - 1].target.textures[binding - 1]); assert.notEqual(call.samplers[`_group_1_binding_${binding}_fs`], call.target.textures[binding - 1]);}
      assert.equal(call.scene.children.length, 1); assert(call.camera instanceof Camera);
    });
    assert.equal(output.textures.length, 4); assert.equal(output.a, output.textures[0]); assert.equal(output.e, output.textures[3]);
    assert.equal(fixture.renderer.target, fixture.oldTarget); assert.equal(fixture.renderer.autoClear, true); assert.equal(fixture.renderer.shadowMap.enabled, true);
    assert.deepEqual(fixture.renderer.restore, {target: fixture.oldTarget, face: 2, mip: 1});
    assert.deepEqual(fixture.u, {age: .58}); assert.deepEqual(fixture.frame.viewport, new Vector4(16, 8, 0, 8));
    assert.equal(receiver.proof.status, 'dispatched-unvalidated');
  });
});

test('mock receiver rejects feedback aliases, mismatched query controls and out-of-bounds rectangles before dispatch', async () => {
  await withReceiver((receiver, fixture) => {
    const arguments_ = {width: 16, height: 8, traceTexture: {isTexture: true}};
    const output = receiver.query(arguments_); const count = fixture.calls.length;
    assert.throws(() => receiver.query({...arguments_, traceTexture: output.a}), /aliases/);
    assert.throws(() => receiver.query({...arguments_, skip: 3, fullHitTexture: output.a}), /aliases/);
    assert.throws(() => receiver.query({...arguments_, skip: 3}), /independent fullHitTexture/);
    assert.throws(() => receiver.query({...arguments_, phase: 2}), /offset\/phase\/skip/);
    assert.throws(() => receiver.query({...arguments_, offset: [0, NaN, 0]}));
    assert.throws(() => receiver.query({...arguments_, width: 17}), /frame.viewport/);
    assert.throws(() => receiver.query({...arguments_, rects: [{x: 15, y: 0, w: 2, h: 2}]}), /rectangle/);
    assert.equal(fixture.calls.length, count);
  });
});

test('mock receiver restricts rendering to copied bottom-left rects and restores state on dispatch failure', async () => {
  await withReceiver((receiver, fixture) => {
    const rects = [{x: 2, y: 1, w: 3, h: 4}, {x: 8, y: 0, w: 4, h: 2}];
    const output = receiver.query({width: 16, height: 8, traceTexture: {isTexture: true}, rects});
    assert.equal(fixture.calls.length, 24); assert.deepEqual(output.rects, rects); assert.notEqual(output.rects, rects);
    fixture.calls.forEach((call, index) => {assert.equal(call.scissorTest, true); assert.deepEqual(call.scissor, {x: rects[index % 2].x, y: rects[index % 2].y, z: rects[index % 2].w, w: rects[index % 2].h});});
    fixture.renderer.throwAt = fixture.calls.length + 3;
    assert.throws(() => receiver.query({width: 16, height: 8, traceTexture: {isTexture: true}}), /Mock dispatch failure/);
    assert.equal(fixture.renderer.target, fixture.oldTarget); assert.equal(fixture.renderer.autoClear, true); assert.equal(fixture.renderer.shadowMap.enabled, true);
    assert.equal(receiver.proof.status, 'failed');
  });
});

test('receiver source guard keeps this an explicit execution-only, no-copy/no-camera-owner module', () => {
  const text = fs.readFileSync(new URL('../group-query-receiver.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(text, /requestAnimationFrame\s*\(|gl\.finish\s*\(|readRenderTargetPixels\s*\(|copyTextureToTexture\s*\(|renderer\.render\(scene,/);
  assert.doesNotMatch(text, /frame\.(?:controls|cameraToLocal|inverseProjection)\s*=/);
  assert.match(text, /outputs expire|textures expire/);
});


test('opt-in compact receiver owns two one-RT targets and preserves binding5 alternate identity',async()=>{
 const f=fixture(true),oldFetch=globalThis.fetch;globalThis.fetch=f.fetch;let r;
 try{r=await createGroupQueryReceiver({renderer:f.renderer,THREE,u:f.u,frame:f.frame,compactTrace:true});const trace={isTexture:true},full={isTexture:true};const result=r.query({width:16,height:8,traceTexture:trace,fullHitTexture:full,skip:3});assert.equal(result.textures.length,1);assert.equal(result.b,undefined);assert.equal(r.proof.currentQueryAttachments,2);assert.equal(f.calls.length,12);assert.equal(new Set(f.calls.map(x=>x.target)).size,2);
 for(const[c,i]of f.calls.map((c,i)=>[c,i])){assert.equal(c.target.textures.length,1);assert.equal(c.samplers._group_1_binding_0_fs,trace);assert.equal(c.samplers._group_1_binding_5_fs,full);if(i){assert.equal(c.samplers._group_1_binding_1_fs,f.calls[i-1].target.textures[0]);assert.notEqual(c.samplers._group_1_binding_1_fs,c.target.textures[0]);}assert(!('_group_1_binding_2_fs' in c.samplers));}assert.throws(()=>r.query({width:16,height:8,traceTexture:result.a}),/aliases/);assert.equal(f.renderer.target,f.oldTarget);
 }finally{r?.dispose();globalThis.fetch=oldFetch;}
});
test('receiver candidate applies compact only to trace and keeps original five full metadata queries',()=>{
 const now=fs.readFileSync(new URL('../function-receiver.mjs',import.meta.url),'utf8');assert.match(now,/testCompactTrace=false/);assert.match(now,/testCompactTrace&&!testResolution/);assert.match(now,/const complete=queryReceiver.query\(options\)/);assert.match(now,/const alternate=queryReceiver.query/);assert.match(now,/const hit=execution.geometry.query\(\{width:t.w,height:t.h,traceTexture:ray,phase:1/);assert.match(now,/\[\[0,0,0\],\[1,-1,-1\],\[-1,-1,1\],\[-1,1,-1\],\[1,1,1\]\]/);assert.match(now,/if\(traceGrouped!==grouped\)traceGrouped.dispose\(\)/);
});
