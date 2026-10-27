# R29 whole-train frame openings and fixed-pivot support

Pure analytic candidate tools for the integrated train, not a separate mechanism demo. This folder alone was written. No retained `r28`, current `r29`, geometry source, Git, or public asset was changed by this study.

## Ready for integration

- `support_export.js` exports `pack({hosts,pose,parts,apertures})`, `scalar(shape,p)`, `bounds(shape)` and `glslExpr(shape)`.
- `SUPPORT_EXPORT.json` is the small prebuilt result for the actual R29 family: middle X = +0.38 m, plane Y = 1.48 m, O.Z = 5.55 m, middle short link = 0.25 m, spindle length = 1.18 m.
- `SUPPORT_FIELDS.glsl` contains fourteen fixed analytic fields using existing `mBoxInf`/`mDisc` primitives. Thirteen are additions. `frame_support/fixed_O_pin` explicitly REPLACES `stack_candidate/pin/O`; do not retain the old O shaft as a second solid.
- `FRAME_HOST_CUTS.glsl` contains only the frame slot and bolt-bore void functions. Apply them to the two existing named frame plates only while the installation candidate is enabled. Preserve the baseline constructors and baseline view. No other source or whole-train neighbour is exempted.
- `CONDITIONAL_APERTURE_CERTIFICATE.json` contains the directed-input-domain opening bounds. `FRAME_SUPPORT_QA.json` separately records the narrower sampled-only diagnostic and a preliminary interface schema. The prebuilt exporter, not that preliminary solid-box schema, is the completed support geometry.

## Evidence and anchor identity

The existing `r28/GRESLEY_INSTALLATION_EVIDENCE.md` records the official 60007 restoration evidence: actual 2:1/1:1 levers use frame slots; main pivot bushings and a separate 2:1 stretcher exist. Relevant primary references:

- https://sirnigelgresley.org.uk/overhaul-1522/overhaul-19.shtml
- https://sirnigelgresley.org.uk/overhaul-1522/overhaul-05.shtml
- https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-56/

These establish architecture, not the dimensions of this candidate. The public middle-casting photograph supplies a separate middle valve/power-bore relationship, not signed X, Y, angle or spacing. This package does not republish source photographs.

The retained train has no named saddle, 2:1 front stretcher, or existing direct O-pin mount. Its own missing-physical list includes cylinder/smokebox saddle support. The nearest static structure at the proposed O region consists of the two main frame plates; the smokebox is higher, the existing motion-window stretcher is at Z ≈ 3.05, and the bogie stretcher is near Y = 0.80, Z = 4.8387. None was silently relabelled as the missing lever stretcher.

The new proposed support therefore uses explicit contact interfaces on the actual inner frame faces, X = ±0.525 m. It is a new, inferred front stretcher with side tabs, not a recovered original casting or proof of an actual 60009 configuration.

## Function-derived openings

The main frames are fixed at X = ±0.54 m, each 0.03 m thick. Their front polygon rectangle is Y = 0.73–1.68, Z = 3.65–6.10 m. These values are parsed/checked from the retained source constructors, not taken from the part AABB padding.

`frame_support.js` computes the exact minimum enclosing YZ rectangle of a finite capsule-plus-eyes profile clipped to the full frame slab at one pose. It clips the oriented body rectangle and endpoint disks analytically; it is not the moving lever's entire AABB and not a voxel/raster cut. Bores are strictly inside the distant eye disks, so they cannot alter the section extrema for the verified crossings.

The continuum certificate uses the sibling's 60-digit directed pin intervals over every pair of outside spindle inputs in [4.02, 4.18]². In all 4,096 cells, the crossing capsule's finite ends and every eye disk are strictly away from the frame slab. Thus its section is the actual interior strip:

    z = az + (x − ax) * slope ± width * sqrt(1 + slope²)
    slope = (bz − az) / (bx − ax)

Directed interval evaluation bounds this expression over the full fixed frame thickness. It does not claim a globally minimum arbitrary-profile contour. A declared inferred 3 mm Y/Z running margin plus 1 µm numerical pad is added.

