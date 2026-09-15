# Learning Log R85 — Decoded-aware three-stage Half target

Status: **Candidate partial; fixed software route only**. Date: 2026-09-15.

## Question

Does the frozen R84 decoded-aware three-case matrix select the `f32-staged` input/output model on the locked Three.js r186 Half software route?

## Frozen method and evidence sequence

- Matrix `KAOPU-GAUSSIAN-R84-DECODED-STAGE-MATRIX-A`, its raw SPZ bytes, R80 Alpha-table hash and R82 RGB decode-table hash were fixed before target execution.
- The runtime was Three.js `0.186.0`, `WebGPURenderer({ forceWebGL: true })`, Chromium 143 and ANGLE Vulkan SwiftShader.
- Six independent Float Alpha planes first had to reproduce R80 by center value and full-plane hash.
- Each case then had to reproduce its raw Alpha/RGB bytes, decoded normalized color attribute, and complete prefix-1 Half plane. Only if all three passed could prefix 2 be rendered.
- Each prefix was a separate full-frame page load. Duplicate prefix-2 controls were also required to be bit-identical.

## Preserved failures and correction

1. Run `34990883261` failed before evidence collection because the background HTTP server was not ready. This is an operational failure, not a target result.
2. Run `34991143922` reproduced all six Float planes, all raw bytes and every prefix-1 Half plane, but the decoded-attribute gate failed in all three cases. Prefix 2 was correctly prohibited.
3. The gate had expected RGBA component four to be 255. The pinned official Three.js r186 `SPZLoader.js` blob `456aa33e7c6e10bec74b34a5413606bb45bb0c16` assigns `colorBytes[i4 + 3] = alphas[i]`. Only this expected attribute component was corrected; matrix bytes and numeric predictions were unchanged.
4. Corrected run `34991605039` passed all semantic gates.

## Observation

- All six R80 Float planes reproduced exactly.
- All three target cases reproduced exact raw bytes, decoded RGB plus Alpha attributes, and complete prefix-1 Half planes.
- Prefix-2 center channels selected the staged group and rejected the declared ablation:
  - complement case: observed `0.476318359375`; `no_comp` predicted `0.4765625`, a difference of `0.000244140625`;
  - product case: observed `0.2037353515625`; `no_prod` predicted `0.20361328125`, a difference of `0.0001220703125`;
  - sum case: observed `0.134765625`; `no_sum` predicted `0.1346435546875`, a difference of `0.0001220703125`.
- Each declared alternative differed in exactly one full-plane channel: center red, green or blue respectively. The staged replay matched all `4,356` channels in every case.
- Each case alone leaves two untested ablations tied with staged, but the exact-model intersection across the three independently rendered cases is only `staged`.
- All duplicate prefix-2 frames were bit-identical. The final artifact SHA-256 is `f9398e946a64dc2038c5d9619f62d1075397c9553a6eb6b3ba9b6b3ba4ebb313`.

## Observation Roots

1. **R80 runtime root:** inherited and freshly replayed Float effective-Alpha planes on the same Chromium/ANGLE SwiftShader route.
2. **R82 parser root:** pinned official parser semantics and byte-exact decoded attributes. Source reading and execution remain one parser lineage.
3. **R84 CPU-search root:** bounded candidate discovery and deterministic replay; not target evidence.
4. **R85 target root:** separately preregistered independent Half prefix readbacks on the fixed software route.

Roots 1 and 4 share the same runtime and therefore are not cross-backend independence. Root 2 establishes the input contract, not blending behavior.

## Current Best View delta

The R84 matrix is now an effective three-case target diagnostic on this locked route. Together, its cases select an `f32-staged` input/output-equivalent replay: Float32 complement, source product, destination product and sum are rounded before Half storage.

This does not expose hidden driver instructions and is not a portable WebGL, WebGPU or GPU rule. It strengthens R78 from one endpoint-color counterexample to three decode-aware stage discriminators while remaining `Candidate partial` outside the fixed evidence root.

## Rejected

- A green workflow alone is semantic acceptance; the earlier prefix-1 failure remains preserved.
- The decoded color attribute always has Alpha 255.
- R81 can be repaired or renamed into R85; R81 remains a semantic failure and R83 remains its negative control.
- One case independently selects all three stages.
- SwiftShader input/output equivalence proves internal instructions or cross-backend behavior.

## Unknown and boundaries

Hardware GPU, a genuinely different WebGL implementation, WebGPU, Safari/iPhone, real assets, performance, visual acceptance and Mother adoption remain **Unknown**. SPZ remains a lossy delivery candidate, not Canonical Truth. Production Mothers, Canonical Truth and Frozen R1 were not modified.

First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Next gap

Replay the unchanged R85 matrix and gates on one genuinely different hardware-backed WebGL implementation. Treat a matching result as a new runtime observation root, not as formal cross-backend proof; if no hardware route is available, do not repeat SwiftShader as novelty.
