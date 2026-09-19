# Farmland Mother R045.14 — verified round record

## Scope actually changed

R045.14 does one substantive macro-terrain job on top of R045.13: it adds broad, deterministic, asymmetric catchment-shoulder mass around the A/B/C second-order trunk catchments. It does **not** deepen the channel slots, add free noise, generate terraces/parcels, infer active flow, or claim a surveyed Yunnan cross-section.

The change is intentionally at catchment/interfluve scale. A/B/C use different shoulder amplitudes, offsets, widths, left/right biases, and slow longitudinal phases. The inherited drainage graph, terrain-channel inventory, rear crest controls and front receiver river are preserved.

## Logic correction made during the round

The first R045.14 attempt exposed two errors rather than being accepted:

1. Protecting only the three trunk axes was insufficient. Tributaries/gullies were still being altered by the broad shoulder field. The final kernel protects the **full inherited drainage network** using `nearestExtendedDrainageDistance`.
2. A narrow 10–20 m drainage exclusion blend produced a new longitudinal step where a tributary crossed the shoulder field. The final kernel widens that deterministic transition to 10–42 m instead of relaxing the QA limit.

The first attempt also had excessive global mean relief (~0.424 m absolute mean); basin amplitudes were reduced before acceptance. These are implementation failures retained as part of the round history, not hidden by threshold changes.

## Final verified numeric result

GitHub Actions run `35260733979`, tested code SHA `5fa131503e4ee0c58f49905ddd4ab7308c6b5557`.

- Numeric QA: **25 / 25 passed**.
- Water graph: 22 nodes / 55 edges preserved.
- Terrain carriers: 12 channels / 3 outlets preserved.
- Basin shoulder relief: max ~1.06788 m; absolute mean ~0.08566 m.
- Full drainage-axis protection: max and mean R045.14 delta are 0 inside the sampled <9 m drainage band.
- Broad shoulder response mean (22–72 m from drainage): ~0.24977 m; far response sampled by the gate: 0.
- A/B/C fixed cross-slope asymmetry differences at z=-112: ~0.18422 / 0.15013 / 0.01904 m; signatures are not clones.
- Max shoulder-field longitudinal change: ~0.17604 m per 4 m, below the 0.22 m gate.
- R045.13 wall repair remains intact; z=-174 has zero threshold failures and max sampled forward rise ~0.18418 m / 4 m.
- Candidate agricultural slope max sampled forward reversal: ~0.48305 m / 4 m, below 0.55 m gate.
- Rear crest controls: zero sampled change.
- Front receiver controls: zero sampled change.
- Terrace permission near drainage: mean 0.
- Future terrace candidates away from drainage remain available: mean ~0.76041, while terrace geometry remains locked.

## Browser and fixed-view review

The same GitHub Actions run completed the actual Chrome gate successfully:

- screenshot status 0
- DOM status 0
- ready-marker status 0
- fixed-view screenshot generated: 507,376 bytes

The A/B audit disables the natural-stream overlay so the terrain cannot rely on blue channel lines to communicate catchment structure; only the front receiver river is retained as a spatial reference.

### Visual decision

**Not accepted yet.** R045.14 is a real improvement in basin-scale organization: the middle slope has broader unequal shoulders and the A/B/C catchments are less dependent on narrow parallel slots. However, the fixed camera still shows a slope that is too smooth at whole-scene scale; the rear ridge remains procedurally rhythmic; the basin shoulders remain weaker than the desired source-hollow → convergence-shoulder → transport-valley hierarchy; and the foothill/plain/receiver relationship is still too simple.

Therefore the visual gate remains closed and no terrace bench/riser generation is unlocked in this round.

## Locked state / evidence boundary

- `visualAcceptance = false`
- `terraceGeometryEnabled = false`
- `parcelGenerationEnabled = false`
- `terracePilotPreviewEnabled = false`
- `waterStateKnown = false`

The 12.5 m macro terrain source cannot supply field-scale truth for bund cross-sections, canal sections, control elevations, centimetre water depths, ownership, or measured local terrace dimensions. R045.14 parameters remain synthetic generation parameters, not surveyed Yunnan measurements.

## Next unresolved macro gap

The next highest-impact gap is not “more channel detail.” It is the coupling of the three basin shoulders to explicit source hollows, unequal divides and convergence shoulders, followed by a continuous foothill-to-plain outlet transition. Terrace construction should remain blocked until the fixed view reads as a natural one-sided catchment slope with the stream overlay disabled.
