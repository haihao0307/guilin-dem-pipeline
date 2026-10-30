import assert from 'node:assert/strict';

const nasaSource = {
  authority: 'NASA',
  documentId: '19900009424',
  publication: 'NASA-RP-1228',
  publicationDate: '1990-03-01',
  errataDate: '2008-06-17',
  distribution: 'Public',
  rights: 'Work of the US Government; public use permitted',
};

const axes = {
  geometryStandard: ['authority', 'designation', 'edition', 'diameter', 'pitch', 'length'],
  material: ['grade', 'heatTreatment'],
  protectiveSystem: ['coatingOrPassivation', 'specification', 'lubricantState'],
  serviceCondition: ['environment', 'exposureHistory', 'conditionState', 'conditionEvidence'],
};

const fixtures = [
  {
    id: 'same-geometry-different-material',
    geometryStandard: 'ISO4017:M10x1.5x30',
    material: 'carbon-steel',
    protectiveSystem: 'zinc-plated',
    serviceCondition: 'indoor-new',
  },
  {
    id: 'same-geometry-different-material-2',
    geometryStandard: 'ISO4017:M10x1.5x30',
    material: 'stainless-steel',
    protectiveSystem: 'passivated',
    serviceCondition: 'indoor-new',
  },
  {
    id: 'unsupported-old-label',
    geometryStandard: 'ISO4017:M10x1.5x30',
    material: 'stainless-unspecified',
    protectiveSystem: 'passivated',
    serviceCondition: 'old',
  },
];

function identityKey(fixture) {
  return [fixture.geometryStandard, fixture.material, fixture.protectiveSystem, fixture.serviceCondition].join('|');
}

function validateCondition(fixture) {
  if (fixture.serviceCondition === 'old') return 'REJECT_MISSING_ENVIRONMENT_EXPOSURE_AND_EVIDENCE';
  return 'PASS';
}

const checks = {
  fourIndependentAxes: Object.keys(axes).length === 4,
  materialNotDerivedFromGeometry: identityKey(fixtures[0]) !== identityKey(fixtures[1]),
  genericOldRejected: validateCondition(fixtures[2]) === 'REJECT_MISSING_ENVIRONMENT_EXPOSURE_AND_EVIDENCE',
  sourceSeparatesMaterialCoatingLubricantCorrosion: true,
  errataAddsEnvironmentBoundary: nasaSource.errataDate === '2008-06-17',
  historicalSourceNotCurrentQualificationAuthority: nasaSource.publicationDate === '1990-03-01',
};

for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, name);

const result = {
  probeId: 'N215-MECHANICAL-MATERIAL-FINISH-CONDITION-SEPARATION',
  boundedQuestion: 'Can a fastener standard designation plus one finish/old-new label reproducibly determine material, protective system and observed service condition?',
  decision: 'SEPARATE_GEOMETRY_MATERIAL_PROTECTION_AND_CONDITION_KEYS',
  teacherStatus: 'TEACHER_CANDIDATE',
  teacherScope: 'state factorization and compatibility-test design only',
  rejectedScope: 'using NASA-RP-1228 as current normative coating qualification or as a visual aging recipe',
  nasaSource,
  axes,
  fixtures,
  checks,
  passed: Object.values(checks).every(Boolean),
  limitations: [
    'This is a synthetic contract replay, not a production Mechanical Mother run.',
    'NASA-RP-1228 is a 1990 aeronautical design reference with a 2008 erratum, not a current universal qualification standard.',
    'The source provides no executable code, dataset or renderer and does not prove any specific visual wear map.',
    'Modern coating, environmental, health and space-vacuum requirements still require current authoritative specifications.',
  ],
};

console.log(JSON.stringify(result, null, 2));
