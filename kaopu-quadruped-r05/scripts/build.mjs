import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SCORE_LIBRARY } from '../src/scores.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const sourceSha = process.env.GITHUB_SHA || 'LOCAL';
const R04_INSTRUMENT_SHA256 = 'e0f6c35710561dad66e8ffbc748fc28d2bac61a6771549eb89611db165669435';
const R04_INSTRUMENT_SOURCE_SHA256 = '8aaedef7438f41282f98d0788420a22a5c6695690247ee38471ef85bd4d04782';
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

const [instrumentRaw, appRaw, playerRaw, workbenchTemplate, playerTemplate, license, instrumentSource] = await Promise.all([
  bundle('../kaopu-quadruped-r04/src/instrument.js', { format: 'iife', globalName: 'KAOPUQuadruped' }),
  bundle('src/app.js', { format: 'iife' }),
  bundle('../kaopu-quadruped-r04/src/player.js', { format: 'iife' }),
  readFile(resolve(root, 'src/index.template.html'), 'utf8'),
  readFile(resolve(root, '../kaopu-quadruped-r04/src/player.template.html'), 'utf8'),
  readFile(resolve(root, 'node_modules/three/LICENSE'), 'utf8'),
  readFile(resolve(root, '../kaopu-quadruped-r04/src/instrument.js')),
]);

new Function(instrumentRaw);
new Function(appRaw);
new Function(playerRaw);
const escapeScript = (text) => text.replaceAll('</script', '<\\/script');
const instrument = escapeScript(instrumentRaw);
const appBundle = escapeScript(appRaw);
const playerBundle = escapeScript(playerRaw);
const instrumentBytes = Buffer.byteLength(instrumentRaw, 'utf8');
const instrumentSha256 = createHash('sha256').update(instrumentRaw).digest('hex');
const instrumentSourceSha256 = createHash('sha256').update(instrumentSource).digest('hex');
if (instrumentSha256 !== R04_INSTRUMENT_SHA256) {
  throw new Error(`K4 instrument bundle changed: ${instrumentSha256} != ${R04_INSTRUMENT_SHA256}`);
}
if (instrumentSourceSha256 !== R04_INSTRUMENT_SOURCE_SHA256) {
  throw new Error(`K4 instrument source changed: ${instrumentSourceSha256} != ${R04_INSTRUMENT_SOURCE_SHA256}`);
}
const instrumentB64 = Buffer.from(instrumentRaw, 'utf8').toString('base64');

function render(template, marker, script, workbenchBytes = 0) {
  if (!template.includes(marker)) throw new Error(`Missing marker ${marker}`);
  return template
    .replace('__INSTRUMENT_BYTES__', String(instrumentBytes))
    .replace('__WORKBENCH_BYTES__', String(workbenchBytes))
    .replace('__INSTRUMENT_B64__', instrumentB64)
    .replace(marker, `<script>${script}</script>`);
}

let workbenchBytes = 0;
let workbenchHtml = '';
for (let pass = 0; pass < 5; pass += 1) {
  workbenchHtml = render(workbenchTemplate, '<!--KAOPU_APP_BUNDLE-->', appBundle, workbenchBytes);
  const measured = Buffer.byteLength(workbenchHtml, 'utf8');
  if (measured === workbenchBytes) break;
  workbenchBytes = measured;
}
workbenchHtml = render(workbenchTemplate, '<!--KAOPU_APP_BUNDLE-->', appBundle, workbenchBytes);
workbenchBytes = Buffer.byteLength(workbenchHtml, 'utf8');
workbenchHtml = render(workbenchTemplate, '<!--KAOPU_APP_BUNDLE-->', appBundle, workbenchBytes);

const playerHtml = render(playerTemplate, '<!--KAOPU_PLAYER_BUNDLE-->', playerBundle, 0);
const files = {
  'index.html': workbenchHtml,
  'KAOPU_QUADRUPED_PLAYER.html': playerHtml,
  'KAOPU_QUADRUPED_K4.js': instrumentRaw,
  'KAOPU_POLAR_BEAR_K4.score': `${SCORE_LIBRARY.polarBear.score}\n`,
  'KAOPU_TORTOISE_K4.score': `${SCORE_LIBRARY.tortoise.score}\n`,
  'KAOPU_NEUTRAL_QUADRUPED_K4.score': `${SCORE_LIBRARY.neutral.score}\n`,
  'KAOPU_GRAY_WOLF_K4.score': `${SCORE_LIBRARY.grayWolf.score}\n`,
  'LICENSE_THREE.txt': license,
};

const buildInfo = {
  project: 'KAOPU Quadruped Instrument R05 — Gray Wolf Score-Only Test',
  version: 'K4.0.0',
  experiment: 'R05',
  sourceSha,
  instrumentBytes,
  instrumentSha256,
  instrumentSourceSha256,
  frozenAgainstR04: true,
  r04InstrumentSha256: R04_INSTRUMENT_SHA256,
  r04InstrumentSourceSha256: R04_INSTRUMENT_SOURCE_SHA256,
  instrumentChangedBytes: 0,
  workbenchBytes: Buffer.byteLength(workbenchHtml),
  playerBytes: Buffer.byteLength(playerHtml),
  scoreBytes: Object.fromEntries(Object.entries(SCORE_LIBRARY).map(([key, value]) => [key, Buffer.byteLength(value.score)])),
  identityPresetsInInstrument: 0,
  framework: 'bilateral-quadruped',
  newExternalScore: 'grayWolf',
  builtAt: new Date().toISOString(),
};
files['BUILD.json'] = `${JSON.stringify(buildInfo, null, 2)}\n`;
files['README.txt'] = `KAOPU Quadruped Instrument R05\n\nThis experiment keeps KAOPU_QUADRUPED_K4.js byte-for-byte identical to verified R04.\nThe new gray-wolf information exists only in KAOPU_GRAY_WOLF_K4.score.\nThe pure instrument contains no gray-wolf, polar-bear, tortoise or other species preset.\nKAOPU_QUADRUPED_PLAYER.html starts empty and calculates an animal only after a K4 score is imported.\n`;

for (const [name, content] of Object.entries(files)) await writeFile(resolve(dist, name), content, 'utf8');
console.log(JSON.stringify(buildInfo, null, 2));
