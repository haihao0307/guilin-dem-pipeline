# KAOPU minimal common-mesh experiment R01

One fixed canonical mesh combines a bounded subset of Anny, GNM and MHR output. It is not a three-page switcher, and not a complete or lossless merger of all three models.

- Run browser UI from a static HTTP server alongside kaopu-anny-workbench
- Anny model dependency: ../kaopu-anny-workbench/assets/anny-model.json and its ordered .bin.part files (or the equivalent legacy .bin.gz)
- GNM: pinned official 34,937,952-byte web asset, SHA-256 checked on load
- MHR: this directory contains only a licensed synthetic torso displacement projection; full TorchScript is not a runtime dependency
- Data remains in browser. No user photograph or identifier is uploaded

Read LEARNING.md and API.md before reusing this adapter. Numeric reports are in research/. Browser screenshots and actual browser QA status are separate evidence, not implied by Node tests.

Reproduction scripts in tools/ expect the explicitly pinned official teacher assets in neighboring development directories. tools/serve.py is a local development route mapper, not production server code. No original teacher directory is modified by these tools.
