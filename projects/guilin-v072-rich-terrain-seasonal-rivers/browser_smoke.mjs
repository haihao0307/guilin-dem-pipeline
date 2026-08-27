import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);

const ROOT_URL = (process.env.XIAOGUI_BASE_URL || 'http://127.0.0.1:8000/').replace(/\/?$/, '/');
const EVIDENCE_DIR = path.resolve(process.env.EVIDENCE_DIR || process.env.XIAOGUI_EVIDENCE_DIR || 'dist/evidence');
const SCREENSHOT_DIR = path.join(EVIDENCE_DIR, 'screenshots');
const BROWSER_MODE_RAW = process.env.BROWSER_MODE || 'local';
const BROWSER_MODE = BROWSER_MODE_RAW === 'public' ? 'public-live-vendor' : BROWSER_MODE_RAW;
const IS_PUBLIC = BROWSER_MODE === 'public-live-vendor';
const HOST_DEADLINE_MS = Number(process.env.HOST_DEADLINE_MS || (IS_PUBLIC ? 60 * 60_000 : 75 * 60_000));
const DESKTOP = { width: 1720, height: 1080 };
const MOBILE = { width: 390, height: 844 };
const MAX_ASSET_BYTES = 100 * 1024 * 1024;
const WATER_TIME = 137.25;
const REQUIRED_SCREENSHOT_COUNT = 80;
const NODATA_POLICY = 'source GDAL mask; conservative overview samples and cells remain transparent on any NoData contribution; no smoothing; no gap fill';
const RIVER_GLOBAL_CHECK_KEYS = Object.freeze([
  'all_assets_under_100_mib',
  'all_banks_resampled_at_final_xz',
  'all_seasons_final_float32_grounding_passed',
  'all_seasons_final_topology_passed',
  'centerline_coordinates_unchanged',
  'exact_indexed_asset_count',
  'four_visual_season_presets_exact',
  'hole_preservation_regression_passed',
  'round_arc_construction_regression_passed',
]);
const RIVER_GROUNDING_CHECK_KEYS = Object.freeze([
  'reviewed_osm_original_vertex_preserved',
  'representative_system_is_li_or_xiang',
  'representative_source_name_present',
  'non_endpoint_original_vertex',
  'summer_final_width_used',
  'center_and_banks_native_3x3_valid',
  'left_and_right_final_xz_distinct',
  'bank_offsets_match_final_half_width',
  'left_and_right_terrain_y_independently_sampled',
  'bank_delta_visually_readable',
  'cross_slope_in_representative_visual_range',
  'deterministic_width_first_stable_candidate_selected',
]);
const RIVER_GROUNDING_CORE_FIELDS = Object.freeze([
  'original_centerline_lonlat', 'centerline_coordinate_mutated',
  'center_epsg32649', 'left_bank_epsg32649', 'right_bank_epsg32649',
  'center_xz_m', 'left_bank_xz_m', 'right_bank_xz_m',
  'center_terrain_height_m', 'left_bank_terrain_height_m', 'right_bank_terrain_height_m',
  'left_minus_right_terrain_y_m', 'bank_delta_y_m', 'cross_slope', 'cross_slope_degrees',
  'season', 'width', 'base_width_m', 'final_width_m',
  'system', 'name', 'non_endpoint', 'source_feature_index', 'source_vertex_index',
  'candidate_constraints', 'checks', 'passed',
]);
const EXPECTED_OVERVIEW_HEIGHT = Object.freeze({
  actual_vertex_spacing_m: 212.5,
  actual_vertex_spacing_xy_m: [212.5, 212.46621621621622],
  sample_center_bounds_epsg32649: [349968.75, 2703118.733108108, 567356.25, 2938743.766891892],
  bounds_world_xz: [-108693.75, -117812.51689189207, 108693.75, 117812.51689189207],
});
const SEASONS = Object.freeze({
  winter: { width: 0.66, depth: 0.32, color: '#42b69d', label: '冬季枯水' },
  spring: { width: 0.92, depth: 0.55, color: '#45c4b5', label: '春季平水' },
  summer: { width: 1.38, depth: 0.88, color: '#348e73', label: '夏季豐水' },
  autumn: { width: 0.82, depth: 0.46, color: '#3fa9aa', label: '秋季回落' },
});
const TARGETS = Object.freeze([
  'overview', 'guilin', 'yangtang', 'yangshuo', 'peaks', 'cliff', 'gully',
  'river-grounding', 'river-turn', 'zhenbaoding', 'nodata',
]);
const NATIVE_ACCEPTANCE_TARGETS = Object.freeze([
  'guilin', 'yangtang', 'yangshuo', 'peaks', 'cliff', 'gully',
  'river-grounding', 'river-turn', 'zhenbaoding', 'nodata',
]);
const LOD_CASES = Object.freeze([
  { distance_m: 6990, expected_max_resolution_m: 12.5, native: true },
  { distance_m: 7010, expected_max_resolution_m: 25, native: false },
  { distance_m: 13990, expected_max_resolution_m: 25, native: false },
  { distance_m: 14010, expected_max_resolution_m: 50, native: false },
  { distance_m: 27990, expected_max_resolution_m: 50, native: false },
  { distance_m: 28010, expected_max_resolution_m: 100, native: false },
  { distance_m: 55990, expected_max_resolution_m: 100, native: false },
  { distance_m: 56010, expected_max_resolution_m: 200, native: false },
  { distance_m: 111990, expected_max_resolution_m: 200, native: false },
  { distance_m: 112010, expected_max_resolution_m: EXPECTED_OVERVIEW_HEIGHT.actual_vertex_spacing_m, native: false, backdrop_only: true },
]);
const VENDOR_FILES = Object.freeze(['vendor/three.module.js', 'vendor/OrbitControls.js', 'vendor/proj4.js']);
const REQUIRED_HOOKS = Object.freeze([
  'setWaterTime', 'renderNow', 'setHydrologyVisible', 'setTerrainVisible',
  'setCameraPose', 'setLodTestDistance', 'setRiverMaskMode',
  'sampleNativeTerrainNeighborhood', 'getContracts', 'probeDomainEdgeCoverage',
  'probeLodSeamTopology', 'probeNoDataRoi', 'runCollisionProbe',
]);

let assertionCount = 0;
function check(condition, message, details = undefined) {
  assertionCount += 1;
  if (!condition) {
    const suffix = details === undefined ? '' : ` :: ${JSON.stringify(details)}`;
    throw new Error(`${message}${suffix}`);
  }
}
function finite(value, message) { check(Number.isFinite(value), message, value); return value; }
function positive(value, message) { check(Number.isFinite(value) && value > 0, message, value); return value; }
function integer(value, message) { check(Number.isInteger(value) && value >= 0, message, value); return value; }
function close(actual, expected, tolerance, message) {
  check(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, message, { actual, expected, tolerance });
}
function isHexSha(value) { return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value); }
function allTrue(record, label) {
  check(record && typeof record === 'object' && !Array.isArray(record), `${label} must be an object`);
  const entries = Object.entries(record);
  check(entries.length > 0, `${label} cannot be vacuous`);
  for (const [key, value] of entries) check(value === true, `${label}.${key} must be true`, value);
}
function deepEqual(actual, expected, message) {
  check(JSON.stringify(actual) === JSON.stringify(expected), message);
}
function vectorDistance(a, b) {
  check(Array.isArray(a) && Array.isArray(b) && a.length === b.length, 'vector comparison shape mismatch');
  return Math.sqrt(a.reduce((sum, value, index) => sum + ((value - b[index]) ** 2), 0));
}
function canonicalColor(value) {
  if (typeof value !== 'string') return value;
  const compact = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(compact)) return compact;
  const match = compact.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  return match ? `#${match.slice(1).map(v => Number(v).toString(16).padStart(2, '0')).join('')}` : compact;
}
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function sanitizeName(value) { return String(value).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, ''); }
function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

const diagnostics = {
  schema: 'guilin-v072-browser-smoke-diagnostics/v3',
  started_at: new Date().toISOString(), root_url: ROOT_URL, browser_mode: BROWSER_MODE,
  host_deadline_ms: HOST_DEADLINE_MS, viewport: { desktop: DESKTOP, mobile: MOBILE },
  passed: false, assertion_count: 0, phase: 'initializing', fatal_error: null, signal: null,
};
const consoleEvidence = { messages: [], errors: [], page_errors: [] };
const networkEvidence = { navigations: [], responses_ge_400: [], http_404: [], request_failed: [], executable_resources: [], vendor_resources: [], displayed_river_asset_responses: [] };
const runtimeEvidence = { initial: null, seasons: {}, mobile_season: null, final: null };
const cameraEvidence = { trusted_targets: {}, trusted_gestures: {}, canonical_poses: {}, collision_recovery: null };
const terrainEvidence = { manifest: null, lod_manifest: null, lod_qa: null, decoded_tile_receipts: [], native_neighborhoods: {}, nodata_roi: null, domain_edge_evidence: null, river_grounding_cross_slope: null };
const lodEvidence = { threshold_matrix: [], runtime_seam_probes: [], wireframe_diagnostic: null };
const fpsEvidence = { samples: [], result: null };
const karstEvidence = { viewpoints: {} };
const riverVisualEvidence = { cases: [], fixed_water_time: WATER_TIME, grounding_cross_slope_closeup: null };
const screenshotInventory = [];
const publishedAssets = { json: {}, binary: [], vendor: [] };
const pages = new Set();
const contexts = new Set();
let browser = null;
let chromium = null;
let desktopPage = null;
let mobilePage = null;
let fatalError = null;
let shuttingDown = false;
let evidencePersisted = false;

function observePage(page, label) {
  pages.add(page);
  page.on('console', message => {
    const item = { page: label, type: message.type(), text: message.text(), location: message.location(), time: new Date().toISOString() };
    consoleEvidence.messages.push(item);
    if (message.type() === 'error') consoleEvidence.errors.push(item);
  });
  page.on('pageerror', error => consoleEvidence.page_errors.push({ page: label, message: error.message, stack: error.stack || null }));
  page.on('requestfailed', request => networkEvidence.request_failed.push({
    page: label, url: request.url(), method: request.method(), resource_type: request.resourceType(), failure: request.failure(),
  }));
  page.on('response', response => {
    const request = response.request();
    const item = { page: label, url: response.url(), status: response.status(), resource_type: request.resourceType(), from_service_worker: response.fromServiceWorker() };
    if (response.status() >= 400) networkEvidence.responses_ge_400.push(item);
    if (response.status() === 404) networkEvidence.http_404.push(item);
    if (['script', 'stylesheet', 'wasm'].includes(request.resourceType())) networkEvidence.executable_resources.push(item);
    if (VENDOR_FILES.some(file => new URL(response.url()).pathname.endsWith(`/${file}`))) networkEvidence.vendor_resources.push(item);
    if (/\/data\/river_drape_(winter|spring|summer|autumn)_(positions\.f32|indices\.u32)\.gz$/.test(new URL(response.url()).pathname)) networkEvidence.displayed_river_asset_responses.push(item);
  });
}

async function mkdirs() {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
}
async function writeJson(name, value) {
  await fs.writeFile(path.join(EVIDENCE_DIR, name), `${JSON.stringify(value, null, 2)}\n`);
}
function pngDimensions(buffer) {
  check(buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG', 'screenshot is not PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
async function capture(page, name, { canvas = false, fullPage = false } = {}) {
  const filename = `${sanitizeName(name)}.png`;
  const destination = path.join(SCREENSHOT_DIR, filename);
  const buffer = canvas
    ? await page.locator('#viewer canvas').screenshot({ path: destination, timeout: 120_000 })
    : await page.screenshot({ path: destination, fullPage, timeout: 120_000 });
  const dimensions = pngDimensions(buffer);
  const item = { name, file: `screenshots/${filename}`, bytes: buffer.length, sha256: sha256(buffer), ...dimensions, canvas, full_page: fullPage };
  check(!screenshotInventory.some(entry => entry.file === item.file), `duplicate screenshot inventory file ${item.file}`);
  screenshotInventory.push(item);
  return { item, buffer };
}

async function decodePng(buffer) {
  check(buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'invalid PNG signature');
  let cursor = 8;
  let width; let height; let bitDepth; let colorType; let interlace;
  const chunks = [];
  while (cursor + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(cursor);
    const type = buffer.toString('ascii', cursor + 4, cursor + 8);
    const data = buffer.subarray(cursor + 8, cursor + 8 + length);
    cursor += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') break;
  }
  check(bitDepth === 8 && interlace === 0 && [2, 6].includes(colorType), 'unsupported PNG encoding', { bitDepth, colorType, interlace });
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = await inflate(Buffer.concat(chunks));
  check(raw.length === height * (stride + 1), 'unexpected PNG inflated length', { actual: raw.length, expected: height * (stride + 1) });
  const scan = Buffer.alloc(height * stride);
  function paeth(a, b, c) {
    const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
  }
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const source = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const targetOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? scan[targetOffset + x - channels] : 0;
      const above = y > 0 ? scan[targetOffset - stride + x] : 0;
      const upperLeft = y > 0 && x >= channels ? scan[targetOffset - stride + x - channels] : 0;
      let value = source[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += above;
      else if (filter === 3) value += Math.floor((left + above) / 2);
      else if (filter === 4) value += paeth(left, above, upperLeft);
      else check(filter === 0, 'unknown PNG filter', filter);
      scan[targetOffset + x] = value & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0, out = 0; index < scan.length; index += channels, out += 4) {
    rgba[out] = scan[index]; rgba[out + 1] = scan[index + 1]; rgba[out + 2] = scan[index + 2]; rgba[out + 3] = channels === 4 ? scan[index + 3] : 255;
  }
  return { width, height, rgba };
}

async function pixelDiff(leftBuffer, rightBuffer, roi = null) {
  const [left, right] = await Promise.all([decodePng(leftBuffer), decodePng(rightBuffer)]);
  check(left.width === right.width && left.height === right.height, 'pixel comparison dimensions differ');
  const box = roi || { x: 0, y: 0, width: left.width, height: left.height };
  const x0 = Math.max(0, Math.floor(box.x)); const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(left.width, Math.ceil(box.x + box.width)); const y1 = Math.min(left.height, Math.ceil(box.y + box.height));
  check(x1 > x0 && y1 > y0, 'pixel comparison ROI is empty', box);
  const values = []; let pixelsGte8 = 0; let pixelsGte16 = 0; let maximum = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * left.width + x) * 4;
      const delta = Math.max(Math.abs(left.rgba[i] - right.rgba[i]), Math.abs(left.rgba[i + 1] - right.rgba[i + 1]), Math.abs(left.rgba[i + 2] - right.rgba[i + 2]));
      values.push(delta); maximum = Math.max(maximum, delta);
      if (delta >= 8) pixelsGte8 += 1;
      if (delta >= 16) pixelsGte16 += 1;
    }
  }
  values.sort((a, b) => a - b);
  return {
    roi: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, sample_count: values.length,
    pixels_gte_8: pixelsGte8, pixels_gte_16: pixelsGte16,
    fraction_gte_8: pixelsGte8 / values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    p95: percentile(values, 0.95), maximum,
  };
}
function requireMaterialPixelDifference(diff, label) {
  check(diff.pixels_gte_8 >= 500, `${label}: at least 500 pixels must differ by 8`, diff);
  check(diff.pixels_gte_16 >= 100, `${label}: at least 100 pixels must differ by 16`, diff);
  check(diff.mean >= 2 && diff.p95 >= 8 && diff.maximum >= 16, `${label}: material pixel statistics too weak`, diff);
}

function validateUnion(union, label) {
  check(union?.valid === true, `${label}.valid`);
  positive(union.area_m2, `${label}.area_m2`);
  positive(union.component_count, `${label}.component_count`);
  integer(union.interior_ring_count, `${label}.interior_ring_count`);
}

