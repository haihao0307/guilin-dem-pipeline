# R03 bounded failure review

Initial compile failure was WGSL multiplication/XOR grouping, fixed without changing intended hash. Second run 42775008619 compiled and rendered all routes, completed six-round timing and five policy probes, then lost the software WebGPU device during the 640x448 near frame. The reported external-instance error does not itself prove an exact driver root cause; the failure is consistent with an excessively long software command. It must not be hidden as a successful runtime validation.

Bounded correction: subdivide software-adapter render submissions into eight-row stripes, freeze all camera/material uniforms at frame start, retain all pixels, both AA samples, 128 maximum march steps, geometry, noise and shadows. Timestamp sums include every stripe; completion wall time includes extra submission waits. Hardware path remains the unchanged single submission. No browser safeguard is disabled and no CPU fallback is selected. New actual-browser evidence must pass before publication.

The completed 160x112 portion of the failed run is historical measurement only. It showed no material speedup, while policy selection itself was small compared with rendering. Full source fuzz/geometry equivalence is not claimed.
