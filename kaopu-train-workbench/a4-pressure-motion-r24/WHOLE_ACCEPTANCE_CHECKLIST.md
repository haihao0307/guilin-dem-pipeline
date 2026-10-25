# Whole-train research acceptance checklist

No completed locomotive claim is justified. Baseline and all candidate branches must keep the full assembly visible; component tests are internal evidence, not standalone deliverables.

Verified in the current 519-field baseline:
- All 513 preserved analytic fields plus six inferred support fields compile and render in the same depth-tested WebGL scene.
- Wheel angular rates correspond to the same body-local travel; 23 drive and 30 actuation fields move from one phase variable.
- Fixed-length rod closure and slider-line algebra match preserved Python scalar fields.
- Six inferred crankpin support webs bridge the missing hub/pin load path through hub overlap and coaxial bore contact.
- Whole renders at changed phase differ; identical phase returns identical pixels in the recorded browser run.

Failed or incomplete:
- The middle rod intersects the leading driven axle in the preserved baseline. This failure remains independently reproducible.
- Middle-cylinder installation and rod length are inference. A local collision-free installation family does not determine historic dimensions or prove saddle support, valve registration, steam connections, suspension clearance or global swept safety.
- Valve train geometry is frozen. Middle valve placement and finite-motion Gresley/Walschaerts relationships are unverified.
- Piston ring packs in the retained baseline are frozen. R24 candidate mode now moves all three with their respective pistons, checked numerically; detailed grooves/elastic sealing and R24 GPU validation remain unresolved.
- Complete steam/feed piping, brakes and cab controls are missing; saddle load paths are not established.
- The materials are diagnostic colors. Required analytic surface/material waves have not yet been implemented as finished train appearance. No wave may be used to hide a mechanical collision.
- True realtime rendering is not demonstrated. Recorded GPU readback takes seconds, even though JavaScript submission is much faster.
- Finite ray-march/subdivision budgets are not a proof of complete surface recovery. No global continuous collision certificate or structural stress validation exists.

Provenance gate: per-parameter source/official/inferred ledger is incomplete for the recovered 513 fields. Preserve research attribution, do not publish this as an attribution-free, all-original or exact 60009 final product.
