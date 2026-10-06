# Third-party notices

Cloud sampling is adapted from the official Three.js r170 `webgl_volume_cloud` example:
https://github.com/mrdoob/three.js/blob/r170/examples/webgl_volume_cloud.html

`ImprovedNoise.js` is the unmodified r170 Three.js implementation:
https://github.com/mrdoob/three.js/blob/r170/examples/jsm/math/ImprovedNoise.js

Both use the Three.js MIT license, Copyright © 2010–2024 three.js authors. The complete license is included in `../voxel-train-study/licenses/THREE-LICENSE.txt` and applies to these reused components as well. The shared Three.js runtime remains in that sibling directory and is not duplicated.

The cloud remains a continuous density volume, not a shaded solid shell. This study adds a fixed hemispherical envelope, a generated 3D noise field, Beer–Lambert front-to-back accumulation, a three-sample directional optical-depth approximation, and reduced-resolution compositing. No reference-video frames or original artist assets are included.
