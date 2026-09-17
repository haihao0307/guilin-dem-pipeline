# Current Best View N06 — multiscale amplitude and LOD

Status: **Candidate partial / pinned-source CPU verified**

- FastNoiseLite fractal bounding limits a worst-case amplitude sum. It does not guarantee zero mean, an unchanged distribution after clipping, alias-free resampling or LOD-stable silhouettes.
- Record distribution and silhouette metrics before and after any height clamp. In the fixed probe, clipping changed fBm mean and energy and removed 62.87% of ridged samples; the clamp was a shape operator, not a neutral safety step.
- For a target sampling interval, omit octaves whose nominal frequency exceeds Nyquist. Retain the original normalized octave weights; renormalizing the surviving low bands pumps macro-scale amplitude as LOD changes.
- A nonlinear transform such as ridged noise has nonzero octave mean. Removing high bands therefore needs an explicit mean policy; zeroing them without compensation shifts the field.
- Filtering is metric-specific. At 4 m, filtered fBm improved the row-maximum silhouette but not field RMSE; at 8 m it improved both. One metric or one spacing cannot establish a universal rule.
- Eight versus seventeen octaves is an error/cost choice, not a quality doctrine. Here the extra nine octaves cost about 1.97× for an RMS change below 0.0023, on one CPU only.
- The nominal Nyquist cutoff is conservative because the noise kernel is not proven strictly band-limited. Target geometry, material, normals, collision and visual acceptance remain separate.

Landscape/Farmland still have no acknowledgment of the earlier N02 publication, so routing is not repeated. Brick PR15/PR17 and Tiles PR11 remain verified possible entries only; no delivery or adoption is claimed.

Canonical Truth, Frozen R1 and production Mother branches remain unchanged.
