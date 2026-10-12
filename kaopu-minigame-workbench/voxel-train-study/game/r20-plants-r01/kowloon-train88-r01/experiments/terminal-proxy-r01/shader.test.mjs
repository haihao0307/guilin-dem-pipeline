import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {emitTerminalProxy, extractDeclaration, sha256, SOURCE_SHA256, SOURCE_BYTES, PRODUCER_SOURCE_SHA256, DEFAULT_SOURCE, ENTRY_POINT} from './emitter.mjs';

const archivedSource = fileURLToPath(new URL('../../qa/evidence-449c043a/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-train88-r01/experiments/compact-trace-r01/generated/runtime-0.wgsl', import.meta.url));
// CI must consume the just-emitted original runtime, never a saved proxy or an
// archived fallback. Local proof tests can use the explicitly named evidence.
const sourcePath = process.env.TERMINAL_PROXY_SOURCE ? path.resolve(process.env.TERMINAL_PROXY_SOURCE)
  : fs.existsSync(DEFAULT_SOURCE) || process.env.CI ? DEFAULT_SOURCE : archivedSource;
if (process.env.CI) assert.equal(sourcePath, DEFAULT_SOURCE, 'CI must prove against its newly emitted original runtime-0.wgsl');
const source = fs.readFileSync(sourcePath, 'utf8');
const {wgsl, manifest} = emitTerminalProxy(source);
const f = Math.fround;
const float = new Float32Array(1);
const bits = new Uint32Array(float.buffer);
function fromBits(value) { bits[0] = value >>> 0; return float[0]; }
function toBits(value) { float[0] = value; return bits[0]; }
function nextFloat(value, step) { return fromBits(toBits(value) + step); }
function finiteBits(value) { return (toBits(value) & 0x7f800000) !== 0x7f800000; }
function eqBits(actual, expected) { assert.deepEqual(actual.map(toBits), expected.map(toBits)); }

// Source-structure model of original recordPart -> recordCandidate ->
// resolveCandidates. Deliberately retain the candidate list/prune and strict
// comparison rather than implementing the proxy's simplified min directly.
function originalFarCandidate(envelope) {
  let count = 0, overflow = false, raw = 0, upper = f(10000);
  const items = [];
  const candidate = {d: f(envelope), id: 0, baseD: f(envelope), seed: 0};
  if (raw >= 96) overflow = true;
  else {
    raw += 1;
    const margin = f(0); // Source-locked stationNativeId(0u) == false.
    upper = Math.min(upper, f(candidate.d + margin));
    if (!(f(candidate.d - margin) > upper)) { items[count] = candidate; count += 1; }
  }
  let h = {d: f(10000), id: 0, baseD: f(10000), seed: 0};
  if (overflow) h = {d: 0, id: 999, baseD: 0, seed: 0};
  else for (let i = 0; i < count; i++) {
    const candidate = items[i];
    if (candidate.d > upper) continue;
    if (candidate.d < h.d) h = candidate;
  }
  return {a: [h.d, h.id, h.baseD, h.seed], raw, overflow, retainedCount: count};
}
function merge(previous, a, raw, localOverflow = false) {
  const result = previous.map(f), rawCount = f(previous[2] + raw);
  const overflow = ((previous[3] >>> 0) & 1) !== 0 || localOverflow || rawCount > 96;
  if (a[0] < result[0]) { result[0] = f(a[0]); result[1] = f(a[1]); result[3] = a.every(x => Math.abs(x) < f(1e30)) ? 0 : 2; }
  result[2] = rawCount;
  return overflow ? [0, 999, rawCount, 1] : result;
}
function proxyCandidate(envelope) {
  if (!finiteBits(envelope) || f(envelope) < f(.15)) return null;
  let d = f(10000);
  if (f(envelope) < d) d = f(envelope);
  return merge([10000, 0, 0, 0], [d, 0, d, 0], 1, false);
}
function classifier({envelope = 1, phase = 0, mode = 0, status = 0, trace = [0, 0, 0, status], ray = [[0, 0, 0], [0, 0, 1]], p = [100, 0, 0], offset = [0, 0, 0, phase], options = [mode, 0, 0, 0], full = [0, 15, 0, 0]} = {}) {
  if (![...trace, ...ray.flat(), ...p, ...offset, ...options].every(finiteBits)) return null;
  if (![0, 1].includes(phase) || ![0, 1, 2, 3].includes(trace[3]) || ![0, 1, 2, 3].includes(mode)) return null;
  if ((phase === 0 && trace[3] !== 0) || (phase === 1 && trace[3] !== 1)) return [10000, 0, 0, 0];
  if (mode === 3) {
    if (!full.every(finiteBits)) return null;
    if (full[1] !== 15 && full[1] !== 17) return [10000, 0, 0, 0];
  }
  return proxyCandidate(envelope);
}

