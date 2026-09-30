import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const candidate = JSON.parse(fs.readFileSync(path.join(here, 'CANDIDATE_MULTIVIEW_APPENDAGE_IDENTITY_001.json'), 'utf8'));

const topology = [
  ['P1L', 'L', 'CHELA'], ['P1R', 'R', 'CHELA'],
  ['P2L', 'L', 'WALK_CLIMB'], ['P2R', 'R', 'WALK_CLIMB'],
  ['P3L', 'L', 'WALK_CLIMB'], ['P3R', 'R', 'WALK_CLIMB'],
  ['P4L', 'L', 'REDUCED_CLAWED'], ['P4R', 'R', 'REDUCED_CLAWED'],
  ['P5L', 'L', 'RESPIRATORY_GROOMING'], ['P5R', 'R', 'RESPIRATORY_GROOMING']
].map(([appendageId, side, role]) => ({ appendageId, side, role, attachmentRegion: 'LOCKED_BODY_REGION', segmentCount: 7 }));

const makeView = (viewId, visibility = {}) => ({
  viewId,
  records: topology.map(record => ({ ...record, visibility: visibility[record.appendageId] ?? 'VISIBLE' }))
});

const clone = value => JSON.parse(JSON.stringify(value));
const baseViews = () => [
  makeView('front', { P5L: 'OCCLUDED', P5R: 'OCCLUDED' }),
  makeView('rear'),
  makeView('left', { P1R: 'OCCLUDED', P2R: 'OCCLUDED', P5R: 'OCCLUDED' }),
  makeView('right', { P1L: 'OCCLUDED', P2L: 'OCCLUDED', P5L: 'OCCLUDED' })
];

function mutate(mutator) {
  const views = baseViews();
  mutator(views);
  return views;
}

const cases = [
  { id: 'consistent-hidden-p5', expected: candidate.verdicts.pass, views: baseViews() },
  { id: 'missing-id-without-occlusion', expected: candidate.verdicts.conflict, views: mutate(v => { v[0].records = v[0].records.filter(r => r.appendageId !== 'P3L'); }) },
  { id: 'extra-id', expected: candidate.verdicts.conflict, views: mutate(v => { v[1].records.push({ ...topology[0], appendageId: 'P6L', visibility: 'VISIBLE' }); }) },
  { id: 'duplicate-id', expected: candidate.verdicts.conflict, views: mutate(v => { v[2].records.push(clone(v[2].records[0])); }) },
  { id: 'side-swap', expected: candidate.verdicts.conflict, views: mutate(v => { v[0].records.find(r => r.appendageId === 'P2L').side = 'R'; }) },
  { id: 'role-drift', expected: candidate.verdicts.conflict, views: mutate(v => { v[1].records.find(r => r.appendageId === 'P4L').role = 'CHELA'; }) },
  { id: 'attachment-drift', expected: candidate.verdicts.conflict, views: mutate(v => { v[2].records.find(r => r.appendageId === 'P3R').attachmentRegion = 'DRIFTED_REGION'; }) },
  { id: 'segment-count-drift', expected: candidate.verdicts.conflict, views: mutate(v => { v[3].records.find(r => r.appendageId === 'P1L').segmentCount = 6; }) },
  { id: 'explicit-crop', expected: candidate.verdicts.incomplete, views: mutate(v => { v[2].records.find(r => r.appendageId === 'P5R').visibility = 'CROPPED'; }) },
  { id: 'unknown-visibility', expected: candidate.verdicts.incomplete, views: mutate(v => { v[3].records.find(r => r.appendageId === 'P4L').visibility = 'UNKNOWN'; }) }
];

function evaluate(views) {
  const expected = new Map(topology.map(record => [record.appendageId, record]));
  const conflicts = [];
  const incomplete = [];

  for (const view of views) {
    const seen = new Set();
    for (const record of view.records) {
      if (seen.has(record.appendageId)) conflicts.push(`${view.viewId}:duplicate:${record.appendageId}`);
      seen.add(record.appendageId);
      const locked = expected.get(record.appendageId);
      if (!locked) {
        conflicts.push(`${view.viewId}:extra:${record.appendageId}`);
        continue;
      }
      for (const field of ['side', 'role', 'attachmentRegion', 'segmentCount']) {
        if (record[field] !== locked[field]) conflicts.push(`${view.viewId}:${field}:${record.appendageId}`);
      }
      if (record.visibility === 'CROPPED' || record.visibility === 'UNKNOWN') incomplete.push(`${view.viewId}:${record.visibility}:${record.appendageId}`);
      if (!candidate.visibilityStates.includes(record.visibility)) conflicts.push(`${view.viewId}:invalid-visibility:${record.appendageId}`);
    }
    for (const appendageId of expected.keys()) {
      if (!seen.has(appendageId)) conflicts.push(`${view.viewId}:missing:${appendageId}`);
    }
  }

  const verdict = conflicts.length
    ? candidate.verdicts.conflict
    : incomplete.length
      ? candidate.verdicts.incomplete
      : candidate.verdicts.pass;
  return { verdict, conflicts, incomplete };
}

const results = cases.map(test => {
  const actual = evaluate(test.views);
  return { id: test.id, expected: test.expected, actual: actual.verdict, passed: actual.verdict === test.expected, evidence: actual };
});

const output = {
  runId: 'N46-multiview-appendage-identity-synthetic-replay',
  generatedAt: new Date().toISOString(),
  candidateId: candidate.candidateId,
  fixtureNature: 'SYNTHETIC_CONTRACT_REPLAY_NOT_BIOLOGICAL_VALIDATION',
  summary: { total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length },
  actualUserSourceSet: {
    verdict: 'USER_REJECTED_SOURCE_SET_NOT_ELIGIBLE',
    exactDiscrepancy: candidate.sourceSet.independentExactDiscrepancy,
    modelGenerationAllowed: false
  },
  results
};

fs.writeFileSync(path.join(here, 'multiview_appendage_identity_result_n46.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.summary));
if (output.summary.failed) process.exitCode = 1;
