# Current Best View R47 — Gaussian reference compositor

Status: **Candidate partial**.

Three.js r186 display evidence must keep at least five layers separate: source float appearance/covariance, decoded delivery parameters, projected raw ellipse, viewer-policy ellipse/alpha, and finally blended pixels. Component-wise gates remain necessary, but they are not sufficient to predict their combined image error because source-over blending changes the weights of later errors when order, color, opacity or footprint changes.

The fixed two-splat CPU fixture observed a maximum linear RGB difference of `0.0851303` for the combined DC/order/ellipse candidate, larger than each single ablation (`0.0483221`, `0.0434365`, `0.0467564`). Its maximum non-additive residual was `0.0895575`. These values are properties of one derived fixture, not universal bounds, perceptual thresholds or real-asset evidence.

The r186 `0.3` screen kernel requires a corrected interpretation. In the isotropic tiny-footprint control, scale grew from `0.00341946 px` to `0.548022 px`, while center alpha was multiplied by only `3.89741e-5`; the continuous area-alpha proxy was preserved exactly in the fixture. Kernel-expanded support therefore does not itself prove a visible or opaque pixel. Conversely, the `1024 px` cap can still erase a `46.0678 px` raw-axis difference.

Keep DC policy, exact/viewer order, raw/displayed ellipses, alpha compensation, cap incidence, linear composited pixels, display transforms and human acceptance separately recorded. Do not derive a delivery threshold from R47.

Frozen R1, Canonical Truth and production Mother branches are unchanged.
