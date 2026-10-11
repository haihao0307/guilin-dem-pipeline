# Shared settlement geometry compiler r02 (in progress)

Source records retain all 24 authored building footprints, 234 floor elevations and construction chronology from the frozen r01 prototype. Procedural geometry corrects slab penetrations and bridge approaches; original graph reachability is not treated as collision validation.

Runtime data is a Float32Array interpreted as vec4<f32>; no surfaces, vertices, triangles, brick lists or step instances are generated. CPU and WGSL are emitted from one scalar geometry function specification. Microgeometry and mature material mother functions are supplied by the receiver.
