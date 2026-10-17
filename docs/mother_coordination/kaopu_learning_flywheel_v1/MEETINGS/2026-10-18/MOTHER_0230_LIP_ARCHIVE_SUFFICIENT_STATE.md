# Mother coordination — Lip archive sufficient-state handoff

ID: KAOPU-MOTHER-20261018-LIP-ARCHIVE  
Status: scoped source review + POSTED knowledge handoff; not a production meeting with live Mother participants.

## Actual timing and participation

- Preflight began 2026-10-18 02:27:12 +08:00.
- Focused coordination began 02:30:43; concluded 02:31:35 +08:00, 52 seconds, following the source review. Archival/readback follows separately. No padded meeting time.
- Host only. Actual new Mother replies: 0. Independent experts: 0. No G: or unexposed chat history read.
- PR #303 received [one targeted comment](https://github.com/haihao0307/guilin-dem-pipeline/pull/303#issuecomment-6238614482), created 2026-10-17T18:31:22Z and read back. This is POSTED, not ACKNOWLEDGED.
- No production source, branch, accepted baseline, schedule, local continuation or flywheel modified. No new asset production or merge authorized.

## One decision

Reuse the existing visual-state roundtrip principle for the lip archive: saving identity/DNA/UI fields is not enough if history-dependent calibration changes final geometry. Persist or deterministically reconstruct the state needed for the specific output claim, then compare final geometry and painted output under fixed conditions. Do not blindly serialize all runtime caches.

The next bounded check is cold-context archive restoration on the SAME frozen host. This is a suggested verification gap, not an assertion that it already fails. Do not reopen yesterday's unchanged cloth issue, repeat N170's composite-run discussion, or rewrite the global archive architecture.

## Preflight and freshness

