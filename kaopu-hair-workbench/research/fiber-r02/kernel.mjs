/** HAIR-FIBER-R02. SI geometry; deterministic specimen, not a biological scalp. */
export const VERSION = 'HAIR-FIBER-R02';
export const COUNT = 10000;
export const SEGMENTS = 80;
export function seedRandom(seed = 270314) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}
export function makeRoots(count = COUNT, seed = 270314) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 60000) throw Error('Invalid strand count');
  const r = seedRandom(seed), roots = new Float32Array(count * 4), traits = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const group = i % 17, gx = (group / 16 - .5) * .052;
    const theta = r() * Math.PI * 2, radius = Math.sqrt(r());
    roots.set([gx + Math.cos(theta) * radius * .0043, Math.sin(theta) * radius * .0048, group, r()], i * 4);
    const fly = r() < .035 ? 1 : 0;
    traits.set([.84 + .16 * r(), .72 + .48 * r(), r() * 6.2831853, fly], i * 4);
  }
  return { roots, traits, count, seed };
}
export function hashFloats(arrays) {
  let h = 2166136261;
  for (const a of arrays) for (const b of new Uint8Array(a.buffer, a.byteOffset, a.byteLength)) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
}
export function frameMean(oldValue, newValue, count) {
  if (!Number.isInteger(count) || count < 1) throw Error('invalid accumulation count');
  return oldValue + (newValue - oldValue) / count;
}
export function halton(index, base) {
  let f = 1, x = 0;
  while (index > 0) { f /= base; x += f * (index % base); index = Math.floor(index / base); }
  return x;
}
export function pathEnergy(f, opticalDepth) {
  const t = Math.exp(-opticalDepth), R = f, TT = (1-f)**2*t, TRT = TT*f*t;
  const tail = f === 1 ? 0 : TRT*f*t/(1-f*t);
  return [R, TT, TRT, tail];
}
// Artist-selected RGB absorption coefficients in normalized fiber diameter units.
// They are not a calibrated eumelanin concentration or metre^-1 measurements.
export const MATERIALS = Object.freeze({
  chestnut: { name: '栗棕', sigma: [.40, .80, 1.30], roughness: .30 },
  black: { name: '自然黑', sigma: [1.65, 2.08, 2.65], roughness: .28 },
  honey: { name: '蜜金', sigma: [.035, .10, .27], roughness: .31 },
  silver: { name: '银白', sigma: [.017, .021, .027], roughness: .35 }
});
