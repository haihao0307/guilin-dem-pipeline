# R69 | Yohei / twigl historical host-contract audit

Date: 2026-09-14  
Status: **Candidate partial**. This cycle advances one bounded question: whether the closest official historical twigl `geekest (300es)` host initializes or rewrites `i/e/R/q/o` before the user fragment executes.

## Inherited state and priority

R68 found material reads of `q`, `i`, `e`, `R` and `o` before defined values, but the host wrapper was Unknown. No Mother acknowledgment was observed before this cycle. The Gaussian R66 cache-invalidation question remains queued and is not overwritten.

## Observation roots

### OR-R69-YOHEI-CODROPS — author article, same lineage as R67-R68

The author's 2025-02-18 article says he discovered twigl.app and describes the code-golf mode as `geekest (300es)`. It embeds “Macroscopic microscope” as a 2025-01-18 post. This connects the artwork to the tool/mode, but does not expose a twigl share URL or deployed build receipt.

### OR-R69-TWIGL-HISTORY — official tool-author repository

The GitHub commit query ending on 2025-01-18 returns `969491b285ba217fd895132a466ee6b3128243f3` (2023-05-04) as the latest repository commit at or before the artwork date. At that locked commit:

- `src/fragmen.js` is blob `8fdee9a542b31cc2e3f9a106885c9f529f3c05c9`;
- `MODE_GEEKEST_300` selects GLSL ES 300;
- `GEEKEST_CHUNK` aliases `FC`, sets high precision, and declares uniforms `r/m/t/f/s/b`;
- `GEEKEST_OUT_CHUNK` only declares `out vec4 o;`;
- `preprocessFragmentCode` concatenates the ES 300 header, geekest chunk, output declaration, optional `void main` wrapper, unchanged user code and optional closing brace.

There is no assignment to `i`, `e`, `R`, `q` or `o` before the user code. The repository's MIT license applies to twigl host code only, not automatically to the artwork.

### OR-R69-GLSL-ES-300 — Khronos normative specification

GLSL ES 3.00 revision 6 is the exact language profile implied by the mode. Section 5.8 states that a read before a write or initialization is legal but produces an undefined value; section 1.3 says undefined values may vary. This corrects R68's use of desktop GLSL 4.60 as a semantically matching but not profile-exact reference.

### R69 contract replay — reproducible derivation, not an independent physical root

`run_yohei_twigl_host_contract_r69.mjs` replayed the locked wrapper order with the large, irrelevant noise library replaced by a marker. All 12 declared checks passed. The user text stayed contiguous; no target variable was assigned before it; the output remained a declaration only; and an existing `main` was not duplicated.

## Current Best View

1. **For the locked official repository snapshot, twigl does not supply the missing initial state.** It declares `o` but does not initialize it, and it neither rewrites nor initializes `i/e/R/q`.
2. **The result is not yet proof of the exact January 2025 deployment.** The article establishes twigl and `geekest (300es)`; matching the live artwork to repository bytes remains Candidate until a share URL or build receipt is found.
3. **A framebuffer clear cannot repair `o+=...` source semantics.** Clearing an attachment initializes destination storage, not the shader variable's value before its compound read.
4. **A portable KAOPU study must use explicit seeds and label itself a reinterpretation.** Faithful historical emulation requires the original deployed runtime and pixels; it cannot be inferred from a zero-seeded port.
5. This remains a language/host-contract method, not geometry, PBR material, physical process, Object DNA or production asset evidence.

## Rejected

- **Rejected:** twigl `geekest (300es)` portably zero-initializes `i/e/R/q/o`.
- **Rejected:** `out vec4 o;` is an initialization.
- **Rejected:** clearing the framebuffer initializes the local/output value read by `o+=`.
- **Rejected:** current twigl `master` can be substituted for the historical snapshot without chronology.

## Unknown

- exact twigl share URL and deployed build used for the artwork;
- byte-exact artwork source and article dash repair;
- original browser, WebGL implementation, compiler, GPU, framebuffer and pixels;
- whether implementation-specific undefined values were intentionally relied upon;
- artwork adaptation and redistribution license;
- any human visual acceptance.

## Transferable method

For hosted shader references, lock four layers separately:

1. publication evidence and date;
2. the nearest pre-publication host commit and relevant blob;
3. generated shader text, including declarations versus assignments;
4. exact language-profile rules and live runtime evidence.

Do not let a repository chronology claim become a deployment receipt. Do not let framebuffer state substitute for shader-variable initialization.

## Incremental routing

Prepared, not adopted:

- **Renderer / Three.js Mother:** capture the fully preprocessed shader and run a first-read/first-write audit before any port. Keep an explicitly initialized portable version separate from any historical-runtime experiment.
- **Landscape / material Mothers:** reuse the four-layer host-contract method only; do not copy the artwork or infer material/geometry truth.

No production Mother branch, Canonical Truth or Frozen R1 was modified. First-tier expert AI was not called.

## Next true gap

Obtain the original twigl share URL or another deployment receipt that identifies the live build and byte-exact source. Only then compare compact, literal-expanded and explicitly initialized variants in pinned WebGL2 runtimes; undefined-state behavior must be measured across independent browser/GPU families rather than promoted from one driver.
