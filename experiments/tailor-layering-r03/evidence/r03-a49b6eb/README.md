# R03 retained evidence

This evidence branch preserves original browser screenshots, Worker states,
numerical captures, audits and reviews for the R03 clothing-layering work.
It does not modify the frozen production source.

Read `EVIDENCE_INDEX.json` for the current acceptance status and archive identities.
An intermediate checkpoint is not a public-release approval. The earlier failed
candidate and its original failure evidence remain explicitly recorded.

Archives are split into bounded Git blobs. From a checkout of this directory:

```sh
python3 restore-evidence.py --output /tmp/r03-restored-evidence
```

The command refuses existing output filenames, validates every part's size,
SHA-256 and Git blob identity, then validates each reassembled archive. It does
not extract archives. Each archive contains `EVIDENCE_CONTENTS.json`, which
records original paths, sizes and SHA-256 values. Original file bytes are
preserved; only the tar wrapper timestamps and modes are normalized.

The runtime source and deployment acceptance are separate from this retained
evidence. Automated checks do not constitute human visual acceptance or a
production-readiness decision.
