# Native R02 station lettering restoration

## Files and source preservation

- `native-station-lettering-source.mjs`: only the 20 necessary licensed serif glyph programs. Every source `m/l/q/c/z` command, coordinate, advance, solid count and counter count is retained. Shared `O/L/N` commands are identical in the two frozen sources and are stored once.
- `native-station-lettering.mjs`: native Bézier evaluation, metric layout, finite extrusion/cutter queries, proper face frames and generated WGSL.
- `station-lettering-source-r02.json`: frozen source file hashes, per-glyph command hashes and counts, source layout, explicit construction changes and licenses.
- `sources/station-labels-LICENSE.txt` is the unchanged original notice. `sources/glyphs-LICENSE.txt` was recovered from the same frozen GitHub commit because the local restored tree omitted it. Original source families are attribution, not a new font product name; this subset is **R04 Station Native Letter Curves**.

Frozen repository commit: `f31df978916876205355664593b0299f027188ad`.
No font binary, bitmap, imported polygon/mesh, remote font service or renderer dependency is used. The native control curves are evaluated directly. Runtime short chord distances are a bounded numerical query method, not flattened source geometry, and are not retained as a polygon asset.

## Actual R02 layout

`station-build.mjs`, rather than the board metadata's shorthand, determines the visible lines:

- `PLATFORM`: visible height 0.120 m; baseline 0.075 m above board center; width 0.9024678663 m.
- `No. 1` through `No. 4`: visible height 0.170 m; baseline 0.160 m below board center; widths 0.5350130208, 0.5561836999, 0.5546442432 and 0.5641612484 m.
- Hall: `九龍  KOWLOON` with two spaces, visible height 0.470 m, width 4.0535 m, source extrusion 0.020 m.

The source centers the visible ink bounds, uses the original glyph advances, and puts the lower visible bound at the requested baseline. The new version follows that rule using analytic curve extrema. R02 instead obtained bounds from sampled Float32 display geometry. This is an explicit numerical correction, not substitution of another font. No tracking/width stretch was added. An independent reconstruction of the R02 8-segment samples (12 for O), Float32 bounds and original layout differs in width by at most 0.133 μm across the six templates.

Both sign sides use proper right-handed frames. Source +Z side becomes station +X, viewer-right −Z. Source −Z side becomes station −X, viewer-right +Z. The hall's actual new −X portico face uses viewer-right +Z. No negative scale or mirror is used.

## CPU API

`stationPlatformLettering({origin, deck, signHeight, row})` returns four words. `origin` is the caller's relocated column/lamp attachment in station-local coordinates; there is no global-grid reconstruction. `row` is 0–3. The source physical board remains 1.12 × 0.52 × 0.045 m.

Platform letters begin on the actual ±22.5 mm board faces, protrude 4.5 mm, and bury their roots 0.5 mm. R02 used zero-depth planes at ±27 mm. This finite relief restores the visible line position while removing floating planes. The exact contours provide the front cap, side walls and counter holes.

`stationHallLettering({anchor, ...options})` requires `terminalHallMembers(...).anchors[0]`, including its exact text, `at`, height and −X normal. It does not guess or overwrite the hall placement.

Important open physical detail: the source hall title anchor is 40 mm outward of the entablature's 0.73 m face offset. A literal 20 mm source extrusion floats. The module preserves the exact supplied anchor and exposes `embed`; it does not conceal the gap. The host must either approve a concealed mounting/backing treatment, explicitly move the anchor to the actual facade, or declare a deeper buried root. Default 0.5 mm embed alone does not close that inherited gap. A 40.5 mm buried root closes the horizontal gap only where a source course actually exists; the title spans course spacings, so that option is not a verified whole-title mount. Probe support at the actual glyph roots, and supply a separately identified plain backing if required. Keep the title's source and any construction correction separately identifiable.

`createStationLetteringWord(text, {origin,right,up,normal,height,depth,embed,mode,id,seed})` supports `raised` and `engraved`. Engraved mode describes a finite native-letter cutter with z range [−depth,+embed]. Apply it with a host CSG difference; never queue the cutter as positive ink. The host owns cut-face material. Raised mode uses [−embed,+depth]. Default material binding is existing paint ID 7 / seed 188, not a new material mother. This is explicit current ivory binding; the R02 hall used `clock-ink`.

`stationLetteringSample(word,p)` returns either:

- `valid: true`, signed native-shape estimate `d`, error interval, safe boundary `stepDistance`, glyph-local `q`, material ID/seed and mode.
- `valid: false`, `d: Infinity`, a nonnegative conservative scheduler `lowerBound`, zero work and no material ID.

