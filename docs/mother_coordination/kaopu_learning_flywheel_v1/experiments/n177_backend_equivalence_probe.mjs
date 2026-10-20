import assert from "node:assert/strict";

export function classify(run) {
  const required = ["inputDigest", "scheduleDigest", "acceptanceDigest"];
  for (const key of required) {
    if (!run[key]) return `INVALID_EVIDENCE__MISSING_${key}`;
  }

  const wasm = run.wasm;
  if (!wasm?.implementationDigest || !wasm?.actualBackend || !wasm?.outcome) {
    return "INVALID_WASM_PROVENANCE";
  }

  const donor = run.donorGpu;
  if (!donor) {
    return wasm.outcome === "REJECT"
      ? "WASM_REJECTION_OBSERVED__DONOR_GPU_OUTCOME_UNKNOWN"
      : "WASM_OUTCOME_OBSERVED__DONOR_GPU_OUTCOME_UNKNOWN";
  }
  if (!donor.implementationDigest || !donor.shaderDigest || !donor.actualBackend || !donor.outcome) {
    return "INVALID_DONOR_GPU_PROVENANCE";
  }
  if (wasm.inputDigest !== run.inputDigest || donor.inputDigest !== run.inputDigest) {
    return "INVALID_CROSS_INPUT_COMPARISON";
  }
  if (wasm.scheduleDigest !== run.scheduleDigest || donor.scheduleDigest !== run.scheduleDigest) {
    return "INVALID_CROSS_SCHEDULE_COMPARISON";
  }
  if (wasm.acceptanceDigest !== run.acceptanceDigest || donor.acceptanceDigest !== run.acceptanceDigest) {
    return "INVALID_ACCEPTANCE_CONTRACT";
  }

  if (wasm.outcome !== donor.outcome) {
    const phases = ["bodyInterpolation", "bodyCarry", "prediction", "distance", "bend", "strain", "contacts", "waistPins"];
    const first = phases.find((phase) => wasm.trace?.[phase] !== donor.trace?.[phase]);
    return `BEHAVIORAL_NON_EQUIVALENCE${first ? `__FIRST_DIVERGENCE_${first}` : "__FIRST_DIVERGENCE_UNKNOWN"}`;
  }
  if (wasm.outcome === "REJECT") return "BOTH_FAILED__NO_INFEASIBILITY_CLAIM";
  return "SCOPED_BEHAVIORAL_AGREEMENT__NOT_IMPLEMENTATION_EQUIVALENCE";
}

const base = {
  inputDigest: "input-D48",
  scheduleDigest: "schedule-48f",
  acceptanceDigest: "stretch-1.45",
  wasm: {
    inputDigest: "input-D48",
    scheduleDigest: "schedule-48f",
    acceptanceDigest: "stretch-1.45",
    implementationDigest: "wasm-port",
    actualBackend: "wasm-cpu",
    outcome: "REJECT",
    trace: { bodyCarry: "absent", contacts: "sequential" },
  },
};

const donor = {
  inputDigest: "input-D48",
  scheduleDigest: "schedule-48f",
  acceptanceDigest: "stretch-1.45",
  implementationDigest: "original-gpu",
  shaderDigest: "shader-v1",
  actualBackend: "webgpu",
  outcome: "REJECT",
  trace: { bodyCarry: "applied", contacts: "gather-average" },
};

const cases = [
  ["known production observation", base, "WASM_REJECTION_OBSERVED__DONOR_GPU_OUTCOME_UNKNOWN"],
  ["same config is insufficient", { ...base, wasm: { ...base.wasm, outcome: "PASS" } }, "WASM_OUTCOME_OBSERVED__DONOR_GPU_OUTCOME_UNKNOWN"],
  ["both reject", { ...base, donorGpu: donor }, "BOTH_FAILED__NO_INFEASIBILITY_CLAIM"],
  ["scoped agreement", { ...base, wasm: { ...base.wasm, outcome: "PASS" }, donorGpu: { ...donor, outcome: "PASS" } }, "SCOPED_BEHAVIORAL_AGREEMENT__NOT_IMPLEMENTATION_EQUIVALENCE"],
  ["pass/fail mismatch", { ...base, donorGpu: { ...donor, outcome: "PASS" } }, "BEHAVIORAL_NON_EQUIVALENCE__FIRST_DIVERGENCE_bodyCarry"],
  ["mutated input", { ...base, donorGpu: { ...donor, inputDigest: "other-input" } }, "INVALID_CROSS_INPUT_COMPARISON"],
  ["missing actual backend", { ...base, donorGpu: { ...donor, actualBackend: "" } }, "INVALID_DONOR_GPU_PROVENANCE"],
  ["relaxed threshold", { ...base, donorGpu: { ...donor, acceptanceDigest: "stretch-1.50" } }, "INVALID_ACCEPTANCE_CONTRACT"],
];

for (const [name, input, expected] of cases) {
  assert.equal(classify(input), expected, name);
}
console.log(`${cases.length}/${cases.length} cross-backend evidence cases passed`);
