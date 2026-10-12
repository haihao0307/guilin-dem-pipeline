# Candidate residency optimization

Scope: equivalent execution of the current resolver, not a new architecture, material or level of detail.

For each native candidate with nominal field d, every possible value used by the retained resolver lies in [d−.03001,d+.03001]. Near the surface the locked geometry displacement interval is inside [−.021,+.006] (wood within ±.0003, stone ±.004, metal and concrete within ±.001); away from the surface the retained stepping branch offsets by at most .03. The extra .00001 is outward engineering margin, not a formal IEEE builtin error certification. Nonnative values are exactly d.

Maintain U as the minimum upper endpoint among recorded candidates. U bounds the final minimum from above. A candidate whose lower endpoint exceeds U cannot win. Dropping it does not change the winning value, full construction coordinates, source identity or strict-less-than tie order. At resolve time, repeat that test against final U so earlier surviving candidates may also be skipped.

The original sequential resolver decides whether to evaluate a material using d−.03<h.d. Removing a nonwinning provisional winner does not alter the eventual winner: any potentially winning candidate has lower endpoint ≤U, while a removed provisional winner is strictly above U. Such a candidate therefore still takes the same evaluation branch whenever it could affect the final answer. Candidates that only change a nonwinning intermediate value cannot affect the final min.

The raw candidate count increments before pruning. Any original count above capacity still fails with id999. Retained count never exceeds raw count. No ingredient, surface, normal or matter function is removed, and no shader/material mother is edited. The original array capacity and final hit semantics stay intact.

CPU regression exercises more than 700,000 candidate records with f32 arithmetic, positive/negative near and far fields, native/nonnative identities, duplicate ties, retained order, and raw overflow. This is regression support for the argument; real GPU/backend and whole-frame verification remain required.
