# R040: bilateral clavicle, continuous native-weight coverage

This expands only the R039 medial-coverage engineering anchor accepted in review. It does not complete whole-body bony thinness, add ribs, change existing identities, or certify anatomical landmark locations.

## Geometry and parameter mapping
Same adult age, sex, height, muscle and identity at all samples. The normalized artistic slider maps native Anny weight as .015 + .985a. Existing native morphs supply changing body volume. No uniform scaling, scan mesh, new face warp or extra adipose extrapolation is added.

The left provisional curve is the fixed R039 triangle/barycentric template. Its right counterpart was projected onto actual mirrored-side triangles once on the same native adult; maximum mirror-to-surface distance was 0.105 mm. Every state then recomputes curve positions and normals from its own native neutral geometry. This proves surface correspondence, not the anatomical accuracy of an SC/AC joint center. Anatomical location uncertainty remains Unknown.

A shared full-CSR visual layer uses the accepted one-level conforming subdivision. Its canonical vertex-index selection is frozen rather than coordinate-selected at every fat level, keeping indexed display topology identical throughout the slider. Canonical 25,417 vertices / 50,624 triangles remain untouched. Display 30,112 / 60,014.

The complete added clavicle relief, including its local coverage hollow, is attenuated by 1-(6a^5-15a^4+10a^3). The value and its first two derivatives join smoothly at 0 and 1. This is an original artistic coverage law, not a BMI or measured skin-fat thickness. Fat endpoint has exactly zero added height. Float32 midpoint representation still differs from ideal double-precision interpolation by at most 0.000034 mm.

## Local 21-sample sweep
All 21 native-weight states: zero reversed display triangles, byte-unchanged current canonical geometry, stable indexed topology SHA 9587a2fe62fc520db0bc3c705f153706ba70894d7ae3b61dcf0f1df12ffad5a5.
Representative actual added display deviations: 4.579 mm at a=0; 4.096 at .25; 2.280 at .5; .472 at .75; only Float32 interpolation rounding at 1. The native body's own large morph change is separate from this added-display deviation.

## Collision contract
Use current posed display positions and this display's indexed triangles, not old canonical triangles. Snapshot includes previous/current arrays, previous-valid flag, local metres and explicit anatomical axes, full skin-matrix fingerprint, display topology/geometry fingerprints, recipe fingerprint, actual current deviation and a body-only exterior mask. A recipe now includes the complete immutable template and a. Morph changes rebuild the visual layer, invalidate previous-frame history and change its recipe fingerprint. Old Jolt certificates do not cover this layer.

Full state is exported alongside snapshots by browser QA. GNM head exterior is not included in the body's exterior mask. Source curves and adult shape must not be silently applied to children; runtime guards reject ages below the adult pilot boundary.

## References
BodyParts3D, © The Database Center for Life Science, CC BY 4.0: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
Same-version measured relation: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
Observed shoulder attachment/coverage relations: https://anatomy4sculptors.com/blog/shoulder-bony-landmarks/
No licensed reference preview pixels, mesh or maps are included in this candidate.

## Verified candidate and boundaries
QA run 37901762905: 21 actual views, full state/surface fingerprints. UI run 37902117398: pre-load interactions and exact original-body restoration passed. The original native heavy-end chest underside still has block-like depressions; this module does not repair those areas. All rendering used Chromium/SwiftShader, not a hardware-device claim.
