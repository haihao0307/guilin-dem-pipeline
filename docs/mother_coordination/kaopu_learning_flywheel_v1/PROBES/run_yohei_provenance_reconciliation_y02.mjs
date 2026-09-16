#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(process.cwd());
const base = resolve(root, 'docs/mother_coordination/kaopu_learning_flywheel_v1');
const readJson = p => JSON.parse(readFileSync(resolve(base, p), 'utf8'));
const readText = p => readFileSync(resolve(base, p), 'utf8');
const sha256 = text => createHash('sha256').update(text).digest('hex');

const r70 = readJson('PROBES/yohei_twigl_snapshot_result_r70.json');
const r71 = readJson('PROBES/yohei_twigl_runtime_result_r71.json');
const y01 = readJson('PROBES/yohei_core_audit_y01_result.json');
const r67Log = readText('LEARNING_LOG/2026-09-14_YOHEI_MICROSCOPE_SOURCE_AUDIT_R67.md');
const y01Log = readText('LEARNING_LOG/2026-09-16_YOHEI_Y01_SOURCE_TO_SHAPE.md');

const postId = '1880561598982668452';
const sourceHash = '5253b2a44baa9f99af79cd04d85747ac6bb515c021562c7558e841446a4c3fea';
const codrops = 'https://tympanus.net/codrops/2025/02/18/rendering-the-simulation-theory-exploring-fractals-glsl-and-the-nature-of-reality/';

let articleStatus = 0;
let articleHtml = '';
let articleFetchError = null;
try {
  const response = await fetch(codrops, {
    headers: { 'user-agent': 'KAOPU-Y02-source-audit/1.0' },
    signal: AbortSignal.timeout(20000)
  });
  articleStatus = response.status;
  articleHtml = await response.text();
} catch (error) {
  articleFetchError = String(error);
}

const titleIndex = articleHtml.indexOf('Macroscopic microscope');
const postIndex = articleHtml.indexOf(postId);
const checks = {
  liveAuthorArticleHttp200: articleStatus === 200,
  liveAuthorArticleBindsTitleToPost: titleIndex >= 0 && postIndex >= 0 &&
    Math.abs(titleIndex - postIndex) < 20000,
  r67NamesMacroscopicMicroscope: r67Log.includes('Macroscopic microscope'),
  r70AuthorPostIdentityMatches: r70.inputs?.xPostId === postId,
  r70SourceFingerprintLocked: r70.observations?.sourceFingerprint?.sha256 === sourceHash &&
    r70.observations?.sourceFingerprint?.utf8Bytes === 265 &&
    r70.observations?.sourceFingerprint?.codePoints === 265,
  r70SnapshotMatchesVisibleAuthorPost: r70.checks?.sourceHashMatchesObservedXText === true &&
    r70.checks?.sourceUtf8LengthMatchesObservedXText === true,
  r70DoesNotPersistArtworkSource: typeof r70.sourcePolicy === 'string' &&
    r70.sourcePolicy.includes('not emitted'),
  r71InheritsSameSnapshotAndSource: r71.sourceLocks?.snapshotSourceSha256 === sourceHash &&
    r71.sourceLocks?.snapshotId === r70.inputs?.snapshotId &&
    r71.sourceFingerprints?.compact_undefined?.sha256 === sourceHash,
  r71LocksFullyPreprocessedProgram: r71.preprocessedFingerprints?.compact_undefined?.sha256 ===
    'c11c4581f7e207f87563482dcb401abd6a3a85502f7d4e8a9e78846c150ffda8' &&
    r71.preprocessedFingerprints?.compact_undefined?.utf8Bytes === 9038,
  y01UsesSameAuthorArticle: y01.source === codrops,
  y01ReproducesSeventeenScaleConsequence: y01.checks?.published_inner_loop_has_17_terms === true &&
    y01.metrics?.scales?.length === 17 &&
    y01.metrics?.scales?.at(-1) === 65536,
  y01RecordDidNotInheritR70R71: !/R70|R71|5253b2a44baa9f99/.test(y01Log)
};

const passed = Object.values(checks).filter(Boolean).length;
const result = {
  schema: 'kaopu-yohei-provenance-reconciliation/y02',
  status: passed === Object.keys(checks).length ?
    'Observation: source and stored-evidence reconciliation passed' :
    'Candidate: reconciliation incomplete',
  observedAt: new Date().toISOString(),
  question: 'Does Y01 still lack the exact Macroscopic microscope source/host evidence, or had R70-R71 already closed that narrower gap?',
  inputs: {
    liveAuthorArticle: {
      url: codrops,
      httpStatus: articleStatus,
      byteLength: Buffer.byteLength(articleHtml),
      sha256: articleHtml ? sha256(articleHtml) : null,
      fetchError: articleFetchError,
      titleIndex,
      embeddedPostIdIndex: postIndex
    },
    r67LogSha256: sha256(r67Log),
    y01LogSha256: sha256(y01Log),
    r70ResultBlobIdentity: {
      snapshotId: r70.inputs?.snapshotId,
      xPostId: r70.inputs?.xPostId,
      sourceSha256: r70.observations?.sourceFingerprint?.sha256
    },
    r71RuntimeIdentity: r71.runtime,
    y01ProbeSha256: y01.probe_sha256
  },
  checks,
  passed,
  total: Object.keys(checks).length,
  classification: {
    macroscopicMicroscopeSource:
      'Observation: the live author article binds Macroscopic microscope to X post 1880561598982668452; R70 locked that post’s author-linked 265-byte twigl snapshot, and R71 locked its generated GLSL and one software runtime.',
    y01BlanketGap:
      'Rejected for the Macroscopic microscope source/host question because Y01 did not inherit R70-R71.',
    numberedScreenshotIdentity:
      'Unknown: Y01 did not preserve a checkable link proving that the separately described “#261 the moon surface color” screenshot is the same publication as X post 1880561598982668452.',
    runtime:
      'Candidate partial: R71 is limited to Chromium 143 / ANGLE Vulkan SwiftShader and cannot prove the author recording or cross-GPU behavior.',
    licensing:
      'Unknown: source identity does not grant artwork adaptation or redistribution permission.'
  },
  evidenceRoots: {
    authorPublication: ['live Yohei-authored Codrops article', 'X post/reply receipt inherited from R70'],
    twiglService: ['R70 snapshot receipt'],
    twiglRepositoryAndRuntime: ['R69 host commit', 'R71 locked wrapper/runtime'],
    derivation: 'This Y02 check reconciles existing receipts and is not a new visual, GPU, physical, or independent source root.'
  },
  nextGap:
    'Preserve the closed Macroscopic microscope provenance gate; separately obtain a checkable source link for the numbered screenshot, or keep its identity Unknown. For portability, replay R71 unchanged on a genuinely different hardware WebGL implementation.',
  forbiddenPromotions: [
    'Calling the Y01 CPU kernel a new exact-source acquisition',
    'Equating a screenshot title with the locked X post without a provenance link',
    'Treating SwiftShader equality as cross-GPU proof',
    'Redistributing the artwork source from a fingerprint receipt'
  ]
};

const outIndex = process.argv.indexOf('--output');
if (outIndex >= 0) {
  const out = resolve(root, process.argv[outIndex + 1]);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result, null, 2));
process.exit(passed === Object.keys(checks).length ? 0 : 1);
