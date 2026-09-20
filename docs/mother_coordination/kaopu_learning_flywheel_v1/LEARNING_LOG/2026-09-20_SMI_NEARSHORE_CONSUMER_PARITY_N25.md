# N25 — SMI nearshore bed-consumer parity

## Bounded question

After PR #100 changes `waveSurface` to read `SMI_WAKE_BAY_R01`, does the fixed v0.2.3.0 nearshore renderer now consume the same bed for all state that controls shoreline water/foam visibility?

Status: **Candidate partial**. One source/runtime sub-contract is verified; complete renderer parity, visual correction, device performance and adoption are not.

## Observation roots

1. **O1 — fixed production review (not a new independent image observation).** At commit `c07eec73616f613acde90881ac642b0972f12391`, `VISUAL_REVIEW.md` reports CPU contact checks passing while a broad white nearshore sheet remains, and identifies old GPU bathymetry as a plausible source mismatch. This round did not re-label that report as direct observation.
2. **O2 — PR #100 candidate evidence.** Head `fa227b7c73cbce92f7a5548a5eeae8d2df45c7cd` generated a local GLSL bed adapter and reproduced its CPU values in Chrome 152 / WebGL2 / ANGLE SwiftShader. Its recorded maximum bed error is `0.0005373 m`; full-scene desktop/mobile review is still absent. PR #100 has no Mother acknowledgement as of this round.
3. **O3 — N25 exact-release integration and executable source probe.** The exact fixed release `index.html` (SHA-256 `5ec8a35e...a9a1d5`) accepted the PR #100 patch in two places and unpatched byte-identically. The integrated candidate SHA-256 is `c6b8e573...db962`. The N25 probe passed and found one authoritative read in `waveSurface`, but also one remaining legacy bed read for vertex shallow depth, one for `vThickness`, and one legacy `smiShoreDistance` read for fragment shoreline bands.
4. **O4 — primary language contract.** GLSL ES 3.00 revision 6 specifies that a vertex output and same-name fragment input form a stage interface; the fragment receives the value produced by the vertex stage. It also specifies `smoothstep(edge0, edge1, x)` returns `0` at/below `edge0` and `1` at/above `edge1`.

O1, O2 and O3 share the same project source lineage and are not claimed as independent physical observations. O4 is an independent standards root, not evidence that this scene is visually correct.

## Executable counterexample

At the authoritative mean-water crossing in the bay:

- coordinate: `(23.7731023051 m, 22.5951798091 m)`;
- sea level: `0.18 m`;
- legacy bed: `0.00 m`;
- `SMI_WAKE_BAY_R01` bed: `0.18 m`;
- zero-displacement surface height: `0.18 m`.

The patched `waveSurface` therefore meets the authoritative bed, but the still-unpatched vertex expression `vThickness=max(0.0,y-bedH(p))` emits `0.18 m` instead of `0.00 m`. The actual fragment gate `smoothstep(0.008,0.07,thickness)` is consequently `1` under the legacy thickness and `0` under the authoritative thickness. This is a concrete state disagreement at the same coordinate; it does **not** prove the final pixel or whole white-sheet cause because other wave, field, blend and foam terms remain active.

## Current Best View

**Candidate partial:** a shoreline adapter is not complete when only the displacement function reads the authoritative bed. Every downstream consumer whose semantics depend on water depth, bed distance or shoreline distance must name its source and units. For this release, at minimum inspect and version together:

- displacement bed (`waveSurface`);
- vertex shallow-depth bed (`d0`);
- vertex-to-fragment thickness (`vThickness`);
- foam/breaker shoreline distance (`smiShoreDistance`);
- CPU contact/terrain bed.

Same-coordinate value checks should include bay blend boundaries and the mean-water crossing. A compile pass verifies syntax and one runtime path; it does not establish consumer completeness or visual acceptance.

## Rejected

- **Rejected:** “PR #100 proves complete CPU/GPU nearshore parity.” It verifies the local generated adapter and the `waveSurface` replacement, not every bed/distance consumer.
- **Rejected:** “A shader compile proves the broad white sheet is fixed.” Compilation and source parity are separate from full-scene pixels.
- **Rejected:** “The remaining legacy thickness proves it is the only visual root cause.” The counterexample proves a mismatch, not exclusive causality.

## Frozen

- Frozen deep-ocean and cloud source remain untouched.
- No second shoreline is introduced.
- Global legacy `bedH`, production entry, canonical terrain/contact truth and approved source boundaries remain unchanged.
- This round does not adopt or merge PR #100.

## Unknown

- Full-scene desktop fixed-view result after all relevant consumers share the authoritative contract.
- `390×844` device/browser result and hardware-GPU cost.
- Whether legacy `smiShoreDistance` bands, carried foam fields, or another term dominate the recorded white sheet after thickness parity.
- Mother implementation/acknowledgement and user visual acceptance.

## Routing recommendation

Route one incremental correction to SMI Ocean / PR #100 and issue #94: extend the reversible experiment so `d0`, `vThickness` and any local foam/breaker distance used inside the wake-bay support derive from one versioned authoritative adapter, while preserving exact legacy behavior at zero blend weight. Require source-count guards, same-coordinate CPU/WebGL comparisons at both blend boundaries and the mean-water crossing, then full-scene desktop and `390×844` A/B. Do not route as adoption or merge approval.

## Reproduction

Run the committed probe against an exact integrated candidate and explicit PR #100 module paths:

`node smi_nearshore_consumer_parity_probe_n25.cjs <candidate-html> <shoreline_gpu_adapter.cjs> <legacy_v0230_fixture.cjs>`

Machine receipt: `smi_nearshore_consumer_parity_result_n25.json`.

Primary reference: [Khronos GLSL ES 3.00 revision 6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf).

First-tier expert AI was not called; this was source, standard and executable verification, not a duplicate expert meeting.
