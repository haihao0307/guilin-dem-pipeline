from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def replace_once(text: str, old: str, new: str) -> str:
    if old not in text:
        raise RuntimeError(f"missing expected T06 fragment: {old[:80]}")
    return text.replace(old, new, 1)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r06_t06_tune.py <output-dir>")
    root = Path(sys.argv[1])
    index = root / "index.html"
    html = index.read_text(encoding="utf-8")

    # Preserve a genuinely sparse zero setting, but keep the default useful for A/B.
    html = replace_once(html, '<output id="fineO">0.120</output>', '<output id="fineO">0.220</output>')
    html = replace_once(html, 'step="0.001" value="0.120"', 'step="0.001" value="0.220"')
    html = replace_once(html, 'thickness:.92,fineRetention:.12,fine:.1362,tip:1', 'thickness:.92,fineRetention:.22,fine:.0835,tip:1')
    html = replace_once(html, 'cfg.fineRetention??.12,0,1),fineThreshold=.035+(1-retention)*.115', 'cfg.fineRetention??.22,0,1),fineThreshold=.025+(1-retention)*.075')
    html = replace_once(html, "fineEl.value='0.120';fineOut.value='0.120';cfg.fineRetention=.12;", "fineEl.value='0.220';fineOut.value='0.220';cfg.fineRetention=.22;")
    html = replace_once(html, 'const defaults={thickness:.92,fine:.12,', 'const defaults={thickness:.92,fine:.22,')

    index.write_text(html, encoding="utf-8")
    build_path = root / "BUILD_T06.json"
    build = json.loads(build_path.read_text(encoding="utf-8"))
    build["bytes"] = len(html.encode("utf-8"))
    build["sha256"] = hashlib.sha256(html.encode("utf-8")).hexdigest()
    build["defaultFineRetention"] = 0.22
    build["fineThresholdFormula"] = "0.025 + (1-retention) * 0.075"
    build["browserEvidenceAdjustment"] = "T06 run 1 retained only 15 paths at 0.12; default moved to 0.22 with a lower radius threshold while retaining a true zero-prune endpoint."
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
