# Motion modes inside the original shared-person workbench

The original `index.html` and `full/index.html` remain the entry points. The mode panel uses the existing renderer, canvas, camera and parameter controller. Original presets, advanced parameters, archived parameters, R02 boxing and shape-study links remain available. No iframe or new presentation page is used.

## This release

- A selected full canonical person can play captured walk-to-stop, run-to-stop and small-jump clips, with the original 104 native bones and all CSR influences (25,417 vertices / 50,624 triangles). Captured activity V4 preserves target bone lengths, calibrated sole support, the original neutral neck/back, and actual jump flight. Offline source filtering is distinct from online opponent observation.
- A 24-second hand/body sequence demonstrates open hand, reference fist, authored carry target and reach-turn. The reference fist is not a passed tight-fist/contact result. Props are kinematic task targets; load-bearing, drop and throw physics are not implemented.
- The blue person reacts to the orange controlled attack using past measured world-space bone points. Direction, delay, distance and quiet counterfactuals are exposed. The response is fixed-support evasion/guard, without learned neural inference, stepping retreat, impulse resolution or automatic counterattack.
- Actual full-surface glove/body prediction rejects a penetrating proposed jab and withdraws through a continuous whole-body task. The yellow point denotes predicted contact on a rejected trial, not a solved impact. Accepted clearance is measured for the selected pair; it is not a universal fixed 0.232 mm guarantee.

The exterior multi-person simultaneous activity area is still unfinished. This release is the single-selected-person stage plus the two-person reaction/contact comparison. It does not update or claim completion of the separate 18-arena R03 boxing candidate.

## Verification

Full browser QA at `6d4cc866ac0b4c87532308ecfca4fb8d25cfffd5` used real Chromium/SwiftShader: full/side/feet/hand views, pause/reset/slow controls, same-canvas switches, multiple body shapes, 3,500 rendered-buffer-equivalent full-CSR sole frames, and exact original state/geometry restoration. V4 walk/run/jump have new continuous offline fixed-step videos; unchanged hand/reaction/contact videos are from `fa1ca0cec6216eeb9d727290dafde8ad7475cff1`. Offline replay is not a real-time throughput claim or a physical-device mobile benchmark.

The motion drivers require the Anny native 104-bone rig and a neutral manual body pose. MHR/manual-pose configurations fall back to the original parameter view without rewriting those parameters. Public smoke verification separately checks this preservation path against the final deployed files.
