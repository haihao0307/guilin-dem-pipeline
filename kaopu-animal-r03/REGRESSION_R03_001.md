# R03 internal visual review / 2026-09-29

Baseline 66c9c5d was machine-runnable but NOT delivered as visual acceptance.

Observed defects from actual Chromium screenshots: a 600x600 inline canvas did not fill its world viewport; tortoise scales multiplied their base skin color twice and appeared falsely black; polar bear pinnae/nose proportions needed convergence; the eagle head needed the reference-directed orientation and broader tail.

K3.0.1 corrects these in source. The anatomy surface generator is isolated in anatomy.js and the versioned public instrument applies morphology/material finishing before output is measured. This is part of deterministic generation, not a post-render image filter. The standalone instrument has the same finishing code as the workbench.

Added gates: canvas CSS dimensions match host within 2px; all three actual score files import into a fresh empty player and export unchanged; explicit current version check. Machine output replay remains required.

- [x] No image generation substitutes for 3D.
- [x] Production source modified.
- [x] Interactive Three.js output retained.
- [ ] Fixed public URL and real browser checks require new exact-head proof.
- [x] Screenshots alone do not constitute delivery.

Hidden views, metric scale, species-specific scutes and full biological motion remain unverified. Visual acceptance remains with the user.
