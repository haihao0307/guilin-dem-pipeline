# Farmland Mother R045.68 — fixed report

Status: fixed machine-safe candidate; **visualAcceptance=false**. R045.66 remains the accepted visual/profile baseline for comparison; R045.68 is frozen as the connected-residual correction round and does not unlock parcel generation.

## Exact source and evidence provenance

- Authoritative source commit: `884b9f0bf25d2a993999aa1cb25e3d398146a3e3`
- Machine-evidence persistence commit: `a661677f66d25a36adb86d09f9ecfca3631ea1ff`
- QA contract: `R045.68-connected-frozen-proposal-components-v1`
- The workflow binds numeric QA and browser evidence to the exact source SHA and refuses stale persistence if the branch moves before evidence persistence.

An earlier R68 run generated valid numeric/browser artifacts but was intentionally refused at the provenance gate after the branch advanced. That refusal is expected behavior and fixes the R67 evidence-provenance flaw rather than hiding it.

## Logic corrections made in this round

1. R067 showed that `changed-cell count` is not evidence of macro terrace organization: 72 physically changed cells had only 23.6% participation in four-cell-or-longer compatible runs. R068 therefore rejects isolated proposal edits instead of counting them as progress.
2. After applying the predeclared same-family/same-level connected-component gate, the complete connected residual opportunity set contained eight cells. Requiring sixteen changes after that discovery would force unsupported geometry or a relaxed topology rule. The denominator is therefore all accepted connected residual opportunities, while the topology gate itself remains fixed: component size >=4, real physical span >=18 m, 100% of retained changes in compatible 4+ cell runs, at least two families, no recursive seeding.
3. Persisted evidence from a different source/QA contract is not evidence for the current branch. R068 therefore records `source_sha` + `qa_contract`, checks the remote branch has not moved before persistence, and refuses stale evidence.

## Actual geometry change

R068 treats R067 only as a frozen proposal over accepted R066/R047 geometry. On the authoritative 6 m slope lattice it identifies physically material R067-R066 residual cells, then builds an eight-neighbour compatibility graph using inherited terrace family and level identity. Only components with at least four cells and at least 18 m real `hypot()` span survive. Isolated/disconnected proposal cells return exactly to R066.

Between audit-lattice nodes, the implementation interpolates only the already-accepted nodal R067-R066 correction values; it does not recompute fresh off-grid R067 evidence. Queried points reapply inherited mask, <=12 m drainage-core and foreground receiver protection. R068 output never seeds its own graph.

No footprint growth, level movement, global riser raise, drainage bridge, parcel generation, or hydraulic-state claim is introduced.

## Authoritative numeric QA

Final result: **30/30 passed**.

- Active footprint: `548 -> 548`; threshold crossings: `0`
- Three inherited terrace families retained: `95 / 229 / 224`
- Frozen material R067 proposal cells: `43`
- Accepted connected residual cells: `8`
- Rejected sparse/disconnected proposal cells: `35`
- Realized connected residual cells: `8/8` (100%)
- Compatible changed components: `2`, each size `4`
- Physical spans: `18.0 m` and `25.455844 m`
- Connected share: `1.0`
- Changed families: `0` and `2`
- Maximum R068-R066 elevation correction: `0.0072654579 m`
- Maximum local terrace increment at the authoritative changed cells and their +/-3 m probes: `0.7373459918 m / 3 m`, below the unchanged `1.05 m / 3 m` gate
- Unsupported changed cells: `0`
- Inherited inactive support changed: `0`
- Inherited strong support changed: `0`
- <=12 m drainage-core changed: `0`
- Foreground receiving-river protection band changed: `0`
- Outside terrace-support domain changed: `0`
- Water graph is exactly inherited: `22 nodes / 55 edges`
- R047/R066 plan frame is exact: mask, group, step, phase, index and base errors are all `0`

The eight exact retained 6 m cells form two visible audit chains: one horizontal four-cell run in family 0 and one diagonal four-cell run in family 2. They are retained because they satisfy the frozen connected-evidence contract, not because a target changed-cell count was required.

## Browser and fixed-view QA

Real browser gate passed:

- Chrome: `/usr/bin/google-chrome`
- Screenshot status: `0`
- DOM status: `0`
- `data-ready=true` status: `0`
- PNG: `100475 bytes`
- Browser result: `passed=true`

Manual fixed-view review of the final 1400x900 artifact:

- A (R066) and B (R068) are almost indistinguishable in the main terrain perspective, consistent with the maximum correction being only about 7.3 mm.
- The plan audit clearly shows two four-cell orange connected runs; the previously scattered R067 proposal population is not carried forward.
- No new macro wall, obvious terrain seam, receiving-river break or hard-drainage-core invasion is visible.
- This remains a small, evidence-filtered profile-coherence correction. It does **not** make the whole one-sided agricultural slope read as the long nested contour terrace system in the reference image.

Therefore `visualAcceptance=false` remains correct, and parcel/shared-bund generation remains locked.

## Reference, Xiaoma and MrRolord boundary

`image(173).png` was re-resolved and reread in this run only as non-metric morphology evidence. It supports the visual target of broad portions of one agricultural slope reading as long curved contour-following benches with unequal widths, nested bends, concentrated darker riser edges and interruptions by natural drainage. No terrace width, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.

Xiaoma/TLO evidence boundaries remain binding: longer connected contour geometry, adjacency or conservation are not evidence of parcel ownership, surveyed riser section, hydraulic exchange, head, water depth, discharge, gate state, soil-water state or sediment state.

The saved MrRolord research is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use -> paths/vegetation/materials. The original named video was not available to replay in this run, and Blender/Voronoi/shader dimensions are not treated as agricultural truth.

## Real-world constraint

The 6 m compatibility lattice, four-cell/18 m gate, 0.5 mm proposal deadband, between-node interpolation, <=12 m drainage core and all profile amplitudes are synthetic morphology/QA controls, not surveyed Yunnan terrace dimensions. A 12.5 m macro DEM plus photographs cannot recover metre/sub-metre field microtopography, real parcel/management boundaries, measured bund/riser/channel sections, inlet/outlet invert elevations, observed hydraulic connectivity, head/depth/discharge/gate states or event-level water management. Those missing data are the practical reason an ordinary person cannot quickly turn the current visual reconstruction into a defensible real agricultural-engineering reconstruction.

## Locks after R045.68

- `visualAcceptance=false`
- `parcelGenerationEnabled=false`
- `waterStateKnown=false`
- `productionReady=false`

Next work remains inside priority 3: move from these two locally coherent residual runs to slope-scale long nested contour-bench organization that is visibly readable from the fixed main camera without weakening drainage separators. Only after that visual/topological gate is passed should priority 4 (parcel/shared bund structure) unlock.
