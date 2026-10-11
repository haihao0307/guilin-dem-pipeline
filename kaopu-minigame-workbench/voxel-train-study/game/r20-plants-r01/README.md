# Flying Hongkonger 88 — existing train game integration

This directory remains the existing game entry. The native A4 integration passed desktop and portrait-mobile-viewport actual WebGL driving, two real passenger stops, native save/load UI, and exact final input replay in CI run 38110246210 (runtime commit be456f4f10313dc69a5a343ff3795abbb99b5fec). The prior public R20 plant game is preserved in Git tree `bd0d61c6cd69b785846e1cd80e006aee1291b4a9`; a byte-identical runnable archive is at ../r01-pre-a4-40861390/ and its original notes are in README-R20-PLANTS-LEGACY.md. The archive retains the same relative vendor/audio/music dependencies. R19, R20 and the R04 driving demonstrator are not overwritten by this candidate.

## Native train

The retained self-contained learned A4 functions supply the body and original wheel/rim/hub/spoke hierarchy. Circular wheels are calibrated separately from the body envelope. The two existing metre-scale passenger coaches, their doors and passengers remain attached. No source teacher mesh, GLB, user-reference raster or raster branding is included.

The adopted A4 references are 21.421725m over buffers (1935 Silver Link locomotive and depicted tender combination), 2.7432m width, 3.9878m height above rail, 2.032m driving wheels, 10.8966m locomotive axle span and 4.8768m tender axle span. The source functional shell is envelope-calibrated, not a surveyed 60009 replica. Standard-gauge wheel apertures are generated in that retained shell. The three-cylinder, 120-degree parallel drive is the 88 design, not a certified reconstruction of the historical A4 inner-cylinder valve gear.

Session owns one 30Hz game clock and four 120Hz DrivingPhysics substeps per tick. Train translation, wheel angle, rods, thermal ledger, coach wheels and deterministic input replay use that same state. Mass, drag and thermal values are explicit game-design assumptions. Tests are engineering regressions, not certification of a real steam locomotive.

Brand geometry follows the supplied wordmark, left/right angel C, original 88 and company-plaque contours. Both train sides and the last coach end use native geometry. Gold/red/enamel materials replace image illumination; exact raster lighting and grain are not reproduced. Runtime static batching changes submission only; the generating functions remain authoritative.

## Controls and saving

Driving, stopping, passenger service, reverse recovery, pause and replay remain in the existing game. Photography controls pause the same simulation and fold the instruments; returning restores driving controls. They do not hide the city, plants or track. The normal-lens left/right full views are intended for open track; buildings may obstruct the opposite side at stations. QA drives through the second real passenger stop before taking the side photographs. The normal-lens open-track left/right images were reviewed from actual controlled stops near 788m; the mobile whole-side view is necessarily small, and is not evidence that tiny lettering is readable on a phone.

The settings panel saves and opens a real SQLite `.KaoPu` envelope with header/records/links/fields/assets tables. Profile `kaopu.fh88-game-session/2-experimental` pins the train/session source rules, appearance/physics parameters and recorded commands, then verifies exact Session signature, physical and thermal state on replay. It is a version-specific game-session profile, not claimed compatible with every KAOPU editor. UI restoration deliberately remains paused. It does not save arbitrary scene edits or a general-purpose 3D editor document.

After train/session runtime edits, run `python codec/build-template.py`, then the save/model/physics tests. Actual UI and module-byte verification use tests/a4-session-browser.cjs in the approved CI environment. A software Chromium mobile viewport is not a physical phone test. Public delivery is separately checked by train-a4-public-verify.yml against live module bytes and actual start/service/pause interactions in both the current entry and the preserved original. Its result, rather than this document, establishes that Pages has deployed. Full CPU suite: 218 tests, 215 passed, 3 historical-source comparison skips, 0 failed. Room reconstruction and the new Kowloon station are unfinished independent work and are not loaded in this release.

## Running gear correction R02
The earlier thin circular rods and torus wheels were rejected. Current procedural parts use tapered cast spokes, a lathed tread/inner flange, wide recessed-web rods with separate bearing eyes and bushes, middle-axle main drive, crossheads, slidebars, journal shoulders, tread brakes, axleboxes and springs. The 1935 diagram supplies axle spacings and wheel diameters; the 3.35 m main-rod pin span is a drawing estimate, and unannotated sections are visual reconstructions, not manufacturing dimensions. The outside left crank follows the right by 120 degrees under the actual forward rotation sign. The inside horizontal cylinder remains the explicit 88 assembly, not the historical inclined A4 mechanism.

The complete 56E1 rail section is an explicit modern reference, not a claim about 1935 track. Its crown fillets are approximated as documented by wheel-rail-profile.mjs. The current route is straight; no curved-track swept-clearance certification is claimed.

Profile 2 native session files pin the corrected geometry. Profile 1 saves are rejected rather than overriding the new wheel/axle geometry; use the preserved prior release to open prior saves.

Visible wheel-centre references: drivers20 cast spokes (high-confidence photo comparison), bogie10 and Cartazzi10 (operator photographs), and covered tender discs observed on modern60007. Hidden tender construction is unknown and is not fabricated. These appearance references do not make88 a surveyed1935 Silver Link or modern60007 replica. Restricted reference photographs are not shipped.

The two coaches' retained longitudinal sills now sit inside the wheel envelope; transverse members clear the flange crown. Brake shoes remain inside the tread band and stop0.5mm short of the rendered surface at full input. These are geometric clearances in the straight-track game, not structural or braking-system certification.
