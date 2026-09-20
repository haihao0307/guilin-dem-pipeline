# Current Best View N25 — SMI nearshore bed consumers

Status: **Candidate partial**.

PR #100 has verified a reversible `SMI_WAKE_BAY_R01` adapter for the `waveSurface` bed read in a software WebGL2 path. N25 shows that this is not yet full renderer parity: the fixed release still computes vertex shallow depth and `vThickness` from legacy `bedH`, while fragment shoreline foam/breaker bands still read legacy `smiShoreDistance`.

At the authoritative mean-water crossing, the remaining legacy `vThickness` is `0.18 m` while authoritative thickness is `0 m`; the scene's actual foam visibility gate evaluates to `1` versus `0`. This proves a same-coordinate downstream state conflict, not the exclusive cause of the full-scene visual defect.

Current minimum contract: version displacement bed, shallow-depth bed, thickness, shoreline distance and CPU contact bed as explicit consumers of one coordinate/unit/profile interface. Preserve exact legacy behavior outside the local blend. Promotion requires same-coordinate CPU/GPU checks, full-scene desktop and `390×844` evidence, cost, Mother implementation receipt and user visual acceptance.

Frozen deep ocean/cloud, global legacy bed, production entry and canonical contact truth remain unchanged. No production algorithm is selected or adopted.
