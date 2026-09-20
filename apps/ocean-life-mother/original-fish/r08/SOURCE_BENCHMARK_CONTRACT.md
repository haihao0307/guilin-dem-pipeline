# Tuna R08 source benchmark contract

This contract defines the non-production source-reference stage of the high-fidelity restart.

## Exact identity

Accepted geometry/rig/motion source:

```text
tuna_fish(1).glb
bytes 6137560
sha256 f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0
```

Accepted high-resolution appearance source:

```text
tuna_fish (1)(2).glb
bytes 58908280
sha256 5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe
```

The two variants have identical benchmark geometry, skeleton and animation data; their image payloads differ. The source title is `Tuna Fish`; a final species identity is not inferred from the filename or appearance alone.

## Coordinate calibration

The exact bind-pose source establishes:

- lateral axis: scene `X`;
- tail-to-head axis: scene `+Y`;
- ventral-to-dorsal axis: scene `+Z`;
- body reference length: `3.003417763845758` source units;
- normalized longitudinal coordinate: `u=(Y-tailY)/bodyLength`.

No metre or millimetre claim is attached to this source length.

## Fixed views

Required reference views:

- `side_left`;
- `three_quarter`;
- `front`;
- `top`.

Every view stores a calibrated silhouette mask, bounding box, centroid, area ratio and a 256-point normalized contour. These values are benchmark inputs, not final species DNA.

## Skeleton and skin evidence

The benchmark reads the source inverse-bind matrices and transforms their bind origins into the skinned mesh scene frame. This is required because ordinary node origins can be displaced by authoring hierarchy transforms.

The benchmark records:

- all 98 source joints;
- source hierarchy parent indices;
- bind-pose positions and normalized coordinates;
- source-authoring semantic groups inferred from names;
- dominant skin-influence group by source triangle;
- total influence and weighted centroid by joint.

Name-based groups are source-authoring evidence only. They do not automatically become biological bones or final runtime controls.

## Public-repository boundary

The public repository stores the benchmark tool, non-reversible aggregate metrics, calibrated view transforms, contour hashes, source identity and QA. Full 256-point contours, bind inventories and influence rankings are reproducible locally from the exact source but are not published as content-bearing source data. The repository does not store the raw GLB, source textures, complete source mesh arrays, inverse-bind arrays or animation tracks.

## Candidate gate

A native candidate is blocked until:

- anatomical region partition is reviewed;
- continuity targets are recorded;
- fixed-view camera calibration is frozen;
- comparison output format is implemented;
- the new surface representation is demonstrably higher-dimensional than the rejected section-loft line.
