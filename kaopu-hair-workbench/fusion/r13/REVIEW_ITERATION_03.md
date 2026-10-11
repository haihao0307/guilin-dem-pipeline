# Boundary failure kept as a regression, not waived

The rear-flow correction source20667efeba5e947953b1e4d2e4378d48afdf609a failed the unchanged160mm boundary check in Actions38123554093. This run did not publish. Local original-GNM diagnostics isolated two non-ear final-segment crossings in the micro-fringe160mm case; the140mm sample remained clear. Both endpoints were outside, but the chord crossed temple/crown triangles8592 and22300. Their exact input coordinates are now frozen in tests/length-boundaries.mjs.

A new `HeadSegmentGuard` runs exact original-head segment/triangle checks on the generated guides and final follower polylines after ear correction. On actual intersections it moves only non-root endpoints outward from the contacted triangle plane and rechecks. Roots, density and style parameters remain unchanged. It counts unresolved segments and maximum displacement; it does not pretend to implement dynamics, self/shoulder/cloth collision or a continuous swept-radius proof.

The original eight-thousand-root computational fixture was rerun for all three styles at55/160mm, sampling800 strands and19,200 segments per case. All six post-fix cases had zero sampled inside vertices and zero sampled triangle crossings. This local numerical result is not a browser success and is not inherited by the next fixed webpage; native browser tests and actual public delivery still have to pass separately.

A700-root original-GNM parameter audit additionally checked11 macro controls in each of the3styles. All33 tested edits changed real curves while preserving root hashes and finite geometry. This is a finite numerical control audit, not a claim that every extreme combination has passed visual/collision testing.
