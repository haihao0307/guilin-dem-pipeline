# PATROL BOAT RESTART R1 — EXECUTION ORDER
## REFERENCE-FIRST / HULL MACRO-FORM ONLY

Date: 2026-09-24
Branch: `work/patrol-boat-reference-first-r1-20260924`
Clean base: `9691221d473278c05a1502e6265c4770a86e8b96`
Authority: `ops/user_authority/patrol_boat/PATROL_BOAT_USER_RECORD_ONLY_20260923.md`

## EXECUTE NOW

The previous visible patrol-boat candidates are REJECTED and must not be repaired, visually polished, copied, measured, sampled, or used as geometry/material input.

Treat the following as permanently invalid production baselines:
- old R04–R07 / B01–B12 / R001 / R002 / R4 / R005;
- old Patrol Crew lane;
- old patrol HTML / GLB / screenshots / QA / workbenches / branches;
- `PATROL_BOAT_MOTHER_R001_REFERENCE_LAB.html`;
- `日军巡逻艇_R001_真实参考测量工作台_直接打开.html`;
- `PATROL_BOAT_SOURCE_RECOVERED.glb`;
- `PATROL_BOAT_FLAG_SOURCE_RECOVERED.glb`;
- any generic, stock, game, Sketchfab, cartoon, toy, placeholder, or “similar-looking” boat used as a substitute.

Do not inspect rejected assets to “learn from them.” Their only allowed use is blacklist matching.

## STAGE 0 — SOURCE GATE

Before producing geometry, locate only the user-approved/re-uploaded patrol-boat reference material allowed by the authority file.

Record:
- exact source filename(s);
- byte size;
- SHA-256;
- source type: photo / drawing / GLB / other;
- what views or dimensions the source actually supports;
- what cannot be known from the source.

If approved source bytes are not actually available, STOP geometry work and report exactly:

`SOURCE_BLOCKED / NO_APPROVED_REFERENCE_BYTES`

Do not search for or load a replacement boat. Do not make a provisional hull from memory.

A source blocker is local: it must not be disguised as progress, but it also must not cause new meta-work, alternative concepts, or substitute assets.

## STAGE 1 — THE ONLY ALLOWED PRODUCTION TASK

Build one new hull macro-form candidate from the approved reference.

Nothing else.

Do NOT build or add:
- engine;
- exhaust;
- propeller;
- rudder;
- steering wheel or steering linkage;
- flags or flagpole;
- crew;
- weapons;
- numbers;
- ropes;
- cargo;
- weathering;
- paint chips;
- rust;
- smoke;
- decorative fittings;
- microscopic surface detail.

The purpose of Stage 1 is to answer only:

**Does the new 3D hull read as the same boat at first look?**

### Required hull relationships

Judge only broad, source-supported form:
- overall length-to-beam relationship;
- bow rake / curvature / fullness;
- sheer line;
- gunwale height and continuity;
- hull side flare/tumblehome where supported;
- bottom/keel relationship where supported;
- stern width, rake and closure;
- waterline relationship;
- interior opening/deck boundary only where it materially changes the silhouette;
- continuous hull volume with no holes, floating panels, interpenetration, or blocky toy construction.

“Macro-form only” does NOT permit a crude low-poly/cartoon proxy. Use enough continuous geometry to reproduce the reference silhouette and major sections honestly.

Do not import old dimensions such as 4.81 × 1.419 × 1.259 m. Any new dimensions must be measured again from the approved new reference and labeled with their evidence/uncertainty.

## REFERENCE-FIRST FIRST SCREEN

The first screen of the workbench must be reference vs candidate. No splash page may hide this.

Deliver exactly one user-facing artifact:

`PATROL_BOAT_R1_REFERENCE_FIRST.html`

