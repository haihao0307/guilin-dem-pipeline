#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = path.resolve(value('--workbench', path.join(__dirname, '../workbench')));
const baseline = value('--baseline', null);
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
const preservedRoots = ['boxing-r02.html', 'boxing.html', 'index-characters-r02.html', 'full/boxing', 'full/boxing-r02', 'full/body-adapter', 'full/src', 'full/ui', 'full/assets', 'full/source'];
fs.mkdirSync(out, {recursive: true});
if (baseline) {
  const old = path.resolve(baseline);
  const files = Object.fromEntries(preservedRoots.flatMap(p => walk(old, p)).map(p => [p, hash(path.join(old, p))]));
  fs.writeFileSync(path.join(out, 'r02-preservation-baseline.json'), JSON.stringify({schema:'boxing-r03-r02-preservation/1', meaning:'Byte hashes of pre-existing R02 native shape, full CSR skin, preset, source asset, glove and ring files. New R03 files are excluded.', files}, null, 2) + '\n');
}
const baselineFile = path.join(out, 'r02-preservation-baseline.json');
if (!fs.existsSync(baselineFile)) throw Error('Create the R02 preservation baseline once with --baseline before preparing a candidate.');
const preserved = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
const mismatches = Object.entries(preserved.files).filter(([file, expected]) => !fs.existsSync(path.join(root, file)) || hash(path.join(root, file)) !== expected).map(([file]) => file);
if (mismatches.length) throw Error('R02 preservation mismatch: ' + mismatches.join(', '));
for (const required of ['full/boxing-r03/loadMotionInventory.mjs']) if (!fs.existsSync(path.join(root, required))) throw Error('Candidate assembly incomplete: ' + required);
const code = ['boxing-r03.html', 'full/boxing-r03', 'collision-architecture', 'motion-architecture/live_program_schedule.mjs'].flatMap(p => walk(root, p)).filter(p => /\.(?:mjs|js|css|html|json)$/.test(p) && !/(?:-QA|RELEASE|report|reports|research)\b/i.test(p) && !/\.test\./.test(p));
const files = Object.fromEntries(code.map(p => [p, hash(path.join(root, p))]));
const result = {schema:'boxing-r03-candidate-source/1', preparedAt:new Date().toISOString(), files, preservedFileCount:Object.keys(preserved.files).length};
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
