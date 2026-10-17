import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const values = new Float32Array(cfg.expected.shape[0]);
for (let i = 0; i < values.length; i++) values[i] = Math.fround(Math.sin(i * 0.125));
const basePayload = Buffer.from(values.buffer);

function makeEnvelope(mutation) {
  const payload = Buffer.from(basePayload);
  const envelope = {
    controlContract: {
      taskAnchorId: cfg.expected.taskAnchorId,
      requiredOutcome: 'transport one scoped observation vector',
      claimScope: 'synthetic representation-contract probe only',
      acceptanceGate: 'independent verifier required',
      parentEligible: false
    },
    representationContract: {
      irVersion: cfg.expected.irVersion,
      operatorSet: {domain: cfg.expected.opsetDomain, version: cfg.expected.opsetVersion},
      modelVersion: cfg.expected.modelVersion,
      modelSha256: cfg.expected.modelSha256,
      decoderSha256: cfg.expected.decoderSha256,
      dtype: cfg.expected.dtype,
      shape: cfg.expected.shape,
      semanticDenotation: cfg.expected.semanticDenotation,
      executionProvider: cfg.expected.executionProvider,
      fallbackPolicy: cfg.expected.fallbackPolicy,
      payloadSha256: sha256(payload)
    },
    payload
  };
  if (mutation === 'dropControlContract') delete envelope.controlContract;
  if (mutation === 'wrongDecoder') envelope.representationContract.decoderSha256 = 'c'.repeat(64);
  if (mutation === 'wrongModel') envelope.representationContract.modelSha256 = 'd'.repeat(64);
  if (mutation === 'wrongOpset') envelope.representationContract.operatorSet.version += 1;
  if (mutation === 'wrongShape') envelope.representationContract.shape = [32, 2];
  if (mutation === 'corruptPayload') envelope.payload[0] ^= 0xff;
  if (mutation === 'silentFallback') {
    envelope.representationContract.executionProvider = 'CUDAExecutionProvider';
    envelope.representationContract.actualExecutionProvider = 'CPUExecutionProvider';
    envelope.representationContract.fallbackPolicy = 'ALLOW_SILENT';
  }
  return envelope;
}

function gate(envelope) {
  if (!envelope.controlContract?.taskAnchorId) return 'HOLD_TASK_SEMANTICS_UNBOUND';
  const r = envelope.representationContract;
  if (!r) return 'HOLD_REPRESENTATION_CONTRACT_MISSING';
  if (r.decoderSha256 !== cfg.expected.decoderSha256) return 'HOLD_DECODER_IDENTITY_MISMATCH';
  if (r.modelSha256 !== cfg.expected.modelSha256 || r.modelVersion !== cfg.expected.modelVersion) return 'HOLD_MODEL_IDENTITY_MISMATCH';
  if (r.irVersion !== cfg.expected.irVersion || r.operatorSet.domain !== cfg.expected.opsetDomain || r.operatorSet.version !== cfg.expected.opsetVersion) return 'HOLD_REPRESENTATION_VERSION_UNSUPPORTED';
  if (r.dtype !== cfg.expected.dtype || JSON.stringify(r.shape) !== JSON.stringify(cfg.expected.shape) || r.semanticDenotation !== cfg.expected.semanticDenotation) return 'HOLD_TENSOR_SCHEMA_MISMATCH';
  if (sha256(envelope.payload) !== r.payloadSha256) return 'HOLD_PAYLOAD_DIGEST_MISMATCH';
  if (r.fallbackPolicy !== 'FAIL_CLOSED' || (r.actualExecutionProvider && r.actualExecutionProvider !== r.executionProvider)) return 'HOLD_SILENT_FALLBACK_FORBIDDEN';
  return 'VERIFIED_SCOPED';
}

const fixtureResults = cfg.fixtures.map((fixture) => {
  const actualDecision = gate(makeEnvelope(fixture.mutation));
  return {...fixture, actualDecision, pass: actualDecision === fixture.expectedDecision};
});

function benchmark(count) {
  const tensor = new Float32Array(count);
  for (let i = 0; i < count; i++) tensor[i] = Math.fround(Math.sin(i * 0.001));
  const jsonText = JSON.stringify(Array.from(tensor));
  const binary = Buffer.from(tensor.buffer);
  JSON.parse(jsonText);
  new Float32Array(binary.buffer, binary.byteOffset, count);
  const jsonTimes = [];
  const binaryViewTimes = [];
  for (let i = 0; i < 15; i++) {
    let t0 = performance.now();
    JSON.parse(jsonText);
    jsonTimes.push(performance.now() - t0);
    t0 = performance.now();
    new Float32Array(binary.buffer, binary.byteOffset, count);
    binaryViewTimes.push(performance.now() - t0);
  }
  return {
    floatCount: count,
    jsonBytes: Buffer.byteLength(jsonText),
    binaryBytes: binary.byteLength,
    sizeRatioJsonToBinary: Number((Buffer.byteLength(jsonText) / binary.byteLength).toFixed(3)),
    medianJsonParseMs: Number(median(jsonTimes).toFixed(6)),
    medianBinaryViewMs: Number(median(binaryViewTimes).toFixed(6)),
    scope: 'CPU in-memory parse versus typed-array view construction; excludes transport, model inference, GPU transfer, GPU kernel and fidelity cost'
  };
}

const result = {
  caseId: cfg.caseId,
  generatedAt: '2026-10-17T07:42:23Z',
  environment: {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    cpu: os.cpus()[0]?.model ?? 'UNKNOWN',
    gpu: 'NOT_TESTED'
  },
  hypothesis: 'A learned/tensor payload may be efficient for bulk numeric data, but cannot replace an explicit control contract and representation identity without producing undiagnosable semantic/version/fallback failures.',
  fixtureResults,
  assertions: {passed: fixtureResults.filter(x => x.pass).length, total: fixtureResults.length},
  benchmarks: [benchmark(64), benchmark(4096), benchmark(100000)],
  decision: fixtureResults.every(x => x.pass) ? 'CANDIDATE_DUAL_PLANE_ONLY' : 'REJECTED',
  gpuSpeedupClaim: 'UNKNOWN',
  productionGateRun: false,
  userAcceptance: false
};

console.log(JSON.stringify(result, null, 2));
if (!fixtureResults.every(x => x.pass)) process.exitCode = 1;
