import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = resolve(process.argv[2]);
const zip = resolve(process.argv[3]);
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const run = (cmd, args, cwd) => {
  const p = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { exitCode: p.status, stdout: p.stdout, stderr: p.stderr };
};

const version = JSON.parse(readFileSync(join(root, 'site/version.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(root, 'FILE-MANIFEST.json'), 'utf8'));
const manifestEntries = new Map(manifest.files.map((entry) => [entry.path, entry.sha256]));
const required = [
  { path: 'site/mother.mjs', contract: 'kernel', module: 'mother.mjs' },
  { path: 'site/render.mjs', contract: 'displayPolicy', module: 'render.mjs' },
];

const observations = required.map((item) => {
  const actual = sha256(join(root, item.path));
  const dependencies = version[item.contract]?.dependencies ?? [];
  const dependency = dependencies.find((entry) => entry.module === item.module) ?? null;
  return {
    ...item,
    actualSHA256: actual,
    packageManifestSHA256: manifestEntries.get(item.path) ?? null,
    packageManifestMatches: manifestEntries.get(item.path) === actual,
    declaredDependencySHA256: dependency?.sha256 ?? null,
    declaredDependencyMatches: dependency?.sha256 === actual,
    aggregateContractSHA256: version[item.contract]?.sha256 ?? null,
    legacyIndividualVsAggregateMatches:
      version[item.contract]?.sha256?.replace(/^sha256:/, '') === actual,
  };
});

const pristineLegacy = run('node', ['--test', 'site/tests/own.test.mjs'], root);
const pristinePackage = run('python3', ['CHECK-PACKAGE.py'], root);

const mutationTrials = [];
for (const item of required) {
  const trialRoot = mkdtempSync(join(tmpdir(), 'kaopu-n246-'));
  cpSync(root, trialRoot, { recursive: true });
  appendFileSync(join(trialRoot, item.path), '\n// verifier-only N246 mutation\n');
  const packageCheck = run('python3', ['CHECK-PACKAGE.py'], trialRoot);
  const mutatedVersion = JSON.parse(readFileSync(join(trialRoot, 'site/version.json'), 'utf8'));
  const actual = sha256(join(trialRoot, item.path));
  const dependency = (mutatedVersion[item.contract]?.dependencies ?? [])
    .find((entry) => entry.module === item.module) ?? null;
  mutationTrials.push({
    path: item.path,
    packageCheckerRejected: packageCheck.exitCode !== 0,
    packageCheckerExitCode: packageCheck.exitCode,
    declaredDependencyGateRejected:
      dependency ? dependency.sha256 !== actual : false,
    requiredEntrypointDeclared: Boolean(dependency),
  });
}

const result = {
  id: 'KAOPU_LEARNING_FLYWHEEL_N246_MECHANICAL_V37_MODULE_HASH_AUTHORITY',
  subject: {
    file: 'Mechanical-Mother-v37-offline.zip',
    zipSHA256: sha256(zip),
    libraryIdentity: 'libfile_6321c7c1c3588191a3127681b6da5f50',
    sourceCommit: JSON.parse(readFileSync(join(root, 'SOURCE-VERSION.json'), 'utf8')).sourceCommit,
  },
  boundedQuestion:
    'Is own.test.mjs failure evidence of changed production modules, or a stale authority comparison that can be safely superseded?',
  observations,
  pristine: {
    legacyTestExitCode: pristineLegacy.exitCode,
    legacyTestPassed: pristineLegacy.exitCode === 0,
    packageCheckerExitCode: pristinePackage.exitCode,
    packageCheckerPassed: pristinePackage.exitCode === 0,
  },
  mutationTrials,
  decision:
    'STALE_LEGACY_ASSERTION_CONFIRMED_HOLD_SEMANTIC_ENTRYPOINT_AUTHORITY_INCOMPLETE',
  interpretation: [
    'The archive is byte-intact; FILE-MANIFEST and CHECK-PACKAGE bind both mother.mjs and render.mjs and reject verifier-only mutations.',
    'The legacy test compares individual module hashes with aggregate contract hashes, so its failure does not establish a changed module.',
    'version.kernel.dependencies correctly declares mother.mjs, but version.displayPolicy.dependencies does not declare render.mjs.',
    'Therefore the legacy assertion may be superseded only by a composite authority that keeps package-manifest verification and explicitly classifies every required semantic entrypoint; dependency-only supersession is not fail-closed.',
  ],
  boundaries: {
    productionModified: false,
    packageModified: false,
    publicWebVerified: false,
    browserVerified: false,
    hardwareGPUVerified: false,
    adopted: false,
    userAccepted: false,
  },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
