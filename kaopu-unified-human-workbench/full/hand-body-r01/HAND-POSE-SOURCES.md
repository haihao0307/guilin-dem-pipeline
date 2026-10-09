# Fist reference and adaptation

The fist pose now uses the **MakeHuman system `fight03` hand pose**, not the earlier tip-only thumb IK. The earlier candidate's fist was visually rejected; its successful numeric tests did not establish natural hand shape.

Source: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_poses.html

Official archive: https://files2.makehumancommunity.org/asset_packs/makehuman_system_poses/makehuman_system_poses_cc0.zip

The included `fight03.meta` states author MakeHuman, license **CC0**, copyright (c) 2018 Data Collection AB, Joel Palmius, Jonas Hauquier. CC0: https://creativecommons.org/publicdomain/zero/1.0/

`FistReference.mjs` contains only the source hand/metacarpal rotation vectors and source hand basis extracted from this pose, plus our conversion implementation. BVH declared intrinsic X/Y/Z Euler channels are composed as matrices, then converted to rotation vectors. Source hand-forward/palm basis is mapped to each destination body's unmodified rest hand basis. Anny local-reference rotations remain degrees. Wrist, arm, body, rest matrices, mesh and full CSR weights remain our existing system's responsibility.

The reference preserves independent finger axes and metacarpal cupping. A small -12 degree CMC correction around the current hand-forward axis reduces thumb/index surface-proxy overlap in the reviewed adult. It does not replace finger motion with a tip-only target. Tight uses the complete reference; loose uses 78% of its rotations. Smooth closing uses the same shape-specific rotations, with the thumb folding after the four fingers. The right fist mirrors the left reference using axial-vector reflection before the shape-frame conversion; the source action’s asymmetric right-hand pose is not silently treated as the same fist.

## What this proves and what it does not

- The actual original 25,417-vertex / 50,624-triangle / 104-bone human is rendered using all CSR influences.
- Bone rigidity/FK replay tests are separate from visual review. They cannot certify anatomy.
- Per-bone skin-vertex convex hull checks are conservative diagnostic proxies, **not triangle penetration depth or contact certification**.
- No learned pose corrective is loaded, no finger pressure/force equilibrium, no physical load feedback, no certified skin-to-skin or skin-to-prop continuous collision.
- SOMA informed twist hierarchy and rig/pose-corrective boundaries. This fist reference is MakeHuman CC0. Task IK, body cooperation, retarget conversion and object adapter are self-authored.
- Pinch, small-sphere grasp, carry and reach-turn remain experimental tasks; six selectable tasks do not mean six finished capabilities.

Two real-hand photos were consulted for visual anatomical reference only, not copied into the public workbench: https://poselibrary.com/hand-poses-reference and https://www.3dmd.net/gallery/large-male-fist-photo-bottom-fs2356.html .
