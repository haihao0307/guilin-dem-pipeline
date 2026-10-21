# KAOPU elevator mother R02 candidate

Independent successor directory; the user-approved R01 remains unchanged at ../elevator-mother-r01/. R02 is not a manufacturer replica or real safety controller. No teacher code/assets.

## Shared command interface
controls.mjs command(state,action) is used by both sidebar and 3D physical panel picks. Actions: hall {floor,direction}, car {floor}, door {value:open/close}, obstruction. Nearest opaque field owns a ray pick, so a closed landing door cannot be clicked through to a car button. The display is read-only telemetry, not a floor call. Text is projected onto the physical button face; clickable geometry is the field, not an unrelated floating panel. Side controls retain accessible text/buttons. Interior camera deliberately enters the cutaway car, not a virtual transparent door.

## Instance parameters
createLift(floors,instance) accepts speed 0.5–3 m/s, width 2.2–3 m, depth 1.5–2.1 m, ageYears 0–40 and interior 0/1. Defaults preserve R01 values. Speed changes trajectory duration, not lock/door/level guards. Age is an artistic wear input, not measured lifetime prediction. Width/depth scale shared scene coordinates including doorway, panels and shaft; no manufacturer clearance compliance is claimed. Floor table remains 2–7 ordered levels at least 3 m apart with ≥2 served. G/F and B1/B2 are design examples, real-building brand/service data remain unknown. Reconfiguration resets the elevator explicitly.

## Original materials and fields
Same KAOPU R07 building material and material-master-r06/metal-surface.mjs dependency as R01. Master metal full-file SHA256 eb41a40ac4960ec3e2b55bc4637ac4dba641f602d6c1f30909778160b1dc029f. R07 full-file SHA256 18a61c44646f5ff1efb7ca6c79dbf829b8950a4ca69ad3707cd6e181f53d3c7c. Existing field function algebra is unchanged; dry wear/history are driven by the artistic age setting. Experimental stainless roughness increases mildly with age. Paint uses the full own master field, not a flat recolor. Rectangular studio light is an analytic approximation, not measured IBL/alloy data. All model geometry is analytic field descriptors; no GLB/model mesh/third-party textures.

## Validation boundaries
Tests include inherited R01 invariants and new shared-command equivalence, nearest-field occlusion, variable-speed bound and resized panel/car alignment. Browser checks must run in standard isolated Actions, not a restricted local listener workaround. Real render screenshots and physical canvas clicks are required before release. Mobile viewport/touch emulation is not device hardware. Software rendering can be slower than wall clock; RAF movement is not proof of full speed. Thin diagonal joints can alias. This candidate has not yet completed visual acceptance.
