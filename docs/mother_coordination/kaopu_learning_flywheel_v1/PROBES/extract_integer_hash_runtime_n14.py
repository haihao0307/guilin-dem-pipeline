#!/usr/bin/env python3
import html, json, pathlib, re, sys

dom = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
cpu = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
m = re.search(r'<pre id="result">(.*?)</pre>', dom, re.DOTALL)
if not m:
    e = re.search(r'<pre id="error">(.*?)</pre>', dom, re.DOTALL)
    raise SystemExit(html.unescape(e.group(1)) if e else "result node missing")
r = json.loads(html.unescape(m.group(1)))
expected = [v["hash"] for v in cpu["vectors"]]
gpu = r["webgpu"]
checks = {
    "webgl2-available": r["webgl2"]["available"],
    "webgl2-vector-count": len(r["webgl2"]["hashes"]) == len(expected),
    "webgl2-exact-cpu-match": r["webgl2"]["hashes"] == expected,
    "webgl2-signed-shift-sign-extends": r["webgl2"]["signedRightShiftMinusOne16"] == "0xffffffff",
    "webgl2-unsigned-shift-zero-fills": r["webgl2"]["unsignedRightShiftMinusOneBits16"] == "0x0000ffff",
    "webgpu-available": gpu.get("available", False),
    "webgpu-vector-count": gpu.get("available", False) and len(gpu.get("hashes", [])) == len(expected),
    "webgpu-exact-cpu-match": gpu.get("hashes") == expected,
    "webgl2-webgpu-exact-match": gpu.get("hashes") == r["webgl2"]["hashes"],
}
r["expected"] = expected
r["checks"] = [{"id": k, "pass": bool(v)} for k, v in checks.items()]
r["summary"] = {"checks": len(checks), "passed": sum(bool(v) for v in checks.values()), "failed": sum(not v for v in checks.values()), "status": "pass" if all(checks.values()) else "fail"}
pathlib.Path(sys.argv[3]).write_text(json.dumps(r, indent=2) + "\n", encoding="utf-8")
if not all(checks.values()):
    raise SystemExit(json.dumps(r["summary"]))
