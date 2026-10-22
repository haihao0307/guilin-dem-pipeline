import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, "public_fresh_session_startup_fixture_n184.json");
const resultPath = path.join(here, "public_fresh_session_startup_result_n184.json");

export function classify(c) {
  if (!c.endpointIdentityMatches) return "REJECT_PUBLIC_ENDPOINT_IDENTITY";
  if (c.sameContextReloadOnly) return "HOLD_CONTEXT_ISOLATION_MISSING";
  if ((c.freshContextFailures || 0) > 0) return "REJECT_CURRENT_PUBLIC_STARTUP";
  if ((c.firstOpenFailures || 0) > 0) return "REJECT_FIRST_OPEN_UNRELIABLE";
  if ((c.freshContextAttempts || 0) < (c.declaredMinFreshContexts || 1)) {
    return "HOLD_FRESH_SESSION_SAMPLE_INCOMPLETE";
  }
  if (!c.bootStageReceiptsComplete) return "HOLD_BOOT_STAGE_RECEIPT_MISSING";
  if (!c.interactionReached) return "REJECT_PUBLIC_INTERACTION_NOT_REACHED";
  return "FRESH_SESSION_STARTUP_PROBE_PASSED";
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const cases = fixture.cases.map((c) => ({
  id: c.id,
  expected: c.expected,
  actual: classify(c),
  pass: classify(c) === c.expected
}));
const result = {
  schemaVersion: "kaopu.public-fresh-session-startup.result.v1",
  regressionId: "PUBLIC-FRESH-SESSION-STARTUP-001",
  status: cases.every((c) => c.pass) ? "PASS" : "FAIL",
  passed: cases.filter((c) => c.pass).length,
  total: cases.length,
  cases
};
fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
if (result.status !== "PASS") process.exitCode = 1;

