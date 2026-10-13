# Whole frontage R04 — independent review candidate

This is an additive continuation of R03. The original runtime, nine original material mothers, cache experiment and earlier evidence remain untouched. No ground work is included.

## Visible change

The complete 14- and 13-storey pair now has 27 separately authored frontage rules (81 unequal bays), instead of the same equal-pitch openings and periodic full-width canopies. Openings have household entrances, broad work/study light, narrower sleeping windows, real high metal ventilation louvres and street-level work entrances. Local corrugated shelters have supports, gutters and returns toward existing drainage. Ten supported open balconies have recorded drying locations on outward supports beyond the front guard, leaving the walking strip clear. Eight existing edge-balcony transactions produce real enclosed spaces, dated shells, windows, roofs and work tables or bedding/dry-storage shelves. No new beds or population count are inferred.

The unequal outer floor envelopes, life furniture, wet areas, roof structures, three borrowed links and their gate remain function geometry. Balcony slabs and their end guards now stop at the actual door/drying-right boundary on A-F02, A-F04 and A-F07, rather than assuming every level has a full-width shared platform. The recorded A-F04 1973 transaction retains its original exact 2.45616m² area, existing-household access, adjacent drying agreement, support and drainage provenance; the other seven events remain explicitly fictional design interpretations. Circulation is corrected as part of this candidate: the continuous stair zone is moved behind the upper setbacks, room-to-core doors meet real main-level landings, and an outboard corridor joins the unchanged borrowed-link doors. Finite-thickness concrete treads/risers, consistent stacked flights, complete handrails, landing guards and balcony end guards replace inherited invalid circulation geometry. Both roof slabs now have actual stair apertures and supported, guarded exit platforms; roof shelters and water tanks move clear of those exits. The living furniture zone and wet divider move with the actual stair partition. Wet-area doors use the clear core-side aisle; shallow upper floors have correctly placed room openings, two real parked sliding doors, retained beds/work furniture and reachable rear cupboards. Rear shelves and blackboards no longer disappear behind a point-selection gate. All cameras use normal perspective. Overall is the default; the detail and cutaway are separate views of the same world.

## Source boundary

This is a fictional design interpretation. Uses are inherited from the established R03 life-world, combined with the user's described cutaway relationships: home work, shift sleeping, shared washing and cooking, borrowed access, piecemeal rental-funded additions and relocated drying. Dimensions, dates, bay allocation and agreements are authored. They are not surveyed addresses, evidence that every original attachment was reopened, or a statistical allocation of historic trades. The Japanese 070652 and SCMP G04/G07 relationship references already recorded by R03 remain contextual sources; no third-party reference imagery is redistributed.

## Physical consistency

All nine material source files are imported directly from the R03 runtime and checked against its SHA-256 lock. New dated shelters and household additions feed age through the same physical state used by geometric displacement and original PBR. Plaster retention, exposed brick and mortar remain the original coupled field. Actual sill corners, shelter footprints and downpipes now drive exposure and wetting in that same state, fixing the former very low exterior-exposure input rather than adding painted grime or false holes. No appearance textures, proxy meshes, randomized facade decals or low-quality alternate renderer are introduced. The exterior ground keeps the established analytic flat gray early-return path.

## Data and execution

Each floor has six vec4 rules, retaining its original first 13 core values and adding actual frontage divisions, type/mask fields and dates. The full world parameter buffer is 2592 bytes; this is not the full runtime/GPU memory footprint. The seven geometry-stage closures remain below the existing 16500-byte bound. Line comments are stripped only after source partitioning to keep compilation input bounded; no numeric caching or replacement field is introduced. New storage geometry is assigned to the service stage without duplicating operations. The rejected cache experiment is not adopted.

## Verification

Run the original regression suite and this candidate's tests:

    node --test tests/*.test.mjs tests/local-review.test.cjs whole-frontage-r04/tests/*.test.mjs

Generate the deterministic world data:

    node whole-frontage-r04/src/compile.mjs

Actual WebGPU review:

    node qa/local-review.cjs --candidate whole-frontage-r04 --mode full --view overall --viewport 960x1200 --out whole-frontage-r04/qa/overall

The cloud workspace's locally launched Chromium is blocked before WebGPU initialization by a process-singleton socket permission error. The dedicated repository Actions workflow provides the actual GPU-capable execution path. CPU checks and a smoke tile are not full-frame or visual acceptance. Completion requires the full image, shader/device logs and zero unresolved/overflowing ray counters from the exact committed source. Software timings do not establish hardware or phone performance.

The runtime remains a visual-review candidate. It does not imply structural-engineering certification, drainage capacity verification, mature resident animation or accepted textile realism.

## Connection audit corrections

The first R04 commit (30b12eda) is superseded as a review candidate after independent static geometry checks found unsupported upper doors, sealed access to drying, local-cell clipping of cross-bay drains/broad door leaves and storage bundles, disconnected gutter slope, and inherited stair-core/headroom/guard/setback issues. Its running images are diagnostic evidence only. A corrected source must receive its own exact-commit GPU run before delivery.

The added access tests inspect all 27 floor entrances and core corridors, all 10 drying balconies, all eight infill routes, adjacent unequal-height stair flights, both supported roof exits and rooftop fixture clearances, three borrowed links, boundary-crossing primitives and object identity ranges. The test actor is an authored 0.44m-wide, 1.75m-tall clearance volume with a 12mm field allowance. A test-only planar search checks that core/wet/front-door and divided-room routes exist across all 27 floors, including actual open door leaves and furniture, plus eight compact-room cupboard operation points. It uses 2cm samples with continuous edge sweep checks and never relaxes the fixed body size. This is a construction-reasonableness test, not a gameplay navigation/collision system. These are explicit nominal-geometry checks, not a full material-SDF proof, accessibility certification, child-safety certification or real-world building-code review.
