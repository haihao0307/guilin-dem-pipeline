# START HERE — KaoPu Shore Water R23 Handoff

## Current authoritative baseline

`R23_CURRENT/KAOPU_SHORE_RESTART_R23.html`

This is the clean restart baseline. R00–R22 scene code, solver assumptions, ridge pieces,
camera parameters, and self-declared anchor passes are retired and must not be copied back.

## Why R23 exists

The earlier line accumulated errors because the first teacher frame was misread:
camera, water/land zoning, shoreline, grass boundary, ridge topology, body scale, and
foam placement were inferred too early and then treated as truth.

R23 restarts from:

1. teacher evidence;
2. manually measured image-space boundaries;
3. Observed / Inferred / Unknown separation;
4. a new camera and geometry hypothesis;
5. browser QA without claiming unmeasured depth or completed physics.

## Open

- Workbench: `R23_CURRENT/KAOPU_SHORE_RESTART_R23.html`
- Source: `R23_CURRENT/source/`
- Measurement evidence: `R23_CURRENT/source/observations.json`
- QA: `R23_CURRENT/qa/`
- Teacher original: local full handoff `TEACHER_ORIGINAL/XDown.app_Jt4rzmsH_1JTU3XC_1624p.mp4`

## Integrity

- Teacher original SHA-256: `9fcdeda296571af702433c90ee4a63a8359a5942eac0dc702ee13ab862f7952d`
- R23 verified package SHA-256: `6c15ace1f704271b03833f14dc4e1108e57b1b773548675ade058a5c1d3e8cc0`

## Next production order

Do not add another solver first.

1. Validate the 08 s camera and full-frame zoning.
2. Re-measure shoreline, pale sand, grass boundary, ridge upper/contact edges, body and rocks.
3. Validate the same 3D hypothesis against at least one additional teacher frame.
4. Only after the visual structure survives independent-view checking:
   - rebuild shallow water;
   - rebuild foam source/transport/history;
   - rebuild wet sand and film;
   - rebuild body coupling.

The teacher image must remain visible beside the replica during every visual iteration.