Read current main 5543f756ca3af1428323696324303fa70b8de850: [AGENTS](https://github.com/haihao0307/guilin-dem-pipeline/blob/5543f756ca3af1428323696324303fa70b8de850/AGENTS.md), [R2 OS](https://github.com/haihao0307/guilin-dem-pipeline/blob/5543f756ca3af1428323696324303fa70b8de850/knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md), [Reference gate](https://github.com/haihao0307/guilin-dem-pipeline/blob/5543f756ca3af1428323696324303fa70b8de850/knowledge/REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md), [Freshness gate](https://github.com/haihao0307/guilin-dem-pipeline/blob/5543f756ca3af1428323696324303fa70b8de850/knowledge/TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE.md). R2 is mandatory, not a topic for optional adoption.

Read latest [#91](https://github.com/haihao0307/guilin-dem-pipeline/issues/91) (through N170) and [#63](https://github.com/haihao0307/guilin-dem-pipeline/issues/63) (N49 update). #91 already distinguishes Lip's valid original core atoms from later fresh completion; no need to duplicate that learning. #63 has no new receiving acknowledgment. PR283 remains bd430222b3c62819bdf38d2c84d4bf3eec8ac5be with no new reply to yesterday's guidance.

Coordination read base: ca04ed9c5c973ad7749b1c4373ba37c5b4dede79. Lip head reread before posting: 3cc02b999bc9b5bc9310194e65950948500740d3. PR303 is draft/open; its earlier body and Task Anchor pending fields predate the final publication proof, so they must not erase later scoped evidence.

## Nine-field check: current Lip Mother only

| Field | Actual checked state |
|---|---|
| Task / object / defect | LIP-REALISM-R01-20261017; existing R07 person's lips, native head/body/rig/presets; independent effective lip appearance after whole-body shader and faithful restoration of saved state. |
| Baseline / base | Accepted input d29534672989de3b9373bced5abf3ac333be3dee, HUMAN-INTEGRATED-R07/SKIN-FULLBODY-R02; base 5543f756ca3af1428323696324303fa70b8de850. Accepted skin scope does not imply lip candidate accepted. |
| Latest constraint | Lip-only treatment; preserve canonical identity/topology and other features. Documented local display-groove attenuation exception retained. Unpushed Codex skin work untouched. |
| References / UNKNOWN | Task Anchor identifies native R07 rails/code and published lip references. Person-specific albedo/BRDF, measured groove depth, spectral transport, unpushed changes remain unknown. This run did not newly validate those papers. |
| Forbidden | Replacement character/external mesh/generated reference, flat tint, deep periodic groove substitute, baked highlights, stale screenshots, software-renderer FPS represented as device performance. REPLICATION_LOCKED; creativeAuthorization=false. |
| Fresh delta | Source 544ec81bcef6185a553df138585c7059e832a122; verification f432cc0d099d81db0e87e21d5af0a88ba9e04253; build 0db4b3c0e5e6e86663be6466fa7ab4b486bd5420; evidence head 3cc02b999bc9b5bc9310194e65950948500740d3. Exact preview digest is recorded below. No new production increment created by this meeting. |
| Regression | Existing VISUAL-STATE-ROUNDTRIP-001 applies by failure mechanism; lip-specific calibration/geometry/pixel and wrong-identity pre-mutation assertions exist. Do not claim the formal regression suite or cold restore ran merely because analogous assertions exist. Anchor's lip appearance cases remain separate. |
| Gates | Code and receipts inspected; action39023934981 API reports success at verification SHA. Composite receipt records desktop/390×844 public checks, SwiftShader, physicalPhone=false, visualAcceptance/userVisualAccepted/productionReady=false. No own browser rerun or raw ZIP verification this round; fidelity independent review/user visual acceptance still pending. |
| Coordination state | VERIFYING (scoped technical evidence exists; no full promotion). No new basis for REJECTED_CREATIVE_SUBSTITUTE or stale-delivery label. Human R07 accepted skin baseline remains intact. |

Authoritative preview SHA-256: `4d11c5a8c7b9a0573e37e68ce93eaa9a1657c6b49da6c386a6aa6488ff45f231`.

## Evidence, inference and limits

1. [Task Anchor](https://github.com/haihao0307/guilin-dem-pipeline/blob/3cc02b999bc9b5bc9310194e65950948500740d3/kaopu-unified-human-workbench/lip-realism-r01/TASK_ANCHOR.json), archiveRefinement, reports run39018341941: returning portrait preserved canonical/rest/topology but changed final positions/normals because the old archive omitted native groove calibration. This is producer-reported evidence, not this host's newly reproduced experiment.
2. [LipSurface.js](https://github.com/haihao0307/guilin-dem-pipeline/blob/3cc02b999bc9b5bc9310194e65950948500740d3/kaopu-unified-human-workbench/lip-realism-r01/LipSurface.js) has `kaopu/lip-calibration@1`, explicit Float32 little-endian reference/referenceHorizontal arrays, identity key, length/finite validation and mismatched archived identity rejection before priorRestore. This directly supports that the implementation handles more than the UI/DNA tuple.
3. [verify.cjs](https://github.com/haihao0307/guilin-dem-pipeline/blob/3cc02b999bc9b5bc9310194e65950948500740d3/kaopu-unified-human-workbench/lip-realism-r01/verify.cjs) captures native calibration independently, compares serialized arrays, switches portraits/tones, checks wrong identity rejects without changing before/after state, measures the legacy no-calibration route, and requires exact full-archive calibration/geometry/pixels/settings restoration. Legacy restoration is measured, not forced to differ.
4. [CORE_EVIDENCE_VALIDATED](https://github.com/haihao0307/guilin-dem-pipeline/blob/3cc02b999bc9b5bc9310194e65950948500740d3/kaopu-unified-human-workbench/lip-realism-r01/CORE_EVIDENCE_VALIDATED.json) binds nine original core groups to run39020723675 and artifact12096734029. Whole original run failed cleanup; unsynchronized performance is explicitly excluded. [PUBLICATION_PROOF](https://github.com/haihao0307/guilin-dem-pipeline/blob/3cc02b999bc9b5bc9310194e65950948500740d3/kaopu-unified-human-workbench/lip-realism-r01/PUBLICATION_PROOF.json) and [fresh run39023934981](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39023934981) record later missing checks. This round checked source/receipts/API status, not the binary ZIP, actual screenshots or an independent execution.
5. [Existing N34 view](https://github.com/haihao0307/guilin-dem-pipeline/blob/ca04ed9c5c973ad7749b1c4373ba37c5b4dede79/docs/mother_coordination/kaopu_learning_flywheel_v1/CURRENT_BEST_VIEW_N34_VISUAL_STATE_ROUNDTRIP.md) and [VISUAL-STATE-ROUNDTRIP-001](https://github.com/haihao0307/guilin-dem-pipeline/blob/ca04ed9c5c973ad7749b1c4373ba37c5b4dede79/docs/mother_coordination/kaopu_learning_flywheel_v1/REGRESSION_CASES/CANDIDATE_VISUAL_STATE_ROUNDTRIP_001.json) already require immutable claim-relevant state plus paint evidence and repeated roundtrip. Today's increment is the concrete hidden-calibration example and cold-reload boundary; not a new universal theorem or duplicate regression.

Competing explanations: either visible/DNA parameters alone determine display, or omitted history-dependent calibration also affects it. The anchor's reported counterexample and explicit calibration patch favor the latter for this frozen host. Within-session success could still rely on surviving native objects/caches; a fresh-context test distinguishes that from complete persistence. This is a hypothesis to check, not a proven new bug.

Compatibility limitation: the native identity key's fourth element is deliberately null for this host's settings layout. The same vertex count alone does not establish identical topology or another host's semantics. Do not copy this format to changed host/mesh/schema without evidence. Current pre-mutation wrong-identity assertion does not prove transactional rollback for every possible error after priorRestore.

## Minimal next verification — proposed, not run

Owner: Lip Mother, current PR303. Human integration is the future receiving boundary only; no new Human task or merge order was dispatched.

- Bind exact host bytes, module SHA, archive schema/digest and renderer/camera/light/viewport.
- Save state A; retain independent immutable geometry/calibration/settings/pixel evidence; close the original page.
- Open a fresh browser context with the same frozen host, restore A, compare canonical/topology plus final geometry, calibration and actual painted output. Repeat once to expose accumulating drift.
- Controls: complete archive; same archive without calibration; identity-mismatched archive. Old archives may succeed by deterministic reconstruction, but any degraded/approximate fallback must be explicit. Wrong identity must reject without mutation.
- Same-environment exact equality is the existing claim; do not silently widen thresholds. Across renderer/device, define an independently justified comparison rather than pretending exact pixel equality or inventing tolerances.
- Receiving integration must get its own current task anchor and dispatch-bound fresh verification; existing Lip tests are evidence inputs, not automatic integrated-Human acceptance.

## Knowledge exchange and lifecycle

This can later inform clothing, material editors and other stateful appearance controls: identify hidden physical/calibration state versus safely reproducible derived caches. Their solver/history/topology constraints differ; no assertion that cloth needs Lip's array schema. No all-Mother broadcast or requested recitation.

| Stage | Existing Lip work | This handoff / proposed cold restore |
|---|---|---|
| POSTED | PR and receipts exist | comment6238614482 verified |
| ACKNOWLEDGED | No new response to this coordination | absent |
| IMPLEMENTED | Calibration persistence code predates this meeting | cold restore not implemented/verified by this run |
| GATE-RUN | scoped producer evidence and fresh action exist | not run |
| ADOPTED | No cross-Mother adoption proof | absent |
| USER-ACCEPTED | lip visual acceptance false; accepted R07 skin scope retained | absent |

Unfinished: cold restore, cross-host/topology migration, independent raw-evidence reproduction, Human integration and user visual acceptance. No claims about physical phone performance.

Flywheel next bounded question: how to define a minimal sufficient persisted state for an appearance module, distinguish reconstructible cache from history-dependent calibration, and bind it to host/topology/version without serializing every cache or inventing a large new format? One cold-start counterexample/control on the existing lip case is the next useful evidence.

No generated imagery or new asset. Production-source change/browser delivery by this meeting: not applicable, not a pass. Existing publication proof is quoted as producer evidence only. Actual web delivery must still expose the precise tested public version and distinguish desktop, mobile viewport and physical device.
