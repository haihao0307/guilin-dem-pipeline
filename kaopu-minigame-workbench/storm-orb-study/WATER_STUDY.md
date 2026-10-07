# Curved river on one sloping plane

Uses the official Three.js r170 Water2, Reflector and Refractor modules, MIT license retained in vendor/THREE-LICENSE.txt. Original hashes/URLs and small deterministic-time modifications are in vendor/SOURCES.json. Shared core Three.js remains the original train vendor dependency; no duplicate renderer/runtime.

The centreline bends in x/z, while water level is linear in z. The ribbon is built in a local XY plane, then rigidly rotated by -pi/2+atan(.032/1.04) and placed at y=-.0136. It is a direct scene child, so nonuniform terrain scale cannot corrupt the clipping normal. Its world normal is normalize(0,1,.032/1.04), shared with shader Fresnel and the official planar capture cameras. Numerical plane residual and normal error are recorded.

UVs use cross-stream distance and accumulated three-dimensional centreline arc length. Generated periodic normal maps move downstream at0.35world units/s. A deterministic dual half-cycle blend avoids resets; pause/scrub retains exact state. Water F0 is0.0204, with untinted reflection and shallow/deep absorption in refraction; bank-edge alpha follows actual depth. River depth is checked against the actual terrain.

Reflection and refraction targets are both1024². Both extra render passes are measured separately from cached captures at a fixed camera, with draw calls/triangles and RAF timing. These cloud CI measurements are not phone GPU results. Paused unchanged frames reuse captures. Original source video/frames are not included.
