# Farmland Mother R045.16 — coupled catchment hierarchy

Status: numerically accepted, browser gate accepted, visual acceptance still locked.

Verified implementation commit: `c0697b9e9e71f06e1876c52e055b21ca46ff49cb`
Runner evidence commit: `d77c7354c81d82c84980791bed3bcd0d275d4d55`
QA workflow run: `35273257830`

## Logic corrected before implementation

A false premise would be: if the channel incision, head hollows, basin shoulders, and foothill outlet aprons are each individually stronger, the slope will automatically read as one coherent catchment. That does not follow. Independent procedural layers can remain visually unrelated and produce embossed bands or repeated troughs even when each local layer is numerically valid.

R045.16 therefore adds one broad longitudinal basin hierarchy tied to the inherited A/B/C trunk carriers. It couples source amphitheatre, convergence shoulder and transport-reach context without changing the inherited water graph or asserting active flow. No random terrain wash was added.

## Inputs re-read this round

- latest `restart/farmland-object-dna-v020-20260907` branch and R045.15 kernel/QA;
- Xiaoma/TLO DEM intake boundary: 12.5 m macro DEM cannot supply field-scale bund/channel/control-elevation or centimetre water truth;
- MrRolord study: river/drainage hierarchy and distance fields precede terrain, land-use and decoration;
- user terrace reference photographs: used only for broad hierarchy, contour continuity and non-clone nesting; no terrace width, riser height, channel section or flow value was measured from them.

## Substantive implementation

`r045_round16_kernel.mjs` adds three distinct carrier-tied `catchmentHierarchyProfiles` for A/B/C. Each profile has different source/transport offsets, widths, amplitudes, left-right bias and longitudinal phase. The resulting field:

- enters gradually below the rear ridge and exits before the inherited lower foothill/plain field dominates;
- protects the complete inherited drainage skeleton exactly near its axes;
- distributes broad unequal shoulders onto the interfluves rather than deepening drainage lines;
- varies source, convergence and transport response along each trunk;
- preserves R045.15 outlet/plain carriers and the receiver river;
- leaves terrace, parcel and water-state gates locked.

## Failed iterations retained

The first R045.16 runner attempt failed the longitudinal-step gate: the source-side hierarchy envelope entered over only about 18 m, creating a new artificial shoulder near `x=-115, z=-208`. Maximum hierarchy-delta change was `0.437879 m / 4 m` against a `<0.22 m / 4 m` gate.

The second attempt widened source entry and lower exit. The failure moved to `x=-65, z=-96`, with `0.293210 m / 4 m`. This exposed a second cause: an oblique inherited tributary crossed the broad shoulder through a protection transition that was still too narrow.

The QA threshold was not relaxed. The final implementation widens the source entry to 46 m, lower fade to 42 m, and drainage-axis-to-interfluve transition to 44 m. The final maximum hierarchy-delta change is `0.185105 m / 4 m`, below the original `<0.22` gate.

## Final numerical QA

Result: **27/27 passed**.

Key final measurements:

- hierarchy delta max: `1.216964 m`;
- hierarchy delta mean absolute response: `0.073142 m` across 3,404 sampled points;
- maximum hierarchy-delta longitudinal change: `0.185105 m / 4 m`;
- persistent cross-slope wall fraction: `0`, with 1,894 eligible samples across 82 rows;
- maximum candidate-slope forward reversal: `0.497577 m / 4 m`, below the unchanged `0.55 m / 4 m` gate;
- terrace permission within the near-drainage sample remains `0`;
- far-from-drainage terrace-candidate permission mean remains `0.725687`;
- inherited graph remains 22 nodes / 55 edges;
- rear-ridge controls, lower R045.15 foothill/plain controls and receiver-river samples remain unchanged by the R045.16 hierarchy field.

The A/B/C sampled shoulder signatures remain distinct; the field is not three copies of one profile.

## Browser gate

GitHub Runner used `/usr/bin/google-chrome` to load the fixed-view audit page over local HTTP. Screenshot, DOM dump and ready-marker checks all passed. Final screenshot size: `528090` bytes. Natural-stream overlay is OFF; only the receiver river is retained as a spatial reference.

This validates the browser/audit path. It does **not** validate any public HTTPS deployment, so no public workbench URL is released in this round.

## Fixed-camera visual review

The final R045.15/R045.16 A/B screenshot was opened and inspected after the successful runner.

R045.16 does create a real broad-scale change rather than just stronger painted drainage: low-relief basin shoulders are more legible through the middle and right agricultural slope, and the three carrier contexts differ rather than repeating one identical cross-section.

Visual acceptance nevertheless remains **false**. The change is still too subtle at whole-scene scale. The middle agricultural slope remains dominated by a large smooth sheet with several elongated, approximately parallel depressions/shoulders. The source hollows, convergence shoulders and interfluves do not yet form sufficiently strong nested basin volumes. The rear skyline still has a repeated procedural lobe rhythm. The lower plain is still over-broad and visually under-structured, and the three outlets do not yet read strongly enough as one causal transition into the receiver corridor. These are macro-geometry issues and must not be hidden with terrace stripes, materials or vegetation.

The audit mesh grid visible in the screenshot is a review-renderer aid and is not counted as a terrain defect.

## Evidence boundary / real-world constraints

The current system still lacks target-site field microtopography, measured terrace/bund/channel cross-sections, water-control elevations, soil/sediment mechanical properties and time-varying discharge. Therefore the 46 m / 42 m / 44 m transition distances and all metre-scale morphology values in this round are synthetic generator parameters, not surveyed Yunnan dimensions or engineering truth.

Current locks remain:

- `visualAcceptance=false`
- `terraceGeometryEnabled=false`
- `parcelGenerationEnabled=false`
- `terracePilotPreviewEnabled=false`
- `waterStateKnown=false`

## Next highest-value defect

The next round should stay in macro terrain + hierarchical drainage. The highest-value defect is not channel detail. It is the weak basin-scale relief hierarchy: the interfluves and source/convergence volumes need to become more legible and less parallel while the verified drainage protection and longitudinal continuity are preserved. Only after that fixed-view gate reads as a causal one-sided catchment should a new bench+riser terrace pilot be created from scratch.
