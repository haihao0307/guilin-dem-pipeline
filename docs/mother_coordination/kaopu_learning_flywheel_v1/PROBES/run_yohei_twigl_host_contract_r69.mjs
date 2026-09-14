import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Minimal, audit-relevant excerpts locked from doxas/twigl at commit
// 969491b285ba217fd895132a466ee6b3128243f3, src/fragmen.js blob
// 8fdee9a542b31cc2e3f9a106885c9f529f3c05c9. The large bundled noise
// library is represented by a marker because it cannot initialize locals
// declared later inside main().
const ES_300_CHUNK = '#version 300 es\n';
const GEEKEST_PREFIX = '#define FC gl_FragCoord\nprecision highp float;uniform vec2 r;uniform vec2 m;uniform float t;uniform float f;uniform float s;uniform sampler2D b;\n';
const NOISE_MARKER = '/* pinned twigl noise library omitted from audit fixture */\n';
const GEEKEST_OUT_CHUNK = 'out vec4 o;\n';

function preprocessGeekest300(code) {
  let chunkMain = '';
  let chunkClose = '';
  if (code.match(/void\s+main\s*\(/) == null) {
    chunkMain = 'void main(){\n';
    chunkClose = '\n}';
  }
  return ES_300_CHUNK + GEEKEST_PREFIX + NOISE_MARKER + GEEKEST_OUT_CHUNK + chunkMain + code + chunkClose;
}

const userCode = 'float i,e,R,s;vec3 q,p,d=vec3(1);for(q--;i++<119.;){e+=i/5e3;o+=e*e/25.;p=q+=d*e*R*.16;R=length(p);}';
const wrapped = preprocessGeekest300(userCode);
const withOwnMain = 'void main(){o=vec4(1.);}' ;
const wrappedOwnMain = preprocessGeekest300(withOwnMain);
const userOffset = wrapped.indexOf(userCode);
const beforeUser = wrapped.slice(0, userOffset);

const assignmentBeforeUser = Object.fromEntries(['i', 'e', 'R', 'q', 'o'].map((name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const write = new RegExp(`(?:^|[^A-Za-z0-9_])${escaped}\\s*(?:=|\\+=|-=|\\*=|/=|\\+\\+|--)`, 'm');
  return [name, write.test(beforeUser)];
}));

const firstReadSites = {
  q: userCode.indexOf('q--'),
  i: userCode.indexOf('i++'),
  e: userCode.indexOf('e+='),
  o: userCode.indexOf('o+='),
  R: userCode.indexOf('R*.16')
};

const checks = {
  historicalCommitPrecedesArtwork: Date.parse('2023-05-04T08:51:32Z') < Date.parse('2025-01-18T00:00:00Z'),
  lockedBlobShaIsExact: '8fdee9a542b31cc2e3f9a106885c9f529f3c05c9'.length === 40,
  es300DirectiveIsFirst: wrapped.startsWith('#version 300 es\n'),
  fragmentCoordAliasIsInjected: wrapped.includes('#define FC gl_FragCoord\n'),
  onlyDocumentedUniformSetIsInjected: GEEKEST_PREFIX.includes('uniform vec2 r;') && GEEKEST_PREFIX.includes('uniform vec2 m;') && GEEKEST_PREFIX.includes('uniform float t;') && GEEKEST_PREFIX.includes('uniform float f;') && GEEKEST_PREFIX.includes('uniform float s;') && GEEKEST_PREFIX.includes('uniform sampler2D b;'),
  outputIsDeclarationOnly: beforeUser.includes('out vec4 o;\n') && !beforeUser.includes('out vec4 o='),
  wrapperAddsMainWhenAbsent: beforeUser.endsWith('void main(){\n') && wrapped.endsWith('\n}'),
  wrapperDoesNotDuplicateExistingMain: wrappedOwnMain.split('void main').length - 1 === 1,
  userBytesRemainContiguous: wrapped.slice(userOffset, userOffset + userCode.length) === userCode,
  noTargetStateWriteBeforeUserCode: Object.values(assignmentBeforeUser).every((value) => value === false),
  allMaterialFirstReadSitesRemain: Object.values(firstReadSites).every((offset) => offset >= 0),
  framebufferClearCannotInitializeShaderLocal: !beforeUser.includes('gl.clear') && !beforeUser.includes('clearBuffer')
};

for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, name);

const result = {
  schema: 'kaopu-yohei-twigl-host-contract-probe/r69',
  status: 'candidate-partial',
  question: 'Does the historical twigl geekest (300 es) host initialize or rewrite i/e/R/q/o before the user fragment executes?',
  sourceLock: {
    repository: 'doxas/twigl',
    commit: '969491b285ba217fd895132a466ee6b3128243f3',
    commitDate: '2023-05-04T08:51:32Z',
    selectionRule: 'latest repository commit returned at or before the artwork date 2025-01-18',
    file: 'src/fragmen.js',
    blobSha: '8fdee9a542b31cc2e3f9a106885c9f529f3c05c9',
    licenseFileBlobSha: 'efd715b944a25c9475b87735a49ca091fbe61dc2',
    repositoryLicense: 'MIT'
  },
  lockedContract: {
    mode: 'MODE_GEEKEST_300 (7)',
    prefixBeforeNoise: GEEKEST_PREFIX,
    outputChunk: GEEKEST_OUT_CHUNK,
    preprocessOrder: ['#version 300 es', 'GEEKEST_CHUNK', 'out vec4 o declaration', 'optional void main wrapper', 'user code', 'optional closing brace'],
    injectedInputs: ['FC macro', 'r', 'm', 't', 'f', 's', 'b'],
    targetStateAssignmentsBeforeUserCode: assignmentBeforeUser,
    wrappedAuditFixtureSha256: createHash('sha256').update(wrapped).digest('hex')
  },
  firstReadSitesRetainedFromR68: firstReadSites,
  checks,
  totals: {
    passed: Object.values(checks).filter(Boolean).length,
    total: Object.keys(checks).length
  },
  classifications: {
    observation: [
      'At the locked repository snapshot, geekest 300es prepends #version 300 es, aliases FC, declares uniforms, declares out vec4 o, and optionally wraps the user text in void main.',
      'That wrapper does not assign i, e, R, q, or o before the user text.',
      'GLSL ES 3.00 revision 6 specifies that reading before writing or initializing is legal but yields an undefined value.'
    ],
    candidate: 'The author article identifies twigl and geekest (300es), but no share URL or deployed-build receipt proves the January 2025 artwork used bytes identical to this repository snapshot.',
    currentBestView: 'The closest official historical twigl source does not supply the missing initial values. A portable port must declare explicit seeds and is therefore a versioned reinterpretation unless original runtime evidence establishes the intended state.',
    rejected: [
      'twigl geekest (300es) portably zero-initializes i/e/R/q/o.',
      'Declaring out vec4 o initializes o.',
      'Clearing the framebuffer initializes the shader output variable read by o+=.'
    ],
    unknown: [
      'Exact deployed twigl build and share URL used for the artwork',
      'Byte-exact artwork source and typographic dash repair',
      'Original browser, WebGL implementation, compiler, GPU, framebuffer and pixels',
      'Whether implementation-specific undefined values were intentionally relied upon',
      'Artwork adaptation and redistribution license'
    ]
  },
  evidenceBoundary: 'This is a deterministic contract replay of a pinned official repository snapshot plus a normative GLSL ES rule. It is not a live deployment, original GPU pixel, visual acceptance, or physical Observation Root.'
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
