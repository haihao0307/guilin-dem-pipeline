# Rabbit compact studio scope

Current rabbit work copy is the default full-screen view. The teacher renderer is shown only when the user opens the teacher dialog; its source model and material remain the SEDDI baseline. The existing grooming, shape, Perlin, render-layer, light, import/export and source-reset controls are preserved.

The new `rabbit-frame.js` is a derived outer adapter. It changes pointer gesture bookkeeping, hidden-preset readiness, canvas backing resolution and render color/depth buffer resolution. Device-pixel-ratio rendering is hardware-limit bounded. The comb cursor is scaled consistently with the backing resolution. Original `src/frame.js`, `src/host.js`, all 78 teacher archive files, all 20 module source strings and all model/texture bytes remain unchanged. This is not a new rabbit asset or fur material.

Full-screen viewport changes invalidate the old layout-specific rabbit pixel hash. The QA now compares teacher and candidate at a matching canonical 600×600 DPR1 viewport, then checks actual layout and native Chromium input. The physical iPhone and Safari remain outside automated coverage.

No anemone color/motion changes are included in this UI increment. The requested evidence-based anemone adjustments are a separate next increment.