For +0.38 m middle X:

- Left frame, equal lever only: Y = 1.468999–1.499001; Z = 5.443033080–5.663673635 m.
- Right frame, 2:1 lever only: Y = 1.532499–1.562501; Z = 5.476212313–5.621660255 m.

The −0.38 sign alternative is also certified. Where two axial layers cross the same frame, its certificate keeps separate openings rather than unnecessarily removing the ligament between them.

The certificate is conditional on the outside input box. It does not certify that the upstream outside solver remains inside that box over every continuous phase, nor that every independent input-box state is a feasible complete valve/chest/guide installation. No whole-train acceptance follows from the aperture certificate.

## Completed support and interfaces

The completed exporter creates one bridge body with end tabs. Core depth is 60 mm, tab thickness 14 mm, tab half-depth 82 mm. Its Y = 1.5695–1.6235 m is derived above the complete existing moving-hardware top at 1.5655 m. The bridge height derives from the 12 mm washer radius plus an inferred 15 mm edge reserve on each side.

The fixed O pin remains radius 12 mm and is extended into an explicit through-Y socket. A head and lower-retention envelope belong to this same fixed-pin field. The lower envelope starts at Y = 1.5665 m, leaving 1 mm to the highest existing moving hardware. Original rotating main-lever/bushing interfaces are not filled or widened.

Four side bolts have explicit 6 mm-radius shanks, 6.3 mm-radius through holes in both frame and tab, external head envelopes, inward tab washers, and annular nut envelopes. Nuts/washers sit outside the core beam in Z so they are not hidden inside solid stock. Nominal head/frame, frame/tab, tab/washer, washer/nut, nut/shank, and pin/socket/retention contacts are enumerated. All actual material unions are contained in a single body field.

Derived geometric checks include:

- Minimum newly added hardware gap to existing moving hardware: 1 mm.
- Frame-top ligament above tab: 56.5 mm.
- Nut-to-core beam access gap: 14.5 mm.
- Washer-to-core beam access gap: 13 mm.
- Pivot socket-to-core edge ligament: 18 mm.

These dimensions, margins, ligaments, fastener layout, and bracket form are inferred design variables. They are not recovered A4 dimensions or a stress/fatigue/manufacturing approval. Threads, positive locking, loads, wear, assembly tolerances, and actual fastening specification remain unverified. The new full-train neighbour audit must evaluate every added field against all retained neighbours.

## Reproduction and storage

After copying this folder to `r29/frame-support-study`, run from the `r29` package root:

    node frame-support-study/test_frame_support.js
    python installation-topology-study/certify_input_box.py --model .
    python frame-support-study/certify_apertures.py
    node frame-support-study/test_support_export.js

Each command auto-detects its parent model, or accepts `--model /path/to/r29`. From inside `frame-support-study`, `--model ..` is supported. The JS tests and Python aperture script accept `--resolve-only` for a cheap module/path check. The aperture script regenerates a missing pin-box intermediate in the selected sibling `installation-topology-study`; `--regenerate-pin-boxes` forces that regeneration. It never seeks an external historical `r28` directory. The original development-folder layout remains supported.

Small persistent reproduction inputs are `FRAME_HOSTS.json`, the selected model's `stack-reconstruction/PARTS_REFERENCE.json`, and the sibling topology package's `CANDIDATE_REFERENCES.json` plus generator sources.

The large sibling `CONDITIONAL_PIN_BOXES.json` is a locally regenerated intermediate, not a mandatory committed or delivered asset. Persist the sources and small certificates/export. The aperture certificate records its consumed input hash.

Tests passed: 12,406 primitive-surface checks; analytic horizontal/rotated-slab examples; dense phase diagnostics; 250,000 redundant support-pair samples; 13,122 independent-input exact section checks. The directed aperture proof additionally checks 598,016 frame/part/input-cell combinations per sign. Sampled redundant tests are not relabelled continuum or whole-train proofs.
