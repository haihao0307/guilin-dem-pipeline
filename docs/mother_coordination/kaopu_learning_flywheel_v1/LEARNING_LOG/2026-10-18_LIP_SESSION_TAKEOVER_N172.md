# N172 — Interrupted lip-session takeover must fail closed

Date: 2026-10-18 (Asia/Shanghai)  
Track: institution / external teacher candidate  
Bounded question: **After a conversation/tool-permission failure interrupts an in-flight GitHub operation, may a new session continue from the last assistant prose, or must it first rebind the exact branch/head and resolve the mutation receipt?**

## Baseline read

- Main baseline: `5543f756ca3af1428323696324303fa70b8de850`.
- R2 OS, the reference-replication gate, freshness gate and root `AGENTS.md` remain the governing baseline.
- #91 latest applicable coordinator state remains N170; #63 has no newer applicable production feedback.
- PR #303 head remains `3cc02b999bc9b5bc9310194e65950948500740d3`; no newer commit or Mother acknowledgement was observed.
- The user's new evidence shows: repeated `继续`, a generic conversation failure, and a GitHub `Create Blob` permission prompt. The user then opened a new conversation to locate the lip branch and continue.

## Existing failure and observation

The last assistant prose said that the third round was still running, but the screenshot did not bind a live workflow/run receipt. The permission prompt establishes that a GitHub blob mutation was proposed; the later generic failure does not establish whether it was allowed, denied, completed, or never dispatched.

Current evidence state:

`PR_HEAD_VISIBLE_AT_3CC02B9__SESSION_EXECUTION_INTERRUPTED__CREATE_BLOB_RECEIPT_UNKNOWN`

This does **not** prove a lip-code failure. It also does not prove that no Git object was created. It proves only that no newer branch-visible PR commit was observed at refresh time.

## Existing regression binding

No duplicate regression was created. The event binds to mandatory `MOTHER-NO-THINKING-STALL-R3-001` (canonical commit `c18674f31d76e8a44cb809426568609bbe67bf04`):

- a Mother must not wait for repeated `continue` when a next executable step exists;
- an exact capability blocker receipt is required;
- the same blocker across two attempts escalates to `ESCALATE_COMMON_CAUSE`.

N172 adds only the missing executable takeover interpretation at the Git-object / branch-ref boundary.

## External method and teacher screening

Candidate: GitHub Git-database object and reference semantics.

1. Source/provenance: official GitHub REST documentation for blobs, commits and references.
2. Maintenance: live official REST documentation, retrieved 2026-10-18; examples advertise API version `2026-03-10`.
3. Reproducibility: blob creation returns a blob SHA; reference reads return the branch commit SHA; reference update is a separate endpoint.
4. License/rights: method semantics only; no external code or asset was imported.
5. Direct relevance: the observed approval prompt was specifically for GitHub `Create Blob`.
6. Novelty versus KAOPU Current Best View: existing freshness checks bind a tested subject/head, but did not explicitly distinguish an object-creation receipt from a branch-ref receipt after an interrupted tool call.
7. Cost/risk: read-only ref inspection is cheap; a missing blob SHA cannot be reconstructed from a generic UI error, and an unattached object is not discoverable merely by reading the branch head.
8. Demo/closed-data/version risk: none for the documented API semantics; ChatGPT's internal tool-dispatch outcome remains outside the GitHub evidence and therefore `UNKNOWN`.

Status: `TEACHER_CANDIDATE`  
Lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE`

**What exactly does it know beyond KAOPU Current Best View?** A successful `Create Blob` call creates a content object and returns its SHA, while a branch is a separate reference pointing to a commit and moves only through a reference update. Therefore an unchanged branch head is evidence of no branch-visible commit, not evidence that an interrupted blob call definitely did not occur.

Sources:
- https://docs.github.com/en/rest/git/blobs?apiVersion=2022-11-28
- https://docs.github.com/en/rest/git/commits?apiVersion=2022-11-28
- https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28

## Falsifiable hypothesis

If safe session takeover requires an exact checkpoint rather than conversational prose, then a takeover classifier will reject or hold every fixture with a stale head, missing task anchor, unbound run liveness, or unknown mutation receipt, while allowing a write only when the branch/head and mutation outcome are bound and a concrete next command exists.

## Minimum trial

1. Resolve `taskId`, PR/branch and current head from GitHub, not from the previous assistant sentence.
2. Record the last completed artifact and exact next concrete command.
3. Bind any claimed running job to a live workflow/run receipt; prose alone is not liveness evidence.
4. Classify the interrupted mutation as `CONFIRMED_SUCCEEDED`, `CONFIRMED_FAILED`, `NOT_ATTEMPTED`, or `UNKNOWN`.
5. If `UNKNOWN`, prohibit writes and permit only read-only diagnostics until a receipt/deduplication key is recovered.
6. If the head differs from the bound head, reject the stale takeover and re-anchor before executing.
7. After the same blocker twice, emit `ESCALATE_COMMON_CAUSE` rather than another `continue` loop.

## Candidate artifact and replay

- `PROBES/lip_session_takeover_n172.mjs`
- `PROBES/fixtures/lip_session_takeover_n172.json`
- Deterministic replay: 7/7 fixtures passed.

This is classifier evidence only. No production mutation, browser rerun, workflow rerun, or lip asset implementation was performed.

## Boundary and routing

- PR #303 production files and Mother branch were not modified.
- No production acceptance, adoption or user acceptance is claimed.
- Mother routing: `NOT_QUERIED`.
- Lifecycle: `POSTED=false; ACKNOWLEDGED=false; IMPLEMENTED=false; GATE-RUN=false; ADOPTED=false; USER-ACCEPTED=false`.
