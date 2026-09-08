# Wenzhou architecture gate R1

Scope: internal executable audit of PR #67 at `7a0be68a3a71506638c1b425a5bc0872700a3b0b`.
No new user-facing pilot, production geometry, canonical data or global address
format is introduced. Existing V0.1 score, indexes, QA and ZIP remain intact.

## Run from repository root

```sh
python projects/wenzhou/architecture-gate-r1/gate.py --report /tmp/wenzhou-gate.json
python -m unittest discover -s projects/wenzhou/architecture-gate-r1 -p 'test_*.py' -v
python projects/wenzhou/architecture-gate-r1/fullpage_probe.py
```

Requires NumPy 2.3.5, matching the reviewed builder environment.
Both audit commands intentionally return **2** while expansion is blocked.
Exit **1** means evidence could not be validated. `--check-evidence` returns **0**
when the audit ran successfully, even if `expansionAllowed=false`; it is only for
testing the audit implementation, never a production promotion gate.

## Measured findings

The independent scalar decoder reproduces both existing real pages exactly for
exact-truth and archive-scan, with unchanged NoData. It does not call the
producer's inverse or trust the stored `QA.passed` flag.

On the river seed, hydrology-analysis changes 165 of 900 eligible interior D8
directions, with maximum height error 11 m. Physics-corridor changes 145 height
samples, with maximum height error 1 m. D8 is a local diagnostic using steepest
positive descent, fixed tie order and complete valid 3x3 neighborhoods. It does
not measure whole-watershed correctness or replace hydrological acceptance.

Each existing 32x32 seed is viewed as four overlapping 17x17 subwindows with two
shared rows/columns. No sample is interpolated. Across 32 pair/precision checks,
22 have unequal shared heights; maximum difference is 22 m and maximum shared
first-difference disagreement is 9 m per sample interval. Full-band comparisons
agree exactly. These subwindows are regression fixtures, not four new full-size
Canonical pages and not a benchmark for the whole Wenzhou region.

The candidate local address probe checks 37,709 axis sample centers, 60,000 routing
roundtrips across three page sizes, and rejects four invalid Q0.64 inputs. This
does not prove global closure or point uniqueness on the sphere.

## Identity discrepancy

The PR body advertises score SHA256
`891968008875d632dffcd958a9e83cc6a35bf8c19b23696a5d112e9a94f2e3bb`.
The checked-out score bytes at the reviewed commit, its index and conductor files
instead agree on
`2d9cc9ee0c3e26fa47e3e3784dc2a9a5533907502ea0539098b2a75b4256202f`.
The score Git blob is `650e83dec6c269a0bffee7c9f7e99cc25fd51648`, 1,559 bytes.
R1 pins these actual bytes and separately records the PR text discrepancy.
The score ID itself agrees. This audit does not rewrite the PR description.

## Recovered full-size page evidence

The full handoff was subsequently located and materialized. All 52 outer payloads
and 43 core payloads passed their recorded byte-size/hash checks. The full numeric
store and index match the PR's R2.2.1 source hashes. The new independent modular
Lorenzo reader checked 56 cold records and reproduced both existing PR seeds.

Four 2x2 page neighborhoods cover river, coast, south edge and east edge. Candidate
cores are 512 samples with one sample halo, up to 514x514 decoded samples. Southern
and eastern final pages are clipped to the actual locked dimensions. The frozen
fixture archive is 2,117,403 bytes; it retains exact source values and NoData.

Applying all six V0.1 selection policies to these candidate pages, the independent
decoder confirms full-band recovery and exact/exact shared heights. **336 of 576**
mixed-policy boundary comparisons disagree. Maximum shared-height difference is
**35 m**, and first-difference disagreement is **13 m per sample interval**.
These are CPU numerical results; no GPU, normal-vector renderer, global closure
or human visual acceptance is implied. Five transform levels are intentionally
retained from V0.1; the final multiscale format has not been approved.

Re-extract from the previously downloaded core without importing TIFF:

```sh
python projects/wenzhou/architecture-gate-r1/extract_adjacent.py --core /path/to/WENZHOU_CANONICAL_CORE_R2_2_1 --out projects/wenzhou/architecture-gate-r1/fixtures
```

The extractor rejects missing cold records. The source format omits all-invalid
tiles, as recorded in its build ledger, but this extractor does not infer or
synthesize those omitted tiles. The southeast all-invalid corner is not covered
by these fixtures.

## Data availability and decision

The reviewed branch tree contains the two seeds. The locked R2.2.1 numeric store
was recovered from the user's full handoff, not an older V0.4.0 release.
The root Guilin contract and older Wenzhou kernel truth are distinct sources;
neither is used in this audit. See SOURCE_RECEIPT.json for recovery identities.

See REPORT.json for recomputed evidence and ADDRESS_AND_TASK_CONTRACT.md for
acceptance requirements. Global closure, mixed-precision shared pages, task calibration,
GPU/cancellation, full-domain conversion and human visual acceptance remain open.
The next production work should resolve shared-boundary dependencies and task
precision before bulk conversion. All production/visual flags remain false.
