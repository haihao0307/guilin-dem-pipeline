# Codex task: Kunming Yunnan-color terrain and real OSM hydrology V004

Work only on `project/kunming-dem-v001` and PR #20. Keep PR #20 open and Draft. Do not merge, force push, rewrite history, modify `main`, replace the authoritative DEM, or overwrite the accepted V003 page.

Start from the latest remote HEAD. The accepted stable base is:

- public V003: `https://haihao0307.github.io/guilin-dem-pipeline/kunming-rich-color-v003/`
- source: `projects/kunming/web/rich-color-v003/`
- successful workflow run: `32943697132`
- artifact: `KUNMING_DEM_3D_WEB_V003_RICH_COLOR_FIX`

Create a new source and deployment directory named `kunming-yunnan-hydrology-v004/`.

## 1. Interface simplification

Remove all camera preset controls from V004. Do not include buttons or code paths named 总览、俯视、朝北, overview, top, north, aerial, low, or reset-camera. The user controls camera rotation, pan and zoom directly with the mouse. Keep only:

- river on/off;
- lake/reservoir on/off;
- OHM candidate on/off, default off;
- river lateral width;
- tributary density/class threshold;
- water color depth;
- flow speed;
- lake wave strength;
- small-water-area density;
- Yunnan surface color controls;
- fullscreen, screenshot and panel collapse.

## 2. Learn from the Guilin ecology module without copying its terrain proxy

Translate these accepted Guilin production rules into Kunming:

- cited/authoritative water geometry overrides procedural inference;
- permanent channel masks are hard exclusions for later vegetation and land-use instances;
- water and ecology fields are deterministic and regenerable;
- river centerline topology remains stable while display width is adjustable;
- lake boundaries stay fixed while water material changes;
- runtime controls remain stable when better truth data replaces a temporary layer.

Do not copy Guilin proxy terrain, karst styling, plant distribution or hand-generated channels into Kunming.

## 3. Real OSM hydrology only

Use the successful hydrology knowledge artifact from run `32925496927`, artifact `kunming-hydrology-knowledge-v001`.

Required current OSM source counts:

- waterways: 1,634;
- water areas: 1,652;
- water nodes: 212;
- waterway relations: 14.

Required clipped display minimums:

- accepted modern OSM waterway features >= 1,600;
- accepted modern OSM water areas >= 1,600.

Preserve OSM type, ID, version, timestamp, tags, names, waterway class and relation role in the knowledge manifest. Keep attribution visible as `© OpenStreetMap contributors, ODbL 1.0`.

Rules:

- hand-drawn water count must remain 0;
- historical accepted truth count must remain 0;
- modern OSM is labelled modern reference;
- OHM objects remain candidates because current extracted objects have no sufficient dated proof;
- river coordinate order supplies downstream animation direction;
- river centerlines are immutable;
- width control expands only perpendicular to the centerline;
- lake/reservoir shorelines are immutable;
- wave animation changes shading, normal/highlight and opacity only;
- no blue straight-line placeholders, no random rivers and no synthetic lake polygons.

## 4. Repair the Float32 loading failure

The old V001 page failed because a URL with `?v=` did not satisfy `.endsWith('.gz')`, so compressed bytes were passed into `Float32Array` without decompression. V004 must use a fail-closed binary contract.

Required format and browser checks:

- explicit 64-byte binary header;
- magic string, version, geometry kind, stride, vertex count, payload byte count and header byte count;
- all Float32 offsets and lengths divisible by 4;
- HTTP status, MIME type, Content-Length and SHA-256 verified before decoding;
- reject HTML, JSON or plain-text error responses;
- create typed arrays from validated `ArrayBuffer` slices only;
- no query-string-based file-type detection;
- a failed asset shows a clear diagnostic and safe 2D fallback, never a blank canvas.

## 5. Yunnan satellite-style surface

The main visual target is a rich, delicate Yunnan mountain palette. Generate the surface deterministically from the frozen height asset and terrain derivatives. Use at least:

- normalized elevation;
- slope;
- aspect/exposure;
- local relief;
- valley position or relative topographic position;
- deterministic hillshade;
- broad wet/dry regional modulation.

Color logic should include several blended families rather than a single elevation ramp:

- dark humid valley forest greens;
- olive and yellow-green lower slopes;
- dry golden grass and cultivated basin tones;
- Yunnan red-soil orange and brick-red exposures;
- warm ochre and brown weathered slopes;
- grey-brown and pale exposed rock;
- restrained high-elevation pale tones;
- cooler shaded aspects and warmer sun-facing aspects.

Avoid neon green, pink mountain outlines, flat tan basins and white overexposure. Preserve fine ridge, gully and slope detail. Do not add random noise that changes terrain meaning.

Produce:

- 2048 × 2814 compatibility surface;
- 4096 × 5628 desktop surface when GPU limits allow;
- deterministic build report with SHA-256 for both;
- browser selection based on actual texture-size support and available memory.

Recommended user controls:

- humid vegetation strength;
- red-soil warmth;
- exposed-rock strength;
- shadow contrast.

## 6. Authoritative DEM boundary

The frozen authoritative crop remains:

- SHA-256 `9f672e16714d98b7bc7f002826cdf788379bcb54db84227a21f53539b083f3a2`;
- EPSG:32648;
- float32;
- 5892 × 8095;
- 12.5 m × 12.5 m;
- 73.650 km × 101.1875 km;
- 7,452.459375 km²;
- compression NONE;
- no internal overviews;
- no resampling;
- vertical scale 1.0×.

Browser textures are regenerable display caches. Do not modify or replace the authoritative DEM.

## 7. Browser and deployment acceptance

Deploy to:

`https://haihao0307.github.io/guilin-dem-pipeline/kunming-yunnan-hydrology-v004/`

Run real Chromium or Edge QA at desktop 1440 × 900 and mobile 390 × 844. Required evidence:

- WebGL2 active;
- fallback hidden;
- canvas visible;
- genuine 3D rotate, pan and wheel zoom;
- no console or page errors;
- rivers and lake polygons visible when toggled;
- river width changes laterally without moving the centerline;
- lake waves do not move shorelines;
- OHM layer default off;
- no camera preset buttons in DOM;
- screenshot after adjusting Yunnan color controls and river width;
- public manifest, build report and browser QA JSON.

Commit all source, workflow, manifest and handoff to the same branch. Keep PR #20 Draft. Stop after V004 public deployment and QA are complete.
