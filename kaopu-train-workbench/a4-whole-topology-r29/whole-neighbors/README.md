Whole-train neighboring-field negative witnesses; no geometry edits.

From the workbench directory run:

    node whole-neighbors/broadphase.js
    node whole-neighbors/export_frames.js
    python whole-neighbors/verify_witnesses.py --verify-only

The first two commands regenerate source/frame caches, not rendered geometry. Default verifier without --verify-only intentionally exits 1 because current whole model fails. The 23 negative witnesses include 8 possibly intended shaft/head unions; 15 are current-model blockers. Real frame slots are documented, but omitted in current simplified fields; do not infer real A4 collision or carve unmeasured slots. Middle-cylinder conflicts remain independent.
