# Learning Flywheel N321 — ZX85 source-bound control mapping gate

## One bounded question

Can a source-bound input-to-motion contract reject a visually complete ZX85 cab when the left/right joystick directions, paired travel, pivot/spin behavior, neutral stop, or machine orientation are wrong?

## Why this is the highest-value unresolved item

N319 established the safety interlock that decides whether motion is authorized. It explicitly deferred the next causal layer: once motion is authorized, which input must drive which actuator or crawler, in which semantic direction, and what must stop on release. A screen, lever or pedal that merely exists visually can still be functionally false.

No matching joystick/travel/pivot/spin input-to-motion regression was found in the current learning branch search. N319 remains an applicable prerequisite and is not duplicated. N318 is an LCD state contract and is not applicable to this question.

## Frozen first-party facts

Source: Hitachi operator manual, Library file version 0, 9,094,235 bytes.

- PDF p.187: with front idlers at the front and travel motors at the rear, both levers/pedals forward mean forward; both back mean reverse; neutral applies travel brakes. If travel motors are at the front, control actions reverse, so undercarriage orientation must be confirmed.
- PDF p.188: a pivot drives exactly one crawler; a spin drives both crawlers in opposite directions.
- PDF p.199: ISO left joystick is arm roll-out/in and swing right/left; ISO right joystick is boom lower/raise and bucket roll-in/out. Release returns the lever to neutral and stops that function.

## Candidate contract

Each replay binds `inputDevice`, `inputDirection`, `machineOrientation`, `expectedTarget`, `expectedSemanticDelta`, a declared coordinate frame, observed signed delta, neutral-stop result, source pages and fresh-head receipt.

The manual freezes semantic motion. Numeric axis signs are accepted only when the production receipt declares its actuator axis, positive direction and machine frame. Without that declaration the number is `UNKNOWN`; the flywheel does not invent a sign convention.

New candidate holds:

- `HOLD_CONTROL_MAPPING_SOURCE_MISSING`
- `HOLD_CONTROL_INPUT_TARGET_MISMATCH`
- `HOLD_CONTROL_SEMANTIC_DELTA_MISMATCH`
- `HOLD_CONTROL_COORDINATE_FRAME_UNDECLARED`
- `HOLD_CONTROL_NEUTRAL_STOP_MISSING`
- `HOLD_TRAVEL_ORIENTATION_UNBOUND`
- `HOLD_TRAVEL_PAIRING_MISMATCH`
- `HOLD_PIVOT_ONE_CRAWLER_CONSTRAINT_FAILED`
- `HOLD_SPIN_OPPOSED_CRAWLERS_MISSING`
- `HOLD_CONTROL_PRODUCTION_REPLAY_MISSING`

## Minimal falsifiable test

The executable probe ran 10 synthetic fixtures. It accepts the complete canonical mapping and rejects wrong target binding, wrong semantic delta, undeclared coordinate frame, missing neutral stop, missing travel orientation, reversed paired travel, two-crawler pivot, same-direction spin, and missing source pages. Result: **10/10 PASS**.

This is fixture evidence only. No current ZX85 production head was replayed, so `productionReplayVerified=false`.

## Decision and lifecycle

Decision: `CANDIDATE_CONTROL_MAPPING_CONTRACT_DEFINED_HOLD_PRODUCTION_REPLAY_UNVERIFIED`.

- `POSTED=false` before the targeted issue receipt
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=candidate regression only`
- `GATE-RUN=true (fixture only)`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

Teacher status: `NO_NOVELTY`. The increment comes from a frozen first-party manual and an executable comparison against KAOPU's current gap, not from an external teacher audition.

## Boundary and routing

Route only to the ZX85 Cabin/Control Mother through issue #91. The next Mother action is one fresh-head control-matrix replay with declared coordinate frames and signed deltas. Do not reopen the pilot shut-off interlock, LCD state machine, main, R2 OS, or any production Mother branch.
