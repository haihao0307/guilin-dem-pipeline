import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const workspace = dirname(here);
const nodeBin = process.execPath;
const pythonBin = '/usr/bin/python3';
const gccBin = '/usr/bin/gcc';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspace,
    encoding: 'utf8',
    timeout: 20_000,
  });
  return {
    command: [command, ...args],
    status: result.status,
    signal: result.signal,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
    error: result.error?.message ?? null,
  };
};

const root = await mkdtemp(join(tmpdir(), 'n261-input-root-'));
const declaredRoot = join(root, 'declared');
const ambientRoot = join(root, 'ambient');
await mkdir(declaredRoot, { recursive: true });
await mkdir(ambientRoot, { recursive: true });

const declaredBytes = 'declared-r136-fixture\n';
const ambientBytes = 'ambient-host-authority\n';
const declaredFile = join(declaredRoot, 'input.txt');
const ambientFile = join(ambientRoot, 'secret.txt');
await writeFile(declaredFile, declaredBytes);
await writeFile(ambientFile, ambientBytes);

const nodeReader = join(declaredRoot, 'node-reader.mjs');
const shaderReader = join(declaredRoot, 'shader-tool.mjs');
const pythonReader = join(declaredRoot, 'python_reader.py');
const injectedStaticImport = join(declaredRoot, 'injected-static-import.mjs');
const ambientModule = join(ambientRoot, 'ambient.mjs');

await writeFile(nodeReader, "import {readFile} from 'node:fs/promises';\nprocess.stdout.write(await readFile(process.argv[2], 'utf8'));\n");
await writeFile(shaderReader, "import {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nconst b=await readFile(process.argv[2]);\nprocess.stdout.write(createHash('sha256').update(b).digest('hex'));\n");
await writeFile(pythonReader, "from pathlib import Path\nimport sys\nsys.stdout.write(Path(sys.argv[1]).read_text())\n");
await writeFile(ambientModule, "export const origin = 'ambient-static-import';\n");
await writeFile(injectedStaticImport, `import {origin} from ${JSON.stringify(pathToFileURL(ambientModule).href)};\nprocess.stdout.write(origin);\n`);

const manifest = {
  algorithm: 'sha256',
  files: {
    'input.txt': sha256(declaredBytes),
    'node-reader.mjs': sha256(await readFile(nodeReader)),
    'shader-tool.mjs': sha256(await readFile(shaderReader)),
    'python_reader.py': sha256(await readFile(pythonReader)),
  },
};

async function verifyManifest(manifestObject, inputRoot) {
  const failures = [];
  for (const [relativePath, expected] of Object.entries(manifestObject.files)) {
    try {
      const bytes = await readFile(join(inputRoot, relativePath));
      const actual = sha256(bytes);
      if (actual !== expected) failures.push({ relativePath, expected, actual, reason: 'DIGEST_MISMATCH' });
    } catch (error) {
      failures.push({ relativePath, expected, actual: null, reason: error.code ?? 'READ_ERROR' });
    }
  }
  return { pass: failures.length === 0, failures };
}

const positiveManifest = await verifyManifest(manifest, declaredRoot);
const missingManifest = structuredClone(manifest);
missingManifest.files['missing.wgsl'] = sha256('expected-but-missing');
const missingControl = await verifyManifest(missingManifest, declaredRoot);
await writeFile(declaredFile, 'tampered-r136-fixture\n');
const tamperedControl = await verifyManifest(manifest, declaredRoot);
await writeFile(declaredFile, declaredBytes);

const unisolated = {
  nodeDeclared: run(nodeBin, [nodeReader, declaredFile]),
  pythonDeclared: run(pythonBin, [pythonReader, declaredFile]),
  shaderDeclared: run(nodeBin, [shaderReader, declaredFile]),
  nodeAmbientByPath: run(nodeBin, [nodeReader, ambientFile]),
  pythonAmbientByPath: run(pythonBin, [pythonReader, ambientFile]),
  shaderAmbientByPath: run(nodeBin, [shaderReader, ambientFile]),
  nodeAmbientStaticImport: run(nodeBin, [injectedStaticImport]),
};

