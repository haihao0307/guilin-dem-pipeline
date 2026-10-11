/** CPU control-flow fixtures only. This is NOT a WGSL compiler or a GPU/mother-field equivalence test. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RESUMABLE_TRACE_WGSL } from '../trace-core.mjs';

// Exact traceWorld snapshot from receiver SHA-256
// 1352b6653bcb042e56fa3e6226acd6949bab1317ba610b289e7a11740407ce23.
// It remains embedded because the integrating worker may edit receiver.mjs.
const ORIGINAL_TRACE_WGSL = String.raw`fn traceWorld(ro:vec3<f32>,rd:vec3<f32>,farT:f32)->Hit{
 var t=.001;var prevT=t;var prevD=1.;var f=rawField(1e4,0,ro);var regularSteps=0u;var localSteps=0u;let interval=clothRayInterval(ro,rd);
 for(var i=0u;i<692u;i++){
 if(t>farT){return Hit(farT,false,false,i,localSteps,rawField(1e4,0,ro+rd*farT));}
 let local=u.clothLocalBudget>0u&&t>=interval.x&&t<=interval.y;
 if(local){if(localSteps>=min(u.clothLocalBudget,512u)){return Hit(t,false,true,i,localSteps,f);}localSteps++;}else{if(regularSteps>=180u){return Hit(t,false,true,i,localSteps,f);}regularSteps++;}
 let sample=sceneSample(ro+rd*t);f=sample.field;if(u.clothLocalBudget>0u&&!local){f=sample.other;}let eps=.000008+t*.000001;
 if(abs(f.d)<eps){return Hit(t,true,false,i+1u,localSteps,f);}if(f.d<0. && prevD>0.){var a=prevT;var b=t;for(var j=0;j<9;j++){let m=(a+b)*.5;let d=sceneField(ro+rd*m).d;if(d>0.){a=m;}else{b=m;}}t=(a+b)*.5;return Hit(t,true,false,i+1u,localSteps,sceneField(ro+rd*t));}
 prevT=t;prevD=f.d;var advance=clamp(abs(f.d)*.48,.000006,.55);if(local&&f.id==8){let possible=clothEmptyIntervalStep(ro+rd*t,rd);if(possible>advance){let other=sample.other;advance=max(advance,min(possible,clamp(abs(other.d)*.48,.000006,.55)));}}if(u.clothLocalBudget>0u&&interval.x<=interval.y&&t<interval.x){advance=min(advance,interval.x-t);}t+=advance;}
 return Hit(t,false,true,692u,localSteps,f);
}`;

// These mechanical substitutions preserve the scalar traversal statements from
// both WGSL texts. They intentionally do not implement vector algebra or f32
// rounding. Fixtures use ro=0, rd=1 and deterministic scalar substitute fields.
function cpuFunctions(source, fixture) {
  const calls = [];
  const fieldAt = (p, other = false) => ({
    d: (other ? fixture.other ?? fixture.distance : fixture.distance)(p),
    id: other ? fixture.otherId ?? 2 : fixture.id ?? 2,
    q: p, seed: 0.25, variant: 0, wet: 0, repair: 0, age: 0,
  });
  const rawField = (d, id, q) => ({ d, id, q, seed: 0, variant: 0, wet: 0, repair: 0, age: 0 });
  const sceneSample = p => {
    calls.push(['sample', p]);
    return { field: fieldAt(p), other: fieldAt(p, true) };
  };
  const sceneField = p => {
    calls.push(['refinement', p]);
    return fieldAt(p);
  };
  const bindings = {
    u: { clothLocalBudget: fixture.clothBudget ?? 0 },
    rawField, sceneSample, sceneField,
    clothRayInterval: () => ({ x: fixture.interval?.[0] ?? 1, y: fixture.interval?.[1] ?? -1 }),
    clothEmptyIntervalStep: fixture.emptyStep ?? (() => 0),
    abs: Math.abs, min: Math.min, max: Math.max,
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    u32: v => v >>> 0,
    f32: v => v, // Counts up to 1024 are exactly representable as f32.
    vec4: (x, y, z, w) => ({ x, y, z, w }),
    Hit: (t, hit, exhausted, steps, localSteps, field) => ({ t, hit, exhausted, steps, localSteps, field }),
    TraceProgress: (h, previous) => ({ h, previous }),
  };
  const translated = source
    .replace(/\/\/[^\n]*/g, '')
    .replace(/struct\s+\w+\s*\{[^}]*\};/g, '')
    .replace(/\bfn\s+(\w+)\(([^)]*)\)\s*->\s*\w+\s*\{/g,
      (_, name, params) => `function ${name}(${params.replace(/:\s*(?:vec[234]<f32>|\w+)/g, '')}){`)
    .replace(/\bvec4<f32>\s*\(/g, 'vec4(')
    .replace(/\b(\d+)u\b/g, '$1')
    .replace(/\blet\b/g, 'const')
    .replace(/\bvar\b/g, 'let');
  assert(!/\bfn\b|->|\b\d+u\b|vec\d</.test(translated), 'unsupported WGSL syntax in scalar CPU harness');
  const exports = /function traceProgress\(/.test(translated)
    ? '{traceStart,traceProgress,traceWorld}' : '{traceWorld}';
  const compiled = new Function(...Object.keys(bindings), `${translated}\nreturn ${exports};`)(...Object.values(bindings));
  return { ...compiled, calls };
}

const initialPrevious = () => ({ x: .001, y: 1, z: 0, w: 0 });
const extendedOriginal = ORIGINAL_TRACE_WGSL.replaceAll('180u', '1024u').replaceAll('692u', '1024u');
function compareFixture(fixture) {
  const oldBaseline = cpuFunctions(ORIGINAL_TRACE_WGSL, fixture);
  const coreBaseline = cpuFunctions(RESUMABLE_TRACE_WGSL, fixture);
  const expected = oldBaseline.traceWorld(0, 1, fixture.farT);
  const actual = coreBaseline.traceWorld(0, 1, fixture.farT);
  assert.deepEqual(actual, expected, `${fixture.name}: legacy wrapper Hit`);
  assert.deepEqual(coreBaseline.calls, oldBaseline.calls, `${fixture.name}: legacy sample sequence`);

  const oneShot = cpuFunctions(extendedOriginal, fixture);
  const split = cpuFunctions(RESUMABLE_TRACE_WGSL, fixture);
  const unsplit = oneShot.traceWorld(0, 1, fixture.farT);
  const baseline = split.traceProgress(0, 1, fixture.farT, split.traceStart(0), initialPrevious(), 180, 692);
  assert.deepEqual(baseline.h, expected, `${fixture.name}: explicit baseline Hit`);
  assert.equal(baseline.previous.z, baseline.h.steps - baseline.h.localSteps, `${fixture.name}: absolute counters`);
  const before = split.calls.length;
  // Exactly exhausted rays are selected for continuation in production. Passing
  // a terminal state here also exercises the core's defensive no-op behavior.
  const resumed = split.traceProgress(0, 1, fixture.farT, baseline.h, baseline.previous, 1024, 1024);
  assert.deepEqual(resumed.h, unsplit, `${fixture.name}: split versus uninterrupted Hit`);
  assert.deepEqual(split.calls, oneShot.calls, `${fixture.name}: split versus uninterrupted sample/refinement sequence`);
  assert(resumed.h.steps <= 1024, `${fixture.name}: total traversal cap`);
  assert(resumed.h.localSteps <= Math.min(fixture.clothBudget ?? 0, 512), `${fixture.name}: cloth cap`);
  if (!baseline.h.exhausted) {
    assert.deepEqual(resumed, baseline, `${fixture.name}: terminal state unchanged`);
    assert.equal(split.calls.length, before, `${fixture.name}: terminal state does no work`);
  }
  fixture.verify?.({ baseline, resumed, calls: split.calls, before });
  console.log(`PASS ${fixture.name}: baseline=${baseline.h.steps}, final=${resumed.h.steps}, local=${resumed.h.localSteps}, status=${resumed.h.hit ? 'hit' : resumed.h.exhausted ? 'unresolved' : 'miss'}`);
}

let after511 = .001;
for (let i = 0; i < 511; i++) after511 += .1 * .48;
const fixtures = [
  {
    name: 'positive-to-negative crossing immediately after regular 180',
    distance: t => t < 8.62 ? .1 : -.1, farT: 20,
    verify({ baseline, resumed, calls, before }) {
      assert(baseline.h.exhausted && baseline.h.steps === 180);
      assert(baseline.h.t > baseline.previous.x);
      assert.equal(baseline.h.field.q, baseline.previous.x, 'exhausted field belongs to the previous sample');
      assert.equal(baseline.previous.y, .1);
      assert(resumed.h.hit && resumed.h.steps === 181);
      assert.equal(calls[before][1], baseline.h.t, 'resume samples the saved next t');
      assert.equal(calls.filter(c => c[0] === 'refinement').length, 10, 'nine bisections plus unchanged final field probe');
      assert(Math.abs(resumed.h.t - 8.62) < .048 / 512);
    },
  },
  {
    name: 'far exit after continuation begins', distance: () => .1, farT: 8.65,
    verify({ baseline, resumed }) {
      assert(baseline.h.exhausted);
      assert(!resumed.h.hit && !resumed.h.exhausted);
      assert.equal(resumed.h.steps, 181);
      assert.equal(resumed.h.t, 8.65);
    },
  },
  {
    name: 'far exit wins over exhausted regular counter', distance: () => .1, farT: 8.62,
    verify({ baseline }) { assert(!baseline.h.exhausted && !baseline.h.hit && baseline.h.steps === 180); },
  },
  {
    name: 'positive grazing tangent resolves without sign crossing',
    distance: t => Math.sqrt((t - 1) ** 2 + .25) - .5, farT: 3,
    verify({ baseline, resumed, calls }) {
      assert(baseline.h.exhausted && baseline.h.steps === 180);
      assert(resumed.h.hit && resumed.h.steps > 180);
      assert(resumed.h.field.d >= 0);
      assert.equal(calls.filter(c => c[0] === 'refinement').length, 0);
    },
  },
  {
    name: 'cloth 512 counter cannot be reset by resume',
    distance: () => .001, id: 8, clothBudget: 512, interval: [0, 100], farT: 100,
    verify({ baseline, resumed, calls, before }) {
      assert(baseline.h.exhausted && baseline.h.steps === 512);
      assert.deepEqual(resumed, baseline);
      assert.equal(calls.length, before, 'blocked cloth performs no new field sample');
    },
  },
  {
    name: 'cloth requested allowance above 512 still stops at 512',
    distance: () => .001, id: 8, clothBudget: 999, interval: [0, 100], farT: 100,
    verify({ resumed }) { assert(resumed.h.exhausted && resumed.h.localSteps === 512); },
  },
  {
    name: 'cloth smaller requested allowance remains unchanged',
    distance: () => .001, id: 8, clothBudget: 7, interval: [0, 100], farT: 100,
    verify({ resumed }) { assert(resumed.h.exhausted && resumed.h.localSteps === 7); },
  },
  {
    name: '512 local plus 180 regular reaches original total 692',
    distance: () => .1, clothBudget: 512, interval: [.001, after511 + .024], farT: 100,
    verify({ baseline, resumed }) {
      assert.equal(baseline.h.steps, 692);
      assert.equal(baseline.h.localSteps, 512);
      assert.equal(baseline.previous.z, 180);
      assert(resumed.h.exhausted && resumed.h.steps === 1024);
      assert.equal(resumed.previous.z, 512);
    },
  },
  {
    name: 'cloth entry clamp, outside other field, and existing empty-step path',
    distance: () => .001, other: () => .1, id: 8,
    clothBudget: 512, interval: [.07, .37], emptyStep: () => .06, farT: 12,
    verify({ baseline, resumed, calls }) {
      assert(baseline.h.exhausted);
      assert(calls.some(c => c[0] === 'sample' && c[1] === .07), 'existing interval entry clamp is retained');
      assert(resumed.h.localSteps > 0);
      assert(!resumed.h.exhausted && !resumed.h.hit);
    },
  },
  { name: 'early epsilon hit is terminal', distance: t => 1 - t, farT: 3,
    verify({ baseline }) { assert(baseline.h.hit && baseline.h.steps < 180); } },
  { name: 'early far miss is terminal', distance: () => .1, farT: .1 },
  { name: 'unresolved regular ray preserves hard total ceiling', distance: () => .00002, farT: 100,
    verify({ resumed }) { assert(resumed.h.exhausted && resumed.h.steps === 1024); } },
];
for (const fixture of fixtures) compareFixture(fixture);

// Hard total bounds, zero-work resume, and a repeated-split equivalence check.
{
  const fixture = { distance: () => .00002, farT: 100 };
  const cpu = cpuFunctions(RESUMABLE_TRACE_WGSL, fixture);
  const seed = cpu.traceStart(0);
  assert.deepEqual(seed, { t: .001, hit: false, exhausted: true, steps: 0, localSteps: 0,
    field: { d: 1e4, id: 0, q: 0, seed: 0, variant: 0, wet: 0, repair: 0, age: 0 } });
  const zero = cpu.traceProgress(0, 1, 100, seed, initialPrevious(), 1024, 0);
  assert.deepEqual(zero, { h: seed, previous: initialPrevious() });
  assert.equal(cpu.calls.length, 0);
  const cap = cpu.traceProgress(0, 1, 100, seed, initialPrevious(), 0xffffffff, 0xffffffff);
  assert(cap.h.exhausted && cap.h.steps === 1024);
  assert.equal(cpu.calls.length, 1024);
  const cappedAgain = cpu.traceProgress(0, 1, 100, cap.h, cap.previous, 0xffffffff, 0xffffffff);
  assert.deepEqual(cappedAgain, cap);
  assert.equal(cpu.calls.length, 1024);

  const split = cpuFunctions(RESUMABLE_TRACE_WGSL, fixture);
  let state = { h: split.traceStart(0), previous: initialPrevious() };
  for (const bound of [1, 17, 179, 180, 181, 692, 1024]) {
    state = split.traceProgress(0, 1, 100, state.h, state.previous, 1024, bound);
    assert.equal(state.h.steps, bound);
  }
  assert.deepEqual(state, cap);
  assert.deepEqual(split.calls, cpu.calls);
  console.log('PASS hard total clamp, empty slice, idempotent exhausted cap, and repeated split');
}

// Pin equations and helper invocations independently of the CPU substitution.
assert(RESUMABLE_TRACE_WGSL.includes('struct Hit { t:f32,hit:bool,exhausted:bool,steps:u32,localSteps:u32,field:RoomField };'));
for (const unchanged of [
  'let local=u.clothLocalBudget>0u&&t>=interval.x&&t<=interval.y;',
  'min(u.clothLocalBudget,512u)',
  'let sample=sceneSample(ro+rd*t);f=sample.field;if(u.clothLocalBudget>0u&&!local){f=sample.other;}let eps=.000008+t*.000001;',
  'var a=prevT;var b=t;for(var j=0;j<9;j++){let m=(a+b)*.5;let d=sceneField(ro+rd*m).d;if(d>0.){a=m;}else{b=m;}}t=(a+b)*.5;',
  'prevT=t;prevD=f.d;var advance=clamp(abs(f.d)*.48,.000006,.55);if(local&&f.id==8){let possible=clothEmptyIntervalStep(ro+rd*t,rd);if(possible>advance){let other=sample.other;advance=max(advance,min(possible,clamp(abs(other.d)*.48,.000006,.55)));}}if(u.clothLocalBudget>0u&&interval.x<=interval.y&&t<interval.x){advance=min(advance,interval.x-t);}t+=advance;',
]) {
  assert(ORIGINAL_TRACE_WGSL.includes(unchanged), 'pinned equation is in original');
  assert(RESUMABLE_TRACE_WGSL.includes(unchanged), 'candidate preserves pinned equation');
}
assert(!/@(?:compute|fragment|vertex|group|binding)\b/.test(RESUMABLE_TRACE_WGSL), 'core owns no renderer or GPU bindings');
const traceHash = createHash('sha256').update(ORIGINAL_TRACE_WGSL).digest('hex');
assert.equal(traceHash, '016e8e77397e9d304179a002adc0328fb020ca6175dfb665873bd5cc2ecaebf0', 'original trace snapshot remains byte-identical');
console.log(`Original traceWorld snapshot SHA-256: ${traceHash}`);
console.log(`PASS ${fixtures.length} deterministic CPU control-flow fixtures plus cap/repeated-split/static checks.`);
console.log('Not tested here: WGSL compilation, GPU arithmetic, GPU queue/buffer integration, actual mother fields, camera, normals, shadows, or rendered image equivalence.');
