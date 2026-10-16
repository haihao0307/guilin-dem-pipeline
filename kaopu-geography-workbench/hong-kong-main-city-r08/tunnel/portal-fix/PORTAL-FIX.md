# R06 portal geometry correction

Status: actual first browser screenshots failed the portal visual review. This correction has source-triangle CPU evidence; final fixed-camera and public-camera browser validation is still required.

## Confirmed causes

1. North portal: the original `hkHeight` returns a nearest 30m node outside detail patches. The rendered background is a linearly interpolated triangle surface. At S9411.54 the displayed terrain is 17.986m but the nearest height is 15.467m. The old open excavation stopped only 2m above the sampled height, leaving a strip of actual mesh above it. Similar residues occur near S9439.54–9441.54.
2. South portal: the recorded eye is at S5744.82, within the previous covered interval 5396.42–5764.31. It is laterally 3.56m from the route and 6.54m above rail, outside the arch clearance. The large near wall is therefore expected at that invalid external-view eye. Changing the terrain or enlarging the bore merely to clear this eye would be incorrect.
3. The outer renderer cannot own these portal triangles: both sites lie well inside its excluded original-owned EPSG:2326 rectangle [823035,808015,848475,845485]. Its mesh builder skips every owned cell. The residual bars were independently reproduced from the original background alone, without an extra terrain layer.
4. A zero-thickness triangle AABB is not the reproduced cause. Horizontal source triangles inside a 3D cutter remain valid candidates and are exercised by the existing flat-plane tests.

## Minimal code changes

Only `tunnel/curved-tunnel.mjs` changes at runtime.

- Add pure `sampleBackgroundTriangle(HK,heights,mask,x,z)` matching the actual two-triangle grid. It neither changes the height buffer nor replaces the existing `hkHeight`.
- Compose the existing detail triangle sampler with this exact background display sampler inside the host patch.
- Make roofless excavation vertically open, with a 10km numeric cap. It is no longer incorrectly bounded by sampled surface height. Retaining walls still end at the true display surface.
- Add sampler/ceiling provenance to stats. Existing API, source route, sources, protected runway, surrounding projects, and camera UI remain untouched.

## Verification

Final route plan SHA256: 364a1087816f6f03450641e39df73355a006917b2229532d81f0a75d76c6b19b.

`PORTAL-MESH-REGRESSION.json` verifies the actual north background crop with an independent vertical-ray query against the output triangle soup: 37 residual probes before, zero after. Five lateral positions span ±3m; chainage step is 0.5m. The new sampler agrees with the original rendered source triangles to 8.7e-13m in this crop. Input source buffers remain unchanged. General CPU tests also retain the 31.16m overburden roof witness and pass on the final plan hash.

New main covered interval: S5812.445–9408.232. Adjacent open intervals: south S5764.448–5812.445; north S9408.232–9448.229. These are diagnostics; UI must consume live stats rather than hard-code them.

Browser acceptance must keep the exact old south/interior/north camera transforms, show the fixed north strip removal, and separately show both newly valid public portal views. The old south eye must be labeled invalid rather than misreported as a successful outside view. CPU success does not authorize calling the visual stage passed.
