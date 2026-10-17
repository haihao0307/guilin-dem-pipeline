# Official feature coverage and faithful browser boundary

| Official feature | Exact source | Reproduction status | Browser status |
|---|---|---|---|
| Complete Stage-2 material | README; checkpoint loader | One real 145/Ours checkpoint downloaded and audited | Full native float32 range-loader planned |
| 46-channel 2048² latent texture | anisotropicLatent.py LatentTexture | Original tensor strictly loaded, no reduction | 46-layer r32float storage budget 736 MiB |
| Bilinear interpolation, border clamp, align_corners=False | _sample_from_texture | Original code executed | Exact manual bilinear shader planned |
| Learned normal/tangent Gram-Schmidt frame | extract_frame_from_latent | Original code executed | Must preserve pre-offset frame and epsilon conventions |
| Neural parallax query | NeuralGeometry + eval_brdf | Original 22→16→16→8→2, ReLU/Tanh, factor 0.08 executed | Exact shader planned |
| UV resample after modulo wrap | eval_brdf | Original code executed | Must preserve double modulo and border convention |
| Degree-3 SH encoding | utils/ops.py | Original 16 bases each for wi/wo/N executed | Exact 48 coefficients planned |
| Shared BRDF decoder | BRDFDecoder | Original 72→256→256→328(skip)→256→256→3 executed | Multi-pass float32 MLP planned, not analytic PBR |
| LeakyReLU and Softplus | BRDFDecoder | Original hidden slope 0.01 / output threshold 20 | Shader parity test required |
| RGB scaling + cosine | eval_brdf + mlp.py | Original factor and swapped light/view convention executed | Preserve exact convention |
| Native two-sided cloth | MLPBRDF.eval | Original shader executed | Must match hemisphere/mirroring rules |
| UV repeat density | MLPBRDF uv_tiling | Original default 5 repeats | Real UV scale control required |
| Original cloth-on-bar geometry and environment | example scene.xml | Official meshes+HDRI rendered on CPU | Original geometry/transform planned |
| Multi-bounce path tracing, env importance sampling | Mitsuba path integration | Original CPU renderer executes | Not yet implemented; direct-light preview cannot be called path-traced equivalence |
| PNG/EXR and tonemap options | render.py | Original file output executed | Read-only reference compare plus own export planned |
| Material switching among released models | 13 RoboCloth materials | Manifest identifies available materials; 145 only loaded | Later selection must unload old model and show actual download budget |
| Custom geometry assignments / UV generation | materials.json; generate_uv.py | Source audited, not exercised | Not yet implemented |
| Optimize new material Stage 2 | docs/optimize_new_material.md | Source available; no training performed | Not implemented, must be labeled |
| Train shared decoder Stage 1 | docs/train_decoder.md | Source available; no training performed | Not implemented, must be labeled |
| Paper tables and comparisons | docs/reproduce_paper.md | Source available; not rerun | Not implemented |
| Robot capture/calibration/COLMAP | docs/capture_pipeline.md | Source available; hardware/data not recreated | Documentary only |

500 is the capture-dataset count. The published Stage-2 RoboCloth assets contain 13 distinct materials, not 500 ready-made browser materials.

## Fidelity gates
- Raw model tensor bytes equal published checkpoint storage bytes
- Deterministic neural output parity against official Python, including grazing/frame/parallax cases
- Exact camera/geometry/UV/light matching before any image comparison
- Report integrator differences explicitly; an exact decoder under a new light is not the original full path-traced scene
- Full-resolution material remains full resolution even while rendering progressively at a lower viewport resolution; viewport sampling and material texture fidelity must be labeled separately
- Video or static-reference controls are never presented as live neural rendering
