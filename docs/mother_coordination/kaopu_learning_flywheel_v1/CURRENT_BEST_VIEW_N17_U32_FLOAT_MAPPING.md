# Current Best View — N17 u32-to-float mapping

Status: **Candidate partial**

A versioned integer hash does not fully specify a procedural-noise source. The mapping to float must also declare interval, retained bits, precision, endpoint policy and formula.

The fixed Brick V2.6 transfer source uses `hash / 0xffffffff` in JavaScript, so it is closed `[0,1]` and can return exactly `1.0`. A direct float32 port is not equivalent: the C++ path maps 128 top states to `1.0`, and tested GLSL ES diverged from C++/WGSL at `0xffffff7f`.

For a strict `[0,1)` shader candidate, `float(h >> 8) * 2^-24` gives `2^24` exactly representable values and a maximum of `1 - 2^-24`. It matched raw bits across tested C++, GLSL ES and native WGSL software paths. Mantissa construction also matched, gives `2^23` values, and remains an alternative rather than a universal replacement.

Changing this mapping changes all downstream values and therefore requires an ABI version plus visual/device acceptance. It does not alter Canonical Cell identity, Canonical Truth, Frozen R1 or production Mothers.
