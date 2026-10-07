# Original teacher kernel

Original file: https://github.com/mrdoob/three.js/blob/r170/examples/jsm/objects/MarchingCubes.js

Git blob: 642d08648e82fa343d31567328f616adb6e03256
SHA256: b1c67207e4d2ab22c6550e57a8b9104896df2598e9bc513ffc4dc50238975e7b
License: Three.js MIT, retained in LICENSE

The source file is not modified. The browser import map and Node loading hook resolve its bare `three` import to the existing vendored r170 build. The analytic sphere harness uses this original class directly and reports volume/radial/normal error. It is not a run of a Houdini or Karma project.

Our `src/volume-core.js` supplies a bounded capsule SDF, smooth union, inner voids, surface windows, finite-precision vertex welding and original-axis attribute transfer. These are separately declared extensions, not original Three.js example parameters or an OpenVDB implementation.
