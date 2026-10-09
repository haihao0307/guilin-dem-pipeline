#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(value('--workbench', path.join(__dirname, '../workbench')));
const productionFile = path.resolve(value('--production-tree', path.join(__dirname, 'production-tree.json')));
const PRODUCTION_COMMIT = '499915682292d3eb44cd5a5c881423a9c244f767';
const PRODUCTION_TREE = 'ed42e6053b00634d2ca5ca1ee6a6feefaaec83cc';
const replay = value('--replay', path.join(__dirname, '../motion/reports/WORST-POSE-REPLAY.json'));
const out = path.resolve(value('--out', __dirname));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const walk = (root, relative) => {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw Error('Required path missing: ' + file);
  return fs.statSync(file).isDirectory()
    ? fs.readdirSync(file).sort().flatMap(name => walk(root, path.posix.join(relative, name)))
    : [relative];
};
fs.mkdirSync(out, {recursive: true});
if (args.includes('--baseline')) throw Error('--baseline is retired. The old 185-file local snapshot is historical only; do not overwrite it or rebase preservation onto the candidate.');
const preserved = JSON.parse(fs.readFileSync(productionFile, 'utf8'));
if (preserved.schema !== 'boxing-r03-production-git-baseline/1' || preserved.commit !== PRODUCTION_COMMIT || preserved.tree !== PRODUCTION_TREE || preserved.files?.length !== 429) throw Error('Expected the exact pre-candidate 4999156 production Git tree (429 published files).');
const seen = new Set();
for (const file of preserved.files) {
  if (!/^kaopu-(?:unified-human|anny|mhr)-workbench\//.test(file.path) || file.path.split('/').includes('..') || !/^[a-f0-9]{40}$/.test(file.sha) || seen.has(file.path)) throw Error('Invalid or duplicate production Git entry: ' + file.path);
  seen.add(file.path);
}
// The preparation workspace deliberately contains materialized aliases and an
// older R01 page. It is not a production checkout. Do not derive expected blobs
// from it, copy aliases into publication, or reject them as missing production.
// Browser CI verifies every entry below against its real sparse Git checkout.
if (path.resolve(productionFile) !== path.join(out, 'production-tree.json')) fs.copyFileSync(productionFile, path.join(out, 'production-tree.json'));
for (const required of ['full/boxing-r03/loadMotionInventory.mjs']) if (!fs.existsSync(path.join(root, required))) throw Error('Candidate assembly incomplete: ' + required);
const code = ['boxing-r03.html', 'full/boxing-r03', 'collision-architecture', 'motion-architecture/live_program_schedule.mjs'].flatMap(p => walk(root, p)).filter(p => /\.(?:mjs|js|css|html|json)$/.test(p) && !/(?:-QA|RELEASE|report|reports|research)\b/i.test(p) && !/\.test\./.test(p));
const files = Object.fromEntries(code.map(p => [p, hash(path.join(root, p))]));
const result = {schema:'boxing-r03-candidate-source/1', preparedAt:new Date().toISOString(), files, preservedFileCount:preserved.files.length, preservationCommit:preserved.commit, preservationTree:preserved.tree, preservationAlgorithm:'git-blob-sha1', productionBaselineSha256:hash(productionFile)};
if (replay && fs.existsSync(replay)) {
  const replayData = JSON.parse(fs.readFileSync(replay, 'utf8'));
  for (const [file, expected] of Object.entries(replayData.sourceHashes || {})) {
    const actual = hash(path.join(root, 'full/boxing-r03', file));
    if (actual !== expected) throw Error('Worst-pose replay is stale for ' + file + ': regenerate numeric replay against the final runtime.');
  }
  fs.copyFileSync(replay, path.join(out, 'WORST-POSE-REPLAY.json'));
  result.worstPoseReplaySha256 = hash(path.join(out, 'WORST-POSE-REPLAY.json'));
} else throw Error('Worst-pose replay report is required: ' + replay);
fs.writeFileSync(path.join(out, 'candidate-source-manifest.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({prepared:true, sourceFiles:code.length, preservedFiles:result.preservedFileCount, output:out}));
