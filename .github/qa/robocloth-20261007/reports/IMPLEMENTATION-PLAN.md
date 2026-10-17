# Native-quality browser implementation plan

## Source and licenses
Official code is Apache-2.0. Official RoboCloth weights and cloth-on-bar assets are described as CC BY 4.0; attribution must travel with the app. The teaser-room third-party meshes are excluded because their original terms remain applicable.

## Native data and transport
The official float32 latent field alone is 736 MiB. The complete inference state is 736.90 MiB; the checkpoint is 1110.74 MiB. No training optimizer or ground-truth emitter state is needed for forward inference.

Every tensor is an uncompressed ZIP storage entry. A small audited manifest can describe exact byte ranges in the commit-pinned official checkpoint URL. HTTP range/CORS headers have been tested from the intended Pages origin; a true browser request is still required. There is no runtime unpickler. A 4–16 MiB download/upload chunk budget prevents retaining another whole field in JavaScript heap. Tensor SHA256 is verified incrementally or by per-channel hashes. GPU data are r32float; no half conversion or latent downsample is permitted under the native option.

## GPU inference
Per neural evaluation: 18,432 + 65,536 + 83,968 + 65,536 + 768 = 234,240 decoder MACs, plus 752 geometry MACs, 46-channel bilinear queries and SH/frame math. At 256² full coverage this is about 15.4 billion MACs per single-light sample; at 512² it is about 61.6 billion MACs. A 512², 30 Hz, single-light view would require roughly 3.7 TFLOP/s of decoder arithmetic before all overhead, so mobile and software implementations cannot be assumed interactive.

Use tiled pixel batches with separate dense-layer dispatches rather than a 256-register monolithic fragment shader. Keep the untouched 72-input skip buffer, 256-wide ping-pong activations, original latent texture and small weights. Tile memory is bounded by the default maxStorageBufferBindingSize. Original material stays native 2048² while viewport resolves progressively and always discloses its sampling resolution.

## Rendering boundary
First numerical harness runs supplied wi/wo/uv samples, independent of rasterization. Then original geometry/camera in a live browser preview. Direct-light interaction can preserve exact measured neural BRDF while the reference panel remains the published multi-bounce Mitsuba result; it must not claim identical global illumination. Full original environment integration requires a separate convergence gate, not an arbitrary PBR environment approximation.

## UI
One independent RoboCloth material bench under the existing tailor workbench, preserving the existing overview/anchors. Present native model loading budget before download; explicit start/cancel/retry; real progress; material identity and original frame/geometry controls; camera orbit; light orbit; UV-repeat setting; exact reset; no inherited unrelated noise/material sliders. Include a clearly labeled original 2048²/512spp reference, attribution, model provenance and tested limitations.

## Verification
- Non-executing checkpoint parse and fail-closed hashes
- Torch original vs exported scalar JS and GPU deterministic sample tests
- Border/modulo, backface, tangent orthogonalization, Softplus threshold, skip-concatenation tests
- Browser full load/cancel/retry/second material switch, device loss and WebGPU unsupported paths
- Pixel comparison for matched integration plus separate interaction screenshots
- All uploads limited to approved QA/workbench paths using fresh base tree and compare-and-swap
