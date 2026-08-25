from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "catalog" / "source_manifest.json").read_text(encoding="utf-8"))
failures = []

for item in manifest["sources"]:
    if not item.get("available_in_package"):
        continue
    path = root / "data" / "raw" / "asf" / item["file"]
    if not path.exists():
        failures.append(f"MISSING {path.relative_to(root)}")
        continue
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    actual = h.hexdigest()
    if path.stat().st_size != item["bytes"]:
        failures.append(f"SIZE {item['file']} expected={item['bytes']} actual={path.stat().st_size}")
    if actual != item["sha256"]:
        failures.append(f"HASH {item['file']} expected={item['sha256']} actual={actual}")

if failures:
    print("\n".join(failures))
    sys.exit(1)

print("OK: all physically present 12.5 m DEM files match the clean manifest.")
