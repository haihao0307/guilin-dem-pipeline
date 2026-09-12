# Current Best View — Gaussian quaternion quantization R43 candidate

1. SPZ v3/v4 normalizes each rotation, records the largest quaternion-component index, and quantizes the other three signed magnitudes to 9 bits over [0, 1/sqrt(2)].
2. The component half-step is 0.0006918853. For finite normalized inputs, a conservative real-arithmetic rotation-error bound is 0.275221 degrees.
3. A source-faithful C++ probe over 1,000,000 deterministic uniform rotations observed 0.247711 degrees maximum and 0.086105 degrees RMS; -O0 and -O2 results were byte-identical.
4. Rotation-only covariance perturbation is conservatively bounded by 0.960703% of the largest covariance eigenvalue. Fixture error grows with anisotropy; isotropic covariance is nearly invariant apart from float residual.
5. These are codec parameter controls, not pixel or human-acceptance limits. Real float-checkpoint-to-decoded covariance and fixed-view image comparisons remain mandatory.
6. Canonical Truth, Frozen R1 and production Mothers remain unchanged.
