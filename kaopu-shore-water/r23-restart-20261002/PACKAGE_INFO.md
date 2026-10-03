# Package information

## Downloadable handoff created in this conversation

### Full handoff, including the 142 MB original teacher video

- File: `KAOPU_SHORE_RESTART_R23_HANDOFF_20261002_FULL.zip`
- Bytes: `155512044`
- SHA-256: `ae4fadbe0a43cf3ce61fa87638c7d6f5598eae93f4e5d7a4bb528383faa39c5c`

### GitHub-oriented package, without the oversized original video

- File: `KAOPU_SHORE_RESTART_R23_GITHUB_20261002.zip`
- Bytes: `7297275`
- SHA-256: `5e69868ed3dbe9d103af026f3320e66edb97f835a5f51bae01d8d9274699387b`

## Repository representation

The repository stores the complete text source, measurements, handoff documents and QA report.
Binary teacher evidence and QA images remain in the downloadable package. The original video is
identified by SHA-256 and is intentionally not committed because it is 148,220,448 bytes, above
GitHub's normal 100 MB per-file limit.

To reconstruct `source/app.js` from the reviewable repository split:

```bash
python R23_CURRENT/source/assemble_app.py
```

To build the standalone workbench after restoring the `evidence/` files from the full package:

```bash
python R23_CURRENT/source/build.py
```
