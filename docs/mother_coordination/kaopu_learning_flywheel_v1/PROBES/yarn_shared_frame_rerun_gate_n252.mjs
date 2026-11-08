import fs from "node:fs";
import crypto from "node:crypto";

const fixtureUrl = new URL("./yarn_shared_frame_rerun_fixture_n252.json", import.meta.url);
const resultUrl = new URL("./yarn_shared_frame_rerun_result_n252.json", import.meta.url);
const fixtureBytes = fs.readFileSync(fixtureUrl);
const fixture = JSON.parse(fixtureBytes);

function evaluate(c) {
  const holds = [];
  if (!c.implementationPresent) holds.push("HOLD_IMPLEMENTATION_MISSING");
  if (!c.qaSourcePresent) holds.push("HOLD_QA_SOURCE_MISSING");
  if (!c.evidenceOutputPresent) holds.push("HOLD_EVIDENCE_OUTPUT_MISSING");
  if (c.absoluteRuntimePaths) holds.push("HOLD_NONPORTABLE_RUNTIME_PATH");
  if (!c.dependencyLockPresent) holds.push("HOLD_DEPENDENCY_CLOSURE_MISSING");
  if (!c.serverBootstrapBound) holds.push("HOLD_SERVER_BOOTSTRAP_UNBOUND");
  if (!c.subjectIdentityBound) holds.push("HOLD_TESTED_SUBJECT_UNBOUND");
  return holds;
}

const cases = fixture.cases.map((c) => {
  const actualHolds = evaluate(c);
  const pass = JSON.stringify(actualHolds) === JSON.stringify(c.expectedHolds);
  return {
    id: c.id,
    expectedHolds: c.expectedHolds,
    actualHolds,
    decision: actualHolds.length ? "RERUN_REPRODUCIBILITY_UNSEALED" : "RERUN_CLOSURE_CANDIDATE",
    pass
  };
});

const result = {
  schema: "kaopu.yarn-shared-frame-rerun-result/1",
  runId: "N252-CPU-STATIC-REPLAY-20261108",
  fixtureSha256: crypto.createHash("sha256").update(fixtureBytes).digest("hex"),
  totals: { total: cases.length, passed: cases.filter((x) => x.pass).length },
  allPassed: cases.every((x) => x.pass),
  cases
};
fs.writeFileSync(resultUrl, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (!result.allPassed) process.exitCode = 1;
