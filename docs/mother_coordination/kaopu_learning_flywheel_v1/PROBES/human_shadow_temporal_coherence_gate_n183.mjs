import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, "human_shadow_temporal_coherence_fixture_n183.json");
const resultPath = path.join(here, "human_shadow_temporal_coherence_result_n183.json");

export function classify(c) {
  if (!c.shadowObservable) return "HOLD_SHADOW_OBSERVATION_MISSING";
  if (!c.completedFrameSame) return "HOLD_FRAME_BINDING_MISSING";
  if (!c.projectionControlsStable) return "HOLD_PROJECTION_CONTROL_MISSING";
  if (!c.casterIdentityMatches) return "REJECT_CASTER_IDENTITY_MISMATCH";
  if (c.staticProxy) return "REJECT_STATIC_SHADOW_SUBSTITUTE";
  if (!(c.actorDeltaPx > 0) || c.shadowDeltaPx === 0) return "REJECT_STALE_SHADOW";
  if (c.projectedDeltaErrorPx > c.tolerancePx) return "REJECT_STALE_SHADOW";
  return "SHADOW_TEMPORAL_COHERENCE_VERIFIED";
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const cases = fixture.cases.map((c) => ({
  id: c.id,
  expected: c.expected,
  actual: classify(c),
  pass: classify(c) === c.expected
}));
const result = {
  schemaVersion: "kaopu.human-shadow-temporal-coherence.result.v1",
  regressionId: "HUMAN_SHADOW_TEMPORAL_COHERENCE_001",
  status: cases.every((c) => c.pass) ? "PASS" : "FAIL",
  passed: cases.filter((c) => c.pass).length,
  total: cases.length,
  cases
};
fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
if (result.status !== "PASS") process.exitCode = 1;

