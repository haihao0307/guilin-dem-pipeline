from __future__ import annotations

from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site" / "dist"
R32 = SITE / "r3-2"
DATA = SITE / "r3-1" / "data"

checks: dict[str, object] = {}
errors: list[str] = []


def require(name: str, condition: bool, detail: str = "") -> None:
    checks[name] = bool(condition)
    if not condition:
        errors.append(name + (": " + detail if detail else ""))


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def resolve_locked_path(rel: str) -> Path:
    # terrain.json contains two intentional path forms:
    # - /r3/data/... points at byte-locked R3 files from the site root;
    # - bare names point at R3.1 data files beside terrain.json.
    # Preserve that distinction instead of rewriting either evidence path.
    if rel.startswith("/"):
        return SITE / rel.lstrip("/")
    return DATA / rel


index_path = R32 / "index.html"
app_path = R32 / "app.js"
style_path = R32 / "style.css"
for p in (index_path, app_path, style_path):
    require(f"exists:{p.relative_to(ROOT)}", p.is_file())

if index_path.is_file() and app_path.is_file():
    index = index_path.read_text(encoding="utf-8")
    app = app_path.read_text(encoding="utf-8")

    require("index-relative-style", 'href="./style.css"' in index)
    require("index-relative-app", 'src="./app.js"' in index)
    require("index-relative-three", '"three":"../vendor/three.module.js"' in index)
    require("app-relative-orbit-controls", "from '../vendor/OrbitControls.js'" in app)
    require("app-relative-r31-data", "const DATA_ROOT='../r3-1/data/'" in app)
    require("no-root-vendor-import", "from '/vendor/" not in app)
    require("no-root-r31-data", "DATA_ROOT='/r3-1/data/'" not in app)
    require("eye-height-contract", "const EYE_HEIGHT_M=1.6" in app)
    require("human-move-step", "const EYE_MOVE_M=2" in app)
    require("eye-near-clip-0.1m", "camera.near=.0001" in app)
    require("path-substep-loop", "for(let i=1;i<=parts;i++)" in app)
    require("path-checks-surface", "h===null||!onDisplayedLand(e,n)" in app)
    require("wasd-forward", "w:()=>eyeMode&&moveEyeVector(EYE_MOVE_M)" in app)
    require("wasd-strafe", "d:()=>eyeMode&&moveEyeVector(0,EYE_MOVE_M)" in app)

    node = shutil.which("node")
    if node:
        result = subprocess.run([node, "--check", str(app_path)], capture_output=True, text=True)
        require("node-js-syntax", result.returncode == 0, (result.stderr or result.stdout).strip())
    else:
        checks["node-js-syntax"] = "not-run: node unavailable"

terrain_path = DATA / "terrain.json"
require("r31-terrain-contract-exists", terrain_path.is_file())
if terrain_path.is_file():
    contract = json.loads(terrain_path.read_text(encoding="utf-8"))
    locked_files: list[tuple[str, str]] = []
    for patch in contract.get("patches", []):
        locked_files.append((patch["measurementFile"], patch["measurementSha256"]))
        locked_files.append((patch["validCellFile"], patch["validCellSha256"]))
    hydro = contract.get("hydrography", {})
    for file_key, sha_key in (("landFile", "landSha256"), ("riversFile", "riversSha256")):
        if hydro.get(file_key) and hydro.get(sha_key):
            locked_files.append((hydro[file_key], hydro[sha_key]))

    seen: set[str] = set()
    for rel, expected in locked_files:
        if rel in seen:
            continue
        seen.add(rel)
        p = resolve_locked_path(rel)
        require(f"locked-data-exists:{rel}", p.is_file())
        if p.is_file():
            require(f"locked-data-sha256:{rel}", sha256(p) == expected)

output = {
    "schema": "wenzhou-r3.2-eye-static-qa/r2",
    "passed": not errors,
    "checks": checks,
    "errors": errors,
    "precisionBoundary": "1.6 m is a camera-to-display-surface relation only; it is not terrain accuracy",
}
print(json.dumps(output, ensure_ascii=False, indent=2))
sys.exit(0 if not errors else 1)
