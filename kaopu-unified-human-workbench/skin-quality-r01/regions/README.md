# R02 special-region response, additive candidate

Pinned source: ET13 `2702e9482cfd1655411bb0920929872669301334`; sampling R01 `9289ec5075e2600ff5aed5d6c159995b1032d09e`. Remote collaboration checked 2026-10-10: PR192 unchanged; PR197 `772908914d9a7ac096c9ea58bc013bbc73d5c6e6` adds generic close-up controls on top of R01. This folder does not overwrite PR197, the native preview, new face controls, geometry, or any previous source.

## Actual implementation

- Original native sinusoidal lip groove receives an analytic Gaussian pixel-footprint filter. No new wrinkle marks or random defects. Exact pixel-box reconstruction is not claimed. Unlike R01's pore filtering, this targets the host lip groove that remained point-sampled.
- Reuses native lip contour coverage to distinguish vermilion core and its transition boundary. Dryness broadens roughness and reduces the inherited clearcoat; border fade keeps the outer transition less uniformly coated. Color and lip-color parameters are unchanged. This is a material transition, not an added anatomical white roll or wet oral mucosa geometry.
- Original orbital semantic field controls scan microheight and pore amplitude independently of identity wrinkles/scars, and provides a bounded roughness offset. This field is a periorbital proxy, not a measured thickness map or a new scattering model.
- Original barycentric alar landmarks 31/35 restrict a small oil-film contribution, also gated by native nose/skin coverage and original oil master. The 4.5/5.5 mm radii are conservative artistic authoring scales, not biological measurements.
- New settings are a namespaced sidecar in the native full-person archive. Invalid settings are rejected before native restore; older archives opt out. No textures, extra models, animation loops or restricted assets are added.

## Integration contract

`installRegionalSkin(model)` once, then `attachRegionalSkin(viewer.skin, api)` for the current skin. Later native `faceSurface.attachSkin` calls are wrapped. `mountRegionalControls(api)` adds five controls, filtering and A/B toggles into the existing native control shell. These imports are opt-in; the original preview is byte-identical and no production entry imports this candidate.

The sampling module may attach before this module. All compile modes provide the complete uniform superset; cache keys include enabled state. Disabling regions compiles the unchanged preceding shader rather than approximating a rollback through zero values. `api.inspect(true)` temporarily visualizes regional masks on the actual native surface.

PR196 eye ownership: this module does not replace `fEyeColor`, lights chunks, `vec3 fDiffuse`, corneal optics or eye geometry. Material gate is native skin-only. Shader composition with eye R02 still requires a combined browser test before production integration.

PR197 overlap: its general hydration/nose roughness/oil and this module's local alar adjustment can stack, so integration should explicitly choose/tune one regional authority. Its new lip grain is not filtered by this module; only the original host lip groove is. Strict shader anchors fail on unexpected host changes. Source-level composition is tested where available; this is not full visual co-approval of both branches.

## Verification and honest boundary

Run `tests/regions.mjs`, then `tests/regions-browser.cjs` against the unchanged original ET13 preview. The browser dynamically attaches this module to the existing model and captures strict same-camera/same-light A/B at face, nose, mouth and oblique views under neutral and grazing lights. It checks actual panel controls, excluded eye/teeth regions, retained face archive and geometry, exact repeated rollback, complete archive round-trip and old-archive behavior. Existing R01's 25-check suite also runs unchanged.

CI results and inspected screenshots must accompany any acceptance. Functional checks and pixel changes do not certify more realistic skin. Texture repetition, tangential stretch, real wet/dry lip anatomy, thickness-aware transmission, dynamic tissue tension, full-body consistency and physical-device performance remain open.
