import fs from 'node:fs';
import crypto from 'node:crypto';

const fixturePath = new URL('./derived_json_identity_fixture_n35.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function assertFinite(value, path = '$') {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`non-finite JSON number at ${path}`);
  }
  if (Array.isArray(value)) value.forEach((v, i) => assertFinite(v, `${path}[${i}]`));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    Object.entries(value).forEach(([k, v]) => assertFinite(v, `${path}.${k}`));
  }
}

// Probe-only JCS-compatible subset: JSON.parse, finite IEEE-754 numbers,
// recursive UTF-16 property sorting, JSON.stringify primitives, UTF-8 hashing.
function canonicalSubset(raw) {
  const parsed = JSON.parse(raw);
  assertFinite(parsed);
  const sort = value => {
    if (Array.isArray(value)) return value.map(sort);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value).sort().map(k => [k, sort(value[k])]));
    }
    return value;
  };
  return JSON.stringify(sort(parsed));
}

const checks = [];
function check(id, actual, expected) {
  const passed = Object.is(actual, expected);
  checks.push({ id, actual, expected, passed });
  if (!passed) throw new Error(`${id}: expected ${expected}, got ${actual}`);
}

const h = fixture.historicalObservation;
check('historical-size-mismatch-holds-byte-identity', h.local.bytes !== h.ci.bytes, true);
check('historical-semantic-identity-remains-unknown-without-pair', h.payloadPairAvailableToN35, false);
check('independent-numerical-evidence-is-preserved', h.sourceArraysPreservedByIndependentChecks && h.numericalAndBrowserChecksPassed, true);

const controlResults = fixture.syntheticControls.map(c => {
  const leftCanonical = canonicalSubset(c.left);
  const rightCanonical = canonicalSubset(c.right);
  const rawEqual = c.left === c.right;
  const canonicalEqual = leftCanonical === rightCanonical;
  return {
    id: c.id,
    rawEqual,
    canonicalEqual,
    leftCanonicalSha256: sha256(leftCanonical),
    rightCanonicalSha256: sha256(rightCanonical)
  };
});

for (const result of controlResults) {
  const expected = fixture.syntheticControls.find(c => c.id === result.id);
  check(`${result.id}-raw`, result.rawEqual, expected.expectRawEqual);
  check(`${result.id}-canonical`, result.canonicalEqual, expected.expectCanonicalEqual);
}

check('byte-and-semantic-claims-are-not-interchangeable',
  controlResults[0].rawEqual === false && controlResults[0].canonicalEqual === true, true);

const result = {
  schema: 'kaopu.derived-json-identity-probe/1.0',
  round: 'N35',
  probeScope: 'historical metadata replay plus synthetic JCS-compatible-subset controls; not a full RFC 8785 conformance implementation',
  historicalDecision: {
    byteIdentity: 'HOLD_BYTE_IDENTITY_MISMATCH',
    semanticObjectIdentity: 'UNKNOWN_PAYLOAD_PAIR_NOT_AVAILABLE',
    numericalBehaviorEvidence: 'VERIFIED_INDEPENDENT_EVIDENCE_PRESERVED',
    rootCause: 'UNKNOWN_NOT_INFERRED'
  },
  candidateClaimModes: {
    exactBytes: 'require same media type, bytes and same-algorithm digest of both payloads',
    exactSemanticObject: 'require both payloads plus pinned canonicalization profile and matching canonical digest',
    numericalEquivalence: 'require schema-bound quantities, units, ordering and explicit tolerance policy; never relabel as byte identity'
  },
  controlResults,
  checks,
  summary: {
    passed: checks.filter(x => x.passed).length,
    total: checks.length,
    allPassed: checks.every(x => x.passed)
  }
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
