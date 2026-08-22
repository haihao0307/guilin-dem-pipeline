# Guilin v0.5 focused task: ground-aware camera and unrestricted core zoom

## Immediate defect

The current Guilin viewer cannot approach the ground. The existing stable runtime calculates camera eye height with a fixed `+0.12` scene-unit offset:

```js
const eye = [
  target[0] + Math.sin(yaw) * Math.cos(pitch) * distance,
  target[1] + Math.sin(pitch) * distance + 0.12,
  target[2] + Math.cos(yaw) * Math.cos(pitch) * distance
];
```

The current overall terrain uses `maxDim ≈ 214380 m` and maps real metres to scene units with `2 / maxDim`. Therefore the fixed `0.12` offset represents roughly 12.86 km of vertical clearance. The wheel clamp can reduce `distance` to `0.012`, yet the fixed height term still keeps the camera very high. The target also starts at `[0, 0.05, 0]` and does not follow sampled terrain height. The perspective near plane is fixed at `0.0005`, roughly 53.6 real metres in the overall normalization, so near-ground detail can clip even after zooming.

This task is a blocking regression fix for the `/guilin-v050/` candidate and must also be back-portable to the stable viewer after review.

## Required camera model

1. Define explicit conversions:

```text
scene_units_per_metre = 2 / maxDimMeters
metres_per_scene_unit = maxDimMeters / 2
```

Never use unexplained scene-unit constants for camera altitude, collision or clipping.

2. Add a terrain-coordinate helper that converts scene X/Z to grid U/V and samples the current height field. The helper must account for:

- current overall or core manifest;
- width and height in metres;
- minimum and maximum elevation;
- vertical exaggeration;
- row order and axis convention;
- NoData mask.

3. Keep the orbit target on the terrain surface:

```text
targetY = terrainHeightAt(targetX, targetZ) + targetClearanceMetres
```

Use a small target clearance, such as 0.2 to 0.5 m, converted to scene units.

4. Keep the camera above terrain with collision:

```text
eyeY >= terrainHeightAt(eyeX, eyeZ) + cameraClearanceMetres
```

Ground-inspection clearance must be configurable down to about 1.7 m. Orbit mode may use a larger minimum such as 3 to 5 m.

5. Remove the fixed `+0.12` height offset. Replace it with real-metre clearance derived from the current manifest.

6. Use an adaptive perspective near plane. At ground distance it must be below 0.25 m in real scale. At high altitude it may increase for depth precision. Far plane must still contain the full overall map.

7. Use continuous exponential dolly. In a loaded 10 km × 10 km core, the user must be able to descend from the core overview to approximately 1.7 to 2.0 m above the sampled terrain without hitting a hidden distance clamp.

8. In the overall map, when the pointer or camera target is inside one of the four fixed cores and zoom passes the detailed-data threshold, automatically load that core or present a single explicit `进入精细区` action. A user who selects a core must not remain on the coarse overall grid at ground height.

9. Implement pointer-focused zoom using a ray or iterative ray-heightfield intersection. The current screen-offset target approximation is insufficient. Double-click or double-tap must focus the actual terrain point under the pointer.

10. Add a visible `地面观察` mode. This mode must:

- place the camera at sampled ground plus 1.7 m;
- use mouse drag or touch drag to look;
- support WASD and arrow movement;
- follow terrain while moving;
- prevent underground movement;
- allow Esc or a visible button to return to orbit mode.

11. Orbit interactions:

- left drag rotates;
- right drag or Shift-drag pans along the local tangent plane;
- wheel and pinch zoom continuously;
- double-click focuses actual terrain;
- reset restores the active core overview;
- core-switch buttons move to the correct core and preserve safe camera state.

12. Water collision uses the water surface when it is above sampled terrain. The camera must not be forced below the water surface.

13. Camera state must be serializable in the URL or local state with versioned fields, and invalid old state must fall back safely.

## Four fixed cores

The camera implementation must work for all four exact 10 km × 10 km cores:

1. 真宝鼎
2. 桂林古城, 靖江王城锚点
3. 秧塘机场旧址
4. 阳朔县城

The definitions in `projects/guilin/config/core_regions_v050.json` are authoritative. Do not ask for the four locations again.

## Runtime and LOD behavior

- Overall map remains suitable for regional navigation.
- Core selection loads the detailed core manifest and grid.
- Near-ground mode requires the detailed core grid.
- Terrain, water, vegetation, crops, bunds and GAEA visual layers share the same camera matrices and real-metre scale.
- Far, medium and near ecological detail must transition by screen footprint and real distance, without abrupt disappearance as the camera approaches the ground.
- Preserve one horizontal metre to one vertical metre when exaggeration is `1.0`.

## Required diagnostics

Display a compact camera readout in the candidate:

```text
mode
active map or core
camera altitude above sampled ground in metres
target elevation in metres
distance to target in metres
near and far clip in metres
active grid resolution
active LOD
```

This readout can be hidden in normal use but must be available for QA.

## Required tests

1. metre-to-scene and scene-to-metre round-trip;
2. no fixed `0.12` camera altitude term remains;
3. terrain sample conversion at all four core centers;
4. orbit target follows terrain height;
5. eye collision maintains configured clearance;
6. camera reaches 1.7 to 2.0 m above terrain in every core;
7. adaptive near plane is below 0.25 m in ground mode;
8. ray or iterative pointer focus lands within tolerance of the sampled terrain;
9. overall-to-core detailed switch occurs below the declared threshold;
10. ground movement follows terrain and never goes underground;
11. water surface collision passes;
12. wheel, pinch, double-click, right-pan and keyboard controls pass browser smoke tests;
13. reset and core switching pass;
14. console error count is zero;
15. v0.3.1 rollback remains loadable.

## Visual evidence

For each of the four cores, capture:

- core overview;
- medium-altitude oblique view;
- approximately 50 m above ground;
- approximately 2 m above ground;
- ground-observer view.

Screenshots must display the core name, camera mode and altitude-above-ground readout.

## Delivery

Integrate this fix into the existing `/guilin-v050/` candidate implementation. Update `HANDOFF_GUILIN_RUNTIME_V050.md` with the defect diagnosis, conversion formulae, controls, tests, screenshots, known limits and rollback. Keep PR #17 in draft until browser QA and the five-view evidence for all four cores pass.
