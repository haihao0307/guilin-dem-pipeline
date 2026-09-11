#!/usr/bin/env python3
"""KAOPU R32 candidate: lint a Substance-like graph replay manifest.

This is a source-semantic contract probe. It does not execute Adobe Substance
Engine and does not validate a material's physical or visual correctness.
"""
from __future__ import annotations
import hashlib
import json
import unittest

REQUIRED_CONTEXT = (
    "outputSize",
    "outputFormat",
    "pixelSize",
    "tilingMode",
    "randomSeed",
    "physicalSizeMetres",
)

def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))

def request_key(manifest):
    payload = {
        "sourceSbsSha256": manifest["source"]["sbsSha256"],
        "publishedSbsarSha256": manifest["source"].get("sbsarSha256"),
        "engineVersion": manifest["evaluator"]["substanceEngineVersion"],
        "graphIdentifier": manifest["graph"]["identifier"],
        "parameters": manifest["parameters"],
        "effectiveContext": manifest["effectiveContext"],
        "worldTime": manifest["time"]["worldTime"],
        "worldTimeMapping": manifest["time"]["mapping"],
        "outputs": manifest["outputs"],
    }
    return hashlib.sha256(canonical_json(payload).encode()).hexdigest()

def audit(manifest):
    blockers = []
    warnings = []
    source = manifest.get("source", {})
    graph = manifest.get("graph", {})
    evaluator = manifest.get("evaluator", {})
    context = manifest.get("effectiveContext", {})
    time = manifest.get("time", {})
    outputs = manifest.get("outputs", [])

    if not source.get("sbsSha256"):
        blockers.append("editable-sbs-source-identity-missing")
    if not evaluator.get("substanceEngineVersion"):
        blockers.append("engine-version-missing")
    if not graph.get("identifier"):
        blockers.append("stable-graph-identifier-missing")
    if graph.get("identifier") == graph.get("label"):
        warnings.append("identifier-label-not-proven-distinct")
    for name in REQUIRED_CONTEXT:
        if name not in context:
            blockers.append("effective-context-missing:" + name)
    lineage = manifest.get("inheritanceLineage", {})
    for name in ("outputSize", "outputFormat", "tilingMode", "randomSeed"):
        if name not in lineage:
            blockers.append("inheritance-lineage-missing:" + name)
    if time.get("worldTimeRequired") and time.get("source") == "$time-engine-uptime":
        blockers.append("engine-uptime-cannot-stand-in-for-world-time")
    if time.get("worldTimeRequired") and not time.get("mapping"):
        blockers.append("world-time-mapping-missing")
    if not outputs:
        blockers.append("typed-output-contract-missing")
    for out in outputs:
        for name in ("identifier", "semantic", "valueType", "units", "colorSpace"):
            if name not in out:
                blockers.append(f"output:{out.get('identifier','?')}:missing:{name}")
    if any(p.get("static") and p.get("runtimeExpected") for p in manifest.get("parameters", [])):
        blockers.append("static-parameter-incorrectly-expected-at-runtime")
    if manifest.get("projectPolicy", {}).get("externalBitmapForbidden") and manifest.get("externalBitmaps"):
        blockers.append("external-bitmap-violates-project-policy")
    return {
        "status": "pass" if not blockers else "blocked",
        "blockers": sorted(set(blockers)),
        "warnings": sorted(set(warnings)),
        "requestKey": request_key(manifest) if not blockers else None,
    }

def valid_fixture():
    return {
        "source": {"sbsSha256": "a"*64, "sbsarSha256": "b"*64},
        "graph": {"identifier": "tile_ceramic_v1", "label": "Tile ceramic"},
        "evaluator": {"substanceEngineVersion": "locked-example-version"},
        "parameters": [
            {"identifier": "weathering", "type": "float", "value": 0.3,
             "static": False, "runtimeExpected": True}
        ],
        "effectiveContext": {
            "outputSize": [2048, 2048], "outputFormat": "16-bit",
            "pixelSize": [1, 1], "tilingMode": "H+V", "randomSeed": 23,
            "physicalSizeMetres": [0.238, 0.242, 0.012]
        },
        "inheritanceLineage": {
            "outputSize": "relative-to-parent:resolved",
            "outputFormat": "relative-to-input:resolved",
            "tilingMode": "relative-to-parent:resolved",
            "randomSeed": "relative-to-parent:resolved"
        },
        "time": {"worldTimeRequired": True, "source": "KAOPU",
                 "worldTime": 0, "mapping": "explicit-kaopu-time-v1"},
        "outputs": [
            {"identifier": "height", "semantic": "derived-surface-height",
             "valueType": "scalar", "units": "metres", "colorSpace": "raw-linear"},
            {"identifier": "basecolor", "semantic": "material-base-color",
             "valueType": "float3", "units": "unitless-reflectance",
             "colorSpace": "linear"}
        ],
        "externalBitmaps": [],
        "projectPolicy": {"externalBitmapForbidden": True}
    }

class ContractTests(unittest.TestCase):
    def test_complete_manifest_passes(self):
        self.assertEqual(audit(valid_fixture())["status"], "pass")

    def test_sbsar_cannot_replace_editable_source(self):
        f = valid_fixture(); f["source"]["sbsSha256"] = ""
        self.assertIn("editable-sbs-source-identity-missing", audit(f)["blockers"])

    def test_inherited_seed_requires_resolved_context(self):
        f = valid_fixture(); del f["effectiveContext"]["randomSeed"]
        self.assertIn("effective-context-missing:randomSeed", audit(f)["blockers"])

    def test_inheritance_lineage_is_separate_from_value(self):
        f = valid_fixture(); del f["inheritanceLineage"]["outputFormat"]
        self.assertIn("inheritance-lineage-missing:outputFormat", audit(f)["blockers"])

    def test_engine_uptime_is_not_world_time(self):
        f = valid_fixture(); f["time"]["source"] = "$time-engine-uptime"
        self.assertIn("engine-uptime-cannot-stand-in-for-world-time", audit(f)["blockers"])

    def test_static_parameter_is_not_promised_at_runtime(self):
        f = valid_fixture(); f["parameters"][0]["static"] = True
        self.assertIn("static-parameter-incorrectly-expected-at-runtime", audit(f)["blockers"])

    def test_output_semantics_are_typed(self):
        f = valid_fixture(); del f["outputs"][0]["units"]
        self.assertIn("output:height:missing:units", audit(f)["blockers"])

    def test_project_external_bitmap_policy_is_enforced(self):
        f = valid_fixture(); f["externalBitmaps"] = ["hidden-source.png"]
        self.assertIn("external-bitmap-violates-project-policy", audit(f)["blockers"])

    def test_resolution_changes_cache_identity_not_truth_source(self):
        a = valid_fixture(); b = valid_fixture()
        b["effectiveContext"]["outputSize"] = [1024, 1024]
        self.assertNotEqual(audit(a)["requestKey"], audit(b)["requestKey"])
        self.assertEqual(a["source"]["sbsSha256"], b["source"]["sbsSha256"])

if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ContractTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({
        "schema": "kaopu-substance-graph-contract-probe/r32",
        "testsRun": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "status": "Candidate-pass" if result.wasSuccessful() else "Candidate-fail",
        "runtimeBoundary": "Adobe Substance executables unavailable; source-semantic contract only",
        "productionMotherChanged": False,
        "frozenChanged": False
    }, sort_keys=True))
    raise SystemExit(0 if result.wasSuccessful() else 1)
