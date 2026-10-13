R02 screenshot markup recovery

Primary implementation interface: markup_coordinates.json.
Detailed camera fits and original pixel picks: markup_fit.json.
Reproduce: python fit_markups.py && python export_coordinates.py
Dependencies: numpy, scipy, Pillow, matplotlib. Run from any directory.
Both scripts resolve input paths relative to this research directory.

Five screenshots were inspected visually. A no-roll physical pinhole camera is fitted
against rendered cyan modern-reference-route pixels, with original 30m DSM heights
included. Label bottom-centres initialize the camera, with collision displacement
corrected where visible; they are lightly retained as stabilizers, not sole evidence.
Full-resolution image masks are used to preserve subpixel-width route strokes.
fit-*.png overlays the reprojected source route in red and initial control anchors
in white. These are geometric diagnostic images, not modified project assets.

Candidate crop: [823020,808000,848490,845500] EPSG:2326. North-aligned, inward-snapped
to the source 30m grid. It interprets approximate coverage; it is not the larger
axis-aligned bounding box of the rotated red screenshot rectangle. ~600m boundary
interpretation uncertainty is recorded. Exact source pixels are retained.

Second station: [837440,821150], tentative circle centre southwest of the walled-city
reference point. Sha Tin raw circle centres are audit evidence only. They do NOT
define platform positions or endpoints. Use shatinPlanningAxis [839790,829760],
heading 0.48 radians clockwise from north, for one compact station precinct.
Its two axes are ±35m from the shared centre. A 300×90m DSM sampling footprint is
~7–12m high; 9m is a fictional planning level, not an engineering recommendation.
The candidate shifted only ~67m from the broad-circle midpoint. No 80m hill cut or
500m-separated platforms is implied. Raw circle centre heights remain for audit.

routeSouth combines the original coast departure with the latest second-station
revision and stops at the southern Lion Rock slope. routeNorth is the Sha Tin to
Tai Po blue sketch. Their separate mountain-flank endpoints are a tunnel CONCEPT,
not a surveyed bore, grade, portal, or feasibility result. Several user strokes
cross contemporary water or hills; these are fictional reconstruction instructions.
The distant/horizon parts of southern screenshots have materially larger errors
than nearby route controls. Coordinates rounded to 10m do not imply 10m accuracy.

No R01 file was changed. Source SHA-256 hashes are included in markup_coordinates.json.
