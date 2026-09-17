# Palau V0.1.6.0: reef/island/mobile review candidate

User direction: recover the approved ocean's appeal and clouds; build Palau-like forested limestone islands with reef flats, sand and channels; improve mobile UI and make fishing discoverable. AAA visual quality is a target, NOT an acceptance status.

## Preserved baseline

Parent game head: `71f3b55615b5a3d7bf67de914ca6b074d7e28cd7` (V0.1.5.0).
Work branch: `work/survivor-palau-v0160-reef-islands-20260917`.
V0.1.4.1, V0.1.5.0 and Ocean Mother frozen releases are not overwritten. No changes to main or other Mother branches. `source/v0160/build.py` produces `releases/v0.1.6.0/index.html` from the existing V0150 release plus three readable modules.

## Reliable reference boundaries

UNESCO, Rock Islands Southern Lagoon: https://whc.unesco.org/en/list/1386/
Supports forested limestone islands, dome/mushroom forms, barrier/fringing reef context and channels. Does not provide our exact island coordinates, height, shoreline or bathymetry.

UNESCO, Yapese Disk Money Regional Sites: https://whc.unesco.org/en/tentativelists/1994/
Supports the relation between Yapese stone money and limestone quarrying in Palau. Our three ringed disks are illustrative forms; they are not scans, exact replicas or evidence for the location of any particular artifact. No historical money economy is implemented.

NOAA reef formation: https://oceanservice.noaa.gov/education/tutorial_corals/coral04_reefs.html
General reef morphology reference, not a Palau survey.

Landscape Mother inspected at `a3511d671659f6f00e816b248fb5870d31028050`:
- `workbenches/landscape-mother-v012/build_scene.py`: adapted the periodic angular harmonics and localized solution-channel method from `tower_field`.
- `handoffs/landscape-mother/research-20260903-karst-identity-r014/KARST_GENERATION_CONTRACT_R014.json`: macro shape/topology, metric identity and material-role discipline.
- `workbenches/landscape-function/karst_living_r1.js`: explicitly read-only process tracer, NOT an island geometry generator. Not misrepresented as an imported R5 mesh.

Our Palau dome crown, sea-level undercut, forest placement and reef banks are new procedural design expressions. No accepted R5 SDF was transplanted. Current T03 rock-face material work is not treated as Palau geographic truth.

## Actual implementation

Ten islands in one continuous approximately 1.12 km construction domain, sea extending beyond it. Adjacent open-water gaps are designed at roughly 100–200 m; the approximate radius-based nearest-gap calculation is 139–173 m, not a surveyed distance. Island geometry uses a sea-level base instead of being sunk by deep seabed height. Whole surfaces are generated in code and periodic seams are checked numerically.

Reef flat, slope, sand patch and deeper passage elevations are sampled from a shared cached field by CPU and water shader. Coral geometry is a low-detail plate/lobe/branch proxy, not confirmed species or an ecological model. No imported models, image textures or external CDN dependency.

Ocean shading is extended past the old 105–225 m simplified-color handoff. Shallow bottom color and deep absorption have been adjusted. This is a visual candidate, not a claim of exact recovery of the original approved ocean image.

Clouds use a directional procedural shader with clear-sky gaps; they are not volumetric clouds. Realistic island reflections and higher-quality vegetation remain unfinished.

Player UI: out to sea, fishing and exploration. Existing diagnostic controls remain behind a menu. Fishing is a frame-driven cast/wait/bite/hook/hold-and-release-reel/catch sequence, with cancellation and pause guards. The catch is a generic fish and counter; persistent inventory, animated fish shoals, cooking, survival, patrols and rescue are not yet integrated.

## Acceptance

- [x] Production source modified; no generated image substitutes.
- [x] Intended deliverable is an interactive real-time 3D runtime.
- [x] The original release remains available for comparison/rollback.
- [ ] Consult current `BROWSER_QA.json` for real browser results; numeric tests alone do not establish rendering quality.
- [ ] Only share the fixed public URL when `PUBLICATION_PROOF.json` reports `shareAllowed=true` after HTTP byte identity and actual browser interaction checks.
- [ ] Visual acceptance remains pending user review; screenshots are internal evidence, not the game deliverable.
- [ ] Physical iPhone/Safari sustained frame pacing and thermal behavior are untested. SwiftShader desktop results must not be represented as mobile device FPS.

Next quality gate: compare normal-quality overview, sea-level approach, reef-water transparency, recognizable cloud masses, island silhouette and limestone/forest transition. Do not increase content count to conceal a weak visual foundation.
