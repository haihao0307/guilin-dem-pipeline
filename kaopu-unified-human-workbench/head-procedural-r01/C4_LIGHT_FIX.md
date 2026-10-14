# Actual active-light binding fix

C4 attempt38535391916 passed all12 core candidate gates and all15 individual surface controls, native jaw editing, gray and archives. It failed the new independent lighting pixel gate, and was NOT published. Artifact11879804364 preserves the failure and real candidate PNGs.

Source inspection exposed the cause: the inherited native setFoldLook disables top-level scene lamps and uses nested foldLights.key/fill/ambient. The first C4 control changed hidden top-level lamps; a numerical light report was not proof of a visible change. No test was removed or its exact pixel roundtrip tolerance relaxed.

The corrected implementation binds named active lamps, restores our previous numerical override before the original native controller runs, then snapshots its current result. Neutral mode changes only active lamp colour/intensity just before draw. Native mode therefore retains native lighting controls and presets rather than continuously overwriting them with a stale installation snapshot. Positions, targets, visibility and ear inspection light are untouched. The geometry-derived ear visibility continues to use the same light directions.

The gate now checks all targeted lamps are effectively visible and includes exact framebuffer hashes and light-state diagnostics on failure. Success still requires different native/neutral pixels and identical neutral roundtrip pixels. Public delivery requires a new successful candidate and exact-public run, not the old C3 proof.
