# R05 — proposed door, guards and bounded three-floor relations

This independent learning case retains the measured Kowloon building batch and the immutable r03/r04 checkpoints. Open `../r05.html`. The original default entry still opens r03. Design additions default to inactive; the three-floor inspection buttons explicitly enable the proposed assembly and hide, not erase, the measured shell.

## What is real source evidence

The host is the existing CSDI/Lands Department exterior reconstruction B359971994401063C0, at approximately 22.318490810, 114.174319887. Its building name, use, historical phase and interior are unknown. It is not identified as the Peninsula Hotel. Original per-patch vertex/normal arrays are restored exactly on reset. Floors, stairs, partitions, doors, guards, finishes and dimensions below are editable author proposals, not inferred survey facts.

## Relationships implemented

- Existing thick concave-footprint floor slabs and reserved service holes are preserved. Only floor-001 → floor-002 → floor-003 are connected by two closed dogleg stair assemblies. Exactly two additional openings are hosted individually by slab-002 and slab-003.
- Both assemblies use one retained slab-002 landing. No duplicate coplanar landing mesh is created. An explicit transfer edge joins the arrival lane to the departure lane; it is not an enabled game navigation/evacuation claim.
- A clearly labelled proposed partition is supported at floor-002 FFL. Three closed wall pieces leave a genuine doorway; fixed frame, pivoting leaf, visible simplified hinges and handles remain distinct. Entry/service/room are manual function annotations, not dimensional standards or evidence of actual use.
- Stair, mid-platform and opening-boundary guard runs have support contact records. Separate handrails follow the flights. Stair mouths, the shared transfer lane and doorway stay clear. Posts are deduplicated and unused departure edges close if the upper pair is disabled.
- Parameters regenerate openings, steps, slab hosts, guards and door FFL together. Full proposed geometry is prepared and validated before replacing the last valid scene. Visibility is display-only; disabling an assembly suppresses dependent geometry and reverses its owned openings.

## Bounded geometry evidence

Default proposal: 3.2 m floor spacing, 0.20 m slab thickness, 1.20 m gross flight width, 0.28 m tread depth, 0.16 m riser. Two groups provide 40 rises. Minimum analytic stacked headroom is 2.84 m, with sampled mesh rays approximately 2.84008 m. Guards reduce the actual clear passage to 1.08 m. These are authored test values, not a statement of Hong Kong compliance.

CPU tests inspect real generated BufferGeometry: support rays, closed solids, final-riser face contact, retained landing support, the fixed same-basis stair stacks' separated geometry bounds, full-patch headroom bounds, and sampled headroom rays. Guard checks use each actual rendered bottom cap, only its named host, 1 mm support rays, upward face normals and actual top-surface perimeter extraction. Every complete cap must fit within the surface boundary, including openings, with nonnegative radius clearance. Deliberately lifted, inverted-face and overhanging examples are rejected. Default minimum designed retained margin is 10 mm. Triangle tests separately reject walking-surface penetration. Door checks include its fixed partition/frame and 101 sampled moving-leaf/handle poses over 0–100 degrees against actual slab/stair/guard meshes; intentionally introduced intermediate obstructions must fail even when endpoints are clear. A one-degree sampled sweep is not an exact continuous collision proof. A separate doorway audit uses complete swept rectangular prisms (0.70 m square footprint × 1.90 m high), actual mesh triangles, whole-footprint slab containment and support rays through the doorway and onto both shared-platform lanes. At 90°/100° either hinge side clears this bounded volume; at 0°/45° the door leaf blocks it. The route turns before the real center-gap guard rather than pretending that rail is absent. This is not enabled navigation or egress approval.

`tests/interior-browser.py` checks actual Chromium WebGL render, live UI edits and rejection, dependency suppression, exact baseline reset, window regression, mobile view and served asset SHA-256. Candidate test code does not itself prove a pass; use the linked Actions run and its results artifact for executed status. Software ANGLE/SwiftShader rendering is not a physical-device GPU performance measurement.

## Material and learning provenance

- Reuses the existing authored `hk-three-buildings-r01/viewer/materials.mjs` and original KAOPU GLSL material mothers, with metre-scaled positions and painted windows disabled. Concrete/plaster assignment is a proposal, not calibrated building finish evidence. Existing sibling material provenance and licences remain unchanged.
- Own original relationship and mesh code. No external building mesh, restricted reference photo, teacher image or copied implementation is included.
- [IfcOpenShell feature / host openings](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/feature/add_feature/index.html) and [geometry creation](https://docs.ifcopenshell.org/ifcopenshell-python/geometry_creation.html).
- [FreeCAD ArchWindow](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/BIM/ArchWindow.py) and [ArchStairs](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/BIM/ArchStairs.py) were relationship/algorithm references, not copied source. Their LGPL/GPL terms are not relabelled as our own.
- [IFC storeys](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcBuildingStorey.htm) and [openings](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcOpeningElement.htm) inform the separate floor/slab/one-host-opening semantics. Our JSON is a project schema, not native IFC.

## Deliberate limits and rollback

Not measured interiors, complete BIM, construction design, load-bearing verification, full guard infill, fire/accessibility approval, certified headroom, ground entrance, elevator equipment or complete navigable building. Floors004+ are not blindly given copied staircases. The service shaft is still a reserved void/interface, not a lift.

Rollback is simply return to `../r04.html` or the unchanged r03 root entry. No old path is overwritten, no PR is merged and no history is rewritten. This r05 directory is independently removable in a later ordinary scoped commit if explicitly requested.
