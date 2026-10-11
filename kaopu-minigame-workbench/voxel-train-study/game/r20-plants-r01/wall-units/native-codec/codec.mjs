/**
 * Wall-only experimental SQLite.KaoPu codec. Pure data in/out, no renderer calls.
 * Real SQLite fixed envelope, with SHA256 + CRC32 over one padded score BLOB.
 * No SQL runtime, network fetch, eval, dynamic import, mesh or texture payload.
 * Integrity is not authentication. HTTPS/localhost WebCrypto is required.
 */
import {LAYOUT as generatedLayout, TEMPLATE_BASE64} from './template-data.mjs';
import {normalizeWallScore, canonicalWallScore, WALL_SCHEMA, WALL_OPERATOR} from '../wall-score.mjs';

const LAYOUT = structuredClone(generatedLayout);
export const PROFILE = LAYOUT.profile;
export const SCORE_SCHEMA = LAYOUT.static.scoreSchema;
export const OPERATOR = LAYOUT.static.operator;
export const MAX_FILE_BYTES = LAYOUT.fileBytes;
export const MAX_PAYLOAD_BYTES = LAYOUT.capacityBytes;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const BASE = Uint8Array.from(atob(TEMPLATE_BASE64), character => character.charCodeAt(0));
const mutable = new Uint8Array(BASE.length);
for (const segment of LAYOUT.segments) mutable.fill(1, segment.fileOffset, segment.fileOffset + segment.length);
mutable.fill(1, LAYOUT.digestOffset, LAYOUT.digestOffset + 64);
mutable.fill(1, LAYOUT.crcOffset, LAYOUT.crcOffset + 8);
const fail = (code, detail = '') => { throw new Error(code + (detail ? ':' + detail : '')); };
const forbidden = new Set(['url', 'uri', 'code', 'script', 'operator', 'executor', 'resources', 'dependencies',
  'mesh', 'meshes', 'vertex', 'vertices', 'positions', 'indices', 'bufferviews', 'accessors', 'pixels',
  'imagepayload', 'fieldpayload', 'normals', 'uvs', 'imagedata', 'texture', 'textures', 'texturedata',
  'vertexdata', 'meshdata', 'animationsamples', 'sampledpositions', 'keyframes', 'arraybuffer', 'binarypayload']);
const clone = value => structuredClone(value);

export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
}
const equal = (a, b) => canonicalJSON(a) === canonicalJSON(b);
function jsonData(value) {
  let nodes = 0;
  const visit = (item, depth) => {
    if (++nodes > 2048 || depth > 10) fail('DATA_COMPLEXITY_LIMIT');
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'number') { if (!Number.isFinite(item)) fail('NON_FINITE_NUMBER'); return; }
    if (typeof item === 'string') {
      if (item.length > 256) fail('STRING_TOO_LONG');
      if (/^\s*(data|javascript|blob|https?):/i.test(item)) fail('SOURCE_PAYLOAD_FORBIDDEN');
      return;
    }
    if (typeof item !== 'object') fail('NON_JSON_VALUE');
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype || item.length > 16) fail('ARRAY_SHAPE_LIMIT');
      if (Reflect.ownKeys(item).length !== item.length + 1) fail('ARRAY_EXTRA_PROPERTIES');
      for (let index = 0; index < item.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) fail('PLAIN_ARRAY_PROPERTY_REQUIRED');
        visit(descriptor.value, depth + 1);
      }
      return;
    }
    if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) fail('PLAIN_OBJECT_REQUIRED');
    const keys = Reflect.ownKeys(item);
    if (keys.length > 32) fail('TOO_MANY_OBJECT_KEYS');
    for (const key of keys) {
      if (typeof key !== 'string' || key.length > 96 || ['__proto__', 'prototype', 'constructor'].includes(key)) fail('INVALID_OBJECT_KEY');
      if (forbidden.has(key.replace(/[-_]/g, '').toLowerCase())) fail('SOURCE_PAYLOAD_FORBIDDEN', key);
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!descriptor.enumerable || !('value' in descriptor)) fail('PLAIN_JSON_PROPERTY_REQUIRED');
      visit(descriptor.value, depth + 1);
    }
  };
  visit(value, 0);
}
/** One shared domain normalizer: no duplicate codec-only wall schema. */
function normalizedSafeScore(input) {
  jsonData(input); // Reject getters, executable values and source payloads first.
  if (WALL_SCHEMA !== SCORE_SCHEMA || WALL_OPERATOR !== 'kaopu.street.wall-unit') fail('HOST_SCORE_MODULE_MISMATCH');
  const score = normalizeWallScore(input);
  jsonData(score);
  if (score.schema !== SCORE_SCHEMA || !LAYOUT.static.kinds.includes(score.kind)) fail('UNKNOWN_WALL_PROFILE');
  return score;
}

/** Requires the complete normalized data shape. The host's geometric/domain
 * validator is reused here before any restore candidate reaches a renderer.
 */
export function validateScoreData(score) {
  const normalized = normalizedSafeScore(score);
  if (!equal(score, normalized)) fail('INCOMPLETE_OR_NON_NORMALIZED_SCORE');
  return true;
}

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) fail('WEB_CRYPTO_REQUIRED_USE_SECURE_CONTEXT');
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
}
function bytesOf(input) {
  if (input instanceof ArrayBuffer) {
    if (input.byteLength !== MAX_FILE_BYTES) fail('FILE_SIZE_MISMATCH');
    return new Uint8Array(input.slice(0));
  }
  if (input instanceof Uint8Array && input.buffer instanceof ArrayBuffer) {
    if (input.byteLength !== MAX_FILE_BYTES) fail('FILE_SIZE_MISMATCH');
    return Uint8Array.from(input);
  }
  fail('UINT8ARRAY_OR_ARRAYBUFFER_REQUIRED');
}

