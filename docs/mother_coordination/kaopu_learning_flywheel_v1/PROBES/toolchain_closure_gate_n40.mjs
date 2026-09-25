import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, "toolchain_closure_fixture_n40.json"), "utf8"));

const fullShaRef = /^[^@]+@[0-9a-f]{40}$/;

function evaluateClosure(record) {
  if (record.expectedToolchainManifestDigest || record.observedToolchainManifestDigest) {
    return record.expectedToolchainManifestDigest === record.observedToolchainManifestDigest
      ? "RERUN_TOOLCHAIN_CLOSURE_VERIFIED"
      : "TOOLCHAIN_DRIFT_DETECTED";
  }
  if (!(record.actionRefs || []).every((ref) => fullShaRef.test(ref))) {
    return "HOLD_ACTION_RESOLUTION_MUTABLE";
  }
  if (!record.runnerImageRelease || !record.runnerSbomDigest) {
    return "HOLD_RUNNER_IMAGE_UNIDENTIFIED";
  }
  if (!record.resolvedRuntimeVersions || Object.values(record.resolvedRuntimeVersions).some((v) => !/\d+\.\d+/.test(v))) {
    return "HOLD_RUNTIME_VERSION_UNRESOLVED";
  }
  if (!record.dependencyLockDigest || !record.frozenInstall || !record.installedDependencyInventoryDigest) {
    return "HOLD_DEPENDENCY_CLOSURE_MISSING";
  }
  if (!record.browserBuildReceipt || !record.systemDependencyInventoryDigest) {
    return "HOLD_BROWSER_SYSTEM_CLOSURE_MISSING";
  }
  return "RERUN_TOOLCHAIN_CLOSURE_VERIFIED";
}

const r012 = fixture.historical.r012;
const checks = [];
function check(id, actual, expected) {
  checks.push({ id, actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected) });
}

check("01-tested-subject-pinned", r012.testedSubjectSha, "b5f2d11cbf55e17518dda411bf034596818c46d5");
check("02-workflow-blob-pinned", r012.workflowBlobSha, "b0bc8a27e96bbcb698a88df415f8370b01e51b82");
check("03-historical-run-remains-valid", [r012.runId, r012.jobId, r012.runConclusion], [35974311593, 107551050350, "success"]);
check("04-action-refs-are-not-immutable", r012.actionRefs.every((ref) => fullShaRef.test(ref)), false);
check("05-runner-label-is-moving", r012.runnerLabel, "ubuntu-latest");
check("06-runtime-patches-unresolved", r012.resolvedRuntimeVersionsReceipt, null);
check("07-dependency-lock-absent", [r012.dependencyLockDigest, r012.frozenInstall], [null, false]);
check("08-direct-pins-do-not-seal-transitives", Boolean(r012.directDependencies.playwright && !r012.installedDependencyInventoryDigest), true);
check("09-browser-and-system-closure-absent", [r012.browserBuildReceipt, r012.systemDependencyInventoryDigest], [null, null]);
check("10-r012-reproducible-rerun-holds", evaluateClosure({
  actionRefs: r012.actionRefs,
  runnerImageRelease: r012.runnerImageRelease,
  runnerSbomDigest: r012.runnerSbomDigest,
  resolvedRuntimeVersions: r012.resolvedRuntimeVersionsReceipt,
  dependencyLockDigest: r012.dependencyLockDigest,
  frozenInstall: r012.frozenInstall,
  installedDependencyInventoryDigest: r012.installedDependencyInventoryDigest,
  browserBuildReceipt: r012.browserBuildReceipt,
  systemDependencyInventoryDigest: r012.systemDependencyInventoryDigest
}), "HOLD_ACTION_RESOLUTION_MUTABLE");
check("11-sealed-control-passes", evaluateClosure(fixture.controls[0]), fixture.controls[0].expected);
check("12-failure-modes-remain-distinct", fixture.controls.slice(1).map(evaluateClosure), fixture.controls.slice(1).map((x) => x.expected));

const result = {
  studyId: fixture.studyId,
  candidateId: "RUN-SUCCESS-NOT-RERUN-REPRODUCIBILITY-001",
  historicalRunDecision: "HISTORICAL_RUN_VERIFIED",
  rerunDecision: "UNKNOWN_RERUN_REPRODUCIBILITY_TOOLCHAIN_UNSEALED",
  checksPassed: checks.filter((item) => item.pass).length,
  checksTotal: checks.length,
  allPassed: checks.every((item) => item.pass),
  checks,
  generatedAt: "2026-09-25T09:38:00Z"
};

fs.writeFileSync(path.join(here, "toolchain_closure_result_n40.json"), JSON.stringify(result, null, 2) + "\n");
if (!result.allPassed) process.exitCode = 1;
