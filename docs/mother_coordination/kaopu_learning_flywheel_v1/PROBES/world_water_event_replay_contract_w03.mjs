#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const sha256 = (value) => createHash('sha256').update(stable(value)).digest('hex');

function seal(event) {
  const copy = structuredClone(event);
  delete copy.payloadSha256;
  return { ...copy, payloadSha256: sha256(copy) };
}

function validateEvent(event) {
  if (!event.source || !event.id) throw new Error('source-and-id-required');
  if (!['mutation', 'report'].includes(event.kind)) throw new Error('event-kind-required');
  if (!Number.isFinite(event.phenomenonStart) || !Number.isFinite(event.phenomenonEnd) || event.phenomenonEnd <= event.phenomenonStart) {
    throw new Error('valid-phenomenon-interval-required');
  }
  if (!Number.isInteger(event.revision) || event.revision < 1) throw new Error('positive-revision-required');
  const copy = structuredClone(event);
  delete copy.payloadSha256;
  if (event.payloadSha256 !== sha256(copy)) throw new Error('payload-hash-mismatch');
  if (event.kind === 'mutation' && !Number.isFinite(event.quantityM3)) throw new Error('finite-mutation-quantity-required');
  return true;
}

function ingest(events) {
  const byIdentity = new Map();
  let duplicateCount = 0;
  for (const event of events) {
    validateEvent(event);
    const key = `${event.source}|${event.id}`;
    const prior = byIdentity.get(key);
    if (prior) {
      if (stable(prior) !== stable(event)) throw new Error('identity-payload-collision');
      duplicateCount += 1;
      continue;
    }
    byIdentity.set(key, structuredClone(event));
  }
  return { byIdentity, duplicateCount };
}

