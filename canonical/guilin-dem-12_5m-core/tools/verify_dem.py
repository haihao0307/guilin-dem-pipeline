from pathlib import Path
import hashlib
import json
import sys


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "raw" / "asf"
MANIFEST = ROOT / "catalog" / "source_manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
failures = []
expected = set()

for item in manifest["sources"]:
    path = DATA / item["file"]
    expected.add(path.name)
    if not path.exists():
        failures.append(f"MISSING {path.relative_to(ROOT)}")
        continue
    if path.stat().st_size != item["bytes"]:
        failures.append(f"SIZE {item['file']}")
    actual = sha256(path)
    if actual != item["sha256"]:
        failures.append(f"HASH {item['file']} expected={item['sha256']} actual={actual}")
    metadata = DATA / item["metadata_file"]
    if not metadata.exists():
        failures.append(f"MISSING_METADATA {metadata.relative_to(ROOT)}")

actual_tifs = {path.name for path in DATA.glob("*.dem.tif")}
if actual_tifs != expected:
    failures.append(f"SOURCE_SET_MISMATCH expected={sorted(expected)} actual={sorted(actual_tifs)}")

if failures:
    print("\n".join(failures))
    sys.exit(1)

print(f"OK: {len(expected)} DEM sources and paired ISO metadata match the clean manifest.")
