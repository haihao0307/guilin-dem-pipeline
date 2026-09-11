const SPZ_MAGIC = 0x5053474e;
const V4_HEADER_BYTES = 32;
const SH_DEGREE_TO_VECTORS = [0, 3, 8, 15];

function roundHalfAwayFromZero(value) {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

export function validateGaussianSourceForSpzV4(source, options = {}) {
  const errors = [];
  const fractionalBits = options.fractionalBits ?? 12;
  const quaternionTolerance = options.quaternionTolerance ?? 1e-4;
  if (!source || typeof source !== 'object') return ['source-not-object'];
  const count = source.numPoints;
  const degree = source.shDegree;
  if (!Number.isInteger(count) || count < 0) errors.push('num-points-must-be-nonnegative-integer');
  if (!Number.isInteger(degree) || degree < 0 || degree > 3) errors.push('sh-degree-must-be-integer-zero-to-three');
  if (!Number.isInteger(fractionalBits) || fractionalBits < 0 || fractionalBits > 22) {
    errors.push('fractional-bits-out-of-candidate-range');
  }

  const fields = [
    ['positions', count * 3],
    ['scales', count * 3],
    ['rotations', count * 4],
  ];
  for (const [name, expected] of fields) {
    if (!Array.isArray(source[name]) || source[name].length !== expected) errors.push(`${name}-length-mismatch`);
    else if (source[name].some(value => typeof value !== 'number' || !Number.isFinite(value))) errors.push(`${name}-nonfinite`);
  }
  if (errors.some(error => error.includes('length-mismatch') || error.includes('nonfinite'))) return errors;

  const fixedScale = 2 ** fractionalBits;
  for (let i = 0; i < source.positions.length; i++) {
    const fixed = roundHalfAwayFromZero(source.positions[i] * fixedScale);
    if (fixed < -0x800000 || fixed > 0x7fffff) errors.push(`position-${i}-outside-signed-int24`);
  }
  for (let i = 0; i < source.scales.length; i++) {
    const encoded = roundHalfAwayFromZero((source.scales[i] + 10) * 16);
    if (encoded < 0 || encoded > 255) errors.push(`scale-${i}-would-saturate`);
  }
  for (let i = 0; i < count; i++) {
    const q = source.rotations.slice(i * 4, i * 4 + 4);
    const norm = Math.hypot(...q);
    if (norm === 0 || Math.abs(norm - 1) > quaternionTolerance) errors.push(`rotation-${i}-not-normalized`);
  }
  return errors;
}

export function validateGaussianSpzDeclaration(declaration, header) {
  const errors = [];
  if (!declaration || typeof declaration !== 'object') return ['declaration-not-object'];
  if (declaration.format !== 'SPZ') errors.push('format-not-SPZ');
  if (declaration.version !== 4) errors.push('version-not-4');
  if (declaration.coordinateSystem !== 'RUB') errors.push('coordinate-system-not-RUB');
  if (declaration.hasExtensions !== false) errors.push('extensions-must-be-false');

  const degree = declaration.shDegree;
  if (typeof degree !== 'number' || !Number.isFinite(degree) || !Number.isInteger(degree) || degree < 0) {
    errors.push('sh-degree-must-be-finite-nonnegative-integer');
  } else if (degree > 3) {
    errors.push('sh-degree-over-three');
  }

  const unit = declaration.metersPerStoredUnit;
  if (typeof unit !== 'number' || !Number.isFinite(unit) || unit <= 0) {
    errors.push('meters-per-stored-unit-must-be-positive-finite');
  }

  if (header) {
    if (degree !== header.shDegree) errors.push('declared-header-sh-degree-mismatch');
    if (declaration.version !== header.version) errors.push('declared-header-version-mismatch');
    if (Boolean(declaration.hasExtensions) !== header.hasExtensions) errors.push('declared-header-extension-mismatch');
  }
  return errors;
}

export function validateGaussianSpzV4Envelope(bytes, declaration) {
  const errors = [];
  if (!(bytes instanceof Uint8Array)) return ['file-not-uint8array'];
  if (bytes.byteLength < V4_HEADER_BYTES) return ['file-shorter-than-v4-header'];

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const count = view.getUint32(8, true);
  const shDegree = view.getUint8(12);
  const flags = view.getUint8(14);
  const numStreams = view.getUint8(15);
  const tocByteOffset = view.getUint32(16, true);
  const hasExtensions = (flags & 0x02) !== 0;

  if (magic !== SPZ_MAGIC) errors.push('bad-magic');
  if (version !== 4) errors.push('version-not-4');
  if (shDegree > 3) errors.push('sh-degree-over-three');
  if (hasExtensions) errors.push('extensions-not-supported-by-profile');
  if (declaration) {
    errors.push(...validateGaussianSpzDeclaration(declaration, { version, shDegree, hasExtensions }));
  }

  const expectedStreams = shDegree > 0 ? 6 : 5;
  if (numStreams !== expectedStreams) errors.push('unexpected-stream-count');
  const tocEnd = tocByteOffset + numStreams * 16;
  if (tocByteOffset < V4_HEADER_BYTES || tocEnd > bytes.byteLength) {
    return [...errors, 'toc-out-of-bounds'];
  }

  const expectedUncompressed = [count * 9, count, count * 3, count * 3, count * 4];
  if (shDegree > 0 && shDegree <= 3) {
    expectedUncompressed.push(count * SH_DEGREE_TO_VECTORS[shDegree] * 3);
  }

  let compressedEnd = tocEnd;
  for (let i = 0; i < numStreams; i++) {
    const entry = tocByteOffset + i * 16;
    const compressed = Number(view.getBigUint64(entry, true));
    const uncompressed = Number(view.getBigUint64(entry + 8, true));
    if (!Number.isSafeInteger(compressed) || compressed < 0) errors.push('invalid-compressed-size');
    if (uncompressed !== expectedUncompressed[i]) errors.push(`unexpected-uncompressed-size-${i}`);
    compressedEnd += compressed;
  }
  if (compressedEnd !== bytes.byteLength) errors.push('compressed-streams-do-not-exactly-cover-file');
  return errors;
}
