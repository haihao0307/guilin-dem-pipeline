# Stone Money Island / Airai Authority Learnings R1

Date: 2026-09-23
Scope: Stone Money Island / Survivor Palau / Airai world production
Status: MANDATORY PROJECT KNOWLEDGE

## 1. Canonical authority order

The Airai / Stone Money Island world must inherit the user-authority rules frozen in:

- branch: `work/palau-airai-user-authority-r07-20260921`
- `games/survivor-palau/palau-world/airai-r07/MOTHER_SUPERVISION_R07_ZH.md`
- `USER_AUTHORITY_R07.json`
- `REGRESSION_WRONG_FRAME_STORY_REGION_R07.json`

The exact immutable visual identities are:

1. Complete-frame Palau authority image  
   SHA-256: `5b6e1d716bfa66f204aac9240944fe5d1526444d981ccb8a3f23875633d73312`

2. User yellow Stone Money story-region authority image  
   SHA-256: `4fad4cd637fd556044fec5cfd56f6ef29eb8859a72a543788feb7084c4daeb47`

These identities are not replaceable by later screenshots, regenerated maps, DEM renders, SVGs, Quick Look pages, inferred GIS anchors, user-location helper images, or derived scientific products unless the user explicitly changes the authority.

## 2. Required visual-entry semantics

A candidate visual flow must preserve this authority order:

`exact complete Palau authority image -> exact yellow Stone Money story-region authority image -> derived world / terrain / ocean / evidence layers`

If either exact binary is unavailable or its SHA cannot be verified, visual production must remain blocked. The correct state is equivalent to:

`visualBuildAllowed=false`
`visualAcceptance=false`
`userAcceptance=false`
`productionReady=false`

A zero-image runtime cannot satisfy an image-identity gate.

## 3. Yellow story region is an area, not a point

The yellow Stone Money user marking is an authoritative story-region area.

Forbidden reductions include:

- replacing it with one guessed coordinate;
- replacing it with a centroid;
- replacing it with several production markers or GIS-snapped points;
- treating White Sand / Rock Island / Turtle House / Power Tree / Japanese Outpost points as the authority itself.

Such points may exist only as subordinate candidate annotations inside the frozen area and must remain clearly labeled as candidate / contextual / registration evidence.

## 4. New user-location images are subordinate unless explicitly promoted

Later user-location or registration images with different dimensions or SHA-256 values do not automatically replace the two frozen R07 images.

They may be stored as:

- `location_context`
- `registration_evidence`
- `alignment_reference`
- `candidate_annotation_source`

They must not be labeled `userAuthorityImage`, `firstViewAuthority`, or equivalent if their SHA does not match the frozen R07 identity.

A known regression to guard against is the R19 World Score conflict where context images were registered as authority while the R19 authority lock simultaneously preserved the original R07 hashes.

## 5. Forbidden lineage / stale evidence

Do not reintroduce or silently inherit rejected old candidates, including:

- Boracay
- Orrak
- Ngellil
- other pre-authority candidate islands/frames
- R05 or other old screenshots presented as current progress

Old material may remain as historical evidence only. It cannot be used as current candidate proof.

## 6. No invented land / reef / channel separation diagram

Do not invent a clean schematic separation between land, reef, lagoon, channel, deep sea, or bathymetry merely to make the scene easier to read.

Every structural distinction must remain traceable to accepted evidence or clearly marked as a candidate interpretation.

Derived visualization must never overwrite the authority hierarchy.

## 7. KB Bridge / Toachel Mid channel continuity is a hard gate

The water/channel topology through the KB Bridge / Toachel Mid corridor must remain continuous.

A candidate cannot pass merely because the map looks continuous at a distance.

The acceptance evidence must include an explicit continuity/topology check for this corridor. No silent land bridge, clipped reef polygon, raster mask break, or visual occlusion may sever it.

If continuity has not been specifically tested, the gate state is `UNVERIFIED`, not PASS.

## 8. Preserve the scientific evidence stack

The following evidence must be retained and must not be discarded merely because a visual candidate fails:

- NOAA
- NCEI
- GMRT
- Allen Coral Atlas
- Sentinel
- OSM
- Palau DEM / accepted DEM lineage

Preserve source identity, datum, NoData, uncertainty, coverage boundary, and measured-vs-derived distinctions.

Scientific evidence supports the world. It does not replace user visual authority.

## 9. Acceptance evidence must be head-bound and fresh

A genuinely new compliant candidate requires all of the following at the same exact commit:

- exact commit SHA;
- the two immutable authority-image identities verified from the actual binaries;
- current tests bound to that head;
- explicit R07 regression gate result;
- KB Bridge / Toachel Mid continuity evidence;
- fresh desktop screenshot evidence;
- fresh 390x844/mobile screenshot evidence;
- no reuse of R05/old screenshots as current progress;
- no mismatch between tested commit and displayed artifact.

Passing a parent commit, a previous workflow, a receipt-only file, or a stale screenshot is insufficient.

## 10. Device fallbacks do not redefine authority

iPhone Quick Look, SVG fallback, no-JS fallback, or reduced WebGL paths can be useful compatibility layers.

They cannot redefine the canonical first view, second view, story-region geometry, or accepted world authority.

A compatibility success inside the wrong authority flow is still a failed world candidate.

## 11. Production behavior

When a new candidate violates any rule above:

- mark it rejected for visual delivery;
- preserve valid NOAA/NCEI/GMRT/Allen/Sentinel/OSM/Palau DEM evidence;
- do not continue polishing the rejected frame as if it were on the acceptance path;
- return to the last authority-safe state;
- record the failure as a regression so the same mistake is not reintroduced.

When nothing materially changes, do not create a new progress claim.

## 12. Core lesson

The project's world-building hierarchy is:

`USER FROZEN AUTHORITY > VERIFIED SOURCE EVIDENCE > DERIVED CANDIDATE GEOMETRY / RENDERING > PRESENTATION / DEVICE FALLBACK`

Lower layers may refine higher layers' implementation, but may never silently replace them.
