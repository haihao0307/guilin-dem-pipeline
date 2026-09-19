# Reference Cache policy pointer

Before any new user reference file is used in Fish Mother, read the canonical shared policy from:

- repository: haihao0307/guilin-dem-pipeline
- branch: main
- policy path: knowledge/MOTHER_REFERENCE_ASSET_LIFECYCLE_R1_ZH.md
- policy commit: eb1634c2362f6f14b1f3f5c0f293e64467f0f7c1
- manifest template path: knowledge/MOTHER_REFERENCE_ASSET_MANIFEST_R1.json
- manifest commit: 87fdee3ff2cd91c627b8b5a4eefd203260d08528

Fish-specific rule:
- Original reference GLB/image/video is REFERENCE_TEMP unless explicitly promoted.
- Do not ask the user to re-upload a file whose SHA256 is already in an accessible Reference Cache.
- Do not put temporary raw reference binaries into the public production repository.
- Record any unavailable raw-byte path as a storage/input-gate defect rather than substituting a same-name file.
