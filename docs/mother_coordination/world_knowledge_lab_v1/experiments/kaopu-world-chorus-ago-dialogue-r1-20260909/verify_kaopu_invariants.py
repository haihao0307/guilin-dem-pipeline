#!/usr/bin/env python3
"""Verify the semantic invariant registry for KAOPU World Chorus AGO round R1."""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "KAOPU_INVARIANTS_R1.json"


def main() -> int:
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    checks = []

    checks.append(("schema", data.get("schema") == "kaopu-world-chorus-invariants/1.0"))
    core = data.get("core_terms", [])
    checks.append(("12 unique core terms", len(core) == 12 and len(set(core)) == 12))
    records = data.get("record_types", [])
    checks.append(("7 unique record types", len(records) == 7 and len(set(records)) == 7))
    checks.append(("Observation and Claim separated", "Observation" in records and "Claim" in records))
    forbidden = set(data.get("forbidden_external_execution", []))
    checks.append(("external boundary recorded", {"Anthropic", "Claude Code", "Make"} <= forbidden))

    inv = data.get("invariants", [])
    ids = [x.get("id") for x in inv]
    checks.append(("24 invariants", len(inv) == 24))
    checks.append(("unique invariant ids", len(ids) == len(set(ids))))
    checks.append(("ordered ids K01-K24", ids == [f"K{i:02d}" for i in range(1, 25)]))
    checks.append(("all texts present", all(isinstance(x.get("text"), str) and x["text"].strip() for x in inv)))

    categories = {x.get("category") for x in inv}
    required = set(data.get("required_categories", []))
    checks.append(("all required categories covered", required <= categories))

    text = "\n".join(x["text"].lower() for x in inv)
    checks.append(("unknown states explicit", all(token.lower() in text for token in ["unknown", "notobserved", "observedabsent", "notapplicable"])))
    checks.append(("noise truth boundary", "noise" in text and "historical truth" in text))
    checks.append(("residual protected", "residual" in text))
    checks.append(("timeline reversibility boundary", "reversibility" in text))
    checks.append(("view policy required", "policy version" in text and "transaction time" in text))
    checks.append(("freeze append-only", "append-only" in text))
    checks.append(("global truth score rejected", "no single global truth score" in text))
    checks.append(("Wenzhou pilot present", "wenzhou" in text))
    checks.append(("local extension boundary", "local vocabularies" in text and "core metrology" in text))
    checks.append(("cross-Mother context", "cross-mother" in text and "context" in text))

    passed = 0
    for name, ok in checks:
        if ok:
            print(f"PASS {name}")
            passed += 1
        else:
            print(f"FAIL {name}")
    print(f"RESULT {passed}/{len(checks)} checks passed")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