/** Returns true SQLite bytes. Every input is serialized before the first await. */
export async function encode(input) {
  const score = normalizedSafeScore(input);
  const json = encoder.encode(canonicalWallScore(score));
  if (json.byteLength > MAX_PAYLOAD_BYTES) fail('PAYLOAD_TOO_LARGE');
  const payload = new Uint8Array(MAX_PAYLOAD_BYTES).fill(32);
  payload.set(json);
  const hash = await sha256(payload), checksum = crc32(payload), result = BASE.slice();
  for (const segment of LAYOUT.segments) result.set(payload.subarray(segment.logicalOffset, segment.logicalOffset + segment.length), segment.fileOffset);
  result.set(encoder.encode(hash), LAYOUT.digestOffset);
  result.set(encoder.encode(checksum), LAYOUT.crcOffset);
  return result;
}

/** Rejects altered SQLite graph/layout before examining the inert score payload. */
export async function decode(input) {
  const raw = bytesOf(input);
  for (let index = 0; index < 16; index++) if (raw[index] !== BASE[index]) fail('BAD_SQLITE_SIGNATURE');
  for (let index = 0; index < raw.length; index++) if (!mutable[index] && raw[index] !== BASE[index]) fail('IMMUTABLE_CONTAINER_MISMATCH', String(index));
  const payload = new Uint8Array(MAX_PAYLOAD_BYTES);
  for (const segment of LAYOUT.segments) payload.set(raw.subarray(segment.fileOffset, segment.fileOffset + segment.length), segment.logicalOffset);
  let expectedHash, expectedCRC;
  try {
    expectedHash = decoder.decode(raw.subarray(LAYOUT.digestOffset, LAYOUT.digestOffset + 64));
    expectedCRC = decoder.decode(raw.subarray(LAYOUT.crcOffset, LAYOUT.crcOffset + 8));
  } catch { fail('ASSET_CHECKSUM_FORMAT'); }
  if (!/^[0-9a-f]{64}$/.test(expectedHash) || !/^[0-9a-f]{8}$/.test(expectedCRC)) fail('ASSET_CHECKSUM_FORMAT');
  if (crc32(payload) !== expectedCRC) fail('ASSET_CRC32_MISMATCH');
  if (await sha256(payload) !== expectedHash) fail('ASSET_HASH_MISMATCH');
  let score;
  try { score = JSON.parse(decoder.decode(payload)); } catch { fail('INVALID_JSON_PAYLOAD'); }
  validateScoreData(score);
  const canonical = encoder.encode(canonicalWallScore(score));
  for (let index = 0; index < payload.length; index++) if (payload[index] !== (index < canonical.length ? canonical[index] : 32)) fail('NON_CANONICAL_PAYLOAD');
  return score;
}

/** Reject File/Blob size before allocation. Filename and MIME confer no trust. */
export async function decodeFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || file.size !== MAX_FILE_BYTES) fail('FILE_SIZE_MISMATCH');
  return decode(await file.arrayBuffer());
}
export function pinnedDependencies() { return clone(LAYOUT.static.dependencies); }

/** Verify already-loaded trusted host module bytes. Never fetch a file-supplied URL.
 * An unbound development template cannot claim verified dependency restoration.
 */
export async function verifyDependencyBytes(available) {
  const pins = LAYOUT.static.dependencies;
  if (LAYOUT.static.dependencyStatus !== 'pinned' || pins.length === 0) fail('RELEASE_DEPENDENCIES_UNBOUND');
  if (!available || typeof available !== 'object' || Array.isArray(available)) fail('BYTE_MAP_REQUIRED');
  const snapshots = pins.map(pin => {
    const descriptor = Object.getOwnPropertyDescriptor(available, pin.id);
    if (!descriptor || !('value' in descriptor)) fail('MISSING_RULE_BYTES', pin.id);
    const bytes = descriptor.value;
    if (!(bytes instanceof Uint8Array) && !(bytes instanceof ArrayBuffer)) fail('MISSING_RULE_BYTES', pin.id);
    if (bytes.byteLength !== pin.bytes) fail('LOADED_RULE_SIZE_MISMATCH', pin.id);
    if (bytes instanceof Uint8Array && !(bytes.buffer instanceof ArrayBuffer)) fail('UNSHARED_BYTES_REQUIRED', pin.id);
    return bytes instanceof ArrayBuffer ? new Uint8Array(bytes.slice(0)) : Uint8Array.from(bytes);
  });
  for (let index = 0; index < pins.length; index++) if (await sha256(snapshots[index]) !== pins[index].sha256) fail('LOADED_RULE_HASH_MISMATCH', pins[index].id);
  return true;
}
export const formatInfo = Object.freeze({
  profile: PROFILE, profileVersion: 1, scoreSchema: SCORE_SCHEMA, operator: OPERATOR,
  container: 'SQLite.KaoPu independent experimental wall envelope', applicationId: LAYOUT.applicationId,
  userVersion: LAYOUT.userVersion, fileBytes: MAX_FILE_BYTES, payloadCapacityBytes: MAX_PAYLOAD_BYTES,
  dependencyStatus: LAYOUT.static.dependencyStatus, graphSha256: LAYOUT.graphSha256,
  requiredHostMaterialRevision: LAYOUT.static.hostRequirements.materialSourceRevision,
  restoreMode: 'trusted-host-regenerate-from-score', sharedHostDomainValidation: true,
  crc32: true, sha256: true, authentication: false,
  embeddedGeometry: false, embeddedTextures: false, embeddedExecutableCode: false,
  plantProfileSupported: false, generalKAOPUSupport: false,
});
