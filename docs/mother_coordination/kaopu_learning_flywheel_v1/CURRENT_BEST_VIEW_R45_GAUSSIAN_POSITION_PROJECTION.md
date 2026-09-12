# Current Best View — Gaussian position projection R45 candidate

1. Default SPZ v4 positions use signed 24-bit fixed point with 12 fractional bits: grid step `1/4096`, component half-step `1/8192 = 0.0001220703125` storage units.
2. Three.js r186 turns that absolute position error into screen displacement through the current model-view matrix, projection focal length and inverse depth. There is no camera-independent pixel tolerance.
3. In the fixed 390x844, 60-degree vertical-FOV identity-view fixture, near-half-step x/y errors caused diagonal center displacements of `12.60465`, `1.260465`, `0.126170` and `0.012617` pixels at depths about `0.01`, `0.1`, `1` and `10` storage units.
4. A source center at z=`-0.00999` is rejected by r186's hard z cutoff; SPZ decoding moves it to `-0.010009765625`, which passes that particular cutoff. Small parameter error cannot bound visibility changes without a boundary-margin condition.
5. Delivery recentering/rescaling may improve fixed-point precision only as a reversible recorded transform. Its feasible range is jointly constrained by signed position range, R44 log-scale range, camera depth and canonical metric anchors.
6. R45 covers center projection only. Projected covariance/ellipse axes, compositing, GPU/device behavior and human acceptance remain separate.
7. Canonical Truth, Frozen R1 and production Mothers remain unchanged.
