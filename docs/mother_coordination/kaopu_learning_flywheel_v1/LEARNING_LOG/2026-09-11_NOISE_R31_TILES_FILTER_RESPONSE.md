# KAOPU Learning Cycle — Noise R31 / Tiles footprint response

Date: 2026-09-11
Queue item: LQ-NOISE-001
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.
Production Mother mutation: none.

## Bounded question

Does the fixed Tiles Mother R2 candidate apply its screen-footprint filter in a way that preserves one declared frequency response per signal path, or is filtering compounded implicitly?

## Logical correction before implementation

“Two calls to the same filter must be a bug” is too strong. Reapplying a non-idempotent gate changes the transfer function, but a steeper response can be intentional and can be closer to a reference at some footprints. This cycle therefore tests whether the response changes materially; it does not authorize deleting the second multiplication.

The practical constraint is that `fp=max(length(dFdx(p)),length(dFdy(p)))` depends on projected geometry, camera, rasterization and GPU derivative behavior. A CPU plane-wave fixture can expose transfer-function risk, but cannot establish the actual WebGL image or mobile performance result.

## Observation Roots kept distinct

### O-R31-TILES-SOURCE — fixed Mother software state

Fixed repository source: https://github.com/haihao0307/HOUSE/blob/95c97a96877a0b09660d1887ce858fe1c018a5c8/tiles-mother/r2-closeout-06-handmade/START_HERE.html

Blob SHA: `bd7eff9f1f715bf592ee9d1520fe9e3eecdc86a2`.

Observed:

- `fp` is derived from `dFdx/dFdy` of material position.
- `band(fp,scale)=1-smoothstep(.35,.95,fp*scale)`.
- `middle` is gated once.
- `grain` and `micro` are first mixed toward 0.5 by the gate, then their centered amplitude is multiplied by the same gate again in `structuralHeight`; these paths therefore use approximately `gate²`.
- R2 microscope octaves each use one gate inside the octave sum.
- The source explicitly limits filtering to displayed frequencies, not object geometry/history.

This is one software Observation Root. It is not a physical material observation and it is not independent visual acceptance.

### O-R31-KHRONOS — derivative semantics

The Khronos GLSL 4.60.8 specification defines `fwidth(p)` as `abs(dFdx(p))+abs(dFdy(p))` and explains that derivatives are local fragment-neighbor differences. Source: https://registry.khronos.org/OpenGL/specs/gl/GLSLangSpec.4.60.pdf

Transferable limit: derivatives provide a footprint-related signal; the specification does not turn a custom `smoothstep` response into an exact reconstruction filter.

### O-R31-EPIC — filter width is explicit operator input

Current Epic UE 5.8 documentation exposes `FilterWidth` on procedural Noise and describes it as controlling blur. Source: https://dev.epicgames.com/documentation/en-us/unreal-engine/utility-material-expressions-in-unreal-engine

Transferable method: make footprint/filter policy explicit. Epic’s interface is not evidence that the Tiles thresholds or repeated response are correct.

## Executed evidence

### Existing typed-wave probe

Executed `PROBES/footprint_filter_probe.py` unchanged:

- raw point sample vs exact rectangular cell average: RMSE `0.0644792831`;
- numerical cell average vs analytic sinc average: RMSE `0.0000454632`;
- result: pass.

Scope: exact only for the probe’s plane-wave basis and rectangular footprint.

### Tiles response fixture

Added and executed `PROBES/tiles_footprint_response_probe_r31.py`.

The fixture locks the fixed shader response and the two actual high-frequency height amplitudes/scales: 390 at 0.00012 m and 1167 at 0.000047 m. It evaluates 4096 deterministic oriented plane-wave samples at each of five normalized footprints per scale against analytic rectangular-footprint averages.

Across the eight transition cases, summed RMSE was:

- one gate: `4.2845666e-05 m`;
- repeated gate: `6.0908395e-05 m`;
- repeated / single: `1.4215766`.

Counterexample retained: at normalized footprint 0.5, repeated gating was closer for both tested scales. The correct result is therefore not “double is always worse”; it is “double is a materially different, non-idempotent response whose intent and task error are undocumented.”

The fixture is a response-curve counterexample, not an emulation of Tiles `n3`, a WebGL run, or human visual acceptance.

## Current Best View

Each procedural signal path needs one declared cumulative filter response. Nested nodes may each filter locally, but the composed response must remain inspectable and must be validated against the actual downstream task. Reusing the same gate twice is neither harmless nor automatically wrong.

For Tiles R2, keep the current candidate unchanged until a fixed-camera WebGL A/B compares current `gate²` paths with one-gate paths on the real shader. Evaluate structural height and normals in linear diagnostics before judging final color.

## Status ledger

- Observation: fixed Tiles source and current official derivative/filter-width documentation.
- Candidate: CPU plane-wave probes and the “one declared cumulative response” contract.
- Current Best View: repeated filtering is a response-design decision requiring explicit provenance and task evidence.
- Frozen: KAOPU R1 unchanged.
- Rejected: “fwidth is an exact pixel box filter”; “double gating is automatically a production bug”; “more irregular noise fixes sampling”; “CPU surrogate equals visual acceptance.”
- Unknown: actual `n3`/nested-wave response, GPU derivative behavior on curved tile geometry, near/mid/far image stability, iPhone cost, and preferred perceptual balance.

## Routing

Prepared for Tiles Mother and material-bearing Mothers. No Mother acknowledgment or adoption was observed in this cycle. See `MOTHER_ROUTING_R31_TILES_FILTER_RESPONSE.json`.

No independent external-AI review was performed in this bounded cycle; no unavailable access is claimed.
