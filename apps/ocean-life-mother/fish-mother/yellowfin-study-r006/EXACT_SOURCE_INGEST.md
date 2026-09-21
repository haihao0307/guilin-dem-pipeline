# FISH-REF-002 exact-source ingest

The exact source binary is still the highest-value missing input.

Accepted identities:

- low appearance variant: 6,137,560 bytes · SHA-256 `f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0`
- high appearance variant: 58,908,280 bytes · SHA-256 `5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe`

Public provider pages show that the GoldenZtuff source is downloadable and available in GLB/glTF/FBX/USDZ form, but this branch does not bypass provider login, library, or signed-download controls.

When an exact GLB is available, run:

```bash
python apps/ocean-life-mother/fish-mother/yellowfin-study-r006/tools/extract_yellowfin_copy_evidence.py \
  /path/to/tuna.glb \
  --out /tmp/yellowfin-source-evidence
```

The extractor:

1. rejects any hash other than the two known FISH-REF-002 variants;
2. recovers source skin-dominant structural groups;
3. splits those groups into connected geometry components;
4. scans the body-core caudal peduncle cross-section;
5. records keel candidates without falsely accepting them;
6. records exact material assignments;
7. records animation channel extents by semantic group;
8. generates evidence JSON only — it does **not** generate a fish.

Source Copy R001 stays locked until the output is visually classified and the remaining fin/root/finlet/keel/material gates are closed.
