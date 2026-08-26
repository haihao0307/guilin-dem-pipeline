#!/usr/bin/env python3
"""Fail-closed validator for the DEM procedural landscape v0.2 contracts."""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

try:
    from tools.procedural_landscape.contracts import validate_registry, validate_schemas
    from tools.procedural_landscape.projects import validate_binding, validate_layers, validate_status
except ModuleNotFoundError:
    from contracts import validate_registry, validate_schemas
    from projects import validate_binding, validate_layers, validate_status


@dataclass(frozen=True)
class Issue:
    severity: str
    code: str
    path: str
    message: str


class Validation:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.issues: list[Issue] = []
        self.binding_count = 0
        self.branch_count = 0
        self.layer_count = 0

    def add(self, code: str, path: Path | str, message: str, severity: str = "error") -> None:
        path_value = Path(path)
        try:
            path_text = str(path_value.resolve().relative_to(self.root))
        except (ValueError, OSError):
            path_text = str(path)
        self.issues.append(Issue(severity, code, path_text, message))

    def load(self, relative: Path) -> dict[str, Any] | None:
        path = self.root / relative
        if not path.is_file():
            self.add("FILE_MISSING", relative, "Required JSON file is missing.")
            return None
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            self.add("JSON_INVALID", relative, str(exc))
            return None
        if not isinstance(value, dict):
            self.add("JSON_ROOT_TYPE", relative, "JSON root must be an object.")
            return None
        return value

    def require_file(self, value: Any, owner: Path, label: str) -> None:
        if not isinstance(value, str) or not value:
            self.add("PATH_EMPTY", owner, f"{label} must be a non-empty string.")
        elif not (self.root / value).is_file():
            self.add("PATH_TARGET_MISSING", owner, f"{label} points to missing file: {value}")

    def run(self) -> dict[str, Any]:
        validate_schemas(self)
        branches, version = validate_registry(self)
        bindings = sorted(self.root.glob("projects/*/config/procedural_landscape_binding_v020.json"))
        self.binding_count = len(bindings)
        if not bindings:
            self.add("PROJECT_BINDINGS_MISSING", "projects", "At least one v0.2 binding is required.")
        for path in bindings:
            validate_binding(self, path.relative_to(self.root), branches, version)
        validate_layers(self)
        validate_status(self)
        errors = sum(issue.severity == "error" for issue in self.issues)
        warnings = sum(issue.severity == "warning" for issue in self.issues)
        return {
            "schema": "dem_procedural_landscape_validation@2.0.0",
            "passed": errors == 0,
            "errors": errors,
            "warnings": warnings,
            "projectBindings": self.binding_count,
            "registeredBranches": self.branch_count,
            "layerManifests": self.layer_count,
            "issues": [asdict(issue) for issue in self.issues],
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--json-report", type=Path)
    args = parser.parse_args()
    result = Validation(args.root).run()
    payload = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    print(payload, end="")
    if args.json_report:
        output = args.json_report if args.json_report.is_absolute() else args.root / args.json_report
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(payload, encoding="utf-8")
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
