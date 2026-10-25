# Minimal installed dynamic gate

Do not add another renderer. Reuse the actual installed D.glsl, the current 1x1 RGBA32F probe, the same timeTheta, middleInclination, and installationCandidate uniforms, and compare against unchanged CPU D.pose / D.transform.

## Readback payloads

For each beta in [.11,.126,.16], side in [0,1,2], and the existing packet's distinct theta values plus the whole-render phases (.4,1.4,3.3545228223) and UI endpoints (.4,.4+2*pi):

1. `vec4(dynBig(timeTheta, side), 0., 1.)`
   - Expected `[D.pose(theta, side, betaForSide).b[0], D.pose(theta, side, betaForSide).b[1]]`.
   - dynBig is independent of beta. A single side/theta pass is sufficient; do not count repeated beta copies as new evidence.
2. `vec4(dynSmallAt(timeTheta, side, middleInclination), 0., 1.)`
   - Expected `D.pose(theta, side, side===1 ? beta : 0).s`.
3. `vec4(dynInstallation(samplePoint,1),1.)`
   - Supply current middle-port/end-zone points and compare with CPU inverse installation transform `D.transform(p,theta,{type:'installation',side:1},true,installation)`.
4. `vec4(dynSlider(samplePoint,1),1.)`
   - Supply current piston front/rear centers at the same theta, not only a generic fixed point. Compare with CPU inverse slider transform `D.transform(p,theta,{type:'slider',side:1},true,installation)`.

Record per-component absolute errors and max Euclidean vector error. Require <=4e-6 m on big, small, host, and slider independently, in addition to the unchanged steam scalar gate. A failure in any dynamic gate must make the whole numeric gate fail. Use observed GPU values, not simulated replacements. Retain the native baseline diagnostics separately without silently imposing a new baseline precision claim.

Record a SHA-256 of installed D.glsl as well as C.source and C.commonSource. The original steam packet hashes only C.source/commonSource, which cannot alone lock changes to earlier dynamic GLSL helpers.

## If dynBig still fails

The independent `dynBig-candidate-phase-proposal.glsl` is an optional, un-applied follow-on proposal. It affects only candidate dynBig and preserves baseline native sin/cos. It reduces phase to the nearest quadrant and evaluates a bounded polynomial on [-pi/4,pi/4], instead of replacing any global sin/cos macro. It is not permission to change unrelated wheel/material shaders.

The current UI uses theta in [.4,.4+2*pi], with side phase offsets [0,1.7,4.3]; phase arguments therefore lie in [.4,10.983185307179586]. The explicit float32 model certifies a wider [-16,16] phase range. Outside that range the supplied function deliberately retains native builtin behavior and makes no 4 µm claim. Only adopt after original/post-beta-fix dynBig readback demonstrates that it is needed.
