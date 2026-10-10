/** Pure state checks only. This suite does not instantiate a mesh or renderer. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {
  applyFaceIdentity,
  FACE_IDENTITIES,
  FACE_IDENTITY_SOURCE,
  GNM_IDENTITY_DIMENSIONS,
} from '../full/ui/FaceIdentityPresets.mjs';

const catalogueBytes = await readFile(new URL('../full/shape-r031/Catalogue.mjs', import.meta.url));
// The original catalogue cannot be imported in this partial local snapshot:
// its body catalogue imports the absent PresetCatalogueR2.mjs. Parse only the
// original JSON array, without evaluating any source or stubbing dependencies.
const match = catalogueBytes.toString('utf8').match(/export const IDENTITIES=(\[.*?\]);\nexport const CASES=/s);
assert.ok(match, 'Original catalogue IDENTITIES must remain inspectable');
const originalIdentities = JSON.parse(match[1]);
const {state: defaultState} = JSON.parse(await readFile(
  new URL('../anchors/DEFAULT-PROFILE-ac9110f.json', import.meta.url), 'utf8'));

function currentState() {
  const state = structuredClone(defaultState);
  state.anny.phenotypes = {gender: 0.27, age: 0.72, weight: 0.83, muscle: 0.16, height: 0.41, proportions: 0.68};
  state.anny.localChanges = {
    'head-fat-incr': 0.24,
    'head-scale-horiz-incr': 0.07,
    'l-cheek-volume-incr': -0.20,
    'r-cheek-bones-incr': 0.31,
    'chin-width-incr': 0.26,
    'nose-scale-depth-incr': -0.17,
    'forehead-scale-depth-incr': 0.03,
    'l-eye-trans-out': 0.08,
    'r-eye-height1-incr': -0.04,
    'eyebrows-angle-up': 0.16,
    'mouth-upperlip-volume-incr': 0.22,
    'neck-double-incr': 0.09,
    'measure-neck-circ-incr': 0.13,
    'torso-scale-horiz-incr': -0.33,
    'hip-scale-horiz-incr': 0.11,
    'l-upperarm-fat-incr': 0.28,
    'r-upperleg-fat-incr': 0.38,
  };
  state.anny.pose = {head: [2, -4, 7], neck02: [1, 2, 3]};
  state.anny.facialActions = {jaw: 0.17};
  state.anny.translations = {root: [0.1, 0.2, 0.3]};
  state.gnm.identity[17] = 0.46;
  state.gnm.expression[8] = -0.32;
  state.gnm.rotation[1] = 0.09;
  state.gnm.translation[2] = 0.14;
  state.mhr.identity[3] = -0.11;
  state.headShapeComposition = 'shared-layers/1';
  return state;
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

test('metadata names the original identities, source and verification boundary', () => {
  assert.equal(GNM_IDENTITY_DIMENSIONS, 253);
  assert.deepEqual(FACE_IDENTITIES.map(row => row.id), ['neutral', 'long_narrow', 'short_broad', 'square_jaw']);
  assert.equal(FACE_IDENTITY_SOURCE.sha256, createHash('sha256').update(catalogueBytes).digest('hex'));
  for (const original of originalIdentities) {
    const preset = FACE_IDENTITIES.find(row => row.id === original.id);
    assert.equal(preset.label, original.label);
    assert.equal(preset.source.path, 'full/shape-r031/Catalogue.mjs');
    assert.equal(preset.source.identityId, original.id);
    assert.equal(preset.source.coefficientScale, original.id === 'square_jaw' ? 0.80 : 1);
  }
  assert.ok(FACE_IDENTITIES.every(row => row.description && row.verification.includes('未做')));
  assert.ok(FACE_IDENTITIES.every(row => row.verification.includes('状态层') && row.verification.includes('不保证身体顶点不变')));
  assert.ok(FACE_IDENTITIES.every(row => row.localChangesPolicy.includes('默认保留全部')));
  assert.equal(FACE_IDENTITIES[0].source.kind, 'gnm-zero-identity');
  assert.match(FACE_IDENTITIES[0].description, /不是撤销/);
  assert.ok(!JSON.stringify(FACE_IDENTITIES).includes('王祖贤'));
  assert.ok(Object.isFrozen(FACE_IDENTITIES));
  assert.ok(FACE_IDENTITIES.every(row => Object.isFrozen(row) && Object.isFrozen(row.source)));
});

test('all 253 coefficients reuse the source, including the original square-jaw gain', () => {
  const input = currentState();
  for (const original of originalIdentities) {
    const result = applyFaceIdentity(input, original.id);
    const gain = original.id === 'square_jaw' ? 0.80 : 1;
    assert.equal(original.gnmIdentity.length, 253);
    assert.equal(result.gnm.identity.length, 253);
    assert.ok(result.gnm.identity.every(Number.isFinite));
    assert.deepEqual(result.gnm.identity, original.gnmIdentity.map(value => value * gain));
  }
  assert.deepEqual(applyFaceIdentity(input, 'neutral').gnm.identity, Array(253).fill(0));
  const vectors = FACE_IDENTITIES.map(row => JSON.stringify(applyFaceIdentity(input, row.id).gnm.identity));
  assert.equal(new Set(vectors).size, 4, 'Every native identity and neutral must be distinct');
});

test('without head-only declarations only identity changes; the original state stays untouched', () => {
  const input = currentState();
  const archiveBefore = structuredClone(input);
  freezeDeep(input);
  for (const preset of FACE_IDENTITIES) {
    const result = applyFaceIdentity(input, preset.id);
    assert.notEqual(result, input);
    assert.notEqual(result.anny.phenotypes, input.anny.phenotypes);
    assert.notEqual(result.anny.pose.head, input.anny.pose.head);
    assert.notEqual(result.mhr, input.mhr);
    assert.deepEqual(result.anny.localChanges, archiveBefore.anny.localChanges);
    const exceptFace = structuredClone(result);
    exceptFace.gnm.identity = archiveBefore.gnm.identity;
    exceptFace.anny.localChanges = archiveBefore.anny.localChanges;
    assert.deepEqual(exceptFace, archiveBefore, 'No body, pose, expression, owner or other parameter may change');
    assert.deepEqual(input, archiveBefore, 'Input must be unchanged and available for an archived Undo');
    result.anny.phenotypes.weight = 0;
    result.anny.pose.head[0] = 999;
    result.gnm.expression[8] = 999;
    assert.deepEqual(input, archiveBefore, 'No nested output references may alias the input');
  }
});

test('head-local cleanup intersects live head-only labels; mixed and body locals survive', () => {
  const input = freezeDeep(currentState());
  // Deliberately omit head-fat/head-scale: this fixture treats those labels as
  // mixed head/body rather than declaring them head-only. This does not assert
  // the real transfer support of those fields without the live model.
  const labels = ['nose-scale-depth-incr', 'l-eye-trans-out', 'mouth-upperlip-volume-incr',
    'torso-scale-horiz-incr', 'neck-double-incr', 'not-an-active-key'];
  for (const headOnlyAnnyLocalLabels of [labels, new Set(labels)]) {
    const labelsBefore = [...headOnlyAnnyLocalLabels];
    for (const preset of FACE_IDENTITIES) {
      const result = applyFaceIdentity(input, preset.id, {headOnlyAnnyLocalLabels});
      const expected = structuredClone(input);
      expected.gnm.identity = result.gnm.identity;
      for (const key of ['nose-scale-depth-incr', 'l-eye-trans-out', 'mouth-upperlip-volume-incr']) {
        delete expected.anny.localChanges[key];
      }
      assert.deepEqual(result, expected, 'Only declared head-only AND original-regex matches may be removed');
      assert.equal(result.anny.localChanges['head-fat-incr'], input.anny.localChanges['head-fat-incr']);
      assert.equal(result.anny.localChanges['head-scale-horiz-incr'], input.anny.localChanges['head-scale-horiz-incr']);
      assert.deepEqual(result.anny.phenotypes, input.anny.phenotypes);
    }
    assert.deepEqual([...headOnlyAnnyLocalLabels], labelsBefore, 'Declaration must not be mutated');
  }
  for (const headOnlyAnnyLocalLabels of [undefined, [], new Set()]) {
    assert.deepEqual(applyFaceIdentity(input, 'neutral', {headOnlyAnnyLocalLabels}).anny.localChanges,
      input.anny.localChanges, 'Missing or empty declarations preserve all locals');
  }
});

test('repeated selections are deterministic and do not share mutable coefficient arrays', () => {
  const input = currentState();
  const first = applyFaceIdentity(input, 'long_narrow');
  assert.deepEqual(applyFaceIdentity(first, 'long_narrow'), first);
  assert.deepEqual(applyFaceIdentity(applyFaceIdentity(first, 'short_broad'), 'long_narrow'), first);
  const unaffected = applyFaceIdentity(input, 'long_narrow');
  first.gnm.identity[0] = 123;
  assert.deepEqual(applyFaceIdentity(input, 'long_narrow'), unaffected);
});

test('unknown or malformed inputs are rejected without replacing the current state', () => {
  const input = currentState();
  const before = structuredClone(input);
  for (const id of ['missing', 'toString', '__proto__', null, undefined]) {
    assert.throws(() => applyFaceIdentity(input, id), RangeError);
  }
  for (const invalid of [null, {}, {...input, schema: 'wrong'}, {...input, anny: null},
    {...input, anny: {...input.anny, localChanges: []}},
    {...input, gnm: {...input.gnm, identity: [0]}},
    {...input, gnm: {...input.gnm, identity: Array(253).fill(NaN)}},
  ]) assert.throws(() => applyFaceIdentity(invalid, 'long_narrow'), TypeError);
  for (const options of [null, [], {headOnlyAnnyLocalLabels: null},
    {headOnlyAnnyLocalLabels: 'nose-scale-depth-incr'},
    {headOnlyAnnyLocalLabels: ['nose-scale-depth-incr', 1]},
    {headOnlyAnnyLocalLabels: new Set([null])},
  ]) assert.throws(() => applyFaceIdentity(input, 'long_narrow', options), TypeError);
  assert.deepEqual(input, before);
});
