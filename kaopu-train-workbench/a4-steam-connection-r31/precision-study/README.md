# R31 bounded-coordinate and algebraic-fillet precision study

This is a portable CPU-only diagnosis/proposal. It contains the unchanged original source, the complete original 1,068-sample packet split into <=28 KB chunks with an exact-byte/SHA-256 reconstruction loader, and the actual failed GPU report including all 58 failures. It does not require a neighboring checkout, npm packages, a browser, network access, or external writes.

Run from any directory:

    node /path/to/precision-study/run.js

## Observed failure and localization

The retained first GPU run executed 1,068 samples, with 58 errors exceeding the unchanged 4e-6 m tolerance, 12 unsafe sign differences, maximum error 0.0009701266288757327 m, and GL error 0. These are actual failures, not a pass.

- The six middle-cylinder center-port witnesses are on the final straight segment. Their 0.000752–0.000970 m errors cannot be explained by the arc's atan/acos computation alone.
- Front/rear center residuals scale approximately with station (5.128/4.372). The corresponding x-offset edge residuals agree with sqrt(0.014² + centerResidual²) − 0.014. This localizes the dominant error to a shifted beta-dependent centerline, rather than a wrong radius or changed topology.
- The installed D.glsl was inspected: there are no sin/cos macros or redefinitions. The only R31 macro is the helper include guard.
- An explicit binary32 arithmetic model, with accurately rounded native trig, gives maximum 4.875808954241806e-7 m over the same 1,068 samples. Ordinary binary32 coordinate/operation rounding is therefore insufficient to explain the observed drift.
- The later actual GPU primitive readback confirms the dominant root cause: original runtime builtin sin/cos accuracy. At beta=.126, GPU sin=.12565064430236816 versus CPU .12566686854972925; GPU cos=.9918923377990723 versus CPU .9920724964179307. Original spCylinderPoint z=4.360427379608154 versus CPU 4.361217659363641. The raw builtin expression and installed helper agree. This is not ordinary binary32 rounding or a CPU/GLSL topology mismatch. The actual original inverse host transform and dynSmallAt also drift; ORIGINAL_NUMERIC_DIAGNOSTIC.json preserves those readbacks. An independent dynBig readback is still needed to isolate arbitrary-phase error after fixing the beta axis. CPU emulation itself is not GPU proof.

## Steam helper proposal

steam-path-precision.patch changes only the GLSL helper implementation and SPFillet's private GLSL representation. The original CPU geometry remains the independent truth. Parameters, all part/cut ASTs, routes, domains, status, and CPU function bodies remain unchanged. There is no threshold relaxation, mesh, new clock, geometry offset, or coordinate snapping.

1. spCylinderPoint uses explicit sine degree 7 and cosine degree 6 polynomials, only for beta = 0 or beta in [.11,.16]. At |beta| <= .16, Taylor remainders are bounded by .16^9/9! = 1.8937245573192244e-13 for sine and .16^8/8! = 1.0652200634920637e-11 for cosine. With station <= 5.186 and |radial| <= .29, a conservative coordinate truncation bound is 5.936845424441342e-11 m. This analytic bound excludes binary32 arithmetic rounding, which is separately modeled.
2. spFillet uses cos(h)=sqrt((1+co)/2) and tan(h)=sqrt((1-co)/(1+co)). The tangent-distance clamp, radius, center, and tangent endpoints are the same equations as the CPU implementation. No bend dimensions change.
3. spArcDistance uses the radial projection of the query onto the circle plane. For a minor arc with endpoint direction (ca,sa), the angle test is equivalently y>=0 and x*sa−y*ca>=0. The nearest endpoint remains a candidate. At zero planar radius the endpoint distance is used, avoiding undefined atan(0,0). No acos/tan/atan/sin/cos remains in the steam helper's runtime path.

The supported routes are nondegenerate: the 101-beta sweep's corner cosine range is [-0.8648971,0.3795537], and the minimum positive arc endpoint sine is 0.5019492. The wedge does not cross an ambiguous pi/zero degeneracy.

## CPU-only results

- Original accurately-rounded-trig float32 model: 1,068/1,068 below 4e-6 m; maximum 4.875808954241806e-7 m.
- Proposed polynomial/algebraic float32 model: 1,068/1,068 below 4e-6 m; same maximum.
- All 58 retained failed GPU points: proposed float32 model below 4e-6 m.
- 93,122 arc/route witnesses over 101 beta values: double algebraic equivalence maximum 2.220446049250313e-16 m; float32-versus-original maximum 9.581310312332947e-7 m.
- CPU geometry lock: zero change for all 1,068 original samples, identical parameter/AST/domain/route/status serialization, and identical exported CPU function source text.

## Host/piston scope

HOST_CANDIDATE_DIFF_SUGGESTION.json and dynamic-candidate-beta.patch provide a separate candidate-only host proposal, now justified by the actual original host/slider drift. This study does not edit the main dynamic.js. Prefer the equivalent bounded replacement strings in the existing candidate adapter, keeping the original baseline file byte-for-byte unchanged. The proposal uses candidate-only bounded beta axes in dynSmallAt and candidate-only small-delta rotations in dynInstallation/dynSlider, preserving the baseline branches and generic dynRotate. Generic dynRotate also accepts arbitrary mechanical theta and must not be replaced by this bounded polynomial.

Correcting the beta axis alone does not establish piston parity: dynSmallAt still uses dynBig's arbitrary-phase native sin/cos. Directly read back dynBig before deciding whether another scoped correction is needed.

## Required next acceptance evidence

Apply any chosen proposal only in the authorized workbench, regenerate the packet hashes, and rerun actual installed whole-scene GPU parity at the unchanged 4e-6 m threshold. Check host/port alignment and moving-piston transforms, not just the standalone steam field. Rerun prior baseline/candidate regression and render/UI tests. None of these actual post-patch GPU or browser acceptance steps was executed in this CPU-only study.

## Optional arbitrary-phase study

DYNBIG_DIAGNOSTIC_PLAN.md defines a small installed whole-scene dynamic gate and the missing dynBig isolation. dynBig-candidate-phase-proposal.glsl is an optional follow-on, not included in the beta-only patch. It retains native baseline behavior and is limited to the present UI phase domain; model-phase.js tests a wider [-16,16] range. The 60,003 UI big-end float32 samples have maximum vector error 3.269111503015437e-7 m. Adopt it only if the independent actual dynBig gate fails; do not expand to unrelated shaders or claim unbounded-time precision.

For an explicit main installation lock, run `node verify-installed.js /absolute/path/to/authorized/workbench`. It loads the actual index.html script chain, checks unchanged CPU functions and ASTs, verifies original dynamic.js bytes, evaluates all 1,068 original samples, and records the actual installed D.glsl/C.source/C.commonSource hashes. This optional command alone reads a caller-supplied workbench; normal `run.js` remains entirely portable.