function validateSerializedRiverSeason(finalQa, season, preset) {
  const p = `${season}.serialized_global_display_mesh`;
  check(finalQa?.schema === 'guilin-v072-serialized-river-display-qa/v2', `${p}.schema`, finalQa?.schema);
  check(finalQa.season === season && finalQa.passed === true, `${p} identity/pass`);
  allTrue(finalQa.checks, `${p}.checks`);
  check(finalQa.season_semantics === 'visual seasonal preset; not a discharge simulation', `${p}.season_semantics`);
  close(finalQa.visual_depth, preset.depth, 1e-12, `${p}.visual_depth`);
  close(finalQa.visual_depth_geometry_displacement_m, 0, 0, `${p}.visual depth cannot move geometry`);
  integer(finalQa.depth_conflict_count, `${p}.depth_conflict_count`);
  check(finalQa.depth_conflict_count === 0, `${p}.depth_conflict_count must be zero`);

  const grounding = finalQa.decoded_float32_grounding;
  check(grounding?.passed === true, `${p}.decoded_float32_grounding.passed`);
  allTrue(grounding.checks, `${p}.decoded_float32_grounding.checks`);
  for (const prefix of ['indexed_vertex', 'face_probe']) {
    positive(grounding[`${prefix}_sample_count`] ?? grounding[`${prefix}_clearance_count`], `${p}.${prefix}_sample_count`);
    check(grounding[`${prefix}_p95_absolute_error_m`] <= 0.001, `${p}.${prefix} P95 >1mm`, grounding[`${prefix}_p95_absolute_error_m`]);
    check(grounding[`${prefix}_maximum_absolute_error_m`] <= 0.01, `${p}.${prefix} max >10mm`, grounding[`${prefix}_maximum_absolute_error_m`]);
    check(grounding[`${prefix}_clearance_maximum_m`] <= 2, `${p}.${prefix} clearance >2m`, grounding[`${prefix}_clearance_maximum_m`]);
    check(grounding[`${prefix}_clearance_penetration_minimum_m`] >= 0, `${p}.${prefix} penetrates terrain`, grounding[`${prefix}_clearance_penetration_minimum_m`]);
    check(grounding[`${prefix}_penetration_count`] === 0, `${p}.${prefix} penetration count`);
  }

  check(finalQa.coverage_is_valid_exact === true, `${p}.coverage_is_valid_exact`);
  check(finalQa.coverage_invalid_edge_count === 0 && finalQa.coverage_invalid_edge_length_m <= 1e-6, `${p}.coverage invalid edges`);
  positive(finalQa.decoded_run_count, `${p}.decoded_run_count`);
  check(Array.isArray(finalQa.decoded_run_triangle_topology) && finalQa.decoded_run_triangle_topology.length === finalQa.decoded_run_count, `${p}.decoded run records exact`);
  for (const [index, run] of finalQa.decoded_run_triangle_topology.entries()) {
    const rp = `${p}.decoded_run_triangle_topology[${index}]`;
    check(run.passed === true, `${rp}.passed`); allTrue(run.checks, `${rp}.checks`);
    positive(run.decoded_triangle_count, `${rp}.decoded_triangle_count`);
    check(run.decoded_triangle_coverage_is_valid_exact === true, `${rp}.coverage exact`);
    check(run.decoded_triangle_coverage_invalid_edge_count === 0 && run.decoded_triangle_coverage_invalid_edge_length_m <= 1e-6, `${rp}.invalid edges`);
    check(run.decoded_non_adjacent_edge_crossing_count === 0, `${rp}.non-adjacent crossing`);
    check(run.decoded_nonmanifold_geometric_edge_count === 0, `${rp}.nonmanifold edge`);
    check(run.decoded_triangle_positive_self_overlap_area_m2 <= run.decoded_triangle_positive_self_overlap_tolerance_m2, `${rp}.positive self-overlap`);
    check(run.measurement_scope.includes('final Float32'), `${rp}.measurement scope`);
  }
  check(finalQa.decoded_run_non_adjacent_edge_crossing_count === 0, `${p}.aggregate crossing`);
  check(finalQa.decoded_run_triangle_coverage_invalid_edge_count === 0, `${p}.aggregate invalid edge`);
  check(finalQa.decoded_run_triangle_positive_self_overlap_area_m2 <= finalQa.decoded_run_triangle_topology.reduce((sum, run) => sum + run.decoded_triangle_positive_self_overlap_tolerance_m2, 0) + 1e-12, `${p}.aggregate self-overlap`);

  for (const key of ['cross_run_serialized', 'cross_run_terrain_expected']) {
    const cross = finalQa[key]; const cp = `${p}.${key}`;
    check(cross?.coverage_is_valid_exact === true, `${cp}.coverage exact`);
    check(cross.coverage_invalid_edge_count === 0 && cross.coverage_invalid_edge_length_m <= 1e-6, `${cp}.invalid edges`);
    check(cross.invalid_geometry_count === 0, `${cp}.invalid geometry`);
    check(cross.positive_overlap_pair_count === 0 && cross.positive_overlap_area_m2 <= 1e-8, `${cp}.positive overlap`);
    positive(cross.shared_edge_sample_count, `${cp}.shared_edge_sample_count`);
  }
  const welded = finalQa.global_welded_boundary_topology;
  positive(welded.cross_run_shared_edge_count, `${p}.cross_run_shared_edge_count`);
  positive(welded.cross_run_shared_edge_length_m, `${p}.cross_run_shared_edge_length_m`);
  positive(welded.cross_run_y_jump_count, `${p}.cross_run_y_jump_count`);
  check(welded.cross_run_y_jump_maximum_m <= 0.01, `${p}.cross_run_y_jump_maximum_m`);
  for (const key of ['global_boundary_nonmanifold_edge_count', 'global_boundary_t_junction_count', 'boundary_segmentation_mismatch_pair_count', 'duplicate_boundary_edge_within_run_count']) {
    check(welded[key] === 0, `${p}.global_welded_boundary_topology.${key}`, welded[key]);
  }
  check(welded.unmatched_internal_boundary_length_m <= 0.03, `${p}.unmatched internal boundary >3cm`);
  check(finalQa.shared_endpoint_uncovered_count === 0, `${p}.uncovered endpoints`);
  integer(finalQa.shared_endpoint_count, `${p}.shared_endpoint_count`);
  check(finalQa.shared_endpoint_distance_maximum_m <= 0.03, `${p}.final endpoint gap >3cm`);

  check(finalQa.terrain_expected_to_serialized_boundary_hausdorff_m <= 0.03, `${p}.expected/serialized Hausdorff`);
  check(finalQa.terrain_expected_boundary_outside_serialized_3cm_buffer_length_m <= 1e-6, `${p}.expected boundary outside buffer`);
  check(finalQa.serialized_boundary_outside_terrain_expected_3cm_buffer_length_m <= 1e-6, `${p}.serialized boundary outside buffer`);
  check(finalQa.terrain_expected_to_serialized_union_area_absolute_error_m2 <= finalQa.float32_area_tolerance_m2, `${p}.union area error`);
  check(finalQa.terrain_expected_to_serialized_symmetric_difference_area_m2 <= finalQa.float32_area_tolerance_m2, `${p}.symdiff`);
  check(finalQa.terrain_expected_uncovered_area_m2 <= finalQa.float32_area_tolerance_m2, `${p}.uncovered area`);
  check(finalQa.serialized_outside_terrain_expected_area_m2 <= finalQa.float32_area_tolerance_m2, `${p}.outside expected`);
  check(finalQa.serialized_over_nodata_area_m2 <= finalQa.nodata_float32_area_tolerance_m2, `${p}.NoData overdraw`);
  check(finalQa.serialized_over_extent_clipped_area_m2 <= finalQa.extent_float32_area_tolerance_m2, `${p}.extent overdraw`);
  for (const key of ['terrain_expected_to_serialized_lost_component_count', 'terrain_expected_to_serialized_new_component_count', 'terrain_expected_to_serialized_lost_significant_interior_ring_count', 'terrain_expected_to_serialized_new_significant_interior_ring_count', 'serialized_boundary_self_intersection_count']) check(finalQa[key] === 0, `${p}.${key}`);
  check(finalQa.terrain_clipped_expected_significant_interior_rings.count === finalQa.serialized_significant_interior_rings.count, `${p}.significant rings changed`);
  validateUnion(finalQa.terrain_clipped_expected_union, `${p}.terrain_clipped_expected_union`);
  validateUnion(finalQa.serialized_visible_union, `${p}.serialized_visible_union`);

  check(finalQa.preclip_owned_to_accounted_after_terrain_clipping_boundary_hausdorff_m <= 0.03, `${p}.preclip/accounted Hausdorff`);
  check(finalQa.preclip_owned_boundary_outside_accounted_3cm_buffer_length_m <= 1e-6, `${p}.preclip boundary outside accounted buffer`);
  check(finalQa.accounted_boundary_outside_preclip_owned_3cm_buffer_length_m <= 1e-6, `${p}.accounted boundary outside preclip buffer`);
  check(finalQa.preclip_owned_to_accounted_after_terrain_clipping_symmetric_difference_area_m2 <= finalQa.numerical_area_tolerance_m2, `${p}.preclip/accounted symdiff`);
  validateUnion(finalQa.preclip_owned_union, `${p}.preclip_owned_union`);
  validateUnion(finalQa.preclip_accounted_after_terrain_clipping_union, `${p}.preclip_accounted_after_terrain_clipping_union`);
  check(finalQa.preclip_owned_union.component_count === finalQa.preclip_accounted_after_terrain_clipping_union.component_count, `${p}.preclip components changed`);
  check(finalQa.preclip_owned_significant_interior_rings.count === finalQa.preclip_accounted_after_terrain_clipping_significant_interior_rings.count, `${p}.preclip rings changed`);

  const dp = finalQa.display_precision; const dpp = `${p}.display_precision`;
  check(dp?.passed === true, `${dpp}.passed`); allTrue(dp.checks, `${dpp}.checks`);
  close(dp.grid_m, 0.015625, 0, `${dpp}.grid_m`);
  check(dp.boundary_tolerance_m <= 0.03 && dp.raw_desired_to_display_boundary_hausdorff_m <= 0.03, `${dpp}.boundary limits`);
  check(dp.raw_desired_boundary_outside_display_3cm_buffer_length_m <= 1e-6 && dp.display_boundary_outside_raw_desired_3cm_buffer_length_m <= 1e-6, `${dpp}.continuous buffers`);
  check(dp.symmetric_difference_area_m2 <= dp.area_tolerance_m2, `${dpp}.symmetric difference tolerance`);
  check(dp.desired_component_count_preserved === true && dp.significant_interior_rings_preserved === true, `${dpp}.component/ring preservation`);
  validateUnion(dp.raw_desired_union, `${dpp}.raw_desired_union`);
  validateUnion(dp.raw_owned_union, `${dpp}.raw_owned_union`);
  validateUnion(dp.display_owned_union, `${dpp}.display_owned_union`);
  const partition = dp.display_ranked_partition;
  check(partition.planar_atomic_face_assignment_complete === true, `${dpp}.partition complete`);
  check(partition.invalid_or_self_intersecting_partition_count === 0, `${dpp}.invalid partition`);
  check(partition.uncovered_shared_endpoint_count === 0, `${dpp}.uncovered endpoints`);
  check(partition.desired_union_interior_ring_count === partition.owned_union_interior_ring_count, `${dpp}.desired/owned rings`);
  check(partition.maximum_join_gap_m <= 1e-6, `${dpp}.preclip maximum join gap`);
  check(partition.new_global_interior_ring_count === 0, `${dpp}.new global rings`);
  for (const key of ['desired_unowned_area_m2', 'residual_positive_overlap_area_m2', 'owned_positive_overlap_area_m2', 'owned_outside_desired_area_m2', 'junction_uncovered_area_m2']) check(partition[key] <= partition.numerical_area_tolerance_m2, `${dpp}.${key}`);
}

function validateRiverAssets(runtime, qa) {
  check(runtime?.schema === 'guilin-v072-river-drape-runtime/v3', 'river runtime schema v3', runtime?.schema);
  check(qa?.schema === 'guilin-v072-river-drape-qa/v3', 'river QA schema v3', qa?.schema);
  deepEqual(Object.keys(runtime).sort(), [
    'center_epsg32649', 'centerline_collection_sha256', 'centerline_file', 'centerline_geometry_mutated',
    'crs', 'indexed_assets', 'nodata_policy', 'qa_file', 'schema', 'season_semantics', 'seasons',
    'source_elevation_modified_m', 'source_resolution_m', 'surface_offset_m', 'vertical_scale',
  ].sort(), 'river runtime v3 exact frozen keys');
  check(qa.passed === true && qa.all_seasons_grounding_passed === true && qa.all_seasons_topology_passed === true, 'river top-level pass flags');
  deepEqual(Object.keys(qa.checks).sort(), [...RIVER_GLOBAL_CHECK_KEYS].sort(), 'river QA exact nine global check keys');
  allTrue(qa.checks, 'river QA checks');
  check(qa.centerline_collection_sha256_before === qa.centerline_collection_sha256_after && qa.centerline_geometry_mutated === false, 'river centerline immutability');
  check(isHexSha(runtime.centerline_collection_sha256), 'runtime unique centerline collection digest');
  check(runtime.centerline_collection_sha256 === qa.centerline_collection_sha256_before, 'runtime/QA centerline collection digest exact');
  check(!Object.hasOwn(runtime, 'source_centerline_collection_sha256'), 'runtime forbids obsolete duplicate centerline digest alias');
  check(runtime.centerline_geometry_mutated === false && runtime.centerline_file === 'river_drape_center.f32', 'runtime centerline immutability/file');
  check(runtime.crs === 'EPSG:32649' && runtime.source_resolution_m === 12.5, 'runtime CRS/native source spacing');
  check(runtime.vertical_scale === 1 && runtime.source_elevation_modified_m === 0, 'runtime source elevation unchanged');
  check(runtime.nodata_policy === NODATA_POLICY, 'runtime frozen NoData policy', runtime.nodata_policy);
  close(runtime.surface_offset_m, 0.35, 0, 'runtime river surface offset');
  check(runtime.qa_file === 'river_drape_qa.json', 'runtime QA pointer exact');
  check(runtime.season_semantics === 'visual seasonal preset; not a discharge simulation', 'runtime visual season semantics');
  check(Array.isArray(qa.oversize_asset_files) && qa.oversize_asset_files.length === 0 && qa.maximum_asset_bytes === MAX_ASSET_BYTES, 'river asset size QA');
  check(Array.isArray(runtime.indexed_assets) && runtime.indexed_assets.length === 13, 'exactly 13 indexed river assets');
  check(new Set(runtime.indexed_assets.map(asset => asset.file)).size === 13, 'river indexed asset names unique');
  deepEqual(runtime.indexed_assets.map(asset => asset.file).sort(), [
    'river_drape_center.f32',
    ...Object.keys(SEASONS).flatMap(season => [
      `river_drape_${season}.f32`,
      `river_drape_${season}_positions.f32.gz`,
      `river_drape_${season}_indices.u32.gz`,
    ]),
  ].sort(), 'river exact 13 indexed filenames');
  for (const asset of runtime.indexed_assets) {
    deepEqual(Object.keys(asset).sort(), ['file', 'sha256', 'stored_bytes'], `${asset.file || 'unnamed river asset'} exact indexed asset keys`);
    check(typeof asset.file === 'string' && asset.file.length > 0, 'river indexed asset filename');
    positive(asset.stored_bytes, `${asset.file}.stored_bytes`); check(asset.stored_bytes < MAX_ASSET_BYTES, `${asset.file} under 100 MiB`);
    check(isHexSha(asset.sha256), `${asset.file}.sha256`);
  }
  check(runtime.indexed_assets.some(asset => asset.file === 'river_drape_center.f32'), 'center audit asset indexed');
  const round = qa.joins_and_topology?.round_arc_regression;
  check(round?.passed === true && round.round_buffer_quad_segs >= 16, 'round join q16');
  positive(round.round_arc_sample_count, 'round arc sample count');
  check(round.round_arc_max_heading_step_deg <= 6 && round.round_arc_max_sagitta_ratio <= 0.002, 'round arc angular/sagitta ratio');
  positive(round.maximum_actual_radius_m, 'round maximum actual radius');
  check(round.maximum_actual_sagitta_m <= 0.25, 'round actual sagitta <=25cm');
  const hole = qa.joins_and_topology?.hole_preservation_regression;
  check(hole?.passed === true && hole.source_interior_ring_count === 1 && hole.triangle_count > 0, 'hole preservation regression is non-vacuous');
  check(hole.symmetric_difference_area_m2 <= 1e-10 && hole.triangle_hole_overlap_area_m2 <= 1e-10, 'hole preservation exact');

  for (const [season, preset] of Object.entries(SEASONS)) {
    const runtimeSeason = runtime.seasons?.[season];
    check(runtimeSeason, `runtime season ${season}`);
    close(runtimeSeason.width, preset.width, 1e-12, `${season}.width`);
    close(runtimeSeason.depth, preset.depth, 1e-12, `${season}.depth`);
    check(canonicalColor(runtimeSeason.color) === preset.color, `${season}.color`);
    check(runtimeSeason.semantics === 'visual seasonal preset; not a discharge simulation', `${season}.semantics`);
    check(runtimeSeason.bank_audit_file === `river_drape_${season}.f32`, `${season} bank audit filename exact`);
    const mesh = runtimeSeason.serialized_global_display_mesh;
    check(mesh?.positions_file === `river_drape_${season}_positions.f32.gz` && mesh.indices_file === `river_drape_${season}_indices.u32.gz`, `${season} serialized filenames`);
    check(mesh.position_compression === 'gzip' && mesh.index_compression === 'gzip', `${season} gzip compression`);
    check(mesh.positions_global === true && mesh.indices_global === true && mesh.index_space === 'global-vertex-array', `${season} global arrays`);
    check(mesh.vertex_space === 'terrain-world local X,height,local Z; source DEM height plus 0.35m', `${season} exact vertex-space semantics`, mesh.vertex_space);
    positive(mesh.vertex_count, `${season}.vertex_count`); positive(mesh.index_count, `${season}.index_count`); positive(mesh.triangle_count, `${season}.triangle_count`);
    check(mesh.index_count === mesh.triangle_count * 3, `${season} index/triangle exact`);
    check(isHexSha(mesh.position_sha256) && isHexSha(mesh.index_sha256), `${season} mesh hashes`);
    check(mesh.position_stored_bytes < MAX_ASSET_BYTES && mesh.index_stored_bytes < MAX_ASSET_BYTES, `${season} displayed assets <100MiB`);
    check(Array.isArray(mesh.run_ranges) && mesh.run_ranges.length === mesh.visible_run_count, `${season} run ranges exact`);
    let vertexOffset = 0; let indexOffset = 0;
    for (const range of mesh.run_ranges) {
      check(range.vertex_offset === vertexOffset && range.index_offset === indexOffset, `${season} contiguous run ranges`);
      check(range.terrain_visible === true && range.fully_shadowed_by_stable_ownership === false, `${season} visible run range`);
      positive(range.vertex_count, `${season} run vertices`); positive(range.index_count, `${season} run indices`);
      check(range.index_count === range.triangle_count * 3, `${season} range index/triangle exact`);
      vertexOffset += range.vertex_count; indexOffset += range.index_count;
    }
    check(vertexOffset === mesh.vertex_count && indexOffset === mesh.index_count, `${season} ranges cover global arrays`);
    const direct = qa.grounding_by_season?.[season]?.serialized_global_display_mesh;
    const alias = qa.joins_and_topology?.serialized_global_display_mesh_by_season?.[season];
    check(direct && alias, `${season} direct and alias serialized QA`);
    deepEqual(direct, alias, `${season} serialized QA alias deep equality`);
    validateSerializedRiverSeason(direct, season, preset);
    const groundingSeason = qa.grounding_by_season[season];
    deepEqual(Object.keys(groundingSeason).sort(), ['left_bank', 'passed', 'right_bank', 'serialized_global_display_mesh'], `${season} exact grounding keys`);
    check(groundingSeason.passed === true, `${season} aggregate grounding passed`);
    for (const bankName of ['left_bank', 'right_bank']) {
      const bank = groundingSeason[bankName]; const bp = `${season}.${bankName}`;
      check(bank?.passed === true, `${bp} Float32 audit passed`);
      positive(bank.sample_count, `${bp}.sample_count`); check(bank.clearance_count === bank.sample_count, `${bp} clearance/sample count exact`);
      check(bank.invalid_terrain_sample_count === 0, `${bp} native terrain samples all valid`);
      check(bank.clearance_maximum_m <= 2 && bank.clearance_penetration_minimum_m >= 0 && bank.penetration_count === 0, `${bp} clearance/penetration`);
      check(bank.p95_absolute_error_m <= 0.001 && bank.maximum_absolute_error_m <= 0.01, `${bp} errors`);
    }
    const bankAsset = runtime.indexed_assets.find(asset => asset.file === runtimeSeason.bank_audit_file);
    check(bankAsset.stored_bytes === (groundingSeason.left_bank.sample_count + groundingSeason.right_bank.sample_count) * 3 * 4, `${season} bank audit binary exactly left+right Float32 XYZ samples`);
    const ribbon = qa.joins_and_topology?.ribbon_hole_preservation_by_season?.[season];
    check(ribbon?.passed === true, `${season} ribbon hole preservation`);
    positive(ribbon.run_count, `${season} ribbon run count`); check(ribbon.failed_run_count === 0, `${season} ribbon failed runs zero`);
    check(ribbon.source_interior_ring_count === ribbon.final_interior_ring_count, `${season} ribbon ring count`);
    check(ribbon.interior_ring_area_absolute_error_m2 <= 1e-8 && ribbon.filled_hole_area_m2 <= 1e-8 && ribbon.symmetric_difference_area_m2 <= 1e-8, `${season} ribbon hole areas`);
  }
  return { assertions: assertionCount, seasons: Object.keys(SEASONS), indexed_asset_count: runtime.indexed_assets.length };
}

async function requestBuffer(page, relative, label = relative) {
  const url = new URL(relative, ROOT_URL).href;
  const response = await page.request.get(url, { timeout: 240_000, failOnStatusCode: false });
  const status = response.status();
  const headers = response.headers();
  const body = await response.body();
  const receipt = { label, url, status, bytes: body.length, sha256: sha256(body), content_type: headers['content-type'] || null };
  publishedAssets.binary.push(receipt);
  check(status === 200, `${label} must return HTTP 200`, receipt);
  return { body, receipt };
}
async function requestJson(page, relative, label = relative) {
  const { body, receipt } = await requestBuffer(page, relative, label);
  let parsed;
  try { parsed = JSON.parse(body.toString('utf8')); } catch (error) { throw new Error(`${label} invalid JSON: ${error.message}`); }
  publishedAssets.json[relative] = receipt;
  return parsed;
}

