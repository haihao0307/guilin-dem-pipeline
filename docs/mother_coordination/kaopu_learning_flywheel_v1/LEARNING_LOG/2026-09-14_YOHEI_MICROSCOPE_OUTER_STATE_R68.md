# R68 | Yohei Macroscopic Microscope outer-state audit

Date: 2026-09-14  
Status: **Candidate partial**. This round advances one bounded question: whether the published compact outer loop is portable and deterministic without a host/initial-state contract, and whether `d/=-d` means direction reversal.

## Inherited state and priority

R67 remains the latest coordinator checkpoint and no Mother acknowledgment was observed before this cycle. R67's byte-exact source, host, license and runtime gaps remain open. Because inaccessible original bytes block a faithful GPU reconstruction, this round tests a prerequisite already visible in the published expression rather than inventing missing source.

The Gaussian R66 cache-invalidation question remains queued and is not overwritten.

## Observation roots

### OR-R68-YOHEI-CODROPS — author-authored article, same lineage as R67

The 2025-02-18 article displays the compact declaration and loop:

- `float i,e,R,s;vec3 q,p,d=...`;
- a typographic `q–` in the loop initializer;
- `i++<119.` in the condition;
- `i>89.?d/=-d:d` in the update;
- first-body reads through `e+=...`, `o+=...`, and `p=q+=d*e*R*.16` before the later `R=length(p)` assignment.

The webpage is not byte-exact source. Repairing the dash as `q--` remains Candidate, but the unaffected declarations, compound assignments and `d/=-d` token are direct page observations.

### OR-R68-GLSL-460 — Khronos normative semantics, independent root

GLSL 4.60.8 states:

- reading a variable before writing or initializing it is legal, but its value is undefined;
- `lvalue op= expression` is equivalent to reading `lvalue`, applying `op`, then assigning;
- arithmetic on same-size vectors is component-wise;
- pre/post decrement works component-wise.

This specifies language semantics. It does not identify the original host, GLSL profile, compiler or GPU.

### OR-R68-CPU — reproducible derivation, not an independent physical root

`run_yohei_microscope_outer_state_r68.mjs` executed 12 predeclared checks; all passed.

With explicit `i` seeds, the same visible loop condition executes 119 bodies from `i=0`, 114 from `i=5`, and 121 from `i=-2`. For `i=0`, the update branch first becomes true after body 90 and runs 30 times. This is not a guess at the author's seed; it is a counterexample showing that an undeclared seed is behaviorally material.

With explicit zero `e` and `R`, changing only `q` from `[0,0,0]` to `[1,1,1]` changes post-decrement `q` from `[-1,-1,-1]` to `[0,0,0]`; the latter makes the first `length(p)` exactly zero and reaches R67's known singularity. A default-zero assumption is therefore not an innocuous transcription detail.

For finite nonzero `d=[0.25,-0.5,1]`, component-wise `d/=-d` produces `[-1,-1,-1]`, not negation `[-0.25,0.5,-1]`; maximum component difference is `1.5`. If a component is zero, the corresponding `0/-0` result is not a finite portable direction.

## Current Best View

1. **The published fragment is not a portable deterministic standalone program without an explicit host and initialization contract.** `q`, `i`, `e` and `R` have material reads before defined values; `o` also depends on the unavailable wrapper/output contract.
2. **`d/=-d` is a component-wise snap, not ray reversal.** For every finite nonzero component, `x/(-x)=-1`; replacing it with `d=-d` would author a different marcher.
3. A faithful study must preserve two layers: the exact compact tokens plus their original host/runtime contract, and any separately versioned portable reinterpretation with explicit seeds and zero/singularity policy.
4. A visually matching result from one permissive compiler would be runtime evidence only. It cannot convert undefined source state into a cross-runtime language guarantee.
5. None of these findings makes the artwork a physical process, material truth, Object DNA or a production generator.

## Rejected

- **Rejected:** uninitialized GLSL locals may be portably treated as zero.
- **Rejected:** `d/=-d` is shorthand for reversing `d`.
- **Rejected:** the published declaration alone fixes 119 iterations. That count follows only after an explicit `i=0` seed.
- **Rejected:** a matching image on one compiler proves portable defined semantics.

## Unknown

- original byte-exact shader and exact repair of the article's typographic dash;
- exact twigl or other host wrapper, including whether it rewrites or initializes locals/output;
- whether reliance on implementation behavior was intentional;
- original GLSL profile, precision, compiler, GPU, framebuffer and pixels;
- adaptation/redistribution license;
- which explicit portable seed and singularity policy, if any, the author would endorse.

## Transferable method

Before expanding or porting shader golf:

1. inventory every first read, first write and compound assignment;
2. lock host-provided values separately from language locals;
3. expand vector compound arithmetic literally before assigning an intuitive label;
4. create seed and zero-component counterexamples;
5. keep faithful emulation and portable reinterpretation as different versions;
6. compare pixels only after the state contract is fixed.

## Incremental routing

Prepare, do not claim adoption:

- **Renderer / Three.js Mother:** require explicit initializers for every ported scalar/vector and record wrapper-provided output initialization. Add a negative control distinguishing `d/=-d` from `d=-d`, plus NaN/zero-component checks.
- **Landscape / material Mothers:** reuse the first-read/first-write audit method only. Do not copy the marcher or infer a physical rule from its component snap.

No Mother acknowledgment was observed. Production branches, Canonical Truth and Frozen R1 were not modified. First-tier expert AI was not called.

## Next true gap

Obtain the original host wrapper and byte-exact source, then determine whether the host explicitly initializes or rewrites `i`, `e`, `R`, `q` and `o`. Only after that gate should a fixed GLSL runtime compare faithful compact source, a literal expansion, and an explicitly initialized portable reinterpretation.
