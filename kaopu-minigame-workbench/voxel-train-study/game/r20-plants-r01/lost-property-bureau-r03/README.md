# Lost Property Bureau R03: whole-building function candidate

New sibling candidate; R02 and the frozen room receiver are not modified.
72 x 64 metres is an authored design, 2.76 times the old 44 x 38 footprint.
The 72 x 42 long-term store is 4.2 times the 72 x 10 receiving zone.
The 11,040 mixed-size addresses are potential locations, not 11,040 stored items.
Twenty-four scripted, fictional records are the actual initial inventory.

## Rendering contract
Native WebGPU only. Whole-domain WGSL analytic fields, bounded local coordinate
repetition for 16 x 20 x 6 racks, three fullscreen vertices, no CPU vertex/index
buffers, no per-rack mesh instances, external meshes, images or field textures.
A compute pass finds primary intersections; only unresolved rays are continued;
material shading consumes the retained hit record. Exhaustion is magenta and
counted separately from sky. A render freezes camera, inventory and world time.

Brick, plaster, wood, stone and metal mother functions are reused unchanged
from the publicly frozen room receiver (2eacc2f45637ad1063efebec40087b2fb795f857).
The new whole-building material binding, weather placement, building geometry,
steam machinery and bounded millimetre surface-loss function are authored here.
At this building-scale candidate, detailed mother surface fields shade actual
hits; the whole-building geometric relief is a bounded new adaptation, not a
claim that the frozen room's microscopic intersection is reproduced everywhere.
All saved imagery used for review must be actual WebGPU output.

## Storage contract
UTC world time starts 1976-07-01. Time passage never creates a claimant or removes
stored property. Claim approval needs a matching hidden feature and identity;
a pick reservation is not a physical delivery. Carrier custody survives a save.
Only confirmed handover decreases local inventory, and its event chain remains.
Browser-local JSON snapshots are explicit; native SQLite.KaoPu is not connected.

## Scope and limits
External facade, hall, long-term warehouse, receiving strip, boiler court,
connected supply/return pipes and rear railway are one selectable cutaway scene.
Limited crank and handling-arm poses use the same world clock. They are not a
full engineered power/pressure solver. No historical building reconstruction,
real personal records, pressure ratings, fire-code or manufacturing approval.
Actual phone/hardware frame rate is not measured; SwiftShader timings describe
software-GPU submitted work only. Inventory routes require geometry review.

Run `node qa/source.test.mjs` and `node --test qa/inventory.test.mjs`.
The QA workflow uses official pinned Playwright Chromium in GitHub Actions;
no local-browser launch is used. Do not publish before reviewing actual frames.
