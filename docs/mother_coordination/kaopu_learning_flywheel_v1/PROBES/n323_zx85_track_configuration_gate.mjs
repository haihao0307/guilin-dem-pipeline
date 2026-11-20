import assert from 'node:assert/strict';
import fs from 'node:fs';

const candidate = JSON.parse(fs.readFileSync(new URL('./CANDIDATE_ZX85_TRACK_CONFIGURATION_001_N323.json', import.meta.url), 'utf8'));
const variants = new Map(candidate.sourceConfigurations.map((x) => [x.variantId, x]));
const sharedSet = new Set(candidate.sharedUndercarriageScope);

function validate(receipt) {
  const holds = [];
  if (!receipt.sourcePdfPages?.length) holds.push('HOLD_TRACK_VARIANT_SOURCE_MISSING');
  if (!receipt.activeVariantId || receipt.activeVariantCount === 0) holds.push('HOLD_TRACK_ACTIVE_VARIANT_MISSING');
  if (receipt.activeVariantCount > 1) holds.push('HOLD_TRACK_MULTIPLE_ACTIVE_VARIANTS');
  const expected = variants.get(receipt.activeVariantId);
  if (receipt.activeVariantId && !expected) holds.push('HOLD_TRACK_VARIANT_UNSUPPORTED');

  if (expected) {
    const dimensionKeys = ['shoeWidthMm', 'undercarriageLengthMm', 'undercarriageWidthMm'];
    if (dimensionKeys.some((k) => receipt[k] !== expected[k])) holds.push('HOLD_TRACK_VARIANT_DIMENSION_MISMATCH');
    if (receipt.operatingWeightKg !== expected.operatingWeightKg) holds.push('HOLD_TRACK_VARIANT_WEIGHT_MISMATCH');
    if (receipt.intendedGroundApplication !== expected.application) holds.push('HOLD_TRACK_APPLICATION_CONTRADICTION');
  }

  if (receipt.changedFromVariant && receipt.changedFromVariant !== receipt.activeVariantId && receipt.geometryAndMassDelta === 'MATERIAL_ONLY') {
    holds.push('HOLD_TRACK_MATERIAL_ONLY_SUBSTITUTE');
  }

  if ((receipt.swappableTrackObjectRoles || []).some((role) => sharedSet.has(role))) {
    holds.push('HOLD_TRACK_SHARED_RUNNING_GEAR_INSIDE_VARIANT');
  }

  if (!receipt.sourceHead || !receipt.observedConfigurationReplay) {
    holds.push('HOLD_TRACK_CONFIGURATION_REPLAY_MISSING');
  }
  return [...new Set(holds)];
}

const valid = {
  sourceHead: 'FIXTURE_HEAD',
  sourcePdfPages: [342, 344],
  activeVariantId: 'RUBBER_CRAWLER_450_OPTION',
  activeVariantCount: 1,
  changedFromVariant: 'GROUSER_450_STANDARD',
  shoeWidthMm: 450,
  undercarriageLengthMm: 2940,
  undercarriageWidthMm: 2200,
  operatingWeightKg: 8570,
  intendedGroundApplication: 'PAVED_ROAD',
  geometryAndMassDelta: 'SOURCE_BOUND_VARIANT_DELTA',
  sharedUndercarriageObjectIds: ['frame', 'idler', 'sprocket', 'rollers', 'axles'],
  swappableTrackObjectIds: ['left_rubber_crawler', 'right_rubber_crawler'],
  swappableTrackObjectRoles: ['TRACK_SHOE_OR_CRAWLER_GROUND_CONTACT_SET'],
  observedConfigurationReplay: 'FIXTURE_REPLAY'
};

const fixtures = [
  {name: 'source-backed rubber configuration passes', mutate: (x) => x, expected: []},
  {name: 'active variant is mandatory', mutate: (x) => { x.activeVariantId = null; x.activeVariantCount = 0; return x; }, expected: ['HOLD_TRACK_ACTIVE_VARIANT_MISSING']},
  {name: 'variants are mutually exclusive', mutate: (x) => { x.activeVariantCount = 2; return x; }, expected: ['HOLD_TRACK_MULTIPLE_ACTIVE_VARIANTS']},
  {name: 'invented variant is rejected', mutate: (x) => { x.activeVariantId = 'GENERIC_PLASTIC_TRACK'; return x; }, expected: ['HOLD_TRACK_VARIANT_UNSUPPORTED']},
  {name: 'rubber configuration requires 2940 mm length', mutate: (x) => { x.undercarriageLengthMm = 2920; return x; }, expected: ['HOLD_TRACK_VARIANT_DIMENSION_MISMATCH']},
  {name: 'rubber configuration requires source weight', mutate: (x) => { x.operatingWeightKg = 8550; return x; }, expected: ['HOLD_TRACK_VARIANT_WEIGHT_MISMATCH']},
  {name: 'variant swap cannot be material only', mutate: (x) => { x.geometryAndMassDelta = 'MATERIAL_ONLY'; return x; }, expected: ['HOLD_TRACK_MATERIAL_ONLY_SUBSTITUTE']},
  {name: 'rollers cannot be nested in swappable track', mutate: (x) => { x.swappableTrackObjectRoles.push('LOWER_ROLLERS'); return x; }, expected: ['HOLD_TRACK_SHARED_RUNNING_GEAR_INSIDE_VARIANT']},
  {name: 'rubber configuration application is paved road', mutate: (x) => { x.intendedGroundApplication = 'ROCKY_GROUND'; return x; }, expected: ['HOLD_TRACK_APPLICATION_CONTRADICTION']},
  {name: 'source pages are mandatory', mutate: (x) => { x.sourcePdfPages = []; return x; }, expected: ['HOLD_TRACK_VARIANT_SOURCE_MISSING']},
  {name: 'production replay is mandatory', mutate: (x) => { delete x.observedConfigurationReplay; return x; }, expected: ['HOLD_TRACK_CONFIGURATION_REPLAY_MISSING']}
];

const results = [];
for (const fixture of fixtures) {
  const receipt = fixture.mutate(structuredClone(valid));
  const actual = validate(receipt);
  assert.deepEqual(actual, fixture.expected, fixture.name);
  results.push({fixture: fixture.name, pass: true, holds: actual});
}

console.log(JSON.stringify({
  caseId: candidate.caseId,
  passed: results.length,
  total: results.length,
  fixtureOnly: true,
  productionReplay: 'NOT_RUN',
  results,
  decision: candidate.decision
}, null, 2));
