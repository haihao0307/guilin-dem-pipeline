from pathlib import Path
import hashlib
import json
import sys

root = Path(__file__).resolve().parent
manifest_path = root / "MANIFEST.json"
if not manifest_path.is_file():
    print("missing MANIFEST.json")
    sys.exit(1)

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
errors = []
for item in manifest["files"]:
    path = root / item["path"]
    if not path.is_file():
        errors.append(f"missing: {item['path']}")
        continue
    data = path.read_bytes()
    if len(data) != item["bytes"]:
        errors.append(f"size mismatch: {item['path']}")
    if hashlib.sha256(data).hexdigest() != item["sha256"]:
        errors.append(f"hash mismatch: {item['path']}")

workbench = root / "source/workbenches/landscape-surface-r5/index.html"
expected = manifest["acceptedWorkbench"]["sha256"]
if not workbench.is_file() or hashlib.sha256(workbench.read_bytes()).hexdigest() != expected:
    errors.append("accepted workbench identity mismatch")

if errors:
    print("\n".join(errors))
    sys.exit(1)

print(f"OK: {len(manifest['files'])} files verified")
