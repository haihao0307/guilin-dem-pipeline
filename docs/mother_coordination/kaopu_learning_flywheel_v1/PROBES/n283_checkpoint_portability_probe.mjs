import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.resolve(process.argv[2] || '.');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'CHECKSUMS.json'), 'utf8'));
const checksumResults = manifest.map(entry => {
  const target = path.join(root, entry.path);
  const bytes = fs.readFileSync(target);
  return {
    path: entry.path,
    bytesMatch: bytes.length === entry.bytes,
    sha256Match: crypto.createHash('sha256').update(bytes).digest('hex') === entry.sha256,
  };
});

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const sourceFiles = walk(root).filter(p => p.endsWith('.mjs'));
const missing = [];
const seen = new Set();
const relRe = /['"]((?:\.\.\/|\.\/)[^'"]+)['"]/g;
for (const source of sourceFiles) {
  const text = fs.readFileSync(source, 'utf8');
  for (const match of text.matchAll(relRe)) {
    const spec = match[1];
    if (!/\.(?:mjs|js|json)$/.test(spec)) continue;
    const resolved = path.resolve(path.dirname(source), spec);
    if (!fs.existsSync(resolved)) {
      const key = path.relative(root, resolved);
      if (!seen.has(key)) {
        seen.add(key);
        missing.push(key);
      }
    }
  }
}

function run(args) {
  const p = spawnSync(process.execPath, args, {cwd: root, encoding: 'utf8'});
  return {
    command: [process.execPath, ...args].join(' '),
    exitCode: p.status,
    passed: p.status === 0,
    summary: (p.stdout + p.stderr).trim().split('\n').slice(-14),
  };
}

const selfContained = run(['--test',
  'zx5a-undercarriage-r01/track-path.test.mjs',
  'zx5a-undercarriage-r01/closed-chain.test.mjs',
]);
const representativeWholeDependency = run(['--test',
  'zx5a-undercarriage-r01/underbody.test.mjs',
]);

const result = {
  subject: 'zx85usb-5a-functional-whole-checkpoint-20261113-r01.zip',
  manifestEntries: manifest.length,
  manifestAllMatch: checksumResults.every(x => x.bytesMatch && x.sha256Match),
  checksumFailures: checksumResults.filter(x => !x.bytesMatch || !x.sha256Match),
  sourceFiles: sourceFiles.length,
  missingRelativeDependencies: missing.length,
  missingDependencyExamples: missing.slice(0, 20),
  selfContainedTests: selfContained,
  representativeWholeDependencyTest: representativeWholeDependency,
  checkpointClaims: {
    unpublishedResearchSource: true,
    finishedMachine: false,
    browserOrHardwareAccepted: false,
    originalSceneReferenceIncluded: false,
    exactFrontV201AndRegistryDependenciesIncluded: false,
  },
  decision: missing.length === 0 && representativeWholeDependency.passed
    ? 'PORTABLE_METHOD_BASELINE_CANDIDATE'
    : 'HOLD_ASSET_CHECKPOINT_NOT_PORTABLE_METHOD_BASELINE',
};

console.log(JSON.stringify(result, null, 2));
