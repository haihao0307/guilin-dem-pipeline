'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const artifactDir = process.argv[2];
const outPath = process.argv[3] || path.join(__dirname, 'a4_r32_visual_delta_receipt_result_n204.json');
if (!artifactDir) throw new Error('Usage: node a4_r32_visual_delta_receipt_probe_n204.js <artifact-dir> [result-path]');

const report = JSON.parse(fs.readFileSync(path.join(artifactDir, 'BROWSER_R32_RESULT.json'), 'utf8'));
const png = name => fs.readFileSync(path.join(artifactDir, name));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const frame = name => report.frames.find(x => x.name === name);

const r32 = frame('r32-whole');
const r31 = frame('retained-r31');
const r32Bytes = png('r32-whole.png');
const r31Bytes = png('retained-r31.png');
const oppositeBytes = png('r32-opposite.png');

const currentFrameGate = f => f.qa.done && f.qa.frameValid && f.qa.errors.length === 0 &&
  f.qa.glError === 0 && f.pixelReadback.nonBackgroundPixels > 1000 && f.pixelReadback.colors > 20;

const assertions = [];
function check(name, fn) { fn(); assertions.push({name, status: 'PASS'}); }

check('artifact is bound to the inspected commit', () => assert.equal(report.tested_commit, '580acd1c8b851d0c843826e2b49c7079411473bd'));
check('artifact browser result is PASS', () => assert.equal(report.status, 'PASS'));
check('R32 and retained R31 comparison frames exist', () => assert.ok(r32 && r31));
check('both frames pass current macro frame gate', () => assert.ok(currentFrameGate(r32) && currentFrameGate(r31)));
check('candidate records ten additional draws', () => assert.deepEqual([r32.qa.draws, r31.qa.draws], [703, 693]));
check('pixel-readback summary is identical', () => assert.deepEqual(r32.pixelReadback, r31.pixelReadback));
check('candidate and parent PNG bytes are identical', () => assert.ok(r32Bytes.equals(r31Bytes)));
check('candidate and parent PNG SHA-256 are identical', () => assert.equal(sha(r32Bytes), sha(r31Bytes)));
check('hash comparison detects a different R32 view', () => assert.notEqual(sha(r32Bytes), sha(oppositeBytes)));
check('visual-delta gate rejects exact-equality comparison', () => assert.equal(r32Bytes.equals(r31Bytes), true));

const result = {
  status: 'PASS',
  decision: 'HOLD_COMPARISON_FRAME_PROVES_NO_VISIBLE_DELTA',
  scope: 'Exact GitHub Actions artifact replay for one equal camera/pose comparison; not proof that R32 source has no differences and not user-device acceptance.',
  subject: {
    commit: report.tested_commit,
    workflowRun: 40484446930,
    artifactId: 12724761571,
    artifactDigest: 'sha256:99aa6309741366a3d4bee7cdc9bbca41c4750ff4625c236565afd1655bf0b9bc',
    browserStatus: report.status,
    backend: report.backend,
    hardwareGpuClaim: report.hardware_gpu_claim,
    phoneVerified: report.phone_verified
  },
  comparison: {
    candidate: {name: r32.name, draws: r32.qa.draws, pixelReadback: r32.pixelReadback, pngBytes: r32Bytes.length, pngSha256: sha(r32Bytes)},
    parent: {name: r31.name, draws: r31.qa.draws, pixelReadback: r31.pixelReadback, pngBytes: r31Bytes.length, pngSha256: sha(r31Bytes)},
    exactByteIdentity: r32Bytes.equals(r31Bytes),
    inferredChangedPixelCount: 0,
    currentMacroGatePassesBoth: currentFrameGate(r32) && currentFrameGate(r31),
    declaredVisualDeltaGatePass: false
  },
  assertions,
  passCount: assertions.length,
  totalCount: assertions.length,
  limitations: [
    'The exact-equality result is decisive for this one comparison view only.',
    'Additional R32 objects may be occluded, outside the frame, degenerate, or overwritten; this replay does not choose among those causes.',
    'Static PNGs cannot establish absence or presence of temporal flicker.',
    'The artifact used SwiftShader software rendering and makes no hardware-GPU claim.'
  ]
};

fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, decision: result.decision, assertions: `${result.passCount}/${result.totalCount}`, pngSha256: sha(r32Bytes)}));
