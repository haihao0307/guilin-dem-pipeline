# R10 learned methods and implementation mapping
Checked 2026-10-11; official primary sources only. No closed commercial code copied.

- Houdini localized guide groom / skin attributes / generate / deform separation: https://www.sidefx.com/docs/houdini/fur/workflow.html -> preserved genuine skin triangle+barycentric binding; independent regional density, flow, length, frizz and root taper.
- Houdini skin collision-aware editing: https://www.sidefx.com/docs/houdini/nodes/sop/guidegroom.html -> preserved supported surface walks and lip/eye masks. This does NOT implement VDB collision or Vellum dynamics.
- Blender interpolation and minimum-distance root distribution: https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/hair/generation/interpolate_hair_curves.html -> retained R3 follicular unit roots, added minimum-distance beard roots, retained R9 teacher source island binding.
- MetaHuman regional bangs/top/sides/back/sideburns and region blending: https://dev.epicgames.com/documentation/metahuman/mh-groom-hairstyle-generator -> independent regional controls; continuous short directional field; continuous beard mask union instead of argmax seams.
- Original artist curves: Daniel Bystedt, Blender Hair Styles demo, CC BY-SA, provenance preserved. https://www.blender.org/download/demo-files/

## What changed in code
R3 RefinedHairLayer replaces R9 old scalp only in this directory. R3 extended five-zone facial layer replaces the old two-zone R9 facial layer. R9 TeacherGroomBinding, TeacherGroomEditor and original eyebrow guides remain. R3 optical material and shadow module are shared. The old two directories are byte-for-byte untouched.
The old short field combined opposed front/back vectors and rounded clump cells. Short flow now uses a continuous off-centre crown field, regional downward flow, no rounded cells. R3 side-sweep/swept-back direction and volume are retained except controllable regional length, margins and the ear exclusion adjustment.
The old beard guideMask stopped at an argmax region label, creating clipped internal boundaries. Now guides can cross adjacent valid beard zones while retaining eye/lip and skin constraints. Density/length/width and tangent-plane irregularity are separately controlled.

## Deliberate boundaries
Not a complete reproduction of Houdini, Blender, MetaHuman, Marschner scattering, dynamic hair contacts or biological follicle segmentation. Region masks are calibrated grooming fields on the fixed GNM template, not universal anatomy. 96k is a high-memory near-view setting; 64k and 36k presets are provided, without hardware FPS claims. TEN24 original female asset is not substituted or falsely advertised as loaded. Other animal/fur/shell experiments are reference-only, not layered on a human head.
