# Learning Flywheel N323 — ZX85 track-shoe configuration truth

## One bounded question

Can an explicit, mutually exclusive track-shoe configuration contract prevent rubber and grouser variants from being accepted as a material-only swap, or from incorrectly carrying shared rollers, sprockets and axles inside the swappable variant?

## Real failure and current gap

The user corrected that the metal running gear belongs to the undercarriage, while the rubber/plastic-looking track and iron/steel track are replaceable alternatives. N321 proves control-to-crawler motion semantics but does not prove which physical track configuration is installed. No matching track-configuration regression was found.

## New first-party source facts

Frozen Hitachi operator manual, Library version 0:

- p.342: the standard ZX85USB-5A uses a 450 mm grouser shoe; standard undercarriage length is 2920 mm and width is 2200 mm.
- p.344: the manufacturer defines four configurations, not one mesh with different color: 450 mm grouser standard, 600 mm grouser option, 450 mm pad crawler option and 450 mm rubber crawler option.
- p.344: these configurations change weight, clearance, undercarriage length or width, ground pressure and intended terrain. The 600 mm grouser, pad crawler and rubber crawler options should not be used on gravel or rocky ground.

The user term “plastic track” is normalized to the manufacturer term `450 mm Rubber Crawler Shoe`; the informal label is not promoted as source truth.

## Candidate contract

Exactly one `activeVariantId` is allowed. Shared undercarriage running gear—frame, idler, sprocket, rollers, axles and mounts—must remain outside the swappable shoe/crawler ground-contact set. A configuration change must report removed/installed object IDs plus source-bound geometry, mass and application deltas.

New holds:

- `HOLD_TRACK_VARIANT_SOURCE_MISSING`
- `HOLD_TRACK_ACTIVE_VARIANT_MISSING`
- `HOLD_TRACK_MULTIPLE_ACTIVE_VARIANTS`
- `HOLD_TRACK_VARIANT_UNSUPPORTED`
- `HOLD_TRACK_VARIANT_DIMENSION_MISMATCH`
- `HOLD_TRACK_VARIANT_WEIGHT_MISMATCH`
- `HOLD_TRACK_MATERIAL_ONLY_SUBSTITUTE`
- `HOLD_TRACK_SHARED_RUNNING_GEAR_INSIDE_VARIANT`
- `HOLD_TRACK_APPLICATION_CONTRADICTION`
- `HOLD_TRACK_CONFIGURATION_REPLAY_MISSING`

## Minimal falsifiable test

The executable probe runs 11 synthetic fixtures. It accepts the source-bound rubber configuration and rejects missing/multiple/invented variants, wrong dimensions or weight, material-only substitution, rollers inside the swappable set, terrain contradiction, missing source and missing replay.

This is fixture evidence only. Current production undercarriage geometry was not replayed.

Decision: `CANDIDATE_TRACK_CONFIGURATION_CONTRACT_DEFINED_HOLD_PRODUCTION_REPLAY_UNVERIFIED`.

Teacher status: `NO_NOVELTY`. The increment comes from a frozen first-party configuration table plus a user correction.

No main, R2 OS, production Mother branch or production asset is modified.
