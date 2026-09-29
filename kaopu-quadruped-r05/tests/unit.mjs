import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  VERSION,
  CONTRACT,
  parseScore,
  buildScore,
  dispose,
  measure,
  fingerprint,
  verifyReplay,
} from '../../kaopu-quadruped-r04/src/instrument.js';
import { SCORE_LIBRARY } from '../src/scores.js';

const R04_SOURCE_SHA256 = '8aaedef7438f41282f98d0788420a22a5c6695690247ee38471ef85bd4d04782';
let checks = 0;
async function check(name, fn) {
  await fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

await check('version and domain contract remain K4 bilateral quadruped', () => {
  assert.equal(VERSION, 'K4.0.0');
  assert.equal(CONTRACT.domain, 'bilateral-quadruped');
  assert.equal(CONTRACT.identityPresets, 0);
  assert.deepEqual(CONTRACT.requiredSections, ['M', 'V', 'F', 'H']);
});

await check('R05 instrument source is byte-for-byte frozen from verified R04', async () => {
  const source = await readFile(new URL('../../kaopu-quadruped-r04/src/instrument.js', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), R04_SOURCE_SHA256);
});

await check('pure instrument source contains no animal identity generator or example score', async () => {
  const source = (await readFile(new URL('../../kaopu-quadruped-r04/src/instrument.js', import.meta.url), 'utf8')).toLowerCase();
  const forbidden = [
    'polarbear', 'polar bear', 'tortoise', 'eagle', 'graywolf', 'gray wolf',
    '北极熊', '陆龟', '老鹰', '灰狼', 'score_library', 'scores.js',
  ];
  for (const word of forbidden) assert.equal(source.includes(word), false, `instrument contains forbidden identity token: ${word}`);
  assert.equal(source.includes("kind==='"), false);
  assert.equal(source.includes('switch (kind'), false);
});

assert.deepEqual(Object.keys(SCORE_LIBRARY), ['polarBear', 'tortoise', 'neutral', 'grayWolf']);
for (const [key, entry] of Object.entries(SCORE_LIBRARY)) {
  await check(`${key} external score carries complete framework sections`, () => {
    const parsed = parseScore(entry.score);
    assert.ok(parsed.materials.length >= 1);
    assert.ok(parsed.volumes.length >= 2);
    assert.ok(parsed.fore.length >= 2);
    assert.ok(parsed.hind.length >= 2);
    assert.ok(Buffer.byteLength(entry.score) > 180, 'score should carry object attributes rather than one preset token');
  });
}

await check('gray-wolf identity data lives in score sections', () => {
  const parsed = parseScore(SCORE_LIBRARY.grayWolf.score);
  assert.equal(parsed.volumes.length, 7);
  assert.equal(parsed.fore.length, 4);
  assert.equal(parsed.hind.length, 4);
  assert.equal(parsed.tail.length, 4);
  assert.equal(parsed.symmetricDetails.length, 3);
  assert.equal(parsed.centralDetails.length, 1);
  assert.ok(parsed.fibres);
  assert.equal(parsed.cap, null);
  assert.equal(parsed.fibres.seed, 57);
});

const results = new Map();
for (const [key, entry] of Object.entries(SCORE_LIBRARY)) {
  await check(`${key} builds from the same frozen generic instrument`, () => {
    const result = buildScore(entry.score);
    try {
      const metrics = measure(result.root, result.score);
      const hash = fingerprint(result.root);
      assert.ok(metrics.meshes >= 1);
      assert.ok(metrics.triangles > 10000);
      assert.ok(metrics.bounds.max[1] > metrics.bounds.min[1]);
      assert.equal(result.root.userData.identityPreset, null);
      assert.equal(result.root.userData.scoreOwnedShapeData, true);
      assert.equal(verifyReplay(result), true);
      results.set(key, { metrics, hash });
    } finally {
      dispose(result.root);
    }
  });
}

await check('four external scores produce four distinct calculated results', () => {
  const hashes = [...results.values()].map((entry) => entry.hash);
  assert.equal(new Set(hashes).size, hashes.length);
});

await check('gray-wolf score stays inside the corrected physical envelope', () => {
  const metrics = results.get('grayWolf').metrics;
  const span = metrics.bounds.max.map((value, index) => value - metrics.bounds.min[index]);
  assert.ok(span[0] > 0.45 && span[0] < 0.70, `unexpected width ${span[0]}`);
  assert.ok(span[1] > 0.70 && span[1] < 0.95, `unexpected height ${span[1]}`);
  assert.ok(span[2] > 1.35 && span[2] < 1.85, `unexpected length ${span[2]}`);
});

await check('editing wolf score changes actual geometry without instrument edit', () => {
  const original = SCORE_LIBRARY.grayWolf.score;
  const changed = original.replace('0,.435,-.025,.187,.165,.262', '0,.435,-.025,.237,.165,.262');
  const first = buildScore(original);
  const second = buildScore(changed);
  try {
    assert.notEqual(fingerprint(first.root), fingerprint(second.root));
    assert.notDeepEqual(measure(first.root, first.score).bounds, measure(second.root, second.score).bounds);
  } finally {
    dispose(first.root);
    dispose(second.root);
  }
});

await check('same frozen instrument still plays an unlisted custom quadruped score', () => {
  const custom = 'K4|M777d84,.9/111319,.3|V0,.7,-.15,.30,.28,.55/0,.76,.36,.28,.27,.34/0,.84,.64,.20,.22,.25|F.22,.62,.26,.14/.24,.34,.34,.12/.25,.08,.40,.14|H.25,.62,-.40,.16/.27,.34,-.44,.13/.28,.08,-.36,.15|S.11,.96,.66,.06,.08,.04,0,0,0,0/.06,.88,.84,.015,.013,.010,0,0,0,1|D0,.81,.87,.07,.04,.07,0,0,0,1';
  const result = buildScore(custom);
  try {
    assert.ok(measure(result.root, result.score).triangles > 10000);
  } finally {
    dispose(result.root);
  }
});

const rejected = [
  '',
  'K3|B',
  'K4|Mffffff,.9|V0,0,0,1,1,1/0,0,1,1,1,1|F.2,.5,.2,.1/.2,.1,.2,.1',
  'K4|Mffffff,.9|V0,0,0,1,1,1/0,0,1,1,1,1|F-.2,.5,.2,.1/-.2,.1,.2,.1|H.2,.5,-.2,.1/.2,.1,-.2,.1',
  'K4|Mffffff,.9|V0,0,0,1,1,1/0,0,1,1,1,1|F.2,.5,.2,.1/.2,.1,.2,.1|H.2,.5,-.2,.1/.2,.1,-.2,.1|Z1',
];
for (const score of rejected) {
  await check(`reject ${score.slice(0, 32)}`, () => assert.throws(() => parseScore(score)));
}

console.log(`UNIT_CHECKS ${checks}`);
