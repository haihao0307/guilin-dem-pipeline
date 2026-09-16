# Current Best View W03 — Water event identity and replay

Status: **Candidate partial / official-source identity-time contract and CPU counterexamples verified**

W01 directed volume fluxes and W02 interval semantics now also require immutable delivery identity and replay rules. Use `source + id` for event identity, seal the domain payload, retain phenomenon interval separately from result/arrival chronology, and distinguish mutations from reports.

Exact re-delivery is a no-op; changed content under an existing identity fails closed. Corrections are explicit, monotonic, scope-matched supersessions. Late unique events and accepted corrections invalidate later derived state and are replayed from a checkpoint in canonical phenomenon-time order. They are not directly appended to current nonlinear state, and a replacement is not added beside its predecessor.

CloudEvents and OGC support the identity/time distinction, but do not themselves specify payload hashes, supersession or replay; those remain KAOPU Candidate methods supported by the synthetic capped-storage counterexample.

Checkpoint durability, concurrency, target runtime, real hydrology and Mother adoption remain Unknown. Frozen R1, Canonical Truth and production Mothers are unchanged.
