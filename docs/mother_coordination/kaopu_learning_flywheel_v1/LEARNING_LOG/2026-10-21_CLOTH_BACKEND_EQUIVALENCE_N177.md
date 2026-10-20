# N177 — Cloth backend equivalence evidence contract

## Bounded question

Does keeping the same input, frame schedule, material constants, and stretch threshold justify treating the WASM source fitter as behaviorally equivalent to the unchanged donor GPU fitter?

## Decision

`SAME_PARAMETERS_NOT_BACKEND_EQUIVALENCE`

Current production observation is narrower:

`WASM_REJECTION_OBSERVED__DONOR_GPU_OUTCOME_UNKNOWN`

PR #319 records a real, scoped WASM rejection for actor D / look D01. The native source height is 1.837975502 m and target D height is 1.503802657 m. With 240 Hz, 16 + 12 iterations, 4 mm clearance, and max stretch 1.45, frames 1–8 complete; at frame 9 (28.125% fit) P01 paper-edge max stretch reaches 1.4581577542485396 and the system rolls back to frame 8. T01 max stretch is 1.214255; P01 min is 0.831765; no penetration above 1 mm and no `rayInside` are reported.

This does **not** establish pattern infeasibility. The donor GPU result for the fixed D input and 48-frame schedule is not yet observed. It also does not prove that the missing WASM `bodyCarry` step caused the rejection.

## Novel delta over the current production RCA

The RCA already identifies implementation differences and schedules an unchanged donor GPU comparison. The transferable addition is a falsifiable evidence contract for any cross-backend equivalence claim:

1. Bind the exact input digest, schedule digest, acceptance-contract digest, implementation digest, shader digest where applicable, requested backend, and actual backend.
2. Run donor and port independently against the same fixed input and acceptance bounds.
3. Record comparable checkpoints after body interpolation, body carry (or explicit absence), prediction, distance, bend, strain, contacts, and waist/pins.
4. Classify the first divergent phase before proposing a causal fix.
5. Treat equal pass/fail outcomes as scoped behavioral agreement only, never implementation equivalence.

## State semantics

| Evidence | Allowed state |
|---|---|
| Port rejects; donor not run | `WASM_REJECTION_OBSERVED__DONOR_GPU_OUTCOME_UNKNOWN` |
| Pass/fail mismatch under identical evidence contract | `BEHAVIORAL_NON_EQUIVALENCE` |
| Both pass the same acceptance bounds | `SCOPED_BEHAVIORAL_AGREEMENT__NOT_IMPLEMENTATION_EQUIVALENCE` |
| Both reject | `BOTH_FAILED__NO_INFEASIBILITY_CLAIM` |
| Input, schedule, backend, implementation, shader, or acceptance provenance missing/mismatched | `INVALID_EVIDENCE` |

## Minimal falsifiable probe

The companion classifier contains eight cases, including negative controls for a mutated input, omitted actual backend, relaxed acceptance threshold, and body-carry phase mismatch. Expected result: `8/8 cross-backend evidence cases passed`.

## Boundary and routing

- Scope: source-fit/backend comparison only; no claim about final visual acceptance, production readiness, or user acceptance.
- No production branch or Mother asset is modified.
- No global OS/gate change is proposed.
- No new regression is created: #91 N66 `SOLVER_FAILURE_NOT_INFEASIBILITY-001` already covers the prohibition against converting solver failure into incompatibility/infeasibility.
- Directed Mother status remains `POSTED` only after the PR #319 comment exists; without a reply it is not `ACKNOWLEDGED`, `IMPLEMENTED`, `GATE-RUN`, `ADOPTED`, or `USER-ACCEPTED`.
