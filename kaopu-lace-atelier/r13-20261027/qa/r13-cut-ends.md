# R13 explicit source-cut end disks

`appendCutEndCaps(geometry, paths, layer, enabled=false)` closes only a true
entry in `path.cutEnds=[start,end]`, and never a closed path. The main integration
gets those flags from original source clipping via
`generateLace(params,{captureCutEnds:true})`; no coordinate tolerance or guessed
panel rectangle is used. Placement passes the mask only for the enabled layer.

Disabled, unmarked and closed cases return the identical geometry with every
attribute/index byte and metadata unchanged. Positive cases append a duplicated
endpoint ring plus one centre. Every copied ring position is byte-identical to
the actual Float32 strip, including the active profile and actual reduced yarn
radius. Net disks add eight vertices/six triangles; other layers add ten/eight.
All original attribute and index buffers remain exact prefixes.

The new hard-edge disk normals point out along the real endpoint axis. Tangents
are unit directions within the disk plane, with a matching planar UV basis.
Every required attribute is populated. Fans have positive triangle area and
consistent outward winding; a degenerate marked axis fails explicitly before
changing the geometry. The module checks that no appended vertex expands the
original bounds. It is intended for fresh yarn strip geometry before upload;
the normal display integration calls it at the end of construction.

Seven regression checks pass in `tests/r13-cut-ends.test.mjs`. They cover neutral
identity/bytes/metadata, prefix retention, exact ring copies, reduced/profiled
radii, position-welded opposite-direction edge pairing, unchanged ordinary and
instanced fuzz, atomic invalid-geometry failure, actual mask propagation and
three-motif/four-layer/three-material stress caps. Fuzz continues to use only
the original strip surface and retains identical buffers and roots.

`r13-cut-ends.json` records full-sized actual source flags, placement, binding
and Float32 disks across nine motif/material combinations. All pass. Per motif,
counts are the same for cotton/silk/fine:

| Motif | Net / fill / outline / trim disks | Added vertices | Added triangles |
|---|---:|---:|---:|
| botanical | 688 / 1209 / 220 / 0 | 19794 | 15560 |
| rosette | 759 / 1636 / 148 / 0 | 23912 | 18826 |
| ribbon | 570 / 0 / 0 / 0 | 4560 | 3420 |

Every original strip attribute/index prefix remains unchanged, copied ring
positions match exactly, all appended attributes are finite, and bounding boxes
do not expand. The core sampled-segment counts stay 239869 / 146068 / 40843;
the additional render triangles are explicitly reported above.

This is a small geometric display closure of flagged cut yarns. Duplicated
vertices preserve a hard normal seam; position pairing is closed, without
claiming a welded index graph, fully closed fabric, resolved cut fibres, knots,
craft topology or a physically correct reverse side. Natural stitch ends and
all unmarked open ends remain inherited. The main lane owns fresh visual QA.
