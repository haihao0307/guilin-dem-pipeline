# Guilin v0.5 final deliverable: public online webpage and downloadable web package

## Goal

The final user-facing result must be a normal public webpage that opens directly in a browser, with no GitHub login, no Codex interface, no local server command and no installation. It must also be available as a complete downloadable offline web package.

This branch prepares the final publication system now. Final asset binding and publication occur only after the named-river and four-core DEM PR and the near-ground ecology PR are merged into the recovery branch and all release gates pass.

## Final public routes

The public artifact must provide:

- `/` stable landing page and current approved release;
- `/guilin-v050/` final Guilin interactive candidate;
- `/guilin-v050/ops/` or the approved public status page;
- stable v0.3.1 rollback entry;
- direct links for the overall map and all four cores.

The public URL must be recorded in the release manifest and handoff. Every route must return HTTP 200.

## Required content

The public interactive page must include:

1. overall Guilin map using one continuous truthful 12.5 m terrain lineage;
2. four fixed 10 km × 10 km cores:
   - 真宝鼎;
   - 桂林古城;
   - 秧塘机场旧址;
   - 阳朔县城;
3. complete named Li River and Xiang River system;
4. active-core detailed ecology and agriculture only;
5. far-distance atmosphere and blur without a black perimeter;
6. separate GAEA and hydrology controls;
7. camera descent to approximately 1.7 m above ground;
8. ground-observer mode;
9. season selection for 1940 to 1945 reconstruction profiles;
10. layer switches, camera presets, diagnostics and performance readout;
11. visible source and accuracy labels;
12. stable rollback.

## Publication policy

1. Keep all workflows manual while blockers remain.
2. After upstream final PRs merge, rebase this branch onto `fix/guilin-v050-recover-v031-baseline`.
3. Run complete release gate, browser, visual and package QA.
4. Generate a private Pages artifact first.
5. Record its checksum and inspect every required screenshot.
6. Set `public_release_allowed=true` only after all machine gates pass and the final visual evidence is accepted.
7. Deploy through GitHub Pages or the existing approved public site pipeline.
8. Verify the deployed URL from an external HTTP client.
9. Never overwrite the rollback release.

## Required tests

- overall route HTTP 200;
- `/guilin-v050/` HTTP 200;
- rollback route HTTP 200;
- every manifest, terrain, hydrology, ecology and shader asset HTTP 200;
- no external unavailable dependency;
- WebGL2 starts;
- zero console and page errors;
- all four cores load;
- ground mode reaches 1.7 to 2.0 m in all four cores;
- named Li and Xiang networks render;
- no unexplained lines or water bridge triangles;
- no black perimeter;
- no vegetation in permanent water;
- no paddy in forbidden terrain;
- GAEA controls work;
- hydrology controls work;
- seasons work;
- v0.3.1 rollback works;
- mobile viewport loads and controls remain usable;
- Windows ZIP extraction and offline local-server launch pass.

## Visual evidence

Generate one public-release evidence directory containing:

- overall map without line artifacts;
- overall map without black perimeter;
- Li and Xiang continuity view;
- water centerline, surface and bank comparison;
- far blur and atmosphere;
- five camera heights for each of the four cores;
- forest, bamboo, paddy, crop, orchard and bund views;
- GAEA controls visible;
- hydrology controls visible;
- season comparison;
- mobile viewport;
- rollback page.

## Downloadable package

Create a Windows-compatible ZIP with:

- complete static site;
- ASCII-safe internal paths;
- standard Deflate;
- no encryption;
- no symbolic links;
- start-local-server script;
- README;
- source and license manifest;
- release and asset checksums;
- SHA-256 sidecar;
- package manifest.

## Delivery

Create a draft PR from `fix/guilin-v050-public-web-final` to `fix/guilin-v050-recover-v031-baseline`. Build the publication shell and QA now. After the two upstream final PRs merge, rebase, bind the final assets, run every gate, deploy the approved public page, verify it externally and update `HANDOFF_GUILIN_V050_PUBLIC_WEB.md` with the exact public URL and package checksums. Do not publish an incomplete candidate.
