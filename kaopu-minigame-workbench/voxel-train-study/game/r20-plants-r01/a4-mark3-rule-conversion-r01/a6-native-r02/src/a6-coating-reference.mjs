/** CPU double-precision reference of the R06-derived A6 layer equations.
 * This verifies causal semantics; it is not a GPU render or bit-identical GLSL
 * float32 validation. Inputs are continuous metre positions, not baked samples.
 */
import {validateA6CoatingWear, A6_DEFAULT_COATING_WEAR} from './a6-causal-coating.mjs';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const fract = x => x - Math.floor(x);
const smoothstep = (a, b, x) => {const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t);};
const add = (a, b) => a.map((x, i) => x + b[i]);
const mul = (a, t) => a.map(x => x * t);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function hash(p) {
  p = p.map(x => fract(x * .1031));
  const d = dot(p, [p[1] + 33.33, p[2] + 33.33, p[0] + 33.33]);
  p = p.map(x => x + d);
  return fract((p[0] + p[1]) * p[2]);
}
/** CPU transcription of the imported R06 mt_knvg cubic interpolation. */
export function a6NoiseValueGradient(p) {
  const i = p.map(Math.floor), f = p.map(fract), u = f.map(x => x * x * (3 - 2 * x)), du = f.map(x => 6 * x * (1 - x));
  const h = offset => hash(add(i, offset));
  const a = h([0,0,0]), b = h([1,0,0]), c = h([0,1,0]), d = h([1,1,0]);
  const e = h([0,0,1]), f1 = h([1,0,1]), g = h([0,1,1]), z = h([1,1,1]);
  const k1 = b-a, k2 = c-a, k3 = e-a, k4 = a-b-c+d, k5 = a-c-e+g, k6 = a-b-e+f1, k7 = -a+b+c-d+e-f1-g+z;
  const [x,y,w] = u;
  return [a+k1*x+k2*y+k3*w+k4*x*y+k5*y*w+k6*w*x+k7*x*y*w,
    du[0]*(k1+k4*y+k6*w+k7*y*w), du[1]*(k2+k4*x+k5*w+k7*x*w), du[2]*(k3+k5*y+k6*x+k7*x*y)];
}
const noise = p => a6NoiseValueGradient(p)[0];
function fBmValueGradient(p) {
  const a = a6NoiseValueGradient(p), b = a6NoiseValueGradient(mul(p, 2.13)), c = a6NoiseValueGradient(mul(p, 4.17));
  return a.map((x, i) => .57*x + .28*(i ? 2.13 : 1)*b[i] + .15*(i ? 4.17 : 1)*c[i]);
}
const resolved = (frequency, fp) => 1 - smoothstep(.30, .95, frequency * fp);
const srgbToLinear = c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const rgb = hex => [0,2,4].map(i => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
export function evaluateA6CoatingLayer(positionM, normal, {
  wear = A6_DEFAULT_COATING_WEAR, footprintM = .00005,
  sourceColorLinear = rgb('103e35'), sourceRoughness = .40, intactMicroReliefM = 0,
} = {}) {
  validateA6CoatingWear(wear);
  for (const vector of [positionM, normal, sourceColorLinear]) if (!Array.isArray(vector) || vector.length !== 3 || vector.some(v => !Number.isFinite(v))) throw new Error('A6 coating CPU vectors require three finite components.');
  if (!Number.isFinite(footprintM) || footprintM < 0 || !Number.isFinite(sourceRoughness) || sourceRoughness < 0 || sourceRoughness > 1 || !Number.isFinite(intactMicroReliefM) || intactMicroReliefM < 0) throw new Error('Invalid A6 coating CPU scale or roughness.');
  const nLength = Math.hypot(...normal); if (!nLength) throw new Error('A6 coating CPU normal cannot be zero.');
  const n = mul(normal, 1 / nLength), p = positionM, fp = footprintM;
  const wx = a6NoiseValueGradient(add(mul(p, 3.7), [7,2,4]));
  const wy = a6NoiseValueGradient(add(mul(p, 4.3), [1,8,3]));
  const wz = a6NoiseValueGradient(add(mul(p, 3.1), [6,1,9]));
  const warp = [wx[0] - .5, wy[0] - .5, wz[0] - .5];
  const macro = fBmValueGradient(add(add(mul(p, 13), mul(warp, 2.8)), [2.7,8.4,1.2]));
  let gradient = [0,1,2].map(i => 13*macro[i+1] + 2.8*(macro[1]*3.7*wx[i+1] + macro[2]*4.3*wy[i+1] + macro[3]*3.1*wz[i+1]));
  gradient = add(gradient, mul(n, -dot(gradient, n)));
  const threshold = 1.02 - .50*wear;
  let distanceM = (macro[0] - threshold) / Math.max(Math.hypot(...gradient), .65);
  distanceM += (noise(mul(p, 137)) - .5)*.0012*resolved(137, fp) + (noise(mul(p, 517)) - .5)*.00032*resolved(517, fp);
  const aa = Math.max(.55*fp, .000008), active = smoothstep(.01, .05, wear);
  const loss = smoothstep(-aa, aa, distanceM)*active, intact = 1-loss;
  const peelExtentM = .00018 + (.0011-.00018)*noise(add(mul(p, 37), [9,2,5]));
  const adhesion = noise(add(mul(p, 43), [17,3,6]));
  const adhesionAA = Math.max(.008, fp*43*.32);
  const primer = loss*(1-smoothstep(peelExtentM-aa, peelExtentM+aa, distanceM))*smoothstep(.54-adhesionAA, .54+adhesionAA, adhesion);
  const substrate = Math.max(loss-primer, 0);
  const micro = .5+(noise(add(mul(p, 490), [11,11,11]))-.5)*resolved(490, fp);
  const primerColor = rgb('746b50'), steelColor = rgb('535b59');
  const coverageDiffuse = sourceColorLinear.map((c, i) => c*intact + primerColor[i]*primer);
  const coverageF0 = steelColor.map(c => c*substrate + .04*(intact+primer));
  const color = coverageDiffuse.map((c, i) => c+coverageF0[i]-.04*(1-substrate));
  const roughness = sourceRoughness*intact + .72*primer + (.36+.04*(micro-.5))*substrate;
  const heightM = .00014*intact + .000055*primer + (micro-.5)*(intactMicroReliefM*intact + .000006*substrate);
  return {threshold, distanceM, loss, layers: [intact, primer, substrate], color, coverageDiffuse, coverageF0, metalness: substrate, roughness, heightM, peelExtentM, micro, corrosion: 0};
}
