# Visible-feature correction R02

One requested single-frame correction on the previous exercise's identity and camera. It is an unaccepted research candidate, preserving R64/R65 and production.

Jaw controls are fixed to zero. A bounded native HeadTransfer wrapper keeps the current identity's lower dentition at its own rest pose, instead of letting smile/lip displacement re-pose the teeth. Existing native dental-contact anchors and harmonic cavity weights still update the inside mouth. Only zero-jaw Anny expressions are accepted by this experimental wrapper; other jaw poses explicitly reject. No teeth are replaced, painted, or translated manually. Neutral dentition is not a clinical occlusion certificate.

Actual lip-boundary and upper/lower-tooth visibility remain separate diagnostics. A bounded expression adjustment opens lips while penalizing lower-row exposure. Current eye apertures use moderate existing eyeWide actions, with cheek squint removed. Head identity, camera, hair, and eye material are retained.

BROW-LASH-R01 source dffe7e6de138a72064fd7e8d9766040092715153 supplies fibers/material/triangle binding. Brows are darker and denser; both lash rows are rebound to the current visible skin/globe rim. Unsupported roots are rejected. No source head or eye model is imported. Rim binding is not collision simulation or closed-eye validation.

This folder contains only owned code, artistic parameters, surface bindings and tests. No reference photos, private observation coordinates, external face model or learned Disney detector is included. A single real engine render and restore test are required; successful computation alone is not likeness acceptance.
