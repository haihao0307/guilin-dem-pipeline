# Wenzhou V200 truth archive

Authoritative target:

```text
projects/wenzhou/v200/truth/WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif
bytes 136760745
SHA-256 c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43
```

The TIFF must be stored through Git LFS. A normal Git blob, preview image, resampled raster, ZIP, pointer-only placeholder or similarly named substitute does not satisfy this archive.

Completion requires all of the following:

1. Source file byte count and SHA-256 pass before copying.
2. Copied repository file byte count and SHA-256 pass.
3. Git LFS tracks the target path.
4. The LFS object and branch commit are pushed normally, without force push.
5. A clean GitHub Actions checkout downloads the LFS object.
6. A second fresh clone downloads the same LFS object.
7. Both downloads match 136760745 bytes and the frozen SHA-256.
8. `WENZHOU_17TILE_TRUTH_MANIFEST.json` is updated to `archived_verified` only by the verification workflow.

Local Windows entry:

```text
10_UPLOAD_WENZHOU_V200_17TILE_COG_TO_GITHUB_LFS.cmd
```

The upload script stops when the repository is dirty, the remote is wrong, Git LFS is unavailable, the branch cannot fast-forward, or the selected TIFF does not match the frozen identity.