function validateTerrainManifest(manifest) {
  check(manifest?.schema === 'guilin-v072-terrain-seasonal-rivers/v2', 'terrain manifest schema v2', manifest?.schema);
  check(manifest.overview_only === true, 'terrain overview must be declared overview_only');
  check(manifest.vertical_scale === 1, 'terrain vertical scale must be one');
  deepEqual(manifest.source_grid, [17408, 18867], 'terrain exact source grid shape');
  const sourceSpacing = manifest.source_resolution_xy_m || manifest.source_resolution_m;
  check(Array.isArray(sourceSpacing) ? sourceSpacing.every(value => value === 12.5) : sourceSpacing === 12.5, 'terrain source spacing must be native 12.5m');
  positive(manifest.actual_vertex_spacing_m, 'terrain overview actual vertex spacing');
  check(manifest.actual_vertex_spacing_m > 12.5, 'overview must not be misrepresented as native');
  check(manifest.fallback_resolution_m === null && manifest.fallback_30m_allowed === false, '30m fallback forbidden');
  check(manifest.smoothing === false && manifest.gap_fill === false, 'terrain smoothing/gap fill forbidden');
  check(manifest.source_statistics && typeof manifest.source_statistics === 'object', 'exact source statistics missing');
  for (const key of ['count', 'minimum_m', 'maximum_m', 'mean_m']) finite(manifest.source_statistics[key], `terrain source_statistics.${key}`);
  check(manifest.source_statistics.count === 284579268 && manifest.source_statistics.valid_pixels === 284579268, 'terrain exact valid source count', manifest.source_statistics);
  check(manifest.source_statistics.nodata_pixels === 43857468 && manifest.source_statistics.total_pixels === 328436736, 'terrain exact NoData/total source counts', manifest.source_statistics);
  close(manifest.source_statistics.valid_fraction + manifest.source_statistics.nodata_fraction, 1, 1e-12, 'terrain source fractions exhaust grid');
  deepEqual({
    lod_manifest_file: manifest.lod_manifest_file,
    lod_qa_file: manifest.lod_qa_file,
    river_runtime_file: manifest.river_runtime_file,
    river_qa_file: manifest.river_qa_file,
  }, {
    lod_manifest_file: 'terrain_lod_manifest.json',
    lod_qa_file: 'terrain_lod_qa.json',
    river_runtime_file: 'river_drape_runtime.json',
    river_qa_file: 'river_drape_qa.json',
  }, 'terrain manifest four frozen asset pointers exact');
  const height = manifest.height;
  check(height && typeof height === 'object' && height.overview_only === true, 'terrain height must be an overview-only contract');
  check(Number.isInteger(height.width) && height.width > 1 && Number.isInteger(height.height) && height.height > 1, 'terrain height overview dimensions');
  check(Array.isArray(height.sample_center_bounds_epsg32649) && height.sample_center_bounds_epsg32649.length === 4 && height.sample_center_bounds_epsg32649.every(Number.isFinite), 'terrain height exact EPSG:32649 sample-center bounds');
  check(Array.isArray(height.bounds_world_xz) && height.bounds_world_xz.length === 4 && height.bounds_world_xz.every(Number.isFinite), 'terrain height exact world X/Z bounds');
  check(Array.isArray(height.actual_vertex_spacing_xy_m) && height.actual_vertex_spacing_xy_m.length === 2 && height.actual_vertex_spacing_xy_m.every(value => Number.isFinite(value) && value > 12.5), 'terrain height exact non-native X/Y overview spacing');
  const [west, south, east, north] = height.sample_center_bounds_epsg32649;
  const [centerEasting, centerNorthing] = manifest.center_epsg32649;
  check(west < east && south < north, 'terrain height sample-center bounds ordered');
  const derivedWorldBounds = [west - centerEasting, centerNorthing - north, east - centerEasting, centerNorthing - south];
  close(vectorDistance(height.bounds_world_xz, derivedWorldBounds), 0, 1e-6, 'terrain height EPSG/world bounds exact transform');
  close((east - west) / (height.width - 1), height.actual_vertex_spacing_xy_m[0], 1e-6, 'terrain height X sample-center span/spacing exact');
  close((north - south) / (height.height - 1), height.actual_vertex_spacing_xy_m[1], 1e-6, 'terrain height Y sample-center span/spacing exact');
  close(manifest.actual_vertex_spacing_m, Math.max(...height.actual_vertex_spacing_xy_m), 1e-6, 'terrain height/manifest actual overview spacing exact');
  close(manifest.actual_vertex_spacing_m, EXPECTED_OVERVIEW_HEIGHT.actual_vertex_spacing_m, 1e-9, 'terrain production overview maximum spacing exact');
  for (const [index, expected] of EXPECTED_OVERVIEW_HEIGHT.actual_vertex_spacing_xy_m.entries()) close(height.actual_vertex_spacing_xy_m[index], expected, 1e-9, `terrain production overview XY spacing[${index}] exact`);
  for (const [index, expected] of EXPECTED_OVERVIEW_HEIGHT.sample_center_bounds_epsg32649.entries()) close(height.sample_center_bounds_epsg32649[index], expected, 1e-6, `terrain production sample-center bound[${index}] exact`);
  for (const [index, expected] of EXPECTED_OVERVIEW_HEIGHT.bounds_world_xz.entries()) close(height.bounds_world_xz[index], expected, 1e-6, `terrain production world bound[${index}] exact`);
  check(height.nodata_policy === NODATA_POLICY, 'terrain height frozen conservative NoData policy', height.nodata_policy);
}

function pickFields(object, keys) { return Object.fromEntries(keys.map(key => [key, object?.[key]])); }

function validateRiverGroundingAcceptance(manifest, qa) {
  const point = manifest.acceptance_points?.find(item => item.id === 'river-grounding');
  const manifestReceipt = manifest.acceptance_source_qa?.river_grounding;
  const qaReceipt = qa.native_acceptance?.source_validation?.river_grounding;
  check(point && manifestReceipt && qaReceipt, 'river-grounding receipt present at all three frozen LOD paths');
  deepEqual(manifestReceipt, qaReceipt, 'river-grounding manifest/QA source receipt deep equality');
  deepEqual(pickFields(point, Object.keys(manifestReceipt)), manifestReceipt, 'river-grounding acceptance point contains the complete source receipt unchanged');
  deepEqual(pickFields(point, RIVER_GROUNDING_CORE_FIELDS), pickFields(manifestReceipt, RIVER_GROUNDING_CORE_FIELDS), 'river-grounding acceptance-point/source receipt core equality');
  const receipt = qaReceipt;
  check(receipt.passed === true, 'river-grounding cross-slope receipt passed');
  deepEqual(Object.keys(receipt.checks || {}).sort(), [...RIVER_GROUNDING_CHECK_KEYS].sort(), 'river-grounding exact twelve check keys');
  allTrue(receipt.checks, 'river-grounding checks');
  for (const key of ['original_centerline_lonlat', 'center_epsg32649', 'left_bank_epsg32649', 'right_bank_epsg32649', 'center_xz_m', 'left_bank_xz_m', 'right_bank_xz_m']) {
    check(Array.isArray(receipt[key]) && receipt[key].length === 2 && receipt[key].every(Number.isFinite), `river-grounding ${key} finite pair`);
  }
  for (const key of ['center_terrain_height_m', 'left_bank_terrain_height_m', 'right_bank_terrain_height_m', 'left_minus_right_terrain_y_m', 'bank_delta_y_m', 'cross_slope', 'cross_slope_degrees', 'width', 'base_width_m', 'final_width_m']) finite(receipt[key], `river-grounding ${key}`);
  check(receipt.centerline_coordinate_mutated === false, 'river-grounding original centerline coordinate unchanged');
  finite(receipt.lon, 'river-grounding source longitude'); finite(receipt.lat, 'river-grounding source latitude');
  close(vectorDistance(receipt.original_centerline_lonlat, [receipt.lon, receipt.lat]), 0, 1e-12, 'river-grounding selected lon/lat is the unchanged original centerline coordinate');
  check(Array.isArray(manifest.center_epsg32649) && manifest.center_epsg32649.length === 2, 'LOD manifest world center for river-grounding transform');
  for (const [prefix, epsgKey, worldKey] of [
    ['center', 'center_epsg32649', 'center_xz_m'], ['left bank', 'left_bank_epsg32649', 'left_bank_xz_m'], ['right bank', 'right_bank_epsg32649', 'right_bank_xz_m'],
  ]) {
    const expectedWorld = [receipt[epsgKey][0] - manifest.center_epsg32649[0], manifest.center_epsg32649[1] - receipt[epsgKey][1]];
    close(vectorDistance(receipt[worldKey], expectedWorld), 0, 1e-6, `river-grounding ${prefix} EPSG:32649 to terrain-world XZ exact`);
  }
  check(receipt.season === 'summer' && receipt.width === SEASONS.summer.width, 'river-grounding uses exact summer visual width multiplier');
  check(['li', 'xiang'].includes(receipt.system), 'river-grounding representative river system is Li/Xiang', receipt.system);
  check(typeof receipt.name === 'string' && receipt.name.trim().length > 0, 'river-grounding representative source name present', receipt.name);
  check(receipt.non_endpoint === true, 'river-grounding source vertex is not a line endpoint');
  positive(receipt.base_width_m, 'river-grounding base width'); positive(receipt.final_width_m, 'river-grounding final width');
  close(receipt.final_width_m, receipt.base_width_m * receipt.width, 1e-9, 'river-grounding final width derives from summer width');
  for (const key of ['center_native_3x3_valid_count', 'left_bank_native_3x3_valid_count', 'right_bank_native_3x3_valid_count']) check(receipt[key] === 9, `river-grounding ${key} exact native 3x3 coverage`, receipt[key]);
  check(Number.isInteger(receipt.source_feature_index) && receipt.source_feature_index >= 0 && Number.isInteger(receipt.source_vertex_index) && receipt.source_vertex_index >= 0, 'river-grounding source indices');
  const constraints = receipt.candidate_constraints;
  deepEqual(Object.keys(constraints || {}).sort(), [
    'allowed_systems', 'bank_delta_y_minimum_m', 'center_left_right_native_3x3_valid',
    'center_left_right_native_samples_valid', 'cross_slope_maximum', 'cross_slope_minimum',
    'cross_slope_target', 'non_endpoint', 'ranking', 'season', 'source_name_required', 'width_multiplier',
  ].sort(), 'river-grounding candidate constraint keys exact');
  deepEqual(constraints.allowed_systems, ['li', 'xiang'], 'river-grounding allowed systems exact');
  check(constraints.source_name_required === true && constraints.non_endpoint === true && constraints.center_left_right_native_samples_valid === true && constraints.center_left_right_native_3x3_valid === true, 'river-grounding candidate boolean constraints');
  check(constraints.season === 'summer' && constraints.width_multiplier === SEASONS.summer.width, 'river-grounding candidate summer constraints');
  close(constraints.bank_delta_y_minimum_m, 2, 0, 'river-grounding candidate minimum bank delta');
  close(constraints.cross_slope_minimum, 0.02, 0, 'river-grounding candidate minimum cross slope');
  close(constraints.cross_slope_maximum, 0.10, 0, 'river-grounding candidate maximum cross slope');
  close(constraints.cross_slope_target, 0.06, 0, 'river-grounding candidate target cross slope');
  deepEqual(constraints.ranking, ['final_width_m descending', 'absolute cross_slope distance from 0.06 ascending', 'cross_slope descending', 'bank_delta_y_m descending', 'source_feature_index ascending', 'source_vertex_index ascending'], 'river-grounding deterministic width-first representative-slope ranking');

  const leftOffset = vectorDistance(receipt.center_xz_m, receipt.left_bank_xz_m);
  const rightOffset = vectorDistance(receipt.center_xz_m, receipt.right_bank_xz_m);
  const bankSpan = vectorDistance(receipt.left_bank_xz_m, receipt.right_bank_xz_m);
  const leftOffsetEpsg = vectorDistance(receipt.center_epsg32649, receipt.left_bank_epsg32649);
  const rightOffsetEpsg = vectorDistance(receipt.center_epsg32649, receipt.right_bank_epsg32649);
  const bankSpanEpsg = vectorDistance(receipt.left_bank_epsg32649, receipt.right_bank_epsg32649);
  check(bankSpan > 0 && leftOffset > 0 && rightOffset > 0, 'river-grounding left/right XZ are genuinely distinct');
  close(leftOffset, receipt.final_width_m / 2, 1e-6, 'river-grounding left XZ is final half-width');
  close(rightOffset, receipt.final_width_m / 2, 1e-6, 'river-grounding right XZ is final half-width');
  close(bankSpan, receipt.final_width_m, 1e-6, 'river-grounding bank XZ span is final width');
  close(leftOffsetEpsg, leftOffset, 1e-6, 'river-grounding left EPSG/world offset agrees');
  close(rightOffsetEpsg, rightOffset, 1e-6, 'river-grounding right EPSG/world offset agrees');
  close(bankSpanEpsg, bankSpan, 1e-6, 'river-grounding EPSG/world bank span agrees');
  const signedDelta = receipt.left_bank_terrain_height_m - receipt.right_bank_terrain_height_m;
  close(receipt.left_minus_right_terrain_y_m, signedDelta, 1e-9, 'river-grounding signed bank terrain delta exact');
  close(receipt.bank_delta_y_m, Math.abs(signedDelta), 1e-9, 'river-grounding absolute bank terrain delta exact');
  check(receipt.bank_delta_y_m >= 2 && receipt.bank_delta_y_m > 0, 'river-grounding readable nonzero bank height delta >=2m', receipt.bank_delta_y_m);
  close(receipt.cross_slope, receipt.bank_delta_y_m / receipt.final_width_m, 1e-12, 'river-grounding cross-slope derives from bank delta/final width');
  check(receipt.cross_slope >= 0.02 && receipt.cross_slope <= 0.10, 'river-grounding representative cross-slope within [0.02,0.10]', receipt.cross_slope);
  close(receipt.cross_slope_degrees, Math.atan(receipt.cross_slope) * 180 / Math.PI, 1e-12, 'river-grounding slope degrees derive from slope');

  terrainEvidence.river_grounding_cross_slope = {
    receipt, paths_verified: [
      'terrain_lod_manifest.acceptance_points[id=river-grounding]',
      'terrain_lod_manifest.acceptance_source_qa.river_grounding',
      'terrain_lod_qa.native_acceptance.source_validation.river_grounding',
    ],
    derived: { left_offset_m: leftOffset, right_offset_m: rightOffset, bank_span_m: bankSpan, signed_bank_delta_y_m: signedDelta },
  };
  return receipt;
}

function validateLodAssets(manifest, qa, terrainManifest) {
  check(manifest?.schema === 'guilin-v072-terrain-lod/v4', 'LOD manifest schema v4', manifest?.schema);
  check(qa?.schema === 'guilin-v072-terrain-lod-qa/v4', 'LOD QA schema v4', qa?.schema);
  check(qa.passed === true, 'LOD QA passed'); allTrue(qa.checks, 'LOD QA checks');
  for (const object of [manifest, qa]) {
    check(object.fallback_resolution_m === null && object.fallback_30m_allowed === false, 'LOD fallback forbidden');
    check(object.smoothing === false && object.gap_fill === false, 'LOD smoothing/gap fill forbidden');
  }
  const strides = [128, 64, 32, 16, 8, 4, 2, 1];
  const counts = [1, 4, 9, 25, 90, 323, 1258, 5032];
  check(Array.isArray(manifest.levels) && manifest.levels.length === 8, 'LOD must have eight levels');
  check(manifest.levels.reduce((sum, level) => sum + level.tile_count, 0) === 6742, 'LOD exact total 6742 tiles');
  check(Array.isArray(manifest.acceptance_points) && manifest.acceptance_points.length === NATIVE_ACCEPTANCE_TARGETS.length, 'LOD exact native acceptance point inventory');
  deepEqual(manifest.acceptance_points.map(point => point.id).sort(), [...NATIVE_ACCEPTANCE_TARGETS].sort(), 'LOD/browser native acceptance ids exact');
  for (const point of manifest.acceptance_points) {
    check(point.required_level === 'native12_5m' && point.actual_vertex_spacing_m === 12.5, `${point.id} acceptance native spacing contract`);
    check(point.native_available === true && point.native_mask_verified === true, `${point.id} acceptance native source verified`);
    if (point.id === 'nodata') check(point.neighborhood_valid_pixel_count > 0 && point.neighborhood_nodata_pixel_count > 0 && point.gap_fill_applied === false, 'NoData acceptance mixed 600m source mask');
    else check(point.native_3x3_valid_count === 9 && Number.isFinite(point.native_elevation_m) && Number.isFinite(point.native_slope_degrees), `${point.id} valid native 3x3/elevation/slope`);
  }
  check(qa.native_acceptance?.passed === true && qa.native_acceptance.all_required_available === true, 'LOD QA native acceptance passed');
  deepEqual([...qa.native_acceptance.required_ids].sort(), [...NATIVE_ACCEPTANCE_TARGETS].sort(), 'LOD QA required native acceptance ids exact');
  deepEqual([...qa.native_acceptance.available_ids].sort(), [...NATIVE_ACCEPTANCE_TARGETS].sort(), 'LOD QA available native acceptance ids exact');
  validateRiverGroundingAcceptance(manifest, qa);
  for (const [index, level] of manifest.levels.entries()) {
    const prefix = `LOD level[${index}]`;
    check(level.id === level.level_id, `${prefix} id/level_id exact`);
    check(level.stride === strides[index], `${prefix} stride`, level.stride);
    close(level.resolution_m, 12.5 * strides[index], 1e-9, `${prefix} resolution`);
    check(level.tile_count === counts[index], `${prefix} exact tile count`, level.tile_count);
    check(Array.isArray(level.tiles) && level.tiles.length === level.tile_count, `${prefix} tiles exact`);
    check(level.smoothing === false && level.gap_fill === false && level.fallback_resolution_m === null, `${prefix} no smoothing/fill/fallback`);
    for (const [tileIndex, tile] of level.tiles.entries()) {
      const tp = `${prefix}.tiles[${tileIndex}]`;
      check(tile.file === `terrain_lod/${level.level_id}/${tile.file.split('/').at(-1)}`, `${tp}.path under frozen level`);
      check(/^terrain_lod\/[a-zA-Z0-9._-]+\/r\d{3,}_c\d{3,}\.tile\.gz$/.test(tile.file), `${tp}.file frozen naming`, tile.file);
      positive(tile.width, `${tp}.width`); positive(tile.height, `${tp}.height`);
      check(tile.width === tile.cell_width + 1 && tile.height === tile.cell_height + 1, `${tp} vertex/cell dimensions`);
      check(Array.isArray(tile.bounds_world_xz) && tile.bounds_world_xz.length === 4, `${tp}.bounds_world_xz`);
      close(tile.bounds_world_xz[2] - tile.bounds_world_xz[0], tile.cell_width * level.resolution_m, 1e-5, `${tp} X span`);
      close(tile.bounds_world_xz[3] - tile.bounds_world_xz[1], tile.cell_height * level.resolution_m, 1e-5, `${tp} Z span`);
      positive(tile.stored_bytes, `${tp}.stored_bytes`); check(isHexSha(tile.sha256), `${tp}.sha256`);
      check(tile.smoothing === false && tile.gap_fill === false && tile.fallback_resolution_m === null, `${tp} no smoothing/fill/fallback`);
      check(tile.valid_vertex_count + tile.nodata_vertex_count === tile.width * tile.height, `${tp} vertex mask counts`);
      check(tile.valid_cell_count + tile.nodata_cell_count === tile.cell_width * tile.cell_height, `${tp} cell mask counts`);
      check(tile.decode_receipt && typeof tile.decode_receipt === 'object', `${tp}.decode_receipt`); allTrue(tile.decode_receipt, `${tp}.decode_receipt`);
    }
  }
  deepEqual(qa.source_statistics, terrainManifest.source_statistics, 'LOD QA source statistics exact with terrain manifest');
}

