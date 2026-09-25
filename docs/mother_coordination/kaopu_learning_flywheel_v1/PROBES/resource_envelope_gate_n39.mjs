import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, "resource_envelope_fixture_n39.json"), "utf8"));

function evaluateResourceEnvelope(record) {
  if (!record.budget) return "UNKNOWN_RESOURCE_BUDGET_NOT_PINNED";
  if (record.claimEnvironmentProfileId !== record.evidenceEnvironmentProfileId) {
    return "HOLD_RESOURCE_ENVIRONMENT_MISMATCH";
  }
  const missing = record.budget.requiredMetrics.filter((name) => {
    const value = record.measurements?.[name];
    return value === null || value === undefined;
  });
  if (missing.length > 0) return "HOLD_RESOURCE_ENVELOPE_UNMEASURED";
  const exceeded = record.budget.requiredMetrics.some((name) => {
    const ceiling = record.budget.max?.[name];
    return ceiling !== null && ceiling !== undefined && record.measurements[name] > ceiling;
  });
  return exceeded ? "RESOURCE_BUDGET_EXCEEDED" : "RESOURCE_ENVELOPE_VERIFIED";
}

const r012 = fixture.historical.r012;
const checks = [];
function check(id, actual, expected) {
  checks.push({ id, actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected) });
}

check("01-tested-subject-pinned", r012.testedSubjectSha, "b5f2d11cbf55e17518dda411bf034596818c46d5");
check("02-run-and-job-pinned", [r012.runId, r012.jobId], [35974311593, 107551050350]);
check("03-artifact-identity-complete", Boolean(r012.artifact.path && r012.artifact.bytes === 94452856 && /^[0-9a-f]{64}$/.test(r012.artifact.sha256)), true);
check("04-hosted-runtime-remains-valid", Boolean(r012.runtimeChecks.desktopPassed && r012.runtimeChecks.publicBrowserPassed), true);
check("05-context-recovery-remains-valid", Boolean(r012.runtimeChecks.webglUnavailableFallbackPassed && r012.runtimeChecks.contextLossRecoveryPassed), true);
check("06-no-budget-profile-stays-unknown", evaluateResourceEnvelope({ budget: r012.resourceBudgetProfile }), "UNKNOWN_RESOURCE_BUDGET_NOT_PINNED");
check("07-file-bytes-do-not-populate-runtime-metrics", [
  r012.resourceMeasurements.navigationTransferBytes,
  r012.resourceMeasurements.navigationDecodedBodyBytes,
  r012.resourceMeasurements.peakJsHeapBytes,
  r012.resourceMeasurements.peakProcessRssBytes,
  r012.resourceMeasurements.peakGpuBytes
], [null, null, null, null, null]);
check("08-user-observation-rejects-stronger-claim", fixture.historical.r006UserObservation.strongClaimDecision, "REJECTED_BY_USER_OBSERVATION");
check("09-unique-root-cause-remains-unconfirmed", fixture.historical.r006UserObservation.uniqueRootCauseConfirmed, false);
check("10-complete-compatible-control-passes", evaluateResourceEnvelope(fixture.controls[0]), fixture.controls[0].expected);
check("11-missing-metric-control-holds", evaluateResourceEnvelope(fixture.controls[1]), fixture.controls[1].expected);
check("12-exceeded-and-mismatch-are-distinct", [
  evaluateResourceEnvelope(fixture.controls[2]),
  evaluateResourceEnvelope(fixture.controls[3])
], [fixture.controls[2].expected, fixture.controls[3].expected]);

const result = {
  studyId: fixture.studyId,
  candidateId: "ARTIFACT-SIZE-NOT-RESOURCE-BUDGET-001",
  historicalDecision: "UNKNOWN_RESOURCE_BUDGET_NOT_PINNED",
  checksPassed: checks.filter((item) => item.pass).length,
  checksTotal: checks.length,
  allPassed: checks.every((item) => item.pass),
  checks,
  generatedAt: "2026-09-25T07:43:00Z"
};

fs.writeFileSync(path.join(here, "resource_envelope_result_n39.json"), JSON.stringify(result, null, 2) + "\n");
if (!result.allPassed) process.exitCode = 1;
