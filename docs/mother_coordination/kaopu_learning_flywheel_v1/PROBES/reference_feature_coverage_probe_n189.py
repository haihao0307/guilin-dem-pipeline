"""N189 candidate verifier probe; synthetic fixtures, not production asset validation."""

import hashlib
import json


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def verify(case):
    anchor = case["anchor"]
    receipt = case["receipt"]
    failures = []

    if not anchor.get("referenceSetDigest") or not anchor.get("referenceViewId"):
        failures.append("REFERENCE_NOT_BOUND")
    if anchor.get("creativeAuthorization") is not False:
        failures.append("REPLICATION_LOCK_NOT_FROZEN")

    ledger = anchor.get("featureLedger", [])
    if not ledger:
        failures.append("FEATURE_LEDGER_MISSING")
    for feature in ledger:
        mapping = receipt.get("featureMappings", {}).get(feature["id"])
        if not feature.get("sourceRegion") or not mapping:
            failures.append(f"UNMAPPED:{feature['id']}")
            continue
        if not mapping.get("candidateElement"):
            failures.append(f"NO_CANDIDATE_ELEMENT:{feature['id']}")
        if not mapping.get("observedMatchesReference"):
            failures.append(f"FEATURE_MISMATCH:{feature['id']}")

    if receipt.get("candidateGeometryDigest") == anchor.get("rejectedParentGeometryDigest"):
        failures.append("SAME_REJECTED_GEOMETRY")
    if not receipt.get("geometryChanged"):
        failures.append("NO_GEOMETRY_DELTA")
    if receipt.get("cameraOnlyChange"):
        failures.append("CAMERA_ONLY_CHANGE")
    if receipt.get("materialOnlyChange"):
        failures.append("MATERIAL_ONLY_CHANGE")
    if receipt.get("rejectedParentInherited"):
        failures.append("REJECTED_LINEAGE_INHERITED")
    if receipt.get("unauthorizedVisibleFeatures", 0) != 0:
        failures.append("UNAUTHORIZED_VISIBLE_FEATURE")
    if not receipt.get("protectedRegionsStable"):
        failures.append("PROTECTED_REGION_DRIFT")
    if not receipt.get("matchedViewEvidence"):
        failures.append("MATCHED_VIEW_EVIDENCE_MISSING")
    if not receipt.get("independentVerifier"):
        failures.append("PRODUCER_SELF_APPROVAL")

    return {"acceptedAsCandidate": not failures, "failures": failures}


anchor = {
    "referenceSetDigest": "sha256:reference-photo-a",
    "referenceViewId": "front-facade-crop-v1",
    "creativeAuthorization": False,
    "rejectedParentGeometryDigest": "sha256:old-generic-facade",
    "featureLedger": [
        {"id": "window-bay-rhythm", "sourceRegion": [0.10, 0.18, 0.72, 0.79]},
        {"id": "right-blank-wall", "sourceRegion": [0.73, 0.16, 0.94, 0.82]},
        {"id": "lintel-height-band", "sourceRegion": [0.10, 0.16, 0.72, 0.35]},
    ],
}


def valid_receipt():
    return {
        "candidateGeometryDigest": "sha256:new-reference-derived-facade",
        "geometryChanged": True,
        "cameraOnlyChange": False,
        "materialOnlyChange": False,
        "rejectedParentInherited": False,
        "unauthorizedVisibleFeatures": 0,
        "protectedRegionsStable": True,
        "matchedViewEvidence": True,
        "independentVerifier": True,
        "featureMappings": {
            "window-bay-rhythm": {"candidateElement": "facade.windows.bays", "observedMatchesReference": True},
            "right-blank-wall": {"candidateElement": "facade.right_solid", "observedMatchesReference": True},
            "lintel-height-band": {"candidateElement": "facade.windows.lintel_band", "observedMatchesReference": True},
        },
    }


fixtures = []


def add(name, mutate, expected):
    receipt = valid_receipt()
    mutate(receipt)
    fixtures.append({"name": name, "anchor": anchor, "receipt": receipt, "expected": expected})


add("same geometry, new screenshot", lambda r: r.update(candidateGeometryDigest=anchor["rejectedParentGeometryDigest"], geometryChanged=False), False)
add("camera change only", lambda r: r.update(cameraOnlyChange=True, geometryChanged=False), False)
add("material change only", lambda r: r.update(materialOnlyChange=True, geometryChanged=False), False)
add("generic windows, wrong bay rhythm", lambda r: r["featureMappings"]["window-bay-rhythm"].update(observedMatchesReference=False), False)
add("invented window in reference blank wall", lambda r: r.update(unauthorizedVisibleFeatures=1), False)
add("feature claim without candidate element", lambda r: r["featureMappings"]["lintel-height-band"].update(candidateElement=""), False)
add("correct geometry but rejected lineage inherited", lambda r: r.update(rejectedParentInherited=True), False)
add("reference-derived mapped geometry", lambda r: None, True)

results = []
for fixture in fixtures:
    outcome = verify(fixture)
    results.append({
        "name": fixture["name"],
        "expected": fixture["expected"],
        "actual": outcome["acceptedAsCandidate"],
        "failures": outcome["failures"],
        "pass": fixture["expected"] == outcome["acceptedAsCandidate"],
    })

report = {
    "schemaVersion": "n189-v1",
    "probeKind": "synthetic_verifier_method_probe_not_production_asset_validation",
    "fixtureDigest": digest(fixtures),
    "caseCount": len(results),
    "passed": sum(row["pass"] for row in results),
    "allExpectedOutcomesMatched": all(row["pass"] for row in results),
    "results": results,
    "interpretation": "Side-by-side evidence is insufficient: acceptance also requires reference-feature coverage, a real geometry delta from rejected lineage, no unauthorized visible feature, matched-view evidence, and independent verification.",
}

print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
assert report["allExpectedOutcomesMatched"]
