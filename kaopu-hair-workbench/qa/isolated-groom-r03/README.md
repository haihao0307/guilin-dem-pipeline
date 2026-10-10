# R03 root and nape research candidate

R02 stays preserved at ../isolated-groom-r02/. This new candidate tests a lower continuous nape boundary, surface-bound follicular unit clusters and a crown emergence whorl. These are artistic parameters informed by anatomy, not a person-specific segmentation or medical model.

The first36k×9 trial failed close-up smoothness and crown-flow review. Current near study uses96,000 roots×16 rendered segments,32 surface guide supports,50μm base radius with finer nape strands. ?quality=light uses36k×12 and75μm base radius. Only one style guide cache is retained. These are explicit quality/memory tradeoffs; near geometry alone exceeds200MB after radius attributes. Roots begin20μm above actual skin instead of350μm. The actual mask area and active hairs/cm² are measured by triangle quadrature; we do not claim full biological density.

No physics, collision acceptance or film-quality acceptance. Licensed original GNM head and existing R8 optical shader are preserved. No teacher curves or restricted assets. Source summaries in REGION-RESEARCH.md.

Current preview default: near96k on wide screens, light36k on narrow screens; explicit query overrides. A viewport screenshot does not prove phone GPU memory/performance. The part now fades into crown flow instead of splitting the entire occiput. Stable pose/reset actions no longer rebuild unchanged shadow maps.

## R03 rigid-pose and shadow follow-up

The native rules remain self-authored GNM triangle/barycentric follicular units, regional density, directional surface guides and curve rendering. None of HAAR, Perm, DiffLocks or StrandHead was run or imported as a trained generator. Their reading and algorithm experiments do not establish reproduction. SOMA-X belongs to body/motion integration, not hair generation.

Rigid pose now uses shared object transforms instead of copying and rotating all fibre attributes. It removes 121,046,400 bytes (115.44 MiB) of CPU pose snapshots without changing 96k roots, 16 render segments or the 212,745,600-byte geometry allocation. The reachable model buffers remain 347,796,004 bytes, excluding browser/driver and JavaScript overhead. CPU transform update measured 0.20 ms in the software-rendered test; this excludes rendering and expensive shadow-map updates, so it is not total frame time or hardware GPU performance.

Same-camera caster isolation identifies the dark triangle behind the ear as the opaque ear/head directional shadow, not missing hair. A bounded PCF kernel change (radius 4 to 12 texels) softens its boundary with the same two lights, camera, exposure and geometry. This is a filter approximation, not physical area-light transport. The contact region should remain shadowed.
