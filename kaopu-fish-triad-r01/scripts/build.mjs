import { build as esbuild } from 'esbuild';
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deepStrictEqual } from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSourceScore } from '../src/composer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'dist');
const json = async (file) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const baseText = await readFile(path.join(root, 'scores/base/FISH_AXIAL_BASE_KF1.json'), 'utf8');
const base = JSON.parse(baseText);
const source = await json('scores/source/MUSKELLUNGE_SOURCE_SCORE_R01.json');
const expectedResolved = await json('scores/resolved/MUSKELLUNGE_RESOLVED_SCORE_R01.json');
const baseHash = sha256(baseText);
const compiled = compileSourceScore(base, source, baseHash);
deepStrictEqual(compiled, expectedResolved, 'Checked-in Resolved Score must equal compilation of Base + Source Score');

async function bundle(entry, options = {}) {
  const result = await esbuild({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    platform: 'browser',
    target: ['es2022'],
    format: options.format ?? 'iife',
    globalName: options.globalName,
    minify: false,
    sourcemap: false,
    legalComments: 'none',
    write: false,
    loader: { '.json': 'json' }
  });
  return result.outputFiles[0].text.replaceAll('</script', '<\\/script');
}

const appBundle = await bundle('src/app.js');
const template = await readFile(path.join(root, 'src/index.template.html'), 'utf8');
if (!template.includes('__KAOPU_APP_BUNDLE__')) throw new Error('Workbench template placeholder missing');
const workbench = template.replace('__KAOPU_APP_BUNDLE__', appBundle);
await writeFile(path.join(dist, 'index.html'), workbench);

const playerBundle = await bundle('src/player.js');
const playerTemplate = await readFile(path.join(root, 'src/player.template.html'), 'utf8');
const player = playerTemplate.replace('__KAOPU_PLAYER_BUNDLE__', playerBundle);
await writeFile(path.join(dist, 'standalone-player.html'), player);

const instrumentBundle = await bundle('src/instrument.js', { globalName: 'KAOPUFishInstrument' });
await writeFile(path.join(dist, 'KAOPU_FISH_INSTRUMENT_KF1.js'), instrumentBundle);
const composerBundle = await bundle('src/composer.js', { globalName: 'KAOPUFishComposer' });
await writeFile(path.join(dist, 'KAOPU_FISH_COMPOSER_KC1.js'), composerBundle);

for (const [from, to] of [
  ['scores/base/FISH_AXIAL_BASE_KF1.json', 'FISH_AXIAL_BASE_KF1.json'],
  ['scores/source/MUSKELLUNGE_SOURCE_SCORE_R01.json', 'MUSKELLUNGE_SOURCE_SCORE_R01.json'],
  ['scores/resolved/MUSKELLUNGE_RESOLVED_SCORE_R01.json', 'MUSKELLUNGE_RESOLVED_SCORE_R01.json'],
  ['contracts/instrument.manifest.json', 'instrument.manifest.json'],
  ['contracts/resolved-score.schema.json', 'resolved-score.schema.json'],
  ['TASK_ANCHOR_R01.json', 'TASK_ANCHOR_R01.json'],
  ['docs/REFERENCE_AUDIT.json', 'REFERENCE_AUDIT.json'],
  ['README.md', 'README.md']
]) await copyFile(path.join(root, from), path.join(dist, to));

const artifact = {
  project: 'KAOPU Fish Triad R01',
  composerVersion: 'KC1.0.0',
  instrumentVersion: 'KF1.0.0',
  objectId: compiled.object.id,
  baseScoreSha256: baseHash,
  sourceScoreSha256: sha256(await readFile(path.join(root, 'scores/source/MUSKELLUNGE_SOURCE_SCORE_R01.json'), 'utf8')),
  resolvedScoreSha256: sha256(await readFile(path.join(root, 'scores/resolved/MUSKELLUNGE_RESOLVED_SCORE_R01.json'), 'utf8')),
  workbenchSha256: sha256(workbench),
  playerSha256: sha256(player),
  teacherPackageSha256: compiled.provenance.referencePackageSha256,
  teacherAssetInFormalBuild: false,
  requiredNetworkRequests: 0,
  visualAcceptance: false,
  motionAcceptance: false,
  productionReady: false
};
await writeFile(path.join(dist, 'BUILD_MANIFEST.json'), JSON.stringify(artifact, null, 2) + '\n');
console.log(JSON.stringify(artifact, null, 2));