async function decodeRepresentativeLodTiles(page, lodManifest) {
  for (const level of lodManifest.levels) {
    const tile = level.tiles[0];
    const { body, receipt } = await requestBuffer(page, `data/${tile.file}`, `representative tile ${level.level_id}`);
    check(receipt.bytes === tile.stored_bytes && receipt.sha256 === tile.sha256, `${level.level_id} stored bytes/hash exact`);
    const decoded = await gunzip(body);
    check(decoded.length >= 48, `${level.level_id} tile header length`);
    check(decoded.subarray(0, 8).equals(Buffer.from([71, 76, 84, 73, 76, 69, 52, 0])), `${level.level_id} GLTILE4 magic`);
    const width = decoded.readUInt32LE(8); const height = decoded.readUInt32LE(12);
    const cellWidth = decoded.readUInt32LE(16); const cellHeight = decoded.readUInt32LE(20);
    const originE = decoded.readDoubleLE(24); const originN = decoded.readDoubleLE(32); const spacing = decoded.readDoubleLE(40);
    check(width === tile.width && height === tile.height && cellWidth === tile.cell_width && cellHeight === tile.cell_height, `${level.level_id} decoded dimensions exact`);
    close(spacing, level.resolution_m, 1e-9, `${level.level_id} decoded spacing`);
    const heightBytes = width * height * 4; const vertexMaskBytes = width * height; const cellMaskBytes = cellWidth * cellHeight;
    check(decoded.length === 48 + heightBytes + vertexMaskBytes + cellMaskBytes, `${level.level_id} exact payload length`);
    const vertexMask = decoded.subarray(48 + heightBytes, 48 + heightBytes + vertexMaskBytes);
    const cellMask = decoded.subarray(48 + heightBytes + vertexMaskBytes);
    check([...vertexMask].every(value => value === 0 || value === 1), `${level.level_id} binary vertex mask`);
    check([...cellMask].every(value => value === 0 || value === 1), `${level.level_id} binary cell mask`);
    let validVertices = 0; let nodataVertices = 0;
    for (let index = 0; index < width * height; index += 1) {
      const value = decoded.readFloatLE(48 + index * 4);
      check(Number.isFinite(value), `${level.level_id} finite decoded height`);
      if (vertexMask[index]) validVertices += 1;
      else { nodataVertices += 1; check(value === 0, `${level.level_id} masked height zero`); }
    }
    const validCells = [...cellMask].reduce((sum, value) => sum + value, 0);
    check(validVertices === tile.valid_vertex_count && nodataVertices === tile.nodata_vertex_count, `${level.level_id} decoded vertex counts`);
    check(validCells === tile.valid_cell_count && cellMask.length - validCells === tile.nodata_cell_count, `${level.level_id} decoded cell counts`);
    terrainEvidence.decoded_tile_receipts.push({ level_id: level.level_id, file: tile.file, width, height, cell_width: cellWidth, cell_height: cellHeight, origin_e: originE, origin_n: originN, spacing_m: spacing, ...receipt });
  }
}

async function waitForApplication(page) {
  await page.waitForFunction(() => window.__XIAOGUI_TERRAIN_READY === true, null, { timeout: 900_000 });
  await page.waitForFunction(expected => {
    const hooks = window.__XIAOGUI_QA;
    return hooks?.schema === 'guilin-v072-browser-qa-hooks/v3' && expected.every(name => typeof hooks[name] === 'function');
  }, REQUIRED_HOOKS, { timeout: 900_000 });
  await waitForLodStable(page);
  await page.evaluate(async time => { await window.__XIAOGUI_QA.setWaterTime(time); await window.__XIAOGUI_QA.renderNow(); }, WATER_TIME);
}
async function readContracts(page) {
  return page.evaluate(() => {
    const fromHook = window.__XIAOGUI_QA.getContracts();
    return {
      coordinate: fromHook.coordinate ?? window.__XIAOGUI_COORDINATE_CONTRACT,
      render: fromHook.render ?? window.__XIAOGUI_RENDER_CONTRACT,
      river: fromHook.river ?? window.__XIAOGUI_RIVER_CONTRACT,
      camera: fromHook.camera ?? window.__XIAOGUI_CAMERA_CONTRACT,
      lod: fromHook.lod ?? window.__XIAOGUI_LOD_CONTRACT,
      elevation: fromHook.elevation ?? window.__XIAOGUI_ELEVATION_QA,
      performance: fromHook.performance ?? window.__XIAOGUI_PERFORMANCE_CONTRACT ?? window.__XIAOGUI_PERFORMANCE,
      hooks: { schema: window.__XIAOGUI_QA.schema, capabilities: window.__XIAOGUI_QA.capabilities },
    };
  });
}
async function waitForLodStable(page) {
  await page.waitForFunction(() => {
    const hooks = window.__XIAOGUI_QA;
    if (!hooks || typeof hooks.getContracts !== 'function') return false;
    const lod = hooks.getContracts()?.lod ?? window.__XIAOGUI_LOD_CONTRACT;
    return lod && lod.loading === false && lod.debounce_pending === false && lod.request_revision === lod.active_revision;
  }, null, { timeout: 600_000 });
}
async function render(page) { await page.evaluate(async () => window.__XIAOGUI_QA.renderNow()); }

function validateCameraContract(camera, label = 'camera') {
  check(camera && typeof camera === 'object', `${label} contract missing`);
  for (const key of ['position', 'target']) check(Array.isArray(camera[key]) && camera[key].length === 3 && camera[key].every(Number.isFinite), `${label}.${key}`);
  positive(camera.distance, `${label}.distance`); finite(camera.terrain_height_m, `${label}.terrain_height_m`); finite(camera.agl_m, `${label}.agl_m`);
  close(camera.safe_minimum_agl_m, 12, 0, `${label}.safe minimum AGL`);
  check(camera.agl_m >= 12 - 1e-6, `${label}.AGL collision safety`, camera.agl_m);
  check(camera.collision_enabled === true && camera.recoverable === true, `${label}.collision contract`);
  check(Array.isArray(camera.matrix_world) && camera.matrix_world.length === 16, `${label}.matrix_world`);
  check(Array.isArray(camera.projection_matrix) && camera.projection_matrix.length === 16, `${label}.projection_matrix`);
  positive(camera.fov_deg, `${label}.fov_deg`);
  const min = camera.minimum_distance_m ?? camera.controls_min_distance_m;
  const max = camera.maximum_distance_m ?? camera.controls_max_distance_m;
  check(camera.distance >= min - 1e-6 && camera.distance <= max + 1e-6, `${label}.distance bounds`, { min, max, actual: camera.distance });
}
function cameraState(camera) {
  return { position: camera.position, target: camera.target, distance: camera.distance, agl_m: camera.agl_m, terrain_height_m: camera.terrain_height_m, matrix_world: camera.matrix_world, projection_matrix: camera.projection_matrix };
}

async function trustedTargetClick(page, targetId) {
  const before = (await readContracts(page)).camera;
  validateCameraContract(before, `${targetId}.before`);
  const sequenceBefore = before.last_ui_activation?.sequence ?? 0;
  const locator = page.locator(`[data-target="${targetId}"]`);
  check(await locator.count() === 1, `one trusted target button ${targetId}`);
  await locator.click();
  await page.waitForFunction(({ targetId, sequenceBefore }) => {
    const camera = window.__XIAOGUI_CAMERA_CONTRACT;
    return camera?.animation_active === false && camera.last_ui_activation?.sequence > sequenceBefore && camera.last_ui_activation?.target_id === targetId;
  }, { targetId, sequenceBefore }, { timeout: 180_000 });
  await waitForLodStable(page);
  const after = (await readContracts(page)).camera;
  validateCameraContract(after, `${targetId}.after`);
  check(after.last_ui_activation.is_trusted === true && after.last_ui_activation.event_type === 'click', `${targetId} receipt must be trusted click`);
  check(after.last_ui_activation.target_id === targetId && after.last_ui_activation.sequence > sequenceBefore, `${targetId} target receipt`);
  cameraEvidence.trusted_targets[targetId] = { before: cameraState(before), after: cameraState(after), receipt: after.last_ui_activation };
  return after;
}

function assertCameraReceipt(before, after, expected, label) {
  validateCameraContract(before, `${label}.before`); validateCameraContract(after, `${label}.after`);
  const receipt = after.last_input_activation;
  check(receipt?.sequence > (before.last_input_activation?.sequence ?? 0), `${label} input sequence increments`);
  check(receipt.is_trusted === true && receipt.event_type === expected.event_type, `${label} trusted event receipt`, receipt);
  check(receipt.input_action === expected.input_action, `${label} action receipt`, receipt);
  if (expected.button !== undefined) check(receipt.button === expected.button, `${label} button receipt`, receipt);
  if (expected.pointer_type) check(receipt.pointer_type === expected.pointer_type, `${label} pointer type`, receipt);
  if (expected.touch_count !== undefined) check(receipt.touch_count === expected.touch_count, `${label} touch count`, receipt);
  check(receipt.controls_start === true && receipt.controls_end === true, `${label} controls start/end receipts`);
  check(vectorDistance(before.position, after.position) > 1e-4 || vectorDistance(before.target, after.target) > 1e-4 || Math.abs(before.distance - after.distance) > 1e-4, `${label} must semantically change camera`);
  check(after.before && after.after, `${label} camera before/after contract receipts`);
  close(vectorDistance(after.before.position, before.position), 0, 1e-3, `${label} contract before position`);
  close(vectorDistance(after.after.position, after.position), 0, 1e-3, `${label} contract after position`);
  return { before: cameraState(before), after: cameraState(after), receipt };
}

async function runDesktopGestures(page) {
  const canvas = page.locator('#viewer canvas');
  const box = await canvas.boundingBox(); check(box && box.width > 200 && box.height > 200, 'desktop canvas gesture box');
  const x = box.x + box.width * 0.55; const y = box.y + box.height * 0.55;
  let before = (await readContracts(page)).camera;
  const rotateBefore = await capture(page, 'gesture-desktop-left-rotate-before-page');
  const rotateBeforeCanvas = await capture(page, 'gesture-desktop-left-rotate-before-canvas', { canvas: true });
  await page.mouse.move(x, y); await page.mouse.down({ button: 'left' }); await page.mouse.move(x + 96, y + 42, { steps: 12 }); await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(300); await waitForLodStable(page);
  let after = (await readContracts(page)).camera;
  cameraEvidence.trusted_gestures.desktop_left_rotate = assertCameraReceipt(before, after, { event_type: 'pointerup', input_action: 'rotate', button: 0, pointer_type: 'mouse', touch_count: 0 }, 'left rotate');
  const rotateAfter = await capture(page, 'gesture-desktop-left-rotate-after-page');
  const rotateAfterCanvas = await capture(page, 'gesture-desktop-left-rotate-after-canvas', { canvas: true });
  cameraEvidence.trusted_gestures.desktop_left_rotate.screenshots = [rotateBefore.item.file, rotateBeforeCanvas.item.file, rotateAfter.item.file, rotateAfterCanvas.item.file];
  check(vectorDistance(before.target, after.target) <= Math.max(1e-3, before.distance * 1e-5), 'rotate keeps target stable');

  before = after;
  const wheelBefore = await capture(page, 'gesture-desktop-wheel-before-page');
  const wheelBeforeCanvas = await capture(page, 'gesture-desktop-wheel-before-canvas', { canvas: true });
  await page.mouse.move(x, y); await page.mouse.wheel(0, -700); await page.waitForTimeout(400); await waitForLodStable(page);
  after = (await readContracts(page)).camera;
  cameraEvidence.trusted_gestures.desktop_wheel_zoom = assertCameraReceipt(before, after, { event_type: 'wheel', input_action: 'wheel-zoom', pointer_type: 'mouse', touch_count: 0 }, 'wheel zoom');
  const wheelAfter = await capture(page, 'gesture-desktop-wheel-after-page');
  const wheelAfterCanvas = await capture(page, 'gesture-desktop-wheel-after-canvas', { canvas: true });
  cameraEvidence.trusted_gestures.desktop_wheel_zoom.screenshots = [wheelBefore.item.file, wheelBeforeCanvas.item.file, wheelAfter.item.file, wheelAfterCanvas.item.file];
  check(Math.abs(before.distance - after.distance) > 1e-3, 'wheel changes distance');

  before = after;
  const panBefore = await capture(page, 'gesture-desktop-right-pan-before-page');
  const panBeforeCanvas = await capture(page, 'gesture-desktop-right-pan-before-canvas', { canvas: true });
  await page.mouse.move(x, y); await page.mouse.down({ button: 'right' }); await page.mouse.move(x - 74, y + 57, { steps: 12 }); await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(300); await waitForLodStable(page); after = (await readContracts(page)).camera;
  cameraEvidence.trusted_gestures.desktop_right_pan = assertCameraReceipt(before, after, { event_type: 'pointerup', input_action: 'pan', button: 2, pointer_type: 'mouse', touch_count: 0 }, 'right pan');
  const panAfter = await capture(page, 'gesture-desktop-right-pan-after-page');
  const panAfterCanvas = await capture(page, 'gesture-desktop-right-pan-after-canvas', { canvas: true });
  cameraEvidence.trusted_gestures.desktop_right_pan.screenshots = [panBefore.item.file, panBeforeCanvas.item.file, panAfter.item.file, panAfterCanvas.item.file];
  check(vectorDistance(before.target, after.target) > 1e-3, 'pan changes target');
}

async function validateCanonicalCameras(page) {
  for (const id of ['reset', 'overview']) {
    const camera = await trustedTargetClick(page, id);
    const expected = camera.canonical_poses?.[id];
    check(expected, `${id} canonical pose present`);
    close(vectorDistance(camera.position, expected.position), 0, 1e-6, `${id} canonical position`);
    close(vectorDistance(camera.target, expected.target), 0, 1e-6, `${id} canonical target`);
    close(camera.distance, expected.distance, 1e-6, `${id} canonical distance`);
    cameraEvidence.canonical_poses[id] = { expected, actual: cameraState(camera) };
  }
}

function validateBaseContracts(contracts) {
  const { coordinate, render: renderContract, river, camera, lod, elevation, performance } = contracts;
  for (const [name, value] of Object.entries({ coordinate, render: renderContract, river, camera, lod, elevation, performance })) check(value && typeof value === 'object', `runtime ${name} contract missing`);
  check(contracts.hooks.schema === 'guilin-v072-browser-qa-hooks/v3', 'browser QA hook schema v3');
  const capabilities = new Set(contracts.hooks.capabilities || []);
  for (const capability of ['source-domain-edge-coverage', 'runtime-lod-seam-probe', 'projected-nodata-roi', 'active-terrain-collision-probe']) check(capabilities.has(capability), `QA capability missing: ${capability}`);
  check(renderContract.source_elevation_modified_m === 0 && renderContract.vertical_scale === 1, 'render source elevations unchanged, scale 1');
  check(renderContract.normal_file && renderContract.karst_detail_file, 'terrain normal/karst detail assets declared');
  check(renderContract.pixel_ratio >= 1, 'render pixel ratio must be >=1', renderContract.pixel_ratio);
  const font = renderContract.cjk_evidence_font ?? camera.cjk_evidence_font;
  check(font?.installed_and_ready === true && font.local_font_face_loaded === true, 'CJK evidence font installed and local face loaded', font);
  validateCameraContract(camera, 'initial camera');
  check(river.runtime_schema === 'guilin-v072-river-drape-runtime/v3', 'displayed river runtime schema');
  check(river.qa_schema === 'guilin-v072-river-drape-qa/v3', 'displayed river QA schema');
  check(river.serialized_schema === 'guilin-v072-serialized-river-display-qa/v2', 'displayed river serialized schema');
  check(river.ready === true && river.state === 'ready', 'displayed river ready');
  check(river.centerline_geometry_mutated === false, 'displayed river centerline immutable');
  check(performance.schema === 'guilin-v072-render-performance/v2', 'performance schema v2', performance.schema);
  check(performance.total_frames_semantics === 'increments only after renderer.render returns' || /renderer\.render.*returns/i.test(performance.total_frames_semantics), 'real renderer frame semantics', performance.total_frames_semantics);
  check(elevation.source_resolution_m === 12.5 || (Array.isArray(elevation.source_resolution_m) && elevation.source_resolution_m.every(value => value === 12.5)), 'elevation source resolution native 12.5m');
  check(elevation.source_elevation_modified_m === 0 && elevation.vertical_scale === 1, 'elevation source unmodified and vertical scale one');
  check(elevation.gap_fill_applied === false && elevation.smoothing_applied === false && elevation.fallback_resolution_m === null && elevation.fallback_30m_allowed === false, 'elevation no fill/smoothing/fallback');
  check(elevation.nodata_transparent === true, 'elevation NoData transparent');
  const landmarks = coordinate.landmarks;
  for (const id of ['zhenbaoding', 'guilin', 'yangtang', 'yangshuo']) check(landmarks?.[id], `coordinate landmark ${id}`);
  for (const [north, south] of [['zhenbaoding', 'guilin'], ['guilin', 'yangtang'], ['yangtang', 'yangshuo']]) {
    check(landmarks[north].northing > landmarks[south].northing && landmarks[north].z < landmarks[south].z, `${north}/${south} north-south order`);
  }
}

async function validateDom(page, viewport) {
  check(await page.locator('#viewer canvas').count() === 1, 'exactly one WebGL canvas');
  for (const id of ['colorRichness', 'karstDetail', 'riverWidth', 'riverDepth', 'riverColor', 'wireToggle']) check(await page.locator(`#${id}`).count() === 1, `missing control #${id}`);
  check(await page.locator('[data-season]').count() === 4, 'exactly four season buttons');
  for (const target of TARGETS) check(await page.locator(`[data-target="${target}"]`).count() === 1, `fixed acceptance target ${target}`);
  const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
  check(size.width === viewport.width && size.height === viewport.height, `exact viewport ${viewport.width}x${viewport.height}`, size);
  check(size.dpr >= 1, 'browser device pixel ratio >=1', size);
  const labels = await page.locator('.landmark-label').all();
  check(labels.length >= 4, 'at least four landmark labels');
  for (const label of labels.slice(0, 4)) {
    const background = await label.evaluate(element => getComputedStyle(element).backgroundColor);
    check(['rgba(0, 0, 0, 0)', 'transparent'].includes(background), 'landmark label background transparent', background);
  }
}

function validateDisplayedSeason(river, season, publishedRuntime, publishedQa) {
  const preset = SEASONS[season]; const prefix = `displayed ${season}`;
  check(river.ready === true && river.state === 'ready' && river.season === season, `${prefix} ready/state/season`);
  check(river.runtime_schema === publishedRuntime.schema && river.qa_schema === publishedQa.schema, `${prefix} asset schemas exact`);
  check(river.serialized_schema === 'guilin-v072-serialized-river-display-qa/v2', `${prefix} serialized schema`);
  check(river.last_ui_activation?.season === season && river.last_ui_activation.is_trusted === true && river.last_ui_activation.event_type === 'click', `${prefix} trusted season receipt`);
  close(river.controls.width_scale, preset.width, 1e-6, `${prefix} control width`);
  close(river.controls.depth_visual, preset.depth, 1e-6, `${prefix} control depth`);
  check(canonicalColor(river.controls.color) === preset.color, `${prefix} control color`);
  check(Array.isArray(river.actual_materials_by_system) && river.actual_materials_by_system.length > 0, `${prefix} actual material systems non-vacuous`);
  for (const material of river.actual_materials_by_system) {
    check(typeof material.system === 'string' && material.system.length > 0, `${prefix} material system id`);
    close(material.width_scale, preset.width, 1e-6, `${prefix}.${material.system}.width_scale`);
    close(material.depth_visual, preset.depth, 1e-6, `${prefix}.${material.system}.depth_visual`);
    check(canonicalColor(material.color) === preset.color, `${prefix}.${material.system}.color`);
    check(material.opacity > 0 && material.opacity <= 1, `${prefix}.${material.system}.opacity`);
    check(material.depth_test === true && material.depth_write === false && material.polygon_offset === false, `${prefix}.${material.system} safe depth policy`, material);
    check(material.side === 'FrontSide', `${prefix}.${material.system}.side`, material.side);
  }
  const uniforms = river.material_uniforms;
  check(uniforms && typeof uniforms === 'object', `${prefix}.material_uniforms`);
  close(uniforms.width_scale, preset.width, 1e-6, `${prefix}.uniform width`);
  close(uniforms.depth_visual, preset.depth, 1e-6, `${prefix}.uniform depth`);
  check(canonicalColor(uniforms.color) === preset.color, `${prefix}.uniform color`);
  positive(river.active_triangle_count ?? river.visible_triangle_count, `${prefix}.active triangle count`);
  positive(river.active_indexed_vertex_count ?? river.visible_indexed_vertex_count, `${prefix}.active indexed vertex count`);
  const expectedMesh = publishedRuntime.seasons[season].serialized_global_display_mesh;
  deepEqual(river.serialized_global_display_mesh, expectedMesh, `${prefix} runtime serialized mesh deep equality`);
  const expectedQa = publishedQa.grounding_by_season[season].serialized_global_display_mesh;
  deepEqual(river.serialized_global_display_qa ?? river.decoded_display_qa, expectedQa, `${prefix} displayed QA deep equality`);
  check((river.active_triangle_count ?? river.visible_triangle_count) === expectedMesh.triangle_count, `${prefix} displayed triangle count exact`);
  check((river.active_indexed_vertex_count ?? river.visible_indexed_vertex_count) === expectedMesh.vertex_count, `${prefix} displayed vertex count exact`);
  check(river.decoded_float32_grounding?.passed === true, `${prefix} displayed decoded grounding`);
  check(river.display_precision?.passed === true, `${prefix} displayed precision`);
}

