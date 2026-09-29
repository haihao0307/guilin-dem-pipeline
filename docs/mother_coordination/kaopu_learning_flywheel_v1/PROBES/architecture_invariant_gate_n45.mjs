import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

const htmlPath = process.argv[2];
if (!htmlPath) throw new Error("usage: node architecture_invariant_gate_n45.mjs <decoded-workbench.html>");
const html = fs.readFileSync(htmlPath, "utf8");
const scoreText = html.match(/<script id="initialScore" type="application\/json">([\s\S]*?)<\/script>/)?.[1]?.trim();
const instrumentSource = html.match(/<script id="instrumentCore">([\s\S]*?)<\/script>/)?.[1]?.trim();
if (!scoreText || !instrumentSource) throw new Error("workbench score or instrument script missing");

const sandbox = { module: { exports: {} }, exports: {}, TextEncoder, TextDecoder, structuredClone };
vm.runInNewContext(instrumentSource, sandbox, { filename: "KAOPU_BIRD_INSTRUMENT_KB2.js" });
const api = sandbox.module.exports;
const score = JSON.parse(scoreText);

function geometryDigest(result) {
  const hash = crypto.createHash("sha256");
  for (const instance of result.instances) {
    for (const key of ["positions", "normals", "indices", "colors", "uv", "kind"]) {
      const value = instance.mesh[key];
      hash.update(key);
      hash.update(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  }
  return hash.digest("hex");
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function baseProbe(instrument) {
  const first = instrument.build(JSON.stringify(score));
  const second = instrument.build(JSON.stringify(score));
  const identityOnly = clone(score);
  identityOnly.identity.id = "identity-only-control";
  identityOnly.identity.commonNameZh = "身份控制";
  identityOnly.identity.commonNameEn = "Identity control";
  identityOnly.identity.scientificName = "Testus identity";
  identityOnly.identity.revision = "IDENTITY-ONLY";
  identityOnly.identity.cladeHint = "control";
  identityOnly.performance.instances[0].id = "identity-control-001";

  const morphology = clone(score);
  for (const station of morphology.construction.core.terminalAxis.stations) station[0] = Number((station[0] * 1.15).toFixed(6));
  for (const section of morphology.construction.core.bodySections) section[2] = Number((section[2] * 1.12).toFixed(6));
  morphology.identity.revision += "-morphology-probe";

  const unknown = clone(score);
  unknown.hiddenPresetSelector = "grey-heron";
  let unknownRejected = false;
  try { instrument.build(JSON.stringify(unknown)); } catch { unknownRejected = true; }

  return {
    selfReportedSpeciesSwitchPresent: first.audit.speciesSwitchPresent,
    selfReportedFinalVerticesStored: first.audit.finalVerticesStored,
    deterministicRepeat: api.equalResults(first, second),
    identityOnlyGeometryInvariant: geometryDigest(first) === geometryDigest(instrument.build(JSON.stringify(identityOnly))),
    morphologyChangesGeometry: geometryDigest(first) !== geometryDigest(instrument.build(JSON.stringify(morphology))),
    unknownRootSlotRejected: unknownRejected,
    baselineGeometryDigest: geometryDigest(first)
  };
}

function verdict(probe, source) {
  const reasons = [];
  if (!probe.deterministicRepeat) reasons.push("NONDETERMINISTIC_REPLAY");
  if (!probe.identityOnlyGeometryInvariant) reasons.push("IDENTITY_BRANCH_DETECTED");
  if (!probe.morphologyChangesGeometry) reasons.push("SCORE_MORPHOLOGY_NOT_EFFECTIVE");
  if (!probe.unknownRootSlotRejected) reasons.push("UNKNOWN_SLOT_NOT_REJECTED");
  if (/Grey Heron|Ardea cinerea|grey-heron|ardeid/i.test(source)) reasons.push("SPECIES_LITERAL_IN_INSTRUMENT");
  return { verdict: reasons.length ? "HOLD_ARCHITECTURE_INVARIANT_UNPROVEN" : "OBSERVED_SCORE_DRIVEN_INSTRUMENT", reasons };
}

const hiddenIdentityBranch = {
  build(input) {
    const result = api.build(input);
    if (result.score.identity.scientificName !== score.identity.scientificName) result.instances[0].mesh.positions[0] += 0.125;
    return result;
  }
};
const morphologyIgnored = {
  build(input) {
    const parsed = typeof input === "string" ? JSON.parse(input) : input;
    const fixed = clone(score);
    fixed.identity = clone(parsed.identity);
    fixed.performance = clone(parsed.performance);
    return api.build(JSON.stringify(fixed));
  }
};

const currentProbe = baseProbe(api);
const hiddenProbe = baseProbe(hiddenIdentityBranch);
const ignoredProbe = baseProbe(morphologyIgnored);
const currentVerdict = verdict(currentProbe, instrumentSource);
const hiddenVerdict = verdict(hiddenProbe, instrumentSource);
const ignoredVerdict = verdict(ignoredProbe, instrumentSource);
const literalVerdict = verdict(currentProbe, instrumentSource + "\nconst speciesPreset='Grey Heron';");

const cases = [
  ["01-current-observed-architecture", currentVerdict, { verdict: "OBSERVED_SCORE_DRIVEN_INSTRUMENT", reasons: [] }],
  ["02-current-deterministic-repeat", { pass: currentProbe.deterministicRepeat }, { pass: true }],
  ["03-current-identity-only-geometry-invariant", { pass: currentProbe.identityOnlyGeometryInvariant }, { pass: true }],
  ["04-current-morphology-score-changes-geometry", { pass: currentProbe.morphologyChangesGeometry }, { pass: true }],
  ["05-current-unknown-root-slot-rejected", { pass: currentProbe.unknownRootSlotRejected }, { pass: true }],
  ["06-self-report-is-not-observation", { selfReport: hiddenProbe.selfReportedSpeciesSwitchPresent, observedVerdict: hiddenVerdict.verdict }, { selfReport: false, observedVerdict: "HOLD_ARCHITECTURE_INVARIANT_UNPROVEN" }],
  ["07-hidden-identity-branch-counterfactual", hiddenVerdict, { verdict: "HOLD_ARCHITECTURE_INVARIANT_UNPROVEN", reasons: ["IDENTITY_BRANCH_DETECTED"] }],
  ["08-ignored-morphology-counterfactual", ignoredVerdict, { verdict: "HOLD_ARCHITECTURE_INVARIANT_UNPROVEN", reasons: ["SCORE_MORPHOLOGY_NOT_EFFECTIVE", "UNKNOWN_SLOT_NOT_REJECTED"] }],
  ["09-species-literal-counterfactual", literalVerdict, { verdict: "HOLD_ARCHITECTURE_INVARIANT_UNPROVEN", reasons: ["SPECIES_LITERAL_IN_INSTRUMENT"] }],
  ["10-current-score-does-not-store-final-vertices", { pass: currentProbe.selfReportedFinalVerticesStored === false && !/"positions"\s*:/.test(scoreText) }, { pass: true }]
].map(([id, actual, expected]) => ({ id, actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected) }));

const output = {
  candidateId: "ARCHITECTURE-INVARIANTS-MUST-BE-OBSERVED-001",
  subjectHeadSha: "a56fd42ba8d7b155cf68fe1808e1c7fa1cf27ec9",
  sourcePath: "kaopu-score-instrument/r03-20260929/",
  sourceBytes: { decodedHtml: Buffer.byteLength(html), instrument: Buffer.byteLength(instrumentSource), score: Buffer.byteLength(scoreText) },
  currentProbe,
  summary: { total: cases.length, passed: cases.filter(x => x.pass).length, failed: cases.filter(x => !x.pass).length },
  cases,
  generatedAt: "2026-09-29T09:39:00Z"
};
console.log(JSON.stringify(output, null, 2));
if (output.summary.failed) process.exitCode = 1;