A conservative bound is never a face or a candidate. Do not turn a `valid:false` result into a normal, shadow hit or `HitField`.

## WGSL API and scheduler contract

`stationLetteringWGSL({deck,signHeight,hallDepth,hallEmbed,...options})` returns standalone helper functions and six templates:

- `stationLetteringPlatform(p, lampOrigin, row:u32, side:i32, line:u32)`; side is −1 or +1, line 0 is PLATFORM and line 1 is the numbered line.
- `stationLetteringHall(p, exactAnchor)`.
- `stationLetteringTemplate(q, index:u32)`; 0=PLATFORM, 1–4=No. row, 5=hall. `q` axes are viewer-right, up, outward and its y=0 is the ink baseline.

`StationLetteringHit` has `valid`, `d`, `error`, `lowerBound`, `stepDistance`, `q`, `id`, `seed`, and `mode` (0 raised, 1 cutter). A miss has `valid=0`, sentinel distance 100000 and ID 0. Only `valid=1` raised results may be mapped into the common material-bearing candidate queue. Keep the returned signed estimate for the actual surface, rather than replacing it with `lowerBound` or `abs(d)-error`.

The host must use misses' `lowerBound` only to schedule/traverse toward the small word box. Merely dropping all misses without any traversal reservation can leap over protruding letters. The native query begins only inside 60 mm of the finite word AABB; word/glyph/curve bounds thereafter only prune impossible winners. Sign instances must follow the relocated lamp origin and physical board. Integrate the same word functions into the common recipe consumed by beauty, normal, depth, shadow and reflected queries; do not add a camera-only overlay.

Default generated source is about 210 kB. It uses only finite native control arrays and bounded loops. Shader compile time and the added near-letter query cost have not been measured on GPU. The CPU tests and identifier gate do not establish compiler/backend compatibility.

## Error and budget contract

1. Every native Bézier is split exactly in real arithmetic at its y-derivative roots using de Casteljau. This preserves the curve and yields monotone-y arcs for nonzero winding.
2. Winding solves crossings on those curves with half-open y endpoint rules. Lines have direct crossings in WGSL; curves use 28 bounded bisections. Crossing-position uncertainty is bounded by the first-derivative norm times 2^-28. Twice that uncertainty is included in the signed-distance error allowance.
3. Distance queries evaluate the original Bézier at uniform parameter intervals. For second-derivative bound M, the curve/chord Hausdorff error is at most M/(8 N²). N is chosen per arc for at most 20 μm default metric error. Straight native lines are exact.
4. The control hull bounds only prune distance work. They never provide a renderable signed distance. Glyph contours, including every counter, determine the real candidate distance.
5. The unsigned distance error carries through sign away from the crossing uncertainty band and through the standard finite-extrusion distance composition. CPU samples report the explicit error interval and ambiguity flag.
6. Construction rejects rather than silently degrades an unsupported request. Tolerance must be 1–100 μm; at most 128 distance steps/arc, 256 arcs/glyph, 8192 distance steps/glyph and 16 text code points are allowed. Height is at most 1 m; depth and embed at most 0.1 m. Query margin is 0.01–0.25 m; default 0.06 m. Placement origins are restricted to ±256 m in station-local space.
7. CPU geometry tests use the analytical bound plus double-precision slack. WGSL additionally reports a deliberately conservative design allowance of 64 float32 unit roundoffs times max(1 m, word width, word height), plus four float32 unit roundoffs at a 256 m coordinate magnitude. This extra allowance is not a completed hardware error proof. Default total WGSL allowances are about 0.150 mm for boards and 0.173 mm for the hall.

Default maximum distance evaluation counts before culling are 778 (PLATFORM), 367/566/706/367 (No. 1/2/3/4), and 2968 (hall). The largest arc uses 73 steps, below the 128-step cap. Winding has its own separate maximum of 28 bisections per curved arc; the hall has 268 total native monotone arcs across nine visible glyph instances.

## Verification and remaining gates

CPU tests verify exact source command hashes and counts, quadratic/cubic evaluation, curve splitting/extrema, independent dense distance comparisons, independent winding grids for Latin/Chinese shapes, all listed counter holes, ink probes, source layout, both sign faces, finite caps/sides/root attachment, engraved cutter behavior, hall-anchor handedness, failed-budget rejection and WGSL lexical identifiers.

No GPU, browser or publication was run. Native curve correctness and geometry tolerance do **not** establish pixel antialiasing, small-text readability, pixel footprint filtering, GPU float behavior, camera crops or acceptable runtime cost. Those remain explicit later gates. No active station field, matter or score file was changed by this lettering task.
