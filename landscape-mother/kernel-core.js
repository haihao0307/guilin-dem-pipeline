(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, value) => {
  const t = clamp((value - a) / Math.max(1e-9, b - a));
  return t * t * (3 - 2 * t);
};
const fract = value => value - Math.floor(value);

function hash2(x, z, seed) {
  return fract(Math.sin(x * 127.1 + z * 311.7 + seed * 0.000173) * 43758.5453123);
}

function valueNoise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return mix(mix(a, b, ux), mix(c, d, ux), uz);
}

function fbm2(x, z, seed, octaves = 5) {
  let sum = 0;
  let amplitude = 0.52;
  let frequency = 1;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += (valueNoise2(x * frequency, z * frequency, seed + octave * 193) * 2 - 1) * amplitude;
    normalization += amplitude;
    frequency *= 2.03;
    amplitude *= 0.49;
  }
  return sum / Math.max(normalization, 1e-9);
}

function ridged2(x, z, seed, octaves = 5) {
  let sum = 0;
  let amplitude = 0.56;
  let frequency = 1;
  let normalization = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const n = 1 - Math.abs(valueNoise2(x * frequency, z * frequency, seed + octave * 229) * 2 - 1);
    sum += n * n * amplitude;
    normalization += amplitude;
    frequency *= 2.07;
    amplitude *= 0.48;
  }
  return sum / Math.max(normalization, 1e-9);
}

function worley2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  let first = 1e9;
  let second = 1e9;
  let cellX = ix;
  let cellZ = iz;
  for (let oz = -1; oz <= 1; oz += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const cx = ix + ox;
      const cz = iz + oz;
      const px = ox + hash2(cx, cz, seed);
      const pz = oz + hash2(cx, cz, seed + 7919);
      const distance = Math.hypot(px - fx, pz - fz);
      if (distance < first) {
        second = first;
        first = distance;
        cellX = cx;
        cellZ = cz;
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  return { first, second, edge: second - first, cellX, cellZ };
}

function decodeI16LE(buffer) {
  const view = new DataView(buffer);
  const values = new Int16Array(buffer.byteLength / 2);
  for (let index = 0; index < values.length; index += 1) values[index] = view.getInt16(index * 2, true);
  return values;
}

function decodeF32LE(buffer) {
  const view = new DataView(buffer);
  const values = new Float32Array(buffer.byteLength / 4);
  for (let index = 0; index < values.length; index += 1) values[index] = view.getFloat32(index * 4, true);
  return values;
}

function monotoneSlope(left, right) {
  if (left === 0 || right === 0 || left * right <= 0) return 0;
  return (2 * left * right) / (left + right);
}

function monotoneCubic(p0, p1, p2, p3, t) {
  const d0 = p1 - p0;
  const d1 = p2 - p1;
  const d2 = p3 - p2;
  const m1 = monotoneSlope(d0, d1);
  const m2 = monotoneSlope(d1, d2);
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * p1 + h10 * m1 + h01 * p2 + h11 * m2;
}

function truthSample(truth, truthGrid, x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const tx = x - ix;
  const tz = z - iz;
  const rows = new Float64Array(4);
  for (let offsetZ = -1; offsetZ <= 2; offsetZ += 1) {
    const row = clamp(iz + offsetZ, 0, truthGrid - 1);
    const p0 = truth[row * truthGrid + clamp(ix - 1, 0, truthGrid - 1)];
    const p1 = truth[row * truthGrid + clamp(ix, 0, truthGrid - 1)];
    const p2 = truth[row * truthGrid + clamp(ix + 1, 0, truthGrid - 1)];
    const p3 = truth[row * truthGrid + clamp(ix + 2, 0, truthGrid - 1)];
    rows[offsetZ + 1] = monotoneCubic(p0, p1, p2, p3, tx);
  }
  return monotoneCubic(rows[0], rows[1], rows[2], rows[3], tz);
}

function buildDenseTruth(truth, truthGrid, subdivision) {
  const grid = (truthGrid - 1) * subdivision + 1;
  const dense = new Float32Array(grid * grid);
  let sourceNodeMaxError = 0;
  for (let row = 0; row < grid; row += 1) {
    const z = row / subdivision;
    for (let column = 0; column < grid; column += 1) {
      const x = column / subdivision;
      const value = truthSample(truth, truthGrid, x, z);
      const index = row * grid + column;
      dense[index] = value;
      if (row % subdivision === 0 && column % subdivision === 0) {
        const source = truth[(row / subdivision) * truthGrid + column / subdivision];
        sourceNodeMaxError = Math.max(sourceNodeMaxError, Math.abs(value - source));
      }
    }
  }
  return { dense, grid, sourceNodeMaxError };
}

function boxBlur(source, width, height, radius) {
  if (radius <= 0) return new Float32Array(source);
  const temporary = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  const span = radius * 2 + 1;
  for (let row = 0; row < height; row += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1) sum += source[row * width + clamp(x, 0, width - 1)];
    for (let column = 0; column < width; column += 1) {
      temporary[row * width + column] = sum / span;
      sum -= source[row * width + clamp(column - radius, 0, width - 1)];
      sum += source[row * width + clamp(column + radius + 1, 0, width - 1)];
    }
  }
  for (let column = 0; column < width; column += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1) sum += temporary[clamp(y, 0, height - 1) * width + column];
    for (let row = 0; row < height; row += 1) {
      output[row * width + column] = sum / span;
      sum -= temporary[clamp(row - radius, 0, height - 1) * width + column];
      sum += temporary[clamp(row + radius + 1, 0, height - 1) * width + column];
    }
  }
  return output;
}

