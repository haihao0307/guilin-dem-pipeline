# R04 construction and matter audit

This is a candidate implementation audit, not a visual quality certificate.

## Actual construction path

`stationDomain → join(component, world position, nominal distance, material family, source frame, seed) → evaluateStationMatter → union`.

Matter is evaluated before the union selects the nearest component. This fixes a real earlier weakness: selecting a nominal box first, then displacing only that selected box could miss a neighbouring coating. Each `HitField` retains the nominal `baseD`, material family, metric frame and seed. Shading reuses that same record and the same `evaluateStationMatter` function, with only the declared pixel footprint changing. Normals query the same final distance field. No second coplanar shell is drawn.

`resolveStationState` is the single authored age, wetness and repair resolver. The state is not measured history. Original material functions are not rewritten to claim that they already contained station construction or calibrated ageing.

## Construction-specific bindings

- Brick walls: solid hall/tower wall sections and true opening subtraction carry explicit front/return axes. The R3.12 individual brick distance and original material field share the same metric cell, seed and variation. The original material pit height plus the common retained age/wetness drives bounded section loss; its amount also controls local tone/roughness. This is a new station erosion bridge, not a recovered original erosion simulation. The wall core is still a continuous structural recipe: interior brick-to-mortar volumetric interfaces and individually bonded arch voussoirs are not claimed.
- Iron: thin barrel shell, separated truss members, cast fluted columns, rail heads and brackets retain different physical thicknesses in their construction functions. The same FH88-derived corrosion field gives section loss, colour and roughness. Roof intersection acceleration excludes only a proved non-intersecting outer cylinder; it retains other barrels, chords, columns and rails.
- Timber: 38–96 mm slats, real gaps, axial grain frames and end cuts are construction inputs. The source macro-displacement and original surface channels receive one `stationWoodParams` result. End classification is shared; platform-bench normals use the same axis permutation as grain coordinates. Source micro-height is a PBR-normal term, explicitly separate from source macro geometry. The benches have been moved halfway between column stations to remove the actual pillar/seat collision seen in the previous GPU image.
- Platform: the ordinary deck is bound to the existing KST1 concrete branch, with its original aggregate/chip height now entering the physical distance and the same chip field entering colour. The mineral coping and entrance steps retain STONE_STUDY. A visually prominent veined stone is not spread across the entire platform merely because a stone function was available. The concrete WGSL translation is new and has not yet established cross-backend numeric equivalence.
- Coated architectural trim: a solid mineral core carries a finite 13–20 mm original R3.12 plaster finish. Thickness and coverage come from the original macro field and the same retained age/wetness/repair state. Coverage tending to zero retracts the actual outer distance toward the substrate and reveals the substrate material at that exact boundary. This is one composite-material solid, not two co-located rendered faces. Full material fracture/topological detachment is not implemented.
- Clock and windows: clock paint is authored, not claimed to be a recovered ceramic mother. Tower windows are actual recessed apertures and frames. No fake opaque pane is labelled mature glass; transmission/refraction remains an explicit missing capability.

## Verification gates

Source locks and static tests check the actual imports, absence of scene meshes/appearance textures, physical clearances, shared material evaluation, separate macro/micro channels, domain clipping and source frames. Real WebGPU QA records exterior, hall, platform, tower and bench images from one commit, visible ray exhaustion, and a 192-point age contrast. The point contrast must show both physical field and surface response for each native material family. These tests establish a limited implementation contract, not 3A/photoreal quality.

The 2188851f predecessor produced all five views without exhausted rays, but failed art review because a column pierced a bench, the platform looked like strongly veined decorative stone, and close timber lacked readable grain. It remains rejected and is not a delivery baseline. The new common-matter version requires new GPU images and renewed review.

No reference photograph, external mesh, raster appearance map, per-brick vertex array or copied room scene is shipped. R02 remains unchanged. No public stable preview has been replaced by this candidate.
