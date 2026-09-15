import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sources = [
  ['gles-3.0.6', 'https://raw.githubusercontent.com/KhronosGroup/OpenGL-Registry/1cdd228e34966dd6b95bd203e9f84faba0f371a1/specs/es/3.0/es_spec_3.0.pdf'],
  ['gles-ext-color-buffer-float', 'https://raw.githubusercontent.com/KhronosGroup/OpenGL-Registry/1cdd228e34966dd6b95bd203e9f84faba0f371a1/extensions/EXT/EXT_color_buffer_float.txt'],
  ['gles-ext-float-blend', 'https://raw.githubusercontent.com/KhronosGroup/OpenGL-Registry/1cdd228e34966dd6b95bd203e9f84faba0f371a1/extensions/EXT/EXT_float_blend.txt'],
  ['webgl-ext-color-buffer-float', 'https://raw.githubusercontent.com/KhronosGroup/WebGL/714857a28445e8f5d8d6ae1c78498578009534d8/extensions/EXT_color_buffer_float/extension.xml'],
  ['webgl-ext-float-blend', 'https://raw.githubusercontent.com/KhronosGroup/WebGL/714857a28445e8f5d8d6ae1c78498578009534d8/extensions/EXT_float_blend/extension.xml'],
  ['webgl-2.0.0', 'https://raw.githubusercontent.com/KhronosGroup/WebGL/714857a28445e8f5d8d6ae1c78498578009534d8/specs/2.0.0/index.html'],
  ['webgl-conformance-fbo-render', 'https://raw.githubusercontent.com/KhronosGroup/WebGL/714857a28445e8f5d8d6ae1c78498578009534d8/conformance-suites/2.0.0/deqp/functional/gles3/es3fFboRenderTest.js']
];

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fetched = {};
for (const [id, url] of sources) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${id} fetch failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  fetched[id] = { id, url, bytes, byteLength: bytes.length, sha256: sha256(bytes) };
}

const temp = mkdtempSync(join(tmpdir(), 'kaopu-r86-'));
let esText;
try {
  const pdfPath = join(temp, 'es_spec_3.0.pdf');
  const txtPath = join(temp, 'es_spec_3.0.txt');
  writeFileSync(pdfPath, fetched['gles-3.0.6'].bytes);
  execFileSync('pdftotext', ['-raw', pdfPath, txtPath], { stdio: 'pipe' });
  esText = readFileSync(txtPath, 'utf8').replace(/\s+/g, ' ');
} finally {
  rmSync(temp, { recursive: true, force: true });
}

const text = id => fetched[id].bytes.toString('utf8');
const colorExt = text('gles-ext-color-buffer-float');
const floatBlendExt = text('gles-ext-float-blend');
const webglColorExt = text('webgl-ext-color-buffer-float');
const webglFloatBlend = text('webgl-ext-float-blend');
const webgl2 = text('webgl-2.0.0');
const conformance = text('webgl-conformance-fbo-render');

