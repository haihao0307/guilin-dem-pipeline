#!/usr/bin/env python3
"""Run the reproducible R021 probe; output JSON to stdout, fail on any test."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import platform
import time
import unittest

import test_water_contracts


def main():
    root = Path(__file__).resolve().parents[1]
    stream = io.StringIO()
    start = time.perf_counter()
    suite = unittest.defaultTestLoader.loadTestsFromModule(test_water_contracts)
    with contextlib.redirect_stdout(stream):
        result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    report = {
        "probe": "farmland-water-contract-r021",
        "status": "pass" if result.wasSuccessful() else "fail",
        "testsRun": result.testsRun,
        "failures": len(result.failures), "errors": len(result.errors),
        "elapsed_seconds": time.perf_counter() - start,
        "python": platform.python_version(),
        "sourceSha256": {
            p: hashlib.sha256((root / p).read_bytes()).hexdigest()
            for p in ["tools/validate_farmland_dna.py", "tools/water_ledger.py",
                      "tools/test_water_contracts.py", "tools/probe_water_contracts.py",
                      "schema/farmland-object-dna.schema.json"]
        },
        "scope": "synthetic_accounting_and_counterexamples_only",
        "physicalSixScenarioValidation": "not_run",
        "terrainFit": "not_run", "regionalParametersVerified": False,
        "sharedBoundaryGeometry": "not_started", "browserQA": "not_run",
        "visualAcceptance": False, "productionReady": False,
        "testLog": stream.getvalue(),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())
