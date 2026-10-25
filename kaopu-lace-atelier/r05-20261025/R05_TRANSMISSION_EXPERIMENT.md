# R05 experiment: backlit thread transmission approximation

Date: 2026-10-25

## Hypothesis
A thin lace thread should not behave as an entirely opaque, uniformly shaded plastic rod when a light sits behind the specimen. A restrained directional backlight contribution may improve the appearance of pale cotton/linen threads under backlight while leaving front-lit appearance mostly unchanged.

## Implementation
- Adds a shared `laceTransmission` control and per-layer transmission factor to the existing yarn shader.
- Uses current directional-light directions and colors; only light directions behind the view-facing yarn normal contribute.
- Adds a restrained, view/light-dependent backscatter term to the direct diffuse contribution rather than the emissive channel. This reduces the risk of a self-lit/glowing appearance. It does not trace light through fibers, model multiple scattering, or implement the ray-wave diffraction model from the research literature.
- Adds a bounded UI control from 0 to 0.4, saves/restores the value in R05 recipes, and defaults to 0.12.
- Adds an independent native EGL A/B: identical geometry, camera, lights and sample budget; transmission 0 vs 0.18. Records image differences, but does not treat them as a realism score.
- No extra geometry or vertex attributes. The shader performs additional work per directional light; actual GPU cost still requires device profiling.

## Evidence basis and boundary
Cornell/NVIDIA's 2025 ray-wave hybrid model describes reflection and transmission through twisted plies, with aperture diffraction and view/light-dependent variation. This R05 term is intentionally much simpler; the research motivates the target phenomenon, not the physical correctness of this approximation:
- https://research.nvidia.com/labs/rtr/publication/yu2025realistic/
- https://news.cornell.edu/stories/2026/01/new-technique-puts-rendered-fabric-best-light

## Acceptance questions
1. Does the backlight version reveal thread thickness and soften the hard-rod appearance?
2. Does it preserve front-lit color and avoid a self-emissive/glowing look?
3. Does it behave plausibly on dark and light backdrops, on both faces, and under grazing light?
4. Is the shader cost acceptable on the target GPU?

Reject or reduce the effect if it looks like glow, changes ordinary front-lit appearance too much, or creates a bright outline unrelated to thread thickness. Native EGL output is not browser/WebGL acceptance.


## R05.1 correction
The initial diagnostic showed a large image delta under the backlight rig, which is useful for proving the control is active but not sufficient to establish realism. The transmission term was therefore moved out of the emissive channel into direct diffuse lighting, and its response now includes the angle between the viewing direction and the light direction. This is a more restrained approximation; the high-sample A/B must be regenerated and visually reviewed before acceptance.


## R05.2 calibration
The first direct-diffuse A/B was nearly imperceptible under the fixed backlight rig (macro mean absolute RGB difference 0.43/255). The gain was raised from 0.06 to 0.24 while retaining the same 0–0.4 user control and view/light angular gating. This is a fourfold gain change, not evidence of a fourfold perceptual improvement; the regenerated fixed-camera A/B must determine whether the effect becomes legible without looking like glow.