test('locks entire newly generated original g0 identity and deterministic generated artifacts', () => {
  assert.equal(sha256(source), SOURCE_SHA256);
  assert.equal(Buffer.byteLength(source), SOURCE_BYTES);
  assert.equal(manifest.input.sha256, SOURCE_SHA256);
  assert.equal(manifest.sourceSHA256, PRODUCER_SOURCE_SHA256);
  assert.equal(manifest.proxySourceSHA256, SOURCE_SHA256);
  assert.equal(manifest.outputs.proxy.entry, ENTRY_POINT);
  assert.equal(manifest.outputs.proxy.sha256, sha256(wgsl));
  assert.deepEqual(emitTerminalProxy(source), {wgsl, manifest});
  assert.equal(fs.readFileSync(new URL('./generated/proxy.wgsl', import.meta.url), 'utf8'), wgsl);
  assert.deepEqual(JSON.parse(fs.readFileSync(new URL('./generated/manifest.json', import.meta.url), 'utf8')), manifest);
  assert.equal(manifest.output.sha256, sha256(wgsl));
  assert.equal(manifest.output.bytes, Buffer.byteLength(wgsl));
  assert(wgsl.length < 5000, 'light source must remain separate and small');
});

test('rejects every unexpected source, guard, candidate, uniform, helper or merge change', () => {
  const mutations = [
    source + '\n',
    source.replace('if(terminalEnvelope<.15)', 'if(terminalEnvelope<=.15)'),
    source.replace('38.53001,7.9814192193067734,9.56248164254933', '38.53002,7.9814192193067734,9.56248164254933'),
    source.replace('recordPart(p,terminalEnvelope,0u,p,0.)', 'recordPart(p,terminalEnvelope,1u,p,0.)'),
    source.replace('if(candidate.d<h.d)', 'if(candidate.d<=h.d)'),
    source.replace('stationRawCandidateCount+=1u;', 'stationRawCandidateCount+=2u;'),
    source.replace('const STATION_CANDIDATE_CAPACITY:u32=96u;', 'const STATION_CANDIDATE_CAPACITY:u32=97u;'),
    source.replace('if(a.x<merged.x)', 'if(a.x<=merged.x)'),
    source.replace('rawCount>96.', 'rawCount>=96.'),
    source.replace('@binding(5) var fullHitA', '@binding(6) var fullHitA'),
    source.replace('return p.xyz/p.w;', 'return p.xyz;'),
    source.replace('let q=abs(p)-b;', 'let q=abs(p)-b-vec3<f32>(.01);'),
  ];
  for (const mutated of mutations) {
    assert.notEqual(mutated, source, 'mutation must affect original source');
    assert.throws(() => emitTerminalProxy(mutated), /identity differs/);
  }
});

