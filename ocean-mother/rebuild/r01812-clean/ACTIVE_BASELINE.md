# Ocean Mother clean restart

Active visual baseline: **R018.12**, not R018.8 or R018.9.

The user-selected reference screenshot visibly identifies `Ocean_Mother_R01812_Three185.html` and `ISLAND GOLD COAST / R018.12`. The earlier R018.8/R018.9 identification was incorrect and caused the continuation line to start from the wrong source.

Exact immutable source:

- commit: `d9623857edb4006d8f17477e408643f59f59a5c9`
- path: `ocean-mother/releases/Ocean_Mother_R01812_Surface_Query_Direct_Open.html`
- blob: `9493bfd07ecab17aaf1dbe664e8086aa5de18ffd`
- recorded size: `163032` bytes
- recorded SHA-256: `5b66f11021da480441922eb657da071d12ac929faee0f38e0a90f70895fdc69d`

Rejected continuation lines:

- R018.9 recovery derivatives
- R018.9.1 through R018.9.4.2
- R0199 / R0199B
- R0200A

Rules for the restart:

1. Deep-ocean behavior remains frozen.
2. Do not publish a new visual candidate until the exact R018.12 source is confirmed to render in the user's browser.
3. Do not replace the R018.12 island with a simplified compatibility island.
4. Compatibility work must preserve the original R018.12 visual functions and be validated by final-frame pixel checks, not compile/link success alone.
5. Visual changes must be isolated and compared against R018.12 with fixed views.
