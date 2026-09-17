# Current Best View — N14 integer cell/hash portability

Status: **Candidate partial**

The safe large-coordinate split from N13 requires a versioned cell-identity ABI, not merely an integer-valued variable. The current candidate ABI is: signed `i32` cell coordinates reinterpreted bit-for-bit as `u32`; ordered `(x,y)` axes; modulo-`2^32` unsigned mixing; logical right shifts; and shift counts restricted to `0..31`.

CPU and WebGL2/GLSL ES on Chrome 152 SwiftShader match the 12 locked vectors exactly. The primary WGSL specification supports the required bit representation and modulo arithmetic, but WGSL runtime remains **Unknown** because the CI runner could not initialize WebGPU. A source contract is not a runtime pass.

This fixture verifies semantic agreement only. It does not establish collision resistance, distribution quality, mobile performance, production suitability, Mother adoption or user acceptance. Numeric `u32` identity and serialized byte order must remain separate contracts.

Canonical Truth, Frozen R1 and production branches are unchanged.
