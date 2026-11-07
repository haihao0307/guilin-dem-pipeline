# R06 limited learning preview: verified public delivery

Verified 2026-10-21 UTC. This is a publicly accessible learning preview, not a formal product or a completed reconstruction of three buildings.

- Preview: https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/r06.html
- Frozen tested runtime: `2b6213d9ef34a6f55f5ac6e67fc75f7885d7e650`.
- Pages commit: `d14c30552086b3339381958394305ab9ed89024e`.
- Pages deployment: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39545195696
- Public delivery checks: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39546292686
- Comprehensive candidate QA (FAILED): https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39543424493
- Draft, unmerged PR: https://github.com/haihao0307/guilin-dem-pipeline/pull/322

## Two different outcomes

Public delivery verification PASSED: all 15 frozen files match SHA-256, three source cases and three source-bound design assemblies rendered at 840 x 667 with zero unresolved pixels in their tested normal views. Point and ray samples passed. Actual browser checks for R03/R04/R05 passed and 19 old files are unchanged. Runtime instrumentation recorded zero object vertex buffers and zero indexed draws; each of 76 fullscreen ray dispatches used three raster vertices. These are ray-launch plumbing, not generated building meshes.

Full geometric acceptance remains FAILED. The exact underside diagnostic still has one unresolved pixel at (161, 525), bottom-left coordinates, among 560280 pixels after the shared 512-iteration march budget. This was reproduced, not erased, increased away, or relabelled as a miss. The page shows a visible known-issue notice. Public delivery success is not a new comprehensive QA pass. The original failed report remains preserved.

The 390 x 844 check is desktop Chromium viewport layout only, not an iOS device or iOS performance measurement. Public results and old-version results are stored beside this document. The Actions artifact contains eight public R06 screenshots plus three old-version screenshots; short artifact retention is not a permanent image archive.

## What is actually assembled

- 33 La Salle Road: official two-storey case; editable two-floor slab and stair design tied to its source frame/official footprint. Interior plan, exact stairs and door locations are not verified. A photographed shared 31-33 gate is not asserted to belong solely to No.33.
- K.C.C. Building: retained source tower plus one representative six-wing plan relationship, three lift interfaces, design stair and receiving slab. Not all 24 tower floors, not a verified scissor stair, and no completed lift machinery. Official 24-storey tower, separate podium records and the owner's whole-building 28-storey description remain distinct.
- China Travel Hip Kee Godown No.2: retained upper source part, separately inferred hollow podium from official footprint/height, two design slabs, distinct vehicle/person openings and a freight interface. Door placement and interior are assumptions. Official 12-storey upper part, two podium storeys and two basement records are not blindly summed. A visible coplanar material seam remains recorded.

All three retain source geometry rather than replacing it with generic boxes. Source-only surfaces do not establish a closed solid or hidden interior. Materials, semantic identity and local metre coordinates share the field query. Evidence labels distinguish recorded, inferred, assumed and unknown values.

## Performance and scope

Candidate13 synchronized software-renderer draw/finish/readback at 600 x 420: kernel median 4225 ms; source-bound case medians 2335 ms (low-rise), 5085 ms (KCC), 2166 ms (warehouse). These are measured software timings, not interactive hardware or phone claims. The viewer renders on demand, lowers only ray resolution while dragging, and restores the same field at rest. It does not simplify the source shape.

No model meshes, Marching Cubes or voxel model were generated. Foundational fullscreen rasterization remains disclosed. No structural, accessibility, fire or window-system certification is claimed. Complete facades, measured window details, all floors, real lift systems and final production provenance clearance remain unfinished.

## Provenance and reversibility

Learning notices and source links are retained. Official CSDI-derived geometry is not reclassified as wholly owned work. External reference photos/floorplan images were not bundled. Existing material-source notices, including the unresolved material-closure provenance issue, remain in place for a separate formal-release audit.

The only production mutation was 42 added files within this trial directory; R03/R04/R05 and other projects were not changed. These public-verification JSON files and this handoff are archived on the Draft branch only, without another Pages deployment. If rollback is requested, remove/revert only the exact 42 additions from d14c3055 using a new fast-forward commit based on the then-current branch head. Do not reset or force-push the whole Pages branch and do not remove sibling old-version files.
