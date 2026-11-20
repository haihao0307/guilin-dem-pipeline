# KAOPU Learning Flywheel N324 — ZX85 monitor input-to-next-paint latency

Date: 2026-11-20
Status: CANDIDATE / AUDITION
Scope: one bounded question only

## Bounded question

Can the existing N318/N322 monitor regression reject a source-faithful screen that eventually reaches the right state but gives no prompt next-frame response after the operator presses or rotates a control?

## Current failure

Fresh user production feedback says the display still appears slowly and that pressing should make it appear immediately. N322 verifies control-event semantics and destination states, but its replay receipt has no time axis. A slow implementation can therefore pass after eventually reaching the correct screen.

## One external teacher audition

Status: `TEACHER_CANDIDATE`.

W3C Event Timing adds exactly one bounded capability missing from the KAOPU Current Best View: bind an input to a `PerformanceEventTiming` entry and decompose total input-to-next-paint latency into input delay, processing duration and presentation delay. The W3C draft was published 2026-11-13; the source repository was updated the same day. WPT provides runnable cross-browser event-timing tests under BSD-3-Clause.

This is not adopted wholesale. The specification is a Working Draft, `duration` is coarsened to 8 ms, future observation cannot go below a 16 ms threshold, and the default buffered exposure threshold is 104 ms. Those numbers are measurement mechanics, not KAOPU acceptance thresholds.

## Candidate contract delta

N318 is refined in place rather than duplicated. A latency receipt now requires exact subject identity, event grouping, separate cold/warm samples, a first-interaction sample, the three latency components, and the visible state in the next rendered frame. No latency PASS may be claimed while the KAOPU threshold remains `UNKNOWN`.

## Minimal falsifiable probe

The synthetic gate replays twelve counterexamples: missing head, invalid timing order, missing first interaction, missing interaction ID, missing next-paint state, unknown threshold with a false PASS, over-budget PASS, cold/warm aggregation collapse, hidden presentation delay, observer blind spot and missing receipt identity.

Result: **12/12 fixture cases PASS**.

Production replay: `NOT_RUN`. Physical-device latency: `UNKNOWN`.

Decision: `CANDIDATE_N318_REFINED_WITH_EVENT_LATENCY_RECEIPT_HOLD_PRODUCTION_MEASUREMENT_AND_THRESHOLD_UNVERIFIED`.

## Boundary and routing

Targeted reply requested only from the Monitor/UI Mother:
1. Is this failure real on the current fresh head?
2. Does the current workbench already collect Event Timing entries?
3. Which part dominates: input delay, processing, or presentation?
4. What is the smallest fresh-head replay and who freezes the acceptance threshold?

Lifecycle before posting: `POSTED=false`; `ACKNOWLEDGED=false`; `IMPLEMENTED=candidate regression refinement only`; `GATE-RUN=true (fixture only)`; `ADOPTED=false`; `USER-ACCEPTED=false`.

No main, R2 OS, production Mother branch or production asset is modified.
