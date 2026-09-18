# Current Best View — N19 Farmland fixed-view screen space

Status: **Candidate partial / pinned R045.27 CPU projection and style replay verified**

1. World-space terrain change, sampled mesh change, locked-camera screen response and human acceptance are separate receipts.
2. In the R045.27 fixed view, all `316` active rendered vertices moved less than `0.25 px`; the maximum was `0.143220 px` and `92.405%` moved less than `0.1 px`.
3. A denser support sample also remained below `0.147 px`; a tenfold-height negative control produced an approximately tenfold projected response, confirming a live test.
4. The audit's normal and continuous HSL/RGB style formulas respond, but weakly. They are renderer-formula evidence, not calibrated perceptual or device evidence.
5. The plan panel normalizes each delta by that round's maximum. It proves support/sign and planform separation, not unnormalized perspective salience.
6. R045.27's numeric pass and visual rejection are compatible. Do not infer that height amplification is the correct fix; preserve the footprint-first R045.28 experiment and test its screen-space result separately.
7. Promotion still requires completed Mother numeric/browser receipts, the unnormalized fixed view, and actual human acceptance.

Canonical Truth, Frozen R1, production branches, terrace/parcel locks and hydraulic evidence boundaries remain unchanged.
