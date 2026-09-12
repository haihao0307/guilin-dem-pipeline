# Current Best View — Gaussian sorting precision R39 candidate

1. Three.js r186 uses a fixed 4096-bin counting sort. Its depth precision is the current bounding-sphere depth range divided by 4095, not a constant metric guarantee.
2. Different depths can occupy one bin. GPU same-bin order is unspecified; the actual WebGL CPU fallback preserves source index order, which can disagree with exact back-to-front order.
3. `SORT_DIRECTION_THRESHOLD=0.9995` suppresses resort below about `1.811927°`. The executed two-splat fixture inverted exact order after `1°` while retaining the old order; `2°` triggered resort.
4. The synthetic two-layer maximum RGB difference `0.25` demonstrates that order can matter. It is not a measured viewer pixel error or a production threshold.
5. A future real-photo pilot must record the sort policy, scan fixed-camera bin collisions, sweep camera motion in sub-threshold steps, compare actual GPU images and measure target-device cost. Exact-sort or higher-frequency alternatives remain unpromoted until that trade-off is measured.
6. Sorting is a renderer-local presentation policy. Source photos, pose solution, float PLY and cleanup history remain separate truth-bearing checkpoints; R34-R38 gates, Frozen R1 and production Mothers remain unchanged.

