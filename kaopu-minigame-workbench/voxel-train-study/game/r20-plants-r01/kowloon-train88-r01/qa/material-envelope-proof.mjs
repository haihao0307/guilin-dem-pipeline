// Read-only CPU algebra/source audit. Run:
// node --test kowloon-train88-r01/qa/material-envelope-proof.mjs
// Interval algebra below is the proof argument; finite grids are regressions.
// Neither this program nor the grids prove IEEE/WGSL rounding or ray Lipschitz.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {KP_BRICK_WGSL as brick} from '../../kowloon-station-r04/mothers/brick-core.mjs';
import {KP_WOOD_WGSL as wood} from '../../kowloon-station-r04/mothers/wood-core.mjs';
import {KP_STONE_WGSL as stone} from '../../kowloon-station-r04/mothers/stone-fields.mjs';
import {KP_METAL_WGSL as metal} from '../../kowloon-station-r04/mothers/metal.mjs';
import {KP_PLASTER_WGSL as plaster} from '../../kowloon-station-r04/mothers/plaster-core.mjs';
import {STATION_MATTER_WGSL as matter} from '../../kowloon-station-r04/station-matter.mjs';
const field = fs.readFileSync(new URL('../../kowloon-station-r04/station-field.mjs', import.meta.url), 'utf8');
const receiver = fs.readFileSync(new URL('../../kowloon-station-r04/receiver.mjs', import.meta.url), 'utf8');
const compact = s => s.replace(/\s+/g, '');
function body(source, name) {
  const start = source.indexOf('fn ' + name + '(');
  assert(start >= 0, 'Missing source function ' + name);
  const open = source.indexOf('{', start); let level = 1, end = open + 1;
  for (; level && end < source.length; end++) { if (source[end] === '{') level++; if (source[end] === '}') level--; }
  assert.equal(level, 0, 'Unclosed ' + name);
  return source.slice(open + 1, end - 1);
}
function contains(source, name, snippets) {
  const text = compact(body(source, name));
  for (const snippet of snippets) assert(text.includes(compact(snippet)), name + ': proof dependency changed: ' + snippet);
}
function number(source, pattern) { const m = source.match(pattern); assert(m, String(pattern)); return Number(m[1]); }
function sourceLine(source, name) { const i = source.indexOf('fn ' + name + '('); assert(i >= 0); return source.slice(0, i).split('\n').length; }
function close(actual, expected, epsilon = 1e-14) { assert(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`); }
function validateAge(age) { if (typeof age !== 'number' || !Number.isFinite(age) || age < 0 || age > 1) throw Error('Age must be finite and in [0,1]'); return age; }

const brickScale = number(brick, /const KP_BRICK_SCALE:f32=([\d.]+);/);
const stoneScale = number(stone, /const KP_STONE_SCALE_M:f32\s*=\s*([\d.]+);/);
const woodMacroM = number(wood, /p\.macroDisplacementM=([\d.]+);/);
const woodRelief = number(wood, /p\.reliefScale=([\d.]+);/);
const retainedMax = 1 - .08;
const brickZError = .055384615 - .480 * brickScale;
const brickGainMax = 1 + .10 * .42;
const brickDelta = [brickZError - .0048 * brickScale * brickGainMax, .006];
const stoneRawHeight = [(-.018 / 2 - .007 / 2 - .025) * stoneScale,
  (.018 / 2 + .007 / 2 + .004) * stoneScale];
const stoneReliefMax = .25 + .75 * retainedMax;
const stoneTightDelta = [-Math.min(.004, stoneRawHeight[1] * stoneReliefMax),
  -Math.max(-.004, stoneRawHeight[0] * stoneReliefMax)];
const woodBroadMax = (.58 + .58 * .45 + .58 * .45 ** 2) / .94;
const woodMacroRange = [-.5, (woodBroadMax - .5) * .78 + .11];
const woodMaxAmplitude = woodMacroM * woodRelief * (.35 + .85 * retainedMax);
const woodTightDelta = [-woodMacroRange[1] * woodMaxAmplitude, -woodMacroRange[0] * woodMaxAmplitude];
const woodRuntimeBound = (macroDisplacementM, reliefScale) => .557 * Math.abs(macroDisplacementM * reliefScale);
const plasterTightDelta = [-Math.min(.001, stoneRawHeight[1] * .25) - .0195,
  -Math.max(-.001, stoneRawHeight[0] * .25)];
const plasterMacroUpper = .48 * Math.tanh(.78 * (31 / 16) * (1 - .6556965458313674)) + .52;
const plasterExtraTightDelta = [-Math.min(.001, stoneRawHeight[1] * .25) - (.0165 + .003 * plasterMacroUpper), plasterTightDelta[1]];
const concreteDelta = retained => [-.00021 + .0007 * Math.min(0, retained), .00021 + .0007 * Math.max(0, retained)];
const engineeringPad = d => 2e-6 + 16 * 2 ** -23 * Math.max(1, Math.abs(d));

test('proof prerequisites are explicit; invalid ages cannot use the fixed envelope', () => {
  for (const a of [0, .58, 1]) assert.equal(validateAge(a), a);
  for (const a of [-1, 1.000001, Infinity, NaN, '1', undefined]) assert.throws(() => validateAge(a));
  contains(field, 'repairAt', ['return .08+.65*']);
  contains(matter, 'resolveStationState', ['u.age*(1.-repair)']);
  assert.equal(retainedMax, .92);
  // This tests the precondition checker, not that every renderer entry invokes it.
});

test('brick lower bound follows rounded-box support plane and contour bounds, not sampled extrema', () => {
  contains(field, 'brickQ', ['.055384615+d']);
  contains(brick, 'br_roundBox', ['let q=abs(p)-b+vec3<f32>(r)', 'length(max(q,vec3<f32>(0.0)))+min(max(q.x,max(q.y,q.z)),0.0)-r']);
  contains(brick, 'br_chipWear', ['let v=max(vIn-0.0018,0.0)', '0.020*tanh(v/0.020)*smoothstep(0.0010,0.0060,v)']);
  contains(brick, 'br_contour', ['0.0048*tanh(v/0.030)']);
  contains(brick, 'br_contourLong', ['if(s>=-0.0022){return s;}', '-0.0022+0.00045*tanh((s+0.0022)/0.00045)']);
  contains(brick, 'br_surfaceDelta', ['0.038*tanh(sum.x*1.10/0.038)+sum.y/max(1.0,sum.z)']);
  contains(brick, 'kpBrickBaseDistance', ['vec3<f32>(1.04,0.265,0.480)', 'mix(1.0,0.90+0.20*br_h11(seed+7.1),variation)']);
  contains(matter, 'evaluateStationGeometry', ['kpBrickBaseDistance(q,seed,variant,.42)', 'g.d=min(h.d+.006,native+g.loss)', '0.,.0016']);
  // Each mask is a product of smoothsteps in [0,1]. Chips >=0; every
  // contour >=-.0048, hence weighted contour/max(1,totalWeight)>=-.0048.
  // A rounded box satisfies B(q)>=q.z-b.z. Variant sign flips preserve B.
  close(brickZError, -3.9200000190309225e-10);
  close(brickGainMax, 1.042);
  close(brickDelta[0], -.000577108084384642);
  assert(brickDelta[0] > -.000578);
  assert.equal(brickDelta[1], .006);
});

test('stone clamp and convex-noise arithmetic give independent safe and tighter intervals', () => {
  contains(stone, 'st_sf', ['st_valueNoise3(p)*0.57+st_valueNoise3(p*2.07+vec3<f32>(13.7))*0.28+st_valueNoise3(p*4.11+vec3<f32>(27.2))*0.15']);
  contains(matter, 'stationStoneHeight', ['((broad-.5)*.018+(region-.5)*.007+vein*.004-pits*.025)*KP_STONE_SCALE_M']);
  contains(matter, 'evaluateStationGeometry', ['clamp(stationStoneHeight(h.q*.19)*(.25+.75*st.retained),-.004,.004)']);
  close(.57 + .28 + .15, 1);
  close(stoneRawHeight[0], -.00463235294117647);
  close(stoneRawHeight[1], .002038235294117647);
  close(stoneTightDelta[0], -.0019159411764705884);
  assert(stoneTightDelta[1] <= .004);
  // Recommended implementation uses the explicit clamp [-.004,+.004].
});

test('wood runtime mother bound includes noise normalization and every source class multiplier', () => {
  contains(wood, 'kwMacroField', ['var amplitude:f32 = 0.58', 'i < 3', 'amplitude *= 0.45', 'return result / 0.94']);
  contains(wood, 'kpWoodMacroDisplacement', ['(broad - 0.5) * 0.78 + (longWave - 0.5) * 0.22', 'classWeight = 1.08']);
  contains(wood, 'kpWoodMacroDisplacementBound', ['0.557*abs(wp.macroDisplacementM*wp.reliefScale)']);
  contains(matter, 'stationWoodParams', ['wp.reliefScale*=.35+.85*st.retained']);
  contains(matter, 'stationWoodClass', ['select(0.,1.']);
  // VertexNoise is a convex trilinear interpolation of fract hashes. The
  // unusual source normalization is 0.94, NOT the weight sum 0.95845.
  close(woodBroadMax, 1.0196276595744682);
  close(woodMacroRange[1], .5153095744680852);
  assert(Math.max(-woodMacroRange[0], woodMacroRange[1]) * 1.08 < .557);
  close(woodTightDelta[0], -.0002528916427799684);
  close(woodTightDelta[1], .00024537836604434255);
  close(woodRuntimeBound(woodMacroM, woodRelief * (.35 + .85 * retainedMax)), .0002733514997733976);
  // Runtime must pass stationWoodParams(h,st), not default/frozen parameters.
});

test('metal paint/corrosion and concrete have signed, rather than symmetric, geometry bounds', () => {
  contains(metal, 'kpMetalCorrosion', ['return clamp(', ',0.,1.)']);
  contains(matter, 'stationRoofPaintCoverage', ['1.-kpMetalCorrosion(stationMetalCoordinates(h,p),st.age,st.wet,st.repair)*.8']);
  contains(matter, 'evaluateStationGeometry', ['g.loss=kpMetalCorrosion(stationMetalCoordinates(h,p),st.age,st.wet,st.repair)*.0008', 'g.thickness=.00006*stationRoofPaintCoverage']);
  contains(matter, 'stationConcreteHeight', ['return(fine-.5)*.00042-chip*.0007']);
  // Roof delta=.0008*C-.00006*(1-.8*C), C in [0,1].
  close(.0008 - .00006 * (1 - .8), .000788);
  close(concreteDelta(retainedMax)[0], -.00021);
  close(concreteDelta(retainedMax)[1], .000854);
  assert(concreteDelta(1)[1] <= .00091 + 1e-16);
});

test('plaster thickness clamp covers full layer loss and stone substrate displacement', () => {
  contains(receiver, 'stationPlasterParams', ['.0165,.0012+.0018*u.age,0.,.013,.020']);
  contains(matter, 'stationCoatingThickness', ['clamp(a.thicknessM+a.reliefM*macroSignal,a.minThicknessM,a.maxThicknessM)', 'return sourceThickness*coverage']);
  contains(plaster, 'kpPlasterMacro', ['clamp(0.48*low+0.52*coarse,-1.0,1.0)']);
  contains(matter, 'evaluateStationGeometry', ['clamp(stationStoneHeight(h.q*.19)*.25,-.001,.001)-g.thickness']);
  // coverage in [0,1]: lost plaster can have thickness 0, not minThickness.
  const sourceMax = .020, stoneAbs = .001;
  close(-sourceMax - stoneAbs, -.021);
  close(.0165 + (.0012 + .0018), .0195);
  close(plasterTightDelta[0], -.02000955882352941);
  close(plasterExtraTightDelta[0], -.019257811982978528);
  assert(plasterTightDelta[1] <= .001);
});

test('exact competition may prune against upper bounds, never nominal or proxy winners', () => {
  const intervals = [brickDelta, [-.004, .004], [0, .0008], woodTightDelta,
    [-.021, .001], [-.00006, .000788], concreteDelta(retainedMax)];
  let cases = 0;
  for (const da of [-.06,-.02,-.006,0,.001,.02,.06]) for (const db of [-.06,-.02,-.006,0,.001,.02,.06])
    for (const A of intervals) for (const B of intervals) for (const ta of [0,.5,1]) for (const tb of [0,.5,1]) {
      const nodes = [{L:da+A[0],U:da+A[1],E:da+A[0]+ta*(A[1]-A[0])},
        {L:db+B[0],U:db+B[1],E:db+B[0]+tb*(B[1]-B[0])}];
      let best = Math.min(...nodes.map(n => n.U)), evaluatedMinimum = Infinity;
      for (const n of nodes) { if (n.L > best) continue; best = Math.min(best, n.E); evaluatedMinimum = Math.min(evaluatedMinimum, n.E); }
      close(evaluatedMinimum, Math.min(...nodes.map(n => n.E))); cases++;
    }
  assert.equal(cases, 21609); // Regression of the interval-pruning implementation.
  const trueNode = {L:.02,U:.03,E:.025}, domainProxy = {L:.015};
  assert.equal(Math.min(trueNode.L, domainProxy.L), .015);
  assert.equal(Math.min(...[trueNode].map(n => n.U)), .03); // proxy is not an upper bound
});

test('brick support-plane grid is regression only; formula proof remains independent', () => {
  const b = [1.04*brickScale,.265*brickScale,.480*brickScale], r = .055*brickScale;
  const roundedBox = p => { const q = p.map((v,i) => Math.abs(v)-b[i]+r);
    return Math.hypot(...q.map(v=>Math.max(v,0))) + Math.min(Math.max(...q),0)-r; };
  let cases = 0;
  for (let ix=0;ix<33;ix++) for (let iy=0;iy<17;iy++) for (const d of [-100,-1,-.2,-.111,-.06,-.045,-.03,-.006,0,.006,.03,.045,.2,1,100]) {
    const B = roundedBox([-.125+ix*.25/32,-.0365+iy*.073/16,.055384615+d]);
    assert(B >= d + brickZError - 2e-14); cases++;
  }
  assert.equal(cases, 8415);
});

test('report separates real-arithmetic bounds, engineering padding and unverified GPU/ray claims', t => {
  const padNear = engineeringPad(0), pad100 = engineeringPad(100);
  assert(padNear > 0 && pad100 > padNear);
  assert(.007 > .006 + Math.sqrt(3)*.00045);
  const references = {
    'station-matter WGSL': ['evaluateStationGeometry','stationWoodParams','stationStoneHeight','stationConcreteHeight','stationCoatingThickness'].map(n=>[n,sourceLine(matter,n)]),
    'brick-core decoded WGSL': ['br_roundBox','br_surfaceDelta','kpBrickBaseDistance'].map(n=>[n,sourceLine(brick,n)]),
    'wood-core decoded WGSL': ['kwMacroField','kpWoodMacroDisplacement','kpWoodMacroDisplacementBound'].map(n=>[n,sourceLine(wood,n)]),
  };
  t.diagnostic(JSON.stringify({scope:'CPU algebra + source guards; no GPU/f32/Lipschitz certification',
    recommended:{brick:brickDelta,stone:[-.004,.004],bareMetal:[0,.0008],roofMetal:[-.00006,.000788],
      wood:'+-kpWoodMacroDisplacementBound(stationWoodParams(h,st))',plaster:[-.021,.001],concrete:concreteDelta(retainedMax)},
    optionalTighter:{stone:stoneTightDelta,wood:woodTightDelta,plaster:plasterTightDelta},
    numericalPadding:{formula:'2e-6 + 16*2^-23*max(1,abs(d)); engineering allowance, not formal rounding proof',padNear,pad100},references}));
});
