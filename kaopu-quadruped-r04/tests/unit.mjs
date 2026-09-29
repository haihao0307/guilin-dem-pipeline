import assert from 'node:assert/strict';
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
} from '../src/instrument.js';
import { SCORE_LIBRARY } from '../src/scores.js';

let checks = 0;
async function check(name, fn) {
  await fn();
  checks += 1;
  console.log(`PASS ${name}`);
}

await check('version and domain contract', () => {
  assert.equal(VERSION, 'K4.0.0');
  assert.equal(CONTRACT.domain, 'bilateral-quadruped');
  assert.equal(CONTRACT.identityPresets, 0);
  assert.deepEqual(CONTRACT.requiredSections, ['M', 'V', 'F', 'H']);
});

await check('pure instrument source contains no identity generator or example score', async () => {
  const source = (await readFile(new URL('../src/instrument.js', import.meta.url), 'utf8')).toLowerCase();
  const forbidden = ['polarbear', 'polar bear', 'tortoise', 'eagle', '北极熊', '陆龟', '老鹰', 'score_library', 'scores.js'];
  for (const word of forbidden) assert.equal(source.includes(word), false, `instrument contains forbidden identity token: ${word}`);
  assert.equal(source.includes("kind==='"), false);
  assert.equal(source.includes('switch (kind'), false);
});

for (const [key, entry] of Object.entries(SCORE_LIBRARY)) {
  await check(`${key} score carries full framework sections`, () => {
    const parsed = parseScore(entry.score);
    assert.ok(parsed.materials.length >= 1);
    assert.ok(parsed.volumes.length >= 2);
    assert.ok(parsed.fore.length >= 2);
    assert.ok(parsed.hind.length >= 2);
    assert.ok(Buffer.byteLength(entry.score) > 180, 'corrected score should carry real attributes rather than one preset token');
  });
}

const results = new Map();
for (const [key, entry] of Object.entries(SCORE_LIBRARY)) {
  await check(`${key} builds from generic score data`, () => {
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

await check('three scores produce distinct calculated results', () => {
  const hashes = [...results.values()].map((entry) => entry.hash);
  assert.equal(new Set(hashes).size, hashes.length);
});

await check('score edit changes actual output without instrument edit', () => {
  const original = SCORE_LIBRARY.neutral.score;
  const changed = original.replace('0,.78,-.2,.34,.32,.68', '0,.78,-.2,.44,.32,.68');
  const parsedOriginal = parseScore(original);
  const parsedChanged = parseScore(changed);
  assert.equal(parsedOriginal.volumes[0].radius[0], 0.34);
  assert.equal(parsedChanged.volumes[0].radius[0], 0.44);
  const first = buildScore(original);
  const second = buildScore(changed);
  try {
    assert.notEqual(fingerprint(first.root), fingerprint(second.root));
  } finally {
    dispose(first.root);
    dispose(second.root);
  }
});

await check('same instrument plays unseen custom quadruped score', () => {
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
