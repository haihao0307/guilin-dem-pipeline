#!/usr/bin/env python3
import html
import json
import pathlib
import re
import sys

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
match = re.search(r'<pre id="result">(.*?)</pre>', source, re.DOTALL)
if not match:
    error = re.search(r'<pre id="error">(.*?)</pre>', source, re.DOTALL)
    detail = html.unescape(error.group(1)) if error else "result node missing"
    raise SystemExit(f"WebGL2 probe did not complete: {detail}")

result = json.loads(html.unescape(match.group(1)))
checks = {
    "macro-absent-in-webgl2-profile": result["macro"]["macroDefined"] is False,
    "upstream-guard-equals-hard-step": result["exactUpstreamEqualsHard"] is True,
    "direct-derivative-produces-partial-pixels": result["variants"]["webgl2_direct"]["2"]["partialPixelFraction"] > 0.10,
    "guarded-source-produces-no-partial-pixels": result["variants"]["upstream_guarded"]["2"]["partialPixelFraction"] == 0,
    "direct-lowers-coarse-phase-instability": result["variants"]["webgl2_direct"]["2"]["phaseMeanStddev"] < result["variants"]["upstream_guarded"]["2"]["phaseMeanStddev"],
    "direct-lowers-eight-pixel-coverage-error": result["variants"]["webgl2_direct"]["8"]["meanCoverageAbsError"] < result["variants"]["upstream_guarded"]["8"]["meanCoverageAbsError"],
    "webgl2-context-confirmed": "WebGL 2.0" in result["runtime"]["webglVersion"],
    "glsl-300-profile-confirmed": "3.00" in result["runtime"]["shadingLanguageVersion"],
}
result["checks"] = [{"id": key, "pass": value} for key, value in checks.items()]
result["summary"] = {
    "checks": len(checks),
    "passed": sum(checks.values()),
    "failed": len(checks) - sum(checks.values()),
    "status": "pass" if all(checks.values()) else "fail",
}
pathlib.Path(sys.argv[2]).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
if not all(checks.values()):
    raise SystemExit(json.dumps(result["summary"]))
