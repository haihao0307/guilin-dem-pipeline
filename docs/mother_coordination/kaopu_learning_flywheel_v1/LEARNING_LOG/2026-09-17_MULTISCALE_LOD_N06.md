# N06 — multiscale amplitude, clamp and LOD filtering

## Bounded question

N02-3 asks how fBm/ridged amplitude and frequency schedules preserve desired shape as sampling becomes coarser. This round fixes one implementation and tests amplitude bounds, pre/post-clamp distribution, octave cutoff, low-band weight policy and a narrow silhouette metric. It does not advance psrdnoise, erosion or a production asset.

## Fixed source and method

- Official implementation: [Auburn/FastNoiseLite](https://github.com/Auburn/FastNoiseLite/tree/785f37a9ad76e283586a379675085f2063ae03f7), revision `785f37a…03f7`, MIT.
- Header raw-byte SHA-256 `47a29750…5dc2`, declared version 1.1.1.
- Perlin base, seed 98765, base frequency 1/32 m, lacunarity 2, gain 0.5, weighted strength 0, eight octaves.
- A 64 m square was sampled at 0.125 m. Coarser 0.5/1/2/4/8 m cells were compared against fine-cell area averages.
- Four coarse strategies were measured: unfiltered point sample; nominal-Nyquist octave cutoff with original weights; cutoff with retained weights renormalized; and cutoff plus a sampled removed-band mean.
- “Silhouette” is a deliberately narrow row-maximum height metric, not camera-space rendered acceptance. Timings are one-host CPU observations only.

Probe: [`multiscale_lod_probe_n06.cpp`](../PROBES/multiscale_lod_probe_n06.cpp)  
Result: [`multiscale_lod_result_n06.json`](../PROBES/multiscale_lod_result_n06.json)  
Source receipt: [`SOURCE_LOCK.json`](../references/multiscale-lod-n06/SOURCE_LOCK.json)

## Observation

All 15 predeclared CPU checks passed after preserving one failed premise as a counterexample. A second local run matched every non-timing field.

- Manual octave composition matched the pinned built-in fBm and ridged paths with RMS errors `5.2e-8` and `1.21e-7`. This verifies that the probe's octave weights and transforms represent the selected source path.
- The fixed fBm sample was not exactly zero-mean (`0.02553` after the 2.5 m height scale). Fractal bounding therefore cannot be promoted into a zero-mean claim.
- A ±1 m clamp changed fBm mean from `0.02553` to `0.02868` and mean square from `0.23842` to `0.23162`; 3.18% of samples clipped.
- Ridged output had mean `1.18278` before clamp. The same clamp clipped 62.87%, moving mean to `0.84340` and mean square from `1.71954` to `0.78966`. This is a dominant shape change.
- At 8 m, fBm cutoff plus mean policy improved field RMSE from `0.02794` to `0.02616` and row-maximum silhouette RMSE from `0.03534` to `0.02562`. Renormalizing retained weights was much worse (`0.07409` field RMSE).
- At 4 m, the same fBm filtering improved silhouette RMSE (`0.01882` to `0.01377`) but not field RMSE (`0.01376` to `0.01548`). This rejected the initial blanket assertion that filtering must improve both metrics at every coarse spacing.
- Ridged cutoff without mean compensation shifted the field badly. At 8 m, adding the measured removed-band mean reduced field RMSE from `0.13969` to `0.04663` and silhouette RMSE from `0.10719` to `0.05177`.
- Seventeen versus eight octaves cost about 1.97× for this one CPU loop. Their RMS delta was `0.000760` for fBm and `0.002202` for ridged; this does not establish a universal optimum.

FastNoiseLite's bounding calculation is the reciprocal of the absolute-gain sum. It constrains an amplitude budget; it does not specify sample mean, probability distribution, exact spectral support or target LOD policy. Its constructor default is three octaves, not seventeen.

## Candidate / Current Best View

1. Bind every multiscale field to coordinate units, base frequency, octave count, lacunarity, gain, transform and normalization policy. “Same seed” is insufficient if those differ.
2. At each target LOD, remove octaves above the target sample Nyquist frequency as a conservative first gate. Preserve the original normalized weights instead of inflating surviving low frequencies.
3. For nonlinear octave transforms, record each octave's mean or define an equivalent DC policy. Removing nonzero-mean bands without compensation causes LOD-dependent bias.
4. Record pre/post-clamp mean, variance/energy, clipped fraction and silhouette metric. A clamp may become the dominant authoring operator.
5. Evaluate field and silhouette separately; add normal, collision and rendered target checks before Mother adoption. The fixed probe shows neither metric subsumes the other.
6. Choose octave count from target sampling, perceptual error and measured runtime. Layer count is not a quality badge.

Status: **Candidate partial / pinned-source CPU verified**. N02-3 is complete only at source and CPU-method level.

## Rejected

- “Fractal bounding guarantees zero mean or a fixed output distribution.”
- “More octaves always improve the target, so seventeen layers are mandatory.”
- “Clamping is a neutral safety measure.”
- “Renormalizing every LOD's retained octave weights preserves the same macro shape.”
- “Nyquist cutoff must improve every metric at every spacing.”
- “CPU results establish browser, mobile or GPU cost.”
- “fBm or ridged noise is a physical erosion process.”

## Unknown / routing state

- The nominal cutoff assumes octave center frequency but does not prove the source kernel strictly band-limited. GPU texture filtering, derivatives and screen-space behavior remain Unknown.
- Landscape PR79 and Farmland PR65 still have no feedback after the existing N02 publication; no message was repeated.
- Brick material PR15, Brick shape PR17 and Tiles/building PR11 remain verified entries only. Routing is prepared but not delivered; no adoption is claimed.
- Mother runtime, geometry collision, public delivery, target devices and user visual acceptance remain Unknown.
- Canonical Truth, Frozen R1 and all production branches remain unchanged.

## Next learning gap

Advance N02-4 independently: lock the official psrdnoise implementation and verify actual period restrictions, derivatives, wrapping and time/phase behavior. A flow-like image must not be called material advection without state transport.

First-tier expert AI was not called; routine expert discussion remains owned by the separate night expert task.
