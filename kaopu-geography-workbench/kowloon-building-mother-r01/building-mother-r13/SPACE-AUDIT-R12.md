# R12 supported-space reachability repair

All lengths and room uses in this report are authored inspection-model values,
not surveyed interiors or building-code certification. Actual storeys, source
envelopes, source plan polygons and actual floor labels are unchanged.

## Reproduced failures

- Lowrise, both L01 and L02: the former broad bedroom-ne clip included a detached
  shallow lobe at x approximately 1.95–6.25, z −2.15–−1.30. Its sampled free area
  was 3.24 m². It was bounded by real solid complete-wall boundary-13/14/15 and
  boundary-16/17, not a shaft or a stair hole. The one bedroom-ne door was far away
  at (−2.5, −7.65). The single room ID and area-coverage sum concealed its physical
  separation. Two more narrow bedroom-ne portions were point-connected but not
  connected for a 0.50 m standing-body envelope. Testing seven room centers could
  not detect these omitted parts.
- KCC, all doors fully open: lower-family B/C floor plates stopped one view pixel
  beyond the core plate, and E/F stopped four pixels short. Upper-family E/F had
  six-pixel gaps. At the unchanged explicit inspection scale these are 0.0314,
  0.1256 and 0.1884 m support discontinuities. Logical opensBetween links and a
  cut in a door wall did not create a physical supporting floor.
- KCC A-flat: a generic one-sided positive hinge rotation obstructed portions of
  the traced bedroom approach. The bedroom-upper leaf also needed its authored
  hinge on the return-wall side, rather than protruding across its narrow return.

## Minimal authored repair

- Lowrise: reassign the courtyard-side western taper to the existing continuous
  corridor and the detached eastern shallow strip to the adjacent kitchen and
  storage zone. Retain the northern bedroom lobe, seven room doors, core, stair
  hole, existing building entrance and source footprint. No arbitrary extra door
  was punched into a source wall to manufacture a passing route.
- KCC: bridge only the local support gap beneath an already observed unit door.
  Append floor:door-threshold:B/C/E/F for lower plans and E/F for upper plans.
  Never enlarge the entire core slab, cover a shaft, or fill the stair opening.
- KCC: only two existing leaf poses change: bedrooms-divider:leaf and
  bath-upper-door-host:leaf inside unit:A:internal. Original wall/opening geometry,
  leaf dimensions and all original runtime object IDs remain unchanged. The
  swing/hinge configuration remains an authored design, not verified hardware.

## Results and boundaries

The independent whole-domain scan uses every supported grid point, not preset
room centers. At both 0.05 m and 0.025 m spacing:

- Lowrise L01 and L02 each have one connected supported point domain and one
  connected domain with the sampled 0.50 m diameter, 1.85 m high body envelope.
- In KCC 5/6/18/26F inspection models all six dwelling interiors, including their
  traced A-flat subdivisions, and the meter service room belong to the lobby's
  connected standing domain when their doors are open.
- Two 6/F platforms remain disconnected. No reviewed platform access opening is
  known, so no new access door is invented. At 0.025 m spacing their supported
  point areas are approximately 10.37 and 11.02 m². They remain visible and
  explicitly unresolved, not silently excluded as shafts or structural voids.
- Small unassigned rear-lift recesses remain point-connected but outside the
  0.50 m clearance-connected domain: approximately 0.15 m² in lower plans and
  0.16 m² plus a 0.0025 m² sample island in upper plans. Their use and standing
  access are unknown. They are not labelled structure merely to pass a test.
- KCC's schematic opposed stairs are not a verified real three-dimensional
  interlock, and their full-storey height/landing relation is still unknown.

The sweep uses finite-prism vertical slices, supported foot centers, conservative
sampled body-clearance dilation and four-neighbour connectivity. Rounded aperture
profiles are polygon-approximated; rail fields are not included in the whole-grid
sweep. The independent focused route tests do use the actual queryCompleteSolid
function including aperture and rail fields. A finite grid is not a continuous
navigation proof, complete human-footprint support proof or safety certification.

## Exact focused regressions and unchanged geometry

Run `node building-mother-r12/test-space-regressions.mjs` with retained R11 as its
sibling. It passes 31,479 assertions, including 25,704 exact-field body samples.
It rejects an unlisted KCC primitive change and preserves all old object IDs.
It also guards the lowrise source/retained seed instances and archetypes, exact
levels, outline, core/hole, column and beam geometry and aperture geometry
(numerical comparison tolerance 1e-9).

The former lowrise entrance was checked separately through the complete existing
model: 18,216 samples over a 0.50 m wide, 1.85 m high central envelope spanning
0.50 m outside to 0.65 m inside the doorway had no collision. Its authored opening
is 1.0 × 2.1 m. The screenshot did not justify changing those dimensions; the
retained and complete wall systems did not block that central passage.

Independent audit scripts and before/after sampled component reports are under
the workspace's audit-space-r12 folder. This report does not assert that all KCC
platform/recess/vertical circulation unknowns are solved.
