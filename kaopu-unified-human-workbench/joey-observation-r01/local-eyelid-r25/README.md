# R25 independent upper-eyelid control experiment

R23 remains the accepted visual anchor (user's subjective ~85% description,
not a calibrated score). This directory tests one additional native control.
It does not update the public page or claim a likeness improvement.

## Frozen inputs

- Runtime anchor: 318b463ed70ff9a4637c426de66c1bea55a6224b; source snapshot
  83896be95a2ece51538d9762b9a559ca885c9cea.
- Native 25,417-vertex Float32 SHA256:
  8e1a19c8e55d938c546e111783126c73378cb37739152c378e0497debcd4bfc8.
- Existing HeadTransfer raw SHA256:
  fb609d41cb9f11b2845f1956e3a37d6d9c4ffc8b6e6e883bd242153632218243.
- Canonical compressed map SHA256:
  89b13a580788fb0433bff9644a3be622fbcd5cbac163387eb0977d2f08ed884a.
- Original 98,358 strands × 49 samples, materials, eye white, iris and
  perspective camera remain unchanged. No reference photographs in this project.

## Native domain and mathematics

HeadTransfer outer_ids plus both agreeing semantic-class arrays define classes
3/5 as left/right upper-lid bands (245/275 native vertices). Classes 4/6 are
lower lids. These are 8 mm semantic bands, not ordered mesh-boundary curves.
The skin is closed; deriving a lid from arbitrary open topology edges is wrong.

SurfaceBinding's retained exact triangle depth query extracts 41 visible upper
rim samples per eye. Each retains native triangle IDs and barycentrics. They are
view-frame envelope observations, not a claim of an anatomical topological rim.

The scalar field has compact corner support u in (.12,.88), a sine-squared arc,
a smooth 2 mm semantic-boundary taper and an 8 mm distance-to-rim taper. One
candidate uses +0.6 mm arc amplitude and 0.25 skew. Its maximum 3D displacement
can exceed 0.6 mm because depth changes follow the actual eye's triangular
front envelope. Where old/new eye envelope queries both exist, the old skin-eye
depth difference is preserved at that vertex; no sphere/ellipsoid is substituted.

Only registered upper-lid skin and corresponding upper eye-cavity interiors
can move. Original cavity extension weights are reused with an explicit upper
half gate. Corner landmark triangle supports, lower outer lid, lower cavity,
eyeballs and every other region are fixed. The local deformation is applied to
HeadTransfer's post-expression rest geometry, then its original skinGNMRest
performs head rigging. Archive identity and expression values do not change.

The corrective fades with the retained Anny eyeBlinkLeft/Right and measured
aperture; full semantic closure has exactly zero extra displacement. This is
an explicit original shape corrective, not a newly learned GNM expression.
Closed baseline defects are not repaired or certified by preserving them.

## Gates before the one A/B render

Local frozen-mesh tests cover zero identity, exact protected domains, side
separation, finite/parameter bounds, triangle area/orientation/strain, real rim
response, contact samples, lower inner wall and input immutability. The runtime
then tests actual Anny open, half blink, full blink, one-eye blink and modest
smile with the original complete model. Full closure and final baseline must
restore exact native hashes. Failed gates prevent candidate rendering.

Contact audit samples affected triangles at vertices, edge midpoints and
centroids. It distinguishes baseline hidden cavity depths from newly behind
front-envelope samples. It is not a full volumetric collision certificate;
same-camera actual pixels remain mandatory for visibility review.

After numerical gates: one baseline/candidate/restored perspective view,
full native geometry diffs, original hair current-root GPU transport, rebuilt
surface-bound brows/lashes, refreshed original eye-contact shading, unchanged
materials, exact native rollback. CI is contents:read only and never deploys.

## Origin and limits

UpperLidField and orchestration are KAOPU original code. SurfaceBinding is copied
byte-for-byte from the retained R23 own brow/lash module. Existing assets are
read through the established engine, not republished here. No Disney detector,
new external model, learned dense correspondence, or likeness score is claimed.