const checks = {
  coreLeavesOtherOperationDetailsUnspecified:
    esText.includes('the details of how operations on them are performed, is not specified'),
  coreAllowsPixelVariationAcrossImplementations:
    esText.includes('two distinct GL implementations may not agree pixel for pixel'),
  coreDefinesHalfRepresentation:
    esText.includes('A 16-bit floating-point number has a 1-bit sign'),
  blendPrecisionFloorIsDestinationPrecision:
    esText.includes('precision and dynamic range no lower than that used to represent destination components'),
  blendEquationHasSourceOverTerms:
    esText.includes('ONE_MINUS_SRC_ALPHA') && esText.includes('FUNC_ADD'),
  colorBufferFloatAddsFloatingPointBlendApplicability:
    colorExt.includes('Blending applies only if the color buffer has a fixed-point or') &&
    colorExt.includes('floating-point format'),
  nativeColorBufferFloatAddsNoPrecisionTerm:
    !/\bprecision\b/i.test(colorExt) && !/\bround(?:ing|ed)?\b/i.test(colorExt),
  floatBlendIs32BitEnablement:
    floatBlendExt.includes('allow support for blending with 32-bit floating-point color') &&
    floatBlendExt.includes('New Procedures and Functions') &&
    floatBlendExt.includes('None'),
  nativeFloatBlendAddsNoPrecisionTerm:
    !/\bprecision\b/i.test(floatBlendExt) && !/\bround(?:ing|ed)?\b/i.test(floatBlendExt),
  webglColorExtensionExposesRGBA16F:
    webglColorExt.includes('RGBA16F') && webglColorExt.includes('color-renderable'),
  webglFloatBlendMirrorsNativeAndOnlyEnables32Bit:
    webglFloatBlend.includes('name="EXT_float_blend"') &&
    webglFloatBlend.includes('32-bit floating-point components') &&
    !/\bprecision\b/i.test(webglFloatBlend) && !/\bround(?:ing|ed)?\b/i.test(webglFloatBlend),
  stableWebgl2DerivesFromES3:
    webgl2.includes('OpenGL ES 3.0') && webgl2.includes('WebGL 2.0'),
  officialConformanceUsesNonzeroThreshold:
    conformance.includes('[12, 12, 12, 12]') &&
    conformance.includes('bilinearCompare'),
  officialConformanceIncludesRGBA16F:
    conformance.includes('case gl.RGBA16F:')
};

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const result = {
  schema: 'kaopu-gaussian-blend-spec-contract-result/r86',
  status: failedChecks.length === 0 ? 'Observation: source-contract audit passed' : 'Candidate: source-contract audit incomplete',
  observedAt: new Date().toISOString(),
  sourceTransportCorrection: 'Two registry.khronos.org runner fetches failed before evidence collection (403); the audit uses commit-pinned files from KhronosGroup official GitHub repositories in the same standards lineage.',
  sourceReceipts: Object.fromEntries(Object.entries(fetched).map(([id, item]) => [id, {
    url: item.url,
    byteLength: item.byteLength,
    sha256: item.sha256
  }])),
  checks,
  failedChecks,
  boundedTermAudit: {
    nativeColorBufferFloatPrecisionOrRoundingTerms: [...colorExt.matchAll(/\b(?:precision|rounding|rounded)\b/gi)].length,
    nativeFloatBlendPrecisionOrRoundingTerms: [...floatBlendExt.matchAll(/\b(?:precision|rounding|rounded)\b/gi)].length,
    limitation: 'Term absence is supporting evidence only; the positive core clauses control the decision.'
  },
  decision: failedChecks.length === 0 ? {
    r85F32StagedNormativelyRequired: false,
    currentBestView: 'R85 f32-staged remains an empirical input/output-equivalent model for its locked runtime root.',
    reason: 'Normative sources set equations and a destination-precision floor but leave otherwise-unspecified operation representation/details open; the extensions add renderability or enablement without fixing staging.',
    hardwareReplayMeaning: 'A different hardware-backed WebGL result is a new runtime Observation Root, not a conformance proof of the R85 bit pattern.',
    cacheImplication: 'Bit-exact replay/cache authorization must remain bound to backend, driver/runtime, blend path and output format.'
  } : null,
  evidenceRoots: {
    normativeKhronos: ['gles-3.0.6', 'gles-ext-color-buffer-float', 'gles-ext-float-blend', 'webgl-ext-color-buffer-float', 'webgl-ext-float-blend', 'webgl-2.0.0'],
    nonNormativeKhronosRepository: ['webgl-conformance-fbo-render'],
    independenceNote: 'These sources are one Khronos standards lineage; repository execution policy is not an independent normative root.'
  }
};

const outputPath = process.argv[2] ?? 'gaussian_blend_spec_contract_result_r86.json';
writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
if (failedChecks.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
