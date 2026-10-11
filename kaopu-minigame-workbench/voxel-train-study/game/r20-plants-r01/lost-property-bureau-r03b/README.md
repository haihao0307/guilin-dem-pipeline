# Lost Property Bureau R03b — right-street entrance and 4,000 m² clear store

Independent sibling of the preserved e4729d553d650ce13af6e8322edc14e296ec585a
R03 candidate. R02, R03 and the frozen room receiver are not modified.

## Authored layout, not a historical claim
Main footprint 84 x 80 m. Clear storage rectangle is x[-28,36], z[-28,34.5]:
64 x 62.5 = exactly 4,000 m². Public hall, offices, receiving, walls, tracks,
boiler court and technical strip are excluded. Internal storage aisles are
included in the warehouse-use area; shelf-only footprint is not 4,000 m².
Main entrance and all reception/claim counters are on west x-negative street.
The south z-negative street has office windows, not a second equal main door.
Boiler court is relocated rearward. Exterior and cutaway cameras exactly match
R03 e472 for comparison; a third camera faces the new right-street main door.
No claim is made that this fictional bureau is the real world's largest.

## A real quarter-turn, with matching ledger and routes
Two banks, each 16 rows x 20 bays x 6 levels. The rack long axis is x, previously
z. Bank A starts x=-25, bank B x=8. Row centre z=-23.5+3.5*localRow. Central
transport lane x=4 is separate from the conveyor at x=0.5. The six small-item
rows per bank subdivide into six cells. 22,080 mixed-size addresses are capacity,
not inventory. The original 24 fictional items retain identities and dates.

Ledger dimensions remain [depth across shelf face, height, width along bay].
I.itemRenderDimensions(item) maps this logical order to world [z,y,x] sizes,
returning [item.dimensions[2], item.dimensions[1], item.dimensions[0]]. This
quarter-turn does not resize an object to fit an unsuitable slot. Use
I.STORAGE_KEY (kaopu.bureau.r03b.custody.v1) and schema 4; old layout snapshots
are rejected instead of silently reinterpreted at new coordinates.

Transport exits a shelf face, lowers in its aisle, follows x=4 or safe edge
corridors, and passes real partition door centres. The west gate is x=-28.3,
with z=-20/0/20 centres. The rear gate is z=34.8 with x=-16/4/24 centres. Public
handover lifts before approaching the counter. Tests check 384 outbound rack
routes against rack footprints; this is not a complete swept-machine/world
collision certification. Special custody positions use the x=38.5 side strip.

## Native function renderer
All building/rack/pipe/machinery solids are WGSL coordinate fields. Repeated
rows use nearest coordinate queries, not thousands of meshes or instances.
Three fullscreen vertices; compute primary intersection, sparse unresolved-ray
continuation, then material pass. No CPU-expanded mesh, external mesh, image
appearance texture or sampled numerical field volume. Material mother files
remain byte-identical to the frozen public room receiver. Weather placement and
bounded whole-building geometric loss are authored bindings, not a claim of
reproducing the room's microscopic intersection at every architectural pixel.

## State and limits
One world clock, displayed in HKT. Unclaimed goods remain indefinitely unless
an explicit permitted custody event changes them. A hidden-feature match and
identity check precede pick reservation; physical handover is a separate event.
Local browser JSON persistence is implemented; native SQLite.KaoPu is not.
Candidate: roof frequency noise, full machinery engineering, detailed prop
forms and complete collision certification remain unfinished. No phone or real
hardware FPS claim is made. QA uses WebGPU on SwiftShader in official pinned
Playwright Chromium on GitHub Actions, not a local browser.

Run node qa/source.test.mjs and node --test qa/inventory.test.mjs.
Do not publish to Pages before reviewing the actual three screenshots.
