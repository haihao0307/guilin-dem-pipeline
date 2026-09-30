import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SCORE_LIBRARY } from '../src/scores.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const sourceSha = process.env.GITHUB_SHA || 'LOCAL';
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const bundle = async (entry, options = {}) => {
  const result = await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    write: false,
    minify: true,
    platform: 'browser',
    target: ['es2022'],
    legalComments: 'none',
    sourcemap: false,
    treeShaking: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    ...options,
  });
  return result.outputFiles[0].text;
};

const [instrumentRaw, appBundle, playerRaw, workbenchTemplate, playerTemplate, license] = await Promise.all([
  bundle('src/instrument.js', { format: 'iife', globalName: 'KAOPUMammal' }),
  bundle('src/app.js', { format: 'iife' }),
  bundle('src/player.js', { format: 'iife' }),
  readFile(resolve(root, 'src/index.template.html'), 'utf8'),
  readFile(resolve(root, 'src/player.template.html'), 'utf8'),
  readFile(resolve(root, 'node_modules/three/LICENSE'), 'utf8'),
]);

const appRaw = `globalThis.__KAOPU_SCORE_LIBRARY__ = Object.freeze(${JSON.stringify(SCORE_LIBRARY)});\n${appBundle}`;
new Function(instrumentRaw);
new Function(appRaw);
new Function(playerRaw);
const escapeScript = (text) => text.replaceAll('</script', '<\\/script');
const instrumentBytes = Buffer.byteLength(instrumentRaw, 'utf8');
const instrumentB64 = Buffer.from(instrumentRaw, 'utf8').toString('base64');

function render(template, marker, script, workbenchBytes = 0) {
  if (!template.includes(marker)) throw new Error(`Missing marker ${marker}`);
  return template
    .replaceAll('__INSTRUMENT_BYTES__', String(instrumentBytes))
    .replaceAll('__WORKBENCH_BYTES__', String(workbenchBytes))
    .replace('__INSTRUMENT_B64__', instrumentB64)
    .replace(marker, `<script>${escapeScript(script)}</script>`);
}

let workbenchBytes = 0;
let workbenchHtml = '';
for (let pass = 0; pass < 6; pass += 1) {
  workbenchHtml = render(workbenchTemplate, '<!--KAOPU_APP_BUNDLE-->', appRaw, workbenchBytes);
  const measured = Buffer.byteLength(workbenchHtml, 'utf8');
  if (measured === workbenchBytes) break;
  workbenchBytes = measured;
}
workbenchHtml = render(workbenchTemplate, '<!--KAOPU_APP_BUNDLE-->', appRaw, workbenchBytes);
workbenchBytes = Buffer.byteLength(workbenchHtml, 'utf8');
workbenchHtml = render(workbenchTemplate, '<!--KAOPU_APP_BUNDLE-->', appRaw, workbenchBytes);
const playerHtml = render(playerTemplate, '<!--KAOPU_PLAYER_BUNDLE-->', playerRaw, 0);

function validateEmbeddedExecutable(html, label) {
  const open = html.lastIndexOf('<script>');
  const close = html.lastIndexOf('</script>');
  if (open < 0 || close <= open) throw new Error(`${label}: executable script not found`);
  new Function(html.slice(open + '<script>'.length, close));
}
validateEmbeddedExecutable(workbenchHtml, 'workbench');
validateEmbeddedExecutable(playerHtml, 'empty-player');

const scoreFiles = {
  greyTabby: 'KAOPU_GREY_TABBY_K5.score',
  neutralDog: 'KAOPU_NEUTRAL_DOG_K5.score',
  grayWolf: 'KAOPU_GRAY_WOLF_K5.score',
  unseenMammal: 'KAOPU_UNSEEN_MAMMAL_K5.score',
};
const files = {
  'index.html': workbenchHtml,
  'KAOPU_MAMMAL_PLAYER.html': playerHtml,
  'KAOPU_MAMMAL_K5.js': instrumentRaw,
  'LICENSE_THREE.txt': license,
};
for (const [key, filename] of Object.entries(scoreFiles)) files[filename] = `${SCORE_LIBRARY[key].score}\n`;

const buildInfo = {
  project: 'KAOPU Mammal Instrument R06 — Cat/Dog Knowledge Integration',
  version: 'K5.0.0',
  sourceSha,
  instrumentBytes,
  instrumentSha256: createHash('sha256').update(instrumentRaw).digest('hex'),
  instrumentSourceSha256: createHash('sha256').update(await readFile(resolve(root, 'src/instrument.js'))).digest('hex'),
  workbenchBytes: Buffer.byteLength(workbenchHtml),
  playerBytes: Buffer.byteLength(playerHtml),
  scoreBytes: Object.fromEntries(Object.entries(SCORE_LIBRARY).map(([key, value]) => [key, Buffer.byteLength(value.score)])),
  identityPresetsInInstrument: 0,
  runtimeExternalModels: 0,
  framework: 'digitigrade-mammal',
  sharedOperators: [
    'fixed-length-ik',
    'continuous-torso-field',
    'elliptic-limb-carrier',
    'paw-toe-fan',
    'pinna-sheet',
    'head-muzzle-field',
    'coat-pattern-field',
    'vibrissa-curves',
  ],
  integrations: {
    catProject: {
      repository: 'haihao0307/Humanoid-Rig-Lab-Next',
      branch: 'codex/cat-procedural-body-v1-p1-5-neutral-stance-20260918',
      commit: '85abf5d822788b5ca32886292b83f5efcf4ce53e',
      use: 'measured-DNA-and-generic-anatomy-operators',
      runtimeAssetsCopied: false,
    },
    dogProject: {
      repository: 'haihao0307/Humanoid-Rig-Lab-Next',
      branch: 'automation/bruce-neutral-dog-anchor-r13p-20260915',
      commit: '5a0a9530faf69317aa58b1c7ffbadd345d2ec5a5',
      use: 'pinned-teacher-and-provenance-workflow',
      runtimeAssetsCopied: false,
    },
  },
  builtAt: new Date().toISOString(),
};
files['BUILD.json'] = `${JSON.stringify(buildInfo, null, 2)}\n`;
files['README.txt'] = `KAOPU Mammal Instrument R06\n\nKAOPU_MAMMAL_K5.js is the pure digitigrade-mammal instrument. It contains no cat, dog, wolf, bear or tortoise score and no identity generator.\nKAOPU_MAMMAL_PLAYER.html is an empty offline player. Without an external K5 score it creates no animal.\nThe four .score files are independent object descriptions.\n\nThe cat project contributes measured DNA and generic anatomical calculation methods. The dog project contributes a pinned, auditable teacher and source-rights workflow. No external teacher mesh is retained at runtime.\n`;

for (const [name, content] of Object.entries(files)) await writeFile(resolve(dist, name), content, 'utf8');
console.log(JSON.stringify(buildInfo, null, 2));
