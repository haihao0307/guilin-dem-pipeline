# R02 independent diagnosis of the rejected R01 baseline

This is a read-only diagnosis, not a new candidate or a user approval. `R02_DIAGNOSTIC.json` binds the actual R01 standalone HTML, all measurements and source material declarations. The source files, source scores, production code and eyes were not edited by this lane.

## What the previous checks missed

The original full vertex fields, indices, UV coordinates and decoded texture pixels were preserved. This proves source-address fidelity at rest. It does **not** prove that materials are rendered according to glTF, that dynamic triangles retain reasonable edge lengths, or that the motion looks natural. Coincident seam vertices, finite normals and CPU/GPU agreement can all pass while adjacent triangles stretch or fold.

## Source resolution and material support

| Source label | Visible body base-color resolution | Source geometry | R01 presentation issue |
|---|---:|---:|---|
| Herring | 1024 × 1024 | 3,936 body vertices | Body normal map exists and is preserved in the final R01 candidate and cloned reference. |
| Yellow-label tuna | 4096 × 4096 | 4,053 body vertices | Original ORM also declares occlusion, but R01 omitted AO. Final R01 reference preserves the candidate's ORM/normal maps. Source default roughness is 1 when absent; R01 defaulted to 0.57. |
| Blue-label tuna | 512 × 512 | 1,746 body vertices | Low source texture and mesh resolution are real limits. Source `KHR_materials_specular.specularFactor = 0.1879596` was ignored by MeshStandardMaterial. |
| Colorful | **128 × 128** | 6,018 central body vertices | All selected fish primitives use material 1, texture index 2. The other 1024² images belong to material 0 and cannot be substituted into these UVs merely to claim higher resolution. |
| Picasso label | 1024 × 1024 | 9,161 vertices | Source declares `KHR_materials_unlit`; R01 rendered it as a lit standard material. |

R01 also forced DoubleSide for every material and ignored source sampler settings. The present assets happen to use RepeatWrapping, linear magnification and trilinear minification, but this must be verified rather than assumed for future models. **Final R01 reference materials clone the candidate's materials and retain normal/ORM maps.** Both inherit the same omitted AO, extension support and wrong fallback defaults; their agreement cannot prove a complete original glTF rendering. An earlier provisional R01 implementation did use a simpler reference material, but it is not the delivered R01 baseline. The initial version of this diagnosis incorrectly conflated the provisional implementation and final baseline; the actual baseline JSON and committed source were checked and this attribution is corrected.

The Colorful 1024² base-color image was independently decoded and inspected: it is the enclosing rock/bubble underwater backdrop, not a higher-resolution version of the fish skin. The 128² image is the actual fish pattern. Their block-averaged pixel correlation is only 0.07994. Increasing a 128² or 512² image's storage dimensions cannot recover missing authored detail. Source-linked procedural material refinements must be identified as an engineering layer and must not pretend to be newly recovered original pixels or invented anatomical markings.

## Actual GPU edge strain

The diagnostic compiles the **actual R01 deformation shader**, reads transformed full vertices through WebGL2 transform feedback, and measures original indexed triangle edges. It samples 16 poses each in cruise, hover, burst and turn: 64 poses per source. Ocular meshes are excluded from this body/fin diagnostic.

| Source | Maximum edge-length ratio | Minimum edge-length ratio | Largest frame's edge-ratio P99 |
|---|---:|---:|---:|
| Herring | **4.1461** | **0.2777** | 1.1234 |
| Yellow-label tuna | 1.1516 | 0.8513 | 1.0226 |
| Blue-label tuna | 1.1808 | 0.8068 | 1.0766 |
| Colorful | 1.2309 | 0.7660 | 1.0609 |
| Picasso label | **13.4884** | **0.0718** | **1.9229** |

The Herring maximum is source body edge 515–516: finId 6 versus body 0, weight 1 versus 0. Its original length is 0.000604 BL; actual hover deformation increases it to 0.002504 BL. The Picasso maximum is edge 5181–5304, also finId 6 versus body 0 with weights 1/0: 0.002750 BL becomes 0.037099 BL. This identifies a hard categorical fin/body boundary, not a precision loss in original mesh reconstruction.

Herring has 324 mixed fin/body triangles; Picasso has 1,083. Across tested frames, as many as 543 mixed Picasso edges exceed ±25% relative length change. A static screenshot alone can miss these extrema. Data on every sampled mode/frame and initial mixed-triangle examples is retained in the JSON.

R01 `fishNormal` rotates the source normal by the local fin angle, then applies the spine cofactor. It omits the spatial derivative of fin weight and fin phase. Where fin weight varies over a triangle, this is not the geometric normal of the actual transformed surface; inaccurate highlights can exaggerate apparent cracks. Source binding continuity and a derivative-aware normal must both be fixed.

## R02 verification requirements

- Preserve eyes exactly: source eyes, ocular shape/material functions and eye behavior profile values remain frozen. Body transport may carry the frozen eyes with the head.
- Preserve original surfaces, UVs, source pixel hashes and original material declarations; support the source extensions and channel defaults, including an honest complete reference material.
- Test the actual final shader's indexed edges over motion phases. Keep mixed fin/body triangle roots fixed, measure local edge stretch/compression and inspect the previously failing regions during hover, burst and turn.
- Measure the final geometric normal against the actual displaced surface rather than validating only that it is finite and unit length.
- Inspect Herring dorsal and ventral junctions, Picasso median fin roots and tail, and Yellow-label tuna transitions through continuous motion. A technical bounded amplitude test is not a natural-motion certification.
- Provide one interactive system entry for the five sources and the preserved marine-fish production line, with only the selected type visible.
- User visual acceptance and production readiness remain false until explicitly accepted by the user.

## Workbench checklist for this diagnostic

- [x] No generated image substitutes were used.
- [ ] Production code modified by this diagnosis — intentionally read-only.
- [x] Evidence comes from the real standalone Three.js workbench and actual WebGL2 transforms.
- [ ] New public R02 link verified — publication lane pending.
- [x] Screenshots are internal evidence, not a replacement deliverable.

## Provisional R02 remeasurement

The candidate (not final frozen production) was independently measured with actual WebGL2 transform feedback over 64 motion phases. Original indexed edges across all visible body/fin vertices were retained. Current edge length ratio extrema are Herring 0.782–1.184, Yellow-label 0.905–1.081, Blue-label 0.854–1.153, Colorful 0.889–1.112 and Picasso 0.815–1.192. The earlier R02 Herring tail 1.441/0.586 regression was corrected by using the full visible source caudal section radius in curvature bounds.

A separately written central finite-difference position function perturbs source coordinates and fin weight using the measured finGradient field. It agrees with the actual GPU Jacobian normal to maximum component error 0.000167 and angle error 0.011 degrees across sampled body and fin vertices; no nonfinite positions/normals were observed. This verifies geometric normals rather than merely checking unit length.

All source triangles were also measured without filtering away slender triangles. Herring reaches area ratio 1.352 at source triangle 3975 [1000,1002,2951], with all fin weights zero. Yellow-label reaches 1.410 at triangle 699 [814,813,1362], with adjacent fin-6 weights about 0.0618. Their source areas are 2.216e-6 and 2.050e-6 in body-length units and their vertices are nearly collinear. Continuous nonlinear bending can change these very slender triangles relative area materially despite bounded edge lengths. The report preserves these extrema; it does not claim zero surface strain.

These are provisional observations, not a final acceptance. Final HTML/source hash binding and final fresh visual review remain required. Human visual acceptance remains false.
