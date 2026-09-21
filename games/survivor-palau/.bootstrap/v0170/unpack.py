from pathlib import Path
import base64
import hashlib
import json
import zlib

ROOT = Path.cwd().resolve()
BOOT = ROOT / "games/survivor-palau/.bootstrap/v0170"
EXPECTED_B64_SHA256 = "044dd84b92f5fe81af9c46db451c97c797e57bd6cce9ec2580dab3342a70e5df"
EXPECTED_RAW_SHA256 = "e320c7abd453ac1174b549d73cf41a5a0519ac3f37118d3ce901340a8f220ead"
EXPECTED_COUNT = 18
REQUIRED = {
    ".github/workflows/survivor-palau-v0170.yml",
    "games/survivor-palau/source/v0170/build.py",
    "games/survivor-palau/source/v0170/interface.html",
    "games/survivor-palau/source/v0170/survival.mjs",
    "games/survivor-palau/source/v0170/browser_qa.py",
    "games/survivor-palau/docs/V0170_PILOT_SURVIVAL_EVIDENCE_BOUNDARY.md",
    "games/survivor-palau/docs/V0170_IMPLEMENTATION_STATE.json",
    "games/survivor-palau/story/pilot-survival-r2-20260921/manifest.json",
}

payload = "".join((BOOT / f"chunk_{i:02d}.b64").read_text().strip() for i in range(7))
assert hashlib.sha256(payload.encode()).hexdigest() == EXPECTED_B64_SHA256
raw = zlib.decompress(base64.b64decode(payload, validate=True))
assert hashlib.sha256(raw).hexdigest() == EXPECTED_RAW_SHA256
files = json.loads(raw.decode("utf-8"))
assert isinstance(files, dict) and len(files) == EXPECTED_COUNT
assert REQUIRED.issubset(files)

for rel, content in files.items():
    assert isinstance(rel, str) and isinstance(content, str)
    target = (ROOT / rel).resolve()
    assert target != ROOT and ROOT in target.parents
    assert rel.startswith(".github/workflows/") or rel.startswith("games/survivor-palau/")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

print(json.dumps({"written": len(files), "rawSHA256": EXPECTED_RAW_SHA256}, indent=2))
