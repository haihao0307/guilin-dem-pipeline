import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  VERSION,
  CONTRACT,
  parseScore,
  deriveSkeleton,
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

await check('K5 domain contract has no identity presets', () => {
  assert.equal(VERSION, 'K5.0.0');
  assert.equal(CONTRACT.domain, 'digitigrade-mammal');
  assert.equal(CONTRACT.identityPresets, 0);
  assert.deepEqual(CONTRACT.requiredSections, ['M', 'G', 'B', 'N', 'C', 'F', 'H', 'P']);
  assert.ok(CONTRACT.sharedOperators.includes('fixed-length-ik'));
  assert.ok(CONTRACT.sharedOperators.includes('pinna-sheet'));
});

await check('pure instrument source contains no object identity or score library', async () => {
  const source = (await readFile(new URL('../src/instrument.js', import.meta.url), 'utf8')).toLowerCase();
  const forbidden = [
    'greytabby', 'grey tabby', 'neutraldog', 'neutral dog', 'graywolf', 'gray wolf',
    'polar bear', 'polarbear', 'tortoise', '灰虎斑', '中型短毛犬', '灰狼', '北极熊', '陆龟',
    'score_library', 'scores.js',
  ];
  for (const word of forbidden) assert.equal(source.includes(word), false, `instrument contains forbidden identity token: ${word}`);
  assert.equal(source.includes("kind==='"), false);
  assert.equal(source.includes('switch (kind'), false);
});

assert.deepEqual(Object.keys(SCORE_LIBRARY), ['greyTabby', 'neutralDog', 'grayWolf', 'unseenMammal']);
for (const [key, entry] of Object.entries(SCORE_LIBRARY)) {
  await check(`${key} external score owns complete K5 sections`, () => {
    const parsed = parseScore(entry.score);
    assert.ok(parsed.materials.length >= 4);
    assert.ok(parsed.torso.thoraxLength > 0);
    assert.ok(parsed.forelimb.humerusLength > 0);
    assert.ok(parsed.hindlimb.femurLength > 0);
    assert.ok(parsed.paws.foreLength > 0);
    assert.ok(Buffer.byteLength(entry.score) > 420, 'object score must carry structural information');
  });
}

await check('cat DNA translation preserves key measured anchors', () => {
  const parsed = parseScore(SCORE_LIBRARY.greyTabby.score);
  assert.equal(parsed.global.bodyLength, 0.475);
  assert.equal(parsed.global.shoulderHeight, 0.2525);
  assert.equal(parsed.global.hipHeight, 0.258);
  assert.equal(parsed.forelimb.humerusLength, 0.0995);
  assert.equal(parsed.hindlimb.femurLength, 0.1315);
  assert.equal(parsed.paws.toeCount, 4);
});

await check('dog teacher remains external metadata rather than runtime geometry', () => {
  assert.match(SCORE_LIBRARY.neutralDog.source, /teacher/i);
  const parsed = parseScore(SCORE_LIBRARY.neutralDog.score);
  assert.ok(parsed.head.muzzleLength > parsed.head.eyeRadius * 4);
  assert.ok(parsed.paws.foreLength > parsed.paws.height * 2);
  assert.equal(parsed.coat.mode, 2);
});

const results = new Map();
for (const [key, entry] of Object.entries(SCORE_LIBRARY)) {
  await check(`${key} builds from the same generic instrument`, () => {
    const result = buildScore(entry.score);
    try {
      const metrics = measure(result.root, result.score);
      const hash = fingerprint(result.root);
      assert.ok(metrics.meshes >= 5, `${key}: missing generic details`);
      assert.ok(metrics.triangles > 18000, `${key}: insufficient calculated geometry`);
      assert.ok(metrics.bounds.max[1] > metrics.bounds.min[1]);
      assert.equal(result.root.userData.identityPreset, null);
      assert.equal(result.root.userData.scoreOwnedShapeData, true);
      assert.equal(result.root.userData.domain, 'digitigrade-mammal');
      assert.ok(result.anchors.shoulder1);
      assert.ok(result.anchors.forePaw1);
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

await check('fixed-length skeleton solver stays within reach correction gate', () => {
  for (const entry of Object.values(SCORE_LIBRARY)) {
    const { anchors } = deriveSkeleton(parseScore(entry.score));
    assert.ok(anchors.foreReachCorrection1 < 0.04);
    assert.ok(anchors.hindReachCorrection1 < 0.04);
  }
});

await check('editing only the dog score changes actual geometry', () => {
  const original = SCORE_LIBRARY.neutralDog.score;
  const changed = original.replace('C.17,.15,.14,.105', 'C.17,.18,.14,.105');
  assert.notEqual(original, changed);
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

await check('same instrument plays an unlisted custom K5 score', () => {
  const custom = SCORE_LIBRARY.unseenMammal.score.replace('G.61,.43,.45,.17,.19,.92', 'G.66,.47,.48,.18,.20,1.03').replace('A0,0,2,1,0,3,.35,.18,0,0,901', 'A2,0,2,1,3,2.5,.55,.22,0,0,904');
  const result = buildScore(custom);
  try {
    assert.ok(measure(result.root, result.score).triangles > 18000);
    assert.notEqual(fingerprint(result.root), results.get('unseenMammal').hash);
  } finally {
    dispose(result.root);
  }
});

await check('deterministic replay survives full dog calculation', () => {
  const result = buildScore(SCORE_LIBRARY.neutralDog.score);
  try {
    assert.equal(verifyReplay(result), true);
  } finally {
    dispose(result.root);
  }
});

const rejected = [
  '',
  'K4|Mffffff,.9',
  'K5|Mffffff,.9|G.5,.3,.3,.1,.1,1',
  SCORE_LIBRARY.neutralDog.score.replace('|P.10,.065,.11,.07,.03,.018,4,.009,9,7', ''),
  SCORE_LIBRARY.neutralDog.score.replace('|W6,.105,.62,-.08,8,515', '|Z1'),
];
for (const score of rejected) await check(`reject malformed ${score.slice(0, 24)}`, () => assert.throws(() => parseScore(score)));

console.log(`UNIT_CHECKS ${checks}`);