const landlockBinary = join(root, 'landlock_exec_n261');
const landlockCompile = run(gccBin, ['-O2', '-Wall', '-Wextra', '-o', landlockBinary, join(here, 'landlock_exec_n261.c')]);
const landlockAbi = landlockCompile.status === 0 ? run(landlockBinary, ['--abi']) : null;
const bwrap = run('/usr/bin/bwrap', [
  '--die-with-parent', '--unshare-user', '--unshare-net', '--dev', '/dev',
  '--ro-bind', '/usr', '/usr', '--ro-bind', '/bin', '/bin',
  '--ro-bind', '/lib', '/lib', '--ro-bind', '/lib64', '/lib64',
  '--ro-bind', '/opt', '/opt', '--tmpfs', '/tmp', '--chdir', '/tmp',
  '/bin/sh', '-c', 'printf sandbox-ok',
]);
const unshare = run('/usr/bin/unshare', ['--user', '--mount', '--map-root-user', '/bin/true']);
const strace = run('/usr/bin/strace', ['-f', '-e', 'trace=%file', '/bin/true']);
const chroot = run('/usr/sbin/chroot', [root, '/bin/true']);

const ambientSucceeded = [
  unisolated.nodeAmbientByPath,
  unisolated.pythonAmbientByPath,
  unisolated.shaderAmbientByPath,
  unisolated.nodeAmbientStaticImport,
].every((entry) => entry.status === 0);
const declaredSucceeded = [
  unisolated.nodeDeclared,
  unisolated.pythonDeclared,
  unisolated.shaderDeclared,
].every((entry) => entry.status === 0);
const enforcementAvailable = [bwrap, unshare, strace, chroot, landlockAbi].some((entry) => entry?.status === 0);

const result = {
  probe: 'N261_CAR_R136_DECLARED_INPUT_ROOT_SANDBOX_AUDITION',
  boundedQuestion: 'Can one content-addressed manifest prove ESM, Python, and shader-tool reads come only from its declared closure?',
  teacher: {
    name: 'bazelbuild/bazel sandboxing',
    status: 'TEACHER_CANDIDATE',
    lifecycle: 'AUDITION',
    novelty: 'REAPI-style input identity is not access enforcement; a verifier needs per-action filesystem isolation plus explicit no-fallback behavior.',
  },
  manifest: {
    declaredRootDigest: sha256(JSON.stringify(manifest)),
    positive: positiveManifest,
    negativeMissing: missingControl,
    negativeTampered: tamperedControl,
  },
  unisolated,
  enforcementCapabilities: { bwrap, unshare, strace, chroot, landlockCompile, landlockAbi },
  assertions: {
    declaredConsumersRun: declaredSucceeded,
    undeclaredAmbientConsumersAlsoRunWithoutIsolation: ambientSucceeded,
    missingInputRejectedByManifest: !missingControl.pass && missingControl.failures.some((x) => x.reason === 'ENOENT'),
    tamperedByteRejectedByManifest: !tamperedControl.pass && tamperedControl.failures.some((x) => x.reason === 'DIGEST_MISMATCH'),
    filesystemEnforcementAvailableInThisRunner: enforcementAvailable,
    noSilentFallback: !enforcementAvailable,
  },
  decision: enforcementAvailable ? 'CANDIDATE_REQUIRES_ENFORCED_NEGATIVE_CONTROLS' : 'BLOCKED_VALID_NO_SANDBOX_FALLBACK',
  interpretation: [
    'The manifest catches missing and changed declared bytes.',
    'The same manifest does not stop Node ESM, Python, or a shader-like tool from reading an undeclared absolute path.',
    'This runner exposes no usable filesystem-isolation or syscall-audit primitive; the audition therefore stops instead of silently replaying in local mode.',
    'Do not adopt globally. Next valid trial must run the real package-relative entrypoint inside an environment that can deny the injected absolute path.',
  ],
  scope: {
    productionMotherChanged: false,
    r2Changed: false,
    realR136ArchiveExecuted: false,
    gpuValidated: false,
    adopted: false,
    userAccepted: false,
  },
};

const outputPath = join(here, 'declared_input_root_probe_result_n261.json');
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ outputPath, decision: result.decision, assertions: result.assertions }, null, 2)}\n`);

if (!root.startsWith(join(tmpdir(), 'n261-input-root-'))) throw new Error('unsafe cleanup target');
await rm(root, { recursive: true, force: true });
