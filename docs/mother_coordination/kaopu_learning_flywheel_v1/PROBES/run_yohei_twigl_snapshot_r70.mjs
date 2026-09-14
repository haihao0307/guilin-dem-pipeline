import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const snapshotId = '-OGsvumeLdZM1eg3CtFG';
const snapshotUrl =
  `https://twigl-f67a0.firebaseio.com/snapshot/${snapshotId}.json`;
const xPostUrl =
  'https://x.com/YoheiNishitsuji/status/1880561598982668452';
const xReplyUrl =
  'https://x.com/YoheiNishitsuji/status/1880562010603311179';
const expectedSource = {
  sha256: '5253b2a44baa9f99af79cd04d85747ac6bb515c021562c7558e841446a4c3fea',
  utf8Bytes: 265,
  codePoints: 265,
};

const response = await fetch(snapshotUrl, {
  headers: { accept: 'application/json' },
});
if (!response.ok) {
  throw new Error(`snapshot fetch failed: ${response.status} ${response.statusText}`);
}

const snapshot = await response.json();
const source = snapshot?.graphics?.source;
const mode = snapshot?.graphics?.mode;
const sha256 =
  typeof source === 'string'
    ? createHash('sha256').update(source, 'utf8').digest('hex')
    : null;
const utf8Bytes = typeof source === 'string' ? Buffer.byteLength(source, 'utf8') : null;
const codePoints = typeof source === 'string' ? [...source].length : null;
const asciiDoubleDecrementCount =
  typeof source === 'string' ? (source.match(/--/g) ?? []).length : null;
const unicodeDashCount =
  typeof source === 'string' ? (source.match(/[\u2012-\u2015]/g) ?? []).length : null;
const dateSeconds = snapshot?.date;
const dateIso =
  Number.isSafeInteger(dateSeconds) && dateSeconds > 0
    ? new Date(dateSeconds * 1000).toISOString()
    : null;

const checks = {
  httpJson: (response.headers.get('content-type') ?? '').includes('application/json'),
  payloadObject: snapshot !== null && typeof snapshot === 'object',
  graphicsObject: snapshot?.graphics !== null && typeof snapshot?.graphics === 'object',
  sourceString: typeof source === 'string',
  modeGeekest300: mode === 7,
  sourceHashMatchesObservedXText: sha256 === expectedSource.sha256,
  sourceUtf8LengthMatchesObservedXText: utf8Bytes === expectedSource.utf8Bytes,
  sourceCodePointLengthMatchesObservedXText: codePoints === expectedSource.codePoints,
  asciiDoubleDecrementTokensPresent: asciiDoubleDecrementCount === 2,
  noTypographyDashSubstitution: unicodeDashCount === 0,
  soundAbsent: snapshot?.sound === null,
  timestampValid: dateIso !== null,
};

const failures = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

const result = {
  schema: 'kaopu-yohei-twigl-snapshot-probe/r70',
  status: failures.length === 0 ? 'pass' : 'fail',
  checkedAt: new Date().toISOString(),
  question:
    'Does the author-linked twigl snapshot lock the exact source bytes and geekest (300 es) mode?',
  sourcePolicy:
    'The artwork source is not emitted. Only hashes, lengths, token counts, mode and non-source metadata are persisted.',
  inputs: {
    snapshotId,
    snapshotUrl,
    xPostUrl,
    xReplyUrl,
    expectedSourceFingerprintFromVisibleAuthorPost: expectedSource,
    historicalHostCommit: '969491b285ba217fd895132a466ee6b3128243f3',
  },
  observations: {
    httpStatus: response.status,
    contentType: response.headers.get('content-type'),
    graphicsMode: mode,
    graphicsModeMeaning:
      mode === 7 ? 'geekest (300 es), per pinned twigl schema' : 'unexpected',
    sourceFingerprint: { sha256, utf8Bytes, codePoints },
    asciiDoubleDecrementCount,
    unicodeDashCount,
    soundPresent: snapshot?.sound !== null,
    snapshotDateSeconds: dateSeconds,
    snapshotDateIso: dateIso,
    mutableCountersObservedButExcludedFromIdentity: {
      viewCountType: typeof snapshot?.viewCount,
      starCountType: typeof snapshot?.starCount,
    },
  },
  checks,
  failures,
  boundaries: {
    snapshotIdentity:
      'The author reply and snapshot ID are an author-publication root; the Firebase payload is a twigl service root.',
    deployment:
      'The snapshot establishes stored source and mode, not the exact JavaScript bundle, browser, GPU or framebuffer used to record the posted video.',
    licensing:
      'The twigl host is MIT-licensed; artwork reuse/distribution permission remains Unknown.',
    evidenceIndependence:
      'The Node check is a replay/derivation over the public snapshot and is not an independent visual or physical Observation Root.',
  },
};

await writeFile(
  new URL('./yohei_twigl_snapshot_result_r70.json', import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