async function clickSeason(page, season, publishedRuntime, publishedQa, evidenceBucket) {
  const before = (await readContracts(page)).river;
  const sequenceBefore = before.last_ui_activation?.sequence ?? 0;
  const button = page.locator(`[data-season="${season}"]`); check(await button.count() === 1, `${season} button exact`);
  await button.click();
  await page.waitForFunction(({ season, sequenceBefore }) => {
    const contract = window.__XIAOGUI_RIVER_CONTRACT;
    return contract?.ready === true && contract.season === season && contract.last_ui_activation?.sequence > sequenceBefore;
  }, { season, sequenceBefore }, { timeout: 180_000 });
  await render(page);
  const [contracts, dom] = await Promise.all([
    readContracts(page),
    page.evaluate(() => ({
      season_name: document.querySelector('#seasonName')?.textContent?.trim(),
      season_status: document.querySelector('#seasonStatus')?.textContent?.trim(),
      width: Number(document.querySelector('#riverWidth')?.value),
      depth: Number(document.querySelector('#riverDepth')?.value),
      color: document.querySelector('#riverColor')?.value,
      buttons: [...document.querySelectorAll('[data-season]')].map(element => ({ season: element.dataset.season, pressed: element.getAttribute('aria-pressed'), active: element.classList.contains('active') })),
    })),
  ]);
  validateDisplayedSeason(contracts.river, season, publishedRuntime, publishedQa);
  const preset = SEASONS[season];
  check(dom.season_name === preset.label, `${season} DOM exact label`, dom.season_name);
  check(dom.season_status === '视觉季节预设' || dom.season_status === '視覺季節預設', `${season} DOM exact visual-preset status`, dom.season_status);
  close(dom.width, preset.width, 1e-6, `${season} DOM width`); close(dom.depth, preset.depth, 1e-6, `${season} DOM depth`);
  check(canonicalColor(dom.color) === preset.color, `${season} DOM color`);
  for (const item of dom.buttons) check((item.season === season) === (item.pressed === 'true' && item.active), `${season} sole active/pressed DOM button`, item);
  const evidence = { dom, contract: contracts.river };
  evidenceBucket[season] = evidence;
  return evidence;
}

async function validatePublishedRiverBinaries(page, runtime) {
  const expectedDisplayFiles = new Set();
  for (const season of Object.keys(SEASONS)) {
    const mesh = runtime.seasons[season].serialized_global_display_mesh;
    expectedDisplayFiles.add(mesh.positions_file); expectedDisplayFiles.add(mesh.indices_file);
  }
  for (const asset of runtime.indexed_assets) {
    const { body, receipt } = await requestBuffer(page, `data/${asset.file}`, `river asset ${asset.file}`);
    check(receipt.bytes === asset.stored_bytes && receipt.sha256 === asset.sha256, `${asset.file} bytes/hash exact`);
    const decodedReceipt = await validateRiverBinaryBuffer(asset, body, runtime);
    Object.assign(publishedAssets.binary.at(-1), decodedReceipt);
    publishedAssets.binary.at(-1).displayed_asset = expectedDisplayFiles.has(asset.file);
  }
  check(publishedAssets.binary.filter(item => item.displayed_asset).length === 8, 'all eight displayed river binaries actually HTTP 200');
}

async function validateRiverBinaryBuffer(asset, stored, runtime) {
  check(stored.length === asset.stored_bytes && sha256(stored) === asset.sha256, `${asset.file} stored bytes/hash exact`);
  const reference = Object.entries(runtime.seasons).flatMap(([season, value]) => {
    const mesh = value.serialized_global_display_mesh;
    return [
      { season, kind: 'positions', file: mesh.positions_file, mesh },
      { season, kind: 'indices', file: mesh.indices_file, mesh },
    ];
  }).find(item => item.file === asset.file);
  if (!reference) {
    check(asset.file.endsWith('.f32') && !asset.file.endsWith('.gz'), `${asset.file} non-display audit encoding`);
    check(stored.length > 0 && stored.length % 12 === 0, `${asset.file} raw Float32 XYZ alignment`);
    for (let offset = 0; offset < stored.length; offset += 4) check(Number.isFinite(stored.readFloatLE(offset)), `${asset.file} finite Float32 audit scalar`);
    return { decoded: true, encoding: 'float32-little-endian-xyz', decoded_bytes: stored.length, decoded_sha256: sha256(stored), scalar_count: stored.length / 4 };
  }
  const { mesh, season, kind } = reference;
  check(mesh.position_compression === 'gzip' && mesh.index_compression === 'gzip', `${season} serialized references gzip`);
  if (kind === 'positions') {
    check(mesh.position_stored_bytes === asset.stored_bytes && mesh.position_sha256 === asset.sha256, `${season} position reference/indexed asset exact`);
  } else {
    check(mesh.index_stored_bytes === asset.stored_bytes && mesh.index_sha256 === asset.sha256, `${season} index reference/indexed asset exact`);
  }
  const decoded = await gunzip(stored);
  if (kind === 'positions') {
    check(decoded.length === mesh.vertex_count * 3 * 4, `${season} decoded positions exactly vertex_count*XYZ*f32`, { decoded_bytes: decoded.length, vertex_count: mesh.vertex_count });
    for (let offset = 0; offset < decoded.length; offset += 4) check(Number.isFinite(decoded.readFloatLE(offset)), `${season} decoded position finite`);
  } else {
    check(decoded.length === mesh.index_count * 4, `${season} decoded indices exactly index_count*u32`, { decoded_bytes: decoded.length, index_count: mesh.index_count });
    check(mesh.triangle_count * 3 === mesh.index_count, `${season} triangle/index count exact`);
    let maximumIndex = 0;
    for (let offset = 0; offset < decoded.length; offset += 4) maximumIndex = Math.max(maximumIndex, decoded.readUInt32LE(offset));
    check(maximumIndex < mesh.vertex_count, `${season} every global index is within welded vertex array`, { maximumIndex, vertex_count: mesh.vertex_count });
  }
  return {
    decoded: true, compression: 'gzip', season, kind,
    decoded_bytes: decoded.length, decoded_sha256: sha256(decoded),
    scalar_count: decoded.length / 4,
  };
}

function validateLodRuntime(lod, expectedCase = null) {
  check(lod && typeof lod === 'object', 'LOD runtime contract missing');
  check(lod.loading === false && lod.debounce_pending === false, 'LOD stable flags');
  check(lod.request_revision === lod.active_revision, 'LOD request/active revision exact');
  check(Array.isArray(lod.active_tiles), 'LOD active tiles array');
  check(lod.active_tiles.length <= 36, 'LOD active tile union bounded to 36', lod.active_tiles.length);
  check(lod.active_tile_count === lod.active_tiles.length && Array.isArray(lod.active_tile_ids) && lod.active_tile_ids.length === lod.active_tiles.length, 'LOD active tile count/id arrays exact');
  check(Array.isArray(lod.active_resolutions_m), 'LOD active resolutions array');
  check(Array.isArray(lod.load_errors) && lod.load_errors.length === 0, 'LOD load errors zero', lod.load_errors);
  const backdropOnly = expectedCase?.backdrop_only === true || (!expectedCase && lod.current_lod === 'overview-backdrop');
  const backdropTransition = lod.backdrop_transition_probe;
  check(backdropTransition?.measurement === 'camera projection of every coarsest active outer-perimeter cell edge against overview-backdrop ownership', 'LOD backdrop transition measurement exact', backdropTransition?.measurement);
  check(backdropTransition.passed === true && backdropTransition.visible_sample_count === 0 && backdropTransition.projection_margin_px === 48, 'LOD active/backdrop transition outside camera view with 48px safety margin', backdropTransition);
  check(lod.backdrop_transition_visible_sample_count === 0 && lod.backdrop_transition_outside_view === true, 'LOD backdrop transition aliases exact');
  if (backdropOnly) {
    check(lod.current_lod === 'overview-backdrop', 'backdrop-only LOD current_lod exact', lod.current_lod);
    check(lod.active_tiles.length === 0 && lod.active_resolutions_m.length === 0, 'backdrop-only mode has no active LOD tile or transition');
    check(backdropTransition.sample_count === 0, 'backdrop-only mode has no active/backdrop perimeter samples');
    const expectedSpacing = expectedCase?.expected_max_resolution_m ?? lod.overview_backdrop_actual_vertex_spacing_m;
    close(lod.actual_vertex_spacing_m, expectedSpacing, 1e-6, 'backdrop-only actual overview spacing');
    close(lod.focus_actual_vertex_spacing_m, expectedSpacing, 1e-6, 'backdrop-only focus owned by overview');
    close(lod.source_actual_spacing_m, expectedSpacing, 1e-6, 'backdrop-only source ownership spacing');
    close(lod.camera_actual_vertex_spacing_m, expectedSpacing, 1e-6, 'backdrop-only camera owned by overview');
    check(lod.native_12_5m_claim_allowed === false && lod.native_12_5m_visible === false && lod.native_12_5m_focus_covered === false && lod.camera_native_12_5m_covered === false, 'backdrop-only mode makes no native claim');
    return;
  }
  check(lod.active_tiles.length > 0 && lod.active_resolutions_m.length > 0, 'active LOD tiles/resolutions non-vacuous outside backdrop-only mode');
  positive(backdropTransition.sample_count, 'active LOD/backdrop outer perimeter samples measured');
  if (expectedCase) {
    const focusSpacing = lod.focus_actual_vertex_spacing_m ?? lod.target_actual_vertex_spacing_m;
    close(focusSpacing, expectedCase.expected_max_resolution_m, 1e-6, `LOD ${expectedCase.distance_m} focus spacing`);
    close(lod.actual_vertex_spacing_m, expectedCase.expected_max_resolution_m, 1e-6, `LOD ${expectedCase.distance_m} displayed actual spacing follows active focus, not overview backdrop`);
    check(lod.active_resolutions_m.some(value => Math.abs(value - expectedCase.expected_max_resolution_m) <= 1e-6), `LOD ${expectedCase.distance_m} active focus level present`, lod.active_resolutions_m);
    check(lod.native_12_5m_claim_allowed === expectedCase.native, `LOD ${expectedCase.distance_m} native claim exact`, lod.native_12_5m_claim_allowed);
    if (expectedCase.native) {
      allTrue(lod.native_claim_checks, `LOD ${expectedCase.distance_m} native_claim_checks`);
      check(lod.source_actual_spacing_m === 12.5 || lod.actual_vertex_spacing_m === 12.5, `LOD ${expectedCase.distance_m} actual native spacing`);
      close(lod.focus_actual_vertex_spacing_m, 12.5, 0, `LOD ${expectedCase.distance_m} focus actual native spacing`);
      check(lod.native_12_5m_focus_covered === true, `LOD ${expectedCase.distance_m} focus native covered`);
      close(lod.camera_actual_vertex_spacing_m, 12.5, 0, `LOD ${expectedCase.distance_m} camera-position actual native spacing`);
      check(lod.camera_native_12_5m_covered === true, `LOD ${expectedCase.distance_m} camera-position native covered`);
    }
  }
}

function validateRuntimeSeamProbe(probe, label, activeResolutions = []) {
  check(probe?.schema === 'guilin-v072-runtime-lod-seam-probe/v2', `${label} seam probe schema v2`, probe?.schema);
  check(probe.backdrop_only === false, `${label} is an active indexed-LOD seam probe`, probe.backdrop_only);
  check(probe.passed === true, `${label} final indexed seam probe passed`);
  check(probe.measurement === 'CPU ownership and final indexed BufferGeometry half-edge graph', `${label} seam measurement exact`, probe.measurement);
  check(probe.measurement_source === 'final indexed BufferGeometry half-edge graph and decoded conservative cell masks', `${label} seam measurement source exact`, probe.measurement_source);
  check(probe.ownership_method === 'coarse covered cells omitted; coarse boundary cells retriangulated with exact fine source-vertex chains', `${label} CPU ownership method exact`, probe.ownership_method);
  check(probe.cpu_ownership_measured === true && probe.clip_ownership_measured === false, `${label} CPU ownership measured without shader-clip proxy`);
  check(typeof probe.normal_policy === 'string' && /identical.*normals.*continuous terrain normal map/i.test(probe.normal_policy), `${label} shared normal policy`, probe.normal_policy);
  positive(probe.active_transition_count, `${label} active transitions`);
  positive(probe.sample_count, `${label} actual final half-edge sample count`);
  positive(probe.expected_boundary_segment_count, `${label} expected boundary segment count`);
  check(probe.sample_count === probe.expected_boundary_segment_count, `${label} samples enumerate expected final boundary segments`);
  check(probe.shared_boundary_segment_count === probe.expected_boundary_segment_count, `${label} every expected boundary segment has incidence two`);
  for (const key of [
    'missing_boundary_segment_count', 'shared_edge_incidence_mismatch_count', 't_junction_count',
    'nonmanifold_edge_count', 'height_modified_count', 'source_vertex_height_modified_count',
    'derived_edge_split_off_segment_count', 'nodata_bridge_triangle_count',
    'unmatched_valid_transition_edge_count', 'unmatched_valid_transition_edge_length_m',
  ]) check(probe[key] === 0, `${label} ${key} must be measured zero`, probe[key]);
  check(probe.unclassified_open_edge_length_m === 0 && probe.uncovered_world_gap_maximum_m === 0, `${label} uncovered/unclassified valid seam length exactly zero`, { unclassified: probe.unclassified_open_edge_length_m, uncovered: probe.uncovered_world_gap_maximum_m });
  check(probe.positive_overlap_area_m2 === 0 && probe.visible_positive_overlap_area_m2 === 0, `${label} positive surface overlap exactly zero`, { positive: probe.positive_overlap_area_m2, visible: probe.visible_positive_overlap_area_m2 });
  integer(probe.expected_nodata_open_edge_count, `${label} classified conservative-NoData open edges`);
  check(Number.isFinite(probe.expected_nodata_open_edge_length_m) && probe.expected_nodata_open_edge_length_m >= 0, `${label} classified conservative-NoData open length`, probe.expected_nodata_open_edge_length_m);
  check((probe.expected_nodata_open_edge_count === 0) === (probe.expected_nodata_open_edge_length_m === 0), `${label} conservative-NoData open edge count/length non-vacuity agrees`, { count: probe.expected_nodata_open_edge_count, length_m: probe.expected_nodata_open_edge_length_m });
  check(probe.maximum_shared_xz_gap_m <= 1e-6, `${label} shared XZ gap <=1um`, probe.maximum_shared_xz_gap_m);
  check(probe.maximum_shared_y_gap_m <= 1e-5, `${label} shared Y gap <=10um`, probe.maximum_shared_y_gap_m);
  check(probe.maximum_duplicate_normal_angle_deg <= 0.1, `${label} duplicate normal angle <=0.1deg`, probe.maximum_duplicate_normal_angle_deg);
  check(probe.maximum_duplicate_uv_delta <= 1e-7, `${label} duplicate UV delta <=1e-7`, probe.maximum_duplicate_uv_delta);
  close(probe.maximum_gap_m, Math.max(probe.maximum_shared_xz_gap_m, probe.maximum_shared_y_gap_m), 1e-12, `${label} aggregate seam gap derives from measured XZ/Y gaps`);
  for (const alias of ['max_gap', 'max_gap_m', 'maximum_world_gap_m']) close(probe[alias], probe.maximum_gap_m, 1e-12, `${label} ${alias} agrees with maximum_gap_m`);
  check(probe.skirt_triangle_count === 0 && probe.curtain_triangle_count === 0 && probe.active_shader_clip_rect_count === 0, `${label} no skirt/curtain/shader-clip seam substitute`, { skirt: probe.skirt_triangle_count, curtain: probe.curtain_triangle_count, clip_rects: probe.active_shader_clip_rect_count });
  check(Array.isArray(probe.transitions) && probe.transitions.length === probe.active_transition_count, `${label} transition records exact`);
  for (const [index, transition] of probe.transitions.entries()) {
    const prefix = `${label}.transitions[${index}]`;
    check(transition.passed === true, `${prefix} passed`); positive(transition.sample_count, `${prefix} measured samples`);
    check(transition.t_junction_count === 0 && transition.height_modified_count === 0, `${prefix} topology/height unchanged`, transition);
    check(transition.maximum_gap_m <= 1e-5, `${prefix} maximum measured gap`, transition.maximum_gap_m);
    if (transition.type === 'same-level-final-indexed-edge') {
      check(transition.mask_mismatch_count === 0 && transition.maximum_height_difference_m === 0, `${prefix} same-level decoded edge exact`, transition);
    } else {
      check(transition.type === 'mixed-level-cpu-stitch', `${prefix} known transition type`, transition.type);
    }
  }

  const resolutions = [...new Set(activeResolutions)].sort((a, b) => a - b);
  check(resolutions.length > 0 && resolutions.every(value => Number.isFinite(value) && value > 0), `${label} active resolution input`);
  const mixedRequired = resolutions.length > 1;
  check(Array.isArray(probe.mixed_level_pairs), `${label} mixed pair records array`);
  check(probe.mixed_transition_count === probe.mixed_level_pairs.length, `${label} mixed transition count exact`);
  const transitionMixed = probe.transitions.filter(item => item.type === 'mixed-level-cpu-stitch');
  deepEqual(transitionMixed, probe.mixed_level_pairs, `${label} transition/mixed record arrays deep equal`);
  const observedPairs = new Set(); let mixedExpectedSegments = 0; let mixedSharedSegments = 0;
  for (const [index, mixed] of probe.mixed_level_pairs.entries()) {
    const prefix = `${label}.mixed_level_pairs[${index}]`;
    check(mixed.type === 'mixed-level-cpu-stitch' && mixed.passed === true, `${prefix} actual CPU stitch passed`);
    check(Number.isFinite(mixed.fine_spacing_m) && Number.isFinite(mixed.coarse_spacing_m) && mixed.fine_spacing_m < mixed.coarse_spacing_m, `${prefix} ordered fine/coarse spacing`, mixed);
    check(resolutions.includes(mixed.fine_spacing_m) && resolutions.includes(mixed.coarse_spacing_m), `${prefix} spacings are active`, { resolutions, mixed });
    check(typeof mixed.coarse_tile_id === 'string' && mixed.coarse_tile_id.length > 0 && mixed.coarse_tile === mixed.coarse_tile_id, `${prefix} coarse rendered tile identity`);
    check(Array.isArray(mixed.fine_tile_ids) && mixed.fine_tile_ids.length > 0 && mixed.fine_tile_ids.every(id => typeof id === 'string' && id.length > 0), `${prefix} fine rendered tile identities`, mixed.fine_tile_ids);
    deepEqual(mixed.fine_tiles, mixed.fine_tile_ids, `${prefix} fine tile aliases exact`);
    positive(mixed.sample_count, `${prefix} actual shared samples`);
    check(mixed.expected_boundary_segment_count === mixed.sample_count, `${prefix} expected segments/sample count exact`);
    check(mixed.shared_boundary_segment_count === mixed.expected_boundary_segment_count, `${prefix} every mixed segment shared twice`);
    for (const key of ['missing_boundary_segment_count', 'shared_edge_incidence_mismatch_count', 't_junction_count', 'nonmanifold_edge_count', 'height_modified_count']) check(mixed[key] === 0, `${prefix} ${key} zero`, mixed[key]);
    check(mixed.maximum_shared_xz_gap_m <= 1e-6 && mixed.maximum_shared_y_gap_m <= 1e-5 && mixed.maximum_gap_m <= 1e-5, `${prefix} measured XZ/Y/gap thresholds`, mixed);
    observedPairs.add(`${mixed.fine_spacing_m}->${mixed.coarse_spacing_m}`);
    mixedExpectedSegments += mixed.expected_boundary_segment_count; mixedSharedSegments += mixed.shared_boundary_segment_count;
  }
  check(probe.mixed_level_pair_count === observedPairs.size, `${label} distinct mixed level pair count exact`, { reported: probe.mixed_level_pair_count, observed: [...observedPairs] });
  if (mixedRequired) {
    positive(probe.mixed_transition_count, `${label} mixed transitions genuinely active`);
    positive(probe.mixed_level_pair_count, `${label} mixed level pairs genuinely active`);
    positive(probe.stitch_triangle_count, `${label} emitted CPU stitch triangles`);
    check(mixedExpectedSegments > 0 && mixedExpectedSegments === mixedSharedSegments, `${label} mixed expected/shared segment aggregates exact`, { mixedExpectedSegments, mixedSharedSegments });
    const expectedPairs = resolutions.slice(0, -1).map((value, index) => `${value}->${resolutions[index + 1]}`);
    for (const pair of expectedPairs) check(observedPairs.has(pair), `${label} active adjacent transition ${pair} measured`, [...observedPairs]);
    check(probe.mixed_level_pair_count >= expectedPairs.length, `${label} every active adjacent LOD pair represented`);
  } else {
    check(probe.mixed_transition_count === 0 && probe.mixed_level_pair_count === 0 && probe.stitch_triangle_count === 0, `${label} single-level case has no fabricated mixed stitch evidence`);
  }
}

