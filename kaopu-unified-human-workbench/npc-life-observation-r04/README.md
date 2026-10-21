# NPC life observation R04 — task and state authority

Source candidate. File-protocol and final-public browser receipts are required before delivery. Machine checks do not set visualAcceptance or productionReady to true.

## Audit and chosen change

The user requested a fresh architecture audit and asked us to choose the important iteration. The previously delivered R03 baseline is `1ba2b58eb3fdd6efe60b993240e988980547c93e`. The supplied Humanoid Rig Lab Next master documents require separate identity/proportion, rig/skin, pose/animation, physical state, commands and versioned read models.

The audit reproduced four boundary defects:

1. snapshot() returned writable references to active tasks, review and audits. Changing a returned window target changed the running task. Old snapshots changed when later events were appended.
2. Moving a target while paused left the prior review checked until a later physical tick, although the goal was already false.
3. UI buttons and numerical verification could both modify one world. Manual single-step also advanced CPU state while the previous native GPU frame remained pending.
4. Routine export and the hidden data preview embedded the complete numerical report. The previous R03 browser artifact measured 60,453,937 bytes for an ordinary window export and 49,022,174 bytes for the numerical report. These are historical R03 measurements, not an R04 benchmark.

This iteration establishes a local command boundary and detached read state. It does not add more animation clips before these ownership problems are resolved.

## Execution and data boundaries

UI / local adapters submit intent to RuntimeCommands. The host applies one command after the previous native GPU frame and its completed-frame readers finish. Identity requests invoke the existing physical skills; LifeWorld and WindowInteraction own physical prop state and measured results; the existing native pose solver and renderer present them.

This remains a single browser document. SharedWorker, network multiplayer, durable project revision, distributed leases and a general AI planner are not implemented. commandRevision counts accepted local commands; sceneEpoch distinguishes explicit scene generations. Neither is the mother project's durable ProjectState.revision.

### Commands

- At most 32 queued commands and 128 retained completed receipts.
- Plain JSON object payloads, known command types, scene generations and optional task tokens are checked before application.
- Repeating a retained ID with identical content returns the existing receipt; different content is rejected. Once history evicts an ID, it is outside the documented retry window.
- One drain applies at most one command. A step advances exactly 1/120 s and produces its native frame before another step applies.
- Receipt frame fields describe the preceding completed image. They never claim the resulting image is already presented; actual completion remains a RenderQueue/ObservationClock fact.
- Numerical verification exclusively owns world mutation while active. Ordinary commands are rejected on submission and execution; pause, reset and stop remain available.
- Pending commands suspend further physics/probe advancement while existing dirty frames drain, so accelerated verification cannot starve Stop.
- Reset and Stop deliberately target the current session and record both epochs. Object/task commands retain exact-generation checks.
- An interrupted numerical run is retained as aborted, with partial completed results and no successful verdict. The next explicitly started run replaces the single retained report.

### Task identity and review

Bottle tasks now have monotonic IDs/tokens and actor generation, like existing window tasks. Tokens follow request, contact, release, result and recovery evidence. Old cancellation tokens cannot cancel a newer task for the same actor. This fixes a local protocol ambiguity; no existing network failure is claimed.

Target/support changes immediately invalidate current review, including while paused. Confirmation records targetRevision, supportRevision and the actual released-task token. Historical successful receipts remain historical; a new valid review requires new stable physical measurements.

### Read state and explicit evidence

- state() returns detached current physical/task state, the last ten retained events, evidence counts and compact command status.
- snapshot({includeAudit:true}) retains the old complete evidence shape while detaching mutable references. It is an explicit heavy read.
- verification() returns a compact summary of one retained run; verification({detail:true}) explicitly returns its full detached report.
- Export current state contains current data and summaries, with a tested 1 MiB budget. It omits geometry arrays, the full numerical report and complete frame trace.
- Export complete verification evidence contains the retained native measurements, world/window audits, numerical report, observation trace and bounded command history.

Counts describe currently retained diagnostics, not unlimited replay history or persistence across reload. R03's existing world diagnostic retention remains; this increment bounds commands and separates read projections.

## Native and physical preservation

Canonical source remains HUMAN-INTEGRATED-R07, human-integrated-r07/preview.html, SHA256 `d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a`.

All three original complete people remain: A tall/slim P01, B short/heavy P02, C sturdy P05. Each retains 266,098 vertices, 531,702 triangles, 104 bones and all original weights including up to nine influences. NativeBinding, NativeRig, ActorAdapter, ObservationClock, RenderQueue and pinned Cannon are byte-identical to R03. No external body, proxy, material replacement or camera redesign is included.

LifeWorld/WindowInteraction change at their state/task boundaries. Their former whole-file hash check is replaced by five exact R03 algorithm-region hashes in qa/r04-physical-source-locks.json, together with all existing causal tests. These cover dimensions, construction, bottle task/drive/physics flow, window contact/recovery, cancellation cleanup and step logic. Force, trajectory, geometry and browser acceptance thresholds are not relaxed.

The fixed 1/120 s step, finite assisted grip, actual hinged window, permanent hinge, real support/fall outcomes, cancellation, withdrawal and native recovery remain. This is fixed-station observation, not room navigation, full-body dynamics or finger-friction simulation. Existing wrist/hand motion-quality limits remain.

## Verification and publication

The workflow builds one standalone HTML, tests its exact file in isolated Chromium, appends only a new immutable npc-life-observation/r04-20261021/<source-head>/ directory, then verifies those exact public HTTPS bytes in another real Chromium session. Previous versions and unrelated branches/trees remain. Source is a draft PR; no merge, rebase, force push or history deletion.

CPU checks retain boot/render/trace/navigation contracts and all 21 physical causal cases; they add command and state boundary cases. They are labeled fixture evidence, never native GPU/browser evidence.

The full browser suite retains 180 s cold readiness and identity-task gates, the 0.12 s observed-frame bound, full native meshes/materials/images, the 12 numerical cases, actual open/close/cancel, native recovery, resource exclusion and 390 × 844 viewport checks. A viewport test is not a physical-phone test. The three uninterrupted UI actions retain their 600 s group deadline.

New browser gates cover three rapid UI steps with individual real GPU completions on file/public runs; paused review invalidation with zero physical ticks; observer edits unable to alter an active native window task; numerical ownership rejection; explicit suite abort; and separate compact/full real UI downloads. Existing asynchronous screenshot endpoint semantics remain; PNGs are not exact-frame proofs.

## Delivery checklist

- [x] No generated image substitutes for 3D.
- [x] Production source changes address the audited defect.
- [x] The candidate runs the complete interactive native workbench.
- [x] The scene comes from the live Three.js runtime.
- [ ] Attach current exact-source file and public real-browser receipts before delivery.
- [x] Screenshot-only output is a failed delivery.

Future work remains data-driven occupation/capability assignment, room navigation/reachability, reusable skill adapters, richer motion generation and a worker/server authority transport. A planner should request skills through the command boundary; it should not set prop poses or declare physical success.
