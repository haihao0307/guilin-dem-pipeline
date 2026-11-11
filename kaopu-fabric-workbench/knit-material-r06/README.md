# KNIT-MATERIAL-R06 — direct parametric yarn solver candidate

R06 adds a direct camera-ray / swept-yarn intersection path beside the accepted R04 field marcher. It uses the existing P02 centreline, the same editable yarn-radius/material functions, the same fibre count, the same 8-segment fibre curves, the same two samples per pixel and the same resolution. The R04 marcher remains the fallback for grazing rays, misses and Newton non-convergence. No triangle mesh is introduced.

The purpose is to replace up to 128 repeated field evaluations per ray with one spatial-bin candidate query and a bounded Newton solve. For a successful direct hit, the short-fuzz band is sampled six times around the hit; surface shading and the original 8-step soft shadow remain unchanged. A/B comparison alternates R04 and R06 on the same browser, camera, material and resolution. It reports completed frame time, GPU timestamp time, direct-hit share, and the pixel difference.

Acceptance target is strict: at the same 640×480 resolution and unchanged material/fibre parameters, at least 80% lower GPU time than R04, and no more than 16.67 ms completed frame time. The GPU-time target is computed from the same-session R04 baseline. A software adapter result is not a hardware result. Pixel delta and direct/fallback ratio must be inspected before promotion.

Current source uses the accepted R04 material host and P02 curve source. The page is an isolated candidate; it does not overwrite R04. Visual acceptance and the 80% performance gate remain false until actual browser evidence proves them.
