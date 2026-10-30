import assert from 'node:assert/strict';

// Pinned source facts from shaise/FreeCAD_FastenersWB@
// fddd07af422b7d3a69098b32333711c5eeae184c.
// This is a small audit fixture, not a redistribution of the upstream catalog.
const source = {
  repository: 'shaise/FreeCAD_FastenersWB',
  commit: 'fddd07af422b7d3a69098b32333711c5eeae184c',
  tableBlob: 'fd371954e8ac4b03c275dccdf87c663ef38f4df1',
  aliasBlob: '6a0ddf7cf981be6e1c5000253fa0a941eaa35da3',
  license: 'GPL-2.0-or-later',
};

const iso4017LengthRows = [
  { nominal: 130, min: 129.2, max: 130.8 },
  { nominal: 140, min: 139.2, max: 130.8 },
  { nominal: 150, min: 149.2, max: 150.8 },
];

const aliases = {
  iconAlias: { DIN933: 'ISO4017' },
  typeAlias: { ISO299: 'DIN508' },
};

const requiredIdentity = [
  'authority',
  'designation',
  'edition',
  'family',
  'nominalDiameter',
  'pitch',
  'nominalLength',
  'toleranceClass',
  'materialGrade',
  'finish',
  'sourceRevision',
  'sourceTableDigest',
];

function validateLengthRow(row) {
  const failures = [];
  if (!(row.min <= row.max)) failures.push('MIN_EXCEEDS_MAX');
  if (!(row.min <= row.nominal && row.nominal <= row.max)) {
    failures.push('NOMINAL_OUTSIDE_ALLOWED_INTERVAL');
  }
  return failures;
}

const rowResults = iso4017LengthRows.map((row) => ({
  ...row,
  failures: validateLengthRow(row),
}));

const checks = {
  positive130Passes: rowResults[0].failures.length === 0,
  corrupted140Rejected: rowResults[1].failures.includes('MIN_EXCEEDS_MAX') &&
    rowResults[1].failures.includes('NOMINAL_OUTSIDE_ALLOWED_INTERVAL'),
  positive150Passes: rowResults[2].failures.length === 0,
  iconAliasIsNotTypeAlias: aliases.iconAlias.DIN933 === 'ISO4017' &&
    !Object.hasOwn(aliases.typeAlias, 'DIN933'),
  identityContractHasSourceAndEdition: requiredIdentity.includes('edition') &&
    requiredIdentity.includes('sourceRevision') &&
    requiredIdentity.includes('sourceTableDigest'),
  sourcePinned: source.commit.length === 40 && source.tableBlob.length === 40,
};

for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, name);

const result = {
  probeId: 'N214-MECHANICAL-FASTENER-STANDARD-CONTRACT',
  source,
  boundedQuestion: 'Can a maintained third-party fastener catalog be used as KAOPU canonical dimensional truth without an independent provenance and invariant gate?',
  decision: 'HOLD_THIRD_PARTY_FASTENER_TABLE_NOT_CANONICAL_TRUTH',
  teacherStatus: 'TEACHER_CANDIDATE',
  teacherScope: 'catalog schema, standard identity keys, diameter-length compatibility structure, and alias-scope separation only',
  rejectedScope: 'copying upstream dimensions or BRep/thread geometry into production as authoritative truth',
  rowResults,
  aliases,
  requiredIdentity,
  checks,
  passed: Object.values(checks).every(Boolean),
  limitations: [
    'The probe validates a pinned source-contract excerpt, not the ISO 4017 standard itself.',
    'It does not verify any production Mechanical Mother asset.',
    'GPL source and standards-derived tables must not be copied into KAOPU without rights review.',
    'Normative dimensions require an authorized standard or manufacturer source plus independent checks.',
  ],
};

console.log(JSON.stringify(result, null, 2));