function validateBackdropOnlySeamProbe(probe, label) {
  check(probe?.schema === 'guilin-v072-runtime-lod-seam-probe/v2', `${label} backdrop-only seam probe schema v2`, probe?.schema);
  check(probe.backdrop_only === true && probe.passed === true, `${label} explicit backdrop-only no-active-seam receipt`);
  check(probe.measurement_source === 'final indexed BufferGeometry half-edge graph and decoded conservative cell masks', `${label} backdrop-only measurement source exact`, probe.measurement_source);
  for (const key of [
    'active_transition_count', 'mixed_transition_count', 'sample_count', 'expected_boundary_segment_count',
    'shared_boundary_segment_count', 'missing_boundary_segment_count', 'shared_edge_incidence_mismatch_count',
    't_junction_count', 'nonmanifold_edge_count', 'height_modified_count', 'source_vertex_height_modified_count',
    'derived_edge_split_off_segment_count', 'nodata_bridge_triangle_count', 'expected_nodata_open_edge_count',
    'expected_nodata_open_edge_length_m', 'unmatched_valid_transition_edge_count',
    'unmatched_valid_transition_edge_length_m', 'unclassified_open_edge_length_m', 'positive_overlap_area_m2',
    'visible_positive_overlap_area_m2', 'maximum_shared_xz_gap_m', 'maximum_shared_y_gap_m',
    'maximum_duplicate_normal_angle_deg', 'maximum_duplicate_uv_delta', 'maximum_gap_m',
    'stitch_triangle_count', 'skirt_triangle_count', 'curtain_triangle_count', 'active_shader_clip_rect_count',
    'same_level_pair_count', 'same_level_sample_count', 'same_level_maximum_height_difference_m',
    'same_level_mask_mismatch_count', 'mixed_level_pair_count',
  ]) check(probe[key] === 0, `${label} backdrop-only ${key} exactly zero`, probe[key]);
  for (const alias of ['max_gap', 'max_gap_m', 'maximum_world_gap_m', 'uncovered_world_gap_maximum_m']) check(probe[alias] === 0, `${label} backdrop-only ${alias} exactly zero`, probe[alias]);
  check(probe.cpu_ownership_measured === true && probe.clip_ownership_measured === false, `${label} backdrop-only CPU ownership receipt semantics`);
  check(Array.isArray(probe.transitions) && probe.transitions.length === 0 && Array.isArray(probe.mixed_level_pairs) && probe.mixed_level_pairs.length === 0, `${label} backdrop-only transition arrays empty`);
}

async function setLodDistance(page, focusId, item) {
  const returned = await page.evaluate(async ({ focusId, distance_m }) => window.__XIAOGUI_QA.setLodTestDistance({ focus_id: focusId, distance_m }), { focusId, distance_m: item.distance_m });
  await waitForLodStable(page); await render(page);
  const contracts = await readContracts(page); validateLodRuntime(contracts.lod, item);
  const hud = await page.evaluate(() => ({
    current_lod: document.querySelector('#currentLodPanel')?.textContent?.trim() || null,
    actual_spacing: document.querySelector('#actualSpacingPanel')?.textContent?.trim() || null,
  }));
  check(typeof hud.current_lod === 'string' && hud.current_lod.length > 0 && typeof hud.actual_spacing === 'string' && hud.actual_spacing.length > 0, `LOD ${item.distance_m} HUD fields non-empty`, hud);
  check(hud.current_lod === contracts.lod.current_lod, `LOD ${item.distance_m} HUD current LOD exact with contract`, { hud: hud.current_lod, contract: contracts.lod.current_lod });
  const hudSpacing = Number(hud.actual_spacing.match(/\d+(?:\.\d+)?/)?.[0]);
  close(hudSpacing, contracts.lod.actual_vertex_spacing_m, 0.051, `LOD ${item.distance_m} HUD/contract actual spacing`);
  close(hudSpacing, item.expected_max_resolution_m, 0.051, `LOD ${item.distance_m} HUD threshold spacing`);
  if (item.native) check(/native12_5m|12\.5\s*m/i.test(hud.current_lod), 'native threshold HUD identifies 12.5m');
  if (item.backdrop_only) check(hud.current_lod === 'overview-backdrop', '112010m HUD is overview-only backdrop; parsed spacing is gated against the manifest contract', hud);
  if (item.native) {
    check(contracts.elevation.runtime_native_active === true, `${focusId}@${item.distance_m} elevation native active`);
    positive(contracts.elevation.source_correspondence.sample_count, `${focusId}@${item.distance_m} elevation correspondence samples`);
    check(contracts.elevation.source_correspondence.passed === true && contracts.elevation.source_correspondence.p95_error_m <= 0.001 && contracts.elevation.source_correspondence.maximum_error_m <= 0.01, `${focusId}@${item.distance_m} elevation source error limits`);
  }
  const seamProbe = await page.evaluate(() => window.__XIAOGUI_QA.probeLodSeamTopology());
  if (item.backdrop_only) validateBackdropOnlySeamProbe(seamProbe, `${focusId}@${item.distance_m}`);
  else validateRuntimeSeamProbe(seamProbe, `${focusId}@${item.distance_m}`, contracts.lod.active_resolutions_m);
  deepEqual(seamProbe, contracts.lod.runtime_seam_probe, `${focusId}@${item.distance_m} explicit probe/runtime contract deep equality`);
  const record = { focus_id: focusId, distance_m: item.distance_m, hook_receipt: returned, hud, lod: contracts.lod, actual_seam_probe: seamProbe };
  lodEvidence.threshold_matrix.push(record); lodEvidence.runtime_seam_probes.push({ focus_id: focusId, distance_m: item.distance_m, ...seamProbe });
  return record;
}

async function validateNativeNeighborhoods(page) {
  const nativeCase = LOD_CASES[0];
  for (const target of NATIVE_ACCEPTANCE_TARGETS) {
    await trustedTargetClick(page, target);
    await setLodDistance(page, target, nativeCase);
    const sample = await page.evaluate(async target => window.__XIAOGUI_QA.sampleNativeTerrainNeighborhood({ focus_id: target, radius_m: 75, step_m: 12.5 }), target);
    check(sample?.native_12_5m_only === true && sample.actual_spacing_m === 12.5, `${target} native neighborhood source`);
    positive(sample.sample_count, `${target} neighborhood sample count`);
    check(sample.valid_count + sample.nodata_count + sample.outside_count + sample.other_invalid_count === sample.sample_count, `${target} neighborhood classification exact`);
    check(sample.other_invalid_count === 0, `${target} neighborhood other invalid zero`);
    check(Array.isArray(sample.native_tile_ids) && sample.native_tile_ids.length > 0, `${target} native tile coverage`);
    if (target !== 'nodata') positive(sample.valid_count, `${target} valid native samples`);
    else positive(sample.nodata_count, 'NoData target conservative NoData samples');
    const pageShot = await capture(page, `native-acceptance-${target}-12.5m-closeup-page`);
    const canvasShot = await capture(page, `native-acceptance-${target}-12.5m-closeup-canvas`, { canvas: true });
    terrainEvidence.native_neighborhoods[target] = { ...sample, screenshots: [pageShot.item.file, canvasShot.item.file], screenshot_receipts: [pageShot.item, canvasShot.item] };
  }
}

async function validateDomainEdge(page, terrainManifest) {
  await trustedTargetClick(page, 'overview');
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setTerrainVisible(true); await window.__XIAOGUI_QA.setHydrologyVisible(false); await window.__XIAOGUI_QA.renderNow(); });
  const backdrop = await capture(page, 'domain-edge-overview-backdrop', { canvas: true });
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setTerrainVisible(false); await window.__XIAOGUI_QA.renderNow(); });
  const empty = await capture(page, 'domain-edge-overview-empty-control', { canvas: true });
  const diff = await pixelDiff(backdrop.buffer, empty.buffer); requireMaterialPixelDifference(diff, 'overview backdrop versus empty');
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setTerrainVisible(true); await window.__XIAOGUI_QA.renderNow(); });
  const probe = await page.evaluate(() => window.__XIAOGUI_QA.probeDomainEdgeCoverage());
  const contracts = await readContracts(page); const lod = contracts.lod;
  check(lod.current_lod === 'overview-backdrop' && lod.active_tile_count === 0 && lod.active_tiles.length === 0 && lod.active_resolutions_m.length === 0, 'full-domain overview screenshot uses backdrop only, with no unstitched active-LOD/backdrop boundary', lod);
  close(lod.actual_vertex_spacing_m, terrainManifest.actual_vertex_spacing_m, 1e-6, 'full-domain overview actual spacing is manifest overview spacing');
  check(lod.backdrop_transition_probe?.passed === true && lod.backdrop_transition_probe.sample_count === 0 && lod.backdrop_transition_probe.visible_sample_count === 0, 'full-domain overview has no active/backdrop transition to hide');
  check(probe.projection_method === 'camera-projected source-domain perimeter', 'domain edge projection method');
  for (const key of ['perimeter_sample_count', 'expected_in_view_sample_count', 'covered_by_native_lod_count', 'covered_by_coarse_lod_count', 'covered_by_overview_backdrop_count', 'uncovered_non_nodata_count', 'allowed_transparent_nodata_count', 'east_edge_uncovered_non_nodata_count', 'south_edge_uncovered_non_nodata_count']) integer(probe[key], `domain_edge_evidence.${key}`);
  positive(probe.perimeter_sample_count, 'domain perimeter samples'); positive(probe.expected_in_view_sample_count, 'domain in-view samples');
  check(probe.covered_by_native_lod_count + probe.covered_by_coarse_lod_count + probe.covered_by_overview_backdrop_count + probe.uncovered_non_nodata_count + probe.allowed_transparent_nodata_count === probe.expected_in_view_sample_count, 'domain edge classifications exhaust expected in-view samples');
  check(probe.uncovered_non_nodata_count === 0 && probe.east_edge_uncovered_non_nodata_count === 0 && probe.south_edge_uncovered_non_nodata_count === 0, 'all non-NoData domain edges covered');
  check(probe.screenshot === null, 'raw domain edge probe screenshot initially null');
  for (const key of ['overview_backdrop_visible', 'overview_backdrop_clipped_by_active_lod', 'overview_backdrop_clipped_to_source_domain', 'native_full_domain']) check(lod[key] === true, `LOD ${key}`);
  check(lod.overview_backdrop_native_claim_eligible === false && lod.coarse_level_full_domain_claimed === false, 'backdrop/coarse not native/full-domain claimed');
  close(lod.overview_backdrop_spacing_m, terrainManifest.actual_vertex_spacing_m, 1e-6, 'overview backdrop spacing exact');
  close(lod.overview_backdrop_actual_vertex_spacing_m, terrainManifest.actual_vertex_spacing_m, 1e-6, 'overview backdrop actual spacing exact');
  check(Math.abs(lod.overview_backdrop_spacing_m - 212.7) <= 0.5, 'overview backdrop spacing approximately 212.7m', lod.overview_backdrop_spacing_m);
  check(Array.isArray(lod.overview_backdrop_spacing_xy_m) && lod.overview_backdrop_spacing_xy_m.length === 2, 'overview backdrop XY spacing');
  check(Array.isArray(lod.overview_backdrop_bounds_world_xz) && lod.overview_backdrop_bounds_world_xz.length === 4, 'overview backdrop bounds');
  terrainEvidence.domain_edge_evidence = { ...probe, screenshot: backdrop.item.file, empty_control_screenshot: empty.item.file, pixel_difference: diff, runtime_lod: lod };
}

async function validateWireframeDiagnostic(page) {
  await setLodDistance(page, 'guilin', LOD_CASES[0]);
  const toggle = page.locator('#wireToggle'); check(await toggle.count() === 1, 'wireToggle exists');
  if (await toggle.isChecked()) await toggle.click();
  const before = await readContracts(page); check(before.render.wireframe_all_active === false || before.render.wireframe_active_material_count === 0, 'wireframe starts off');
  const offPageShot = await capture(page, 'terrain-wireframe-off-control-current-lod-page');
  const offCanvasShot = await capture(page, 'terrain-wireframe-off-control-current-lod-canvas', { canvas: true });
  await toggle.click(); check(await toggle.isChecked(), 'trusted wireToggle on'); await render(page);
  const enabled = await readContracts(page);
  positive(enabled.render.terrain_material_count, 'terrain material count');
  check(enabled.render.wireframe_all_active === true && enabled.render.wireframe_active_material_count === enabled.render.terrain_material_count, 'wireframe applied to all active terrain materials');
  const domDiagnostics = await page.evaluate(() => ({
    toggle_checked: document.querySelector('#wireToggle')?.checked,
    current_lod: document.querySelector('#currentLodPanel')?.textContent?.trim() || null,
    actual_spacing: document.querySelector('#actualSpacingPanel')?.textContent?.trim() || null,
    seam_status: document.querySelector('#seamStatus')?.textContent?.trim() || null,
  }));
  check(domDiagnostics.toggle_checked === true, 'wire diagnostic DOM toggle on');
  for (const key of ['current_lod', 'actual_spacing', 'seam_status']) check(typeof domDiagnostics[key] === 'string' && domDiagnostics[key].length > 0, `wire diagnostic DOM ${key} non-empty`, domDiagnostics);
  check(/native12_5m|12\.5\s*m/i.test(domDiagnostics.current_lod), 'wire diagnostic current LOD identifies native 12.5m', domDiagnostics.current_lod);
  check(domDiagnostics.actual_spacing.replace(/\s+/g, '').includes('12.5m'), 'wire diagnostic actual spacing contains 12.5m', domDiagnostics.actual_spacing);
  check(/pass|通过|通過/i.test(domDiagnostics.seam_status), 'wire diagnostic seam status reports pass', domDiagnostics.seam_status);
  const pageShot = await capture(page, 'terrain-wireframe-current-lod-diagnostics-page');
  const canvasShot = await capture(page, 'terrain-wireframe-current-lod-diagnostics-canvas', { canvas: true });
  const pixelDifference = await pixelDiff(offCanvasShot.buffer, canvasShot.buffer);
  requireMaterialPixelDifference(pixelDifference, 'terrain wireframe off/on');
  lodEvidence.wireframe_diagnostic = {
    dom: domDiagnostics, render: enabled.render, lod: enabled.lod,
    screenshots: [offPageShot.item.file, offCanvasShot.item.file, pageShot.item.file, canvasShot.item.file],
    screenshot_receipts: [offPageShot.item, offCanvasShot.item, pageShot.item, canvasShot.item],
    off_vs_on_pixel_difference: pixelDifference,
  };
  await toggle.click(); check(!(await toggle.isChecked()), 'trusted wireToggle restored off'); await render(page);
  const restored = await readContracts(page); check(restored.render.wireframe_all_active === false && restored.render.wireframe_active_material_count === 0, 'wireframe materials restored off');
}

function validateRoi(roi, width, height, label) {
  check(roi && Number.isFinite(roi.x) && Number.isFinite(roi.y) && Number.isFinite(roi.width) && Number.isFinite(roi.height), `${label} rectangle`);
  check(roi.width >= 8 && roi.height >= 8, `${label} materially sized`, roi);
  check(roi.x >= 0 && roi.y >= 0 && roi.x + roi.width <= width && roi.y + roi.height <= height, `${label} inside canvas`, { roi, width, height });
}

async function validateNoDataRoi(page) {
  await trustedTargetClick(page, 'nodata');
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setHydrologyVisible(false); await window.__XIAOGUI_QA.setTerrainVisible(true); await window.__XIAOGUI_QA.renderNow(); });
  const probe = await page.evaluate(() => window.__XIAOGUI_QA.probeNoDataRoi());
  check(probe?.schema === 'guilin-v072-projected-nodata-roi/v1', 'NoData ROI probe schema', probe?.schema);
  check(probe.projection_method === 'camera-projected conservative terrain cell masks', 'NoData ROI projection method', probe.projection_method);
  check(probe.conservative_cell_mask_only === true && probe.color_classification_used === false, 'NoData ROI derived from conservative masks, never screenshot color');
  const onPage = await capture(page, 'nodata-projected-roi-terrain-on-page');
  const onCanvas = await capture(page, 'nodata-projected-roi-terrain-on-canvas', { canvas: true });
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setTerrainVisible(false); await window.__XIAOGUI_QA.renderNow(); });
  const offPage = await capture(page, 'nodata-projected-roi-empty-page');
  const offCanvas = await capture(page, 'nodata-projected-roi-empty-canvas', { canvas: true });
  const size = pngDimensions(onCanvas.buffer);
  validateRoi(probe.nodata_roi, size.width, size.height, 'NoData ROI');
  validateRoi(probe.adjacent_valid_roi, size.width, size.height, 'adjacent valid ROI');
  positive(probe.nodata_roi.conservative_nodata_sample_count ?? probe.nodata_sample_count, 'NoData ROI conservative NoData samples');
  positive(probe.adjacent_valid_roi.conservative_valid_sample_count ?? probe.valid_sample_count, 'adjacent ROI conservative valid samples');
  const nodataDiff = await pixelDiff(onCanvas.buffer, offCanvas.buffer, probe.nodata_roi);
  const validDiff = await pixelDiff(onCanvas.buffer, offCanvas.buffer, probe.adjacent_valid_roi);
  check(nodataDiff.mean <= 1 && nodataDiff.p95 <= 4 && nodataDiff.fraction_gte_8 <= 0.01, 'terrain-on NoData ROI approximately empty', nodataDiff);
  check(validDiff.mean >= 2 && validDiff.p95 >= 8 && validDiff.maximum >= 16, 'adjacent valid terrain ROI materially differs from empty', validDiff);
  check(validDiff.pixels_gte_8 >= Math.max(25, Math.floor(validDiff.sample_count * 0.05)), 'adjacent valid ROI has broad material difference', validDiff);
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setTerrainVisible(true); await window.__XIAOGUI_QA.setHydrologyVisible(true); await window.__XIAOGUI_QA.renderNow(); });
  terrainEvidence.nodata_roi = {
    probe, terrain_on: [onPage.item.file, onCanvas.item.file], empty: [offPage.item.file, offCanvas.item.file],
    nodata_vs_empty: nodataDiff, adjacent_valid_vs_empty: validDiff,
  };
}

