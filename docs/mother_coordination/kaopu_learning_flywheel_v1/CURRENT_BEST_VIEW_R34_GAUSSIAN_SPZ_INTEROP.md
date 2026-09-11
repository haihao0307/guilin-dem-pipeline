# Current Best View — Gaussian SPZ interoperability R34 candidate

1. R33's constrained delivery profile remains the candidate baseline: SPZ v4, default RUB, no coordinate extension, SH degree at most 3, with the uncompressed float reconstruction checkpoint retained separately.
2. R34 upgrades only CPU interoperability evidence. A real pinned Niantic SPZ v4 encoder/unpacker and the real Three.js r186 loader agreed on two synthetic splats' quantized positions, covariance implied by `xyzw` rotation plus log-scale, and every packed SH1–SH3 byte.
3. A successful `SPZLoader.parse()` is not an integrity check. The pinned r186 loader accepted both a file missing its final byte and a file with one trailing byte. A separate fail-closed envelope gate must prove header/declaration agreement, TOC bounds, per-stream uncompressed sizes and exact compressed-stream coverage before awaiting decode.
4. Pre-pack validation is a separate gate. The pinned Niantic encoder accepted position `2048` at 12 fractional bits and the decoded value wrapped to `-2048`; log-scales `-11` and `6` saturated to `-10` and `5.9375`. Post-pack validation cannot recover the lost source intent.
5. Therefore the candidate flow is: validate float source ranges/types and metric anchor -> encode -> hash -> validate v4 envelope/declaration -> await actual decode -> compare semantic attributes against the retained float checkpoint -> only then render/test.
6. These results do not validate COLMAP poses, Brush training, photo quality, cleanup, GPU sorting, runtime cost, Safari/iPhone behavior or human acceptance. RealityScan is not replaced; splats are not complete Object DNA or Canonical Truth.
7. Frozen R1 and production Mothers remain unchanged.
