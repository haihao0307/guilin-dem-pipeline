# R14 optional open hexagonal ground — pre-integration probe

This is a visual six-sided centre-line honeycomb with actual openings. It is not
a reconstruction of bobbinet twist, a machine instruction, or a claim that the
three branches at each junction are a single continuous manufactured thread.
Geometry is opt-in: with `enabled:false` the emitter makes no callback at all.

`sideMm` is the centre-line length of one regular hexagon edge. The centre-line
flat-to-flat height is `sqrt(3)*sideMm` and point-to-point width is `2*sideMm`;
the open hole is smaller by yarn thickness. Coordinates and panel extents are
centimetres, while edge length and line diameter are millimetres. Any material
space transform must be deterministic for the same node. The emitter uses one
long zigzag family plus horizontal segments, visits every edge once, shares
integer-grid junctions, and hands all clipping and radius handling to the caller.

R13's `meshMm` is the perpendicular distance between parallel diamond families.
For a fair comparison the diamond's centre-line cell area is
`meshMm^2/sin(2*atan(.86))`; the regular hexagon centre-line cell area is
`3*sqrt(3)*sideMm^2/2`. This provides an area-matched side length without
assuming equal hole shape, line coverage or optical appearance. The second
comparison sets `sideMm=meshMm` explicitly, which yields a larger cell.

| Preset | R13 total | Area-matched hex side mm | Estimated full segments | Budget | side = meshMm total |
|---|---:|---:|---:|---|---:|
| Botanical | 239869 | 0.717517 | 268551 | Reject (>250000) | 215709 |
| Rosette | 146065 | 0.655124 | 180946 | Accept | 117302 |
| Ribbon | 40843 | 0.717517 | 49592 | Accept | 33454 |

Botanical `sideMm=1.15` has 1.991858 mm centre-line height and 2.30 mm width,
while the matched-area side has 1.242776 mm height and 1.435035 mm width. The
line diameter in both examples is 0.075 mm. This wider candidate is a visually
distinct choice, not a budget-preserving substitute at equal size.

For botanical cotton, retained net-only typed geometry buffers and submitted
triangles were 31,970,112 B / 735,880 for R13, 58,582,576 B / 1,077,628 for
area-matched hex, and 23,101,320 B / 430,300 for `sideMm=1.15`. These are
render geometry counts, not GPU memory, FPS, or a full-scene timing. The
over-budget full botanical configuration is reported as rejected; only its
isolated net geometry was built for measurement.

The clipping probe reproduces R13's append for the net layer using the R13
app defaults, including the shared relaxation, organic warp, cut provenance,
and material/binding logic. It replaces only the old net in a frozen R13
output, so the total is a **pre-integration estimate**: serial seed/order and
any R14 independent changes can affect the final artifact. Re-measure using the
integrated generator and capture actual rendered seam, edge and optical results.
The graph inspection rounds coordinates to 1e-10 cm and examines internal nodes
at least two hex edge lengths from the curved clip boundary. All six examples
have zero duplicate edges and zero interior nodes of degree other than three.
Tests are in `tests/r14-hex-boundary.test.mjs`; measurements and graph counts
are in `r14-hex-cost.json`; rerun with `node tools/r14-hex-cost.mjs`.

## Final integrated result

`r14-integrated-cost.json` records the actual integrated generator. With the
default full botanical specimen, the diamond baseline has 239,869 sampled
segments and the wider 1.15 mm hex alternative has 215,709. The equal ideal
centre-line cell-area alternative at 0.7175 mm exceeds the 250,000 segment
limit and is rejected. These are not equal-hole or equal-appearance claims.
A 12 × 12 cm botanical specimen with 0.72 mm hex has 95,449 segments before
the optional interlacing; the latter raises it to 220,275 in the tested case.

After clipping, a short zigzag leg could fold the swept tube near the boundary.
`splitShortClippedHexPaths` splits only at existing nodes, without moving or
removing centreline segments or changing width. In the 18 cases recorded in
`r14-hex-sweep-after.jsonl`, the inspected inward, reversed, opposed,
degenerate and non-finite counts were zero. This is a bounded sweep check,
not proof of physically continuous twisted bobbinet yarns.