function pointSegmentDistance(px, pz, segment) {
  const dx = segment.x1 - segment.x0;
  const dz = segment.z1 - segment.z0;
  const denominator = dx * dx + dz * dz;
  if (denominator <= 1e-9) return Math.hypot(px - segment.x0, pz - segment.z0);
  const t = clamp(((px - segment.x0) * dx + (pz - segment.z0) * dz) / denominator);
  return Math.hypot(px - (segment.x0 + dx * t), pz - (segment.z0 + dz * t));
}

function parseWater(buffer, manifest) {
  const raw = decodeF32LE(buffer);
  const layout = manifest.hydrology.layout;
  const stride = manifest.hydrology.stride;
  const index = Object.fromEntries(layout.map((name, offset) => [name, offset]));
  const segments = [];
  for (let offset = 0; offset + stride - 1 < raw.length; offset += stride) {
    segments.push({
      x0: raw[offset + index.start_x],
      y0: raw[offset + index.start_elevation],
      z0: raw[offset + index.start_z],
      x1: raw[offset + index.end_x],
      y1: raw[offset + index.end_elevation],
      z1: raw[offset + index.end_z],
      classValue: Math.round(raw[offset + index.class]),
      mainstemCode: Math.round(raw[offset + index.mainstem_code]),
      sourceWidth: raw[offset + index.source_width_m],
      startProgress: raw[offset + index.start_flow_progress],
      endProgress: raw[offset + index.end_flow_progress],
      startFlowDistance: raw[offset + index.start_flow_distance_m],
      endFlowDistance: raw[offset + index.end_flow_distance_m],
    });
  }
  return segments;
}

function nearestWaterDistance(x, z, segments) {
  let distance = 1e9;
  for (const segment of segments) distance = Math.min(distance, pointSegmentDistance(x, z, segment));
  return distance;
}

function parcelGrammar(easting, northing, seed) {
  const warpX = fbm2(easting * 0.0022, northing * 0.0022, seed + 31, 4) * 27;
  const warpZ = fbm2(easting * 0.0022 + 7.4, northing * 0.0022 - 5.1, seed + 73, 4) * 27;
  const angle = 0.29 + fbm2(easting * 0.00061, northing * 0.00061, seed + 91, 3) * 0.22;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rx = (easting + warpX) * ca + (northing + warpZ) * sa;
  const rz = -(easting + warpX) * sa + (northing + warpZ) * ca;
  const cellX = 70;
  const cellZ = 54;
  const cells = worley2(rx / cellX, rz / cellZ, seed + 149);
  const boundary = 1 - smoothstep(0.028, 0.12, cells.edge);
  const unitSeed = hash2(cells.cellX, cells.cellZ, seed + 277);
  const rowA = 1 - smoothstep(0.91, 0.997, Math.abs(Math.sin((rx + unitSeed * 117) * 0.061)));
  const rowB = 1 - smoothstep(0.925, 0.998, Math.abs(Math.sin((rz - unitSeed * 89) * 0.076)));
  const ditch = Math.max(rowA, rowB * 0.64);
  return { boundary, unitSeed, ditch };
}

function anchorEnvelope(column, row, subdivision) {
  const u = (column % subdivision) / subdivision;
  const v = (row % subdivision) / subdivision;
  const distance = Math.min(
    Math.hypot(u, v),
    Math.hypot(1 - u, v),
    Math.hypot(u, 1 - v),
    Math.hypot(1 - u, 1 - v),
  );
  return smoothstep(0, 0.31, distance);
}

function buildNormals(heights, grid, spacing) {
  const normals = new Float32Array(heights.length * 3);
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      const leftColumn = Math.max(0, column - 1);
      const rightColumn = Math.min(grid - 1, column + 1);
      const topRow = Math.max(0, row - 1);
      const bottomRow = Math.min(grid - 1, row + 1);
      const left = heights[row * grid + leftColumn];
      const right = heights[row * grid + rightColumn];
      const top = heights[topRow * grid + column];
      const bottom = heights[bottomRow * grid + column];
      const dx = Math.max(spacing, (rightColumn - leftColumn) * spacing);
      const dz = Math.max(spacing, (bottomRow - topRow) * spacing);
      let nx = -(right - left) / dx;
      let ny = 1;
      let nz = -(bottom - top) / dz;
      const length = Math.hypot(nx, ny, nz) || 1;
      const offset = (row * grid + column) * 3;
      normals[offset] = nx / length;
      normals[offset + 1] = ny / length;
      normals[offset + 2] = nz / length;
    }
  }
  return normals;
}

window.LandscapeMotherKernelCore = Object.freeze({
  TAU, clamp, mix, smoothstep, fract, hash2, valueNoise2, fbm2, ridged2, worley2,
  decodeI16LE, decodeF32LE, buildDenseTruth, boxBlur, parseWater, nearestWaterDistance,
  parcelGrammar, anchorEnvelope, buildNormals,
});
})();
