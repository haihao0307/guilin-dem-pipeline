# Captured walk-to-stop, native character candidate

CMU Graphics Lab Motion Capture Database, subject 16 trial 33: `slow walk, stop`, 285 frames at 120 Hz. Source data: http://mocap.cs.cmu.edu/subjects/16/16_33.amc and http://mocap.cs.cmu.edu/subjects/16/16.asf . The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

CMU permits research and inclusion in commercially sold products, but prohibits reselling the data directly, including converted forms. See https://mocap.cs.cmu.edu/ . This is an application-embedded transformation of that captured movement, not an independent data sale. Source video is not bundled.

Our independent implementation parses calibrated ASF/AMC joint frames, maps source segment directions and root travel onto the existing 104 native bones, preserves target bone lengths, solves two-link limb constraints, retains captured heel/toe roll, calibrates actual sole vertices, and lowers the pelvis only where stance reach constraints require it. It uses the published native FK/IK math from `../boxing/Motion.mjs` without calling any boxing timeline.

`NativeWalkRetarget(options, source).evaluate(seconds)` returns native skin/posed matrices, exact local-reference degree rotation vectors, root translation, and foot diagnostics. The source ends at 2.3667 seconds; the final captured stop is held. It does not loop or teleport. `reset()` starts the clip again.

Options: `names, parents, restMatrices, stature, floorOffset, solePoints:{L,R}`. Sole points must come from the actual neutral character in native Z-up metres; they are not generic shoe proxies. `WalkActivityActor.mjs` shows the complete full-CSR extraction and scene-embedding path.

This candidate has 36-shape native numerical tests and four full-surface case tests. Visual quality remains subject to actual integrated browser review. The ankle intentionally moves during heel/toe roll; ankle displacement must not be reported as sole sliding. No new neural teacher weights were run. This module currently provides walking and a recorded stop only; running, jumping, carrying and throwing are separate unfinished tasks.
