import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.resolve(process.argv[2] || '.');
const packageSha256 = process.argv[3] || 'UNKNOWN';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const exists = p => fs.existsSync(path.join(root, p));
const sha = p => createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const manifest = JSON.parse(read('CHECKPOINT_MANIFEST.json'));
const files = manifest.files || {};
const checks = [];
const check = (name, fn) => {
  try { fn(); checks.push({name, pass: true}); }
  catch (error) { checks.push({name, pass: false, detail: error.message}); }
};

const gpuIndex = read('runtime/gpu-experiment/index.mjs');
const gpuReadme = read('runtime/gpu-experiment/README.md');
const preview = read('preview/index.html');
const checkpointBuilder = read('checkpoint_tools/build_private_checkpoint.py');
const ownerTest = read('tests/gpu-experiment/run.mjs');
const independentTest = read('tests/gpu-independent/run.mjs');
const review = read('tests/gpu-independent/REVIEW.md');
const shaderRef = gpuIndex.match(/fetch\(new URL\(['"](.+?)["'],\s*import\.meta\.url\)\)/)?.[1];
assert.equal(shaderRef, './compute.wgsl', 'expected the bounded GPU experiment shader reference');
const shaderPath = path.posix.join('runtime/gpu-experiment', shaderRef.slice(2));

check('package hash is pinned', () => assert.match(packageSha256, /^[0-9a-f]{64}$/));
check('checkpoint manifest is present', () => assert.ok(exists('CHECKPOINT_MANIFEST.json')));
check('GPU host entry is present and pinned', () => {
  assert.ok(exists('runtime/gpu-experiment/index.mjs'));
  assert.equal(files['runtime/gpu-experiment/index.mjs'], sha('runtime/gpu-experiment/index.mjs'));
});
check('GPU host declares a relative shader fetch', () => assert.equal(shaderRef, './compute.wgsl'));
check('referenced WGSL shader is absent', () => assert.equal(exists(shaderPath), false));
check('referenced WGSL shader is absent from manifest', () => assert.equal(Object.hasOwn(files, shaderPath), false));
check('checkpoint suffix policy excludes WGSL', () => {
  assert.match(checkpointBuilder, /TEXT_CODE\s*=\s*\{[^}]*'\.mjs'/s);
  assert.doesNotMatch(checkpointBuilder, /TEXT_CODE\s*=\s*\{[^}]*'\.wgsl'/s);
});
check('GPU README says real shader execution was not run', () => assert.match(gpuReadme, /WGSL has NOT been compiled or\s*executed on an actual adapter/i));
check('GPU README limits scope away from current car bundles', () => assert.match(gpuReadme, /does \*\*not\*\* support\s*current wheel\/glass\/car bundles/i));
check('current preview explicitly paints CPU Canvas2D', () => {
  assert.match(preview, /getContext\('2d'\)/);
  assert.match(preview, /putImageData/);
  assert.match(preview, /显示：CPU Canvas2D/);
});
check('owner test can stop before shader fetch', () => {
  assert.match(ownerTest, /requestAdapter:async\(\)=>null/);
  assert.match(ownerTest, /gpuExecuted:false,shaderCompiled:false/);
});
check('independent mock replaces fetch and does not load packaged WGSL', () => {
  assert.match(independentTest, /fetch:async\(\)=>\(\{ok:true,text:async\(\)=>''\}\)/);
  assert.match(independentTest, /GPU_MOCK|CPU_MOCK_ONLY_PASS/);
});
check('independent review records a shader hash not delivered by checkpoint', () => {
  assert.match(review, /compute\.wgsl\s+[0-9a-f]{64}/);
  assert.equal(exists(shaderPath), false);
});

const failures = checks.filter(x => !x.pass);
const result = {
  id: 'N223',
  status: failures.length ? 'PROBE_ERROR' : 'PASS',
  decision: failures.length ? 'UNKNOWN' : 'HOLD_VEHICLE_WEBGPU_ROUTE_DELIVERY_RESOURCE_CLOSURE_FAILED',
  packageSha256,
  packageManifestCreatedUTC: manifest.createdUTC,
  boundedQuestion: 'Does the current private Vehicle checkpoint contain a runnable, manifest-pinned WebGPU compute route rather than only CPU/mock evidence?',
  evidence: {
    gpuHostEntry: 'runtime/gpu-experiment/index.mjs',
    shaderReference: shaderRef,
    resolvedShaderPath: shaderPath,
    shaderExists: exists(shaderPath),
    shaderManifestPinned: Object.hasOwn(files, shaderPath),
    productionPreviewBackend: 'CPU Canvas2D',
    gpuExperimentScope: 'self-authored plane/biquadratic fixtures only; current vehicle bundles unsupported',
    ownerAndIndependentSuites: 'CPU/fail-closed and CPU/mock only; no packaged shader compilation or GPU execution'
  },
  checksPassed: checks.length - failures.length,
  checksTotal: checks.length,
  checks,
  interpretation: 'The package preserves genuine function-geometry and CPU-renderer work, but its delivered WebGPU experiment is not executable because a transitive shader resource is absent. Manifest hash verification proves captured-byte integrity, not executable dependency closure.',
  candidateGate: 'Before a delivery may claim a runnable route, every statically referenced runtime resource must exist, be manifest-pinned, and be exercised without a mock that replaces the resource load.',
  adoption: 'CANDIDATE_ONLY_NOT_ACKNOWLEDGED_NOT_ADOPTED'
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
