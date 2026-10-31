import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root = path.resolve(process.argv[2] || '.');
const packageVersion = process.argv[3] || 'UNKNOWN';
const packageSha256 = process.argv[4] || 'UNKNOWN';
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const exists = p => fs.existsSync(path.join(root, p));
const manifest = JSON.parse(read('CHECKPOINT_MANIFEST.json'));
const manifestFiles = manifest.files || {};
const index = read('runtime/gpu-experiment/index.mjs');
const builder = read('checkpoint_tools/build_private_checkpoint.py');
const ownerTest = read('tests/gpu-experiment/run.mjs');
const independentTest = read('tests/gpu-independent/run.mjs');
const gpuReadme = read('runtime/gpu-experiment/README.md');
const shaderRef = index.match(/fetch\(new URL\(['"](.+?)["'],\s*import\.meta\.url\)\)/)?.[1];
const shaderPath = path.posix.join('runtime/gpu-experiment', shaderRef?.replace(/^\.\//, '') || 'UNKNOWN');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out;
}
const inventory = walk(root);
const taskAnchorFiles = inventory.filter(p => /(^|\/)(TASK_ANCHOR|DELIVERY_RECEIPT)([^/]*)$/i.test(path.posix.basename(p)));
const closureCheckerFiles = inventory.filter(p => /resource[-_ ]?closure|executable[-_ ]?closure/i.test(p));
const observed = [];
const observe = (name, fn) => {
  try { fn(); observed.push({name, pass: true}); }
  catch (error) { observed.push({name, pass: false, detail: error.message}); }
};

observe('package version is current v24', () => assert.equal(packageVersion, '24'));
observe('package digest is pinned', () => assert.match(packageSha256, /^[0-9a-f]{64}$/));
observe('GPU host still references compute.wgsl', () => assert.equal(shaderRef, './compute.wgsl'));
observe('repair item 1 unresolved: checkpoint allowlist still omits .wgsl', () => assert.doesNotMatch(builder, /TEXT_CODE\s*=\s*\{[^}]*'\.wgsl'/s));
observe('repair item 2 unresolved: shader absent from delivered archive', () => assert.equal(exists(shaderPath), false));
observe('repair item 2 unresolved: shader absent from manifest', () => assert.equal(Object.hasOwn(manifestFiles, shaderPath), false));
observe('repair item 3 unresolved: no executable-resource closure checker delivered', () => assert.deepEqual(closureCheckerFiles, []));
observe('repair item 4 unresolved: owner test reports no shader compilation', () => assert.match(ownerTest, /gpuExecuted:false,shaderCompiled:false/));
observe('repair item 4 unresolved: independent test substitutes fetch bytes', () => assert.match(independentTest, /fetch:async\(\)=>\(\{ok:true,text:async\(\)=>''\}\)/));
observe('repair item 5 remains honestly unverified', () => assert.match(gpuReadme, /WGSL has NOT been compiled or\s*executed on an actual adapter/i));
observe('R2 execution receipts are not present in the package', () => assert.deepEqual(taskAnchorFiles, []));

const failures = observed.filter(x => !x.pass);
const result = {
  id: 'N224',
  status: failures.length ? 'PROBE_ERROR' : 'PASS',
  decision: failures.length ? 'UNKNOWN' : 'KEEP_ROOT_CAUSE_REVIEW_V24_RESOURCE_CLOSURE_UNRESOLVED',
  subject: {
    libraryIdentity: 'libfile_76004f2c53d08191906a035a2ef295ad',
    packageName: 'KAOPU_VEHICLE_FUNCTION_REBUILD_R01_PRIVATE.zip',
    packageVersion,
    packageSha256,
    packageManifestCreatedUTC: manifest.createdUTC
  },
  boundedQuestion: 'After N223 was acknowledged and moved to ROOT_CAUSE_REVIEW, does current package v24 satisfy the five named repair items?',
  repairContract: {
    wgslAllowlisted: false,
    shaderDeliveredAndPinned: false,
    transitiveClosureCheckerDelivered: false,
    nonSubstitutingDeliveredShaderLoadTest: false,
    realShaderCompileOrDeviceExecution: false,
    r2TaskAnchorAndDeliveryReceiptPresent: false
  },
  evidence: {
    shaderReference: shaderRef,
    shaderPath,
    shaderExists: exists(shaderPath),
    shaderManifestPinned: Object.hasOwn(manifestFiles, shaderPath),
    closureCheckerFiles,
    taskAnchorFiles,
    ownerTestState: 'CPU_AND_FAILCLOSED_ONLY_PASS; gpuExecuted=false; shaderCompiled=false',
    independentTestState: 'CPU_MOCK_ONLY_PASS; fetch substituted; gpuExecuted=false; shaderCompiled=false'
  },
  checksPassed: observed.length - failures.length,
  checksTotal: observed.length,
  checks: observed,
  interpretation: 'The v24 archive is fresh but does not implement the acknowledged root-cause repair contract. Fresh package timestamps and additional unrelated files cannot advance the WebGPU route state.',
  regressionAction: 'Update evidence on CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001; do not create a duplicate case.',
  state: {
    posted: true,
    acknowledged: true,
    rootCauseReview: true,
    productionImplemented: false,
    gpuRuntimeGateRun: false,
    adopted: false,
    userAccepted: false
  }
};
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
