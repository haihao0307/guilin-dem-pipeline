# MHR eyesLook 14–21: read-only semantic audit, 2026-10-07

## Outcome

The tested LOD1 eye-aperture candidate surface is a rim-spanning closure patch, not an independently sampled iris/pupil/globe. This geometry supports transferring the authored eye-rim/periorbital deformation; it does not identify a unique GNM eyeball rotation, iris center, pupil center, or gaze angle. Do not restore the rejected cap-to-rigid-globe fit.

No runtime, teacher, adapter asset, or publication was changed. Outputs are confined to this research directory.

## Facts checked

- Source lock: facebookresearch/MHR commit `d96fafa33bbf018647c70c3525e91f53e79d2a14`, assets v1.0.1. Local raw SHA-256 is in native-verification.json.
- Official `mhr/mhr.py` passes identity/expression coefficients through the blendshape rest-pose path; only model_parameters plus zero padding enter joint parameter conversion. The official expression document calls these artist-sculpted semantic controls and includes eye gaze, but gives no gaze-angle calibration or iris/pupil vertex mask.
- At neutral identity/pose, all eight one-hot expressions reproduce existing cached per-vertex deltas exactly. Half, negative and mixed tests are linear to float32 error: max 0.000458 mm. Correctives on/off makes zero difference in this zero-pose test.
- EyesLook_L deforms the +X eye and EyesLook_R the -X eye. Per channel, 562–590 vertices move by >0.1 mm. The other eye candidate has exactly zero displacement. All per-channel maxima and 3D means are in geometry-audit.json.
- The left 18 candidate vertices induce 16 triangles, 33 edges and 18 boundary vertices; the right 19 induce 17 triangles, 35 edges and 19 boundary vertices. Both are Euler-1 disks, with **zero interior vertices**. Every candidate vertex is on the patch boundary, and the rendered interior consists of triangles directly bridging those boundary vertices. Exact native face IDs, vertex triples and boundary edges are saved.
- This induced-face set is not identical to the 32-face aperture-centroid exclusion: the original selector chooses 15 left + 17 right faces; taking every triangle whose vertices are in the candidate IDs adds one left triangle. These are algorithmic candidate masks, not official semantic labels.
- Candidate surface area at eyesClosed=1 becomes 14.36% left / 13.45% right of neutral; Down becomes 56.50% / 51.70%; Up becomes 141.44% / 137.07%. Thus the same patch is heavily non-rigid and follows aperture closure/opening. Native wireframe and actual displacement plot: native-left-eye-fields.png.
- GNM metadata: component 0 = skin; component 1/2 = left/right eye; region 6/7 = left/right orbital. Each GNM eye has 577 material-4 sclera vertices, 136 material-5 iris vertices, 58 material-6 pupil vertices. Material 1 is teeth, not sclera. The owner confirmed its implementation uses the right component IDs.

## Interpretation and minimal mapping

A surface point inside one of these cap triangles has only the barycentric interpolation of rim vertices. There is no separate interior vertex trajectory to identify an iris/pupil/globe motion. The directional names communicate authored intent, but cannot calibrate a physical gaze angle. The strong asymmetric upper/lower-rim motion in Up/Down and cap collapse under blink explain why fitting the entire patch as a rigid eye was inappropriate.

The smallest supported mapping is MHR's actual field to GNM skin component 0, keeping the upper/lower eye-rim correspondence separate (orbital regions 6/7), with existing ocular inner-wall extension explicitly identified as an adapter-derived continuation. Current fixed R4 correspondence already excludes the candidate cap faces. Retain this behavior; no new global gaze rotation is justified by this audit. The 771-vertex GNM eye components, including iris/pupil materials, have no validated MHR independent-motion counterpart in these inputs.

This is a supported correspondence boundary, not proof that the complete adapted head is visually correct. Existing skin correspondence accuracy, eyelid–globe contact, mixed-state intersections, and the identity-only cap shape fit were not certified here.

## Unknowns and limits

- Browser export contains no UV/material or iris/pupil semantic arrays. That **does not establish** that official FBX assets lack UVs or texture-space annotations. Full FBX metadata was not downloaded/inspected in this pass.
- The pinned official viewer code inspected uses mesh geometry/material presentation, and its exporter disables textures; this does not rule out texture information elsewhere in the official assets.
- No independent native iris location, calibrated gaze-angle function, or hidden eye-surface layer is established. No depth-ray search or complete FBX semantic study was completed.
- A future procedural GNM eye direction derived only from `eyesLook*` labels would be a new calibrated approximation, not recovered native MHR globe motion. It needs independent evidence/validation and explicit labeling.
- Only native LOD1, neutral identity/pose and the enumerated linearity probes were tested. No claim is made about another LOD or large identity/pose combinations.

## Reproduce

From the project root:

    node research/mhr-eye-semantics/verify_native.mjs
    .venv/bin/python research/mhr-eye-semantics/audit_geometry.py
    .venv/bin/python research/mhr-eye-semantics/plot_probe.py

The scripts read the existing immutable sources and write only sibling audit outputs. The native plot uses actual geometry, not synthetic gaze or render-time eye shapes.

## Official references

- [Pinned MHR forward implementation](https://github.com/facebookresearch/MHR/blob/d96fafa33bbf018647c70c3525e91f53e79d2a14/mhr/mhr.py)
- [Pinned expression mapping](https://github.com/facebookresearch/MHR/blob/d96fafa33bbf018647c70c3525e91f53e79d2a14/docs/face-expressions.md)
- [Pinned official viewer exporter](https://github.com/facebookresearch/MHR/blob/d96fafa33bbf018647c70c3525e91f53e79d2a14/web-viewer/exporters.py)

Inspected source snapshots are under upstream/ for reproducibility, with their original notices retained. No model weights were newly downloaded.
