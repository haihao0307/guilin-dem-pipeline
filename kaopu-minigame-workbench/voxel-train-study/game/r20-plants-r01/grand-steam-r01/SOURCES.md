# Flying Hongkonger: grand steam R01

An integrated, independent first design candidate. The old A4 and Mark3 remain original source-backed learning copies in the adjacent preserved comparison. The archived A6 r02 is not the new exterior design baseline.

## What is new
A new continuous locomotive cladding and tender composition; two hollow exhaust mouths in one fairing; physically raised, thick bilingual nameplates and brass 88; the approved owned flying emblem retained as a solid relief; overlapping telescopic coal cover, hinged closed water filler; coherent enamel/brass finish. A newly authored coach has a complete bogie chassis, openable doors, physical window apertures, finite panes, walnut work, original KAOPU leather cushions, tables, lamps, luggage racks and removable roof/side for interior inspection.

The existing qualified self-owned FH88 cast wheels, tread/flange, forged rods, native frame, cab anatomy, instruments, brake rigging and service fittings are reused rather than discarded. Their native sources are frozen at `815a68995ae875155cfc59a3623f5ee6155f3841`; exact individual blobs are in SOURCE_LOCK.json. Render triangles are generated outputs, not a claim that the renderer is mesh-free.

## Material continuity
- Metal: original user-owned FH88 RAIL_FUNCTION_RULES_R01 field. New finish parameters include a 20 micrometre enamel microfinish amplitude, dielectric clearcoat, brass and steel. Original noise kernel is unchanged; finish values are authored, not calibrated.
- Timber: original user-owned Library timber v3 field and physical macro displacement, retained through walled-city-rescue-r01/native/timber-original.mjs. Walnut colour/lacquer is a new explicit preset, not certified botanical reproduction. Original mother has no universal aging law.
- Leather: original KAOPU R02 procedural kernel retained in R09.1. Source repo haihao0307/Humanoid-Rig-Lab-Next, source `09d6747898c0448fbefbbf17cba9b3780eba6ce2`, public build `416d2b7a7d7214865fa47b82973450c700a65da9`. Geometry and shading share immutable metric charts. No Poly Haven bitmap branch is included. Static seating does not reproduce the full R09 nonlinear dynamic shell solver.
- Glass: newly authored finite 14 mm components using Three physical screen-space transmission. No claim of recovered mature glass transport or complete multiple-reflection validation.

## Dimensions, physics and limits
New dimensions are proposed metres, not completed historical measurements. The final candidate includes six side-bay tables, an unobstructed central saloon passage and fully 90° opening vestibule doors. Triangle-by-triangle clipping across x = −11.7 to +11.7 m and z = 1.23 to 2.95 m finds a continuous free lateral interval 1.0786 m wide (1.0040 m conservatively centred). The limiting parts are the opened door grab handle and sofa front apron. These are authored model-clearance measurements, not certified evacuation/accessibility compliance. Twenty-six unique carved-frame/closed-tube geometries pass welded edge-manifold tests; the walnut crest follows the same Bézier arch as its frame.

New dimensions are proposed metres, not completed measurements. Inherited nominal gauge is 1.435 m; the retained rendered rail section is based on the qualified existing 56E1 mother and is not a manufacturing drawing. Original student units remain uncalibrated; camera framing is for visual comparison, not dimensional certification.

200–250 km/h is a design target, not verified performance. This viewer does not modify the mature driving game or multiply its speedometer. Retained instruments use the existing paused reset state. New air-brake routes and reservoirs are design arrangements; high-speed thermodynamics, load paths, braking, wheel–rail stability, low-adhesion behavior, full articulation and operating clearances remain to be validated.

No-sand concept: axle-speed feedback, traction anti-spin control and wheel-slide brake-pressure modulation, with real low-adhesion speed/force limits. These controls do not create adhesion. Engineering references:
- Siemens SF500 primary data: https://assets.new.siemens.com/siemens/assets/api/uuid:b72ddc5a-fa09-4b3a-8f17-0159e25e8f62/mobility-datasheet-bogies-sf500-en.pdf
- Knorr-Bremse wheel-slide protection: https://rail.knorr-bremse.com/en/us/stories/technical-articles/content-page-wheel-slide-protection/
- Knorr-Bremse air supply: https://rail.knorr-bremse.com/en/de/portfolio/products-and-systems/braking-systems/supply/

## Reference attribution
The complete old A4 and Mark3 learning copies are by timblewee, CC BY 4.0. They are loaded from the already-published preserved comparison, with original field SHA-256 checks, scale 1 and source materials/images intact. They are source-backed learning copies, not independently rebuilt pure functions. No teacher scene.gltf is loaded.
- Author: https://sketchfab.com/timblewee
- A4: https://sketchfab.com/3d-models/train-class-a4-union-of-south-africa-636ed4890b72429da4a10abec0551373
- Mark3: https://sketchfab.com/3d-models/mark-3-carriage-std-open-gwr-green-0c64f6c0affb41f7bd4583a96c9fd0f1
- License: https://creativecommons.org/licenses/by/4.0/
- Reference transformations are rigid axis alignment and centering; no scale normalization or retouching.

New bilingual lettering uses Noto Sans CJK HK Bold outlines, SIL Open Font License 1.1, with actual solid extrusion. NOTO-LICENSE.txt is retained. Three.js 0.170.0 is MIT-licensed; see THREE-LICENSE.txt.

## Build and verification
Editable code is under src/, with immutable retained native sources beside it. Install pinned dependencies and run `npm test`, then `npm run build`. Browser test code and verified screenshot reports are maintained on the independent `qa/grand-steam-r01-20261013` branch; the QA workflow has read-only repository permissions and no deployment action. Published preview files are the exact tested build. Full visual acceptance and measured engineering acceptance are separate from shader and geometry tests.