async function validateActiveCollisionRecovery(page) {
  await trustedTargetClick(page, 'guilin');
  const before = (await readContracts(page)).camera; validateCameraContract(before, 'collision.before');
  const sequenceBefore = before.collision_event?.sequence ?? 0;
  const probe = await page.evaluate(async () => window.__XIAOGUI_QA.runCollisionProbe({ requested_agl_m: -20, safe_minimum_agl_m: 12 }));
  check(probe?.schema === 'guilin-v072-active-terrain-collision-probe/v1', 'active collision probe schema', probe?.schema);
  check(probe.input_applied === true && probe.requested_agl_m < 12, 'collision probe actively applied unsafe input', probe);
  check(probe.recovered === true && probe.final_agl_m >= 12, 'collision probe recovered above 12m', probe);
  check(probe.terrain_height_source === 'active rendered terrain' || /active.*terrain/i.test(probe.terrain_height_source), 'collision probe uses active terrain height', probe.terrain_height_source);
  const after = (await readContracts(page)).camera; validateCameraContract(after, 'collision.after');
  check(after.collision_event?.sequence > sequenceBefore && after.collision_event.recovered === true, 'camera collision event increments and recovers', after.collision_event);
  check(typeof after.collision_event.type === 'string' && after.collision_event.type.length > 0, 'collision event type');
  check(after.agl_m >= 12 && after.position[1] >= after.terrain_height_m + 12 - 1e-6, 'camera physically lifted above terrain');
  cameraEvidence.collision_recovery = { before: cameraState(before), requested: probe.requested_pose ?? { requested_agl_m: probe.requested_agl_m }, probe, after: cameraState(after), collision_event: after.collision_event };
  await capture(page, 'active-terrain-collision-recovered-page');
  await capture(page, 'active-terrain-collision-recovered-canvas', { canvas: true });
}

async function setRangeTrusted(page, selector, desired) {
  const locator = page.locator(selector); check(await locator.count() === 1, `range exists ${selector}`);
  const settings = await locator.evaluate(element => ({ min: Number(element.min || 0), max: Number(element.max || 100), step: Number(element.step || 1) }));
  const steps = Math.round((desired - settings.min) / settings.step);
  close(settings.min + steps * settings.step, desired, 1e-9, `${selector} desired value aligned to step`);
  await locator.focus(); await locator.press('Home');
  for (let index = 0; index < steps; index += 1) await locator.press('ArrowRight');
  close(Number(await locator.inputValue()), desired, 1e-9, `${selector} trusted keyboard value`);
  await render(page);
}

function validateKarstContract(renderContract, value, colorRichness, label) {
  close(renderContract.karst_detail, value, 1e-6, `${label}.karst_detail`);
  check(renderContract.karst_detail_bound === true, `${label}.karst_detail_bound`);
  check(renderContract.karst_control_policy === 'dedicated' || renderContract.karst_detail_control_policy === 'dedicated', `${label}.dedicated karst policy`);
  close(renderContract.color_richness, colorRichness, 1e-9, `${label}.color richness unchanged`);
  const shader = renderContract.karst_shader_receipt ?? renderContract.karst_detail_shader;
  check(shader?.compiled === true && shader.bound === true, `${label}.karst shader compiled/bound`, shader);
  close(shader.actual_uniform_value ?? shader.uniform_value, value, 1e-6, `${label}.karst actual uniform`);
}

async function validateKarstPixelEvidence(page) {
  const levels = [{ id: 'off', value: 0 }, { id: 'default', value: 1.35 }, { id: 'enhanced', value: 2.5 }];
  for (const target of ['peaks', 'cliff', 'gully', 'yangshuo']) {
    await trustedTargetClick(page, target);
    const baselineCamera = cameraState((await readContracts(page)).camera);
    const colorRichness = (await readContracts(page)).render.color_richness;
    const levelEvidence = {};
    for (const level of levels) {
      await setRangeTrusted(page, '#karstDetail', level.value);
      const contracts = await readContracts(page);
      validateKarstContract(contracts.render, level.value, colorRichness, `${target}.${level.id}`);
      const actualCamera = cameraState(contracts.camera);
      close(vectorDistance(actualCamera.position, baselineCamera.position), 0, 1e-9, `${target}.${level.id} same camera position`);
      close(vectorDistance(actualCamera.target, baselineCamera.target), 0, 1e-9, `${target}.${level.id} same camera target`);
      close(actualCamera.distance, baselineCamera.distance, 1e-9, `${target}.${level.id} same camera distance`);
      close(vectorDistance(actualCamera.matrix_world, baselineCamera.matrix_world), 0, 1e-9, `${target}.${level.id} same matrix_world`);
      close(vectorDistance(actualCamera.projection_matrix, baselineCamera.projection_matrix), 0, 1e-9, `${target}.${level.id} same projection_matrix`);
      const pageShot = await capture(page, `karst-${target}-${level.id}-page`);
      const canvasShot = await capture(page, `karst-${target}-${level.id}-canvas`, { canvas: true });
      levelEvidence[level.id] = { value: level.value, render: contracts.render, camera: actualCamera, screenshots: [pageShot.item.file, canvasShot.item.file], buffer: canvasShot.buffer };
    }
    const offDefault = await pixelDiff(levelEvidence.off.buffer, levelEvidence.default.buffer);
    const defaultEnhanced = await pixelDiff(levelEvidence.default.buffer, levelEvidence.enhanced.buffer);
    requireMaterialPixelDifference(offDefault, `${target} karst off/default`); requireMaterialPixelDifference(defaultEnhanced, `${target} karst default/enhanced`);
    for (const item of Object.values(levelEvidence)) delete item.buffer;
    karstEvidence.viewpoints[target] = { baseline_camera: baselineCamera, levels: levelEvidence, off_vs_default: offDefault, default_vs_enhanced: defaultEnhanced };
  }
  await setRangeTrusted(page, '#karstDetail', 1.35);
}

function binaryMaskDifference(subject, background, threshold = 16) {
  check(subject.width === background.width && subject.height === background.height, 'mask source dimensions');
  const mask = new Uint8Array(subject.width * subject.height); let count = 0;
  for (let index = 0; index < mask.length; index += 1) {
    const i = index * 4;
    const delta = Math.max(Math.abs(subject.rgba[i] - background.rgba[i]), Math.abs(subject.rgba[i + 1] - background.rgba[i + 1]), Math.abs(subject.rgba[i + 2] - background.rgba[i + 2]));
    if (delta >= threshold) { mask[index] = 1; count += 1; }
  }
  return { mask, count };
}
function largestMaskComponent(mask, width, height) {
  const seen = new Uint8Array(mask.length); let largest = 0;
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    let head = 0; let tail = 0; queue[tail++] = start; seen[start] = 1;
    while (head < tail) {
      const index = queue[head++]; const x = index % width; const y = Math.floor(index / width);
      for (const candidate of [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1]) {
        if (candidate >= 0 && mask[candidate] && !seen[candidate]) { seen[candidate] = 1; queue[tail++] = candidate; }
      }
    }
    largest = Math.max(largest, tail);
  }
  return largest;
}
async function occlusionMetrics(buffers, view) {
  const [production, terrain, id, empty, reference] = await Promise.all(Object.values(buffers).map(decodePng));
  const idMask = binaryMaskDifference(id, empty, 16);
  const referenceMask = binaryMaskDifference(reference, empty, 16);
  const visibleMask = binaryMaskDifference(production, terrain, 16);
  positive(idMask.count, 'river ID mask reference pixels'); positive(referenceMask.count, 'river unoccluded reference pixels');
  check(idMask.count >= 500, 'river ID reference >=500 pixels', idMask.count);
  let missing = 0; let morphology = 0; const missingMask = new Uint8Array(idMask.mask.length);
  for (let index = 0; index < idMask.mask.length; index += 1) {
    if (idMask.mask[index] && !visibleMask.mask[index]) { missing += 1; missingMask[index] = 1; }
    if (idMask.mask[index] !== referenceMask.mask[index]) morphology += 1;
  }
  const missingFraction = missing / idMask.count; const largest = largestMaskComponent(missingMask, production.width, production.height);
  if (view === 'overhead') check(missing === 0 && largest === 0, 'overhead river has zero missing ID pixels', { missing, largest });
  else check(missingFraction <= 0.005 && largest <= 8, 'low-glancing river occlusion within fixed limits', { missingFraction, largest });
  check(morphology === 0, 'river ID/reference morphology exact', morphology);
  return { threshold: 16, reference_pixel_count: idMask.count, unoccluded_reference_pixel_count: referenceMask.count, visible_pixel_count: visibleMask.count, missing_pixel_count: missing, missing_fraction: missingFraction, largest_missing_component_pixels: largest, morphology_difference_pixels: morphology };
}

async function setRiverView(page, target, view, distance = null) {
  if (distance !== null) await setLodDistance(page, target, LOD_CASES.find(item => item.distance_m === distance));
  else await trustedTargetClick(page, target);
  const camera = (await readContracts(page)).camera;
  const targetVector = camera.target;
  const d = distance ?? Math.max(2500, camera.distance);
  const position = view === 'overhead'
    ? [targetVector[0], targetVector[1] + d, targetVector[2] + d * 0.002]
    : [targetVector[0] + d * 0.8, targetVector[1] + Math.max(30, d * 0.16), targetVector[2] + d * 0.55];
  await page.evaluate(async pose => { await window.__XIAOGUI_QA.setCameraPose(pose); await window.__XIAOGUI_QA.renderNow(); }, { position, target: targetVector });
  await waitForLodStable(page);
  validateCameraContract((await readContracts(page)).camera, `${target}.${view}.camera`);
}

async function captureRiverOcclusionCase(page, { season, target, view, distance = null }) {
  const isolatedSeasonReceipt = {};
  await clickSeason(page, season, publishedRiverRuntime, publishedRiverQa, isolatedSeasonReceipt);
  await setRiverView(page, target, view, distance);
  const slug = `river-${season}-${target}-${view}${distance ? `-${distance}` : ''}`;
  const modes = {};
  async function shot(name, terrain, hydrology, mode) {
    await page.evaluate(async ({ terrain, hydrology, mode, time }) => {
      await window.__XIAOGUI_QA.setTerrainVisible(terrain); await window.__XIAOGUI_QA.setHydrologyVisible(hydrology);
      await window.__XIAOGUI_QA.setRiverMaskMode(mode); await window.__XIAOGUI_QA.setWaterTime(time); await window.__XIAOGUI_QA.renderNow();
    }, { terrain, hydrology, mode, time: WATER_TIME });
    const captureResult = await capture(page, `${slug}-${name}`, { canvas: true }); modes[name] = captureResult;
  }
  await shot('production', true, true, 'production');
  await shot('terrain-control', true, false, 'production');
  await shot('id-mask', false, true, 'id');
  await shot('empty-control', false, false, 'production');
  await shot('unoccluded-reference', false, true, 'production');
  const metrics = await occlusionMetrics(Object.fromEntries(Object.entries(modes).map(([key, value]) => [key.replace('-control', '').replace('-mask', '').replace('unoccluded-', ''), value.buffer])), view);
  const productionVsTerrain = await pixelDiff(modes.production.buffer, modes['terrain-control'].buffer);
  requireMaterialPixelDifference(productionVsTerrain, `${slug} depth-safe river production versus terrain control`);
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setTerrainVisible(true); await window.__XIAOGUI_QA.setHydrologyVisible(true); await window.__XIAOGUI_QA.setRiverMaskMode('production'); await window.__XIAOGUI_QA.renderNow(); });
  const record = { season, target, view, distance_m: distance, season_receipt: isolatedSeasonReceipt[season], metrics, production_vs_terrain_pixel_difference: productionVsTerrain, screenshots: Object.fromEntries(Object.entries(modes).map(([key, value]) => [key, value.item.file])) };
  riverVisualEvidence.cases.push(record); return record;
}

function projectWorldPoint(camera, viewport, point) {
  const subtract = (a, b) => a.map((value, index) => value - b[index]);
  const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const normalize = value => { const length = Math.sqrt(dot(value, value)); check(length > 1e-9, 'camera projection basis non-degenerate'); return value.map(item => item / length); };
  const forward = normalize(subtract(camera.target, camera.position));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const relative = subtract(point, camera.position); const depth = dot(relative, forward);
  positive(depth, 'projected grounding bank lies in front of camera');
  const tangent = Math.tan(camera.fov_deg * Math.PI / 360); const aspect = viewport.width / viewport.height;
  const ndc = [dot(relative, right) / (depth * tangent * aspect), dot(relative, up) / (depth * tangent)];
  return { world: point, ndc, depth_m: depth, x: (ndc[0] * 0.5 + 0.5) * viewport.width, y: (-ndc[1] * 0.5 + 0.5) * viewport.height };
}

async function validateRiverGroundingCrossSlopeCloseup(page) {
  const receipt = terrainEvidence.river_grounding_cross_slope?.receipt;
  check(receipt, 'validated river-grounding cross-slope receipt available for visual evidence');
  const isolatedSeasonReceipt = {};
  await clickSeason(page, 'summer', publishedRiverRuntime, publishedRiverQa, isolatedSeasonReceipt);
  await setLodDistance(page, 'river-grounding', LOD_CASES[0]);
  const bankDx = receipt.right_bank_xz_m[0] - receipt.left_bank_xz_m[0];
  const bankDz = receipt.right_bank_xz_m[1] - receipt.left_bank_xz_m[1];
  const bankLength = Math.hypot(bankDx, bankDz); positive(bankLength, 'river-grounding bank direction length');
  const tangent = [-bankDz / bankLength, bankDx / bankLength];
  const target = [receipt.center_xz_m[0], (receipt.left_bank_terrain_height_m + receipt.right_bank_terrain_height_m) / 2 + 0.35, receipt.center_xz_m[1]];
  const position = [target[0] + tangent[0] * 420, target[1] + 160, target[2] + tangent[1] * 420];
  await page.evaluate(async pose => { await window.__XIAOGUI_QA.setCameraPose(pose); await window.__XIAOGUI_QA.renderNow(); }, { position, target });
  await waitForLodStable(page);
  const productionContracts = await readContracts(page); validateCameraContract(productionContracts.camera, 'river-grounding cross-slope close-up camera');
  validateLodRuntime(productionContracts.lod, LOD_CASES[0]);
  const canvasBox = await page.locator('#viewer canvas').boundingBox();
  check(canvasBox && canvasBox.width > 200 && canvasBox.height > 200, 'river-grounding close-up canvas dimensions');
  const viewport = { width: canvasBox.width, height: canvasBox.height };
  const leftProjection = projectWorldPoint(productionContracts.camera, viewport, [receipt.left_bank_xz_m[0], receipt.left_bank_terrain_height_m + 0.35, receipt.left_bank_xz_m[1]]);
  const rightProjection = projectWorldPoint(productionContracts.camera, viewport, [receipt.right_bank_xz_m[0], receipt.right_bank_terrain_height_m + 0.35, receipt.right_bank_xz_m[1]]);
  for (const [name, projection] of Object.entries({ left: leftProjection, right: rightProjection })) {
    check(Math.abs(projection.ndc[0]) <= 0.95 && Math.abs(projection.ndc[1]) <= 0.95, `river-grounding ${name} bank safely inside close-up viewport`, projection);
  }
  const projectedBankSpan = Math.hypot(leftProjection.x - rightProjection.x, leftProjection.y - rightProjection.y);
  const projectedBankVerticalSeparation = Math.abs(leftProjection.y - rightProjection.y);
  check(projectedBankSpan >= 80, 'river-grounding banks have independently readable projected separation >=80px', projectedBankSpan);
  check(projectedBankVerticalSeparation >= 30, 'river-grounding terrain bank height delta has readable projected vertical separation >=30px', projectedBankVerticalSeparation);

  await page.evaluate(async time => {
    await window.__XIAOGUI_QA.setTerrainVisible(true); await window.__XIAOGUI_QA.setHydrologyVisible(true);
    await window.__XIAOGUI_QA.setRiverMaskMode('production'); await window.__XIAOGUI_QA.setWaterTime(time); await window.__XIAOGUI_QA.renderNow();
  }, WATER_TIME);
  const productionPage = await capture(page, 'fixed-river-grounding-summer-cross-slope-closeup-page');
  const productionCanvas = await capture(page, 'fixed-river-grounding-summer-cross-slope-closeup-canvas', { canvas: true });
  const productionCamera = cameraState((await readContracts(page)).camera);
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setHydrologyVisible(false); await window.__XIAOGUI_QA.renderNow(); });
  const terrainPage = await capture(page, 'fixed-river-grounding-summer-cross-slope-terrain-control-page');
  const terrainCanvas = await capture(page, 'fixed-river-grounding-summer-cross-slope-terrain-control-canvas', { canvas: true });
  const terrainCamera = cameraState((await readContracts(page)).camera);
  for (const key of ['position', 'target', 'matrix_world', 'projection_matrix']) close(vectorDistance(productionCamera[key], terrainCamera[key]), 0, 1e-9, `river-grounding close-up same-camera ${key}`);
  close(productionCamera.distance, terrainCamera.distance, 1e-9, 'river-grounding close-up same-camera distance');
  const materialDifference = await pixelDiff(productionCanvas.buffer, terrainCanvas.buffer);
  requireMaterialPixelDifference(materialDifference, 'river-grounding cross-slope production versus terrain control');
  await page.evaluate(async () => { await window.__XIAOGUI_QA.setHydrologyVisible(true); await window.__XIAOGUI_QA.renderNow(); });
  riverVisualEvidence.grounding_cross_slope_closeup = {
    season: 'summer', source_receipt: receipt, camera: productionCamera,
    bank_projection: { viewport, left: leftProjection, right: rightProjection, projected_bank_span_px: projectedBankSpan, projected_bank_vertical_separation_px: projectedBankVerticalSeparation },
    same_camera_terrain_control: terrainCamera, production_vs_terrain_pixel_difference: materialDifference,
    screenshots: [productionPage.item.file, productionCanvas.item.file, terrainPage.item.file, terrainCanvas.item.file],
    screenshot_receipts: [productionPage.item, productionCanvas.item, terrainPage.item, terrainCanvas.item],
    season_receipt: isolatedSeasonReceipt.summer,
  };
}

let publishedRiverRuntime = null;
let publishedRiverQa = null;

