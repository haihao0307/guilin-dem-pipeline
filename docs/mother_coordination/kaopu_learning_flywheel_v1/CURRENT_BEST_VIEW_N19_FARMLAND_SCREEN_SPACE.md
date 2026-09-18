# Current Best View — N19 Farmland fixed-view screen space

Status: **Candidate partial / pinned R045.27 and R045.28 CPU projection and style replay verified**

1. World-space terrain change, sampled mesh change, locked-camera screen response and human acceptance are separate receipts.
2. In the R045.27 fixed view, all `316` active rendered vertices moved less than `0.25 px`; the maximum was `0.143220 px` and `92.405%` moved less than `0.1 px`.
3. R045.28's footprint-first change also remained small in the same camera: all `422` active vertices moved less than `0.25 px`, maximum `0.183362 px`, with `88.626%` under `0.1 px`.
4. Dense support maxima were `0.146297 px` and `0.178489 px`; tenfold-height negative controls produced approximately tenfold responses, confirming live tests.
5. The audit's normal and continuous HSL/RGB style formulas respond, but weakly. They are renderer-formula evidence, not calibrated perceptual or device evidence.
6. The plan panel normalizes each delta by that round's maximum. It proves support/sign and planform separation, not unnormalized perspective salience.
7. Both rounds' numeric passes and visual rejections are compatible. R045.28's footprint-first logic was causally disciplined but insufficient; do not infer that height amplification is the correct next fix.
8. Promotion still requires Mother numeric/browser receipts, the unnormalized fixed view, and actual human acceptance.

Canonical Truth, Frozen R1, production branches, terrace/parcel locks and hydraulic evidence boundaries remain unchanged.
