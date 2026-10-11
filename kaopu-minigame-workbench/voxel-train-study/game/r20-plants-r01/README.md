# Flying Hongkonger 88 — existing train game integration

This directory remains the existing game entry. Its current A4 changes are an unpublished candidate pending final actual WebGL and native save/load UI acceptance. The prior public R20 plant game is preserved in Git tree `bd0d61c6cd69b785846e1cd80e006aee1291b4a9`; its original notes are in README-R20-PLANTS-LEGACY.md. R19, R20 and the R04 driving demonstrator are not overwritten by this candidate.

## Native train

The retained self-contained learned A4 functions supply the body and original wheel/rim/hub/spoke hierarchy. Circular wheels are calibrated separately from the body envelope. The two existing metre-scale passenger coaches, their doors and passengers remain attached. No source teacher mesh, GLB, user-reference raster or raster branding is included.

The adopted A4 references are 21.65m over buffers, 2.7432m width, 3.9878m height above rail, 2.032m driving wheels, 10.8966m locomotive axle span and 4.8768m tender axle span. The source functional shell is envelope-calibrated, not a surveyed 60009 replica. Standard-gauge wheel apertures are generated in that retained shell. The three-cylinder, 120-degree parallel drive is the 88 design, not a certified reconstruction of the historical A4 inner-cylinder valve gear.

Session owns one 30Hz game clock and four 120Hz DrivingPhysics substeps per tick. Train translation, wheel angle, rods, thermal ledger, coach wheels and deterministic input replay use that same state. Mass, drag and thermal values are explicit game-design assumptions. Tests are engineering regressions, not certification of a real steam locomotive.

Brand geometry follows the supplied wordmark, left/right angel C, original 88 and company-plaque contours. Both train sides and the last coach end use native geometry. Gold/red/enamel materials replace image illumination; exact raster lighting and grain are not reproduced. Runtime static batching changes submission only; the generating functions remain authoritative.

## Controls and saving

Driving, stopping, passenger service, reverse recovery, pause and replay remain in the existing game. Photography controls pause the same simulation and fold the instruments; returning restores driving controls. They do not hide the city, plants or track. The normal-lens left/right full views are intended for open track; buildings may obstruct the opposite side at stations. QA drives through the second real passenger stop before taking the side photographs. New poses still require actual image review.

The settings panel saves and opens a real SQLite `.KaoPu` envelope with header/records/links/fields/assets tables. Profile `kaopu.fh88-game-session/1-experimental` pins the train/session source rules, appearance/physics parameters and recorded commands, then verifies exact Session signature, physical and thermal state on replay. It is a version-specific game-session profile, not claimed compatible with every KAOPU editor. UI restoration deliberately remains paused. It does not save arbitrary scene edits or a general-purpose 3D editor document.

After train/session runtime edits, run `python codec/build-template.py`, then the save/model/physics tests. Actual UI and module-byte verification use tests/a4-session-browser.cjs in the approved CI environment. A software Chromium mobile viewport is not a physical phone test. The final revision has not yet passed actual WebGL/UI acceptance and must not be represented as publicly delivered.