async function validateRiverVisualEvidence(page) {
  await validateRiverGroundingCrossSlopeCloseup(page);
  for (const season of Object.keys(SEASONS)) {
    await captureRiverOcclusionCase(page, { season, target: 'river-grounding', view: 'overhead' });
    await captureRiverOcclusionCase(page, { season, target: 'river-grounding', view: 'low-glancing' });
  }
  await captureRiverOcclusionCase(page, { season: 'summer', target: 'river-turn', view: 'overhead' });
  await captureRiverOcclusionCase(page, { season: 'summer', target: 'river-turn', view: 'low-glancing' });
  await captureRiverOcclusionCase(page, { season: 'summer', target: 'river-grounding', view: 'overhead', distance: 6990 });
  await captureRiverOcclusionCase(page, { season: 'summer', target: 'river-grounding', view: 'overhead', distance: 7010 });
  await trustedTargetClick(page, 'river-turn');
  await capture(page, 'fixed-river-wide-turn-page'); await capture(page, 'fixed-river-wide-turn-canvas', { canvas: true });
}

async function validateFps(page) {
  const scheduler = await page.evaluate(async () => {
    const samples = []; let previous = performance.now();
    await new Promise(resolve => {
      const step = now => { samples.push(now - previous); previous = now; if (samples.length >= 120) resolve(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    samples.sort((a, b) => a - b);
    return { sample_count: samples.length, mean_interval_ms: samples.reduce((a, b) => a + b, 0) / samples.length, p95_interval_ms: samples[Math.ceil(samples.length * 0.95) - 1] };
  });
  const before = await readContracts(page); const framesBefore = before.performance.total_frames ?? before.performance.rendered_frame_count;
  finite(framesBefore, 'FPS initial total_frames');
  const start = Date.now(); await page.waitForTimeout(10_000); const elapsed = Date.now() - start;
  const after = await readContracts(page); const framesAfter = after.performance.total_frames ?? after.performance.rendered_frame_count;
  const delta = framesAfter - framesBefore; const actualFps = delta / (elapsed / 1000);
  check(delta > 0 && actualFps >= 20, 'real renderer FPS >=20 over fixed 10s window', { delta, elapsed, actualFps });
  check(after.performance.sample_count >= 120, 'performance contract non-vacuous samples', after.performance.sample_count);
  check(after.performance.actual_render_fps_window >= 20, 'performance contract actual render FPS >=20', after.performance.actual_render_fps_window);
  check(after.performance.actual_render_interval_mean_ms > 0 && after.performance.actual_render_interval_p95_ms <= 100, 'actual render interval limits', after.performance);
  check(after.performance.actual_render_duration_mean_ms >= 0 && after.performance.actual_render_duration_p95_ms <= 100, 'actual render duration limits', after.performance);
  positive(after.performance.requested_render_interval_ms, 'requested render interval diagnostic');
  check(after.performance.total_frames_semantics === 'increments only after renderer.render returns' || /renderer\.render.*returns/i.test(after.performance.total_frames_semantics), 'total_frames real render semantics');
  fpsEvidence.samples.push({ started_at: new Date(start).toISOString(), elapsed_ms: elapsed, total_frames_before: framesBefore, total_frames_after: framesAfter, rendered_frame_delta: delta, actual_renderer_fps: actualFps });
  fpsEvidence.result = { scheduler_diagnostic_only: scheduler, runtime_contract: after.performance, gate: { fixed_window_ms: 10_000, minimum_actual_renderer_fps: 20, passed: true } };
}

async function fixedTargetScreenshots(page) {
  for (const target of TARGETS) {
    await trustedTargetClick(page, target);
    await capture(page, `fixed-${target}-desktop-page`);
    await capture(page, `fixed-${target}-desktop-canvas`, { canvas: true });
  }
}

async function validateDesktopSeasons(page) {
  for (const season of Object.keys(SEASONS)) {
    await clickSeason(page, season, publishedRiverRuntime, publishedRiverQa, runtimeEvidence.seasons);
    const pageShot = await capture(page, `season-${season}-desktop-page`);
    const canvasShot = await capture(page, `season-${season}-desktop-canvas`, { canvas: true });
    runtimeEvidence.seasons[season].screenshots = [pageShot.item.file, canvasShot.item.file];
  }
}

async function validateMobile(page, context) {
  await validateDom(page, MOBILE);
  const initial = await readContracts(page); validateBaseContracts(initial);
  const desktopSummerBefore = JSON.stringify(runtimeEvidence.seasons.summer);
  const isolated = {};
  const mobileSeason = await clickSeason(page, 'summer', publishedRiverRuntime, publishedRiverQa, isolated);
  const mobilePageShot = await capture(page, 'mobile-390x844-summer-page');
  const mobileCanvasShot = await capture(page, 'mobile-390x844-summer-canvas', { canvas: true });
  runtimeEvidence.mobile_season = { season: 'summer', ...mobileSeason, screenshots: [mobilePageShot.item.file, mobileCanvasShot.item.file] };
  check(JSON.stringify(runtimeEvidence.seasons.summer) === desktopSummerBefore, 'mobile season evidence must not overwrite desktop summer');

  await trustedTargetClick(page, 'guilin');
  const canvas = page.locator('#viewer canvas'); const box = await canvas.boundingBox(); check(box && box.width > 100 && box.height > 100, 'mobile canvas touch box');
  const before = (await readContracts(page)).camera;
  const pinchBeforePage = await capture(page, 'mobile-two-touch-pinch-before-page');
  const pinchBeforeCanvas = await capture(page, 'mobile-two-touch-pinch-before-canvas', { canvas: true });
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const cx = box.x + box.width * 0.5; const cy = box.y + box.height * 0.55;
  const point = (id, x, y) => ({ x: Math.round(x), y: Math.round(y), radiusX: 2, radiusY: 2, force: 1, id });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(1, cx - 35, cy), point(2, cx + 35, cy)] });
  for (let step = 1; step <= 8; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(1, cx - 35 - step * 7, cy), point(2, cx + 35 + step * 7, cy)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400); await waitForLodStable(page);
  const after = (await readContracts(page)).camera;
  cameraEvidence.trusted_gestures.mobile_two_touch_pinch = assertCameraReceipt(before, after, { event_type: 'touchend', input_action: 'touch-pinch', pointer_type: 'touch', touch_count: 2 }, 'mobile two-touch pinch');
  check(Math.abs(after.distance - before.distance) > 1e-3, 'mobile pinch changes camera distance');
  cameraEvidence.trusted_gestures.mobile_two_touch_pinch.viewport = MOBILE;
  cameraEvidence.trusted_gestures.mobile_two_touch_pinch.real_mobile_context = true;
  const pinchAfter = await capture(page, 'mobile-two-touch-pinch-after-page');
  const pinchCanvas = await capture(page, 'mobile-two-touch-pinch-after-canvas', { canvas: true });
  cameraEvidence.trusted_gestures.mobile_two_touch_pinch.screenshots = [pinchBeforePage.item.file, pinchBeforeCanvas.item.file, pinchAfter.item.file, pinchCanvas.item.file];
}

async function verifyVendorAndNetwork() {
  const origin = new URL(ROOT_URL).origin;
  for (const file of VENDOR_FILES) {
    const matching = networkEvidence.vendor_resources.filter(item => new URL(item.url).pathname.endsWith(`/${file}`));
    check(matching.some(item => item.status === 200 && new URL(item.url).origin === origin), `same-origin ${file} actually HTTP 200`, matching);
  }
  check(networkEvidence.navigations.length === 2 && networkEvidence.navigations.every(item => item.status === 200), 'desktop/mobile navigations both HTTP 200', networkEvidence.navigations);
  check(networkEvidence.responses_ge_400.length === 0, 'HTTP >=400 responses zero', networkEvidence.responses_ge_400);
  check(networkEvidence.http_404.length === 0, 'HTTP 404 responses zero', networkEvidence.http_404);
  check(networkEvidence.request_failed.length === 0, 'request failures zero', networkEvidence.request_failed);
  check(consoleEvidence.errors.length === 0 && consoleEvidence.page_errors.length === 0, 'console/page errors zero', consoleEvidence);
  const external = networkEvidence.executable_resources.filter(item => new URL(item.url).origin !== origin);
  check(external.length === 0, 'no external runtime executable hosts', external);
  const displayedRiverFiles = Object.values(SEASONS).flatMap((_, index) => {
    const season = Object.keys(SEASONS)[index];
    return [`river_drape_${season}_positions.f32.gz`, `river_drape_${season}_indices.u32.gz`];
  });
  for (const file of displayedRiverFiles) {
    check(networkEvidence.displayed_river_asset_responses.some(item => item.url.endsWith(`/data/${file}`) && item.status === 200), `displayed app river binary ${file} actual HTTP 200`);
  }
  publishedAssets.vendor = VENDOR_FILES.map(file => ({ file, responses: networkEvidence.vendor_resources.filter(item => new URL(item.url).pathname.endsWith(`/${file}`)) }));
}

async function captureFailureEvidence(reason) {
  diagnostics.phase = 'failure-evidence';
  diagnostics.fatal_error = reason instanceof Error ? { message: reason.message, stack: reason.stack || null } : { message: String(reason), stack: null };
  for (const [label, page] of [['desktop', desktopPage], ['mobile', mobilePage]]) {
    if (!page || page.isClosed()) continue;
    try {
      const contracts = await readContracts(page); runtimeEvidence.final = { ...(runtimeEvidence.final || {}), [`${label}_failure`]: contracts };
    } catch (error) { runtimeEvidence.final = { ...(runtimeEvidence.final || {}), [`${label}_contract_error`]: error.message }; }
    try { await capture(page, `failure-${label}-${Date.now()}`); } catch (error) { diagnostics[`failure_${label}_screenshot_error`] = error.message; }
  }
}

async function persistEvidence() {
  diagnostics.assertion_count = assertionCount; diagnostics.finished_at = new Date().toISOString();
  const report = {
    schema: 'guilin-v072-browser-qa-report/v3', passed: diagnostics.passed, browser_mode: BROWSER_MODE,
    root_url: ROOT_URL, assertion_count: assertionCount, screenshot_count: screenshotInventory.length,
    requirements: {
      exact_desktop_viewport: DESKTOP, exact_mobile_viewport: MOBILE, minimum_screenshots: REQUIRED_SCREENSHOT_COUNT,
      fixed_screenshot_targets: TARGETS, native_acceptance_targets: NATIVE_ACCEPTANCE_TARGETS,
      console_page_request_http404_zero: diagnostics.passed, public_live_vendor_no_interception: true,
      frozen_water_time: WATER_TIME, actual_renderer_fps_gate: 20,
    },
    evidence_files: [
      'runtime-contracts.json', 'camera-interactions.json', 'elevation-nodata.json', 'lod-threshold-stitch.json',
      'fps.json', 'karst-pixel.json', 'river-visibility-occlusion.json', 'published-assets.json',
      'screenshot-inventory.json', 'browser-console.json', 'browser-network.json', 'diagnostics.json',
    ],
  };
  await mkdirs();
  await Promise.all([
    writeJson('browser-qa-report.json', report), writeJson('diagnostics.json', diagnostics),
    writeJson('runtime-contracts.json', runtimeEvidence), writeJson('camera-interactions.json', cameraEvidence),
    writeJson('elevation-nodata.json', terrainEvidence), writeJson('lod-threshold-stitch.json', lodEvidence),
    writeJson('fps.json', fpsEvidence), writeJson('karst-pixel.json', karstEvidence),
    writeJson('river-visibility-occlusion.json', riverVisualEvidence), writeJson('published-assets.json', publishedAssets),
    writeJson('screenshot-inventory.json', { minimum_required: REQUIRED_SCREENSHOT_COUNT, count: screenshotInventory.length, unique_files: new Set(screenshotInventory.map(item => item.file)).size, screenshots: screenshotInventory }),
    writeJson('browser-console.json', consoleEvidence), writeJson('browser-network.json', networkEvidence),
  ]);
  evidencePersisted = true;
}

async function closeBrowser() {
  for (const context of contexts) { try { await context.close(); } catch {} }
  if (browser) { try { await browser.close(); } catch {} }
}

async function gracefulSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true; diagnostics.signal = signal; diagnostics.passed = false;
  fatalError = new Error(`received ${signal} before browser QA completion`);
  try { await captureFailureEvidence(fatalError); await persistEvidence(); } catch (error) { process.stderr.write(`signal evidence persistence failed: ${error.stack || error}\n`); }
  await closeBrowser();
  process.exit(signal === 'SIGTERM' ? 143 : 130);
}
process.on('SIGTERM', () => { void gracefulSignal('SIGTERM'); });
process.on('SIGINT', () => { void gracefulSignal('SIGINT'); });

async function runFixtureReplay(directory) {
  const [runtimeText, qaText] = await Promise.all([
    fs.readFile(path.join(directory, 'river_drape_runtime.json'), 'utf8'),
    fs.readFile(path.join(directory, 'river_drape_qa.json'), 'utf8'),
  ]);
  const before = assertionCount;
  const runtime = JSON.parse(runtimeText); const receipt = validateRiverAssets(runtime, JSON.parse(qaText));
  const binaryReceipts = [];
  for (const asset of runtime.indexed_assets) {
    const stored = await fs.readFile(path.join(directory, asset.file));
    binaryReceipts.push({ file: asset.file, stored_bytes: stored.length, stored_sha256: sha256(stored), ...(await validateRiverBinaryBuffer(asset, stored, runtime)) });
  }
  process.stdout.write(`${JSON.stringify({
    schema: 'guilin-v072-browser-river-fixture-replay/v1', passed: true,
    fixture_directory: directory, assertions: assertionCount - before, receipt,
    binary_receipts: binaryReceipts,
  }, null, 2)}\n`);
}

async function runBrowserQa() {
  await mkdirs(); diagnostics.phase = 'launch';
  ({ chromium } = await import('playwright'));
  browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const desktopContext = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, colorScheme: 'dark' }); contexts.add(desktopContext);
  desktopPage = await desktopContext.newPage(); observePage(desktopPage, 'desktop'); desktopPage.setDefaultTimeout(120_000);
  diagnostics.phase = 'desktop-navigation';
  let response = await desktopPage.goto(ROOT_URL, { waitUntil: 'domcontentloaded', timeout: 600_000 });
  networkEvidence.navigations.push({ page: 'desktop', url: ROOT_URL, status: response?.status() ?? null });
  check(response?.status() === 200, 'desktop navigation HTTP 200'); await waitForApplication(desktopPage); await validateDom(desktopPage, DESKTOP);

  diagnostics.phase = 'published-contracts';
  const [terrainManifest, lodManifest, lodQa, riverRuntime, riverQa] = await Promise.all([
    requestJson(desktopPage, 'data/terrain_manifest.json'), requestJson(desktopPage, 'data/terrain_lod_manifest.json'),
    requestJson(desktopPage, 'data/terrain_lod_qa.json'), requestJson(desktopPage, 'data/river_drape_runtime.json'),
    requestJson(desktopPage, 'data/river_drape_qa.json'),
  ]);
  terrainEvidence.manifest = terrainManifest; terrainEvidence.lod_manifest = lodManifest; terrainEvidence.lod_qa = lodQa;
  validateTerrainManifest(terrainManifest); validateLodAssets(lodManifest, lodQa, terrainManifest);
  validateRiverAssets(riverRuntime, riverQa); publishedRiverRuntime = riverRuntime; publishedRiverQa = riverQa;
  await validatePublishedRiverBinaries(desktopPage, riverRuntime); await decodeRepresentativeLodTiles(desktopPage, lodManifest);
  runtimeEvidence.initial = await readContracts(desktopPage); validateBaseContracts(runtimeEvidence.initial); validateLodRuntime(runtimeEvidence.initial.lod);

  diagnostics.phase = 'trusted-desktop-and-fixed';
  await validateCanonicalCameras(desktopPage); await runDesktopGestures(desktopPage); await validateActiveCollisionRecovery(desktopPage);
  await validateDesktopSeasons(desktopPage); await fixedTargetScreenshots(desktopPage);

  diagnostics.phase = 'terrain-lod';
  for (const lodCase of LOD_CASES) {
    await setLodDistance(desktopPage, 'guilin', lodCase);
    await capture(desktopPage, `lod-threshold-${lodCase.distance_m}-page`);
    await capture(desktopPage, `lod-threshold-${lodCase.distance_m}-canvas`, { canvas: true });
  }
  await validateNativeNeighborhoods(desktopPage); await validateDomainEdge(desktopPage, terrainManifest);
  await validateWireframeDiagnostic(desktopPage); await validateNoDataRoi(desktopPage);

  diagnostics.phase = 'visual-evidence';
  await validateKarstPixelEvidence(desktopPage); await validateRiverVisualEvidence(desktopPage); await validateFps(desktopPage);

  diagnostics.phase = 'mobile';
  const mobileContext = await browser.newContext({ viewport: MOBILE, screen: MOBILE, deviceScaleFactor: 1, isMobile: true, hasTouch: true, colorScheme: 'dark' }); contexts.add(mobileContext);
  mobilePage = await mobileContext.newPage(); observePage(mobilePage, 'mobile'); mobilePage.setDefaultTimeout(120_000);
  response = await mobilePage.goto(ROOT_URL, { waitUntil: 'domcontentloaded', timeout: 600_000 });
  networkEvidence.navigations.push({ page: 'mobile', url: ROOT_URL, status: response?.status() ?? null });
  check(response?.status() === 200, 'mobile navigation HTTP 200'); await waitForApplication(mobilePage); await validateMobile(mobilePage, mobileContext);

  diagnostics.phase = 'final-gates';
  runtimeEvidence.final = { desktop: await readContracts(desktopPage), mobile: await readContracts(mobilePage) };
  check(screenshotInventory.length >= REQUIRED_SCREENSHOT_COUNT, `screenshot inventory >=${REQUIRED_SCREENSHOT_COUNT}`, screenshotInventory.length);
  check(new Set(screenshotInventory.map(item => item.file)).size === screenshotInventory.length, 'all screenshot filenames unique');
  check(screenshotInventory.some(item => item.width === DESKTOP.width && item.height === DESKTOP.height), 'desktop 1720x1080 screenshot evidence');
  check(screenshotInventory.some(item => item.width === MOBILE.width && item.height === MOBILE.height), 'mobile 390x844 screenshot evidence');
  await verifyVendorAndNetwork(); diagnostics.passed = true; diagnostics.phase = 'complete'; await persistEvidence();
}

const fixtureDirectory = process.env.XIAOGUI_RIVER_FIXTURE_DIR;
if (fixtureDirectory) {
  await runFixtureReplay(path.resolve(fixtureDirectory));
} else {
  let deadlineTimer;
  try {
    await Promise.race([
      runBrowserQa(),
      new Promise((_, reject) => { deadlineTimer = setTimeout(() => reject(new Error(`host deadline exceeded after ${HOST_DEADLINE_MS}ms`)), HOST_DEADLINE_MS); deadlineTimer.unref(); }),
    ]);
  } catch (error) {
    fatalError = error; diagnostics.passed = false;
    try { await captureFailureEvidence(error); } catch (captureError) { diagnostics.failure_capture_error = captureError.message; }
    try { await persistEvidence(); } catch (persistError) { process.stderr.write(`failure evidence persistence failed: ${persistError.stack || persistError}\n`); }
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
    if (!evidencePersisted) { try { await persistEvidence(); } catch {} }
    await closeBrowser();
  }
  if (fatalError) {
    process.stderr.write(`${fatalError.stack || fatalError}\n`); process.exitCode = 1;
  } else {
    process.stdout.write(`OK: ${assertionCount} assertions, ${screenshotInventory.length} screenshots, strict river v2/domain-edge/terrain/interaction QA passed.\n`);
  }
}
