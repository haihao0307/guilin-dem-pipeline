import { createHash } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function componentDigest(snapshot, paths) {
  return sha256(Object.fromEntries([...paths].sort().map((path) => [path, snapshot[path]])));
}

function assessProtectedComponent({ baseline, candidate, protectedPaths }) {
  const expected = componentDigest(baseline, protectedPaths);
  const observed = componentDigest(candidate, protectedPaths);
  return {
    expected,
    observed,
    status: expected === observed
      ? "COMPONENT_BASELINE_CONFIRMED"
      : "HOLD_PROTECTED_COMPONENT_CHANGED",
  };
}

const baseline = {
  "cab/console.json": { acceptedShape: "v7", material: "leather-a" },
  "rear/body.json": { shape: "draft-2", completeness: 0.55 },
};

const candidateOnlyUnfinishedChanges = {
  ...baseline,
  "rear/body.json": { shape: "draft-3", completeness: 0.78 },
};

const candidateProtectedAlsoChanges = {
  ...candidateOnlyUnfinishedChanges,
  "cab/console.json": { acceptedShape: "v7-simplified", material: "leather-a" },
};

const protectedPaths = ["cab/console.json"];
const baselineHead = sha256(baseline);

const cases = [
  {
    id: "unfinished-only",
    headChanged: sha256(candidateOnlyUnfinishedChanges) !== baselineHead,
    protected: assessProtectedComponent({
      baseline,
      candidate: candidateOnlyUnfinishedChanges,
      protectedPaths,
    }),
  },
  {
    id: "protected-and-unfinished",
    headChanged: sha256(candidateProtectedAlsoChanges) !== baselineHead,
    protected: assessProtectedComponent({
      baseline,
      candidate: candidateProtectedAlsoChanges,
      protectedPaths,
    }),
  },
];

const assertions = {
  bothCandidatesAdvanceWholeSnapshot: cases.every((item) => item.headChanged),
  unfinishedOnlyPreservesAcceptedComponent:
    cases[0].protected.status === "COMPONENT_BASELINE_CONFIRMED",
  protectedChangeIsHeld:
    cases[1].protected.status === "HOLD_PROTECTED_COMPONENT_CHANGED",
};

if (!Object.values(assertions).every(Boolean)) {
  throw new Error(`probe failed: ${JSON.stringify({ assertions, cases })}`);
}

process.stdout.write(`${JSON.stringify({
  probe: "N305_COMPONENT_SCOPED_GOLDEN_BASELINE",
  algorithm: "sha256",
  baselineHead,
  protectedPaths,
  cases,
  assertions,
}, null, 2)}\n`);
