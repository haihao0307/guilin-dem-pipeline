import fs from "node:fs";
import crypto from "node:crypto";

const fixturePath = new URL("./retired_publisher_reachability_fixture_n251.json", import.meta.url);
const resultPath = new URL("./retired_publisher_reachability_result_n251.json", import.meta.url);
const fixtureBytes = fs.readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes);

function decision(c) {
  if (!c.targetRetired) return "NOT_APPLICABLE";
  if (!c.targetAbsent) return "HOLD_RETIRED_TARGET_STILL_PRESENT";

  const liveWriter = Boolean(
    c.publisherOnDefaultBranch &&
    c.publisherEnabled &&
    c.triggerReachable &&
    c.writePermission &&
    c.targetPathMatch
  );
  const materializationReachable = Boolean(
    c.sourceCanMaterializeTarget ||
    (c.mutableSourceAlias && c.sourcePathCanReappear)
  );

  if (liveWriter && materializationReachable) {
    return "HOLD_RETIRED_TARGET_RECREATION_REACHABLE";
  }
  return "RETIRED_TARGET_NOT_REACHABLE_CANDIDATE";
}

const cases = fixture.cases.map((c) => {
  const actual = decision(c);
  return { id: c.id, expected: c.expected, actual, pass: actual === c.expected };
});
const result = {
  schema: "kaopu.retired-publisher-reachability-result/1",
  runId: "N251-CPU-REPLAY-20261108",
  fixtureSha256: crypto.createHash("sha256").update(fixtureBytes).digest("hex"),
  totals: { total: cases.length, passed: cases.filter((c) => c.pass).length },
  allPassed: cases.every((c) => c.pass),
  cases
};
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (!result.allPassed) process.exitCode = 1;
