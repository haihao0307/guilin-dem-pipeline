# Learning Flywheel N330 — ZX85 manual pointer / autoplay parity

## Bounded question

Can the existing N321/N329 control regression reject a candidate whose autoplay works but whose real browser pointer path cannot operate the machine, or whose manual and autoplay modes drive different behavior graphs?

## Real unresolved failure

Fresh user production feedback says the excavator's core requirement is direct mouse operation plus one-click whole-machine autoplay. N329 proves only that an uninterrupted autoplay trace is causal and complete. It can still accept a workbench where manual controls are labels, camera-only hit targets, JavaScript-dispatched fake events, direct state mutation, or a separate reduced behavior graph.

## External teacher audition

Status: `TEACHER_CANDIDATE / AUDITION` for this bounded input-provenance problem only.

Teacher bundle: WHATWG DOM, W3C Pointer Events, W3C WebDriver and Web Platform Tests.

What it knows beyond KAOPU Current Best View:

- `Event.isTrusted=true` means the user agent dispatched the event; it does not prove a physical human operated a mouse.
- WebDriver defines a virtual pointer input source and ordered pointer actions that exercise the browser input path from outside page JavaScript.
- Therefore an independent verifier can test actual pointer hit targets without making the user first-line QA, while preserving `PHYSICAL_POINTER` versus `WEBDRIVER_VIRTUAL_POINTER` as distinct provenance states.

Screening:

1. Provenance: official WHATWG/W3C standards and official WPT repository.
2. Maintenance: observed heads dated 2026-11-15 (DOM), 2026-10-08 (Pointer Events), 2026-11-09 (WebDriver) and 2026-11-21 (WPT).
3. Runnable evidence: WPT pointerevents and WebDriver suites, including testdriver pointer actions and event-recording fixtures.
4. License: WHATWG specification text CC BY 4.0 with source-code portions BSD-3-Clause; W3C Software and Document License; WPT BSD-3-Clause.
5. Direct relevance: standalone browser pointer controls and automated verifier replay.
6. Novelty: it prevents the false inference `isTrusted == physical human` and supplies a standards-defined virtual pointer verifier route.
7. Dependencies/risks: browser/WebDriver runner, layout coordinates, pointer capture and device/browser variance; `isTrusted` alone remains insufficient.
8. Not demo-only or closed: open specifications and executable tests; no training data, model or commercial API dependency.

Audition boundary: no global adoption and no claim that WebDriver equals physical-device acceptance.

## Candidate contract

The authority-owned Task Anchor freezes two required modes, per-mode action inventories, source head, artifact digest, action-map digest and shared behavior-graph digest.

Manual mode must be exercised by a user-agent-dispatched physical or WebDriver pointer path that hits the declared machine control and binds input to a later machine observable. `dispatchEvent()` and direct state mutation do not qualify. Autoplay must bind a real trigger to a scheduler trace and cannot be prerecorded media. Both modes must reach the same source-bound behavior graph.

## Minimal falsifiable replay

The inherited N329 result remains 19/19. The N330 probe adds 12 suites: valid dual path; missing manual mode; unanchored mode; untrusted script dispatch; physical-human provenance overclaim; camera-layer hit instead of machine control; missing manual observable lineage; autoplay without scheduler; prerecorded autoplay; divergent behavior graph; wrong subject head; and Producer omission of one manual action.

Production browser replay is `NOT_RUN`. Current ZX85 production head, artifact, hit targets, behavior graph, WebDriver trace and physical-device acceptance remain `UNKNOWN`.

## Decision and boundary

`CANDIDATE_N321_REFINED_WITH_MANUAL_POINTER_AND_AUTOPLAY_PARITY_HOLD_PRODUCTION_BROWSER_REPLAY_UNVERIFIED`

Radio, air conditioning, sound fidelity, camera composition and production asset implementation remain outside this round. No main, R2 OS, public Site or production Mother branch is changed.

Lifecycle after targeted routing: `POSTED=true` — #91 comment `7056817677`; `ACKNOWLEDGED=false`; `IMPLEMENTED=candidate regression refinement only`; `GATE-RUN=true (fixture only)`; `ADOPTED=false`; `USER-ACCEPTED=false`.
