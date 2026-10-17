/** Decode a hybrid analytic sphere program. No complete source field fallback. */
import {sphereOffset} from './sphere-kernel.mjs';
export function generate(params, labels, lon, lat) {
  const out = new Float32Array(labels.length * 3);
  for (let i = 0; i < labels.length; i++) {
    const [x, y, z] = sphereOffset(1, labels[i] >> 4, labels[i] & 15, lon, lat);
    for (let a = 0; a < 3; a++) {
      const k = 3 + a * 3;
      out[i * 3 + a] = params[a] + ((params[k] * x + params[k + 1] * y) + params[k + 2] * z);
    }
  }
  return out;
}
export function decodeRaw(bytes, {parameterScale = 1} = {}) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (new TextDecoder().decode(data.subarray(0, 8)) !== 'A4SPHR01') throw new Error('Invalid A4 sphere rule magic');
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let off = 8;
  const u32 = () => {const v = dv.getUint32(off, true); off += 4; return v;};
  const vertices = u32(), ng = u32(), nm = u32(), nraw = u32(), deltaSize = u32();
  if (vertices > 10000000 || ng > vertices || nm > ng) throw new Error('Invalid rule counts');
  const maps = [];
  for (let i = 0; i < nm; i++) {
    const lon = dv.getUint16(off, true), lat = dv.getUint16(off + 2, true); off += 4;
    const count = u32(), labels = data.slice(off, off + count); off += count;
    if (labels.length !== count || !((lon === 12 && lat === 6) || (lon === 16 && lat === 8))) throw new Error('Invalid sample map');
    maps.push({lon, lat, labels});
  }
  const out = new Float32Array(vertices * 3), covered = new Uint8Array(vertices);
  for (let g = 0; g < ng; g++) {
    const mi = u32(), start = u32(), mode = u32(), params = [];
    for (let j = 0; j < 12; j++) {params.push(dv.getFloat64(off, true)); off += 8;}
    if (!maps[mi] || !params.every(Number.isFinite) || mode > 1) throw new Error('Invalid sphere instance');
    for (let j = 3; j < 12; j++) params[j] *= parameterScale;
    const {lon, lat, labels} = maps[mi], positions = generate(params, labels, lon, lat);
    for (let j = 0; j < labels.length; j++) {
      const ix = mode ? u32() : start + j;
      if (ix >= vertices || covered[ix]) throw new Error('Sphere address overlap or overflow');
      covered[ix] = 1;
      for (let a = 0; a < 3; a++) out[ix * 3 + a] = positions[j * 3 + a];
    }
  }
  const bits = new Uint32Array(out.buffer); let count = 0;
  for (let i = 0; i < vertices; i++) if (!covered[i]) {
    for (let a = 0; a < 3; a++) bits[i * 3 + a] = u32();
    count++;
  }
  if (count !== nraw || off + deltaSize !== data.length) throw new Error('Invalid residual length');
  for (let i = 0; i < vertices; i++) if (covered[i]) for (let a = 0; a < 3; a++) {
    let value = 0, factor = 1, b;
    do {
      if (off >= data.length || factor > 2 ** 35) throw new Error('Truncated or oversized bit correction');
      b = data[off++]; value += (b & 127) * factor; factor *= 128;
    } while (b & 128);
    const delta = value % 2 === 0 ? value / 2 : -(value + 1) / 2;
    bits[i * 3 + a] = bits[i * 3 + a] + delta;
  }
  if (off !== data.length) throw new Error('Trailing sphere rule data');
  return out;
}
