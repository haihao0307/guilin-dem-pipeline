# Grand coach candidate r01

New saloon geometry, with original-material transport and retained qualified native wheel mother. Metres; X longitudinal/front+, Y left, Z up at rail head. This is a proposed artistic vehicle, not a certified historical coach reconstruction.

`createGrandCoach(T, matter)` returns `{root, setInterior(bool), setDoors(0..1), details}`. `setInterior(true)` removes the continuous roof and the +Y side wall, glazing, curtains and outer plaques, retaining the complete -Y wall, furniture and chassis. Calls are reversible. Door pivot animation is separate and rejects non-finite input.

Implemented: continuous finite elliptical roof; raised brass body lining and solid Chinese/English route/name/company plaques; window-hole side panels; 16 finite 14 mm glazed side panes; 2 finite window-hole end doors; walnut floor, frames, dado, sofas and tables; 8 sofas with original KAOPU leather physical grain relief; warm table/ceiling lamps; geometrically pleated curtains; open luggage racks; complete 2-bogie structure with 8 retained lathed-profile/flange cast wheels, hubs, axles, journals, springs, discs, calipers and secondary tread shoes; reservoirs, main brake cylinder, battery cabinet, service lines, hoses, buffers, coupling eyes, boarding steps and handrails. Rivets are instanced; repeated primary meshes reuse geometry buffers.

Envelope measured by Three Box3: approximately 23.984 × 3.33 × 4.013 m, including couplers, extended boarding steps and roof beads. The body is approximately 22.55 × 2.83 m. Dimensions are proposals, not source measurements.

CPU checks: finite indexed geometry; 8 wheel objects explicitly report source hub reuse; 16 side panes; repeatable cutaway restore and door state; invalid door value rejected. 1,027 meshes, 531 unique buffers, 595,660 triangles in the tested build. GPU shader compile and visual acceptance are integration-stage checks, not claimed here.

Wheel reference is bundled directly from the existing source path through esbuild; no copy or rewrite of that mother was made. See material notes and provenance JSON for timber/leather/metal lineage.

## Visual review correction r02
The -Y side transport reflected the original extrusion, requiring triangle winding reversal. Every mirrored side skin, brass frame and pane now corrects winding; a dedicated normal-versus-winding test passes for all 52 side extrusions. This prevents the outside green cap being culled and exposing internal walnut. The viewer must inspect from +Y for the specified cutaway. Original source geometry is unchanged.
