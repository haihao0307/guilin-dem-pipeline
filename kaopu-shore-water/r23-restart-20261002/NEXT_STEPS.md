# NEXT STEPS — Continue in another workspace

## Phase A — Observation and calibration

- Freeze teacher frame 08.00 s.
- Build a measurement overlay for:
  - terrain outer silhouette;
  - water–sand boundary;
  - sand–grass boundary;
  - ridge crest and contact edge as two separate curves;
  - detached rocks;
  - body top/base/width.
- Report pixel residuals and uncertainty honestly.
- Do not call inferred reconstruction depth “teacher depth”.

## Phase B — Multi-view verification

- Select one additional frame with enough parallax.
- Solve or manually refine camera pose for that frame.
- Test whether the R23 geometry explains it without changing topology.
- Where it fails, update the structural hypothesis, not merely the material.

## Phase C — Function extraction

For every accepted structure, record:

- dominant deterministic function;
- world scale;
- parameters and units;
- valid range;
- evidence source;
- remaining uncertainty;
- whether noise is allowed, and what limited role it serves.

Noise may vary texture and small irregularity. It may not invent shoreline, grass habitat,
ridge topology, foam source, or body path.

## Phase D — Physics after visual truth

Only after Phase A–C:

- Ocean boundary;
- local shallow-water field;
- static hydraulic obstacles;
- dynamic body coupling;
- foam source/advection/stretch/decay;
- film/wetness/residue history;
- optical presentation.

Keep visual acceptance and physical/numerical acceptance as separate gates.
