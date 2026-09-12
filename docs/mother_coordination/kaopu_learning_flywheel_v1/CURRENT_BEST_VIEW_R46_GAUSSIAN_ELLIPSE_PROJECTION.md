# Current Best View — Gaussian ellipse projection R46 candidate

1. Three.js r186 projects the 3D covariance with its perspective Jacobian, adds `0.3` to both 2D diagonal terms, floors the eigen-radius expression at `1e-7`, and caps each shader scale at `1024 px`. The quad/fragment cutoff draws to twice that scale.
2. In one million deterministic off-axis stress cases after fixed SPZ scale/rotation quantization, observed maxima were `17.8401%` projected-covariance spectral error, `8.4801%` raw major-scale error, `27.5374%` raw minor-scale error and `40.6212°` principal-axis error among samples with both anisotropy ratios at least 1.1 and no cap. These are fixture observations, not universal bounds.
3. A cap counterexample changed the raw major scale from `1499.687` to `1453.619 px` but displayed both as `1024 px`. Equal displayed scale can hide substantial covariance loss.
4. A tiny base scale of `0.003419 px` became about `0.548022 px` after the screen kernel. Near the kernel floor, displayed footprint mostly describes viewer policy rather than source covariance.
5. Because `sqrt(1e-7)=0.000316228 > 0.00001`, the source's conditional angle fallback is unreachable for finite values. Exact circular-axis backend behavior remains Unknown; angle is not a reliable acceptance metric near isotropy.
6. Every real asset must report raw and displayed axes, cap/kernel flags and covariance error before composited-pixel, GPU/device and human acceptance.
7. Canonical Truth, Frozen R1 and production Mothers remain unchanged.
