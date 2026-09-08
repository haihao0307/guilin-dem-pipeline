#!/usr/bin/env python3
from pathlib import Path
import base64
import hashlib

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT.parent / "World_Spectrum_DNA_Codex_Source_V0.1.0_2026-09-08.zip"
EXPECTED = "04846fbbc31593e680eb976734460b4df4c31f29391236de02c883d9f7751507"

parts = sorted(ROOT.glob("part-*.b64"))
if not parts:
    raise SystemExit("No part-*.b64 files found")

payload = "".join(p.read_text(encoding="ascii").strip() for p in parts)
try:
    data = base64.b64decode(payload, validate=True)
except Exception as exc:
    raise SystemExit(f"Base64 decode failed: {exc}") from exc

actual = hashlib.sha256(data).hexdigest()
if actual != EXPECTED:
    raise SystemExit(f"SHA256 mismatch: expected {EXPECTED}, got {actual}")

OUTPUT.write_bytes(data)
print(f"Wrote {OUTPUT}")
print(f"SHA256 {actual}")
print("Next: unzip the archive, read START_HERE.md, then run cd prototype && npm test")
