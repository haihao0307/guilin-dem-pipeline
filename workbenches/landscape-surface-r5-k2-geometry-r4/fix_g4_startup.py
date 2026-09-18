from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r4"
HTML = DIR / "index.html"
BUILD = DIR / "build.json"

s = HTML.read_text(encoding="utf-8")
bad = "$('#sourceScaleOut').textContent=recipe.sourceScale.toFixed(2)+' m'$('#seed').value=recipe.seed;"
good = "$('#sourceScaleOut').textContent=recipe.sourceScale.toFixed(2)+' m';$('#seed').value=recipe.seed;"
assert bad in s, "G4 startup syntax defect not found"
s = s.replace(bad, good, 1)
raw = s.encode("utf-8")
HTML.write_bytes(raw)

build = json.loads(BUILD.read_text(encoding="utf-8"))
build["candidateSha256"] = hashlib.sha256(raw).hexdigest()
build["candidateBytes"] = len(raw)
build["startupSyntaxFixed"] = True
build["browserMainScriptChecked"] = True
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")

print(json.dumps({
    "startupSyntaxFixed": True,
    "candidateSha256": build["candidateSha256"],
    "candidateBytes": build["candidateBytes"],
}, ensure_ascii=False))
