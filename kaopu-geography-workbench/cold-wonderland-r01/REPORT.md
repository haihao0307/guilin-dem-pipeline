# Cold Wonderland / 冷酷仙境 · G18

Source: [view -cold- by @YoheiNishitsuji](https://fragcoord.xyz/s/vtpszmnz), MIT, updated 2026-11-07. Original GLSL common+main 1619 UTF-8 bytes; retrieved markdown 2183 bytes. No external textures, meshes, audio or original iframe required. Copyright and MIT permission retained in NOTICE.txt.

Preserved mechanics: height-normalized ray, 50 outer steps, after-step-35 reversal, HSV accumulation, logarithmic radial coordinate, latitude/angular remapping, 8 doubling turbulence scales from 1 to 128, original time factor 0.5. Adaptations: own host time/resolution uniform names and explicit zero initialization of original undefined local variables. This is a licensed independent workbench adaptation, not an unmodified original or claimed bit-exact match across drivers.

Validation: headless EGL llvmpipe actual compile/link/draw/readback at 384×216; t=0 and t=3 yield 17224/19589 distinct RGBA colors and different frame hashes. Actual t=3 frame generates preview, not an invented thumbnail. Mock-DOM host integration verifies scene selection, render-call route, pause, seek, back to catalog; all ten previous case IDs and control IDs retained. No browser, user's device or hardware GPU test performed. No FPS guarantee.

Original seven terrain shaders and old study modules unchanged; old index and runtime preserved. G18 only adds this case, a white catalog/control shell, compact top catalog and existing brand icon with Geographer Mother. Live scene shader colors are not overridden by white shell. Existing renderer is WebGL2, not claimed WebGPU. New study uses no texture download.

Cleanup: no files deleted. Original reference is only 2183 bytes and remains recoverable evidence outside the published runtime; hardware/reference visual comparison is not complete, so premature destruction is not justified. Saved R17 page remains directly accessible.
