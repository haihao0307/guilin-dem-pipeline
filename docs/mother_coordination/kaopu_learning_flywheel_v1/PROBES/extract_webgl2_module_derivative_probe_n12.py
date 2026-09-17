#!/usr/bin/env python3
import html
import json
import math
import pathlib
import re
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
match = re.search(r'<pre id="result">(.*?)</pre>', source, re.DOTALL)
if not match:
    error = re.search(r'<pre id="error">(.*?)</pre>', source, re.DOTALL)
    raise SystemExit(html.unescape(error.group(1)) if error else "result node missing")
result = json.loads(html.unescape(match.group(1)))
f = result["fields"]
checks = {
    "webgl2-context": "WebGL 2.0" in result["runtime"]["webglVersion"],
    "glsl-300-profile": "3.00" in result["runtime"]["shadingLanguageVersion"],
    "all-captures-finite": all(v[k]["finiteCount"] == v[k]["count"] for v in f.values() for k in ("dx", "seamDx", "dy")),
    "linear-normalized-dfdx": abs(f["linear"]["dx"]["min"] - 1.0) < 1e-4 and abs(f["linear"]["dx"]["max"] - 1.0) < 1e-4,
    "raw-fract-seam-spike": f["fract"]["seamDx"]["min"] <= -120.0 and f["fract"]["seamDx"]["max"] <= 1.01,
    "floor-identity-jump": f["floor"]["seamDx"]["max"] >= 120.0 and f["floor"]["seamDx"]["min"] >= -1e-4,
    "closed-sine-no-wrap-spike": 5.5 <= f["closed_sine"]["seamDx"]["max"] <= 6.5 and f["closed_sine"]["seamDx"]["min"] >= 5.5,
    "abs-kink-bounded": f["abs"]["seamDx"]["min"] <= -0.99 and f["abs"]["seamDx"]["max"] >= 0.99 and f["abs"]["seamDx"]["maxAbs"] <= 1.01,
    "triangle-branch-bounded": f["triangle"]["seamDx"]["min"] <= -1.98 and f["triangle"]["seamDx"]["max"] >= 1.98 and f["triangle"]["seamDx"]["maxAbs"] <= 2.02,
    "constant-y-zero-dfdy": all(v["dy"]["maxAbs"] <= 1e-6 for v in f.values()),
}
result["checks"] = [{"id": key, "pass": value} for key, value in checks.items()]
result["summary"] = {"checks":len(checks), "passed":sum(checks.values()), "failed":len(checks)-sum(checks.values()), "status":"pass" if all(checks.values()) else "fail"}
pathlib.Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
if not all(checks.values()): raise SystemExit(json.dumps(result["summary"]))
