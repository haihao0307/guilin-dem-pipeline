import {sphereOffset,sinSample} from './sphere-kernel.mjs';
/**
 * Mark 3 rivet sphere rule v1. No source coordinates are embedded here.
 * Geometry: 2 ends × 2 columns × 14 rows of radius-0.015 UV spheres.
 * Source seams/vertex ordering are described by a 480-byte (latitude,longitude)
 * address map. Residuals are explicitly separate, at most one Float32 ULP.
 *
 * Arithmetic contract: IEEE binary64, separately rounded multiply/add in the
 * written order, then Math.fround once per output coordinate. Never use FMA.
 * Sin samples are fixed correctly named IEEE constants; Math.sin/cos are unused.
 */
const Q = Object.freeze([0, 0.3826834323650897, 0.7071067811865476, 0.9238795325112867, 1]);
export function sinPi8(i) { return sinSample(i,16); }
export function cosPi8(i) { return sinPi8(i + 4); }
export function parseRivetRule(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (new TextDecoder().decode(bytes.subarray(0, 8)) !== 'M3RVSP01') throw Error('Bad rivet rule magic');
  const parameters = Array.from({length:6}, (_, i) => view.getFloat64(8 + 8*i, true));
  const [longitudeSegments, latitudeSegments, rows, columns, ends, samples, corrections] =
    Array.from({length:7}, (_, i) => view.getUint32(56 + 4*i, true));
  if (longitudeSegments!==16 || latitudeSegments!==8 || rows!==14 || columns!==2 || ends!==2 || samples!==480)
    throw Error('Unrecognized sampling contract');
  const scalarCount = rows * columns * ends * samples * 3;
  const maskBytes = Math.ceil(scalarCount/8), signBytes = Math.ceil(corrections/8);
  if (bytes.byteLength !== 84 + samples + maskBytes + signBytes) throw Error('Rivet rule length mismatch');
  return {parameters, longitudeSegments, latitudeSegments, rows, columns, ends, samples, corrections, scalarCount,
    labels:bytes.subarray(84,84+samples), mask:bytes.subarray(84+samples,84+samples+maskBytes),
    signs:bytes.subarray(84+samples+maskBytes)};
}
export function generateRivetPositions(rule) {
  const {parameters:p, rows, columns, ends, samples, labels, scalarCount} = rule;
  const output = new Float32Array(scalarCount);
  let out = 0;
  for (let end=0; end<ends; ++end) {
    const endSign = end===0 ? -1 : 1;
    for (let column=0; column<columns; ++column) {
      const cx = p[column];
      for (let row=0; row<rows; ++row) {
        const rowOffset = row * p[3];
        const cy = p[2] + rowOffset;
        for (let vertex=0; vertex<samples; ++vertex) {
          const latitude = labels[vertex] >>> 4, longitude = labels[vertex] & 15;
          if (latitude>8) throw Error('Latitude outside sphere');
          const [dx,dy,dz] = sphereOffset(p[5],latitude,longitude,16,8);
          output[out++] = Math.fround(cx + dx);
          output[out++] = Math.fround(cy + dy);
          const positiveZ = p[4] + dz;
          output[out++] = Math.fround(endSign * positiveZ);
        }
      }
    }
  }
  return output;
}
export function decodeRivetPositions(input, {applyCorrections=true}={}) {
  const rule = parseRivetRule(input);
  const generated = generateRivetPositions(rule);
  if (!applyCorrections) return generated;
  const bits = new Uint32Array(generated.buffer);
  let residualIndex=0;
  for (let scalar=0; scalar<rule.scalarCount; ++scalar) {
    if ((rule.mask[scalar>>>3] >>> (scalar&7)) & 1) {
      const sign = (rule.signs[residualIndex>>>3] >>> (residualIndex&7)) & 1;
      bits[scalar] = bits[scalar] + (sign ? 1 : -1);
      residualIndex++;
    }
  }
  if (residualIndex!==rule.corrections) throw Error('Correction mask population mismatch');
  return generated;
}
