# Open Volume / 07 — local scene candidate

An original conservation-room experiment for a gaze-state mechanic. It is a bounded space/material candidate and a future integration host for the user's already-approved assets. It is not a P.T. recreation or a finished AAA art claim. No character or plant assets were made.

## Original authored components

- Ivory plaster shell, walnut wainscot with layered rails, deep window reveal, framed closed door, mineral slab floor, quiet rear arch.
- A single split porcelain specimen on a chamfered stone plinth. Its curved ceramic shell, bronze seams, internal dark inclusion and supporting fork are constructed with Three.js geometry.
- Peripheral conservation bench, cloth and closed folio provide human scale without competing with the specimen.
- All texture pixels, radiance-map pixels, labels and geometry are authored procedurally in `scene.js`. No images, models, sound, materials or layouts were downloaded or copied from a game.

## Integration API

Call `createGallery(THREE)` using the existing Three r170 module. It returns `scene`, `focusTarget`, `occluders`, `applyPhase`, `animate`, `collisionBoxes`, and `bounds`.

- `focusTarget` is a Group at world (0, 1.56, -5.3). Use its world position as the gaze center; raycast recursively to intersect the actual sculpture.
- `applyPhase(0|1|2)` settles a deterministic, idempotent pose. The shells open slightly, the suspended inclusion changes angle, and the key shadow shifts. There is no continuous idle motion, random flicker or player teleportation.
- `animate(dt, elapsed)` is intentionally a no-op.
- `occluders` contains walls, floor, ceiling, door, plinth and actual bench meshes, with no sculpture meshes.
- `collisionBoxes` uses `{ min: [x,y,z], max: [x,y,z] }` for the plinth and bench only. The room interior is x -3.6..3.6, z -9..2.8, y 0..3.9.
- Exactly two lights cast shadows: the warm conservation spotlight and cool directional daylight. The pendant and indirect fill lights do not cast shadows. Maps are 2048²; lower to 1024² if the host's software rendering budget requires it.
- Renderer belongs to the host: use sRGB output, ACES filmic tone mapping, exposure near 1.0 as a starting point, and PCFSoftShadowMap. Do not add a strong ambient light: restrained ambient and generated environment are already included.

## Verification boundary

The authored module passed `node --input-type=module --check`. Visual/runtime QA is performed by the integrating host. No package installation, publication, remote asset retrieval or unrelated project modification was performed.
