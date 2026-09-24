# Current Best View N28 — Final Claim Closure

Status: **Candidate partial; real-run replay verified; not implemented or adopted**

1. Evidence atoms remain immutable and scope-specific: exact-source reconstruction, local browser, public bytes and public browser are separate observations.
2. A workflow/job `success` is execution metadata, not a named claim.
3. A final named claim requires a receipt generated after the last critical step and bound to exact runId, headSha, subject digest and evidence digests.
4. Missing closure is `HOLD_FINAL_CLAIM_UNSEALED`; it does not erase already verified technical evidence.
5. The finalizer may aggregate evidence but may not rewrite earlier evidence or turn missing/false into true.
6. R015.3 currently has real exact-source, public-byte and desktop/390×844 Chromium evidence; it does not have a final claim closure and does not imply iPhone, visual, Game baseline or user acceptance.
7. Trial only on Stone Money publication lane before any wider R2 consideration.

Frozen: production branches, R2 OS, public artifact, Game baseline, Canonical Truth.  
Unknown: Mother implementation, independent verifier adoption, KPI effect, real iPhone, visual and user acceptance.
