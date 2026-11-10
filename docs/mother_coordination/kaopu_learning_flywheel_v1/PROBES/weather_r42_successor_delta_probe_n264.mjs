import fs from 'node:fs';

const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

function evaluate(subject) {
  const parent = new Map(subject.parentManifest.map((x) => [x.path, x.sha]));
  const reused = [];
  const changed = [];
  const added = [];
  for (const file of subject.successorManifest) {
    if (!parent.has(file.path)) added.push(file.path);
    else if (parent.get(file.path) === file.sha) reused.push(file.path);
    else changed.push(file.path);
  }
  const removed = [...parent.keys()].filter((path) => !subject.successorManifest.some((x) => x.path === path));
  const freshDelta = changed.length + added.length + removed.length > 0;
  const lineageBound = Boolean(
    subject.taskAnchor &&
    subject.deliveryReceipt &&
    subject.headBoundGateRun &&
    subject.parentSubjectDigest &&
    subject.parentVerifierVerdict === 'ACCEPTED' &&
    subject.parentAcceptedScope?.includes(subject.claimScope)
  );
  return {
    reused,
    changed,
    added,
    removed,
    freshDelta,
    candidateState: subject.label === 'RESEARCH_CANDIDATE'
      ? 'PASS_HONEST_CANDIDATE_LABEL'
      : 'UNKNOWN_CANDIDATE_LABEL',
    freshnessState: freshDelta ? 'PASS_FRESH_SOURCE_DELTA' : 'NO_NEW_ARTIFACT',
    promotionState: lineageBound
      ? 'PROMOTION_ELIGIBLE_FOR_DECLARED_SCOPE'
      : 'HOLD_LINEAGE_PROMOTION_PARENT_IDENTITY_AND_ELIGIBILITY_UNBOUND',
    countableProgressPaths: [...changed, ...added, ...removed],
  };
}

const result = {
  schema: 'kaopu.weather-r42-successor-delta.n264.v1',
  current: evaluate(input.current),
  controls: input.controls.map((control) => {
    const actual = evaluate(control);
    return {
      name: control.name,
      expectedFreshness: control.expectedFreshness,
      actualFreshness: actual.freshnessState,
      expectedPromotion: control.expectedPromotion,
      actualPromotion: actual.promotionState,
    };
  }),
};
result.controlsPass = result.controls.every((x) =>
  x.expectedFreshness === x.actualFreshness &&
  x.expectedPromotion === x.actualPromotion
);
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (!result.controlsPass) process.exitCode = 1;
