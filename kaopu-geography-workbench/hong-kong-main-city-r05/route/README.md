# R05: linked old Kowloon station and route correction

## Result

The station, native B-track centreline and new route use one clock-pivot rigid transform. Clock registration moves **34.8481 m east, 10.2929 m north** from the previous authored anchor, to cached official POI **E835512.0191 / N817186.2779**. The local pivot `[24,0,4]`, metre scale, original station geometry, calibrated 44 m tower + 7 m rod, and authored eastward axis are preserved.

The official response was captured successfully at 2026-10-15 04:01:15Z. Its receipt/hash are retained; the later 403 is respected and no repeat lookup was made. The response also contains a second representative point about 3.1 m away. Source digits are reproducibility, not centimetre survey accuracy. The privately retained georeferenced 1970 map was viewed for corridor direction, but does not establish exact whole-station orientation or historical footprint. No reference image is redistributed.

Only the first two route polynomials change. The new short connector joins the unchanged R04 world alignment at old chainage 627.861542 m / new 617.182014 m. All later coefficients and arc-length tables are byte-identical. The long tangent ends 30 m earlier than a pure translated copy to avoid tightening the joining bend; it still extends past the original station rails. Total length is **34,724.114075 m**, a **−10.679528 m** chainage change. All other stations, Tin Hau yard, bridge and tunnel locations and vertical heights remain fixed in world space; their chainages receive that one offset.

Analytic minimum planar radius is **223.252021 m**. Analytic/whole-line 1 m grade tests pass with maximum **5.902485‰** under the existing editable 15‰ game ceiling. Maximum measured XYZ discrepancy beyond the modified connector is 4.1e-12 m. This is numerical preservation, not engineering validation.

## Station and complete-train stopping

The existing buffer beam at local Z−10.8 extends to −10.98 on the track side. New route chainage zero is on that face, rather than an arbitrary point inside the platform or a fictitious extension through the terminal hall.

- Native B-track centre X−25, local rail top Y0.086; world rail top stays 3.986 m.
- Existing platform local Z envelope −146.300143 to −8.699908: **137.600236 m**. Roof remains **135 m**. No station or platform is resized.
- Platform centre is **S66.520025305 m**. `stop.d` in the source plan and `platformCenterS` both mean this geometric centre; the consist installer computes its own locomotive-origin stopping marker exactly once.
- Four coaches plus retained locomotive/tender span **120.557725 m**: locomotive origin **S121.972887805**, rear **S6.241162805**, front **S126.798887805**. Actual platform margin is **8.521255 m at each end**. This is the accepted provisional game demonstration. The earlier 15 m allowance was an authored Tin Hau target, not a universal railway standard.
- Eight coaches span **219.693725 m**. Centring that train here would put its rear at **S−43.326837**, and overhang the platform by **41.046745 m at each end**. Both old-station platform fit and track-end safety fail explicitly. The host starts longer formations at Tin Hau; it must not silently clamp a train forward and call it centred here.

The fit uses source geometry envelope and native coupler bounds. Individual doorway/platform clearance, historic stopping practice, buffer impact behaviour and real operating approval are not established.

## Integration

Use the frozen `route-plan.json` with the unchanged copied route runtime, vertical core and installer. Import `installKowloonRegistration` and `patchKowloonStationHost` from `station-registration.mjs`; await installation before constructing the raw WebGL host, then pass the resulting API to the patch. It replaces exactly one native station placement expression and the corresponding old Kowloon focus anchor. Repeated or missing anchors fail rather than patching broadly.

`createKowloonRegistration(anchor)` exposes `toScene`, `fromScene`, `trackAtNativeZ` and `platformCenterS`. Any scale guides must use `api.clockAnchorSceneXYZ`, rather than the old hard-coded default anchor. Original station assets remain read-only.

`assessPlatformStop(route, stop, consist)` accepts native `frontOffsetM/rearOffsetM`, returns the exact locomotive-origin stop, front/rear chainages, platform margins, `platformFit`, and independent `trackEndSafe`. Default hard track-end guard is an editable 0.5 m game guard. It does not mutate or clamp stops. Host `routeStops()` retains platform geometry separately from driver stopping markers.

R04 remains an untouched rollback page/source. The new route API continues to preserve whichever original route object the wrapper was given.

## Reproduce

```sh
python3 research/hk-route-kowloon-r05/compile-kowloon.py
node research/hk-route-kowloon-r05/test-kowloon.mjs
node research/hk-route-kowloon-r05/update-evidence.mjs
```

Local generation reads already-captured official receipts and the existing original station/map files. No external request is needed. `verification.json` checks all joins, full line, default four and optional eight, station/native-track alignment, immutable source hashes and unchanged downstream geometry. Actual browser integration remains a separate QA step.

The same limited 642-component building index has no new southern XZ corridor candidate under a conservative 2 m rescreen; the existing 40 downstream candidates retain world locations and receive updated chainages. This is not a full solid-mesh collision or global building clearance result. Bridge/tunnel evidence is translated in chainage only because those world geometries and heights are unchanged.
