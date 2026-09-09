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
    if rel.startswith("/"):
        return SITE / rel.lstrip("/")
    return DATA / rel


index_path = R32 / "index.html"
bootstrap_path = R32 / "bootstrap.js"
app_path = R32 / "app.js"
sea_path = R32 / "sea-demo.js"
style_path = R32 / "style.css"
for p in (index_path, bootstrap_path, app_path, sea_path, style_path):
    require(f"exists:{p.relative_to(ROOT)}", p.is_file())

if all(p.is_file() for p in (index_path, bootstrap_path, app_path, sea_path)):
    index = index_path.read_text(encoding="utf-8")
    bootstrap = bootstrap_path.read_text(encoding="utf-8")
    app = app_path.read_text(encoding="utf-8")
    sea = sea_path.read_text(encoding="utf-8")

    require("index-relative-style", 'href="./style.css"' in index)
    require("index-single-bootstrap", 'src="./bootstrap.js"' in index and 'src="./app.js"' not in index and 'src="./sea-demo.js"' not in index)
    require("index-relative-three", '"three":"../vendor/three.module.js"' in index)
    require("index-sea-toggle", 'id="show-sea"' in index)
    require("index-sea-precision-boundary", "不代表潮位或测绘高程" in index)
    require("bootstrap-imports-sea", "from './sea-demo.js'" in bootstrap)
    require("bootstrap-installs-sea-first", "installSeaDemo();" in bootstrap)
    require("bootstrap-imports-app-after", "await import('./app.js')" in bootstrap and bootstrap.index("installSeaDemo();") < bootstrap.index("await import('./app.js')"))
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
    require("sea-independent-module", "demonstration-environment-layer" in sea)
    require("sea-display-datum-explicit", "const SEA_DISPLAY_DATUM_M = 0" in sea)
    require("sea-wave-amplitude-explicit", "const SEA_WAVE_AMPLITUDE_M = 0.22" in sea)
    require("sea-reuses-land-mask", "uLandMask: { value: landMask }" in sea and "1.0 - land" in sea)
    require("sea-does-not-modify-dem", "terrain.material.alphaMap" in sea)
    require("sea-dataset-contract", "seaSurfaceKind = 'demonstration'" in sea)

    node = shutil.which("node")
    if node:
        for name, path in (("node-bootstrap-js-syntax", bootstrap_path), ("node-app-js-syntax", app_path), ("node-sea-js-syntax", sea_path)):
            result = subprocess.run([node, "--check", str(path)], capture_output=True, text=True)
            require(name, result.returncode == 0, (result.stderr or result.stdout).strip())
    else:
        checks["node-bootstrap-js-syntax"] = "not-run: node unavailable"
        checks["node-app-js-syntax"] = "not-run: node unavailable"
        checks["node-sea-js-syntax"] = "not-run: node unavailable"

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
    "schema": "wenzhou-r3.2-static-qa/r4",
    "passed": not errors,
    "checks": checks,
    "errors": errors,
    "precisionBoundary": "1.6 m is a camera-to-display-surface relation only; demonstration sea is not tide, vertical datum, bathymetry or terrain accuracy",
}
print(json.dumps(output, ensure_ascii=False, indent=2))
sys.exit(0 if not errors else 1)
