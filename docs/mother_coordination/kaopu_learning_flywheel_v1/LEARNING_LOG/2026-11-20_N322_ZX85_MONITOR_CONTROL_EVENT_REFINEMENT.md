# Learning Flywheel N322 — refine N318 with an exact monitor control-event matrix

## One bounded question

Can the existing N318 monitor-state regression reject a night-display implementation when selector-knob press/rotate semantics, return buttons, brightness navigation, work-light night mode, or numeric-key override are wired incorrectly?

## Why this is not a duplicate regression

N318 already owns the source-faithful LCD state-machine problem. This round updates that same case instead of creating another case. N321 concerns joystick/travel motion and is not applicable. No Mother ACK or fresh production replay has appeared for N318, N319 or N321.

## New source facts read this round

Frozen Hitachi operator manual, Library version 0:

- p.124 identifies the switch-panel controls, including return-previous, return-basic, selector knob, work-light switch and numeric keypad.
- p.125: return-previous goes to the prior screen; return-basic goes to the basic screen; selector push on the basic screen opens the menu; push in a menu confirms; rotate moves the cursor.
- pp.98–99: the exact brightness path is basic → main menu → setting menu → brightness adjustment; clockwise makes the display brighter and counterclockwise darker.
- p.99: day and night brightness are independently adjustable; with lights on, numeric key `0` activates the daytime screen.
- p.128: work-light switch position 2 turns on boom/base lights, panel illumination and monitor night mode. Position 1 explicitly documents base light and panel illumination but does not explicitly state the resulting monitor mode; OFF also does not explicitly state the resulting monitor mode in the selected passage. Those two transitions remain `UNKNOWN`.

## Candidate refinement

The production replay must emit an ordered event trace bound to a fresh `sourceHead`. It must distinguish physical event type (`PRESS`, `ROTATE_CLOCKWISE`, `ROTATE_COUNTERCLOCKWISE`, discrete light-switch position, numeric key) from resulting screen state.

New holds added to N318:

- `HOLD_MONITOR_CONTROL_EVENT_SOURCE_MISSING`
- `HOLD_MONITOR_CONTROL_EVENT_EFFECT_MISMATCH`
- `HOLD_MONITOR_BRIGHTNESS_PATH_MISMATCH`
- `HOLD_MONITOR_DAY_NIGHT_BRIGHTNESS_COLLAPSED`
- `HOLD_MONITOR_LIGHT_POSITION_MODE_UNSUPPORTED`
- `HOLD_MONITOR_CONTROL_EVENT_REPLAY_MISSING`

## Minimal falsifiable test

The N322 probe runs 12 synthetic fixtures. It accepts the exact source-backed event matrix and rejects press/rotate swaps, wrong return behavior, skipped brightness steps, reversed brightness direction, missing night-mode mark, ignored numeric-key override, collapsed day/night brightness, unsupported position-1 claims, missing trace and missing source pages.

This remains fixture-only. A current ZX85 production implementation was not replayed.

Decision: `CANDIDATE_N318_REFINED_WITH_CONTROL_EVENT_MATRIX_HOLD_PRODUCTION_REPLAY_UNVERIFIED`.

Teacher status: `NO_NOVELTY`. The increment comes from frozen first-party documentation and an executable comparison against the current N318 gap.

No main, R2 OS, production Mother branch or production asset is modified.
