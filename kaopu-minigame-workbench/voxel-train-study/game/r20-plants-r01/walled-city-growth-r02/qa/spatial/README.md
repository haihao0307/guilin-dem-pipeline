# Same-world observed segment GPU check

Independent candidate under `spatial-runtime/`; the earlier `runtime/` remains unchanged. No reference photographs, illustrated source images, private Library identities, observation annotation files or whole debug world are uploaded in this closure.

The compact world includes all 24 authored buildings, with B09 replaced by the primary illustrated S05-R spatial ratios and 14 nonuniform floor bands. Its metre scale and unobserved depth remain authored assumptions. 49 use zones and 53 simplified use-object recipes do not mean households, population, mature furniture, or a completed environment. The old B08-B09 borrowing link is disabled because its former endpoint no longer refers to the new public circulation.

`kernel.mjs` is the frozen shared scalar source that generated the actual runtime WGSL. `keyframes.json` contains only test positions, not rendered geometry. `points-build.mjs` derives finite body/support probes from this same kernel and runtime buffer on the runner. All runtime views render one packed snapshot; the inspection cuts never rebuild the city.

Runtime changes:
- Actual nonuniform floor, room, port and stair solids from the source-informed candidate.
- Real local metric wetness domains and true external opening classification; mother coefficients are unchanged.
- Same resolved fabric state drives geometric coat retention and PBR.
- Furniture object ID retained across hit/shade; default long-grain axes are use-level approximations, with separate bed/chair member axes still unresolved.
- Primary/retry share one pipeline using separate immutable uniform buffers. 180/1024 budgets and the original tracing equations are unchanged.

Node static/source checks and local macro/body checks precede actual native WebGPU compilation. The runner separately records initialization, GPU-completed frame time, all-ray hit/miss/exhaustion, same-snapshot identity, finite sampled support/clearance and any conservative-bound comparison cases. Zero exhaustion or successful compilation does not imply visual acceptance or real-device speed.

The two images are full-frame 480×320 internal render at 960×640 CSS: a Z section exposing actual uses and an X section exposing the rotated stair. These are inspection candidates inside the complete world, not a return to the rejected single room. No Pages deployment is part of this check.

## Staged-shading correction after actual device loss

Commit 44bb7d65 finished all pipelines in 131.8s and the first main-intersection tile in 1.42s, then lost the WebGPU device during the first combined shade. No complete frame exists for that commit. The adapted execution pattern comes from the user's verified bureau c54cccad / run38191438594, not from a new replacement renderer or imported geometry.

Four original tetrahedral normal samples are now four independent invocations and store 4 floats/pixel. A separate macro-visibility compute stage gathers the same normal, and a pruned fragment stage only evaluates the existing material/PBR. Two fixed 4096-byte tile buffers are added. The final opaque hit already comes from the existing straight-glass trace; no duplicate glass geometry or new reflection model is introduced.

Macro AABB distances are valid step bounds only. They no longer attenuate the soft-shadow value. Only actual macro surfaces may do that; a 64-step visibility exhaustion is explicit, counted and drawn magenta rather than silently reported as light. The shadow remains a macro-shape approximation, not a full microgeometry/global-illumination claim. The 32×32 smoke must complete with zero main/visibility unresolved rays before the expensive full sections are attempted.
