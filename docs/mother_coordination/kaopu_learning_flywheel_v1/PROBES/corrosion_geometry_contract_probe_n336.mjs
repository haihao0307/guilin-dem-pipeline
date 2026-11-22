import assert from 'node:assert/strict';

const sourceFacts = {
  ostiReport: {
    authority: 'US DOE OSTI',
    reportId: 'BMI-1317',
    url: 'https://www.osti.gov/servlets/purl/4268078',
    boundedFact: 'An oxide/metal volume ratio above one means the oxide occupies more volume; high ratios can create compressive stress and cracking.',
    excludedUse: 'Not a visual rust recipe, displacement amplitude, or current asset-specific qualification source.',
  },
};

const requiredFamilies = ['steel-plate', 'lock', 'air-conditioner-shell'];
const requiredOrientations = ['top', 'side'];

function validate(candidate) {
  if (candidate.severity > 0 && !candidate.vertexPositionsChanged)
    return 'REJECT_SHADER_ONLY_CORROSION';
  if (candidate.severity > 0 && candidate.referenceMeshDigest === candidate.deformedMeshDigest)
    return 'REJECT_NO_GEOMETRY_DELTA';
  if (candidate.greenSpot && candidate.maxOutwardDisplacement <= 0)
    return 'REJECT_GREEN_SPOT_WITHOUT_PROTRUSION';
  if (!candidate.orientationCauseBound && candidate.topSideDistributionDistance > 0.15)
    return 'REJECT_UNEXPLAINED_FACE_ORIENTATION_DRIFT';
  if (!requiredFamilies.every((family) => candidate.assetFamilies.includes(family)))
    return 'REJECT_UNPROVEN_ASSET_FAMILY_TRANSFER';
  if (!requiredOrientations.every((orientation) => candidate.orientations.includes(orientation)))
    return 'REJECT_MISSING_ORIENTATION_SLICE';
  if (candidate.shaderFieldDigest !== candidate.geometryFieldDigest)
    return 'REJECT_UNBOUND_MATERIAL_GEOMETRY_FIELDS';
  if (candidate.producerIdentity === candidate.verifierIdentity)
    return 'REJECT_PRODUCER_SELF_VERIFICATION';
  return 'CANDIDATE_CORROSION_GEOMETRY_CONTRACT_BOUND';
}

const base = {
  severity: 0.7,
  vertexPositionsChanged: true,
  referenceMeshDigest: 'mesh-before',
  deformedMeshDigest: 'mesh-after',
  greenSpot: false,
  maxOutwardDisplacement: 0.9,
  orientationCauseBound: false,
  topSideDistributionDistance: 0.08,
  assetFamilies: requiredFamilies,
  orientations: requiredOrientations,
  shaderFieldDigest: 'corrosion-field-r2',
  geometryFieldDigest: 'corrosion-field-r2',
  producerIdentity: 'material-producer',
  verifierIdentity: 'independent-verifier',
};

const fixtures = [
  {
    id: 'color-only-heavy-rust',
    candidate: { ...base, vertexPositionsChanged: false, deformedMeshDigest: 'mesh-before' },
    expected: 'REJECT_SHADER_ONLY_CORROSION',
  },
  {
    id: 'green-spot-color-without-protrusion',
    candidate: { ...base, greenSpot: true, maxOutwardDisplacement: 0 },
    expected: 'REJECT_GREEN_SPOT_WITHOUT_PROTRUSION',
  },
  {
    id: 'top-face-stretch-artifact',
    candidate: { ...base, topSideDistributionDistance: 0.62 },
    expected: 'REJECT_UNEXPLAINED_FACE_ORIENTATION_DRIFT',
  },
  {
    id: 'plate-only-not-shared-with-lock-and-ac',
    candidate: { ...base, assetFamilies: ['steel-plate'] },
    expected: 'REJECT_UNPROVEN_ASSET_FAMILY_TRANSFER',
  },
  {
    id: 'material-and-geometry-use-different-corrosion-fields',
    candidate: { ...base, geometryFieldDigest: 'unbound-field' },
    expected: 'REJECT_UNBOUND_MATERIAL_GEOMETRY_FIELDS',
  },
  {
    id: 'producer-self-verifies',
    candidate: { ...base, verifierIdentity: 'material-producer' },
    expected: 'REJECT_PRODUCER_SELF_VERIFICATION',
  },
  {
    id: 'shared-field-real-displacement-orientation-slices-independent-verifier',
    candidate: base,
    expected: 'CANDIDATE_CORROSION_GEOMETRY_CONTRACT_BOUND',
  },
];

const results = fixtures.map(({ id, candidate, expected }) => {
  const actual = validate(candidate);
  assert.equal(actual, expected, id);
  return { id, expected, actual, passed: actual === expected };
});

const output = {
  probeId: 'N336-CORROSION-GEOMETRY-DISPLACEMENT-AND-ORIENTATION',
  boundedQuestion: 'Can one corrosion state prove real outward geometry displacement across plate, lock and air-conditioner shell without shader-only fallback or unexplained top/side morphology drift?',
  decision: 'CANDIDATE_CONTRACT_PASSED_SYNTHETIC_REPLAY_NOT_PRODUCTION_VALIDATED',
  sourceFacts,
  requiredFamilies,
  requiredOrientations,
  results,
  passed: results.every((result) => result.passed),
  limitations: [
    'Synthetic contract replay only; no production Mother artifact was available in the coordination issue.',
    'The 0.15 orientation-distance threshold is a falsifiable audition value, not Canonical Truth.',
    'The OSTI report supports volume-growth and stress semantics only; it does not prescribe a renderer, texture, or displacement magnitude.',
    'Runtime speed and edge-rust performance are outside this bounded question.',
  ],
};

console.log(JSON.stringify(output, null, 2));
