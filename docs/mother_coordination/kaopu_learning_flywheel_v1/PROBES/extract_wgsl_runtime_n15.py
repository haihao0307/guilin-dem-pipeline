#!/usr/bin/env python3
import html, json, pathlib, re, sys

dom = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
m = re.search(r'<pre id="result">(.*?)</pre>', dom, re.DOTALL)
if not m:
    e = re.search(r'<pre id="error">(.*?)</pre>', dom, re.DOTALL)
    raise SystemExit(html.unescape(e.group(1)) if e else "result node missing")
r = json.loads(html.unescape(m.group(1)))
checks = {
    "wgsl-module-compiled": r["wgsl"]["compiled"],
    "wgsl-vector-count-12": len(r["wgsl"]["hashes"]) == 12,
    "wgsl-exact-cpu-glsl-match": r["wgsl"]["exactMatch"],
    "wgsl-no-compilation-errors": not any(m["type"] == "error" for m in r["wgsl"]["compilationMessages"]),
}
r["checks"] = [{"id": k, "pass": bool(v)} for k, v in checks.items()]
r["summary"] = {"checks": len(checks), "passed": sum(bool(v) for v in checks.values()), "failed": sum(not v for v in checks.values()), "status": "pass" if all(checks.values()) else "fail"}
pathlib.Path(sys.argv[2]).write_text(json.dumps(r, indent=2) + "\n", encoding="utf-8")
if not all(checks.values()):
    raise SystemExit(json.dumps(r["summary"]))
