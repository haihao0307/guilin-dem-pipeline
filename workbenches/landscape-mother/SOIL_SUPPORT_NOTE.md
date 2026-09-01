# B3.1 crown support correction

Post-inspection numeric review found that the independently evaluated crown cap could bridge recesses in the final authored body. The cap now takes its lower surface directly from a subset of the final generated upward-facing rock triangles, offset 0.025 m into the body. Upper points carry an authored thickness. Perimeter faces close the volume. Ambiguous point-touching soil regions are trimmed before extrusion and counted; the underlying rock is unchanged.

Every lower vertex is checked against its corresponding rock vertex after Float32 conversion. Since lower faces retain those vertices and use linear triangles, the vertical offset also applies within each face. The reported maximum gap and conversion error are calculated from these final coordinates, not manually assigned. Crown soil, ledge patches and the combined soil mesh still undergo closed-edge and volume checks. Roots are then intersected with this actual final soil surface.

This change affects authored soil only. No original/reference mesh is copied or modified; no view-dependent density adjustment, LOD or texture is added. The dark exposed soil is intentionally left available for the separate vegetation system. Neither soil depth nor biological suitability is an externally measured geoscience claim. Artistic approval remains false.
