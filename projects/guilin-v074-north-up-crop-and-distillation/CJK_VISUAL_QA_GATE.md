# CJK visual QA gate

This page must render the Traditional Chinese landmark labels as distinct glyphs in desktop and mobile browser evidence.

The browser QA now fingerprints rendered canvas output for 桂、林、真、寶、鼎. It fails when the characters collapse to a shared missing-glyph box or contain no visible ink.

On GitHub Actions, `browser_cdp.py` verifies `Noto Sans CJK TC`. When the font is missing in CI, it installs the pinned Ubuntu package `fonts-noto-cjk` before Chromium starts and writes `cjk-font-match.txt` into the evidence directory.

The gate is required alongside the existing north lock, no-rotation, transparent landmark label, source truth, AOI state, real asset and zero-console-error checks.
