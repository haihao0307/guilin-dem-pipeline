# N39 Current Best View — Resource Envelope

## Observation

Fish R012 pins an exact 94,452,856-byte HTML subject and has successful hosted Chromium, public-browser, fallback and context-loss recovery evidence. Those observations remain valid.

The tested workflow does not pin a resource-budget profile and does not record navigation transfer/decoded sizes, peak JavaScript heap, process RSS, GPU memory or an explicit CPU/paint/interactive measurement window. R006 also has a real user white-screen observation, while its unique cause remains Unknown.

## Candidate

Artifact identity, hosted runtime, context recovery, constrained-device resource envelope, physical-device runtime and user acceptance are separate claims.

A constrained resource claim is eligible only when:

1. a task-specific budget profile was frozen before evaluation;
2. claim and evidence environment profiles are compatible;
3. all profile-required metrics were actually measured over a pinned window;
4. the tested immutable subject and run are bound to the measurements;
5. exceeding a limit is reported as RESOURCE_BUDGET_EXCEEDED, not silently waived;
6. unavailable GPU-memory evidence remains Unknown and narrows the claim.

## Boundaries

- No global byte, heap, RSS, GPU, CPU or time threshold is proposed.
- A hosted Chromium pass remains valid for its own environment.
- Context-loss recovery proves a recovery path, not peak-memory sufficiency.
- The R006 white screen does not establish resource exhaustion as the unique root cause.
- This does not replace N33 visible-boot, N37 physical-device identity or N38 golden-control candidates.

## Decision

Candidate partial. Trial only on the next Fish large standalone WebGL resource claim. Main R2, production artifacts and existing release status remain unchanged.