test('uses original byte-extracted host ray, box, merge, structures and bindings only', () => {
  for (const name of ['localPoint', 'hostRay', 'box', 'mergeCompactTrace']) {
    const original = extractDeclaration(source, 'fn', name);
    assert.equal(extractDeclaration(wgsl, 'fn', name), original);
    assert.equal(manifest.extracted[name].sha256, sha256(original));
  }
  for (const name of ['Params', 'HostFrame', 'GroupQueryControl']) assert.equal(extractDeclaration(wgsl, 'struct', name), extractDeclaration(source, 'struct', name));
  const declarations = [...wgsl.matchAll(/@group\((\d+)\)\s*@binding\((\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(declarations, [[0, 0], [0, 1], [0, 2], [1, 0], [1, 5]]);
  assert.equal((wgsl.match(/@fragment/g) || []).length, 1);
  assert.match(wgsl, new RegExp(`@fragment fn ${ENTRY_POINT}\\(`));
  assert.doesNotMatch(wgsl, /fn (stationDomain|terminalHallQuery|completeTerminalHall|evaluateStationGeometry|recordCandidate|resolveCandidates)\b/);
  assert.doesNotMatch(wgsl, /previousGroup|stationCandidates|array<HitField/);
  assert(wgsl.includes(manifest.proof.originalEnvelope));
  assert.equal(manifest.proof.originalGuard, 'if(terminalEnvelope<.15){recordCandidate(terminalHallRawWinner(completeTerminalHall(p,skipFloor)));}else{recordPart(p,terminalEnvelope,0u,p,0.);}');
});

test('canonical phase and automatic-skip guards preserve original source and precedence', () => {
  const entry = extractDeclaration(wgsl, 'fn', ENTRY_POINT);
  const phaseGuard = 'if((phase==0.&&trace.w!=0.)||(phase==1.&&trace.w!=1.)){return merged;}';
  const skipGuard = 'skipRoof=full.y==15.;skipFloor=full.y==17.;if(!skipRoof&&!skipFloor){return merged;}';
  assert(entry.includes(phaseGuard));
  assert(entry.includes(skipGuard));
  assert(entry.indexOf(phaseGuard) < entry.indexOf('textureLoad(fullHitA'));
  assert(entry.indexOf(skipGuard) < entry.indexOf('let terminalEnvelope'));
  assert(entry.indexOf('if(!terminalProxyFinite(terminalEnvelope)){discard;}') < entry.indexOf('if(terminalEnvelope<.15){discard;}'));
  for (const phase of [0, 1]) for (const status of [0, 1, 2, 3]) for (const mode of [0, 1, 2, 3]) for (const fullId of [0, 3, 15, 17, 999]) {
    const actual = classifier({phase, status, mode, full: [0, fullId, 0, 0], envelope: .1});
    const canonical = status !== phase || (mode === 3 && ![15, 17].includes(fullId));
    assert.deepEqual(actual, canonical ? [10000, 0, 0, 0] : null);
  }
});

test('strict .15 boundary: adjacent floats below fall back, equality and above are far', () => {
  const threshold = f(.15);
  assert.equal(proxyCandidate(nextFloat(threshold, -1)), null);
  eqBits(proxyCandidate(threshold), [threshold, 0, 1, 0]);
  eqBits(proxyCandidate(nextFloat(threshold, 1)), [nextFloat(threshold, 1), 0, 1, 0]);
  for (const value of [-Infinity, -1, -0, 0, .149, NaN, Infinity]) assert.equal(proxyCandidate(value), null);
});

test('far branch keeps global raw1 and strict10000 default, including baseD/seed and96 overflow semantics', () => {
  const cases = [f(.15), nextFloat(f(.15), 1), .25, 1, 17.25, nextFloat(10000, -1), 10000, nextFloat(10000, 1), 1e6, f(1e30), fromBits(0x7f7fffff)];
  for (let index = 0; index < 20000; index++) cases.push(fromBits(0x3e19999a + Math.floor((0x7f7fffff - 0x3e19999a) * index / 19999)));
  for (const envelope of cases) {
    const original = originalFarCandidate(envelope);
    assert.equal(original.raw, 1);
    assert.equal(original.overflow, false);
    assert.equal(original.a[0], original.a[2]);
    assert.equal(original.a[1], 0);
    assert.equal(original.a[3], 0);
    eqBits(proxyCandidate(envelope), merge([10000, 0, 0, 0], original.a, original.raw, original.overflow));
    assert.equal(original.retainedCount, f(envelope) <= 10000 ? 1 : 0);
    for (const previousRaw of [0, 94, 95, 96, 97]) {
      const result = merge([10000, 0, previousRaw, 0], original.a, original.raw, original.overflow);
      assert.equal(result[2], previousRaw + 1);
      assert.equal(result[3], previousRaw + 1 > 96 ? 1 : 0);
    }
  }
  eqBits(proxyCandidate(10000), [10000, 0, 1, 0]);
  eqBits(proxyCandidate(nextFloat(10000, 1)), [10000, 0, 1, 0]);
  eqBits(merge([10000, 0, 0, 1], [1, 0, 1, 0], 1), [0, 999, 1, 1]);
  eqBits(merge([10000, 0, 0, 0], [1, 0, 1, 0], 1, true), [0, 999, 1, 1]);
});

test('bitwise finite gate sends nonfinite and unknown trace/p/control/full values to original g0', () => {
  for (const value of [fromBits(0x7f800000), fromBits(0xff800000), fromBits(0x7fc00000), fromBits(0xffc00000)]) {
    assert.equal(finiteBits(value), false);
    for (let component = 0; component < 4; component++) {
      const trace = [0, 0, 0, 0]; trace[component] = value;
      assert.equal(classifier({trace}), null);
      const offset = [0, 0, 0, 0]; offset[component] = value;
      assert.equal(classifier({offset}), null);
      const options = [0, 0, 0, 0]; options[component] = value;
      assert.equal(classifier({options}), null);
      const full = [0, 15, 0, 0]; full[component] = value;
      assert.equal(classifier({mode: 3, full}), null);
    }
    for (let component = 0; component < 3; component++) {
      const p = [100, 0, 0]; p[component] = value;
      assert.equal(classifier({p}), null);
      const ray = [[0, 0, 0], [0, 0, 1]]; ray[1][component] = value;
      assert.equal(classifier({ray}), null);
    }
  }
  for (const status of [-1, .5, 4, 999]) assert.equal(classifier({status}), null);
  for (const phase of [-1, .5, 2, 3]) assert.equal(classifier({phase}), null);
  for (const mode of [-1, .5, 4, 999]) assert.equal(classifier({mode}), null);
  assert.equal(finiteBits(fromBits(0x7f7fffff)), true);
  assert.equal(finiteBits(-0), true);
});

test('original compact invalid-flag and overflow code remains exact, including strict winner ties', () => {
  const mergeSource = extractDeclaration(wgsl, 'fn', 'mergeCompactTrace');
  assert.match(mergeSource, /rawCount>96\./);
  assert.match(mergeSource, /if\(a\.x<merged\.x\)/);
  assert.match(mergeSource, /!all\(abs\(a\)<vec4<f32>\(1e30\)\)/);
  eqBits(merge([1, 7, 95, 2], [1, 0, 1, 0], 1), [1, 7, 96, 2]);
  eqBits(merge([10000, 7, 95, 2], [1, 0, Infinity, 0], 1), [1, 0, 96, 2]);
  eqBits(merge([10000, 7, 96, 2], [1, 0, 1, 0], 1), [0, 999, 97, 1]);
});
