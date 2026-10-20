import assert from "node:assert/strict";
import fs from "node:fs";

const fixturePath = process.argv[2];
if (!fixturePath) throw new Error("usage: node tailor_reentry_atomicity_gate_n175.mjs <fixture.json>");
const f = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const o = f.observed;
const g = f.candidateGate;

const globalResetDetected =
  o.removedSet.completedSteps > 0 &&
  o.restoredInitial.completedSteps === 0 &&
  o.sourceEffectsOnAdd.initializesAllCurrentGarments &&
  o.sourceEffectsOnAdd.zerosVelocityForAllCurrentGarments &&
  o.sourceEffectsOnAdd.resetsWorldAndGarmentClock &&
  o.sourceEffectsOnAdd.resetsContactCachesAndHistory;

const initialIntersectionCheckIsNotClearanceProof =
  o.restoredInitial.properCrossingTrianglePairs === 0 &&
  (!o.restoredInitial.thicknessClearanceChecked || !o.restoredInitial.continuousTimeChecked);

const delayedFailureReproduced =
  o.reentryFailure.acceptedStepsBeforeFailure > 0 &&
  o.reentryFailure.clothContactResidualMM > o.reentryFailure.maximumAllowedContactResidualMM;

function classify(c) {
  if (c.mode === "HIDDEN_RENDER_ONLY") {
    return c.solverStateRetained && !c.memberSetChanged
      ? "PASS_RENDER_ONLY"
      : "HOLD_RENDER_HIDE_CHANGED_PHYSICS";
  }
  if (c.mode === "PHYSICS_DORMANT") {
    return c.stateRetained && c.clearanceProof && c.contactHistoryPolicyDeclared
      ? "CANDIDATE_RESUME_GATE"
      : "HOLD_DORMANT_STATE_OR_CLEARANCE_UNKNOWN";
  }
  if (c.mode === "REMOVED_AND_REINSERTED") {
    const ready = c.stagedOutsideActiveWorld &&
      c.activeWorldIdentityHeldUntilCommit &&
      c.intersectionAndThicknessChecks &&
      c.acceptedSteps >= g.minimumAcceptedStepsAfterReentry &&
      c.cycles >= g.minimumRemoveReinsertCycles &&
      c.failureLeavesActiveWorldUnchanged;
    return ready ? "CANDIDATE_ATOMIC_REENTRY_PASS" : "HOLD_REENTRY_NOT_ATOMIC";
  }
  return "HOLD_REENTRY_MODE_UNDECLARED";
}

const cases = [
  {
    id: "actual-pr315-reentry",
    input: {
      mode: "REMOVED_AND_REINSERTED",
      stagedOutsideActiveWorld: o.sourceEffectsOnAdd.stagesNewMemberOutsideActiveWorld,
      activeWorldIdentityHeldUntilCommit: o.sourceEffectsOnAdd.preCommitActiveWorldIdentityChecked,
      intersectionAndThicknessChecks: !initialIntersectionCheckIsNotClearanceProof,
      acceptedSteps: o.reentryFailure.acceptedStepsBeforeFailure,
      cycles: 0,
      failureLeavesActiveWorldUnchanged: false
    },
    expected: "HOLD_REENTRY_NOT_ATOMIC"
  },
  {
    id: "render-only-hide",
    input: { mode: "HIDDEN_RENDER_ONLY", solverStateRetained: true, memberSetChanged: false },
    expected: "PASS_RENDER_ONLY"
  },
  {
    id: "dormant-without-clearance-proof",
    input: {
      mode: "PHYSICS_DORMANT",
      stateRetained: true,
      clearanceProof: false,
      contactHistoryPolicyDeclared: true
    },
    expected: "HOLD_DORMANT_STATE_OR_CLEARANCE_UNKNOWN"
  },
  {
    id: "counterfactual-atomic-reentry",
    input: {
      mode: "REMOVED_AND_REINSERTED",
      stagedOutsideActiveWorld: true,
      activeWorldIdentityHeldUntilCommit: true,
      intersectionAndThicknessChecks: true,
      acceptedSteps: 24,
      cycles: 3,
      failureLeavesActiveWorldUnchanged: true
    },
    expected: "CANDIDATE_ATOMIC_REENTRY_PASS"
  }
];

assert.equal(globalResetDetected, true);
assert.equal(initialIntersectionCheckIsNotClearanceProof, true);
assert.equal(delayedFailureReproduced, true);
for (const c of cases) assert.equal(classify(c.input), c.expected, c.id);

const result = {
  schema: "kaopu.tailor-reentry-atomicity-probe-result/1",
  subject: f.subject,
  finding: "GLOBAL_REINITIALIZATION_NOT_RESUME",
  currentStatus: classify(cases[0].input),
  observations: {
    globalResetDetected,
    initialIntersectionCheckIsNotClearanceProof,
    delayedFailureReproduced,
    renderDemandAffectsSolver: o.renderDemandAffectsSolver,
    failureResidualExcessMM: Number((o.reentryFailure.clothContactResidualMM - o.reentryFailure.maximumAllowedContactResidualMM).toFixed(3))
  },
  cases: cases.map(c => ({ id: c.id, actual: classify(c.input), expected: c.expected, passed: true })),
  summary: { passed: cases.length, total: cases.length },
  nonClaims: [
    "Does not prove a new solver implementation.",
    "Does not relax the 0.5 mm contact threshold or the 1.45 stretch threshold.",
    "Does not prove user acceptance or production readiness."
  ]
};
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
