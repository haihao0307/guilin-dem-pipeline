# Original Fish R07 / Tuna R02

Date: 2026-09-20

This is the second executable tuna species branch under the Original Fish KAOPU trunk.

## What changed from Tuna R01

- exact low- and high-resolution FISH-REF-002 source hashes are preserved;
- 4,053 source body vertices were reduced to a 33-station body profile, not retained as runtime mesh data;
- source fin-weight groups were reduced to independent dorsal, rear-dorsal, anal, upper/lower caudal, pectoral and pelvic polygons;
- 98 source joints remain compressed to 24 semantic controls;
- the source 2.166666746 s swim clip is retained only as an authored timing prior;
- independent runtime adds body bending, pectoral stabilisation, separate eyes/cornea, mouth, a posterior opercular edge, finlets and peduncle keels;
- a procedural wet-skin and thin-fin candidate replaces the flat grey R01 preview.

## Direct entry

Open `index.html`.

The file is self-contained. It does not load the source GLB, source textures, 98-joint source rig or source animation tracks.

## QA

```text
node tuna-native-r02.test.mjs
Original Fish Tuna R02: 232 assertions passed
```

Browser QA:

- desktop 1440 x 1000;
- mobile 390 x 844;
- side, three-quarter, front and top views;
- WebGL error 0 in every fixed view;
- no page errors, console errors or horizontal overflow.

## Evidence boundary

This remains an N2 source-constrained engineering candidate. It is not yet nature-derived, biologically scale-calibrated, motion-accepted, visually accepted, user-accepted or production-ready.

The current body/fin profile is useful for establishing the species-branch interface. It does not prove natural tuna kinematics or final 3A anatomy/PBR.
