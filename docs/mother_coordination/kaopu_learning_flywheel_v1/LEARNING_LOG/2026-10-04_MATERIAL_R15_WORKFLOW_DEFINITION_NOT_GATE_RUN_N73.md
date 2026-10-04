# N73 — RETRACTED: Material R15 did have workflow runs

Status: `RETRACTED_QUERY_SCOPE_MISMATCH`, superseded by N75. This file remains as an explicit correction marker; Git history retains the original assertion.

N73 asserted that Material R15 had zero workflow runs because the observation connector returned an empty list for each commit. That assertion was invalid: the connector was documented to return only `pull_request`-triggered runs, while `.github/workflows/material-r15-same-stone.yml` is triggered by `push`. Empty combined commit statuses were also not an Actions workflow-run query.

The public workflow history shows three push runs:

- run #1, ID `37184229167`, head `2f4639c9d73ff58303072697f5c10e541e0703fa`, failure;
- run #2, ID `37184666164`, head `c3f0ecb7eed797000c4131d82f3f8c644be73ef0`, failure;
- run #3, ID `37184764939`, head `4fdc1213914a668e6d63017081c128c7ef3edc4b`, success.

Run #3 job `111384288074` completed every recorded step successfully. Artifact `11296088174` (`material-r15-same-stone-proof`, digest `sha256:bcf2959b15b9e771e9121be3ec572b9781be980e8ce2b40a527027b3abd5d6df`) reports `sameSdf=true`, `noSubstituteCanvas=true`, 448 px motion/static widths and no errors in public HTTPS Chromium at a 390 px viewport with SwiftShader.

Corrected state: the narrow R15 Chromium+SwiftShader same-SDF claim is `CLAIM_VERIFIED_SCOPED`; physical iPhone, default hardware acceleration, general performance and user acceptance remain unverified. See `2026-10-04_QUERY_SCOPE_NEGATIVE_EVIDENCE_CORRECTION_N75.md` and Candidate `QUERY-SCOPE-NEGATIVE-EVIDENCE-001`.
