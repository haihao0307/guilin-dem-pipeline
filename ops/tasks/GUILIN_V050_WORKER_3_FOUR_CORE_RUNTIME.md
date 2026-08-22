# Guilin v0.5 Worker 3: overall map, four detailed cores and online candidate

## Branch

`codex/guilin-four-core-runtime-v050`

## Target

`project/guilin-v050-four-core`

## Read first

- `ops/tasks/GUILIN_V050_MASTER.md`
- `projects/guilin/config/core_regions_v050.json`
- current web and site runtime
- `/ops/` Phase A control-plane implementation
- existing stable v0.3.1 release and rollback path
- current GAEA proof page

## Fixed cores

Create four exact 10 km × 10 km projected squares around:

- 真宝鼎: 110.82528 E, 26.13556 N
- 桂林古城, 靖江王城 anchor: 110.29455 E, 25.2845 N
- 秧塘机场旧址: 110.15569 E, 25.21753 N
- 阳朔县城: 110.4920133 E, 24.7815129 N

Use EPSG:32649. Derive bounds using a 5,000 m half extent from the projected center. Add tests that verify side length, area, center containment and overall AOI containment.

## Stage 1, start immediately

Build the candidate runtime shell while Worker 1 and Worker 2 run:

- separate `/guilin-v050/` candidate path;
- overall-map scene and four core markers;
- core navigation and camera transitions;
- layer-control architecture;
- season selector;
- GAEA control panel mount point;
- v0.3.1 rollback link;
- `/ops/` link and status loader;
- source-quality and release display;
- fixture-based tests for manifest version, controls, camera presets and error handling.

Do not invent final field channels. Read them from the final Worker 1 and Worker 2 manifests in Stage 2.

## Stage 2, after the other workers merge

Rebase onto `project/guilin-v050-four-core`, load the final hydrology, GAEA, terrain, ecology and agriculture outputs, and finish the real online candidate.

## Overall map

- show the full established Guilin AOI;
- preserve real terrain scale and aspect;
- display all four core boundaries and labels;
- offer smooth transition from overall view into each core;
- stream detail progressively instead of loading all detailed geometry at once;
- preserve continuous terrain, water, canopy, crop-row and fibre phase at core edges.

## Core runtime

Each core requires:

- full aerial preset;
- water preset;
- erosion preset;
- rock preset;
- forest preset;
- bamboo preset;
- paddy preset;
- vegetable preset;
- orchard preset;
- top-view preset.

The 秧塘机场 core also needs an airfield preset and protection overlay. The 桂林古城 core needs an old-city anchor preset and urban hard-exclusion overlay.

## Layer controls

Provide switches for:

- terrain truth;
- visual microrelief;
- permanent water;
- active bank;
- river diagnostics;
- erosion;
- rock exposure and rock core;
- landform classes;
- GAEA controls;
- forest;
- species diagnostics;
- shrubs;
- phoenix-tail bamboo;
- moso bamboo;
- paddy;
- vegetable fields;
- dryland fields;
- orchards;
- bunds;
- crop rows;
- wind;
- hard exclusions.

## Seasons

Add spring, summer, autumn and winter selectors for the 1940-1945 project. Season controls may change palette, crop stage, leaf density, water state, soil wetness, atmosphere and wind profile. They may not relocate stable terrain, rivers, fields, roads or trees.

## Candidate safety

- keep v0.3.1 as the stable default and rollback;
- keep the candidate version explicit on screen;
- stop loading when a manifest or checksum is incompatible;
- show recoverable missing-asset diagnostics;
- do not place credentials in the browser;
- use local assets in the final artifact.

## Visual evidence

Generate consistent screenshots for:

- overall map;
- each of the four core aerial views;
- Li River continuity;
- Xiang River continuity;
- restored GAEA panel;
- vegetation comparison;
- forest and bamboo;
- paddy, vegetables, bunds and orchards;
- erosion and karst rock;
- top-view land use;
- seasonal comparison.

Create a montage comparing the stable v0.3.1 page, the previous good vegetation reference and the v0.5 candidate.

## Browser and endpoint QA

Verify:

- `/guilin-v050/` returns HTTP 200;
- `/ops/` returns HTTP 200;
- the current main terrain page returns HTTP 200;
- `/guilin/gaea-proof` returns HTTP 200;
- all camera presets render a frame;
- all layer switches operate without exception;
- all four core transitions work;
- resize and high-DPI rendering work;
- console errors are zero;
- v0.3.1 rollback loads;
- offline local-server use works;
- the Windows release package has ASCII paths, standard Deflate, no encryption, no symbolic links and passes archive integrity.

## Outputs

- candidate viewer under `web/guilin-v050/` and site mirror;
- candidate manifest and release selector;
- core-region projected-bounds manifest;
- visual evidence and browser QA reports;
- Windows-compatible release package and SHA-256;
- updated `/ops/` status;
- `HANDOFF_GUILIN_RUNTIME_V050.md`.

## Acceptance

- one overall map and four exact 100 km² cores are visible and navigable;
- core names never need user re-entry;
- the candidate clearly restores GAEA controls;
- water continuity and edge clipping are correct;
- vegetation and agriculture are visually detailed and rule-compliant;
- seasons and wind are available;
- candidate endpoints and rollback pass;
- user can open one online link and inspect the overall map and all four cores.

Submit a draft PR to `project/guilin-v050-four-core`. Do not merge it yourself.
