# Character morphology presets R02

The original unified workbench now has two in-page collections: **特征强化 · 36** and **初版对照 · 36**. The original 36 states and their thumbnail files remain unchanged. Selecting a preset replaces the complete geometry state and preserves the current skin settings; **撤回切换** restores the full person and skin from immediately before the last selection in this page session. Browsing another collection alone does not alter the current person. Saved parameter archives remain compatible.

## Why face-specific parameters were added

In the native source, increasing the global Anny weight phenotype does not substantially widen cheeks or the jaw. That was not a missing connection in the shared head solver. R02 therefore records explicit native head fat, cheek volume, cheekbone contour, head width, chin and neck fields together with the body recipe. It does not use unknown GNM PCA axes, facial expressions as permanent identity, model-wide scaling, a replacement head or a new geometry solver. Native advanced sliders retain their original meanings; no hidden facial automation is added when one scalar is edited.

## Range and child safeguards

Adult shape examples span a wider native weight/muscle range, with distinctly fuller and leaner examples. These are modelling forms, not body-mass or medical measurements. Child examples have their own smaller envelope, rounded cheeks without adult hollow-cheek or bony-jaw fields, and restrained shoulder/chest inputs. Two initially over-tall child forms were brought into a more coherent child head/body relationship by reducing the native stature parameter. Their heads were not arbitrarily enlarged.

Six clearly distinguishable face/build families are combined with native age forms. Adjacent young/adult stages can remain similar; this is not a claim of 36 unrelated identity scans. Real-world age, anatomical ageing wrinkles, scan-level skin and hair are outside this preset revision.

## Evidence

`VISUAL-CHECKLIST.json` records each character's front-face, side-face and whole-body observations and the accepted image hashes, with additional child side-body/native-source comparisons. The first review required eight revisions; the second required two; the third accepted all 36. Numeric screening is auxiliary and was never used instead of inspecting images.

`ACCEPTED-STATES.json` records the exact accepted native recipe and canonical vertex SHA-256 for each R02 preset. `CORE-PRESERVATION.json` records unchanged solver/transfer/skin-core hashes and the byte-identical original catalogue. `FACE-GEOMETRY-SCREENING.json` records geometric checks, not a blanket physiological realism certification.

Previews place actual whole-body and frontal-face browser renders of the same person in separate panels. No AI-generated person imagery is used. The underlying model stays at 25,417 vertices and 50,624 triangles. Existing minimal, skin-r01 and skin-r02 pages, approved head/body linkage, basic skin, locks and unrelated projects remain in place.
