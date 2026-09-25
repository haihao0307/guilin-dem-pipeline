# N38 Current Best View — Visual golden change control

- Screenshot capture is evidence acquisition, not visual-regression verification.
- N34 already requires fixed-environment pixel evidence for reversible-state roundtrips. N38 adds only the missing golden lifecycle rule: the current candidate's producer cannot create/update the oracle and approve the same candidate.
- A qualifying golden is an immutable tuple of baseline subject/image identity, rendering environment, metric, threshold, masks/styles and independent approval receipt.
- Updating a golden is a change-control event. Preserve the old/new digests, old-vs-new diff, reason and independent approval; never erase the prior baseline.
- Keep `STATE_ROUNDTRIP_VERIFIED`, `VISUAL_REGRESSION_VERIFIED`, manual visual acceptance and user acceptance separate.
- Apply only where a stable fixed-view comparison is meaningful. Dynamic, stochastic, cross-GPU, reference-fidelity and physical-device claims need their own scoped oracles.
- Status remains Candidate partial. No global R2 change until one real Mother implementation and an independent verifier gate-run exist.