Requirements:
- standalone, double-click `file://` works;
- fixed public HTTPS entry also published;
- no iframe model substitute;
- no Sketchfab/runtime dependency for the candidate;
- candidate is real interactive 3D;
- source reference and candidate visible together on first look;
- same comparison scale and matched camera where the source type permits;
- neutral material only so texture cannot hide form errors.

Required fixed views:
1. side;
2. top;
3. bow;
4. stern;
5. three-quarter hero.

For each fixed view show:
- REFERENCE;
- CANDIDATE;
- current candidate head SHA;
- source SHA;
- `CURRENT_LARGEST_DEVIATION`.

If the reference is photographic rather than 3D, keep the photograph undistorted and match the candidate camera to it as closely as defensibly possible. Do not invent unseen geometry and then claim it was measured.

## R4.2 ACCEPTANCE GATE

Stage 1 cannot be promoted because tests are green.

Required states are separate:

- `SOURCE_IDENTITY_PASS`
- `CANDIDATE_REAL_3D_PASS`
- `REFERENCE_VS_CANDIDATE_FIRST_LOOK_READY`
- `DESKTOP_BROWSER_PASS`
- `MOBILE_390x844_BROWSER_PASS`
- `CONSOLE_ERROR_COUNT=0`
- `PUBLIC_FIXED_URL_PASS`
- `STANDALONE_FILE_PASS`
- `USER_VISUAL_ACCEPTANCE=false` until the user explicitly approves the hull

Tests verify delivery and implementation. They do not prove the hull looks right.

If first-look morphology is visibly wrong, correct the hull before touching any mechanical or surface detail.

## BREADTH BEFORE DETAIL

Do not enter detail tunnel.

The sequence is locked:

1. approved reference identity;
2. hull macro-form first look;
3. user approval of hull;
4. mechanical architecture;
5. engine/shaft/propeller/rudder/steering chain;
6. materials and aging;
7. flag / fittings;
8. crew / weapons / role poses;
9. game behavior.

No later stage may start early “to show progress.”

## STAGE 2 — LOCKED UNTIL USER HULL APPROVAL

Only after explicit hull approval may the next task expose and build the real mechanical chains:

`engine -> coupling/reduction if evidenced -> stern tube -> shaft -> propeller`

`steering input -> steering mechanism/linkage -> rudder stock -> thin rudder behind propeller flow`

`crew control -> throttle/governor/clutch control -> drivetrain response`

No visible mechanical part is allowed without an input-transfer-output relationship or clear source evidence.

## DELIVERY RECEIPT

A valid Stage-1 delivery must include:
- exact base SHA;
- exact head SHA;
- changed production files;
- source identities and hashes;
- generated HTML byte size and SHA-256;
- actual desktop browser result;
- actual 390×844 browser result;
- fixed public URL test result;
- standalone file test result;
- console/page errors;
- screenshots for all required fixed views;
- `CURRENT_LARGEST_DEVIATION`;
- known limitations;
- explicit `USER_VISUAL_ACCEPTANCE=false`.

Planning docs, comments, branches, task receipts, or “work started” statements without a real candidate + executed browser evidence are:

`NOT_STARTED / NO_NEW_ARTIFACT`

## FAILURE MODES

Immediately reject and do not publish as a candidate if any of these occur:
- generic/stock/substitute boat;
- cartoon or toy hull;
- old rejected patrol asset reused;
- source missing but geometry invented anyway;
- candidate hidden behind textures/weathering;
- page opens but boat is not visibly rendered;
- screenshot/2D image substituted for candidate 3D;
- external iframe presented as the produced boat;
- detail work begins before hull approval.

## FINAL COMMAND

Do not explain the plan back.
Do not create more planning documents.
Do not resurrect the old boat.
Do not “improve” R005.

Either:
1. produce the Stage-1 Reference-vs-Candidate hull workbench and executed browser evidence; or
2. return the precise source blocker `SOURCE_BLOCKED / NO_APPROVED_REFERENCE_BYTES`.

Nothing else counts as progress.
