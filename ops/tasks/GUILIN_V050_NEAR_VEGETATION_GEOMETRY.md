# Guilin v0.5 near-ground vegetation geometry

Branch: `codex/guilin-near-vegetation-v050`
Target: `fix/guilin-v050-recover-v031-baseline`
Private candidate: `web/guilin-v050/`

Keep this work private and keep the pull request in draft.

## Context

The controller restored the v0.3.1 field and instance runtime, verified WebGL2 startup, all camera presets, all layer switches, zero browser errors, and ground mode at 1.70 m with a 0.14 m near plane. The ground screenshot still shows oversized pixelated medium-distance tree billboards. A temporary bootstrap cap now fades them before immediate ground range. Procedural near geometry is still missing.

Read:

- `projects/guilin/recovery/GUILIN_V050_REQUIREMENTS_AUDIT.md`
- `projects/guilin/config/release_gate_v050.json`
- `HANDOFF_GUILIN_V050_CONTROLLER_RECOVERY.md`
- `reports/GUILIN_V050_PRIVATE_BROWSER_QA.json`
- `web/guilin-v050/runtime.js`
- `web/guilin-v050/bootstrap.js`
- existing v0.3.1 field textures and tree, shrub and rice streams

## Goal

Use one stable plant identity across three ranges:

- far: aggregate canopy and land-cover fields;
- medium: bounded billboard or parallax representation;
- near: instanced procedural geometry.

Detailed geometry loads only in the active 10 km by 10 km core.

## Required near geometry

- tapered instanced trunks;
- low-poly multi-lobed broadleaf crowns;
- narrow conifer and open pine profiles;
- orchard crown and fruit accents;
- low dense phoenix-tail bamboo;
- tall light moso bamboo;
- small multi-lobed riverbank, forest-edge and karst shrubs;
- bounded rice, vegetable and dry-crop blade or stem geometry;
- vegetated bund shoulders while preserving bund cores, irrigation cuts and field entries.

Use the 20 prototype IDs and stable height, scale, palette and wind phase from the current streams. Tree and crop roots follow sampled terrain. Permanent water, active bank, strong rock core and crop interiors keep their existing exclusions.

## Wind and continuity

Use the same world-space wind field for far, medium and near forms. Roots remain fixed. Trunks move least, crowns and fine foliage move more. Rice and grass form coherent field waves. Range transitions use real distance and screen footprint and cannot pop or change species.

## Runtime rules

Use WebGL2 instancing and bounded geometry budgets. Do not create one draw call per plant. Do not embed instance JSON in HTML. Preserve the camera, terrain, GAEA, hydrology, season and release-lock systems. Commit a clean valid `runtime.js` and remove the temporary billboard text replacements from `bootstrap.js` when the clean implementation is ready.

## Tests

- `runtime.js` passes `node --check` directly;
- near tree geometry appears below its transition distance;
- medium billboards fade before ground range;
- near geometry uses instancing;
- roots follow terrain;
- zero near instances in permanent water and active bank;
- zero large trees and dense shrubs in strong rock core;
- at least 18 prototype IDs remain active;
- phoenix-tail and moso bamboo differ;
- crop palettes and field rows remain distinct;
- bund core, shoulder and cuts remain visible;
- wind root locking passes;
- ground mode remains 1.7 to 2.0 m above terrain;
- browser console errors remain zero;
- public release gate remains false.

## Evidence

Provide private screenshots for forest, bamboo, paddy, vegetables, orchard and bunds at medium, 50 m and ground-observer views. Reject giant pixel discs, floating crowns, visible sprite squares, bright parcel wireframes and vegetation inside water.

Deliver runtime modules, focused tests, a machine-readable QA report, evidence images and `HANDOFF_GUILIN_V050_NEAR_VEGETATION.md`. Open a draft PR to the recovery branch and stop for controller review.
