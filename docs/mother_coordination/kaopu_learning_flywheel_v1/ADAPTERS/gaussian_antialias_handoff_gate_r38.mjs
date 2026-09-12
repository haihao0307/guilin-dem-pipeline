const SPZ_MAGIC = 0x5053474e;

export function parseBrushPlyRenderMode(bytes) {
  const text = bytes instanceof Uint8Array
    ? new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.byteLength, 65536)))
    : String(bytes);
  const end = text.indexOf('end_header');
  if (end < 0) return { renderMode: null, errors: ['ply-end-header-missing'] };
  const header = text.slice(0, end);
  const matches = [...header.matchAll(/^comment\s+SplatRenderMode:\s*(\S+)\s*$/gmi)];
  if (matches.length === 0) return { renderMode: null, errors: ['brush-render-mode-comment-missing'] };
  const renderMode = matches.at(-1)[1].toLowerCase();
  if (!['mip', 'default'].includes(renderMode)) {
    return { renderMode, errors: ['brush-render-mode-comment-unsupported'] };
  }
  return { renderMode, errors: [] };
}

export function readSpzV4Antialiased(bytes) {
  if (!(bytes instanceof Uint8Array)) return { antialiased: null, errors: ['spz-not-uint8array'] };
  if (bytes.byteLength < 32) return { antialiased: null, errors: ['spz-v4-header-truncated'] };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== SPZ_MAGIC) return { antialiased: null, errors: ['spz-magic-invalid'] };
  if (view.getUint32(4, true) !== 4) return { antialiased: null, errors: ['spz-version-not-four'] };
  return { antialiased: (view.getUint8(14) & 0x01) !== 0, errors: [] };
}

export function validateGaussianAntialiasHandoff({ plyBytes, spzBytes, viewer = 'three-r186-native' }) {
  const source = parseBrushPlyRenderMode(plyBytes);
  const packed = readSpzV4Antialiased(spzBytes);
  const errors = [...source.errors, ...packed.errors];
  if (source.renderMode && packed.antialiased !== null) {
    const expected = source.renderMode === 'mip';
    if (packed.antialiased !== expected) errors.push('brush-render-mode-spz-flag-mismatch');
    if (viewer === 'three-r186-native' && !packed.antialiased) {
      errors.push('three-r186-hardcodes-mip-compensation-for-default-source');
    }
  }
  if (viewer !== 'three-r186-native' && viewer !== 'declared-capability') {
    errors.push('viewer-profile-unknown');
  }
  return errors;
}

