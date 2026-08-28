#!/usr/bin/env python3
"""CLI and stable import surface for Yangshuo Lijiang candidate validation v3.0."""
from __future__ import annotations

import argparse, json, sys
from datetime import datetime, timezone
from pathlib import Path

from yangshuo_candidates_v300_common import ValidationError, bounds_center, window_bounds
from yangshuo_candidates_v300_contract import validate_contract

__all__ = ["ValidationError", "bounds_center", "window_bounds", "validate_contract"]

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--config", type=Path, default=Path("projects/guilin/config/yangshuo_lijiang_candidates_v300.json"))
    parser.add_argument("--report", type=Path, default=Path("reports/YANGSHUO_LIJIANG_CANDIDATES_V300_VALIDATION.json"))
    return parser.parse_args()

def main() -> int:
    args = parse_args(); root = args.root.resolve()
    config = args.config if args.config.is_absolute() else root / args.config
    report_path = args.report if args.report.is_absolute() else root / args.report
    try:
        report = validate_contract(root, config); code = 0
    except ValidationError as exc:
        report = {"schemaVersion": "yangshuo-lijiang-candidates-v300-validation/v1",
                  "generatedAtUtc": datetime.now(timezone.utc).isoformat(), "passed": False, "error": str(exc)}
        code = 1
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr if code else sys.stdout)
    return code

if __name__ == "__main__":
    raise SystemExit(main())