function canonicalMutations(events) {
  const { byIdentity, duplicateCount } = ingest(events);
  const successor = new Map();

  for (const [key, event] of byIdentity) {
    if (!event.supersedes) continue;
    const predecessor = byIdentity.get(event.supersedes);
    if (!predecessor) throw new Error('missing-superseded-event');
    if (successor.has(event.supersedes)) throw new Error('supersession-fork');
    if (event.revision <= predecessor.revision) throw new Error('revision-must-increase');
    if (event.source !== predecessor.source || event.subject !== predecessor.subject || event.type !== predecessor.type ||
        event.phenomenonStart !== predecessor.phenomenonStart || event.phenomenonEnd !== predecessor.phenomenonEnd) {
      throw new Error('revision-scope-mismatch');
    }
    successor.set(event.supersedes, key);
  }

  for (const start of byIdentity.keys()) {
    const seen = new Set();
    let cursor = start;
    while (successor.has(cursor)) {
      if (seen.has(cursor)) throw new Error('supersession-cycle');
      seen.add(cursor);
      cursor = successor.get(cursor);
    }
  }

  const active = [...byIdentity.entries()]
    .filter(([key, event]) => event.kind === 'mutation' && !successor.has(key))
    .map(([, event]) => event)
    .sort((a, b) => a.phenomenonStart - b.phenomenonStart || a.phenomenonEnd - b.phenomenonEnd || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  return { active, duplicateCount, identityCount: byIdentity.size };
}

function apply(state, event) {
  const proposed = state.storageM3 + event.quantityM3;
  if (proposed < 0) throw new Error('negative-storage');
  const overflow = Math.max(0, proposed - state.capacityM3);
  return { storageM3: Math.min(state.capacityM3, proposed), capacityM3: state.capacityM3, overflowM3: state.overflowM3 + overflow };
}

function replay(events, initial = { storageM3: 100, capacityM3: 112, overflowM3: 0 }) {
  const canonical = canonicalMutations(events);
  const final = canonical.active.reduce(apply, structuredClone(initial));
  return { ...canonical, final };
}

const base = {
  source: 'urn:kaopu:weather-mother',
  type: 'org.kaopu.water.flux.v1',
  subject: 'field-A',
  kind: 'mutation',
  revision: 1,
  resultTime: '2026-09-17T00:00:00Z'
};
const e0 = seal({ ...base, id: 'rain-000', phenomenonStart: -900, phenomenonEnd: 0, quantityM3: 3 });
const e1 = seal({ ...base, id: 'rain-001', phenomenonStart: 0, phenomenonEnd: 900, quantityM3: 10 });
const e2 = seal({ ...base, id: 'rain-002', phenomenonStart: 900, phenomenonEnd: 1800, quantityM3: 5 });
const e3 = seal({ ...base, source: 'urn:kaopu:landscape-mother', id: 'runoff-001', phenomenonStart: 1800, phenomenonEnd: 2700, quantityM3: -4 });
const e2r = seal({ ...base, id: 'rain-002-r2', phenomenonStart: 900, phenomenonEnd: 1800, quantityM3: 4, revision: 2, supersedes: `${e2.source}|${e2.id}`, resultTime: '2026-09-17T00:20:00Z' });
const report = seal({ ...base, source: 'urn:kaopu:farmland-mother', id: 'report-001', type: 'org.kaopu.water.report.v1', kind: 'report', phenomenonStart: 0, phenomenonEnd: 2700, quantityM3: 999, resultTime: '2026-09-17T00:45:00Z' });

const checks = [];
const check = (name, pass, detail = null) => checks.push({ name, pass: Boolean(pass), detail });
function reject(name, fn, expected) {
  let actual = null;
  try { fn(); } catch (error) { actual = error.message; }
  check(name, actual === expected, { expected, actual });
}

const ordered = replay([e0, e1, e2, e3]);
const unordered = replay([e3, e1, e0, e2]);
const duplicate = replay([e0, e1, e2, e2, e3]);
const withoutLate = replay([e1, e2, e3]);
const directLateAppend = apply(withoutLate.final, e0);
const revised = replay([e2r, e3, e1, e0, e2, report]);

check('phenomenon-time replay reaches capacity-safe final state', ordered.final.storageM3 === 108 && ordered.final.overflowM3 === 6, ordered.final);
check('arrival order does not change canonical replay', stable(unordered.final) === stable(ordered.final), { ordered: ordered.final, unordered: unordered.final });
check('identical redelivery is an idempotent no-op', stable(duplicate.final) === stable(ordered.final) && duplicate.duplicateCount === 1, { final: duplicate.final, duplicateCount: duplicate.duplicateCount });
check('late event requires replay because direct append changes nonlinear state', directLateAppend.storageM3 === 111 && ordered.final.storageM3 === 108, { directLateAppend, replayed: ordered.final });
check('explicit revision replaces rather than adds to predecessor', revised.final.storageM3 === 108 && revised.final.overflowM3 === 5 && revised.active.length === 4, { final: revised.final, activeIds: revised.active.map((event) => event.id) });
check('report event is retained as evidence but cannot mutate storage', revised.identityCount === 6 && revised.active.every((event) => event.kind === 'mutation'), { identityCount: revised.identityCount, activeCount: revised.active.length });
check('correction may arrive before predecessor and resolves after ledger validation', revised.active.some((event) => event.id === 'rain-002-r2'), null);
check('same id from a distinct source is a distinct identity', replay([e1, seal({ ...e3, id: e1.id })]).identityCount === 2, null);

const collision = seal({ ...e2, quantityM3: 6 });
reject('same source and id with changed payload is rejected', () => replay([e2, collision]), 'identity-payload-collision');
reject('payload tampering is rejected', () => replay([{ ...e1, quantityM3: 11 }]), 'payload-hash-mismatch');
reject('missing superseded event fails closed', () => replay([e2r]), 'missing-superseded-event');
reject('revision must strictly increase', () => replay([e2, seal({ ...e2r, revision: 1 })]), 'revision-must-increase');
reject('revision scope cannot silently change interval', () => replay([e2, seal({ ...e2r, phenomenonEnd: 1900 })]), 'revision-scope-mismatch');
reject('two successors of one event are rejected', () => replay([e2, e2r, seal({ ...e2r, id: 'rain-002-r2b', quantityM3: 3 })]), 'supersession-fork');

const cycleA0 = seal({ ...base, id: 'cycle-a', phenomenonStart: 0, phenomenonEnd: 900, quantityM3: 1, revision: 2, supersedes: `${base.source}|cycle-b` });
const cycleB0 = seal({ ...base, id: 'cycle-b', phenomenonStart: 0, phenomenonEnd: 900, quantityM3: 1, revision: 3, supersedes: `${base.source}|cycle-a` });
reject('supersession cycles are rejected', () => replay([cycleA0, cycleB0]), 'revision-must-increase');
reject('zero-duration phenomenon interval is rejected', () => replay([seal({ ...base, id: 'bad-time', phenomenonStart: 0, phenomenonEnd: 0, quantityM3: 1 })]), 'valid-phenomenon-interval-required');
reject('mutation must carry finite volume', () => replay([seal({ ...base, id: 'bad-value', phenomenonStart: 0, phenomenonEnd: 900, quantityM3: null })]), 'finite-mutation-quantity-required');

const passed = checks.filter((item) => item.pass).length;
const fixture = { e0, e1, e2, e3, e2r, report };
const result = {
  schema: 'kaopu-world-water-event-replay-contract-result/w03',
  status: passed === checks.length ? 'pass' : 'fail',
  evidenceClass: 'official CloudEvents/OGC time semantics plus synthetic CPU event-ledger counterexamples',
  observationRoots: [
    'CNCF CloudEvents 1.0.2 source-plus-id duplicate identity semantics',
    'OGC SensorThings API 1.1 phenomenonTime and resultTime semantics',
    'Node.js nonlinear bounded-storage replay fixture; reproducible derivation, not hydrologic runtime evidence'
  ],
  fixtureSha256: sha256(fixture),
  summary: {
    checks: checks.length,
    passed,
    failed: checks.length - passed,
    orderedFinalStorageM3: ordered.final.storageM3,
    orderedOverflowM3: ordered.final.overflowM3,
    directLateAppendStorageM3: directLateAppend.storageM3,
    revisedOverflowM3: revised.final.overflowM3
  },
  currentBestView: 'Use source-plus-id as immutable delivery identity, bind a payload hash, keep phenomenon interval distinct from result/arrival time, treat exact redelivery as a no-op, and express corrections as explicit acyclic supersession. Late unique events and revisions trigger deterministic replay from a checkpoint; they are never appended to current nonlinear state or added beside the value they replace.',
  boundary: 'This verifies event-ledger and replay semantics only. It does not provide exactly-once transport, choose checkpoint retention, validate real hydrology, execute a Mother runtime, or prove adoption.',
  checks
};

const output = process.argv[2];
if (output) writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exitCode = 1;
