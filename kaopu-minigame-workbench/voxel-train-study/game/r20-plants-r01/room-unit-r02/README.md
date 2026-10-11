# One original-source dwelling, R02 inspection candidate

This candidate replaces none of the rejected V1 production code. It is an incomplete inspection unit, not a finished residential asset or a visually accepted benchmark. Nothing in this directory creates a renderer, camera, animation loop, or separate application.

## What actually generates the room

- Walls: the original Brick Mother R3.12 fired-brick and continuous core fields, material functions and source lighting. The revised candidate switches off the plaster specimen and layer-reveal demonstrations; a neutral core is recessed 18 mm with 2 mm original-field relief. This is an exposed-brick parameter candidate. Original shader bodies are preserved in `r312-wall/original-shaders.mjs`. The adapter adds rigid coordinates, real opening CSG, camera/depth binding and explicitly selected controller binding mode.
- Wood: the Library historical-building workbench v3 original geometry, stock coordinate field, `woodSignals`, material parameters and GLSL. Every floor/roof plank, door frame/leaf, window frame and wooden furnishing invokes `createTimberMember`; no replacement wood shader is used.
- Native container: a real SQLite `.KaoPu` stores an inert bounded room recipe and pins the trusted local generation dependencies. It does not carry mesh or image payloads or execute code from the file.
- Host: `mountNativeDwelling({THREE, scene, position, yaw})` uses the existing game scene and renderer. Call `room.update(authoritativeSeconds)` from the existing world clock. Door and cutaway controls are `setDoorOpen(bool)` and `setInspectionCutaway(bool)`.

## Source binding and GPU evidence

Original timber v3 versus the unchanged-core Three binding: actual GPU comparisons of the dark, light-weathered and warm-medium source presets reported zero pixel difference at their matched test cameras and original lighting. These results establish transfer fidelity, not artistic acceptance of every original preset.

R3.12 original raw controller versus `legacy` adapter with no opening: the prior 600 × 450 GPU comparison reported mean RGB error 0.000793 / 255 and 15 pixels differing by more than 2. It preserved the original controller's mistaken scalar array uploads. `declared` is a separately identified correction: all five declared layer arrays are supplied properly, rather than reproducing those source bugs. New room recipes use `declared`.

The original fixed material lighting and tone/gamma are retained. Host dynamic lighting, shadow-depth and physics collision integration are still pending. Proxy triangle counts do not describe SDF fragment cost.

## Room and access

The first recipe retains the wall source's fixed 4 m span and uses rigid transforms only. The room has four walls, an opening doorway with working timber leaf, a real window opening, wooden floor/roof, bed frame, table and shelf. Door access and inspection visibility are explicit controls. The conservative local domain is x/z ±2.4 m, y −0.13 to 3.2 m; this is not a final collision mesh or route-clearance certification.

## Deliberate gaps

No approved image-free metal/cage material has yet been bound. No garment is inserted: the actual tailor-source hanging trials retained panels/materials but failed self-intersection and strain checks. There is no invented T-shirt substitute, mattress or replacement cloth. Shared kitchen/toilet connections and game walking collision remain incomplete.

## Publication

Keep this unit opt-in and visibly marked as under inspection until the complete GPU/visual and live-host checks pass. The rejected V1 must not be loaded as a fallback. Main game `app/world/train/session` changes belong to the train integrator; this module is a separate incremental closure.
