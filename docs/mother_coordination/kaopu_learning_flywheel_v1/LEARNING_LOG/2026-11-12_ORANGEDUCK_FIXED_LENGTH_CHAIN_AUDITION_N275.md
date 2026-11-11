# KAOPU Learning Flywheel N275 — Fixed-length chain IK audition after N273

Date: 2026-11-12 (Asia/Shanghai)  
Scope: Animation Mother / Humanoid Mother  
R2 baseline: unchanged  
Production branches/assets: untouched

## One bounded question

Can a fixed-length two-bone leg-chain solve hit PR #344's **same planted-foot target** on the exact three CMU clips without the adjacent-edge stretch observed in N273?

## Current failure

N273 established that the preview overwrites only `lfoot/rfoot` horizontal XZ during contacts. It reaches zero drift by construction, but the neighbouring tibia and toe continue on their own smoothed tracks:

- max adjacent-edge delta: **44.2950369775 mm**
- max adjacent-edge relative delta: **70.9783734111%**
- decision: `HOLD_ZERO_DRIFT_BREAKS_SKELETON_EDGE_LENGTH`

## External teacher audition

Candidate: Daniel Holden, **Inverse Kinematics and Foot Locking** + `orangeduck/GenoView-InverseKinematics`.

Lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE -> AUDITION`

### What it knows beyond the Current Best View

It gives an explicit, executable route from a contact target back to an articulated pose:

1. derive the heel/ankle target from the contact target;
2. solve hip and knee with two-bone IK;
3. orient the foot/toe after the chain solve;
4. use inertialization at lock/unlock transitions;
5. for offline cleanup, jointly adjust pelvis and toe targets with soft pose-preservation and hard contact constraints;
6. clamp or tolerate some remaining slide rather than stretch the skeleton or pull the pose into an implausible crouch.

That directly answers N273's missing mechanism. It is not merely another claim that IK exists.

### Teacher Candidate checks

1. **Source / provenance** — first-party article dated 2026-07-30 and author repository; exact observed repo head `3b9920c7dd5436c5bc05f045002a64f085c69a9d`.
2. **Maintenance** — latest observed commit 2026-07-30; 19 commits in the repository. Recent enough for audition, but no release cadence is established.
3. **Runnable code / tests / data** — complete C/raylib example, Makefile, export scripts and multiple dataset adapters. The repository requires separately downloaded BVH data. No CI or automated test suite was observed.
4. **License / asset rights** — code is MIT. Animation datasets are separate inputs and retain their own licenses; the MIT code license does not grant dataset rights.
5. **Direct relevance** — exact match to N273: foot locking, contact labels, two-bone IK and offline footskate cleanup.
6. **Novelty** — permissive, recent, code-level recipes plus an explicit failure principle: preserve source motion velocity/pose; zero drift is not worth broken motion. This is more actionable for KAOPU than the restrictive UnderPressure code license.
7. **Dependencies / cost / integration risk** — C + raylib; external BVH export step; offline method uses 25,000 iterations in the example; no published KAOPU-scale benchmark. WebGPU/JavaScript integration requires an independent port.
8. **Failure boundary** — example viewer, not a production runtime; heuristic contacts can miss short fast-running contacts; no joint-limit, pole-vector, KAOPU rig, rendered visual or user acceptance proof.

Teacher status remains **`TEACHER_CANDIDATE / AUDITION`**. It is not yet `PROBATION` or `ACTIVE_TEACHER`.

Primary sources:

- https://www.theorangeduck.com/page/inverse-kinematics-foot-locking
- https://github.com/orangeduck/GenoView-InverseKinematics
- https://github.com/orangeduck/GenoView-InverseKinematics/blob/3b9920c7dd5436c5bc05f045002a64f085c69a9d/genoview.c
- https://github.com/orangeduck/GenoView-InverseKinematics/blob/3b9920c7dd5436c5bc05f045002a64f085c69a9d/LICENSE

## Exact-subject audition

The probe independently reimplemented only the teacher principle in position space. It did **not** copy the teacher's production code.

Subject:

- PR #344 head: `b6395634f0598aac144c4054aa5119f884f27722`
- pack Git blob: `8fb1c53c733832bdbf727d82f21fe01aa8fff4e9`
- clips: CMU `16_33`, `16_57`, `16_01`
- contact samples: **1,202**

Method:

- keep the smoothed hip fixed;
- use the same foot XZ anchor as the current preview;
- solve knee + ankle with the two source segment lengths;
- carry the toe from the solved ankle at its source edge length;
- clamp unreachable targets rather than stretching a bone.

Results:

| Measurement | N273 direct point overwrite | N275 fixed-length chain audition |
|---|---:|---:|
| Max adjacent-edge delta | 44.2950369775 mm | 4.4408920985e-13 mm |
| Max adjacent-edge relative delta | 70.9783734111% | 3.3581992181e-13% |
| Max horizontal target residual | 0 by construction | 2.7971575571e-14 mm |
| Unreachable contact targets | not measured | 0 / 1,202 |
| Max moved joint from smoothed input | not measured | 52.6999907015 mm |

Assertions: **4/4 PASS**

Decision: `PASS_TEACHER_PRINCIPLE_AUDITION_FIXED_LENGTH_CHAIN`

## Interpretation and boundary

The exact subject falsifies the idea that zero drift requires stretching skeleton edges. A chain solve can hit the same target while preserving the measured segment lengths.

This does **not** prove visual quality. The largest solved joint displacement is **52.70 mm**, so the next risk is no longer bone stretch; it is knee-plane choice, joint limits, popping, contact-label timing and source-pose damage. A production implementation must use local rotations/FK, not write the position-space audition result into the rig.

## Regression routing

No new near-duplicate case was created. Evidence was appended to:

`MOTION-CONTACT-LOCK-NOT-SKELETON-CONSTRAINT-001`

Lifecycle:

- `POSTED=true`
- `ACKNOWLEDGED=false`
- `CANDIDATE-IMPLEMENTED=true`
- `CANDIDATE-GATE-RUN=true`
- production `IMPLEMENTED=false`
- production `GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## Minimum next trial for Animation / Humanoid Mother

Single-clip only: `16_33`.

Implement the same target through local joint rotations and FK, with:

- explicit hip/knee/ankle/toe mapping;
- stable knee bend plane or pole target;
- joint-limit and reachability handling;
- inertialized contact transitions;
- before/after drift, edge-length, angular continuity and fixed-view rendered comparison;
- exact head-bound receipt.

A result advances only if the same candidate passes both the N273 edge sentinel and a rendered pose-continuity review. Do not change R2 or global gates from this audition.
