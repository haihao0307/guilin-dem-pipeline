# HANDOFF ECOLOGY V0.4.0

## Phase A status

This phase adds a deterministic, habitat-aware ecology and agriculture compiler, a 20-prototype Guilin working knowledge catalog, crop and field configuration, and focused tests. It produces text JSON releases for validation. Binary instance streams, field textures, visual shaders, and the active browser release remain Phase B work.

## Added files

- `scripts/ecology_v040/ecology_agriculture_compiler.py`
- `metadata/ecology/v0.4.0/ecology-knowledge.json`
- `metadata/ecology/v0.4.0/agriculture-config.json`
- `tests/test_ecology_agriculture_compiler_v040.py`
- `HANDOFF_ECOLOGY_V040.md`

## Knowledge model

The catalog contains 20 active prototypes covering riparian Ficus, Chinese wingnut, hackberry, lowland and slope evergreen broadleaf trees, Chinese fir, Masson pine, phoenix-tail bamboo, moso bamboo, riparian and forest-edge shrubs, karst drought shrub, and four orchard groups. Every prototype declares landform, slope, water distance, moisture, settlement distance, height, scale, crown form, palette, grouping, forbidden masks, evidence state, and 1944 verification state.

The river sequence is fixed as permanent water, bare or active bank, riparian shrub, riparian tree, phoenix-tail bamboo, then moso bamboo or alluvial-terrace vegetation. Permanent water, active banks, and strong karst rock core cannot receive woody instances.

## Agriculture model

The compiler assigns paddy, two vegetable color groups, maize-like dryland crop, root-crop dryland, orchard, fallow, and harvested fields only after terrain and hard-exclusion checks. Paddy is limited to flat valley, floodplain, alluvial terrace, and irrigable low footslope cells. Ridge, peak, cliff, strong rock, active bank, and permanent water cells are prohibited.

Each field receives a stable global ID, orientation, phase, crop palette, row phase, and bund candidate mask. Orchard rows and trees use stable block, row, and tree coordinates with deterministic missing-row and missing-tree events. All phase calculations use global grid coordinates, so neighbouring tiles do not restart rows or orchard patterns.

## Determinism and validation

Instance IDs, spatial jitter, scale, height, rotation, palette, crop choice, field orientation, rows, and orchard gaps are generated from stable hashes. The release stores checksums for every output field, the full instance list, the knowledge catalog, the agriculture configuration, and the complete release.

Focused tests cover:

1. zero vegetation in permanent water, active bank, and hard-exclusion cells;
2. zero agriculture in forbidden landforms or masks;
3. every instance references a declared prototype and at least 18 prototypes are active in the validation scene;
4. deterministic rebuilds with identical release and instance checksums;
5. global row phase continuity at a shared tile coordinate.

Run from the project root:

```bash
python -m unittest tests/test_ecology_agriculture_compiler_v040.py
```

## Phase B work remaining

- Consume the final Worker 1 terrain release and exact 10 km² grid manifest.
- Add historical roads, villages, buildings, airport, irrigation channels, and archival land-use masks.
- Replace the Phase A stable field-block partition with nested Voronoi subdivision constrained by approved parent masks.
- Compile field textures, tree, shrub, bamboo, rice, vegetable, and orchard binary streams.
- Implement three-layer canopy, parallax fibre grass and crops, tree trunks, detailed bund shoulders, and irrigation cuts in the browser shader.
- Produce forest, riverbank and bamboo, paddy and bund, vegetable, orchard, and top-view screenshots.
- Calibrate density, color, scale, and species ratios against the supplied Blender reference and the historical AOI evidence.

## Rollback

Phase A does not change the default release. The stable browser release remains v0.3.1. Removing the five files listed above restores the branch to its prior behavior.
